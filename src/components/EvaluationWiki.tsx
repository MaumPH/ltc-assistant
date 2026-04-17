import React, { useDeferredValue, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { ChevronDown, ChevronRight, FileText, Search, Tag, X } from 'lucide-react';

const evalWikiModules = {
  ...import.meta.glob('/knowledge/evaluation/*.md', { query: '?raw', import: 'default', eager: true }),
};

interface WikiPage {
  slug: string;
  fileName: string;
  title: string;
  area: string;
  status: string;
  updated: string;
  tags: string[];
  body: string;
}

function parsePage(fileName: string, raw: string): WikiPage {
  const frontMatterMatch = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  let title = fileName.replace('.md', '');
  let area = '미분류';
  let status = 'active';
  let updated = '';
  let tags: string[] = [];
  let body = raw;

  if (frontMatterMatch) {
    const frontMatter = frontMatterMatch[1];
    body = frontMatterMatch[2].trim();

    const get = (key: string) =>
      frontMatter.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'))?.[1]?.trim() ?? '';

    title = get('title') || title;
    area = get('area') || area;
    status = get('status') || 'active';
    updated = get('updated') || '';

    const tagsMatch = frontMatter.match(/^tags:\s*\[([^\]]*)\]/m);
    if (tagsMatch) {
      tags = tagsMatch[1]
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean);
    }
  }

  return {
    slug: fileName.replace('.md', ''),
    fileName,
    title,
    area,
    status,
    updated,
    tags,
    body,
  };
}

function getStatusStyle(status: string) {
  if (status === 'revised') return 'bg-blue-100 text-blue-700';
  if (status === '확인필요') return 'bg-amber-100 text-amber-700';
  return 'bg-green-100 text-green-700';
}

export default function EvaluationWiki() {
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [openAreas, setOpenAreas] = useState<Set<string>>(new Set());
  const [isMobileIndexOpen, setIsMobileIndexOpen] = useState(false);
  const deferredSearch = useDeferredValue(search);

  const pages = useMemo<WikiPage[]>(() => {
    return Object.entries(evalWikiModules)
      .map(([path, content]) => {
        const fileName = path.split('/').pop() || path;
        return parsePage(fileName, content as string);
      })
      .sort((a, b) => a.slug.localeCompare(b.slug, 'ko'));
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, WikiPage[]>();
    for (const page of pages) {
      if (!map.has(page.area)) map.set(page.area, []);
      map.get(page.area)!.push(page);
    }
    return map;
  }, [pages]);

  const filtered = useMemo(() => {
    if (!deferredSearch.trim()) return pages;
    const query = deferredSearch.toLowerCase();

    return pages.filter((page) => {
      return (
        page.title.toLowerCase().includes(query) ||
        page.area.toLowerCase().includes(query) ||
        page.tags.some((tag) => tag.toLowerCase().includes(query)) ||
        page.body.toLowerCase().includes(query)
      );
    });
  }, [deferredSearch, pages]);

  const selectedPage = pages.find((page) => page.slug === selectedSlug) ?? pages[0] ?? null;

  const toggleArea = (area: string) => {
    setOpenAreas((previous) => {
      const next = new Set(previous);
      if (next.has(area)) next.delete(area);
      else next.add(area);
      return next;
    });
  };

  const handleSelectPage = (slug: string) => {
    setSelectedSlug(slug);
    setSearch('');
    setIsMobileIndexOpen(false);
  };

  const navigationContent = (
    <>
      <div className="border-b border-slate-200 p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="지표 검색..."
            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-base focus:outline-none focus:ring-1 focus:ring-blue-500 sm:text-sm"
          />
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto p-2">
        {search.trim() ? (
          <ul className="space-y-0.5">
            {filtered.map((page) => (
              <li key={page.slug}>
                <button
                  type="button"
                  onClick={() => handleSelectPage(page.slug)}
                  className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                    selectedSlug === page.slug ? 'bg-blue-50 font-medium text-blue-700' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate">{page.title}</span>
                    <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] ${getStatusStyle(page.status)}`}>
                      {page.status}
                    </span>
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-400">{page.area}</div>
                </button>
              </li>
            ))}

            {filtered.length === 0 && <p className="py-8 text-center text-xs text-slate-400">검색 결과가 없습니다.</p>}
          </ul>
        ) : (
          Array.from(grouped.entries()).map(([area, areaPages]) => {
            const isOpen = openAreas.has(area);
            return (
              <div key={area} className="mb-1">
                <button
                  type="button"
                  onClick={() => toggleArea(area)}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 transition-colors hover:bg-slate-50"
                >
                  <span>{area}</span>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-normal normal-case text-slate-400">{areaPages.length}개</span>
                    {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  </div>
                </button>

                {isOpen && (
                  <ul className="ml-2 space-y-0.5">
                    {areaPages.map((page) => (
                      <li key={page.slug}>
                        <button
                          type="button"
                          onClick={() => handleSelectPage(page.slug)}
                          className={`w-full rounded-lg px-3 py-1.5 text-left text-sm transition-colors ${
                            selectedSlug === page.slug ? 'bg-blue-50 font-medium text-blue-700' : 'text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-[13px]">{page.title}</span>
                            <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] ${getStatusStyle(page.status)}`}>
                              {page.status}
                            </span>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })
        )}
      </nav>
    </>
  );

  if (pages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center bg-slate-50 p-8">
        <div className="max-w-md text-center">
          <FileText className="mx-auto mb-4 h-12 w-12 text-slate-300" />
          <h2 className="mb-2 text-lg font-semibold text-slate-700">평가지표 파일이 없습니다</h2>
          <p className="text-sm leading-relaxed text-slate-500">
            <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">knowledge/evaluation/</code> 폴더에 문서를 추가하면
            여기에 표시됩니다.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex min-h-0 flex-1 bg-slate-50">
        <aside className="hidden w-72 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
          {navigationContent}
        </aside>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 lg:p-10">
          {selectedPage ? (
            <div className="mx-auto max-w-5xl">
              <div className="mb-4 flex items-center justify-between gap-3 md:hidden">
                <button
                  type="button"
                  onClick={() => setIsMobileIndexOpen(true)}
                  className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50"
                >
                  문서 목록
                </button>

                <span className="max-w-[55%] truncate rounded-full bg-white px-3 py-1.5 text-xs font-medium text-slate-500 shadow-sm">
                  {selectedPage.area}
                </span>
              </div>

              <div className="mb-6 border-b border-slate-200 pb-4">
                <div className="mb-2 flex items-start justify-between gap-4">
                  <h1 className="text-xl font-bold text-slate-900">{selectedPage.title}</h1>
                  <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-medium ${getStatusStyle(selectedPage.status)}`}>
                    {selectedPage.status}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                  <span className="rounded bg-slate-100 px-2 py-0.5">{selectedPage.area}</span>
                  {selectedPage.updated && <span>최종 수정: {selectedPage.updated}</span>}
                  {selectedPage.tags.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1">
                      <Tag className="h-3 w-3" />
                      {selectedPage.tags.map((tag) => (
                        <span key={tag} className="rounded bg-blue-50 px-2 py-0.5 text-blue-600">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="prose prose-sm max-w-none break-words prose-headings:font-semibold prose-p:leading-8 prose-li:leading-8 prose-h2:mt-8 prose-h2:border-b prose-h2:border-slate-200 prose-h2:pb-2 prose-h2:text-lg prose-a:text-blue-600 md:prose-base">
                <ReactMarkdown>{selectedPage.body}</ReactMarkdown>
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-slate-400">
              <p className="text-sm">문서를 선택해 주세요.</p>
            </div>
          )}
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
                <p className="mt-1 text-xs text-slate-500">검색하거나 영역별로 펼쳐서 문서를 선택하세요.</p>
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
