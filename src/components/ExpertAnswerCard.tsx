import { useState } from 'react';
import type { BasisBucketKey, ExpertAnswerBlock, ExpertAnswerBlockItem, ExpertAnswerEnvelope } from '../lib/ragTypes';

interface ExpertAnswerCardProps {
  answer: ExpertAnswerEnvelope;
}

type AnswerTabId = 'content' | 'basis' | 'citations';

const ANSWER_TABS: Array<{ id: AnswerTabId; label: string }> = [
  { id: 'content', label: '주요 내용' },
  { id: 'basis', label: '근거 문헌' },
  { id: 'citations', label: '참조 근거' },
];

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

function getBasisBadgeStyles(basis: BasisBucketKey): string {
  switch (basis) {
    case 'legal':
      return 'bg-blue-100 text-blue-700';
    case 'evaluation':
      return 'bg-violet-100 text-violet-700';
    case 'practical':
      return 'bg-emerald-100 text-emerald-700';
  }
}

function BasisBadge({ basis, verbose = false }: { basis?: BasisBucketKey; verbose?: boolean }) {
  if (!basis) return null;

  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${getBasisBadgeStyles(basis)}`}>
      {verbose ? BASIS_LABELS[basis] : BASIS_LABELS[basis].split(' ')[0]}
    </span>
  );
}

function BlockItem({ item }: { item: ExpertAnswerBlockItem }) {
  const meta = buildItemMeta(item);

  return (
    <li className="flex gap-3 border-b border-slate-100 pb-3 last:border-b-0 last:pb-0">
      <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-blue-600" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <p className="text-sm font-bold leading-6 text-slate-900">{item.label}</p>
          <BasisBadge basis={item.basis} />
        </div>
        <p className="mt-1 whitespace-pre-wrap text-sm leading-7 text-slate-700">{item.detail}</p>
        {meta.length > 0 && (
          <p className="mt-2 break-words text-xs leading-5 text-slate-500">{meta.join(' · ')}</p>
        )}
      </div>
    </li>
  );
}

function BlockHeader({ block }: { block: ExpertAnswerBlock }) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <h3 className="min-w-0 flex-1 text-[15px] font-bold leading-6 text-slate-900">{block.title}</h3>
      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase text-slate-500">
        {getBlockTypeLabel(block.type)}
      </span>
    </div>
  );
}

function ComparisonBlock({ block }: { block: ExpertAnswerBlock }) {
  return (
    <section>
      <BlockHeader block={block} />
      {block.intro && <p className="mb-3 text-sm leading-7 text-slate-500">{block.intro}</p>}

      <div className="grid gap-2 md:grid-cols-2">
        {block.items.map((item, index) => (
          <div
            key={`${block.title}-${item.label}-${index}`}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="min-w-0 text-sm font-bold leading-6 text-slate-900">{item.label}</p>
              <BasisBadge basis={item.basis} />
            </div>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-7 text-slate-700">{item.detail}</p>
            {buildItemMeta(item).filter((entry) => !Object.values(BASIS_LABELS).includes(entry)).length > 0 && (
              <p className="mt-2 break-words text-xs leading-5 text-slate-500">
                {buildItemMeta(item)
                  .filter((entry) => !Object.values(BASIS_LABELS).includes(entry))
                  .join(' · ')}
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function ListBlock({ block }: { block: ExpertAnswerBlock }) {
  return (
    <section>
      <BlockHeader block={block} />
      {block.intro && <p className="mb-3 text-sm leading-7 text-slate-500">{block.intro}</p>}

      <ul className="space-y-3">
        {block.items.map((item, index) => (
          <BlockItem key={`${block.title}-${item.label}-${index}`} item={item} />
        ))}
      </ul>
    </section>
  );
}

function BlockGroup({ blocks }: { blocks: ExpertAnswerBlock[] }) {
  return (
    <div className="space-y-5">
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

function WarningPanel({ blocks }: { blocks: ExpertAnswerBlock[] }) {
  if (blocks.length === 0) return null;

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
      <div className="space-y-4">
        {blocks.map((block) => (
          <section key={`${block.type}-${block.title}`}>
            <p className="mb-2 text-xs font-bold uppercase text-amber-800">{block.title}</p>
            <ul className="space-y-3">
              {block.items.map((item, index) => (
                <li key={`${block.title}-${item.label}-${index}`}>
                  <p className="text-sm font-semibold leading-6 text-amber-950">{item.label}</p>
                  <p className="mt-0.5 whitespace-pre-wrap text-sm leading-7 text-amber-900">{item.detail}</p>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

function FollowUpPanel({
  blocks,
  followUps,
}: {
  blocks: ExpertAnswerBlock[];
  followUps: string[];
}) {
  if (blocks.length === 0 && followUps.length === 0) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="mb-2 text-xs font-bold uppercase text-slate-500">추가 확인 사항</p>
      <div className="space-y-4">
        {blocks.length > 0 && <BlockGroup blocks={blocks} />}
        {followUps.length > 0 && (
          <ul className="space-y-2">
            {followUps.map((followUp) => (
              <li key={followUp} className="flex gap-2 text-sm leading-7 text-slate-700">
                <span className="shrink-0 font-bold text-blue-600">›</span>
                <span className="min-w-0">{followUp}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ContentTab({
  primaryBlocks,
  warningBlocks,
  followupBlocks,
  followUps,
}: {
  primaryBlocks: ExpertAnswerBlock[];
  warningBlocks: ExpertAnswerBlock[];
  followupBlocks: ExpertAnswerBlock[];
  followUps: string[];
}) {
  return (
    <div className="space-y-5">
      {primaryBlocks.length > 0 && <BlockGroup blocks={primaryBlocks} />}
      <WarningPanel blocks={warningBlocks} />
      <FollowUpPanel blocks={followupBlocks} followUps={followUps} />
      <div className="rounded-[10px] border border-amber-200 bg-amber-50 px-3.5 py-3 text-xs leading-6 text-amber-900 sm:text-sm">
        이 답변은 AI가 생성한 것으로, 법적 자문을 대체할 수 없습니다. 정확한 정보는 원문을 확인하거나 전문가와 상담하시기 바랍니다.
      </div>
    </div>
  );
}

function BasisSection({
  title,
  entries,
}: {
  title: string;
  entries: ExpertAnswerEnvelope['basis'][keyof ExpertAnswerEnvelope['basis']];
}) {
  if (entries.length === 0) return null;

  return (
    <section className="space-y-2">
      <h3 className="text-xs font-bold uppercase text-slate-500">{title}</h3>
      <div className="space-y-2">
        {entries.map((entry) => (
          <div key={`${title}-${entry.label}`} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-sm font-bold leading-6 text-slate-900">{entry.label}</p>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-7 text-slate-700">{entry.summary}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function BasisTab({ answer }: { answer: ExpertAnswerEnvelope }) {
  const hasBasis =
    answer.basis.legal.length > 0 ||
    answer.basis.evaluation.length > 0 ||
    answer.basis.practical.length > 0;

  if (!hasBasis) {
    return <p className="text-sm leading-7 text-slate-500">연결된 근거 문헌이 없습니다.</p>;
  }

  return (
    <div className="space-y-5">
      <BasisSection title="법적 근거" entries={answer.basis.legal} />
      <BasisSection title="평가 근거" entries={answer.basis.evaluation} />
      <BasisSection title="실무 근거" entries={answer.basis.practical} />
    </div>
  );
}

function CitationList({ answer }: { answer: ExpertAnswerEnvelope }) {
  if (answer.citations.length === 0) {
    return <p className="text-sm leading-7 text-slate-500">참조 근거가 없습니다.</p>;
  }

  return (
    <ol className="space-y-3">
      {answer.citations.map((citation, index) => {
        const meta = [citation.docTitle, citation.articleNo, citation.sectionPath.join(' / '), citation.effectiveDate]
          .filter(Boolean)
          .join(' · ');

        return (
          <li key={citation.evidenceId} className="flex gap-3 border-b border-slate-100 pb-3 last:border-b-0 last:pb-0">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
              {index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold leading-6 text-slate-900">{citation.label}</p>
              {citation.whyItMatters && (
                <p className="mt-1 whitespace-pre-wrap text-sm leading-7 text-slate-700">{citation.whyItMatters}</p>
              )}
              {meta && <p className="mt-2 break-words text-xs leading-5 text-slate-400">{meta}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function AnswerTabs({ activeTab, onChange }: { activeTab: AnswerTabId; onChange: (tab: AnswerTabId) => void }) {
  return (
    <div className="border-b border-slate-100 bg-slate-50 px-3 pt-2">
      <div className="flex gap-1 overflow-x-auto scrollbar-hide" role="tablist" aria-label="답변 보기 방식">
        {ANSWER_TABS.map((tab) => {
          const selected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              className={`whitespace-nowrap rounded-t-[10px] border-b-2 px-3.5 py-2 text-xs font-semibold transition ${
                selected
                  ? 'border-blue-600 bg-white text-blue-700'
                  : 'border-transparent text-slate-500 hover:bg-white/70 hover:text-slate-700'
              }`}
              onClick={() => onChange(tab.id)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ScopeBadge({ scope }: { scope: string }) {
  if (!scope) return null;

  return (
    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
      적용 범위: {scope}
    </span>
  );
}

export default function ExpertAnswerCard({ answer }: ExpertAnswerCardProps) {
  const [activeTab, setActiveTab] = useState<AnswerTabId>('content');
  const primaryBlocks = answer.blocks.filter((block) => block.type !== 'warning' && block.type !== 'followup');
  const warningBlocks = answer.blocks.filter((block) => block.type === 'warning');
  const followupBlocks = answer.blocks.filter((block) => block.type === 'followup');

  return (
    <article className="w-full overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-[0_2px_12px_rgba(15,23,42,0.07)]">
      <header className="border-b border-slate-100 px-4 py-4 sm:px-5">
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[10px] font-bold uppercase text-blue-700">
            Expert Answer
          </span>
          <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${getStateStyles(answer.evidenceState)}`}>
            {getStateLabel(answer.evidenceState)}
          </span>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
            {getAnswerTypeLabel(answer.answerType)}
          </span>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
            신뢰도 {answer.confidence}
          </span>
          <ScopeBadge scope={answer.scope} />
          {answer.keyIssueDate && (
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-400">
              {answer.keyIssueDate}
            </span>
          )}
        </div>

        <h2 className="text-xl font-bold leading-snug text-slate-900">{answer.headline}</h2>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-600">{answer.summary}</p>
      </header>

      <AnswerTabs activeTab={activeTab} onChange={setActiveTab} />

      <div className="px-4 py-4 sm:px-5" role="tabpanel">
        {activeTab === 'content' && (
          <ContentTab
            primaryBlocks={primaryBlocks}
            warningBlocks={warningBlocks}
            followupBlocks={followupBlocks}
            followUps={answer.followUps}
          />
        )}
        {activeTab === 'basis' && <BasisTab answer={answer} />}
        {activeTab === 'citations' && <CitationList answer={answer} />}
      </div>
    </article>
  );
}
