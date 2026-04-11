import { toKnowledgeFiles, type KnowledgeFile } from './ragCore';

export { buildContext, searchKnowledge, type KnowledgeFile } from './ragCore';

const rootMdModules = import.meta.glob('/knowledge/*.md', { query: '?raw', import: 'default', eager: true });
const rootTxtModules = import.meta.glob('/knowledge/*.txt', { query: '?raw', import: 'default', eager: true });
const evalMdModules = import.meta.glob('/knowledge/eval/*.md', { query: '?raw', import: 'default', eager: true });
const evalTxtModules = import.meta.glob('/knowledge/eval/*.txt', { query: '?raw', import: 'default', eager: true });

const allModules: Record<string, unknown> = { ...rootMdModules, ...rootTxtModules, ...evalMdModules, ...evalTxtModules };
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
  sizeLabel: string;
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
  if (/평가|매뉴얼|Q&A|사례집/.test(fileName)) return '평가·매뉴얼';
  return '참고자료';
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB'];
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, unitIndex);

  return `${parseFloat(value.toFixed(1))} ${units[unitIndex]}`;
}

function getKnowledgeSource(path: string): KnowledgeSource {
  return path.includes('/knowledge/eval/') ? 'eval' : 'general';
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
  return toKnowledgeFiles(modules)
    .map((file) => {
      const source = getKnowledgeSource(file.path);

      return {
        ...file,
        category: categorize(file.name),
        displayTitle: toDisplayTitle(file.name),
        sizeLabel: formatBytes(file.size),
        source,
        sourceLabel: SOURCE_LABELS[source],
      };
    })
    .sort(sortDocuments);
}

export const allKnowledgeFiles: KnowledgeDocument[] = toKnowledgeDocuments(allModules);
export const evalKnowledgeFiles: KnowledgeDocument[] = toKnowledgeDocuments(evalModules);
