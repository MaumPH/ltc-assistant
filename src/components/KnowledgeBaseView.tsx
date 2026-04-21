import React, { useDeferredValue, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, FileText, Search, X } from 'lucide-react';
import {
  allKnowledgeListItems,
  CATEGORY_ORDER,
  SOURCE_LABELS,
  type Category,
  type KnowledgeListItem,
  type KnowledgeSource,
} from '../lib/knowledge';
import { matchesKnowledgeSearch } from '../lib/knowledgeSearch';

type SourceFilter = 'all' | KnowledgeSource;

const SOURCE_FILTERS: { id: SourceFilter; label: string }[] = [
  { id: 'all', label: '전체' },
  { id: 'general', label: SOURCE_LABELS.general },
  { id: 'eval', label: SOURCE_LABELS.eval },
];

const CATEGORY_BADGE_STYLES: Record<Category, string> = {
  법령: 'bg-slate-900 text-white',
  시행령: 'bg-blue-100 text-blue-700',
  시행규칙: 'bg-cyan-100 text-cyan-700',
  고시: 'bg-emerald-100 text-emerald-700',
  '별표·별지': 'bg-amber-100 text-amber-700',
  '평가·매뉴얼': 'bg-violet-100 text-violet-700',
  참고자료: 'bg-slate-100 text-slate-600',
};

const CATEGORY_DOT_STYLES: Record<Category, string> = {
  법령: 'bg-slate-900',
  시행령: 'bg-blue-500',
  시행규칙: 'bg-cyan-500',
  고시: 'bg-emerald-500',
  '별표·별지': 'bg-amber-500',
  '평가·매뉴얼': 'bg-violet-500',
  참고자료: 'bg-slate-400',
};

const twoLineClampStyle: React.CSSProperties = {
  display: '-webkit-box',
  WebkitBoxOrient: 'vertical',
  WebkitLineClamp: 2,
  overflow: 'hidden',
};

export default function KnowledgeBaseView() {
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [openCategories, setOpenCategories] = useState<Set<Category>>(() => new Set(CATEGORY_ORDER));
  const deferredSearch = useDeferredValue(search);

  const totalDocuments = allKnowledgeListItems.length;

  const filteredDocuments = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();

    return allKnowledgeListItems.filter((file) => {
      if (sourceFilter !== 'all' && file.source !== sourceFilter) {
        return false;
      }

      if (!query) {
        return true;
      }

      return matchesKnowledgeSearch(file, query);
    });
  }, [deferredSearch, sourceFilter]);

  const groupedDocuments = useMemo(
    () =>
      CATEGORY_ORDER.map((category) => ({
        category,
        files: filteredDocuments.filter((file) => file.category === category),
      })).filter((group) => group.files.length > 0),
    [filteredDocuments],
  );

  const toggleCategory = (category: Category) => {
    setOpenCategories((previous) => {
      const next = new Set(previous);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const searchQuery = deferredSearch.trim();
  const isSearching = searchQuery.length > 0;
  const filteredCountText =
    filteredDocuments.length === totalDocuments
      ? `총 ${totalDocuments}개 문서`
      : `${filteredDocuments.length}개 문서 표시 중 · 전체 ${totalDocuments}개`;

  const emptyTitle = isSearching ? '검색 결과가 없습니다' : '선택한 범위에 문서가 없습니다';
  const emptyDescription = isSearching
    ? '제목, 파일명, 분류를 기준으로 다시 검색해 보세요.'
    : '다른 문서 범위를 선택하거나 필터를 전체로 바꿔 보세요.';

  const renderListItem = (file: KnowledgeListItem) => {
    return (
      <article
        key={file.path}
        className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50"
      >
        <div className="flex items-start gap-3">
          <div
            className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-500"
          >
            <FileText className="h-4 w-4" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold leading-5 text-slate-800" style={twoLineClampStyle} title={file.displayTitle}>
              {file.displayTitle}
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
              <span className={`rounded-full px-2 py-0.5 font-medium ${CATEGORY_BADGE_STYLES[file.category]}`}>
                {file.category}
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5">{file.sourceLabel}</span>
            </div>
          </div>
        </div>
      </article>
    );
  };

  if (totalDocuments === 0) {
    return (
      <div className="flex flex-1 items-center justify-center bg-slate-50 p-6 sm:p-8">
        <div className="max-w-md rounded-[32px] border border-slate-200 bg-white px-6 py-10 text-center shadow-sm">
          <FileText className="mx-auto mb-4 h-12 w-12 text-slate-300" />
          <h2 className="text-xl font-semibold text-slate-900">지식베이스 문서가 없습니다</h2>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">knowledge/</code> 폴더에 문서를 추가하면
            이 탭에서 바로 탐색할 수 있습니다.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-7 sm:px-6 md:px-8">
      <div className="mx-auto max-w-[860px]">
        <div className="mb-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Knowledge Base</p>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-[-0.02em] text-slate-900">지식베이스 문서 목록</h1>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                제목과 분류 유형으로 문서를 찾을 수 있습니다.
              </p>
            </div>
            <div className="w-fit rounded-full border border-blue-200 bg-blue-50 px-4 py-1.5 text-xs font-bold text-blue-700">
              {filteredCountText}
            </div>
          </div>
        </div>

        <div className="mb-5 flex flex-wrap gap-2.5">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="문서 제목이나 분류를 검색하세요"
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-10 text-sm text-slate-900 outline-none transition focus:border-blue-500"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="검색어 지우기"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {SOURCE_FILTERS.map((filter) => {
              const isActive = sourceFilter === filter.id;

              return (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => setSourceFilter(filter.id)}
                  className={`rounded-[10px] border px-3.5 py-2 text-xs font-medium transition-colors ${
                    isActive
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {filter.label}
                </button>
              );
            })}
          </div>
        </div>

        {groupedDocuments.length === 0 ? (
          <div className="rounded-[28px] border border-dashed border-slate-200 bg-white px-6 py-16 text-center shadow-sm">
            <FileText className="mx-auto mb-4 h-12 w-12 text-slate-300" />
            <h2 className="text-xl font-semibold text-slate-900">{emptyTitle}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-500">{emptyDescription}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {groupedDocuments.map(({ category, files }) => {
              const isOpen = isSearching || openCategories.has(category);

              return (
                <section key={category} className="rounded-[28px] border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
                  <button
                    type="button"
                    onClick={() => {
                      if (!isSearching) {
                        toggleCategory(category);
                      }
                    }}
                    className={`flex w-full items-center justify-between rounded-2xl px-3 py-2 text-left transition-colors ${
                      isSearching ? 'cursor-default' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className={`h-2.5 w-2.5 rounded-full ${CATEGORY_DOT_STYLES[category]}`} />
                      <span className="text-sm font-semibold text-slate-800">{category}</span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">
                        {files.length}
                      </span>
                    </div>

                    {!isSearching &&
                      (isOpen ? (
                        <ChevronDown className="h-4 w-4 text-slate-400" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-slate-400" />
                      ))}
                  </button>

                  {isOpen && <div className="mt-3 space-y-2">{files.map(renderListItem)}</div>}
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
