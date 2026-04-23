import React, { useDeferredValue, useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  BadgeCheck,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  FileCheck2,
  FileText,
  Layers3,
  ListChecks,
  Search,
  ShieldAlert,
  Tag,
  X,
  type LucideIcon,
} from 'lucide-react';
import {
  buildJudgementSummary,
  getEvaluationSectionClassName,
  parseEvaluationPage,
  prepareEvaluationSectionMarkdown,
  splitEvaluationSections,
  type WikiPage,
  type WikiSection,
} from '../lib/evaluationWiki';

const evalWikiModules = {
  ...import.meta.glob('/knowledge/evaluation/*.md', { query: '?raw', import: 'default', eager: true }),
};

interface AreaTheme {
  color: string;
  bg: string;
  border: string;
}

interface AreaGroup {
  area: string;
  pages: WikiPage[];
  theme: AreaTheme;
}

const AREA_THEMES: AreaTheme[] = [
  { color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' },
  { color: '#0891b2', bg: '#ecfeff', border: '#a5f3fc' },
  { color: '#059669', bg: '#f0fdf4', border: '#bbf7d0' },
  { color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' },
  { color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
  { color: '#64748b', bg: '#f8fafc', border: '#e2e8f0' },
];

const SECTION_META: Record<string, { icon: LucideIcon; label?: string }> = {
  '충족/미충족 기준': { icon: CheckCircle2 },
  '확인 방법': { icon: ClipboardCheck },
  확인방법: { icon: ClipboardCheck },
  '확정 근거': { icon: BadgeCheck },
  '관련 근거': { icon: FileText },
  관련근거: { icon: FileText },
  '실무 해석': { icon: BookOpen },
  '준비 서류': { icon: FileCheck2 },
  주의사항: { icon: ShieldAlert },
  '관련 지표': { icon: ListChecks },
  개요: { icon: Layers3 },
};

function getStatusColors(status: string) {
  if (status === 'revised') return { bg: '#dbeafe', color: '#1d4ed8', border: '#bfdbfe' };
  if (status === '확인필요') return { bg: '#fef3c7', color: '#92400e', border: '#fde68a' };
  return { bg: '#dcfce7', color: '#166534', border: '#bbf7d0' };
}

function getPageNumber(page: WikiPage) {
  const titleNumber = page.title.match(/^(\d+)\./)?.[1];
  if (titleNumber) return titleNumber;

  const slugNumber = page.slug.match(/^\d+-(\d+)/)?.[1];
  if (slugNumber) return String(Number(slugNumber));

  return 'i';
}

function getSectionIcon(title: string) {
  return SECTION_META[title]?.icon ?? FileText;
}

export default function EvaluationWiki() {
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [activeArea, setActiveArea] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [isMobileIndexOpen, setIsMobileIndexOpen] = useState(false);
  const deferredSearch = useDeferredValue(search);

  const pages = useMemo<WikiPage[]>(() => {
    return Object.entries(evalWikiModules)
      .map(([path, content]) => {
        const fileName = path.split('/').pop() || path;
        return parseEvaluationPage(fileName, content as string);
      })
      .sort((a, b) => a.slug.localeCompare(b.slug, 'ko'));
  }, []);

  const areaGroups = useMemo<AreaGroup[]>(() => {
    const map = new Map<string, WikiPage[]>();
    for (const page of pages) {
      if (!map.has(page.area)) map.set(page.area, []);
      map.get(page.area)!.push(page);
    }

    return Array.from(map.entries()).map(([area, areaPages], index) => ({
      area,
      pages: areaPages,
      theme: AREA_THEMES[index % AREA_THEMES.length],
    }));
  }, [pages]);

  const selectedPage = pages.find((page) => page.slug === selectedSlug) ?? pages[0] ?? null;
  const selectedGroup =
    areaGroups.find((group) => group.area === selectedPage?.area) ?? areaGroups.find((group) => group.area === activeArea) ?? areaGroups[0];
  const activeGroup = areaGroups.find((group) => group.area === activeArea) ?? selectedGroup;
  const currentTheme = selectedGroup?.theme ?? AREA_THEMES[0];
  const currentStatus = selectedPage ? getStatusColors(selectedPage.status) : getStatusColors('active');

  const filteredPages = useMemo(() => {
    if (!deferredSearch.trim()) return activeGroup?.pages ?? [];
    const query = deferredSearch.toLowerCase();

    return pages.filter((page) => {
      return (
        page.title.toLowerCase().includes(query) ||
        page.area.toLowerCase().includes(query) ||
        page.tags.some((tag) => tag.toLowerCase().includes(query)) ||
        page.body.toLowerCase().includes(query)
      );
    });
  }, [activeGroup?.pages, deferredSearch, pages]);

  const sections = useMemo(() => (selectedPage ? splitEvaluationSections(selectedPage.body) : []), [selectedPage]);
  const directionSection = sections.find((section) => section.title === '판단 기준');
  const contentSections = sections.filter((section) => section.title !== '판단 기준');
  const summary = selectedPage ? buildJudgementSummary(directionSection?.content, selectedPage.body) : '';

  useEffect(() => {
    if (pages.length === 0) return;

    setSelectedSlug((previous) => {
      if (previous && pages.some((page) => page.slug === previous)) return previous;
      return pages[0].slug;
    });

    setActiveArea((previous) => {
      if (previous && areaGroups.some((group) => group.area === previous)) return previous;
      return pages[0].area;
    });
  }, [areaGroups, pages]);

  const handleSelectArea = (area: string) => {
    const group = areaGroups.find((item) => item.area === area);
    setActiveArea(area);
    setSearch('');
    if (group?.pages[0]) setSelectedSlug(group.pages[0].slug);
  };

  const handleSelectPage = (page: WikiPage) => {
    setSelectedSlug(page.slug);
    setActiveArea(page.area);
    setSearch('');
    setIsMobileIndexOpen(false);
  };

  const navigationContent = (
    <>
      <div className="border-b border-slate-100 px-3 py-3">
        <div className="space-y-1">
          {areaGroups.map((group) => {
            const isActive = activeGroup?.area === group.area;
            return (
              <button
                key={group.area}
                type="button"
                onClick={() => handleSelectArea(group.area)}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs transition-colors"
                style={{
                  background: isActive ? group.theme.bg : 'transparent',
                  color: isActive ? group.theme.color : '#64748b',
                  fontWeight: isActive ? 700 : 500,
                }}
              >
                <span className="min-w-0 truncate">{group.area}</span>
                <span
                  className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold"
                  style={{
                    background: isActive ? group.theme.color : '#e2e8f0',
                    color: isActive ? '#fff' : '#64748b',
                  }}
                >
                  {group.pages.length}개
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-3 pb-2 pt-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="지표 검색..."
            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-base text-slate-900 outline-none transition focus:border-blue-500 sm:text-sm"
          />
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4 pt-1">
        <div className="space-y-1">
          {filteredPages.map((page) => {
            const group = areaGroups.find((item) => item.area === page.area) ?? selectedGroup;
            const isActive = selectedPage?.slug === page.slug;
            const status = getStatusColors(page.status);

            return (
              <button
                key={page.slug}
                type="button"
                onClick={() => handleSelectPage(page)}
                className="flex w-full items-center gap-2 rounded-[9px] px-2.5 py-2 text-left transition-colors hover:bg-slate-50"
                style={{ background: isActive ? group?.theme.bg : 'transparent' }}
              >
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[10px] font-bold"
                  style={{
                    background: isActive ? group?.theme.color : '#e2e8f0',
                    color: isActive ? '#fff' : '#94a3b8',
                  }}
                >
                  {getPageNumber(page)}
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className="block truncate text-[13px] font-semibold"
                    style={{ color: isActive ? group?.theme.color : '#334155' }}
                  >
                    {page.title.replace(/^\d+\.\s*/, '')}
                  </span>
                  {search.trim() && <span className="mt-0.5 block truncate text-[11px] text-slate-400">{page.area}</span>}
                </span>
                <span
                  className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold"
                  style={{ background: status.bg, color: status.color, border: `1px solid ${status.border}` }}
                >
                  {page.status}
                </span>
              </button>
            );
          })}

          {filteredPages.length === 0 && <p className="py-8 text-center text-xs text-slate-400">검색 결과가 없습니다.</p>}
        </div>
      </nav>
    </>
  );

  if (pages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center bg-slate-50 p-8">
        <div className="max-w-md text-center">
          <FileText className="mx-auto mb-4 h-12 w-12 text-slate-300" />
          <h2 className="mb-2 text-lg font-semibold text-slate-700">평가 지침 파일이 없습니다</h2>
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
      <div className="flex min-h-0 flex-1 overflow-hidden bg-[#f8fbff]">
        <aside className="hidden w-[260px] shrink-0 flex-col overflow-hidden border-r border-slate-100 bg-white/95 md:flex">
          {navigationContent}
        </aside>

        <main className="flex-1 overflow-y-auto px-4 py-5 sm:px-6 md:px-8 md:py-7">
          {selectedPage ? (
            <div className="mx-auto flex max-w-[920px] flex-col gap-6">
              <div className="flex items-center justify-between gap-3 md:hidden">
                <button
                  type="button"
                  onClick={() => setIsMobileIndexOpen(true)}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50"
                >
                  지표 목록
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>

                <span
                  className="max-w-[55%] truncate rounded-full px-3 py-1.5 text-xs font-bold shadow-sm"
                  style={{ background: currentTheme.bg, color: currentTheme.color, border: `1px solid ${currentTheme.border}` }}
                >
                  {selectedPage.area}
                </span>
              </div>

              <header>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span
                    className="rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em]"
                    style={{ background: currentTheme.bg, color: currentTheme.color, border: `1px solid ${currentTheme.border}` }}
                  >
                    주야간보호 {getPageNumber(selectedPage)}
                  </span>
                  <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-500">
                    {selectedPage.area}
                  </span>
                  {selectedPage.updated && (
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold text-amber-800">
                      최종 수정 {selectedPage.updated}
                    </span>
                  )}
                  <span
                    className="ml-auto rounded-full px-3 py-1 text-[11px] font-bold"
                    style={{ background: currentStatus.bg, color: currentStatus.color, border: `1px solid ${currentStatus.border}` }}
                  >
                    {selectedPage.status}
                  </span>
                </div>

                <h1 className="font-brand text-[22px] font-bold leading-tight tracking-[0] text-slate-950 sm:text-2xl">
                  {selectedPage.title}
                </h1>

                {selectedPage.tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    <Tag className="h-3.5 w-3.5 text-slate-400" />
                    {selectedPage.tags.map((tag) => (
                      <span key={tag} className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-500">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {summary && (
                  <div className="mt-4 rounded-[10px] border border-slate-100 bg-slate-50 px-4 py-3 text-[13px] leading-7 text-slate-600">
                    <span className="mr-2 font-bold text-slate-500">▣ 판단 기준</span>
                    {summary}
                  </div>
                )}
              </header>

              <div className="flex flex-col gap-6 pb-8">
                {contentSections.map((section) => {
                  const Icon = getSectionIcon(section.title);
                  const sectionStyle = { '--wiki-color': currentTheme.color } as React.CSSProperties;
                  const sectionClassName = getEvaluationSectionClassName(section.title);
                  const renderedContent = prepareEvaluationSectionMarkdown(section.title, section.content);

                  return (
                    <section
                      key={section.title}
                      className={`evaluation-content-section evaluation-section--${sectionClassName}`}
                      style={sectionStyle}
                    >
                      <div className="mb-3 flex items-center gap-2">
                        <div className="h-4 w-[3px] rounded-full" style={{ background: currentTheme.color }} />
                        <Icon className="h-4 w-4" style={{ color: currentTheme.color }} />
                        <h2 className="text-sm font-bold text-slate-950">▣ {section.title}</h2>
                      </div>
                      <div className="evaluation-markdown" style={sectionStyle}>
                        <ReactMarkdown>{renderedContent}</ReactMarkdown>
                      </div>
                    </section>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-slate-400">
              <p className="text-sm">좌측에서 지표를 선택하세요.</p>
            </div>
          )}
        </main>
      </div>

      {isMobileIndexOpen && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true" aria-label="지표 목록">
          <button
            type="button"
            onClick={() => setIsMobileIndexOpen(false)}
            className="absolute inset-0 bg-slate-950/50"
            aria-label="지표 목록 닫기"
          />

          <div className="absolute inset-x-0 bottom-0 max-h-[84dvh] overflow-hidden rounded-t-[28px] bg-white shadow-2xl">
            <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-slate-200" />

            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">지표 목록</h2>
                <p className="mt-1 text-xs text-slate-500">영역을 고르거나 검색해서 평가 지침을 확인하세요.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileIndexOpen(false)}
                className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                aria-label="지표 목록 닫기"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div
              className="flex max-h-[calc(84dvh-4.5rem)] flex-col"
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
