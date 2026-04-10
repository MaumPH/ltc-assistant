import React, { useState, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { Search, ChevronRight, ChevronDown, FileText, Tag } from 'lucide-react';

// knowledge/evaluation/*.md 빌드타임 번들
const evalWikiModules = import.meta.glob('/knowledge/evaluation/*.md', { query: '?raw', import: 'default', eager: true });

interface WikiPage {
  slug: string;
  fileName: string;
  title: string;
  area: string;
  status: 'active' | 'revised' | '확인필요';
  updated: string;
  tags: string[];
  body: string;
  raw: string;
}

// YAML frontmatter 파싱
function parsePage(fileName: string, raw: string): WikiPage {
  const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  let title = fileName.replace('.md', '');
  let area = '미분류';
  let status: WikiPage['status'] = 'active';
  let updated = '';
  let tags: string[] = [];
  let body = raw;

  if (fmMatch) {
    const fm = fmMatch[1];
    body = fmMatch[2].trim();

    const get = (key: string) => fm.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'))?.[1]?.trim() ?? '';
    title = get('title') || title;
    area = get('area') || area;
    status = (get('status') as WikiPage['status']) || 'active';
    updated = get('updated') || '';

    const tagsMatch = fm.match(/^tags:\s*\[([^\]]*)\]/m);
    if (tagsMatch) {
      tags = tagsMatch[1].split(',').map(t => t.trim()).filter(Boolean);
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
    raw,
  };
}

const STATUS_STYLE: Record<WikiPage['status'], string> = {
  active:    'bg-green-100 text-green-700',
  revised:   'bg-blue-100 text-blue-700',
  확인필요:  'bg-amber-100 text-amber-700',
};

export default function EvaluationWiki() {
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [openAreas, setOpenAreas] = useState<Set<string>>(new Set());

  const pages = useMemo<WikiPage[]>(() => {
    return Object.entries(evalWikiModules)
      .map(([path, content]) => {
        const fileName = path.split('/').pop() || path;
        return parsePage(fileName, content as string);
      })
      .sort((a, b) => a.slug.localeCompare(b.slug, 'ko'));
  }, []);

  // 영역별 그룹
  const grouped = useMemo(() => {
    const map = new Map<string, WikiPage[]>();
    for (const page of pages) {
      if (!map.has(page.area)) map.set(page.area, []);
      map.get(page.area)!.push(page);
    }
    return map;
  }, [pages]);

  // 검색 필터
  const filtered = useMemo(() => {
    if (!search.trim()) return pages;
    const q = search.toLowerCase();
    return pages.filter(p =>
      p.title.toLowerCase().includes(q) ||
      p.area.toLowerCase().includes(q) ||
      p.tags.some(t => t.toLowerCase().includes(q)) ||
      p.body.toLowerCase().includes(q)
    );
  }, [pages, search]);

  const selectedPage = pages.find(p => p.slug === selectedSlug) ?? pages[0] ?? null;

  const toggleArea = (area: string) => {
    setOpenAreas(prev => {
      const next = new Set(prev);
      if (next.has(area)) next.delete(area); else next.add(area);
      return next;
    });
  };

  if (pages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50 p-8">
        <div className="text-center max-w-md">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-slate-700 mb-2">평가지표 파일이 없습니다</h2>
          <p className="text-sm text-slate-500 leading-relaxed">
            <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">knowledge/evaluation/</code> 폴더에<br />
            지표 파일을 추가하면 여기에 표시됩니다.<br /><br />
            아래 템플릿을 참고해서 작성해 주세요:
          </p>
          <pre className="mt-4 text-left text-xs bg-slate-900 text-slate-200 rounded-xl p-4 overflow-x-auto">
{`---
title: 1-1. 지표명
area: 1영역: 기관 운영
status: active
updated: 2026-04-10
tags: [인력, 배치기준]
---

## 판단 기준
...

## 확정 근거
- 문서명, 조문, 시행일

## 실무 해석
...`}
          </pre>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex min-h-0 bg-slate-50">
      {/* 좌측 인덱스 */}
      <aside className="w-72 bg-white border-r border-slate-200 flex flex-col shrink-0 hidden md:flex">
        {/* 검색 */}
        <div className="p-3 border-b border-slate-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="지표 검색..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* 인덱스 목록 */}
        <nav className="flex-1 overflow-y-auto p-2">
          {search.trim() ? (
            // 검색 결과
            <ul className="space-y-0.5">
              {filtered.map(page => (
                <li key={page.slug}>
                  <button
                    onClick={() => { setSelectedSlug(page.slug); setSearch(''); }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                      selectedSlug === page.slug ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate">{page.title}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${STATUS_STYLE[page.status]}`}>
                        {page.status}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{page.area}</div>
                  </button>
                </li>
              ))}
              {filtered.length === 0 && (
                <p className="text-xs text-slate-400 text-center py-8">검색 결과 없음</p>
              )}
            </ul>
          ) : (
            // 영역별 그룹
            Array.from(grouped.entries()).map(([area, areaPages]) => {
              const isOpen = openAreas.has(area);
              return (
                <div key={area} className="mb-1">
                  <button
                    onClick={() => toggleArea(area)}
                    className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide hover:bg-slate-50 rounded-lg"
                  >
                    <span>{area}</span>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-slate-400 font-normal normal-case">{areaPages.length}개</span>
                      {isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    </div>
                  </button>
                  {isOpen && (
                    <ul className="ml-2 space-y-0.5">
                      {areaPages.map(page => (
                        <li key={page.slug}>
                          <button
                            onClick={() => setSelectedSlug(page.slug)}
                            className={`w-full text-left px-3 py-1.5 rounded-lg text-sm transition-colors ${
                              selectedSlug === page.slug ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="truncate text-[13px]">{page.title}</span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${STATUS_STYLE[page.status]}`}>
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
      </aside>

      {/* 우측 본문 */}
      <main className="flex-1 overflow-y-auto p-6 md:p-8">
        {selectedPage ? (
          <div className="max-w-3xl mx-auto">
            {/* 헤더 */}
            <div className="mb-6 pb-4 border-b border-slate-200">
              <div className="flex items-start justify-between gap-4 mb-2">
                <h1 className="text-xl font-bold text-slate-900">{selectedPage.title}</h1>
                <span className={`text-xs px-2 py-1 rounded-full shrink-0 font-medium ${STATUS_STYLE[selectedPage.status]}`}>
                  {selectedPage.status}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                <span className="bg-slate-100 px-2 py-0.5 rounded">{selectedPage.area}</span>
                {selectedPage.updated && <span>최종 수정: {selectedPage.updated}</span>}
                {selectedPage.tags.length > 0 && (
                  <div className="flex items-center gap-1 flex-wrap">
                    <Tag className="w-3 h-3" />
                    {selectedPage.tags.map(tag => (
                      <span key={tag} className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded">{tag}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 본문 */}
            <div className="prose prose-sm md:prose-base prose-slate max-w-none prose-headings:font-semibold prose-h2:text-base prose-h2:mt-6 prose-a:text-blue-600">
              <ReactMarkdown>{selectedPage.body}</ReactMarkdown>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-slate-400">
            <p className="text-sm">좌측에서 지표를 선택하세요.</p>
          </div>
        )}
      </main>
    </div>
  );
}
