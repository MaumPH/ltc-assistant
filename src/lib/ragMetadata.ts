import type {
  DocumentMetadata,
  EvidenceState,
  KnowledgeFile,
  PromptMode,
  QueryIntent,
  SourceType,
  StructuredChunk,
} from './ragTypes';

const DATE_TOKEN_RE = /\((20\d{2})(\d{2})(\d{2})\)/;
const YEAR_MONTH_RE = /\((20\d{2})\.(\d{1,2})\.?\)/;
const ARTICLE_RE = /(제\s*\d+\s*조(?:의\s*\d+)*)/;
const HASH_SEEDS = [0x811c9dc5, 0x9e3779b9, 0x85ebca6b, 0xc2b2ae35, 0x27d4eb2f];

function hashFragment(input: string, seed: number): string {
  let hashA = seed ^ input.length;
  let hashB = (seed ^ 0x9e3779b9) >>> 0;

  for (let index = 0; index < input.length; index += 1) {
    const code = input.charCodeAt(index);
    hashA = Math.imul(hashA ^ code, 2654435761);
    hashB = Math.imul(hashB ^ code, 1597334677);
  }

  hashA ^= hashA >>> 16;
  hashA = Math.imul(hashA, 2246822507);
  hashA ^= hashA >>> 13;
  hashA = Math.imul(hashA, 3266489909);
  hashA ^= hashA >>> 16;

  hashB ^= hashB >>> 15;
  hashB = Math.imul(hashB, 2246822507);
  hashB ^= hashB >>> 13;
  hashB = Math.imul(hashB, 3266489909);
  hashB ^= hashB >>> 16;

  return (((hashA ^ hashB) >>> 0).toString(16)).padStart(8, '0');
}

export function sha1(input: string): string {
  return HASH_SEEDS.map((seed) => hashFragment(input, seed)).join('');
}

export function normalizeWhitespace(value: string): string {
  return value.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

export function stripExtension(fileName: string): string {
  return fileName.replace(/\.(md|txt)$/i, '');
}

export function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[\s\u3000.,!?;:'"()[\]{}<>\/\\|@#$%^&*+=~`_\-]+/)
    .map((token) => token.replace(/[^\uac00-\ud7a3\u1100-\u11ff\u3130-\u318f\w]/g, ''))
    .filter((token) => token.length >= 2);
}

export function extractArticleNo(value: string): string | undefined {
  const match = value.match(ARTICLE_RE);
  return match?.[1]?.replace(/\s+/g, '');
}

export function extractDateFromFileName(fileName: string): string | undefined {
  const compact = fileName.match(DATE_TOKEN_RE);
  if (compact) {
    return `${compact[1]}-${compact[2]}-${compact[3]}`;
  }

  const yearMonth = fileName.match(YEAR_MONTH_RE);
  if (yearMonth) {
    return `${yearMonth[1]}-${yearMonth[2].padStart(2, '0')}-01`;
  }

  return undefined;
}

export function detectSourceType(fileName: string): SourceType {
  const lowered = fileName.toLowerCase();

  if (lowered.includes('법(') || lowered.includes('법률')) return 'law';
  if (lowered.includes('시행령')) return 'ordinance';
  if (lowered.includes('시행규칙') || lowered.includes('부령')) return 'rule';
  if (lowered.includes('고시')) return 'notice';
  if (lowered.includes('비교표') || lowered.includes('개정전후')) return 'comparison';
  if (
    lowered.includes('q&a') ||
    lowered.includes('qa') ||
    lowered.includes('faq') ||
    lowered.includes('질의응답') ||
    lowered.includes('사례집')
  ) {
    return 'qa';
  }
  if (lowered.includes('매뉴얼') || lowered.includes('운영지침')) return 'manual';
  if (
    lowered.includes('안내') ||
    lowered.includes('바로알기') ||
    lowered.includes('총정리') ||
    lowered.includes('사업안내')
  ) {
    return 'guide';
  }
  if (lowered.includes('index') || lowered.includes('정리본') || lowered.includes('위키')) return 'wiki';
  return 'other';
}

export function toPosixPath(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}

export function detectModeFromPath(filePath: string): PromptMode {
  const normalizedPath = toPosixPath(filePath);
  return normalizedPath.includes('/knowledge/eval/') || normalizedPath.includes('/knowledge/evaluation/')
    ? 'evaluation'
    : 'integrated';
}

export function inferDocumentGroup(fileName: string, sourceType: SourceType): string {
  if (sourceType === 'law' || sourceType === 'ordinance' || sourceType === 'rule' || sourceType === 'notice') {
    return 'legal';
  }
  if (sourceType === 'qa') return 'qa';
  if (sourceType === 'manual') return 'manual';
  if (sourceType === 'comparison') return 'comparison';
  if (sourceType === 'wiki') return 'wiki';
  if (sourceType === 'guide') return 'guide';
  if (fileName.toLowerCase().includes('평가')) return 'evaluation';
  return 'general';
}

export function toDocumentMetadata(file: KnowledgeFile): DocumentMetadata {
  const normalizedPath = toPosixPath(file.path);
  const title = stripExtension(file.name);
  const sourceType = detectSourceType(file.name);
  return {
    documentId: sha1(`${normalizedPath}:${title}`),
    title,
    fileName: file.name,
    path: normalizedPath,
    mode: detectModeFromPath(normalizedPath),
    sourceType,
    effectiveDate: extractDateFromFileName(file.name),
    publishedDate: extractDateFromFileName(file.name),
    documentGroup: inferDocumentGroup(file.name, sourceType),
    articleHint: extractArticleNo(title),
  };
}

export function detectIntent(mode: PromptMode, query: string): QueryIntent {
  const compactQuery = query.replace(/\s+/g, '');
  const lowered = query.toLowerCase();

  if (/(제\s*\d+\s*조(?:의\s*\d+)*)|별표|별지|붙임|시행규칙|시행령|고시|법률|조문/.test(query)) {
    return 'legal-exact';
  }
  if (/개정|전후|비교|충돌|어떻게달라|무엇이다르|차이/.test(query)) {
    return 'synthesis';
  }
  if (/(q&a|qa|faq)/i.test(lowered) || /질문|답변|문의|사례|매뉴얼|지침|어떻게|준비|서류|운영/.test(query)) {
    return 'manual-qna';
  }
  if (mode === 'evaluation' || compactQuery.includes('평가')) {
    return 'evaluation';
  }
  return mode;
}

export function compareIsoDateDesc(a?: string, b?: string): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a < b ? 1 : a > b ? -1 : 0;
}

export function formatEvidenceStateLabel(state: EvidenceState): string {
  switch (state) {
    case 'confirmed':
      return '확정';
    case 'partial':
      return '부분 확정';
    case 'conflict':
      return '충돌';
    case 'not_enough':
      return '확인 불가';
  }
}

export function buildCitationLabel(chunk: StructuredChunk): string {
  const bits = [chunk.docTitle];
  if (chunk.articleNo) bits.push(chunk.articleNo);

  const sectionBits = chunk.sectionPath.filter((part, index) => !(index === 0 && part === chunk.docTitle));
  if (sectionBits.length > 0) {
    bits.push(sectionBits.join(' > '));
  }

  if (chunk.windowIndex > 0) {
    bits.push(`window ${chunk.windowIndex + 1}`);
  }

  if (chunk.effectiveDate) bits.push(chunk.effectiveDate);
  return bits.join(' | ');
}
