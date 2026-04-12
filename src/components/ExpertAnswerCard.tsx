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
      return '확정';
    case 'partial':
      return '부분확정';
    case 'conflict':
      return '충돌';
    case 'not_enough':
      return '확인 불가';
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

function BasisSection({
  title,
  entries,
  tone,
}: {
  title: string;
  entries: ExpertAnswerEnvelope['basis'][keyof ExpertAnswerEnvelope['basis']];
  tone: string;
}) {
  return (
    <section className={`rounded-3xl border p-4 shadow-sm sm:p-5 ${tone}`}>
      <div className="mb-3 flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-current opacity-70" />
        <h3 className="text-sm font-semibold sm:text-base">{title}</h3>
      </div>
      <div className="space-y-3">
        {entries.length > 0 ? (
          entries.map((entry) => (
            <div key={`${title}-${entry.label}`} className="rounded-2xl bg-white/70 px-3 py-3">
              <p className="text-sm font-semibold text-slate-900">{entry.label}</p>
              <p className="mt-1 text-sm leading-6 text-slate-700">{entry.summary}</p>
            </div>
          ))
        ) : (
          <p className="text-sm leading-6 text-slate-600">직접 연결된 근거가 충분하지 않습니다.</p>
        )}
      </div>
    </section>
  );
}

function BlockCard({ block }: { block: ExpertAnswerBlock }) {
  const isComparison = block.type === 'comparison';
  const isDefinition = block.type === 'definition';

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-3 flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-blue-500" />
        <h3 className="text-sm font-semibold text-slate-900 sm:text-base">{block.title}</h3>
      </div>
      {block.intro && <p className="mb-3 text-sm leading-6 text-slate-600">{block.intro}</p>}
      <div className={`grid gap-3 ${isComparison ? 'md:grid-cols-3' : ''}`}>
        {block.items.map((item, index) => (
          <div key={`${block.title}-${index}`} className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-slate-900">{item.label}</p>
              {item.basis && (
                <span className="rounded-full bg-white px-2 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500">
                  {item.basis}
                </span>
              )}
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-700">{item.detail}</p>
            {(item.actor || item.timeWindow || item.artifact || (isDefinition && item.term)) && (
              <div className="mt-3 flex flex-wrap gap-2">
                {item.actor && <span className="rounded-full bg-white px-2.5 py-1 text-xs text-slate-600">누가: {item.actor}</span>}
                {item.timeWindow && <span className="rounded-full bg-white px-2.5 py-1 text-xs text-slate-600">언제: {item.timeWindow}</span>}
                {item.artifact && <span className="rounded-full bg-white px-2.5 py-1 text-xs text-slate-600">자료: {item.artifact}</span>}
                {isDefinition && item.term && <span className="rounded-full bg-white px-2.5 py-1 text-xs text-slate-600">용어: {item.term}</span>}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function VerdictAnswerCard({ answer }: ExpertAnswerCardProps) {
  return (
    <section className="rounded-3xl border border-blue-200 bg-blue-50/80 p-4 sm:p-5">
      <div className="mb-3 flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-blue-500" />
        <h2 className="text-sm font-semibold text-slate-900 sm:text-base">전문가 판단</h2>
      </div>
      <p className="text-[15px] leading-7 text-slate-800">{answer.summary}</p>
    </section>
  );
}

function ChecklistAnswerCard({ answer }: ExpertAnswerCardProps) {
  return <>{answer.blocks.map((block) => <BlockCard key={block.title} block={block} />)}</>;
}

function ProcedureAnswerCard({ answer }: ExpertAnswerCardProps) {
  return <>{answer.blocks.map((block) => <BlockCard key={block.title} block={block} />)}</>;
}

function ComparisonAnswerCard({ answer }: ExpertAnswerCardProps) {
  return <>{answer.blocks.map((block) => <BlockCard key={block.title} block={block} />)}</>;
}

function DefinitionAnswerCard({ answer }: ExpertAnswerCardProps) {
  return <>{answer.blocks.map((block) => <BlockCard key={block.title} block={block} />)}</>;
}

function MixedAnswerCard({ answer }: ExpertAnswerCardProps) {
  return <>{answer.blocks.map((block) => <BlockCard key={block.title} block={block} />)}</>;
}

function AnswerBody({ answer }: ExpertAnswerCardProps) {
  switch (answer.answerType) {
    case 'verdict':
      return <VerdictAnswerCard answer={answer} />;
    case 'checklist':
      return <ChecklistAnswerCard answer={answer} />;
    case 'procedure':
      return <ProcedureAnswerCard answer={answer} />;
    case 'comparison':
      return <ComparisonAnswerCard answer={answer} />;
    case 'definition':
      return <DefinitionAnswerCard answer={answer} />;
    case 'mixed':
      return <MixedAnswerCard answer={answer} />;
  }
}

export default function ExpertAnswerCard({ answer }: ExpertAnswerCardProps) {
  return (
    <article className="w-full overflow-hidden rounded-[28px] border border-slate-200 bg-slate-50 shadow-sm">
      <div className="border-b border-slate-200 bg-[linear-gradient(135deg,rgba(248,250,252,1),rgba(236,253,245,0.9),rgba(239,246,255,0.9))] px-4 py-4 sm:px-5 sm:py-5">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Expert Answer</p>
        <h2 className="mt-3 text-lg font-semibold text-slate-900 sm:text-xl">{answer.headline}</h2>
        <p className="mt-3 text-sm leading-6 text-slate-700 sm:text-[15px]">{answer.summary}</p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${getStateStyles(answer.evidenceState)}`}>
            {getStateLabel(answer.evidenceState)}
          </span>
          <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
            {getAnswerTypeLabel(answer.answerType)}
          </span>
          <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
            신뢰도 {answer.confidence}
          </span>
          {answer.keyIssueDate && (
            <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
              {answer.keyIssueDate}
            </span>
          )}
        </div>
        {answer.scope && <p className="mt-3 text-xs leading-6 text-slate-500">적용 범위: {answer.scope}</p>}
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        <AnswerBody answer={answer} />

        <div className="grid gap-4 lg:grid-cols-3">
          <BasisSection title="법적 근거" entries={answer.basis.legal} tone="border-emerald-200 bg-emerald-50 text-emerald-900" />
          <BasisSection title="평가 근거" entries={answer.basis.evaluation} tone="border-amber-200 bg-amber-50 text-amber-900" />
          <BasisSection title="실무 근거" entries={answer.basis.practical} tone="border-sky-200 bg-sky-50 text-sky-900" />
        </div>

        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-3 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-slate-500" />
            <h3 className="text-sm font-semibold text-slate-900 sm:text-base">출처</h3>
          </div>
          <div className="space-y-3">
            {answer.citations.map((citation) => (
              <div key={citation.evidenceId} className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3">
                <p className="text-sm font-semibold text-slate-900">{citation.label}</p>
                {citation.whyItMatters && <p className="mt-1 text-sm leading-6 text-slate-700">{citation.whyItMatters}</p>}
              </div>
            ))}
          </div>
        </section>

        {answer.followUps.length > 0 && (
          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-3 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-slate-500" />
              <h3 className="text-sm font-semibold text-slate-900 sm:text-base">추가 확인</h3>
            </div>
            <div className="space-y-2">
              {answer.followUps.map((followUp) => (
                <p key={followUp} className="rounded-2xl bg-slate-50 px-3 py-3 text-sm leading-6 text-slate-700">
                  {followUp}
                </p>
              ))}
            </div>
          </section>
        )}
      </div>
    </article>
  );
}
