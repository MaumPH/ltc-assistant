import type { KnowledgeFile } from './ragCore';

export { buildContext, searchKnowledge, chunksToContext, getAllChunks, type KnowledgeFile, type Chunk } from './ragCore';

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

export type KnowledgeSource = 'general' | 'eval';

export type Category =
  | '법령'
  | '시행령'
  | '시행규칙'
  | '고시'
  | '별표·별지'
  | '평가·매뉴얼'
  | '참고자료';

export interface KnowledgeDocument extends KnowledgeFile {
  category: Category;
  displayTitle: string;
  source: KnowledgeSource;
  sourceLabel: string;
}

export interface KnowledgeListItem {
  path: string;
  name: string;
  displayTitle: string;
  category: Category;
  source: KnowledgeSource;
  sourceLabel: string;
}

export const CATEGORY_ORDER: Category[] = [
  '법령',
  '시행령',
  '시행규칙',
  '고시',
  '별표·별지',
  '평가·매뉴얼',
  '참고자료',
];

export const SOURCE_LABELS: Record<KnowledgeSource, string> = {
  general: '일반 문서',
  eval: '평가 문서',
};

export function categorize(fileName: string): Category {
  if (/\(법률\)/.test(fileName)) return '법령';
  if (/\(시행령\)/.test(fileName)) return '시행령';
  if (/\(시행규칙\)|보건복지부령/.test(fileName)) return '시행규칙';
  if (/^\[(별표|별지)/.test(fileName)) return '별표·별지';
  if (/\(고시\)/.test(fileName)) return '고시';
  if (/평가|매뉴얼|Q&A|사례집/i.test(fileName)) return '평가·매뉴얼';
  return '참고자료';
}

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

function sortDocuments(a: KnowledgeDocument, b: KnowledgeDocument): number {
  const categoryDiff = CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category);
  if (categoryDiff !== 0) return categoryDiff;

  return a.name.localeCompare(b.name, 'ko');
}

function toKnowledgeDocuments(modules: Record<string, unknown>): KnowledgeDocument[] {
  return Object.keys(modules)
    .map((filePath) => {
      const name = filePath.split('/').pop() || filePath;
      const source = getKnowledgeSource(filePath);

      return {
        path: filePath,
        name,
        size: 0,
        content: '',
        category: categorize(name),
        displayTitle: toDisplayTitle(name),
        source,
        sourceLabel: SOURCE_LABELS[source],
      };
    })
    .sort(sortDocuments);
}

function toKnowledgeListItems(files: KnowledgeDocument[]): KnowledgeListItem[] {
  return files.map(({ path, name, displayTitle, category, source, sourceLabel }) => ({
    path,
    name,
    displayTitle,
    category,
    source,
    sourceLabel,
  }));
}

export const allKnowledgeFiles: KnowledgeDocument[] = toKnowledgeDocuments(allModules);
export const evalKnowledgeFiles: KnowledgeDocument[] = toKnowledgeDocuments(evalModules);
export const allKnowledgeListItems: KnowledgeListItem[] = toKnowledgeListItems(allKnowledgeFiles);
export const evalKnowledgeListItems: KnowledgeListItem[] = toKnowledgeListItems(evalKnowledgeFiles);
