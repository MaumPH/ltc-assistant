import type { ExpertAnswerEnvelope, GuardrailResult, StructuredChunk } from './ragTypes';

const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+(all|previous|prior)\s+instructions/i,
  /system\s+prompt/i,
  /developer\s+message/i,
  /reveal\s+.*prompt/i,
  /api\s*key/i,
  /비밀/i,
  /시스템\s*프롬프트/u,
  /이전\s*지시/u,
];

const PHONE_RE = /(?:\+?82[-\s]?)?0\d{1,2}[-\s]?\d{3,4}[-\s]?\d{4}/g;
const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const RESIDENT_ID_RE = /\b\d{6}[-\s]?[1-4]\d{6}\b/g;

function maskSensitiveText(value: string): string {
  return value
    .replace(PHONE_RE, '[REDACTED_PHONE]')
    .replace(EMAIL_RE, '[REDACTED_EMAIL]')
    .replace(RESIDENT_ID_RE, '[REDACTED_ID]');
}

export function detectPromptInjectionSignals(input: string): GuardrailResult {
  const triggered = PROMPT_INJECTION_PATTERNS.some((pattern) => pattern.test(input));
  return {
    type: 'prompt_injection',
    severity: triggered ? 'warning' : 'info',
    triggered,
    detail: triggered
      ? 'Potential instruction override or secret-exfiltration wording was detected in the user query.'
      : 'No prompt-injection signal detected.',
  };
}

export function buildCitationWarning(answer: ExpertAnswerEnvelope, citations: StructuredChunk[]): GuardrailResult {
  const citationCount = answer.citations.length;
  const evidenceCount = citations.length;
  const triggered = citationCount === 0 || evidenceCount === 0;
  return {
    type: 'citation_warning',
    severity: triggered ? 'warning' : 'info',
    triggered,
    detail: triggered
      ? 'The answer does not include grounded citations even though retrieval returned limited evidence.'
      : `Grounded citations attached (${citationCount}/${Math.max(evidenceCount, 1)}).`,
  };
}

export function buildHallucinationSignal(answer: ExpertAnswerEnvelope, citations: StructuredChunk[]): GuardrailResult {
  const allowedEvidenceIds = new Set(citations.map((citation) => citation.id));
  const unsupported = answer.citations.filter((citation) => !allowedEvidenceIds.has(citation.evidenceId));
  return {
    type: 'hallucination_signal',
    severity: unsupported.length > 0 ? 'warning' : 'info',
    triggered: unsupported.length > 0,
    detail:
      unsupported.length > 0
        ? `Some answer citations were not found in the retrieved evidence set (${unsupported.length}).`
        : 'Answer citations align with retrieved evidence.',
  };
}

export function applyPiiMasking(answer: ExpertAnswerEnvelope): ExpertAnswerEnvelope {
  return {
    ...answer,
    headline: maskSensitiveText(answer.headline),
    summary: maskSensitiveText(answer.summary),
    scope: maskSensitiveText(answer.scope),
    followUps: answer.followUps.map(maskSensitiveText),
    blocks: answer.blocks.map((block) => ({
      ...block,
      title: maskSensitiveText(block.title),
      intro: block.intro ? maskSensitiveText(block.intro) : undefined,
      items: block.items.map((item) => ({
        ...item,
        label: maskSensitiveText(item.label),
        detail: maskSensitiveText(item.detail),
        actor: item.actor ? maskSensitiveText(item.actor) : undefined,
        artifact: item.artifact ? maskSensitiveText(item.artifact) : undefined,
        side: item.side ? maskSensitiveText(item.side) : undefined,
        term: item.term ? maskSensitiveText(item.term) : undefined,
        timeWindow: item.timeWindow ? maskSensitiveText(item.timeWindow) : undefined,
      })),
    })),
    citations: answer.citations.map((citation) => ({
      ...citation,
      label: maskSensitiveText(citation.label),
      docTitle: maskSensitiveText(citation.docTitle),
      whyItMatters: citation.whyItMatters ? maskSensitiveText(citation.whyItMatters) : undefined,
    })),
  };
}
