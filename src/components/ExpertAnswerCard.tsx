import React from 'react';
import type { BasisBucketKey, ExpertAnswerBlock, ExpertAnswerBlockItem, ExpertAnswerEnvelope } from '../lib/ragTypes';

interface ExpertAnswerCardProps {
  answer: ExpertAnswerEnvelope;
}

const BASIS_LABELS: Record<BasisBucketKey, string> = {
  legal: '법적 근거',
  evaluation: '평가 근거',
  practical: '실무 근거',
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

function buildItemMeta(item: ExpertAnswerBlockItem): string[] {
  const meta: string[] = [];

  if (item.basis) {
    meta.push(BASIS_LABELS[item.basis]);
  }
  if (item.actor) {
    meta.push(`담당 ${item.actor}`);
  }
  if (item.timeWindow) {
    meta.push(`시점 ${item.timeWindow}`);
  }
  if (item.artifact) {
    meta.push(`자료 ${item.artifact}`);
  }
  if (item.term) {
    meta.push(`용어 ${item.term}`);
  }

  return meta;
}

function DocumentSection({
  title,
  children,
  noBorder = false,
}: {
  title: string;
  children: React.ReactNode;
  noBorder?: boolean;
}) {
  return (
    <section className={`${noBorder ? '' : 'border-t border-slate-200 pt-5 sm:pt-6'}`}>
      <div className="mb-4 sm:mb-5">
        <h3 className="text-lg font-semibold tracking-tight text-slate-900">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function BlockItem({ item }: { item: ExpertAnswerBlockItem }) {
  const meta = buildItemMeta(item);

  return (
    <li className="border-b border-slate-100 pb-4 last:border-b-0 last:pb-0">
      <div className="flex items-start gap-3">
        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold leading-7 text-slate-900">{item.label}</p>
          <p className="mt-1 whitespace-pre-wrap text-[15px] leading-8 text-slate-700">{item.detail}</p>
          {meta.length > 0 && <p className="mt-2 text-xs leading-6 text-slate-500">{meta.join(' · ')}</p>}
        </div>
      </div>
    </li>
  );
}

function ComparisonBlock({ block }: { block: ExpertAnswerBlock }) {
  return (
    <article className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="text-base font-semibold text-slate-900">{block.title}</h4>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-500">
          {getBlockTypeLabel(block.type)}
        </span>
      </div>

      {block.intro && <p className="text-sm leading-7 text-slate-600">{block.intro}</p>}

      <div className="grid gap-4 lg:grid-cols-2">
        {block.items.map((item, index) => {
          const meta = buildItemMeta(item);

          return (
            <div key={`${block.title}-${item.label}-${index}`} className="border border-slate-200 bg-slate-50/70 px-4 py-4">
              <p className="text-sm font-semibold text-slate-900">{item.label}</p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-700">{item.detail}</p>
              {meta.length > 0 && <p className="mt-2 text-xs leading-6 text-slate-500">{meta.join(' · ')}</p>}
            </div>
          );
        })}
      </div>
    </article>
  );
}

function ListBlock({ block }: { block: ExpertAnswerBlock }) {
  return (
    <article className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="text-base font-semibold text-slate-900">{block.title}</h4>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-500">
          {getBlockTypeLabel(block.type)}
        </span>
      </div>

      {block.intro && <p className="text-sm leading-7 text-slate-600">{block.intro}</p>}

      <ul className="space-y-4">
        {block.items.map((item, index) => (
          <BlockItem key={`${block.title}-${item.label}-${index}`} item={item} />
        ))}
      </ul>
    </article>
  );
}

function BlockGroup({ blocks }: { blocks: ExpertAnswerBlock[] }) {
  return (
    <div className="space-y-6">
      {blocks.map((block) =>
        block.type === 'comparison' ? (
          <ComparisonBlock key={`${block.type}-${block.title}`} block={block} />
        ) : (
          <ListBlock key={`${block.type}-${block.title}`} block={block} />
        ),
      )}
    </div>
  );
}

function BasisSection({
  title,
  entries,
  emptyLabel,
}: {
  title: string;
  entries: ExpertAnswerEnvelope['basis'][keyof ExpertAnswerEnvelope['basis']];
  emptyLabel: string;
}) {
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">{title}</h4>
      {entries.length > 0 ? (
        <ul className="space-y-4">
          {entries.map((entry) => (
            <li key={`${title}-${entry.label}`} className="border-b border-slate-100 pb-4 last:border-b-0 last:pb-0">
              <p className="text-[15px] font-semibold leading-7 text-slate-900">{entry.label}</p>
              <p className="mt-1 whitespace-pre-wrap text-[15px] leading-8 text-slate-700">{entry.summary}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm leading-7 text-slate-500">{emptyLabel}</p>
      )}
    </div>
  );
}

function CitationList({ answer }: { answer: ExpertAnswerEnvelope }) {
  if (answer.citations.length === 0) {
    return <p className="text-sm leading-7 text-slate-500">표시할 참조 근거가 없습니다.</p>;
  }

  return (
    <ol className="space-y-4">
      {answer.citations.map((citation, index) => {
        const meta = [citation.docTitle, citation.articleNo, citation.sectionPath.join(' / '), citation.effectiveDate]
          .filter(Boolean)
          .join(' · ');

        return (
          <li key={citation.evidenceId} className="border-b border-slate-100 pb-4 last:border-b-0 last:pb-0">
            <div className="flex items-start gap-3">
              <span className="mt-1.5 text-sm font-semibold text-blue-700">{index + 1}.</span>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold leading-7 text-slate-900">{citation.label}</p>
                {citation.whyItMatters && (
                  <p className="mt-1 whitespace-pre-wrap text-[15px] leading-8 text-slate-700">{citation.whyItMatters}</p>
                )}
                {meta && <p className="mt-2 break-words text-xs leading-6 text-slate-500">{meta}</p>}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export default function ExpertAnswerCard({ answer }: ExpertAnswerCardProps) {
  const primaryBlocks = answer.blocks.filter((block) => block.type !== 'warning' && block.type !== 'followup');
  const warningBlocks = answer.blocks.filter((block) => block.type === 'warning');
  const followupBlocks = answer.blocks.filter((block) => block.type === 'followup');

  return (
    <article className="w-full rounded-[24px] border border-slate-200 bg-white px-4 py-5 shadow-sm sm:px-6 sm:py-6">
      <header className="border-b border-slate-200 pb-5">
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

        <h2 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900 sm:text-[1.75rem]">{answer.headline}</h2>
        <p className="mt-3 whitespace-pre-wrap text-[15px] leading-8 text-slate-700 sm:text-base">{answer.summary}</p>
      </header>

      <div className="space-y-5 pt-5 sm:space-y-6 sm:pt-6">
        <DocumentSection title="결론" noBorder>
          <div className="space-y-3">
            <p className="text-[15px] font-semibold leading-8 text-slate-900 sm:text-base">{answer.summary}</p>
            {answer.scope && <p className="text-sm leading-7 text-slate-600">적용 범위: {answer.scope}</p>}
          </div>
        </DocumentSection>

        {primaryBlocks.length > 0 && (
          <DocumentSection title="주요 내용">
            <BlockGroup blocks={primaryBlocks} />
          </DocumentSection>
        )}

        {warningBlocks.length > 0 && (
          <DocumentSection title="보완 방법">
            <div className="border-l-2 border-amber-300 pl-4">
              <BlockGroup blocks={warningBlocks} />
            </div>
          </DocumentSection>
        )}

        <DocumentSection title="근거 문헌">
          <div className="space-y-6">
            <BasisSection
              title="법적 근거"
              entries={answer.basis.legal}
              emptyLabel="직접 연결된 법적 근거가 아직 충분하지 않습니다."
            />
            <BasisSection
              title="평가 근거"
              entries={answer.basis.evaluation}
              emptyLabel="직접 연결된 평가 근거가 아직 충분하지 않습니다."
            />
            <BasisSection
              title="실무 근거"
              entries={answer.basis.practical}
              emptyLabel="직접 연결된 실무 근거가 아직 충분하지 않습니다."
            />
          </div>
        </DocumentSection>

        <DocumentSection title="참조 근거">
          <CitationList answer={answer} />
        </DocumentSection>

        {(followupBlocks.length > 0 || answer.followUps.length > 0) && (
          <DocumentSection title="추가 확인">
            <div className="space-y-5">
              {followupBlocks.length > 0 && <BlockGroup blocks={followupBlocks} />}

              {answer.followUps.length > 0 && (
                <ul className="space-y-3">
                  {answer.followUps.map((followUp) => (
                    <li key={followUp} className="border-b border-slate-100 pb-3 text-[15px] leading-8 text-slate-700 last:border-b-0 last:pb-0">
                      {followUp}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </DocumentSection>
        )}

        <div className="rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm leading-6 text-amber-900">
          이 답변은 AI가 생성한 것으로, 법적 자문을 대체할 수 없습니다. 정확한 정보는 원문을 확인하거나 전문가와 상담하시기 바랍니다.
        </div>
      </div>
    </article>
  );
}
