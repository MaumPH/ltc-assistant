import type { BasisBucketKey, EvidenceState, ExpertAnswerBlockItem, ExpertAnswerEnvelope } from './ragTypes';
import { safeTrim } from './textGuards';

const BASIS_LABELS: Record<BasisBucketKey, { title: string; emoji: string }> = {
  legal: { title: '법적 근거', emoji: '⚖️' },
  evaluation: { title: '평가 근거', emoji: '🧾' },
  practical: { title: '실무 근거', emoji: '🛠️' },
};

const EVIDENCE_STATE_LABELS: Record<EvidenceState, { label: string; emoji: string }> = {
  confirmed: { label: '근거 확인', emoji: '✅' },
  partial: { label: '일부 근거', emoji: '🟡' },
  conflict: { label: '근거 충돌', emoji: '⚠️' },
  not_enough: { label: '근거 부족', emoji: '❔' },
};

function nonEmpty(value: unknown): string | undefined {
  const trimmed = safeTrim(value);
  return trimmed ? trimmed : undefined;
}

function safeBlockItems(items: unknown): ExpertAnswerBlockItem[] {
  return Array.isArray(items) ? (items.filter((item) => item && typeof item === 'object') as ExpertAnswerBlockItem[]) : [];
}

function safeSectionPath(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => safeTrim(item)).filter(Boolean);
}

function renderItems(items: unknown): string[] {
  return safeBlockItems(items).flatMap((item) => {
    const label = nonEmpty(item.label) ?? '항목';
    const detail = nonEmpty(item.detail) ?? '-';
    const meta = [item.actor, item.timeWindow, item.artifact, item.term].map(nonEmpty).filter(Boolean);
    return [
      `- **${label}**: ${detail}`,
      meta.length > 0 ? `  - 참고: ${meta.join(' / ')}` : undefined,
    ].filter(Boolean) as string[];
  });
}

function renderBasis(answer: ExpertAnswerEnvelope, bucket: BasisBucketKey): string[] {
  const basis = BASIS_LABELS[bucket];
  const entries = Array.isArray(answer.groundedBasis?.[bucket]) ? answer.groundedBasis[bucket] : [];
  if (entries.length === 0) {
    return [`### ${basis.emoji} ${basis.title}`, '- 직접 연결된 근거가 아직 충분하지 않습니다.'];
  }

  const citations = Array.isArray(answer.citations) ? answer.citations : [];
  const citationIndexById = new Map(citations.map((citation, index) => [safeTrim(citation.evidenceId), index + 1] as const));

  return [
    `### ${basis.emoji} ${basis.title}`,
    ...entries.flatMap((entry) => {
      const refs = (Array.isArray(entry.citationIds) ? entry.citationIds : [])
        .map((citationId) => citationIndexById.get(citationId))
        .filter((index): index is number => typeof index === 'number')
        .map((index) => `출처 ${index}`);
      return [
        `- **${nonEmpty(entry.label) ?? '근거'}**${refs.length > 0 ? ` (${refs.join(', ')})` : ''}`,
        nonEmpty(entry.quote) ? `  > ${nonEmpty(entry.quote)}` : undefined,
        nonEmpty(entry.explanation) ? `  ${nonEmpty(entry.explanation)}` : undefined,
      ].filter(Boolean) as string[];
    }),
  ];
}

function renderCitations(answer: ExpertAnswerEnvelope): string[] {
  const citations = Array.isArray(answer.citations) ? answer.citations : [];
  if (citations.length === 0) {
    return ['## 📎 출처', '- 연결된 출처가 없습니다.'];
  }

  return [
    '## 📎 출처',
    ...citations.map((citation, index) => {
      const locator = [nonEmpty(citation.articleNo), safeSectionPath(citation.sectionPath).join(' > '), nonEmpty(citation.effectiveDate)]
        .filter(Boolean)
        .join(' / ');
      const label = nonEmpty(citation.label) ?? nonEmpty(citation.docTitle) ?? `출처 ${index + 1}`;
      return `${index + 1}. **${label}**${locator ? `  \n   ${locator}` : ''}`;
    }),
  ];
}

export function formatAnswerAsMarkdown(answer: ExpertAnswerEnvelope): string {
  const evidence = EVIDENCE_STATE_LABELS[answer.evidenceState];
  const practicalInterpretation = safeBlockItems(answer.practicalInterpretation);
  const additionalChecks = safeBlockItems(answer.additionalChecks);
  const followUps = Array.isArray(answer.followUps) ? answer.followUps.map((followUp) => safeTrim(followUp)).filter(Boolean) : [];
  const additionalItems = [
    ...additionalChecks,
    ...followUps.map((followUp) => ({
      label: '추가 확인',
      detail: followUp,
    })),
  ];

  const headline = nonEmpty(answer.headline) ?? '전문가 답변';
  const summary = nonEmpty(answer.summary);
  const referenceDate = nonEmpty(answer.referenceDate) ?? '확인 필요';
  const appliedScope = nonEmpty(answer.appliedScope);
  const keyIssueDate = nonEmpty(answer.keyIssueDate);
  const directAnswer = nonEmpty(answer.directAnswer);
  const conclusion = nonEmpty(answer.conclusion) ?? '결론을 정리하지 못했습니다.';

  return [
    `# 🧭 ${headline}`,
    '',
    summary || undefined,
    '',
    `**상태:** ${evidence.emoji} ${evidence.label}  ·  **신뢰도:** ${answer.confidence}  ·  **기준일:** ${referenceDate}`,
    appliedScope ? `**적용 급여유형:** ${appliedScope}` : undefined,
    keyIssueDate ? `**쟁점 기준일:** ${keyIssueDate}` : undefined,
    '',
    directAnswer ? '## 🎯 바로 답변' : undefined,
    directAnswer || undefined,
    directAnswer ? '' : undefined,
    '## ✅ 결론',
    conclusion,
    '',
    '## 📚 근거',
    ...renderBasis(answer, 'legal'),
    '',
    ...renderBasis(answer, 'evaluation'),
    '',
    ...renderBasis(answer, 'practical'),
    '',
    practicalInterpretation.length > 0 ? '## 🛠️ 실무 해석' : undefined,
    ...renderItems(practicalInterpretation),
    '',
    ...renderCitations(answer),
    '',
    additionalItems.length > 0 ? '## ➕ 추가 확인' : undefined,
    ...renderItems(additionalItems),
  ]
    .filter((line): line is string => typeof line === 'string')
    .join('\n');
}
