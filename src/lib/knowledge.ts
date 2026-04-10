// ─────────────────────────────────────────────
// 지식베이스 모듈 및 컨텍스트 빌더
// ─────────────────────────────────────────────

// 전체 .md 파일
const allMdModules = import.meta.glob('/knowledge/*.md', { query: '?raw', import: 'default', eager: true });
// 전체 .txt 파일
const allTxtModules = import.meta.glob('/knowledge/*.txt', { query: '?raw', import: 'default', eager: true });

const allModules: Record<string, unknown> = { ...allMdModules, ...allTxtModules };

// 평가용 파일명 목록
const EVAL_FILES = [
  '2026년 주야간보호 평가매뉴얼(26년꺼만).md',
  '평가 후기.txt',
];

export interface KnowledgeFile {
  path: string;
  name: string;
  size: number;
  content: string;
}

// 전체 파일 목록
export const allKnowledgeFiles: KnowledgeFile[] = Object.entries(allModules).map(([path, content]) => ({
  path,
  name: path.split('/').pop() || path,
  size: (content as string).length,
  content: content as string,
}));

// 평가용 파일 목록
export const evalKnowledgeFiles: KnowledgeFile[] = allKnowledgeFiles.filter(f =>
  EVAL_FILES.some(ef => f.name === ef)
);

// 지식베이스 컨텍스트 빌더 (토큰 한도 적용)
export function buildContext(files: KnowledgeFile[], maxChars = 160_000): string {
  let context = '';
  for (const file of files) {
    const chunk = `\n\n--- Document: ${file.name} ---\n${file.content}\n`;
    if (context.length + chunk.length > maxChars) break;
    context += chunk;
  }
  return context;
}

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
