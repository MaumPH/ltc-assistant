import React, { useState } from 'react';
import { FileText, ChevronDown, ChevronRight } from 'lucide-react';
import { allKnowledgeFiles, categorize, formatBytes, CATEGORY_ORDER, type Category } from '../lib/knowledge';

const CATEGORY_ICON: Record<Category, string> = {
  '법률':      '⚖️',
  '시행령':    '📋',
  '시행규칙':  '📄',
  '고시':      '📢',
  '별표·별지': '📎',
  '평가·매뉴얼': '📊',
  '참고자료':  '📚',
};

export default function KnowledgeBaseView() {
  const [openCategories, setOpenCategories] = useState<Set<Category>>(
    new Set(CATEGORY_ORDER) // 기본값: 모두 열림
  );

  const toggleCategory = (cat: Category) => {
    setOpenCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  };

  // 카테고리별 그룹화
  const grouped = CATEGORY_ORDER.reduce<Record<Category, typeof allKnowledgeFiles>>(
    (acc, cat) => {
      acc[cat] = allKnowledgeFiles.filter(f => categorize(f.name) === cat);
      return acc;
    },
    {} as Record<Category, typeof allKnowledgeFiles>
  );

  const total = allKnowledgeFiles.length;
  const totalSize = allKnowledgeFiles.reduce((s, f) => s + f.size, 0);

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-6 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* 헤더 */}
        <div className="mb-6">
          <h1 className="text-xl font-bold text-slate-900 mb-1">지식베이스 문서</h1>
          <p className="text-sm text-slate-500">
            총 {total}개 파일 · {formatBytes(totalSize)}
          </p>
        </div>

        {/* 카테고리별 목록 */}
        <div className="space-y-3">
          {CATEGORY_ORDER.map(cat => {
            const files = grouped[cat];
            if (files.length === 0) return null;
            const isOpen = openCategories.has(cat);
            const catSize = files.reduce((s, f) => s + f.size, 0);

            return (
              <div key={cat} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                {/* 카테고리 헤더 */}
                <button
                  onClick={() => toggleCategory(cat)}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{CATEGORY_ICON[cat]}</span>
                    <div className="text-left">
                      <span className="font-semibold text-slate-800">{cat}</span>
                      <span className="ml-2 text-xs text-slate-400">{files.length}개 · {formatBytes(catSize)}</span>
                    </div>
                  </div>
                  {isOpen
                    ? <ChevronDown className="w-4 h-4 text-slate-400" />
                    : <ChevronRight className="w-4 h-4 text-slate-400" />}
                </button>

                {/* 파일 목록 */}
                {isOpen && (
                  <ul className="border-t border-slate-100 divide-y divide-slate-100">
                    {files.map((file, idx) => (
                      <li key={idx} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors">
                        <FileText className="w-4 h-4 text-blue-400 shrink-0" />
                        <span className="text-sm text-slate-700 flex-1 truncate" title={file.name}>
                          {file.name}
                        </span>
                        <span className="text-xs text-slate-400 shrink-0">{formatBytes(file.size)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
