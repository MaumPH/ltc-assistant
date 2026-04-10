import { toKnowledgeFiles, type KnowledgeFile } from './ragCore';
export { buildContext, searchKnowledge, type KnowledgeFile } from './ragCore';

// 통합용: 루트 knowledge 파일
const rootMdModules = import.meta.glob('/knowledge/*.md', { query: '?raw', import: 'default', eager: true });
const rootTxtModules = import.meta.glob('/knowledge/*.txt', { query: '?raw', import: 'default', eager: true });
// 평가용: knowledge/eval/ 폴더
const evalMdModules = import.meta.glob('/knowledge/eval/*.md', { query: '?raw', import: 'default', eager: true });
const evalTxtModules = import.meta.glob('/knowledge/eval/*.txt', { query: '?raw', import: 'default', eager: true });

// 통합용 = 전체 (루트 + eval)
const allModules: Record<string, unknown> = { ...rootMdModules, ...rootTxtModules, ...evalMdModules, ...evalTxtModules };
// 평가용 = eval 폴더만
const evalModules: Record<string, unknown> = { ...evalMdModules, ...evalTxtModules };

// 통합용: 전체 파일 (루트 + eval)
export const allKnowledgeFiles: KnowledgeFile[] = toKnowledgeFiles(allModules);

// 평가용: eval 폴더 파일만
export const evalKnowledgeFiles: KnowledgeFile[] = toKnowledgeFiles(evalModules);

// 카테고리 분류
export type Category =
  | '법률'
  | '시행령'
  | '시행규칙'
  | '고시'
  | '별표·별지'
  | '평가·매뉴얼'
  | '참고자료';

export function categorize(fileName: string): Category {
  if (/\(법률\)/.test(fileName)) return '법률';
  if (/\(시행령\)/.test(fileName)) return '시행령';
  if (/\(시행규칙\)|보건복지부령/.test(fileName)) return '시행규칙';
  if (/\[별표|별지/.test(fileName)) return '별표·별지';
  if (/\(고시\)/.test(fileName)) return '고시';
  if (/평가매뉴얼|평가/.test(fileName)) return '평가·매뉴얼';
  return '참고자료';
}

export const CATEGORY_ORDER: Category[] = [
  '법률', '시행령', '시행규칙', '고시', '별표·별지', '평가·매뉴얼', '참고자료',
];

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
