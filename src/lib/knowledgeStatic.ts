import {
  CATEGORY_ORDER,
  SOURCE_LABELS,
  categorize,
  type Category,
  type KnowledgeListItem,
  type KnowledgeSource,
} from './knowledge';

const allMdModules = import.meta.glob('/knowledge/**/*.md', { query: '?url', import: 'default', eager: true });
const allTxtModules = import.meta.glob('/knowledge/**/*.txt', { query: '?url', import: 'default', eager: true });
const evalMdModules = {
  ...import.meta.glob('/knowledge/eval/**/*.md', { query: '?url', import: 'default', eager: true }),
  ...import.meta.glob('/knowledge/evaluation/**/*.md', { query: '?url', import: 'default', eager: true }),
};
const evalTxtModules = {
  ...import.meta.glob('/knowledge/eval/**/*.txt', { query: '?url', import: 'default', eager: true }),
  ...import.meta.glob('/knowledge/evaluation/**/*.txt', { query: '?url', import: 'default', eager: true }),
};

const allModules: Record<string, unknown> = { ...allMdModules, ...allTxtModules };
const evalModules: Record<string, unknown> = { ...evalMdModules, ...evalTxtModules };

function getKnowledgeSource(filePath: string): KnowledgeSource {
  return /\/knowledge\/(?:eval|evaluation)\//.test(filePath) ? 'eval' : 'general';
}

function toDisplayTitle(fileName: string): string {
  return fileName
    .replace(/\.(md|txt)$/i, '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sortDocuments(a: KnowledgeListItem, b: KnowledgeListItem): number {
  const categoryDiff = CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category);
  if (categoryDiff !== 0) return categoryDiff;

  return a.name.localeCompare(b.name, 'ko');
}

function toKnowledgeListItems(modules: Record<string, unknown>): KnowledgeListItem[] {
  return Object.keys(modules)
    .map((filePath) => {
      const name = filePath.split('/').pop() || filePath;
      const source = getKnowledgeSource(filePath);
      const mode: KnowledgeListItem['mode'] = source === 'eval' ? 'evaluation' : 'integrated';

      return {
        path: filePath,
        name,
        size: 0,
        mode,
        category: categorize(name) as Category,
        displayTitle: toDisplayTitle(name),
        source,
        sourceLabel: SOURCE_LABELS[source],
      };
    })
    .sort(sortDocuments);
}

export const allKnowledgeListItems: KnowledgeListItem[] = toKnowledgeListItems(allModules);
export const evalKnowledgeListItems: KnowledgeListItem[] = toKnowledgeListItems(evalModules);
