import type { PromptMode } from './ragCore';

export const EVIDENCE_STATES = ['확정', '부분확정', '충돌', '확인 불가'] as const;
export type EvidenceState = typeof EVIDENCE_STATES[number];
export type PromptVariant = 'baseline' | 'v2';

export const REQUIRED_RESPONSE_SECTIONS = [
  '[답변 가능 상태]',
  '[기준 시점]',
  '[결론]',
  '[확정 근거]',
  '[실무 해석/운영 참고]',
  '[예외·주의 및 추가 확인사항]',
  '[출처]',
] as const;

export interface PromptSourceSet {
  baseline: string;
  base: string;
  overlays: Record<PromptMode, string>;
}

const CONTEXT_HEADER = '# 관련 지식베이스 문서 (아래 문서에만 근거하여 답변할 것)';
const EMPTY_CONTEXT_FALLBACK = [
  '(검색된 관련 문서 없음)',
  '이 경우 외부 지식으로 보완하지 말고, 필요한 확인 질문 또는 "확인 불가"로 처리할 것.',
].join('\n');

function normalizeBlock(text: string): string {
  return text.replace(/\r\n/g, '\n').trim();
}

export function getPromptBody(
  mode: PromptMode,
  variant: PromptVariant,
  sources: PromptSourceSet,
): string {
  if (variant === 'baseline') return normalizeBlock(sources.baseline);
  return [sources.base, sources.overlays[mode]].map(normalizeBlock).join('\n\n---\n\n');
}

export function buildSystemInstruction(promptBody: string, knowledgeContext: string): string {
  const contextBlock = normalizeBlock(knowledgeContext) || EMPTY_CONTEXT_FALLBACK;
  return `${normalizeBlock(promptBody)}\n\n---\n${CONTEXT_HEADER}\n${contextBlock}`;
}

export function buildVariantSystemInstruction(options: {
  mode: PromptMode;
  variant: PromptVariant;
  knowledgeContext: string;
  sources: PromptSourceSet;
}): string {
  const promptBody = getPromptBody(options.mode, options.variant, options.sources);
  return buildSystemInstruction(promptBody, options.knowledgeContext);
}
