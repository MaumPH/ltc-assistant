export interface KnowledgeSearchItem {
  path: string;
  name: string;
  displayTitle: string;
  category: string;
  sourceLabel: string;
}

function normalizeSearchText(value: string): string {
  return value
    .normalize('NFC')
    .toLowerCase()
    .replace(/[_()[\]{}"'`~!@#$%^&*+=|\\/:;,.?<>-]+/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

function compactSearchText(value: string): string {
  return normalizeSearchText(value).replace(/[^\p{Letter}\p{Number}]+/gu, '');
}

function splitSearchTerms(query: string): string[] {
  return normalizeSearchText(query)
    .split(' ')
    .map(compactSearchText)
    .filter(Boolean);
}

function buildSearchTarget(item: KnowledgeSearchItem): string {
  return [item.displayTitle, item.name, item.category, item.sourceLabel, item.path].join(' ');
}

export function matchesKnowledgeSearch(item: KnowledgeSearchItem, query: string): boolean {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return true;

  const target = buildSearchTarget(item);
  const normalizedTarget = normalizeSearchText(target);
  const compactTarget = compactSearchText(target);
  const compactQuery = compactSearchText(query);

  if (normalizedTarget.includes(normalizedQuery)) return true;
  if (compactQuery && compactTarget.includes(compactQuery)) return true;

  const terms = splitSearchTerms(query);
  if (terms.length === 0) return true;

  return terms.every((term) => compactTarget.includes(term));
}
