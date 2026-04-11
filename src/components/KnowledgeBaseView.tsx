import React, { useDeferredValue, useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { ChevronDown, ChevronRight, FileText, Search, X } from 'lucide-react';
import {
  allKnowledgeFiles,
  CATEGORY_ORDER,
  SOURCE_LABELS,
  formatBytes,
  type Category,
  type KnowledgeDocument,
  type KnowledgeSource,
} from '../lib/knowledge';

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
  const [selectedPath, setSelectedPath] = useState<string | null>(allKnowledgeFiles[0]?.path ?? null);
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [openCategories, setOpenCategories] = useState<Set<Category>>(() => new Set(CATEGORY_ORDER));
  const [isMobileIndexOpen, setIsMobileIndexOpen] = useState(false);
  const deferredSearch = useDeferredValue(search);

  const totalDocuments = allKnowledgeFiles.length;
  const totalSize = useMemo(
    () => allKnowledgeFiles.reduce((sum, file) => sum + file.size, 0),
    [],
  );

  const filteredDocuments = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();

    return allKnowledgeFiles.filter((file) => {
      if (sourceFilter !== 'all' && file.source !== sourceFilter) {
        return false;
      }

      if (!query) {
        return true;
      }

      const target = [file.displayTitle, file.name, file.category, file.sourceLabel].join(' ').toLowerCase();
      return target.includes(query);
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

  const selectedDocument =
    filteredDocuments.find((file) => file.path === selectedPath) ??
    filteredDocuments[0] ??
    null;

  useEffect(() => {
    if (filteredDocuments.length === 0) {
      if (selectedPath !== null) {
        setSelectedPath(null);
      }
      return;
    }

    if (!filteredDocuments.some((file) => file.path === selectedPath)) {
      setSelectedPath(filteredDocuments[0].path);
    }
  }, [filteredDocuments, selectedPath]);

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
      ? `총 ${totalDocuments}개 문서 · ${formatBytes(totalSize)}`
      : `${filteredDocuments.length}개 문서 표시 중 · 전체 ${totalDocuments}개`;

  const emptyTitle = isSearching ? '검색 결과가 없습니다' : '선택한 범위에 문서가 없습니다';
  const emptyDescription = isSearching
    ? '제목, 파일명, 분류를 기준으로 다시 검색해 보세요.'
    : '다른 문서 범위를 선택하거나 필터를 전체로 바꿔 보세요.';

  const renderFileButton = (file: KnowledgeDocument) => {
    const isActive = selectedDocument?.path === file.path;

    return (
      <button
        key={file.path}
        type="button"
        onClick={() => {
          setSelectedPath(file.path);
          setIsMobileIndexOpen(false);
        }}
        className={`group relative w-full rounded-2xl border px-3 py-3 text-left transition-all ${
          isActive
            ? 'border-blue-200 bg-blue-50/90 shadow-sm'
            : 'border-transparent bg-white hover:border-slate-200 hover:bg-slate-50'
        }`}
      >
        <span
          className={`absolute inset-y-3 left-0 w-1 rounded-r-full ${
            isActive ? 'bg-blue-500' : 'bg-transparent'
          }`}
        />

        <div className="flex items-start gap-3 pl-3">
          <div
            className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl ${
              isActive ? 'bg-white text-blue-600' : 'bg-slate-100 text-slate-500'
            }`}
          >
            <FileText className="h-4 w-4" />
          </div>

          <div className="min-w-0 flex-1">
            <div
              className={`text-sm font-semibold leading-5 ${
                isActive ? 'text-slate-950' : 'text-slate-800'
              }`}
              style={twoLineClampStyle}
              title={file.displayTitle}
            >
              {file.displayTitle}
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
              <span className={`rounded-full px-2 py-0.5 font-medium ${CATEGORY_BADGE_STYLES[file.category]}`}>
                {file.category}
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5">{file.sourceLabel}</span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5">{file.sizeLabel}</span>
            </div>
          </div>
        </div>
      </button>
    );
  };

  const navigationContent = (
    <>
      <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-4 py-4 backdrop-blur">
        <div className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Knowledge Base</p>
          <h1 className="mt-2 text-lg font-semibold text-slate-900">지식베이스 문서</h1>
          <p className="mt-1 text-sm text-slate-500">{filteredCountText}</p>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="문서 제목이나 분류를 검색하세요"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-10 text-base text-slate-900 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100 sm:text-sm"
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

        <div className="mt-3 flex flex-wrap gap-2">
          {SOURCE_FILTERS.map((filter) => {
            const isActive = sourceFilter === filter.id;

            return (
              <button
                key={filter.id}
                type="button"
                onClick={() => setSourceFilter(filter.id)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {filter.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {groupedDocuments.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center">
            <p className="text-sm font-semibold text-slate-700">{emptyTitle}</p>
            <p className="mt-2 text-xs leading-5 text-slate-500">{emptyDescription}</p>
          </div>
        ) : (
          groupedDocuments.map(({ category, files }) => {
            const isOpen = isSearching || openCategories.has(category);

            return (
              <section key={category} className="mb-3">
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

                {isOpen && <div className="mt-2 space-y-1.5">{files.map(renderFileButton)}</div>}
              </section>
            );
          })
        )}
      </div>
    </>
  );

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
    <>
      <div className="flex min-h-0 flex-1 bg-slate-50">
        <aside className="hidden w-[24rem] shrink-0 border-r border-slate-200 bg-white md:flex md:flex-col">
          {navigationContent}
        </aside>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8">
          <div className="mx-auto max-w-4xl">
            <div className="mb-4 flex items-center justify-between gap-3 md:hidden">
              <button
                type="button"
                onClick={() => setIsMobileIndexOpen(true)}
                className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50"
              >
                문서 목록
              </button>

              {selectedDocument && (
                <span className="max-w-[62%] truncate rounded-full bg-white px-3 py-1.5 text-xs font-medium text-slate-500 shadow-sm">
                  {selectedDocument.category}
                </span>
              )}
            </div>

            {selectedDocument ? (
              <>
                <header className="mb-6 border-b border-slate-200 pb-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Knowledge Base</p>
                  <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                    {selectedDocument.displayTitle}
                  </h1>
                  <p className="mt-2 break-all text-sm text-slate-500">{selectedDocument.name}</p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${CATEGORY_BADGE_STYLES[selectedDocument.category]}`}
                    >
                      {selectedDocument.category}
                    </span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                      {selectedDocument.sourceLabel}
                    </span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                      {selectedDocument.sizeLabel}
                    </span>
                  </div>
                </header>

                <div className="overflow-x-auto rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6 md:p-8">
                  <div className="prose prose-slate max-w-none break-words prose-headings:font-semibold prose-h2:mt-8 prose-h2:text-xl prose-h3:mt-6 prose-h3:text-lg prose-a:text-blue-600 prose-strong:text-slate-900">
                    <ReactMarkdown>{selectedDocument.content}</ReactMarkdown>
                  </div>
                </div>
              </>
            ) : (
              <div className="rounded-[28px] border border-dashed border-slate-200 bg-white px-6 py-16 text-center shadow-sm">
                <FileText className="mx-auto mb-4 h-12 w-12 text-slate-300" />
                <h2 className="text-xl font-semibold text-slate-900">{emptyTitle}</h2>
                <p className="mt-3 text-sm leading-6 text-slate-500">{emptyDescription}</p>
              </div>
            )}
          </div>
        </main>
      </div>

      {isMobileIndexOpen && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true" aria-label="문서 목록">
          <button
            type="button"
            onClick={() => setIsMobileIndexOpen(false)}
            className="absolute inset-0 bg-slate-950/50"
            aria-label="문서 목록 닫기"
          />

          <div className="absolute inset-x-0 bottom-0 max-h-[82dvh] overflow-hidden rounded-t-[28px] bg-white shadow-2xl">
            <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-slate-200" />

            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">문서 목록</h2>
                <p className="mt-1 text-xs text-slate-500">검색하거나 문서 분류별로 바로 탐색해 보세요.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileIndexOpen(false)}
                className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                aria-label="문서 목록 닫기"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div
              className="flex max-h-[calc(82dvh-4.5rem)] flex-col"
              style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)' }}
            >
              {navigationContent}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
