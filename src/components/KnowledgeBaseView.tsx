import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, FileText } from 'lucide-react';
import { allKnowledgeFiles, categorize, CATEGORY_ORDER, formatBytes, type Category } from '../lib/knowledge';

function getCategoryIcon(category: string) {
  if (category.includes('법')) return '⚖️';
  if (category.includes('시행령')) return '📘';
  if (category.includes('시행규칙')) return '📗';
  if (category.includes('고시')) return '📕';
  if (category.includes('별표') || category.includes('별지')) return '🗂️';
  if (category.includes('평가') || category.includes('매뉴얼')) return '🧭';
  return '📄';
}

export default function KnowledgeBaseView() {
  const [openCategories, setOpenCategories] = useState<Set<Category>>(() => new Set(CATEGORY_ORDER));

  const grouped = useMemo(() => {
    return CATEGORY_ORDER.reduce<Record<Category, typeof allKnowledgeFiles>>((acc, category) => {
      acc[category] = allKnowledgeFiles.filter((file) => categorize(file.name) === category);
      return acc;
    }, {} as Record<Category, typeof allKnowledgeFiles>);
  }, []);

  const total = allKnowledgeFiles.length;
  const totalSize = allKnowledgeFiles.reduce((sum, file) => sum + file.size, 0);

  const toggleCategory = (category: Category) => {
    setOpenCategories((previous) => {
      const next = new Set(previous);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-4 sm:p-6 md:p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6">
          <h1 className="mb-1 text-xl font-bold text-slate-900">지식베이스 문서</h1>
          <p className="text-sm text-slate-500">
            총 {total}개 파일 · {formatBytes(totalSize)}
          </p>
        </div>

        <div className="space-y-3">
          {CATEGORY_ORDER.map((category) => {
            const files = grouped[category];
            if (files.length === 0) return null;

            const isOpen = openCategories.has(category);
            const categorySize = files.reduce((sum, file) => sum + file.size, 0);

            return (
              <div key={category} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <button
                  type="button"
                  onClick={() => toggleCategory(category)}
                  className="flex w-full items-center justify-between px-4 py-3 transition-colors hover:bg-slate-50 sm:px-5 sm:py-4"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{getCategoryIcon(category)}</span>
                    <div className="text-left">
                      <span className="font-semibold text-slate-800">{category}</span>
                      <span className="ml-2 block text-xs text-slate-400 sm:inline">
                        {files.length}개 · {formatBytes(categorySize)}
                      </span>
                    </div>
                  </div>

                  {isOpen ? (
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  )}
                </button>

                {isOpen && (
                  <ul className="divide-y divide-slate-100 border-t border-slate-100">
                    {files.map((file) => (
                      <li
                        key={file.name}
                        className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-slate-50 sm:px-5"
                      >
                        <FileText className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />
                        <div className="min-w-0 flex-1">
                          <span className="block truncate text-sm text-slate-700" title={file.name}>
                            {file.name}
                          </span>
                          <span className="mt-1 block text-xs text-slate-400 sm:hidden">{formatBytes(file.size)}</span>
                        </div>
                        <span className="hidden shrink-0 text-xs text-slate-400 sm:inline">{formatBytes(file.size)}</span>
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
