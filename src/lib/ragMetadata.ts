import type {
  DocumentMetadata,
  EvidenceState,
  KnowledgeFile,
  PromptMode,
  QueryIntent,
  SourceRole,
  SourceType,
  StructuredChunk,
} from './ragTypes';

const DATE_TOKEN_RE = /\((20\d{2})(\d{2})(\d{2})\)/;
const YEAR_MONTH_RE = /\((20\d{2})\.(\d{1,2})\.?\)/;
const ARTICLE_RE = /(제\s*\d+\s*조(?:의\s*\d+)*)/;
const LINKED_DOCUMENT_RE = /`([^`\n]+\.(?:md|txt))`/gi;
const HASH_SEEDS = [0x811c9dc5, 0x9e3779b9, 0x85ebca6b, 0xc2b2ae35, 0x27d4eb2f];
const KOREAN_PARTICLE_SUFFIXES = [
  '으로부터',
  '에게서',
  '에서는',
  '으로는',
  '으로도',
  '까지는',
  '부터는',
  '한테서',
  '에게는',
  '에게도',
  '한테는',
  '한테도',
  '으로',
  '에서',
  '에게',
  '한테',
  '부터',
  '까지',
  '처럼',
  '보다',
  '마다',
  '은',
  '는',
  '이',
  '가',
  '을',
  '를',
  '의',
  '에',
  '도',
  '만',
  '과',
  '와',
  '로',
  '나',
  '랑',
].sort((left, right) => right.length - left.length);

const DOMAIN_TOKEN_FRAGMENTS = [
  '직원',
  '인권',
  '침해',
  '교육',
  '보호',
  '대응',
  '지침',
  '권익',
  '폭언',
  '폭행',
  '성희롱',
  '성폭력',
  '고충',
  '수급자',
  '보호자',
  '급여',
  '평가',
  '매뉴얼',
  '주야간보호',
  '재가급여',
  '평가매뉴얼',
  '사례집',
  '개정',
  '비교표',
  '인건비',
  '지출',
  '비율',
  '다빈도',
  '질의응답',
  '장기근속',
  '장려금',
  '청구',
  '전산',
  '기능회복',
  '일상생활',
  '훈련',
  '낙상',
  '욕창',
  '감염',
  '재난',
  '응급',
  '안전',
  '환경',
  '예방',
  '시설',
  '인력',
  '현황',
  '배치',
  '신고',
  '기준',
  '본인부담금',
  '의사소견서',
].sort((left, right) => right.length - left.length);

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

function extractBaseName(filePath: string): string {
  return filePath.replace(/\\/g, '/').split('/').pop() ?? filePath;
}

export function normalizeDocumentTitle(value: string): string {
  return stripExtension(extractBaseName(value)).replace(/\s+/g, '').toLowerCase();
}

function stripKoreanParticle(token: string): string {
  for (const suffix of KOREAN_PARTICLE_SUFFIXES) {
    if (token.length - suffix.length < 2) continue;
    if (token.endsWith(suffix)) {
      return token.slice(0, -suffix.length);
    }
  }

  return token;
}

function addCompoundFragments(token: string, results: Set<string>) {
  if (!/^[\uac00-\ud7a3]+$/.test(token) || token.length < 4) return;

  const fragments = DOMAIN_TOKEN_FRAGMENTS.filter((fragment) => fragment.length < token.length && token.includes(fragment));
  if (fragments.length < 2) return;

  for (const fragment of fragments) {
    results.add(fragment);
  }
}

export function tokenize(value: string): string[] {
  const results = new Set<string>();

  value
    .toLowerCase()
    .split(/[\s\u3000.,!?;:'"()[\]{}<>\/\\|@#$%^&*+=~`_\-]+/)
    .map((token) => token.replace(/[^\uac00-\ud7a3\u1100-\u11ff\u3130-\u318f\w]/g, ''))
    .filter((token) => token.length >= 2)
    .forEach((token) => {
      results.add(token);
      addCompoundFragments(token, results);

      const stripped = stripKoreanParticle(token);
      if (stripped.length >= 2) {
        results.add(stripped);
        addCompoundFragments(stripped, results);
      }
    });

  return Array.from(results);
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

export function extractLinkedDocumentTitles(content: string): string[] {
  const matches = new Set<string>();
  for (const match of content.matchAll(LINKED_DOCUMENT_RE)) {
    const rawTitle = match[1]?.trim();
    if (!rawTitle) continue;
    matches.add(stripExtension(extractBaseName(rawTitle)));
  }
  return Array.from(matches).sort((left, right) => left.localeCompare(right, 'ko'));
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

export function inferSourceRole(params: {
  path: string;
  fileName: string;
  mode: PromptMode;
  sourceType: SourceType;
}): SourceRole {
  const normalizedPath = toPosixPath(params.path);
  const title = stripExtension(params.fileName);

  if (normalizedPath.includes('/knowledge/evaluation/')) {
    return 'routing_summary';
  }

  if (normalizedPath.includes('/knowledge/eval/')) {
    if (params.sourceType === 'manual' && /평가매뉴얼/.test(title)) {
      return 'primary_evaluation';
    }

    if (params.sourceType === 'manual' && /업무의 이해/.test(title)) {
      return 'support_reference';
    }

    if (['qa', 'guide', 'comparison'].includes(params.sourceType)) {
      return 'support_reference';
    }

    return 'primary_evaluation';
  }

  if (['law', 'ordinance', 'rule', 'notice', 'manual', 'guide', 'qa', 'comparison'].includes(params.sourceType)) {
    return 'support_reference';
  }

  if (params.mode === 'evaluation') {
    return 'primary_evaluation';
  }

  return 'general';
}

export function toDocumentMetadata(file: KnowledgeFile): DocumentMetadata {
  const normalizedPath = toPosixPath(file.path);
  const title = stripExtension(file.name);
  const sourceType = detectSourceType(file.name);
  const mode = detectModeFromPath(normalizedPath);
  return {
    documentId: sha1(`${normalizedPath}:${title}`),
    title,
    fileName: file.name,
    path: normalizedPath,
    mode,
    sourceType,
    sourceRole: inferSourceRole({
      path: normalizedPath,
      fileName: file.name,
      mode,
      sourceType,
    }),
    effectiveDate: extractDateFromFileName(file.name),
    publishedDate: extractDateFromFileName(file.name),
    documentGroup: inferDocumentGroup(file.name, sourceType),
    articleHint: extractArticleNo(title),
    linkedDocumentTitles: extractLinkedDocumentTitles(file.content),
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
      return '부분확정';
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

export function buildPreciseCitationLabel(chunk: StructuredChunk): string {
  const bits = [chunk.fileName || chunk.docTitle];
  const sectionBits = chunk.sectionPath.filter((part, index) => !(index === 0 && part === chunk.docTitle));

  if (chunk.articleNo && !sectionBits.includes(chunk.articleNo)) {
    bits.push(chunk.articleNo);
  }

  if (sectionBits.length > 0) {
    bits.push(sectionBits.join(' > '));
  }

  if (chunk.effectiveDate) bits.push(chunk.effectiveDate);
  return bits.join(' | ');
}
