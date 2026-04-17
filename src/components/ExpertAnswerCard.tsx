import React from 'react';
import type { ExpertAnswerBlock, ExpertAnswerEnvelope } from '../lib/ragTypes';

interface ExpertAnswerCardProps {
  answer: ExpertAnswerEnvelope;
}

function getStateStyles(state: ExpertAnswerEnvelope['evidenceState']): string {
  switch (state) {
    case 'confirmed':
      return 'border-emerald-200 bg-emerald-100 text-emerald-800';
    case 'partial':
      return 'border-amber-200 bg-amber-100 text-amber-800';
    case 'conflict':
      return 'border-rose-200 bg-rose-100 text-rose-800';
    case 'not_enough':
      return 'border-slate-200 bg-slate-100 text-slate-700';
  }
}

function getStateLabel(state: ExpertAnswerEnvelope['evidenceState']): string {
  switch (state) {
    case 'confirmed':
      return '적용됨';
    case 'partial':
      return '부분 확인';
    case 'conflict':
      return '근거 충돌';
    case 'not_enough':
      return '근거 부족';
  }
}

function getAnswerTypeLabel(answerType: ExpertAnswerEnvelope['answerType']): string {
  switch (answerType) {
    case 'verdict':
      return '판단형';
    case 'checklist':
      return '체크리스트형';
    case 'procedure':
      return '절차형';
    case 'comparison':
      return '비교형';
    case 'definition':
      return '정의형';
    case 'mixed':
      return '혼합형';
  }
}

function getBlockTypeLabel(blockType: ExpertAnswerBlock['type']): string {
  switch (blockType) {
    case 'checklist':
      return '체크리스트';
    case 'steps':
      return '절차';
    case 'comparison':
      return '비교';
    case 'bullets':
      return '핵심 정리';
    case 'warning':
      return '주의';
    case 'definition':
      return '정의';
    case 'followup':
      return '추가 점검';
  }
}

function SectionShell({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <section className="rounded-[28px] border border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-5 sm:py-5">
      <div className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-3">
        <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function BlockCard({ block }: { block: ExpertAnswerBlock }) {
  const isComparison = block.type === 'comparison';
  const isCompact = block.type === 'warning' || block.type === 'followup' || block.type === 'definition';

  return (
    <article className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-slate-900 sm:text-base">{block.title}</h4>
          {block.intro && <p className="mt-2 text-sm leading-6 text-slate-600">{block.intro}</p>}
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">
          {getBlockTypeLabel(block.type)}
        </span>
      </div>

      <div className={`mt-4 grid gap-3 ${isComparison ? 'lg:grid-cols-2' : 'grid-cols-1'}`}>
        {block.items.map((item, index) => (
          <div
            key={`${block.title}-${item.label}-${index}`}
            className={`rounded-2xl border border-slate-100 bg-white px-3 py-3 ${
              isCompact ? '' : 'shadow-[0_8px_24px_-22px_rgba(15,23,42,0.3)]'
            }`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-slate-900">{item.label}</p>
              {item.basis && (
                <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-500">
                  {item.basis}
                </span>
              )}
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-700">{item.detail}</p>

            {(item.actor || item.timeWindow || item.artifact || item.term) && (
              <div className="mt-3 flex flex-wrap gap-2">
                {item.actor && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">담당 {item.actor}</span>}
                {item.timeWindow && (
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">시점 {item.timeWindow}</span>
                )}
                {item.artifact && (
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">자료 {item.artifact}</span>
                )}
                {item.term && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">용어 {item.term}</span>}
              </div>
            )}
          </div>
        ))}
      </div>
    </article>
  );
}

function BasisColumn({
  entries,
  emptyLabel,
  title,
  tone,
}: {
  emptyLabel: string;
  entries: ExpertAnswerEnvelope['basis'][keyof ExpertAnswerEnvelope['basis']];
  title: string;
  tone: string;
}) {
  return (
    <div className={`rounded-3xl border px-4 py-4 ${tone}`}>
      <div className="mb-3 flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-current opacity-70" />
        <h4 className="text-sm font-semibold">{title}</h4>
      </div>

      <div className="space-y-3">
        {entries.length > 0 ? (
          entries.map((entry) => (
            <div key={`${title}-${entry.label}`} className="rounded-2xl bg-white/75 px-3 py-3">
              <p className="text-sm font-semibold text-slate-900">{entry.label}</p>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-7 text-slate-700">{entry.summary}</p>
            </div>
          ))
        ) : (
          <p className="rounded-2xl bg-white/75 px-3 py-3 text-sm leading-6 text-slate-600">{emptyLabel}</p>
        )}
      </div>
    </div>
  );
}

function CitationMeta({ answer }: { answer: ExpertAnswerEnvelope }) {
  if (answer.citations.length === 0) {
    return <p className="text-sm leading-6 text-slate-500">표시할 참조 근거가 없습니다.</p>;
  }

  return (
    <div className="space-y-3">
      {answer.citations.map((citation) => {
        const meta = [citation.docTitle, citation.articleNo, citation.sectionPath.join(' / '), citation.effectiveDate]
          .filter(Boolean)
          .join(' · ');

        return (
          <article key={citation.evidenceId} className="rounded-3xl border border-slate-100 bg-slate-50 px-4 py-4">
            <p className="text-sm font-semibold leading-6 text-slate-900">{citation.label}</p>
            {citation.whyItMatters && <p className="mt-2 text-sm leading-7 text-slate-700">{citation.whyItMatters}</p>}
            {meta && <p className="mt-2 break-words text-xs leading-6 text-slate-500">{meta}</p>}
          </article>
        );
      })}
    </div>
  );
}

export default function ExpertAnswerCard({ answer }: ExpertAnswerCardProps) {
  return (
    <article className="w-full overflow-hidden rounded-[30px] border border-slate-200 bg-slate-50 shadow-[0_20px_60px_-42px_rgba(15,23,42,0.28)]">
      <div className="border-b border-slate-200 bg-[linear-gradient(180deg,rgba(248,251,255,0.98),rgba(255,255,255,0.94))] px-4 py-5 sm:px-6 sm:py-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-700">
            Expert Answer
          </span>
          <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${getStateStyles(answer.evidenceState)}`}>
            {getStateLabel(answer.evidenceState)}
          </span>
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
            {getAnswerTypeLabel(answer.answerType)}
          </span>
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
            신뢰도 {answer.confidence}
          </span>
          {answer.keyIssueDate && (
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
              {answer.keyIssueDate}
            </span>
          )}
        </div>

        <h2 className="mt-4 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">{answer.headline}</h2>
        <p className="mt-3 whitespace-pre-wrap text-[15px] leading-8 text-slate-700">{answer.summary}</p>
      </div>

      <div className="space-y-4 px-4 py-4 sm:px-5 sm:py-5">
        <SectionShell title="결론">
          <div className="rounded-3xl border border-blue-100 bg-[linear-gradient(180deg,rgba(239,246,255,0.85),rgba(255,255,255,0.95))] px-4 py-4">
            <p className="text-base font-semibold leading-8 text-slate-900">{answer.summary}</p>
            {answer.scope && <p className="mt-3 text-sm leading-7 text-slate-600">적용 범위: {answer.scope}</p>}
          </div>
        </SectionShell>

        {answer.blocks.length > 0 && (
          <SectionShell title="핵심 내용">
            <div className="space-y-3">
              {answer.blocks.map((block) => (
                <BlockCard key={`${block.type}-${block.title}`} block={block} />
              ))}
            </div>
          </SectionShell>
        )}

        <SectionShell title="근거">
          <div className="space-y-4">
            <BasisColumn
              title="법적 근거"
              entries={answer.basis.legal}
              emptyLabel="직접 연결된 법적 근거가 아직 충분하지 않습니다."
              tone="border-emerald-200 bg-emerald-50 text-emerald-900"
            />
            <BasisColumn
              title="평가 근거"
              entries={answer.basis.evaluation}
              emptyLabel="직접 연결된 평가 근거가 아직 충분하지 않습니다."
              tone="border-amber-200 bg-amber-50 text-amber-900"
            />
            <BasisColumn
              title="실무 근거"
              entries={answer.basis.practical}
              emptyLabel="직접 연결된 실무 근거가 아직 충분하지 않습니다."
              tone="border-sky-200 bg-sky-50 text-sky-900"
            />
          </div>
        </SectionShell>

        <SectionShell title="참조 근거">
          <CitationMeta answer={answer} />
        </SectionShell>

        {answer.followUps.length > 0 && (
          <SectionShell title="추가 확인">
            <div className="space-y-3">
              {answer.followUps.map((followUp) => (
                <div
                  key={followUp}
                  className="rounded-3xl border border-amber-200 bg-amber-50/70 px-4 py-4 text-sm leading-7 text-slate-700"
                >
                  {followUp}
                </div>
              ))}
            </div>
          </SectionShell>
        )}
      </div>
    </article>
  );
}
