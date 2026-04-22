export type Category =
  | '법령'
  | '시행령'
  | '시행규칙'
  | '고시'
  | '별표·부표'
  | '평가·매뉴얼'
  | '참고자료';

export interface KnowledgeCategoryCount {
  category: Category;
  count: number;
}

export const CATEGORY_ORDER: Category[] = [
  '법령',
  '시행령',
  '시행규칙',
  '고시',
  '별표·부표',
  '평가·매뉴얼',
  '참고자료',
];

export function categorizeKnowledgeFileName(fileName: string): Category {
  if (/\(법령\)|법\b/u.test(fileName)) return '법령';
  if (/시행령/u.test(fileName)) return '시행령';
  if (/시행규칙|보건복지부령/u.test(fileName)) return '시행규칙';
  if (/^\[(별표|부표)|별표|부표/u.test(fileName)) return '별표·부표';
  if (/\(고시\)|고시/u.test(fileName)) return '고시';
  if (/평가|매뉴얼|Q&A|질의응답|사례집/i.test(fileName)) return '평가·매뉴얼';
  return '참고자료';
}

export function buildKnowledgeCategoryCounts(files: ReadonlyArray<{ name: string }>): KnowledgeCategoryCount[] {
  const counts = new Map<Category, number>(CATEGORY_ORDER.map((category) => [category, 0]));

  for (const file of files) {
    const category = categorizeKnowledgeFileName(file.name);
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }

  return CATEGORY_ORDER.map((category) => ({
    category,
    count: counts.get(category) ?? 0,
  }));
}
