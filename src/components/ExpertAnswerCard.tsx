import type { ReactNode } from 'react';
import type { BasisBucketKey, ExpertAnswerBlockItem, ExpertAnswerEnvelope } from '../lib/ragTypes';

interface ExpertAnswerCardProps {
  answer: ExpertAnswerEnvelope;
}

const BASIS_LABELS: Record<BasisBucketKey, string> = {
  legal: '법적 근거',
  evaluation: '평가 근거',
  practical: '실무 근거',
};

const BASIS_STYLES: Record<
  BasisBucketKey,
  {
    panel: string;
    badge: string;
    quote: string;
    empty: string;
  }
> = {
  legal: {
    panel: 'border-blue-200 bg-blue-50/70',
    badge: 'bg-blue-100 text-blue-700',
    quote: 'border-blue-300 text-blue-950',
    empty: 'text-blue-700/70',
  },
  evaluation: {
    panel: 'border-amber-200 bg-amber-50/80',
    badge: 'bg-amber-100 text-amber-700',
    quote: 'border-amber-300 text-amber-950',
    empty: 'text-amber-700/70',
  },
  practical: {
    panel: 'border-emerald-200 bg-emerald-50/80',
    badge: 'bg-emerald-100 text-emerald-700',
    quote: 'border-emerald-300 text-emerald-950',
    empty: 'text-emerald-700/70',
  },
};

function getStateStyles(state: ExpertAnswerEnvelope['evidenceState']): string {
  switch (state) {
    case 'confirmed':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'partial':
      return 'border-amber-200 bg-amber-50 text-amber-700';
    case 'conflict':
      return 'border-rose-200 bg-rose-50 text-rose-700';
    case 'not_enough':
      return 'border-slate-200 bg-slate-100 text-slate-700';
  }
}

function getStateLabel(state: ExpertAnswerEnvelope['evidenceState']): string {
  switch (state) {
    case 'confirmed':
      return '적용 가능';
    case 'partial':
      return '부분 확인';
    case 'conflict':
      return '근거 충돌';
    case 'not_enough':
      return '근거 부족';
  }
}

function asArray<T>(value: readonly T[] | undefined): T[] {
  return Array.isArray(value) ? [...value] : [];
}

function normalizeEvidenceState(value: unknown): ExpertAnswerEnvelope['evidenceState'] {
  return value === 'confirmed' || value === 'partial' || value === 'conflict' || value === 'not_enough'
    ? value
    : 'not_enough';
}

function normalizeConfidence(value: unknown): ExpertAnswerEnvelope['confidence'] {
  return value === 'high' || value === 'medium' || value === 'low' ? value : 'low';
}

function normalizeAnswerForRender(answer: ExpertAnswerEnvelope): ExpertAnswerEnvelope {
  const groundedBasis = answer.groundedBasis as ExpertAnswerEnvelope['groundedBasis'] | undefined;
  const basis = answer.basis as ExpertAnswerEnvelope['basis'] | undefined;

  return {
    ...answer,
    answerType: answer.answerType ?? 'mixed',
    headline: answer.headline || '답변',
    summary: answer.summary || '',
    directAnswer: answer.directAnswer || undefined,
    confidence: normalizeConfidence(answer.confidence),
    evidenceState: normalizeEvidenceState(answer.evidenceState),
    referenceDate: answer.referenceDate || '확인 필요',
    conclusion: answer.conclusion || answer.summary || '답변을 구성하지 못했습니다.',
    groundedBasis: {
      legal: asArray(groundedBasis?.legal),
      evaluation: asArray(groundedBasis?.evaluation),
      practical: asArray(groundedBasis?.practical),
    },
    practicalInterpretation: asArray(answer.practicalInterpretation),
    additionalChecks: asArray(answer.additionalChecks),
    appliedScope: answer.appliedScope || '선택 범위',
    scope: answer.scope || '',
    basis: {
      legal: asArray(basis?.legal),
      evaluation: asArray(basis?.evaluation),
      practical: asArray(basis?.practical),
    },
    blocks: asArray(answer.blocks),
    citations: asArray(answer.citations),
    followUps: asArray(answer.followUps),
  };
}

function buildItemMeta(item: ExpertAnswerBlockItem): string[] {
  return [item.actor, item.timeWindow, item.artifact, item.term].filter(Boolean) as string[];
}

function formatCitationRefs(citationIds: readonly string[] | undefined, citationIndexById: Map<string, number>): string {
  if (!citationIds || citationIds.length === 0) return '';
  const refs = Array.from(
    new Set(
      citationIds
        .map((citationId) => citationIndexById.get(citationId))
        .filter((index): index is number => typeof index === 'number')
        .sort((left, right) => left - right)
        .map((index) => `출처 ${index}`),
    ),
  );
  return refs.join(', ');
}

function MetaPill({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`rounded-full border px-3 py-1 text-xs font-semibold tracking-tight ${
        className ?? 'border-slate-200 bg-white/70 text-slate-700'
      }`}
    >
      {children}
    </span>
  );
}

function SectionEyebrow({ children }: { children: ReactNode }) {
  return <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">{children}</p>;
}

function GroundedBasisColumn({
  basis,
  entries,
  citationIndexById,
}: {
  basis: BasisBucketKey;
  entries: ExpertAnswerEnvelope['groundedBasis'][BasisBucketKey];
  citationIndexById: Map<string, number>;
}) {
  const styles = BASIS_STYLES[basis];

  return (
    <section className={`rounded-3xl border p-4 ${styles.panel}`}>
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-sm font-bold text-slate-900">{BASIS_LABELS[basis]}</h4>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${styles.badge}`}>{entries.length}건</span>
      </div>

      {entries.length === 0 ? (
        <p className={`mt-4 text-sm leading-7 ${styles.empty}`}>직접 연결된 확정 근거는 아직 비어 있습니다.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {entries.map((entry, index) => {
            const refs = formatCitationRefs(entry.citationIds, citationIndexById);
            return (
              <article
                key={`${basis}-${entry.label}-${index}`}
                className="rounded-2xl border border-white/80 bg-white/80 p-3 shadow-[0_1px_6px_rgba(15,23,42,0.04)]"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="text-sm font-semibold leading-6 text-slate-900">{entry.label}</p>
                  {refs && (
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-500">
                      {refs}
                    </span>
                  )}
                </div>
                <blockquote className={`mt-3 border-l-2 pl-3 text-sm leading-7 ${styles.quote}`}>
                  "{entry.quote}"
                </blockquote>
                <p className="mt-3 text-sm leading-7 text-slate-700">{entry.explanation}</p>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function ItemSection({
  title,
  items,
  emptyText,
  tone = 'slate',
}: {
  title: string;
  items: ExpertAnswerBlockItem[];
  emptyText: string;
  tone?: 'slate' | 'amber';
}) {
  const toneClasses =
    tone === 'amber'
      ? {
          panel: 'border-amber-200 bg-amber-50/70',
          bullet: 'bg-amber-500',
          meta: 'text-amber-800/80',
        }
      : {
          panel: 'border-slate-200 bg-slate-50',
          bullet: 'bg-blue-600',
          meta: 'text-slate-500',
        };

  return (
    <section className={`rounded-3xl border p-4 ${toneClasses.panel}`}>
      <SectionEyebrow>{title}</SectionEyebrow>
      {items.length === 0 ? (
        <p className="mt-3 text-sm leading-7 text-slate-500">{emptyText}</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {items.map((item, index) => {
            const meta = buildItemMeta(item);
            return (
              <li key={`${title}-${item.label}-${index}`} className="rounded-2xl border border-white/70 bg-white/80 p-3">
                <div className="flex items-start gap-3">
                  <span className={`mt-2 h-2.5 w-2.5 shrink-0 rounded-full ${toneClasses.bullet}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold leading-6 text-slate-900">{item.label}</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-7 text-slate-700">{item.detail}</p>
                    {meta.length > 0 && (
                      <p className={`mt-2 text-xs leading-5 ${toneClasses.meta}`}>{meta.join(' / ')}</p>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function CitationSection({ answer }: { answer: ExpertAnswerEnvelope }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-4">
      <SectionEyebrow>[출처]</SectionEyebrow>
      {answer.citations.length === 0 ? (
        <p className="mt-3 text-sm leading-7 text-slate-500">연결된 출처가 없습니다.</p>
      ) : (
        <ol className="mt-4 space-y-3">
          {answer.citations.map((citation, index) => {
            const meta = [citation.docTitle, citation.articleNo, citation.sectionPath.join(' / '), citation.effectiveDate]
              .filter(Boolean)
              .join(' · ');
            return (
              <li key={citation.evidenceId} className="flex gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold leading-6 text-slate-900">{citation.label}</p>
                  {citation.whyItMatters && (
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-7 text-slate-700">{citation.whyItMatters}</p>
                  )}
                  {meta && <p className="mt-2 text-xs leading-5 text-slate-400">{meta}</p>}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

export default function ExpertAnswerCard({ answer }: ExpertAnswerCardProps) {
  const renderAnswer = normalizeAnswerForRender(answer);
  const citationIndexById = new Map(renderAnswer.citations.map((citation, index) => [citation.evidenceId, index + 1] as const));
  const followUpItems: ExpertAnswerBlockItem[] = renderAnswer.followUps.map((followUp) => ({
    label: '후속 확인',
    detail: followUp,
  }));
  const additionalChecks = [...renderAnswer.additionalChecks, ...followUpItems].slice(0, 10);
  const visibleGroundedBasis = (['legal', 'evaluation', 'practical'] as const).filter(
    (basis) => renderAnswer.groundedBasis[basis].length > 0,
  );

  return (
    <article className="w-full overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.07)]">
      <header className="border-b border-slate-100 bg-[linear-gradient(135deg,rgba(239,246,255,0.95),rgba(255,255,255,1)_55%,rgba(240,253,244,0.92))] px-5 py-5 sm:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <MetaPill className="border-blue-200 bg-blue-50 text-blue-700">Expert Answer</MetaPill>
          <MetaPill className={getStateStyles(renderAnswer.evidenceState)}>{getStateLabel(renderAnswer.evidenceState)}</MetaPill>
          <MetaPill>신뢰도 {renderAnswer.confidence}</MetaPill>
          <MetaPill>적용 급여유형 {renderAnswer.appliedScope}</MetaPill>
          <MetaPill>기준 시점 {renderAnswer.referenceDate}</MetaPill>
        </div>
        <h2 className="mt-4 text-2xl font-bold leading-snug text-slate-950">{renderAnswer.headline}</h2>
        {renderAnswer.summary && <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-600">{renderAnswer.summary}</p>}
      </header>

      <div className="space-y-6 px-5 py-5 sm:px-6">
        <section className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <SectionEyebrow>[기준 시점]</SectionEyebrow>
          <p className="mt-2 text-sm font-semibold text-slate-900">{renderAnswer.referenceDate}</p>
          {renderAnswer.keyIssueDate && renderAnswer.keyIssueDate !== renderAnswer.referenceDate && (
            <p className="mt-1 text-xs leading-5 text-slate-500">핵심 기준일: {renderAnswer.keyIssueDate}</p>
          )}
        </section>

        {renderAnswer.directAnswer && (
          <section className="rounded-[24px] border border-blue-100 bg-blue-50/60 px-5 py-5">
            <SectionEyebrow>[답변]</SectionEyebrow>
            <p className="mt-3 whitespace-pre-wrap text-base leading-8 text-slate-800">{renderAnswer.directAnswer}</p>
          </section>
        )}

        <section className="rounded-[24px] bg-slate-950 px-5 py-5 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
          <SectionEyebrow>[결론]</SectionEyebrow>
          <p className="mt-3 whitespace-pre-wrap text-base leading-8 text-slate-50 sm:text-lg">{renderAnswer.conclusion}</p>
        </section>

        <section className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <SectionEyebrow>[확정 근거]</SectionEyebrow>
              <h3 className="mt-1 text-lg font-bold text-slate-950">법적·평가·실무 근거</h3>
            </div>
            {renderAnswer.scope && <p className="max-w-2xl text-sm leading-7 text-slate-500">{renderAnswer.scope}</p>}
          </div>
          {visibleGroundedBasis.length === 0 ? (
            <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-7 text-slate-500">
              검색된 확정 근거가 없습니다.
            </p>
          ) : (
            <div className="grid gap-4 md:grid-cols-[repeat(auto-fit,minmax(260px,1fr))]">
              {visibleGroundedBasis.map((basis) => (
                <GroundedBasisColumn
                  key={basis}
                  basis={basis}
                  entries={renderAnswer.groundedBasis[basis]}
                  citationIndexById={citationIndexById}
                />
              ))}
            </div>
          )}
        </section>

        <ItemSection
          title="[실무 해석]"
          items={renderAnswer.practicalInterpretation}
          emptyText="실무 해석으로 정리된 항목이 없습니다."
        />

        <CitationSection answer={renderAnswer} />

        <ItemSection
          title="[추가 확인]"
          items={additionalChecks}
          emptyText="추가 확인이 필요한 항목은 없습니다."
          tone="amber"
        />

        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-7 text-amber-950">
          이 답변은 AI가 생성한 것으로, 법적 자문을 대체할 수 없습니다. 정확한 적용 전에는 원문과 최신 기준을 함께 확인하세요.
        </div>
      </div>
    </article>
  );
}
