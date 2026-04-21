import React, { useEffect, useMemo, useState } from 'react';
import {
  BookOpenText,
  Bot,
  Files,
  LayoutDashboard,
  LibraryBig,
  Loader2,
  Scale,
  Settings2,
} from 'lucide-react';
import { motion } from 'motion/react';
import { getApiUrl } from '../lib/apiUrl';
import { CATEGORY_ORDER, type Category } from '../lib/knowledgeCategories';
import type { ChatCapabilities, HomeOverviewResponse } from '../lib/ragTypes';
import { MODELS, type ModelId, type TabId } from './TopNav';

interface HomeViewProps {
  capabilities: ChatCapabilities | null;
  hasApiKey: boolean;
  onOpenSettings: () => void;
  onTabChange: (tab: TabId) => void;
  selectedModel: ModelId;
}

interface ActionCardDefinition {
  id: Exclude<TabId, 'home' | 'admin'> | 'settings';
  title: string;
  eyebrow: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const ACTION_CARDS: ActionCardDefinition[] = [
  {
    id: 'integrated',
    title: '통합채팅',
    eyebrow: 'Grounded Chat',
    description: '법령, 평가, 실무 문서를 함께 묶어 한 번에 질의합니다.',
    icon: Bot,
  },
  {
    id: 'evaluation',
    title: '평가채팅',
    eyebrow: 'Evaluation Focus',
    description: '평가 대응 질문에 맞춰 근거와 준비 포인트를 빠르게 찾습니다.',
    icon: Files,
  },
  {
    id: 'wiki',
    title: '평가 지침정리',
    eyebrow: 'Guideline Notes',
    description: '정리된 평가 문서를 탐색하며 기준과 주의점을 읽습니다.',
    icon: BookOpenText,
  },
  {
    id: 'dashboard',
    title: '대시보드',
    eyebrow: 'Operations Board',
    description: '주기별 준비 현황과 체크리스트 진척도를 한눈에 확인합니다.',
    icon: LayoutDashboard,
  },
  {
    id: 'knowledge',
    title: '지식기반',
    eyebrow: 'Knowledge Base',
    description: '로컬 문서를 제목과 분류 기준으로 탐색합니다.',
    icon: LibraryBig,
  },
  {
    id: 'settings',
    title: '설정',
    eyebrow: 'Workspace Setup',
    description: '답변 키와 모델 선택 상태를 확인하고 바로 조정합니다.',
    icon: Settings2,
  },
];

const CATEGORY_DOT_STYLES: Record<Category, string> = {
  법령: 'bg-slate-900',
  시행령: 'bg-blue-500',
  시행규칙: 'bg-cyan-500',
  고시: 'bg-emerald-500',
  '별표·별지': 'bg-amber-500',
  '평가·매뉴얼': 'bg-violet-500',
  참고자료: 'bg-slate-400',
};

const EMPTY_CATEGORY_COUNTS = CATEGORY_ORDER.map((category) => ({ category, count: 0 }));

function formatNumber(value: number): string {
  return new Intl.NumberFormat('ko-KR').format(value);
}

function formatDateLabel(value?: string): string {
  if (!value) return '로컬 인덱스 기준';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '로컬 인덱스 기준';

  return `${new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)} 기준`;
}

function getReadinessLabel(readiness?: HomeOverviewResponse['retrievalReadiness'] | ChatCapabilities['retrievalReadiness']): string {
  switch (readiness) {
    case 'hybrid_ready':
      return '하이브리드 검색 준비 완료';
    case 'hybrid_partial':
      return '하이브리드 검색 준비 중';
    case 'lexical_only':
      return '어휘 검색 우선';
    default:
      return '준비 상태 확인 중';
  }
}

function getReadinessBadge(readiness?: HomeOverviewResponse['retrievalReadiness'] | ChatCapabilities['retrievalReadiness']): string {
  switch (readiness) {
    case 'hybrid_ready':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'hybrid_partial':
      return 'border-amber-200 bg-amber-50 text-amber-700';
    case 'lexical_only':
      return 'border-slate-200 bg-slate-100 text-slate-700';
    default:
      return 'border-slate-200 bg-white text-slate-600';
  }
}

function buildActionMeta(
  cardId: ActionCardDefinition['id'],
  overview: HomeOverviewResponse | null,
  capabilities: ChatCapabilities | null,
  hasApiKey: boolean,
  selectedModel: ModelId,
): string {
  const selectedModelLabel = MODELS.find((model) => model.id === selectedModel)?.label ?? selectedModel;

  switch (cardId) {
    case 'integrated':
      return getReadinessLabel(overview?.retrievalReadiness ?? capabilities?.retrievalReadiness);
    case 'evaluation':
      return overview ? `정리 페이지 ${formatNumber(overview.compiledPageCount)}개 기반` : '평가 근거와 실무 포인트 중심';
    case 'wiki':
      return overview ? `지식 문서 ${formatNumber(overview.knowledgeDocumentCount)}개 연결` : '평가 지침 모듈 탐색';
    case 'dashboard':
      return '준비 일정과 체크리스트 흐름 확인';
    case 'knowledge':
      return overview ? `인덱스 청크 ${formatNumber(overview.chunkCount)}개 탐색 가능` : '문서 분류 기준 탐색';
    case 'settings':
      return `${hasApiKey ? '개인 답변 키 등록됨' : '개인 답변 키 미등록'} · ${selectedModelLabel}`;
  }
}

function ActionCard({
  card,
  index,
  meta,
  onClick,
}: {
  card: ActionCardDefinition;
  index: number;
  meta: string;
  onClick: () => void;
}) {
  const Icon = card.icon;

  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.36, delay: 0.1 + index * 0.06, ease: 'easeOut' }}
      onClick={onClick}
      className="group relative overflow-hidden rounded-[28px] border border-slate-200 bg-white/94 p-5 text-left shadow-[0_18px_45px_-28px_rgba(15,23,42,0.24)] transition-all hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-[0_24px_60px_-30px_rgba(37,99,235,0.24)]"
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#60a5fa] to-transparent opacity-80" />
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-700">{card.eyebrow}</p>
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-slate-900">{card.title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{card.description}</p>
          </div>
        </div>
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-blue-100 bg-blue-50 text-blue-700 transition-colors group-hover:bg-blue-100">
          <Icon className="h-5 w-5" />
        </span>
      </div>

      <div className="mt-5 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
        <span className="text-sm font-medium text-slate-700">{meta}</span>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500 transition-colors group-hover:bg-blue-600 group-hover:text-white">
          바로 이동
        </span>
      </div>
    </motion.button>
  );
}

function HomeOverviewStats({
  isLoading,
  overview,
}: {
  isLoading: boolean;
  overview: HomeOverviewResponse | null;
}) {
  const categoryItems = overview?.knowledgeCategoryCounts ?? EMPTY_CATEGORY_COUNTS;
  const items = [
    {
      label: '지식 문서',
      value: overview ? formatNumber(overview.knowledgeDocumentCount) : '—',
    },
    {
      label: '인덱스 청크',
      value: overview ? formatNumber(overview.chunkCount) : '—',
    },
    {
      label: '정리 페이지',
      value: overview ? formatNumber(overview.compiledPageCount) : '—',
    },
    {
      label: '검색 준비',
      value: overview ? getReadinessLabel(overview.retrievalReadiness) : '—',
    },
    {
      label: '대기 임베딩',
      value: overview ? formatNumber(overview.pendingEmbeddingChunks) : '—',
    },
  ];

  return (
    <div className="rounded-[30px] border border-blue-100/70 bg-white/82 px-5 py-5 shadow-[0_18px_50px_-32px_rgba(15,23,42,0.22)] backdrop-blur sm:px-6">
      <div className="grid gap-4 md:grid-cols-5">
        {items.map((item, index) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32, delay: 0.22 + index * 0.05, ease: 'easeOut' }}
            className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3"
          >
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-blue-500" />
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-500">{item.label}</p>
              <p className="mt-1 truncate text-sm font-semibold text-slate-900">
                {isLoading ? '불러오는 중...' : item.value}
              </p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="mt-5 border-t border-slate-100 pt-5">
        <div className="mb-3">
          <p className="text-sm font-semibold text-slate-900">지식기반 분류 현황</p>
          <p className="mt-1 text-xs text-slate-500">지식 파일 개수를 분류 기준별로 보여줍니다.</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          {categoryItems.map((item, index) => (
            <motion.div
              key={item.category}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.38 + index * 0.04, ease: 'easeOut' }}
              className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3"
            >
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${CATEGORY_DOT_STYLES[item.category]}`} />
                <p className="min-w-0 truncate text-xs font-medium text-slate-500">{item.category}</p>
              </div>
              <p className="mt-2 text-base font-semibold text-slate-900">
                {isLoading ? '집계 중...' : formatNumber(item.count)}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function HomeView({
  capabilities,
  hasApiKey,
  onOpenSettings,
  onTabChange,
  selectedModel,
}: HomeViewProps) {
  const [overview, setOverview] = useState<HomeOverviewResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadOverview = async () => {
      try {
        const response = await fetch(getApiUrl('/api/home/overview'));
        if (!response.ok) {
          throw new Error(`Home overview request failed with ${response.status}`);
        }
        const payload = (await response.json()) as HomeOverviewResponse;
        if (!cancelled) {
          setOverview(payload);
          setError(null);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load home overview');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadOverview();
    return () => {
      cancelled = true;
    };
  }, []);

  const caption = useMemo(() => {
    return formatDateLabel(overview?.indexGeneratedAt ?? overview?.latestKnowledgeUpdatedAt);
  }, [overview?.indexGeneratedAt, overview?.latestKnowledgeUpdatedAt]);

  const readinessClass = getReadinessBadge(overview?.retrievalReadiness ?? capabilities?.retrievalReadiness);

  return (
    <div className="flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.12),transparent_32%),linear-gradient(180deg,#f8fbff_0%,#eff5ff_48%,#f8fafc_100%)] px-4 py-6 sm:px-6 md:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 md:gap-8">
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.42, ease: 'easeOut' }}
          className="overflow-hidden rounded-[36px] border border-slate-200 bg-[linear-gradient(180deg,rgba(248,251,255,0.98),rgba(255,255,255,0.92))] shadow-[0_24px_80px_-48px_rgba(15,23,42,0.28)]"
        >
          <div className="relative px-6 py-10 sm:px-8 md:px-12 md:py-14">
            <div className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-[#60a5fa] to-transparent" />
            <div className="mx-auto max-w-3xl text-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50/90 px-4 py-1.5 text-sm text-blue-700 shadow-sm">
                <Scale className="h-4 w-4" />
                <span className="font-medium">로컬 인덱스 + 온톨로지 기반</span>
              </div>

              <div className="mt-6">
                <p className="font-brand text-3xl tracking-tight text-slate-900 sm:text-4xl md:text-5xl">
                  장기요양 물어보세요
                </p>
                <p className="mt-4 text-base leading-8 text-slate-600 sm:text-lg">
                  통합채팅, 평가채팅, 정리지식, 운영 대시보드를 한 곳에서 오가며 근거 중심으로 답을 찾는 업무 홈입니다.
                </p>
              </div>

              <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
                <span className={`rounded-full border px-4 py-2 text-sm font-medium ${readinessClass}`}>
                  {getReadinessLabel(overview?.retrievalReadiness ?? capabilities?.retrievalReadiness)}
                </span>
                <span className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600">
                  {hasApiKey ? '개인 답변 키 등록됨' : '개인 답변 키를 등록하면 답변 생성 가능'}
                </span>
                {overview && (
                  <span className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600">
                    저장소 {overview.storageMode}
                  </span>
                )}
              </div>
            </div>
          </div>
        </motion.section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {ACTION_CARDS.map((card, index) => (
            <ActionCard
              key={card.id}
              card={card}
              index={index}
              meta={buildActionMeta(card.id, overview, capabilities, hasApiKey, selectedModel)}
              onClick={() => {
                if (card.id === 'settings') {
                  onOpenSettings();
                  return;
                }
                onTabChange(card.id);
              }}
            />
          ))}
        </section>

        <div className="space-y-3">
          <HomeOverviewStats isLoading={isLoading} overview={overview} />

          <div className="flex flex-col gap-2 px-1 text-center text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-center">
            <span>{caption}</span>
            <span className="hidden sm:inline text-slate-300">·</span>
            <span>
              {error
                ? '홈 요약 데이터를 일부 불러오지 못했습니다.'
                : '로컬 인덱스 실데이터 기준으로 현재 작업 상태를 요약합니다.'}
            </span>
          </div>

          {isLoading && (
            <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              홈 요약 데이터를 확인하는 중입니다.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
