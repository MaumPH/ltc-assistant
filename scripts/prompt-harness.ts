import fs from 'fs';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import * as dotenv from 'dotenv';
import { loadKnowledgeCorporaFromDisk } from '../src/lib/nodeKnowledge';
import {
  EVIDENCE_STATES,
  REQUIRED_RESPONSE_SECTIONS,
  buildVariantSystemInstruction,
  type EvidenceState,
  type PromptVariant,
} from '../src/lib/promptAssembly';
import { loadPromptSourceSet } from '../src/lib/nodePrompts';
import { searchKnowledge, type PromptMode } from '../src/lib/ragCore';

dotenv.config();

interface HarnessCase {
  id: string;
  mode: PromptMode;
  question: string;
  expected_state: EvidenceState;
  must_include: string[];
  must_not_include: string[];
  requires_clarification: boolean;
  notes: string;
  extra_context?: string;
}

interface HarnessCheck {
  name: string;
  passed: boolean;
  details: string;
}

interface VariantResult {
  variant: PromptVariant;
  model?: string;
  promptChars: number;
  retrievedChars: number;
  retrievedPreview: string;
  output?: string;
  extractedState?: string | null;
  score: number | null;
  checks: HarnessCheck[];
}

interface CliOptions {
  dryRun: boolean;
  variant: PromptVariant | 'both';
  model: string;
  caseId?: string;
  limit?: number;
  outputPath?: string;
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    dryRun: false,
    variant: 'both',
    model: process.env.PROMPT_HARNESS_MODEL || 'gemini-3-flash-preview',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') options.dryRun = true;
    if (arg === '--variant' && argv[i + 1]) options.variant = argv[++i] as CliOptions['variant'];
    if (arg === '--model' && argv[i + 1]) options.model = argv[++i];
    if (arg === '--case' && argv[i + 1]) options.caseId = argv[++i];
    if (arg === '--limit' && argv[i + 1]) options.limit = Number(argv[++i]);
    if (arg === '--output' && argv[i + 1]) options.outputPath = argv[++i];
  }

  return options;
}

function extractState(output: string): string | null {
  const compact = output.replace(/\r\n/g, '\n');
  const match = compact.match(/\[답변 가능 상태\]\s*[:：]?\s*(확정|부분확정|충돌|확인 불가)/);
  return match?.[1] ?? null;
}

function detectClarification(output: string): boolean {
  const cues = [
    '추가 확인',
    '먼저 확인',
    '확인이 필요',
    '알려주시면',
    '확인해 주세요',
    '질문드립니다',
    '필요합니다',
  ];
  return cues.some(cue => output.includes(cue)) || output.includes('?');
}

function scoreResponse(testCase: HarnessCase, output: string): { score: number; checks: HarnessCheck[]; state: string | null } {
  const extractedState = extractState(output);
  const missingIncludes = testCase.must_include.filter(item => !output.includes(item));
  const presentForbidden = testCase.must_not_include.filter(item => output.includes(item));
  const missingSections = REQUIRED_RESPONSE_SECTIONS.filter(section => !output.includes(section));
  const clarificationDetected = detectClarification(output);

  const checks: HarnessCheck[] = [
    {
      name: 'state',
      passed: extractedState === testCase.expected_state,
      details: `expected=${testCase.expected_state}, actual=${extractedState ?? 'none'}`,
    },
    {
      name: 'sections',
      passed: missingSections.length === 0,
      details: missingSections.length === 0 ? 'all required sections present' : `missing: ${missingSections.join(', ')}`,
    },
    {
      name: 'must_include',
      passed: missingIncludes.length === 0,
      details: missingIncludes.length === 0 ? 'all required substrings found' : `missing: ${missingIncludes.join(', ')}`,
    },
    {
      name: 'must_not_include',
      passed: presentForbidden.length === 0,
      details: presentForbidden.length === 0 ? 'no forbidden substrings found' : `present: ${presentForbidden.join(', ')}`,
    },
    {
      name: 'clarification',
      passed: testCase.requires_clarification ? clarificationDetected : true,
      details: testCase.requires_clarification
        ? clarificationDetected
          ? 'clarification cue detected'
          : 'expected clarification cue but none found'
        : 'not required',
    },
  ];

  const passedChecks = checks.filter(check => check.passed).length;
  return {
    state: extractedState,
    checks,
    score: Math.round((passedChecks / checks.length) * 100),
  };
}

function loadCases(projectRoot: string): HarnessCase[] {
  const casesPath = path.join(projectRoot, 'prompt_harness', 'cases.json');
  const raw = fs.readFileSync(casesPath, 'utf8');
  const parsed = JSON.parse(raw) as HarnessCase[];

  for (const testCase of parsed) {
    if (!EVIDENCE_STATES.includes(testCase.expected_state)) {
      throw new Error(`Unknown expected_state in case ${testCase.id}: ${testCase.expected_state}`);
    }
  }

  return parsed;
}

function buildRetrievedContext(
  testCase: HarnessCase,
  corpora: Record<PromptMode, ReturnType<typeof loadKnowledgeCorporaFromDisk>[PromptMode]>,
): string {
  const retrieved = searchKnowledge(corpora[testCase.mode], testCase.question);
  return [retrieved.trim(), testCase.extra_context?.trim()].filter(Boolean).join('\n\n');
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const projectRoot = process.cwd();
  const corpora = loadKnowledgeCorporaFromDisk(projectRoot);
  const promptSources = loadPromptSourceSet(projectRoot);
  let cases = loadCases(projectRoot);

  if (options.caseId) cases = cases.filter(testCase => testCase.id === options.caseId);
  if (typeof options.limit === 'number' && Number.isFinite(options.limit)) cases = cases.slice(0, options.limit);
  if (cases.length === 0) throw new Error('No harness cases selected.');

  const variants: PromptVariant[] = options.variant === 'both' ? ['baseline', 'v2'] : [options.variant];
  const apiKey = process.env.GEMINI_API_KEY;
  if (!options.dryRun && !apiKey) {
    throw new Error('GEMINI_API_KEY is required unless --dry-run is used.');
  }

  const ai = !options.dryRun && apiKey ? new GoogleGenAI({ apiKey }) : null;
  const results: Array<{
    id: string;
    mode: PromptMode;
    question: string;
    notes: string;
    variants: VariantResult[];
  }> = [];

  for (const testCase of cases) {
    const knowledgeContext = buildRetrievedContext(testCase, corpora);
    const perVariant: VariantResult[] = [];

    for (const variant of variants) {
      const systemInstruction = buildVariantSystemInstruction({
        mode: testCase.mode,
        variant,
        knowledgeContext,
        sources: promptSources,
      });

      if (!ai) {
        perVariant.push({
          variant,
          promptChars: systemInstruction.length,
          retrievedChars: knowledgeContext.length,
          retrievedPreview: knowledgeContext.slice(0, 600),
          score: null,
          checks: [
            {
              name: 'dry_run',
              passed: true,
              details: 'prompt assembly and retrieval completed without model execution',
            },
          ],
        });
        continue;
      }

      const response = await ai.models.generateContent({
        model: options.model,
        contents: [{ role: 'user', parts: [{ text: testCase.question }] }],
        config: {
          systemInstruction,
          temperature: 0.1,
        },
      });

      const output = response.text || '';
      const scored = scoreResponse(testCase, output);

      perVariant.push({
        variant,
        model: options.model,
        promptChars: systemInstruction.length,
        retrievedChars: knowledgeContext.length,
        retrievedPreview: knowledgeContext.slice(0, 600),
        output,
        extractedState: scored.state,
        score: scored.score,
        checks: scored.checks,
      });
    }

    results.push({
      id: testCase.id,
      mode: testCase.mode,
      question: testCase.question,
      notes: testCase.notes,
      variants: perVariant,
    });

    const summary = perVariant
      .map(result => `${result.variant}:${result.score === null ? 'dry-run' : result.score}`)
      .join(' | ');
    console.log(`[${testCase.id}] ${summary}`);
  }

  const totals = variants.map(variant => {
    const scores = results
      .map(result => result.variants.find(entry => entry.variant === variant)?.score)
      .filter((score): score is number => typeof score === 'number' && score >= 0);
    const average = scores.length === 0 ? null : Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
    return { variant, average, cases: scores.length };
  });

  const payload = {
    generatedAt: new Date().toISOString(),
    dryRun: options.dryRun,
    model: options.dryRun ? null : options.model,
    totals,
    results,
  };

  const defaultOutput = path.join(projectRoot, 'prompt_harness', 'results', `run-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  const outputPath = options.outputPath ? path.resolve(projectRoot, options.outputPath) : defaultOutput;
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2), 'utf8');

  console.log(`Saved results to ${outputPath}`);
  for (const total of totals) {
    const averageLabel = total.average === null ? 'n/a (dry-run)' : total.average;
    console.log(`Average ${total.variant}: ${averageLabel} (${total.cases} scored cases)`);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`prompt-harness failed: ${message}`);
  process.exitCode = 1;
});
