import type { PromptMode, RetrievalMode } from './ragTypes';

export type PromptVariant = 'baseline' | 'v2';
export type PromptContract = 'planner' | 'synthesizer';

export interface PromptSourceSet {
  baseline: string;
  base: string;
  overlays: Record<PromptMode, string>;
}

const CONTEXT_HEADER = '# Retrieved Knowledge Context';
const EMPTY_CONTEXT_FALLBACK = [
  '(no retrieved knowledge context)',
  'If direct grounding is missing, keep the answer conservative and surface what is missing.',
].join('\n');
const ANSWER_TYPE_SELECTION_GUIDE = [
  '# Answer Type Selection',
  '- `verdict`: use when the user asks whether something is allowed, required, compliant, or risky.',
  '- `checklist`: use when the user needs preparation items, operating checks, or broad task coverage.',
  '- `procedure`: use when the user asks how to do a sequence, submit, record, notify, or remediate.',
  '- `comparison`: use when the answer must compare rules, years, document versions, roles, or service scopes.',
  '- `definition`: use when the user asks what a term, standard, indicator, or document means.',
  '- `mixed`: use when more than one shape is required, but still separate legal, evaluation, and practical basis.',
].join('\n');

function normalizeBlock(text: string): string {
  return text.replace(/\r\n/g, '\n').trim();
}

function getPromptBody(mode: PromptMode, variant: PromptVariant, sources: PromptSourceSet): string {
  if (variant === 'baseline') {
    return normalizeBlock(sources.baseline);
  }

  return [sources.base, sources.overlays[mode]].map(normalizeBlock).filter(Boolean).join('\n\n---\n\n');
}

function buildContextBlock(knowledgeContext: string): string {
  const contextBlock = normalizeBlock(knowledgeContext) || EMPTY_CONTEXT_FALLBACK;
  return `${CONTEXT_HEADER}\n${contextBlock}`;
}

function buildContractInstructions(contract: PromptContract, retrievalMode: RetrievalMode | undefined): string {
  if (contract === 'planner') {
    return [
      '# Planner Contract',
      '- Interpret the user question as an expert work-assistant request, not as a markdown formatting task.',
      '- Decide the most useful answer shape from the supported answer types.',
      '- Keep legal, evaluation, and practical basis separate.',
      '- Prefer concise, deterministic planning over stylistic prose.',
      retrievalMode ? `- The selected retrieval mode is \`${retrievalMode}\`. Respect that choice unless the evidence clearly shows a mismatch.` : null,
      ANSWER_TYPE_SELECTION_GUIDE,
    ]
      .filter(Boolean)
      .join('\n');
  }

  return [
    '# Synthesizer Contract',
    '- Produce an expert answer as semantic JSON only.',
    '- Do not emit markdown section headers or presentation markup.',
    '- Use blocks to organize the answer by user need: verdict, checklist, procedure, comparison, definition, or mixed.',
    '- Keep legal, evaluation, and practical basis explicitly separated.',
    '- Prefer practical completeness over rhetorical flourish.',
    retrievalMode ? `- The selected retrieval mode is \`${retrievalMode}\`. Keep the structure aligned with what that retrieval path can justify.` : null,
    ANSWER_TYPE_SELECTION_GUIDE,
  ]
    .filter(Boolean)
    .join('\n');
}

export function buildVariantSystemInstruction(options: {
  mode: PromptMode;
  variant: PromptVariant;
  knowledgeContext: string;
  sources: PromptSourceSet;
  contract?: PromptContract;
  retrievalMode?: RetrievalMode;
  extraInstructions?: string[];
}): string {
  const promptBody = getPromptBody(options.mode, options.variant, options.sources);
  const contract = options.contract ?? 'synthesizer';

  return [
    promptBody,
    buildContractInstructions(contract, options.retrievalMode),
    ...(options.extraInstructions ?? []).filter(Boolean),
    buildContextBlock(options.knowledgeContext),
  ]
    .filter(Boolean)
    .join('\n\n---\n\n');
}

export function buildPlannerSystemInstruction(options: {
  mode: PromptMode;
  variant: PromptVariant;
  knowledgeContext: string;
  sources: PromptSourceSet;
  retrievalMode?: RetrievalMode;
  extraInstructions?: string[];
}): string {
  return buildVariantSystemInstruction({
    ...options,
    contract: 'planner',
  });
}

export function buildSynthesizerSystemInstruction(options: {
  mode: PromptMode;
  variant: PromptVariant;
  knowledgeContext: string;
  sources: PromptSourceSet;
  retrievalMode?: RetrievalMode;
  extraInstructions?: string[];
}): string {
  return buildVariantSystemInstruction({
    ...options,
    contract: 'synthesizer',
  });
}
