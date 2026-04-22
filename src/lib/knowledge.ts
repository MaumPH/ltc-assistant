import type { KnowledgeListEntry } from './ragTypes';
import { CATEGORY_ORDER, categorizeKnowledgeFileName, type Category } from './knowledgeCategories';

export { buildContext, searchKnowledge, chunksToContext, getAllChunks, type KnowledgeFile, type Chunk } from './ragCore';
export { CATEGORY_ORDER, type Category } from './knowledgeCategories';

export type KnowledgeSource = 'general' | 'eval';

export interface KnowledgeDocument extends KnowledgeListEntry {
  category: Category;
  displayTitle: string;
  source: KnowledgeSource;
  sourceLabel: string;
}

export type KnowledgeListItem = KnowledgeDocument;

export const SOURCE_LABELS: Record<KnowledgeSource, string> = {
  general: '일반 문서',
  eval: '평가 문서',
};

export function categorize(fileName: string): Category {
  return categorizeKnowledgeFileName(fileName);
}

function getKnowledgeSource(filePath: string, mode?: string): KnowledgeSource {
  if (mode === 'evaluation') return 'eval';
  return /\/knowledge\/(?:eval|evaluation)\//.test(filePath) ? 'eval' : 'general';
}

function toDisplayTitle(fileName: string): string {
  return fileName
    .replace(/\.(md|txt)$/i, '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sortDocuments(a: KnowledgeDocument, b: KnowledgeDocument): number {
  const categoryDiff = CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category);
  if (categoryDiff !== 0) return categoryDiff;

  return a.name.localeCompare(b.name, 'ko');
}

export function mapKnowledgeEntry(entry: KnowledgeListEntry): KnowledgeListItem {
  const source = getKnowledgeSource(entry.path, entry.mode);
  return {
    ...entry,
    category: categorize(entry.name),
    displayTitle: toDisplayTitle(entry.name),
    source,
    sourceLabel: SOURCE_LABELS[source],
  };
}

export async function fetchKnowledgeList(signal?: AbortSignal): Promise<KnowledgeListItem[]> {
  const response = await fetch('/api/knowledge', { signal });
  if (!response.ok) {
    throw new Error(`knowledge list request failed: ${response.status}`);
  }

  const entries = (await response.json()) as KnowledgeListEntry[];
  return entries.map(mapKnowledgeEntry).sort(sortDocuments);
}

export async function fetchKnowledgeFile(filePath: string, signal?: AbortSignal): Promise<string> {
  const response = await fetch(`/api/knowledge/file?path=${encodeURIComponent(filePath)}`, { signal });
  if (!response.ok) {
    throw new Error(`knowledge file request failed: ${response.status}`);
  }
  return response.text();
}
