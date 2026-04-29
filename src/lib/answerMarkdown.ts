import type { BasisBucketKey, EvidenceState, ExpertAnswerBlockItem, ExpertAnswerEnvelope } from './ragTypes';
import { safeTrim } from './textGuards';

const BASIS_LABELS: Record<BasisBucketKey, { title: string; emoji: string }> = {
  legal: { title: '법적 근거', emoji: '⚖️' },
  evaluation: { title: '평가 근거', emoji: '📋' },
  practical: { title: '실무 근거', emoji: '🛠️' },
};

const EVIDENCE_STATE_LABELS: Record<EvidenceState, { label: string; emoji: string }> = {
  confirmed: { label: '근거 확인', emoji: '✅' },
  partial: { label: '일부 근거', emoji: '⚠️' },
  conflict: { label: '근거 충돌', emoji: '🚧' },
  not_enough: { label: '근거 부족', emoji: '❓' },
};

function nonEmpty(value: unknown): string | undefined {
  const trimmed = safeTrim(value);
  return trimmed ? trimmed : undefined;
}

function renderItems(items: ExpertAnswerBlockItem[]): string[] {
  return items.flatMap((item) => {
    const meta = [item.actor, item.timeWindow, item.artifact, item.term].map(nonEmpty).filter(Boolean);
    return [
      `- **${item.label}**: ${item.detail}`,
      meta.length > 0 ? `  - 참고: ${meta.join(' / ')}` : undefined,
    ].filter(Boolean) as string[];
  });
}

function renderBasis(answer: ExpertAnswerEnvelope, bucket: BasisBucketKey): string[] {
  const basis = BASIS_LABELS[bucket];
  const entries = answer.groundedBasis[bucket];
  if (entries.length === 0) {
    return [`### ${basis.emoji} ${basis.title}`, '- 직접 연결된 근거가 아직 충분하지 않습니다.'];
  }

  const citationIndexById = new Map(answer.citations.map((citation, index) => [citation.evidenceId, index + 1] as const));
  return [
    `### ${basis.emoji} ${basis.title}`,
    ...entries.flatMap((entry) => {
      const refs = entry.citationIds
        .map((citationId) => citationIndexById.get(citationId))
        .filter((index): index is number => typeof index === 'number')
        .map((index) => `출처 ${index}`);
      return [
        `- **${entry.label}**${refs.length > 0 ? ` (${refs.join(', ')})` : ''}`,
        entry.quote ? `  > ${entry.quote}` : undefined,
        entry.explanation ? `  ${entry.explanation}` : undefined,
      ].filter(Boolean) as string[];
    }),
  ];
}

function renderCitations(answer: ExpertAnswerEnvelope): string[] {
  if (answer.citations.length === 0) {
    return ['## 🔗 출처', '- 연결된 출처가 없습니다.'];
  }

  return [
    '## 🔗 출처',
    ...answer.citations.map((citation, index) => {
      const locator = [citation.articleNo, citation.sectionPath.join(' > '), citation.effectiveDate].filter(Boolean).join(' / ');
      return `${index + 1}. **${citation.label}**${locator ? `  \n   ${locator}` : ''}`;
    }),
  ];
}

export function formatAnswerAsMarkdown(answer: ExpertAnswerEnvelope): string {
  const evidence = EVIDENCE_STATE_LABELS[answer.evidenceState];
  const additionalItems = [
    ...answer.additionalChecks,
    ...answer.followUps.map((followUp) => ({
      label: '추가 확인',
      detail: followUp,
    })),
  ];

  return [
    `# 🧭 ${answer.headline}`,
    '',
    answer.summary || undefined,
    '',
    `**상태:** ${evidence.emoji} ${evidence.label}  ·  **신뢰도:** ${answer.confidence}  ·  **기준일:** ${answer.referenceDate}`,
    answer.appliedScope ? `**적용 급여유형:** ${answer.appliedScope}` : undefined,
    answer.keyIssueDate ? `**핵심 기준일:** ${answer.keyIssueDate}` : undefined,
    '',
    answer.directAnswer ? '## 💬 바로 답변' : undefined,
    answer.directAnswer || undefined,
    answer.directAnswer ? '' : undefined,
    '## ✅ 결론',
    answer.conclusion,
    '',
    '## 📚 근거',
    ...renderBasis(answer, 'legal'),
    '',
    ...renderBasis(answer, 'evaluation'),
    '',
    ...renderBasis(answer, 'practical'),
    '',
    answer.practicalInterpretation.length > 0 ? '## 🛠️ 실무 해석' : undefined,
    ...renderItems(answer.practicalInterpretation),
    '',
    ...renderCitations(answer),
    '',
    additionalItems.length > 0 ? '## ⚠️ 추가 확인' : undefined,
    ...renderItems(additionalItems),
  ]
    .filter((line): line is string => typeof line === 'string')
    .join('\n');
}
