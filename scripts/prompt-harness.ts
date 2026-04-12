import fs from 'fs';
import path from 'path';
import * as dotenv from 'dotenv';
import { NodeRagService } from '../src/lib/nodeRagService';
import type { BasisBucketKey, ExpertAnswerEnvelope, PromptMode, RetrievalMode } from '../src/lib/ragTypes';

dotenv.config();

interface HarnessCase {
  id: string;
  mode: PromptMode;
  question: string;
  expected_answer_type: ExpertAnswerEnvelope['answerType'];
  expected_retrieval_mode: RetrievalMode;
  required_basis: BasisBucketKey[];
  expected_workflow_events?: string[];
  required_terms?: string[];
  forbidden_terms?: string[];
  minimum_block_items?: number;
  notes?: string;
}

interface HarnessCheck {
  name: string;
  passed: boolean;
  details: string;
}

interface CaseResult {
  id: string;
  mode: PromptMode;
  question: string;
  score: number | null;
  checks: HarnessCheck[];
  answerType?: string;
  retrievalMode?: string;
  workflowEvents?: string[];
  output?: string;
}

interface CliOptions {
  dryRun: boolean;
  model: string;
  caseId?: string;
  limit?: number;
  outputPath?: string;
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    dryRun: false,
    model: process.env.PROMPT_HARNESS_MODEL || 'gemini-3-flash-preview',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') options.dryRun = true;
    if (arg === '--model' && argv[i + 1]) options.model = argv[++i];
    if (arg === '--case' && argv[i + 1]) options.caseId = argv[++i];
    if (arg === '--limit' && argv[i + 1]) options.limit = Number(argv[++i]);
    if (arg === '--output' && argv[i + 1]) options.outputPath = argv[++i];
  }

  return options;
}

function loadCases(projectRoot: string): HarnessCase[] {
  const casesPath = path.join(projectRoot, 'prompt_harness', 'cases.json');
  return JSON.parse(fs.readFileSync(casesPath, 'utf8')) as HarnessCase[];
}

function collectAnswerText(answer: ExpertAnswerEnvelope): string {
  return [
    answer.headline,
    answer.summary,
    answer.scope,
    ...answer.blocks.flatMap((block) => [block.title, block.intro ?? '', ...block.items.flatMap((item) => [item.label, item.detail])]),
    ...answer.followUps,
  ]
    .filter(Boolean)
    .join('\n');
}

function scoreAnswer(testCase: HarnessCase, answer: ExpertAnswerEnvelope, retrievalMode: string, workflowEvents: string[]): CaseResult {
  const answerText = collectAnswerText(answer);
  const checks: HarnessCheck[] = [
    {
      name: 'answer_type',
      passed: answer.answerType === testCase.expected_answer_type,
      details: `expected=${testCase.expected_answer_type}, actual=${answer.answerType}`,
    },
    {
      name: 'retrieval_mode',
      passed: retrievalMode === testCase.expected_retrieval_mode,
      details: `expected=${testCase.expected_retrieval_mode}, actual=${retrievalMode}`,
    },
    {
      name: 'basis_separation',
      passed: testCase.required_basis.every((bucket) => answer.basis[bucket].length > 0),
      details: testCase.required_basis
        .map((bucket) => `${bucket}=${answer.basis[bucket].length}`)
        .join(', '),
    },
    {
      name: 'task_coverage',
      passed:
        typeof testCase.minimum_block_items === 'number'
          ? answer.blocks.some((block) => block.items.length >= testCase.minimum_block_items)
          : true,
      details:
        typeof testCase.minimum_block_items === 'number'
          ? `max_items=${Math.max(0, ...answer.blocks.map((block) => block.items.length))}`
          : 'not required',
    },
    {
      name: 'citation_precision',
      passed:
        answer.citations.length > 0 &&
        answer.citations.every((citation) => !/chunk|window|evidence\s*\d+/i.test(citation.label)),
      details: `citations=${answer.citations.length}`,
    },
    {
      name: 'workflow_events',
      passed:
        (testCase.expected_workflow_events ?? []).length === 0 ||
        (testCase.expected_workflow_events ?? []).every((event) => workflowEvents.includes(event)),
      details: workflowEvents.join(', ') || 'none',
    },
    {
      name: 'required_terms',
      passed: (testCase.required_terms ?? []).every((term) => answerText.includes(term)),
      details: `required=${(testCase.required_terms ?? []).join(', ') || 'none'}`,
    },
    {
      name: 'forbidden_terms',
      passed: (testCase.forbidden_terms ?? []).every((term) => !answerText.includes(term)),
      details: `forbidden=${(testCase.forbidden_terms ?? []).join(', ') || 'none'}`,
    },
  ];

  const passedChecks = checks.filter((check) => check.passed).length;
  return {
    id: testCase.id,
    mode: testCase.mode,
    question: testCase.question,
    score: Math.round((passedChecks / checks.length) * 100),
    checks,
    answerType: answer.answerType,
    retrievalMode,
    workflowEvents,
    output: answerText,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const projectRoot = process.cwd();
  const ragService = new NodeRagService(projectRoot);
  await ragService.initialize();
  let cases = loadCases(projectRoot);

  if (options.caseId) cases = cases.filter((testCase) => testCase.id === options.caseId);
  if (typeof options.limit === 'number' && Number.isFinite(options.limit)) cases = cases.slice(0, options.limit);
  if (cases.length === 0) throw new Error('No harness cases selected.');

  const apiKey = process.env.GEMINI_API_KEY;
  if (!options.dryRun && !apiKey) {
    throw new Error('GEMINI_API_KEY is required unless --dry-run is used.');
  }

  const results: CaseResult[] = [];
  for (const testCase of cases) {
    if (options.dryRun) {
      const inspection = await ragService.inspectRetrieval(testCase.question, testCase.mode);
      const checks: HarnessCheck[] = [
        {
          name: 'retrieval_mode',
          passed: inspection.selectedRetrievalMode === testCase.expected_retrieval_mode,
          details: `expected=${testCase.expected_retrieval_mode}, actual=${inspection.selectedRetrievalMode}`,
        },
        {
          name: 'workflow_events',
          passed:
            (testCase.expected_workflow_events ?? []).length === 0 ||
            (testCase.expected_workflow_events ?? []).every((event) => inspection.workflowEventsHit.includes(event)),
          details: inspection.workflowEventsHit.join(', ') || 'none',
        },
      ];

      results.push({
        id: testCase.id,
        mode: testCase.mode,
        question: testCase.question,
        score: null,
        checks,
        retrievalMode: inspection.selectedRetrievalMode,
        workflowEvents: inspection.workflowEventsHit,
      });
      console.log(`[${testCase.id}] dry-run ${inspection.selectedRetrievalMode}`);
      continue;
    }

    const response = await ragService.generateChatResponse({
      messages: [{ role: 'user', text: testCase.question }],
      mode: testCase.mode,
      model: options.model,
      promptVariant: 'v2',
      apiKey,
    });

    const result = scoreAnswer(
      testCase,
      response.answer,
      response.retrieval.selectedRetrievalMode,
      response.retrieval.workflowEventsHit,
    );
    results.push(result);
    console.log(`[${testCase.id}] ${result.score}`);
  }

  const scored = results.filter((result) => typeof result.score === 'number');
  const average = scored.length > 0 ? Math.round(scored.reduce((sum, result) => sum + (result.score ?? 0), 0) / scored.length) : null;
  const payload = {
    generatedAt: new Date().toISOString(),
    dryRun: options.dryRun,
    model: options.dryRun ? null : options.model,
    average,
    results,
  };

  const defaultOutput = path.join(projectRoot, 'prompt_harness', 'results', `run-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  const outputPath = options.outputPath ? path.resolve(projectRoot, options.outputPath) : defaultOutput;
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2), 'utf8');

  console.log(`Saved results to ${outputPath}`);
  console.log(`Average: ${average === null ? 'n/a (dry-run)' : average}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`prompt-harness failed: ${message}`);
  process.exitCode = 1;
});
