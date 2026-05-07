import { compareIsoDateDesc, detectIntent, extractArticleNo, tokenize } from './ragMetadata';
import { expandCompoundTerms } from './koreanCompounds';
import { ENTITY_ANCHORS, scoreEntityAnchorText } from './entityAnchors';
import { hasQualifierSignal } from './qualifierPatterns';
import { buildQueryExpansionProfile } from './queryIntent';
import { scoreCandidateByPriority, type RetrievalPriorityPolicy } from './retrievalPriority';
import { chunkMatchesSelectedServiceScopes, getEffectiveServiceScopes, isChunkCompatibleWithServiceScopes } from './serviceScopes';
import type {
  ConfidenceLevel,
  NaturalLanguageQueryType,
  ParsedLawReference,
  PromptMode,
  QueryIntent,
  RetrievalPriorityClass,
  SemanticFrame,
  RetrievalStageTrace,
  SearchCandidate,
  SearchCorpusPhaseTimings,
  SearchRun,
  ServiceScopeId,
  SourceRole,
  StructuredChunk,
} from './ragTypes';

export interface RagCorpusIndex {
  chunks: StructuredChunk[];
  chunkById: Map<string, StructuredChunk>;
  chunkOrdinalMap: Map<string, number>;
  chunksByDocumentId: Map<string, StructuredChunk[]>;
  documentLookupEntries: RagDocumentLookupEntry[];
  exactMetadataByChunkId: Map<string, RagExactChunkMetadata>;
  entityAnchorScoresByChunkId: Map<string, Map<string, number>>;
  entityAnchorPostingMap: Map<string, string[]>;
  tokenMap: Map<string, string[]>;
  tokenCountMap: Map<string, number>;
  tfMap: Map<string, Map<string, number>>;
  postingMap: Map<string, Set<string>>;
  dfMap: Map<string, number>;
}

export interface RagDocumentLookupEntry {
  documentId: string;
  representative: StructuredChunk;
  titleCompact: string;
  fileNameCompact: string;
  pathCompact: string;
}

interface RagExactChunkMetadata {
  titleCompact: string;
  fileNameCompact: string;
  sectionCompact: string;
}

export type LexicalScoringCacheEntry = {
  lexicalScore: number;
  matchedTerms: string[];
} | null;

export interface LexicalScoringCache {
  get: (key: string) => LexicalScoringCacheEntry | undefined;
  set: (key: string, value: LexicalScoringCacheEntry) => void;
  getStats: () => {
    hits: number;
    misses: number;
    size: number;
  };
}

export interface SearchDiagnosticsEntry {
  stage: string;
  dbLexicalMs: number;
  vectorMs: number;
  corpusMs: number;
  totalMs: number;
  dbLexicalCandidates: number;
  vectorCandidates: number;
  corpusPhaseTimings?: SearchCorpusPhaseTimings;
}

export interface SearchDiagnosticsCollector {
  record: (entry: SearchDiagnosticsEntry) => void;
}

export interface SearchOptions {
  allowedDocumentIds?: Set<string>;
  documentScoreBoosts?: Map<string, number>;
  chunkScoreBoosts?: Map<string, number>;
  excludedEvidenceRoles?: Set<SourceRole>;
  lawRefs?: ParsedLawReference[];
  queryType?: NaturalLanguageQueryType;
  semanticFrame?: SemanticFrame;
  selectedServiceScopes?: ServiceScopeId[];
  retrievalPriorityClass?: RetrievalPriorityClass;
  retrievalPriorityPolicy?: RetrievalPriorityPolicy;
  evaluationLinked?: boolean;
  precomputedLexicalCandidateChunks?: StructuredChunk[];
  mergePrecomputedLexicalCandidateChunks?: boolean;
  precomputedLexicalCandidates?: SearchCandidate[];
  precomputedVectorCandidates?: SearchCandidate[];
  maxLexicalCandidateChunks?: number;
  maxExactCandidateChunks?: number;
  evaluationAuthorityDriftGuard?: boolean;
  lexicalScoringCache?: LexicalScoringCache;
  searchDiagnosticStage?: string;
  searchDiagnostics?: SearchDiagnosticsCollector;
}

export function createLexicalScoringCache(): LexicalScoringCache {
  const cache = new Map<string, LexicalScoringCacheEntry>();
  let hits = 0;
  let misses = 0;

  return {
    get(key) {
      if (cache.has(key)) {
        hits += 1;
        return cache.get(key);
      }
      misses += 1;
      return undefined;
    },
    set(key, value) {
      cache.set(key, value);
    },
    getStats() {
      return {
        hits,
        misses,
        size: cache.size,
      };
    },
  };
}

const VECTOR_TOP_K = 48;
const FUSED_TOP_K = 24;
const EVIDENCE_TOP_K = 18;
const CHECKLIST_EVIDENCE_TOP_K = 22;
const MAX_EVIDENCE_CLUSTERS_PER_DOCUMENT = 2;
const CHECKLIST_MAX_EVIDENCE_CLUSTERS_PER_DOCUMENT = 3;
const MAX_WINDOWS_PER_CLUSTER = 2;
const MAX_VISIBLE_CANDIDATES_PER_DOCUMENT = 3;
const CHECKLIST_MAX_VISIBLE_CANDIDATES_PER_DOCUMENT = 4;
const MAX_VISIBLE_CANDIDATES_PER_PARENT_SECTION = 1;
const RRF_K = 50;
const CANDIDATE_METADATA_TERMS = new Set([
  'document-title',
  'legal-source',
  'manual-source',
  'synthesis-source',
  'evaluation-mode',
  'evaluation-indicator',
  'date-match',
]);
const FOOD_PREFERENCE_EVALUATION_MATCH_RE = /기피식품|식사만족도|식사만족|대체식품|욕구사정|식사간식/u;

const DOCUMENT_QUERY_NOISE_TERMS = [
  '문서를찾아줘',
  '문서찾아줘',
  '문서를보여줘',
  '문서보여줘',
  '문서를',
  '문서',
  '우선근거로잡아줘',
  '우선',
  '먼저',
  '찾아줘',
  '보여줘',
  '기준으로설명해줘',
  '설명해줘',
  '근거를찾아줘',
  '근거',
  '확인하나요',
  '확인',
];

const GENERIC_QUERY_TERMS = new Set([
  '장기요양',
  '장기요양기관',
  '요양기관',
  '기관',
  '급여',
  '제공',
  '기준',
  '방법',
  '운영',
  '업무',
  '평가',
  '문서',
  '자료',
  '안내',
  '지침',
  '이용',
  '가능',
  '관련',
  '요양',
  '시설',
  '내용',
  '대상',
  '질문',
  '사용',
  '비용',
  '청구',
  '청구할',
  '수있나요',
  '있나요',
  '되나요',
  '하나요',
  '알려줘',
  '알려주세요',
  '설명해줘',
  '설명해주세요',
  '설명해',
  '대해',
  '조사',
  '조사에',
  '찾아줘',
  '찾아주세요',
  '어떤',
  '누가',
  '언제',
  '어떻게',
  '어떡해',
  '뭐',
  '뭘',
  '뭐야',
  '뭐예요',
  '무엇',
  '무엇인가',
  '무슨',
  '뜻',
  '정의',
  '개념',
  '설명',
  '이게',
  '이거',
  '이렇게',
  '해',
  '하면',
  '해도',
  '해야',
  '돼',
  '되',
  '되나',
  '준비해',
  '필요해',
  '챙겨',
  '챙겨야',
  '준비물',
  '체크리스트',
]);

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let index = 0; index < a.length; index += 1) {
    dot += a[index] * b[index];
    normA += a[index] * a[index];
    normB += b[index] * b[index];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-10);
}

function compactForMetadata(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\uac00-\ud7a3\u1100-\u11ff\u3130-\u318f0-9a-z]+/gi, '');
}

function stripDocumentQueryNoise(value: string): string {
  return DOCUMENT_QUERY_NOISE_TERMS.reduce(
    (current, term) => current.split(compactForMetadata(term)).join(''),
    value,
  );
}

function hasExplicitDocumentLookupSignal(query: string): boolean {
  return /(document|manual|guide|file|form|찾아|찾아줘|확인|어디|문서|자료|매뉴얼|서식|바로알기|보여|근거)/iu.test(query);
}

function titleMatchesDocumentLookupProbe(entry: RagDocumentLookupEntry, probe: string): boolean {
  if (probe.length < 4) return false;

  const titleCandidates = [entry.titleCompact, entry.fileNameCompact, entry.pathCompact]
    .filter((value) => value.length >= 4)
    .sort((left, right) => right.length - left.length);

  return titleCandidates.some((candidateTitle) => {
    if (candidateTitle === probe) return true;
    if (probe.length >= 8 && candidateTitle.includes(probe)) return true;
    return candidateTitle.length >= 8 && probe.includes(candidateTitle);
  });
}

function resolveDocumentFastPathDocumentIds(
  index: RagCorpusIndex,
  query: string,
  mode: PromptMode,
  options?: SearchOptions,
): Set<string> | null {
  if (options?.allowedDocumentIds) return null;
  const expansionProfile = buildQueryExpansionProfile(query);
  if (expansionProfile.enumeration) return null;
  if (!hasExplicitDocumentLookupSignal(query)) return null;

  const compactQuery = compactForMetadata(query);
  const documentQueryProbe = stripDocumentQueryNoise(compactQuery);
  if (documentQueryProbe.length < 4) return null;

  const matchedDocumentIds = new Set<string>();
  for (const entry of index.documentLookupEntries) {
    if (!isChunkInScope(entry.representative, mode)) continue;
    if (titleMatchesDocumentLookupProbe(entry, documentQueryProbe)) {
      matchedDocumentIds.add(entry.documentId);
    }
  }

  if (matchedDocumentIds.size === 0 || matchedDocumentIds.size > 4) return null;
  return matchedDocumentIds;
}

export function buildRagCorpusIndex(chunks: StructuredChunk[]): RagCorpusIndex {
  const chunkById = new Map<string, StructuredChunk>();
  const chunkOrdinalMap = new Map<string, number>();
  const chunksByDocumentId = new Map<string, StructuredChunk[]>();
  const representatives = new Map<string, StructuredChunk>();
  const exactMetadataByChunkId = new Map<string, RagExactChunkMetadata>();
  const entityAnchorScoresByChunkId = new Map<string, Map<string, number>>();
  const entityAnchorPostingSets = new Map<string, Set<string>>();
  const tokenMap = new Map<string, string[]>();
  const tokenCountMap = new Map<string, number>();
  const tfMap = new Map<string, Map<string, number>>();
  const postingMap = new Map<string, Set<string>>();
  const dfMap = new Map<string, number>();

  for (const [chunkOrdinal, chunk] of chunks.entries()) {
    chunkById.set(chunk.id, chunk);
    chunkOrdinalMap.set(chunk.id, chunkOrdinal);
    exactMetadataByChunkId.set(chunk.id, {
      titleCompact: compactForMetadata(chunk.docTitle),
      fileNameCompact: compactForMetadata(chunk.fileName),
      sectionCompact: compactForMetadata(chunk.sectionPath.join(' ')),
    });
    const documentChunks = chunksByDocumentId.get(chunk.documentId) ?? [];
    documentChunks.push(chunk);
    chunksByDocumentId.set(chunk.documentId, documentChunks);
    if (!representatives.has(chunk.documentId)) {
      representatives.set(chunk.documentId, chunk);
    }

    const entityAnchorSearchText = `${chunk.title}\n${chunk.parentSectionTitle}\n${chunk.searchText}\n${chunk.text}`;
    const entityAnchorScores = new Map<string, number>();
    for (const anchor of ENTITY_ANCHORS) {
      const score = scoreEntityAnchorText(entityAnchorSearchText, anchor.id);
      if (score <= 0) continue;
      entityAnchorScores.set(anchor.id, score);
      const postings = entityAnchorPostingSets.get(anchor.id) ?? new Set<string>();
      postings.add(chunk.id);
      entityAnchorPostingSets.set(anchor.id, postings);
    }
    if (entityAnchorScores.size > 0) {
      entityAnchorScoresByChunkId.set(chunk.id, entityAnchorScores);
    }

    const tokens = tokenize(`${chunk.searchText}\n${chunk.embeddingInput ?? ''}`);
    tokenMap.set(chunk.id, tokens);
    tokenCountMap.set(chunk.id, tokens.length);
    const frequencies = new Map<string, number>();
    for (const token of tokens) {
      frequencies.set(token, (frequencies.get(token) ?? 0) + 1);
    }
    tfMap.set(chunk.id, frequencies);
    for (const token of frequencies.keys()) {
      dfMap.set(token, (dfMap.get(token) ?? 0) + 1);
      const postings = postingMap.get(token) ?? new Set<string>();
      postings.add(chunk.id);
      postingMap.set(token, postings);
    }
  }

  const documentLookupEntries = Array.from(representatives.entries()).map(([documentId, representative]) => ({
    documentId,
    representative,
    titleCompact: compactForMetadata(representative.docTitle),
    fileNameCompact: compactForMetadata(representative.fileName),
    pathCompact: compactForMetadata(representative.path),
  }));
  const entityAnchorPostingMap = new Map(
    Array.from(entityAnchorPostingSets.entries()).map(([anchorId, chunkIds]) => [anchorId, Array.from(chunkIds)]),
  );

  return {
    chunks,
    chunkById,
    chunkOrdinalMap,
    chunksByDocumentId,
    documentLookupEntries,
    exactMetadataByChunkId,
    entityAnchorScoresByChunkId,
    entityAnchorPostingMap,
    tokenMap,
    tokenCountMap,
    tfMap,
    postingMap,
    dfMap,
  };
}

function createCandidate(chunk: StructuredChunk): SearchCandidate {
  return {
    ...chunk,
    exactScore: 0,
    lexicalScore: 0,
    vectorScore: 0,
    fusedScore: 0,
    rerankScore: 0,
    headingScore: 0,
    ontologyScore: 0,
    matchedTerms: [],
  };
}

function isChunkInScope(chunk: StructuredChunk, mode: PromptMode, options?: SearchOptions): boolean {
  if (options?.allowedDocumentIds) {
    return options.allowedDocumentIds.has(chunk.documentId);
  }

  return mode !== 'evaluation' || chunk.mode === 'evaluation';
}

function scopedChunks(index: RagCorpusIndex, mode: PromptMode, options?: SearchOptions): StructuredChunk[] {
  if (!options?.allowedDocumentIds) return index.chunks;

  return Array.from(options.allowedDocumentIds)
    .flatMap((documentId) => index.chunksByDocumentId.get(documentId) ?? [])
    .filter((chunk) => isChunkInScope(chunk, mode, options));
}

function chunkHasAnyToken(index: RagCorpusIndex, chunkId: string, tokenSet: Set<string>): boolean {
  const chunkTokens = index.tokenMap.get(chunkId);
  if (!chunkTokens) return false;
  return chunkTokens.some((token) => tokenSet.has(token));
}

function lexicalCandidateChunks(
  index: RagCorpusIndex,
  tokens: string[],
  mode: PromptMode,
  options?: SearchOptions,
): StructuredChunk[] {
  const tokenSet = new Set(tokens);
  const candidateLimit = options?.maxLexicalCandidateChunks ?? Number.POSITIVE_INFINITY;

  if (options?.allowedDocumentIds) {
    const candidateIds = new Set<string>();
    const rareFirstTokens = [...tokens].sort((left, right) => {
      const leftDf = index.dfMap.get(left) ?? Number.MAX_SAFE_INTEGER;
      const rightDf = index.dfMap.get(right) ?? Number.MAX_SAFE_INTEGER;
      return leftDf - rightDf;
    });

    for (const token of rareFirstTokens) {
      for (const chunkId of index.postingMap.get(token) ?? []) {
        const chunk = index.chunkById.get(chunkId);
        if (chunk && isChunkInScope(chunk, mode, options)) {
          candidateIds.add(chunkId);
        }
      }
    }

    const scoped = Array.from(candidateIds)
      .map((chunkId) => index.chunkById.get(chunkId))
      .filter((chunk): chunk is StructuredChunk => Boolean(chunk))
      .sort(
        (left, right) =>
          (index.chunkOrdinalMap.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
          (index.chunkOrdinalMap.get(right.id) ?? Number.MAX_SAFE_INTEGER),
      );
    return Number.isFinite(candidateLimit) ? scoped.slice(0, candidateLimit) : scoped;
  }

  const candidateIds = new Set<string>();
  const rareFirstTokens = [...tokens].sort((left, right) => {
    const leftDf = index.dfMap.get(left) ?? Number.MAX_SAFE_INTEGER;
    const rightDf = index.dfMap.get(right) ?? Number.MAX_SAFE_INTEGER;
    return leftDf - rightDf;
  });

  for (const token of rareFirstTokens) {
    for (const chunkId of index.postingMap.get(token) ?? []) {
      if (candidateIds.size >= candidateLimit) break;
      candidateIds.add(chunkId);
    }
    if (candidateIds.size >= candidateLimit) break;
  }

  return Array.from(candidateIds)
    .map((chunkId) => index.chunkById.get(chunkId))
    .filter((chunk): chunk is StructuredChunk => Boolean(chunk) && isChunkInScope(chunk, mode, options));
}

function resolveLexicalCandidateChunks(
  index: RagCorpusIndex,
  tokens: string[],
  tokenSet: Set<string>,
  mode: PromptMode,
  options?: SearchOptions,
): StructuredChunk[] {
  if (options?.precomputedLexicalCandidateChunks) {
    const precomputedChunks = options.precomputedLexicalCandidateChunks
      .filter((chunk) => isChunkInScope(chunk, mode, options))
      .filter((chunk) => tokens.length === 0 || chunkHasAnyToken(index, chunk.id, tokenSet));
    if (!options.mergePrecomputedLexicalCandidateChunks) return precomputedChunks;

    const merged = new Map<string, StructuredChunk>();
    for (const chunk of lexicalCandidateChunks(index, tokens, mode, options)) {
      merged.set(chunk.id, chunk);
    }
    for (const chunk of precomputedChunks) {
      merged.set(chunk.id, chunk);
    }
    return Array.from(merged.values());
  }

  return lexicalCandidateChunks(index, tokens, mode, options);
}

function exactCandidateChunks(
  index: RagCorpusIndex,
  query: string,
  tokens: string[],
  mode: PromptMode,
  options?: SearchOptions,
  lexicalChunkPool?: StructuredChunk[],
): StructuredChunk[] {
  const limitExactChunks = (chunks: StructuredChunk[]) => {
    const limit = options?.maxExactCandidateChunks ?? Number.POSITIVE_INFINITY;
    return Number.isFinite(limit) && limit > 0 ? chunks.slice(0, limit) : chunks;
  };

  if (options?.precomputedLexicalCandidateChunks) {
    return limitExactChunks(lexicalChunkPool ?? []);
  }

  if (lexicalChunkPool) {
    return limitExactChunks(lexicalChunkPool.length > 0 ? lexicalChunkPool : scopedChunks(index, mode, options));
  }

  if (!Number.isFinite(options?.maxLexicalCandidateChunks ?? Number.POSITIVE_INFINITY)) {
    return limitExactChunks(scopedChunks(index, mode, options));
  }

  if (tokens.length === 0) return limitExactChunks(scopedChunks(index, mode, options));
  const candidates = lexicalChunkPool ?? lexicalCandidateChunks(index, tokens, mode, options);
  return limitExactChunks(candidates.length > 0 ? candidates : scopedChunks(index, mode, options));
}

function boostCandidate(base: SearchCandidate, patch: Partial<SearchCandidate>): SearchCandidate {
  return {
    ...base,
    ...patch,
    matchedTerms: patch.matchedTerms ?? base.matchedTerms,
  };
}

export function queryTokens(query: string): string[] {
  return Array.from(new Set(tokenize(query)));
}

export function deriveFocusTerms(query: string): string[] {
  return Array.from(
    new Set([
      ...queryTokens(query).filter((token) => !GENERIC_QUERY_TERMS.has(token)),
      ...expandCompoundTerms(query).filter((term) => !GENERIC_QUERY_TERMS.has(term)),
    ]),
  );
}

export function isGenericQueryTerm(term: string): boolean {
  return GENERIC_QUERY_TERMS.has(term);
}

export function isDocumentCapDiagnosticTerm(term: string): boolean {
  return term === 'document-cap';
}

export function getCandidateFocusMatches(candidate: StructuredChunk, focusTerms: string[]): string[] {
  const searchText = candidate.searchText.toLowerCase();
  return focusTerms.filter((term) => searchText.includes(term.toLowerCase()));
}

function scoreAliasMetadata(
  alias: { raw: string; compact: string },
  titleCompact: string,
  sectionCompact: string,
  matchedTerms: Set<string>,
): number {
  const aliasCompact = alias.compact;
  if (aliasCompact.length < 2) return 0;

  if (titleCompact.includes(aliasCompact)) {
    matchedTerms.add(alias.raw);
    return 30;
  }

  if (sectionCompact.includes(aliasCompact)) {
    matchedTerms.add(alias.raw);
    return 18;
  }

  return 0;
}

function compact(value: string): string {
  return value.replace(/\s+/g, '').toLowerCase();
}

function queryDebugHash(query: string): string {
  let hash = 0;
  for (let index = 0; index < query.length; index += 1) {
    hash = (hash * 31 + query.charCodeAt(index)) >>> 0;
  }
  return hash.toString(16);
}

function debugRecallStage(stage: 'fusion' | 'evidence', query: string, candidates: SearchCandidate[]): void {
  if (process.env.RAG_DEBUG !== '1') return;

  console.debug('[recall-audit]', {
    queryHash: queryDebugHash(query),
    stage,
    query,
    candidates: candidates.map((candidate) => ({
      docTitle: candidate.docTitle,
      articleNo: candidate.articleNo,
      parentSectionTitle: candidate.parentSectionTitle,
      fusedScore: Number(candidate.fusedScore.toFixed(4)),
      rerankScore: Number(candidate.rerankScore.toFixed(2)),
      forcedByEntity: candidate.forcedByEntity === true,
      entityAnchorId: candidate.entityAnchorId,
    })),
  });
}

function scoreLawReference(
  chunk: StructuredChunk,
  lawRef: ParsedLawReference & { canonicalLawCompact?: string },
  titleCompact: string,
  sectionCompact: string,
  matchedTerms: Set<string>,
): number {
  let score = 0;
  const lawCompact = lawRef.canonicalLawCompact ?? compact(lawRef.canonicalLawName);

  if (lawCompact && titleCompact.includes(lawCompact)) {
    score += 38;
    matchedTerms.add(lawRef.canonicalLawName);
  } else if (lawCompact && sectionCompact.includes(lawCompact)) {
    score += 20;
    matchedTerms.add(lawRef.canonicalLawName);
  }

  if (lawRef.article && chunk.articleNo === lawRef.article) {
    score += 52;
    matchedTerms.add(lawRef.article);
  } else if (lawRef.article && chunk.searchText.includes(lawRef.article)) {
    score += 22;
    matchedTerms.add(lawRef.article);
  }

  if (lawRef.clause && chunk.text.includes(`제${lawRef.clause}항`)) {
    score += 8;
    matchedTerms.add(`제${lawRef.clause}항`);
  }

  if (lawRef.item && chunk.text.includes(`제${lawRef.item}호`)) {
    score += 6;
    matchedTerms.add(`제${lawRef.item}호`);
  }

  return score;
}

interface ExactScoringContext {
  compactQuery: string;
  documentQueryProbe: string;
  queryArticle?: string;
  queryTokens: Array<{ raw: string; compact: string }>;
  queryDateProbe?: string;
  queryAliases: Array<{ raw: string; compact: string }>;
  lawRefs: Array<ParsedLawReference & { canonicalLawCompact: string }>;
  intentSourceSignal?: {
    sourceTypes: Set<string>;
    score: number;
    matchedTerm: string;
  };
  modeEvaluation: boolean;
}

function buildExactIntentSourceSignal(intent: QueryIntent): ExactScoringContext['intentSourceSignal'] {
  if (intent === 'legal-exact') {
    return {
      sourceTypes: new Set(['law', 'ordinance', 'rule', 'notice']),
      score: 8,
      matchedTerm: 'legal-source',
    };
  }
  if (intent === 'manual-qna') {
    return {
      sourceTypes: new Set(['manual', 'qa', 'guide', 'wiki']),
      score: 8,
      matchedTerm: 'manual-source',
    };
  }
  if (intent === 'synthesis') {
    return {
      sourceTypes: new Set(['comparison', 'qa', 'manual', 'notice']),
      score: 4,
      matchedTerm: 'synthesis-source',
    };
  }
  return undefined;
}

function buildExactScoringContext(
  query: string,
  queryAliases: string[],
  intent: QueryIntent,
  mode: PromptMode,
  lawRefs: ParsedLawReference[] = [],
): ExactScoringContext {
  const compactQuery = compactForMetadata(query);
  const queryDateMatch = query.match(/20\d{2}[.\-/]\d{1,2}(?:[.\-/]\d{1,2})?/);
  return {
    compactQuery,
    documentQueryProbe: stripDocumentQueryNoise(compactQuery),
    queryArticle: extractArticleNo(query),
    queryTokens: queryTokens(query).map((token) => ({ raw: token, compact: compactForMetadata(token) })),
    queryDateProbe: queryDateMatch?.[0].replace(/[^\d]/g, '').slice(0, 6),
    queryAliases: queryAliases.map((alias) => ({ raw: alias, compact: compactForMetadata(alias) })),
    lawRefs: lawRefs.map((lawRef) => ({
      ...lawRef,
      canonicalLawCompact: compact(lawRef.canonicalLawName),
    })),
    intentSourceSignal: buildExactIntentSourceSignal(intent),
    modeEvaluation: mode === 'evaluation',
  };
}

function scoreExact(
  chunk: StructuredChunk,
  context: ExactScoringContext,
  metadata: RagExactChunkMetadata,
): SearchCandidate | null {
  const {
    compactQuery,
    documentQueryProbe,
    queryArticle,
    queryAliases,
    queryDateProbe,
    lawRefs,
    intentSourceSignal,
    modeEvaluation,
  } = context;
  const { titleCompact, fileNameCompact, sectionCompact } = metadata;
  const matchedTerms = new Set<string>();
  let score = 0;

  if (compactQuery.length >= 4 && titleCompact.includes(compactQuery)) {
    score += 28;
    matchedTerms.add('document-title');
  }

  if (
    documentQueryProbe.length >= 4 &&
    [titleCompact, fileNameCompact].some(
      (candidateTitle) =>
        candidateTitle.includes(documentQueryProbe) ||
        (candidateTitle.length >= 4 && documentQueryProbe.includes(candidateTitle)),
    )
  ) {
    score += 34;
    matchedTerms.add('document-title');
  }

  if (queryArticle && chunk.articleNo === queryArticle) {
    score += 40;
    matchedTerms.add(queryArticle);
  } else if (queryArticle && chunk.searchText.includes(queryArticle)) {
    score += 18;
    matchedTerms.add(queryArticle);
  }

  for (const token of context.queryTokens) {
    const compactToken = token.compact;
    if (compactToken && titleCompact.includes(compactToken)) {
      score += 6;
      matchedTerms.add(token.raw);
    }
    if (compactToken && sectionCompact.includes(compactToken)) {
      score += 4;
      matchedTerms.add(token.raw);
    }
  }

  for (const alias of queryAliases) {
    score += scoreAliasMetadata(alias, titleCompact, sectionCompact, matchedTerms);
  }

  for (const lawRef of lawRefs) {
    score += scoreLawReference(chunk, lawRef, titleCompact, sectionCompact, matchedTerms);
  }

  if (intentSourceSignal?.sourceTypes.has(chunk.sourceType)) {
    score += intentSourceSignal.score;
    matchedTerms.add(intentSourceSignal.matchedTerm);
  }

  if (modeEvaluation && chunk.mode === 'evaluation') {
    score += 6;
    matchedTerms.add('evaluation-mode');
  }

  if (
    queryDateProbe &&
    chunk.effectiveDate &&
    queryDateProbe === chunk.effectiveDate.replace(/-/g, '').slice(0, 6)
  ) {
    score += 10;
    matchedTerms.add('date-match');
  }

  if (score <= 0) return null;

  return boostCandidate(createCandidate(chunk), {
    exactScore: score,
    matchedTerms: Array.from(matchedTerms),
  });
}

function compareExactCandidateRank(left: SearchCandidate, right: SearchCandidate): number {
  const scoreDiff = right.exactScore - left.exactScore;
  return scoreDiff !== 0 ? scoreDiff : compareIsoDateDesc(left.effectiveDate, right.effectiveDate);
}

function insertBoundedExactCandidate(
  candidates: SearchCandidate[],
  candidate: SearchCandidate,
  limit: number,
): void {
  if (limit <= 0) return;

  const insertAt = candidates.findIndex((existing) => compareExactCandidateRank(candidate, existing) < 0);
  if (insertAt === -1) {
    if (candidates.length < limit) candidates.push(candidate);
    return;
  }

  candidates.splice(insertAt, 0, candidate);
  if (candidates.length > limit) candidates.pop();
}

interface LexicalScoringContext {
  rawTokens: string[];
  tokens: Array<{ raw: string; idf: number }>;
  tokenSignature: string;
}

function buildLexicalScoringContext(index: RagCorpusIndex, tokens: string[]): LexicalScoringContext {
  const corpusSize = index.chunks.length;
  const scoringTokens = tokens.map((token) => {
    const df = index.dfMap.get(token) ?? 0;
    return {
      raw: token,
      idf: df > 0 ? Math.log((corpusSize + 1) / (df + 1)) + 1 : 0,
    };
  });

  return {
    rawTokens: tokens,
    tokens: scoringTokens,
    tokenSignature: scoringTokens.map((token) => `${token.raw}:${token.idf.toFixed(8)}`).join('|'),
  };
}

function buildLexicalScoringCacheKey(
  index: RagCorpusIndex,
  context: LexicalScoringContext,
  chunk: StructuredChunk,
): string {
  return [index.chunks.length, chunk.id, chunk.chunkHash, context.tokenSignature].join('::');
}

function computeLexicalScoringEntry(
  index: RagCorpusIndex,
  context: LexicalScoringContext,
  chunk: StructuredChunk,
): LexicalScoringCacheEntry {
  const total = index.tokenCountMap.get(chunk.id) || 1;
  const tfMap = index.tfMap.get(chunk.id);
  if (!tfMap) return null;

  let score = 0;
  const matchedTerms = new Set<string>();
  for (const token of context.tokens) {
    const tf = (tfMap.get(token.raw) ?? 0) / total;
    if (token.idf > 0 && tf > 0) {
      score += tf * token.idf;
      matchedTerms.add(token.raw);
    }
  }

  return score > 0
    ? {
        lexicalScore: score,
        matchedTerms: Array.from(matchedTerms),
      }
    : null;
}

function scoreLexical(
  index: RagCorpusIndex,
  context: LexicalScoringContext,
  mode: PromptMode,
  options?: SearchOptions,
  limit = FUSED_TOP_K,
  lexicalChunkPool?: StructuredChunk[],
): SearchCandidate[] {
  if (context.rawTokens.length === 0) return [];

  const scored: SearchCandidate[] = [];
  const lexicalScoringCache = options?.lexicalScoringCache;

  for (const chunk of lexicalChunkPool ?? lexicalCandidateChunks(index, context.rawTokens, mode, options)) {
    const cacheKey = lexicalScoringCache ? buildLexicalScoringCacheKey(index, context, chunk) : '';
    let scoringEntry = lexicalScoringCache?.get(cacheKey);
    if (scoringEntry === undefined) {
      scoringEntry = computeLexicalScoringEntry(index, context, chunk);
      lexicalScoringCache?.set(cacheKey, scoringEntry);
    }

    if (scoringEntry) {
      const candidate = createCandidate(chunk);
      scored.push(
        boostCandidate(candidate, {
          lexicalScore: scoringEntry.lexicalScore,
          matchedTerms: scoringEntry.matchedTerms,
        }),
      );
    }
  }

  return scored.sort((left, right) => right.lexicalScore - left.lexicalScore).slice(0, limit);
}

function scoreVector(
  index: RagCorpusIndex,
  queryEmbedding: number[] | null,
  mode: PromptMode,
  options?: SearchOptions,
): SearchCandidate[] {
  if (!queryEmbedding) return [];

  const scored: SearchCandidate[] = [];
  for (const chunk of scopedChunks(index, mode, options)) {
    if (!isChunkInScope(chunk, mode, options)) continue;
    if (!chunk.embedding || chunk.embedding.length === 0) continue;
    const candidate = createCandidate(chunk);
    const vectorScore = cosineSimilarity(queryEmbedding, chunk.embedding);
    if (vectorScore > 0) {
      scored.push(boostCandidate(candidate, { vectorScore }));
    }
  }

  return scored.sort((left, right) => right.vectorScore - left.vectorScore).slice(0, VECTOR_TOP_K);
}

function reciprocalRankFuse(lists: SearchCandidate[][]): SearchCandidate[] {
  const merged = new Map<string, SearchCandidate>();

  lists.forEach((list) => {
    list.forEach((candidate, index) => {
      const existing = merged.get(candidate.id) ?? candidate;
      const fusedScore = (existing.fusedScore ?? 0) + 1 / (RRF_K + index + 1);
      const matchedTerms = Array.from(new Set([...(existing.matchedTerms ?? []), ...(candidate.matchedTerms ?? [])]));
      merged.set(candidate.id, {
        ...existing,
        exactScore: Math.max(existing.exactScore, candidate.exactScore),
        lexicalScore: Math.max(existing.lexicalScore, candidate.lexicalScore),
        vectorScore: Math.max(existing.vectorScore, candidate.vectorScore),
        fusedScore,
        matchedTerms,
      });
    });
  });

  return Array.from(merged.values()).sort((left, right) => right.fusedScore - left.fusedScore);
}

function extractCandidateYear(candidate: SearchCandidate): number | null {
  const source = [candidate.docTitle, candidate.fileName, candidate.effectiveDate, candidate.publishedDate]
    .filter(Boolean)
    .join(' ');
  const match = source.match(/\b(20\d{2})\b/);
  return match ? Number.parseInt(match[1], 10) : null;
}

function scoreEvaluationAuthority(candidate: SearchCandidate): number {
  const haystack = `${candidate.docTitle} ${candidate.fileName} ${candidate.parentSectionTitle}`.toLowerCase();
  const currentYear = new Date().getFullYear();
  const year = extractCandidateYear(candidate);
  let score = 0;

  if (candidate.sourceRole === 'primary_evaluation') score += 28;
  if (candidate.sourceRole === 'support_reference') score += 8;
  if (candidate.sourceRole === 'routing_summary') score -= 32;

  if (/평가매뉴얼/u.test(haystack)) score += 20;
  if (candidate.sourceRole === 'primary_evaluation' && candidate.path.includes('/knowledge/eval/') && /평가매뉴얼/u.test(haystack)) {
    score += 90;
  }
  if (candidate.sourceRole === 'primary_evaluation' && candidate.path.includes('/knowledge/evaluation/')) {
    score -= 72;
  }
  if (/q&a|qa|질의응답/u.test(haystack)) score -= 10;
  if (/사례집/u.test(haystack)) score -= 6;
  if ((/직원교육|직원인권|인권보호/u.test(haystack)) && candidate.sourceRole !== 'primary_evaluation') {
    score -= 12;
  }

  if (year) {
    const yearGap = Math.max(0, currentYear - year);
    score += Math.max(-10, 8 - yearGap * 2);
  }

  return score;
}

function mergePrecomputedCandidates(
  localCandidates: SearchCandidate[],
  precomputedCandidates: SearchCandidate[] | undefined,
  limit: number,
  scoreKey: 'lexicalScore' | 'vectorScore',
): SearchCandidate[] {
  if (!precomputedCandidates || precomputedCandidates.length === 0) return localCandidates;

  const merged = new Map<string, SearchCandidate>();
  for (const candidate of [...precomputedCandidates, ...localCandidates]) {
    const existing = merged.get(candidate.id);
    if (!existing) {
      merged.set(candidate.id, candidate);
      continue;
    }

    merged.set(candidate.id, {
      ...existing,
      exactScore: Math.max(existing.exactScore, candidate.exactScore),
      lexicalScore: Math.max(existing.lexicalScore, candidate.lexicalScore),
      vectorScore: Math.max(existing.vectorScore, candidate.vectorScore),
      fusedScore: Math.max(existing.fusedScore, candidate.fusedScore),
      rerankScore: Math.max(existing.rerankScore, candidate.rerankScore),
      headingScore: Math.max(existing.headingScore ?? 0, candidate.headingScore ?? 0),
      ontologyScore: Math.max(existing.ontologyScore, candidate.ontologyScore),
      matchedTerms: Array.from(new Set([...(existing.matchedTerms ?? []), ...(candidate.matchedTerms ?? [])])),
    });
  }

  return Array.from(merged.values())
    .sort((left, right) => {
      const scoreDiff = right[scoreKey] - left[scoreKey];
      return scoreDiff !== 0 ? scoreDiff : right.exactScore - left.exactScore;
    })
    .slice(0, limit);
}

function isThinEvaluationIndicatorChunk(candidate: SearchCandidate): boolean {
  if (candidate.sourceType !== 'evaluation' || candidate.sourceRole !== 'primary_evaluation') return false;

  const meaningfulText = candidate.text
    .replace(/해당\s*없음/gu, '')
    .replace(/[\s#*_`>|:.\-()[\]{}]/g, '')
    .trim();
  return meaningfulText.length < 24;
}

interface RerankQueryContext {
  query: string;
  focusTerms: string[];
  nonGenericFocusTerms: string[];
  checklistQuery: boolean;
  documentLookupQuery: boolean;
  evaluationComparisonQuery: boolean;
  workflowDocumentQuery: boolean;
}

function buildRerankQueryContext(query: string): RerankQueryContext {
  const focusTerms = deriveFocusTerms(query);
  return {
    query,
    focusTerms,
    nonGenericFocusTerms: focusTerms.filter((term) => !GENERIC_QUERY_TERMS.has(term)),
    checklistQuery: /(체크리스트|지침|교육|안내|확인|기한|이내|업무|절차|방법)/u.test(query),
    documentLookupQuery: /(문서|매뉴얼|사례집|가이드|바로알기|어디서|찾아줘|찾아|봐야|확인)/u.test(query),
    evaluationComparisonQuery: /(개정|전후|비교표)/u.test(query),
    workflowDocumentQuery: /(업무|처리|흐름|바로알기|확인)/u.test(query),
  };
}

function scoreHeadingAlignment(candidate: SearchCandidate, context: RerankQueryContext): { score: number; matchedTerms: string[] } {
  const focusTerms = context.nonGenericFocusTerms;
  if (focusTerms.length === 0) return { score: 0, matchedTerms: [] };

  const headingText = [
    candidate.docTitle,
    candidate.title,
    candidate.parentSectionTitle,
    ...candidate.sectionPath,
    ...(candidate.headingPath ?? []),
  ]
    .join(' ')
    .toLowerCase();
  const bodyText = candidate.searchText.toLowerCase();
  const matchedTerms: string[] = [];
  let score = 0;

  for (const term of focusTerms.slice(0, 12)) {
    const normalizedTerm = term.toLowerCase();
    if (headingText.includes(normalizedTerm)) {
      score += 8;
      matchedTerms.push(term);
    } else if (bodyText.includes(normalizedTerm)) {
      score += 2;
    }
  }

  if (candidate.containsCheckList && context.checklistQuery) {
    score += 10;
    matchedTerms.push('list-group');
  }

  return { score: Math.min(score, 48), matchedTerms };
}

function scoreDocumentLookupSourcePriority(candidate: SearchCandidate, context: RerankQueryContext, mode: PromptMode): number {
  if (candidate.sourceRole !== 'support_reference') return 0;
  if (!['manual', 'guide', 'qa', 'comparison'].includes(candidate.sourceType)) return 0;
  if (!context.documentLookupQuery) return 0;
  if (mode === 'evaluation') {
    if (candidate.sourceType !== 'comparison') return 0;
    if (!context.evaluationComparisonQuery) return 0;
  }

  const hasDocumentSignal =
    candidate.matchedTerms.includes('document-title') ||
    candidate.matchedTerms.includes('manual-source') ||
    candidate.matchedTerms.includes('synthesis-source') ||
    candidate.matchedTerms.includes('list-group') ||
    ((candidate.sourceType === 'guide' || candidate.sourceType === 'manual') &&
      context.workflowDocumentQuery &&
      /(업무|처리|흐름|바로알기|매뉴얼)/u.test(`${candidate.docTitle} ${candidate.parentSectionTitle}`));
  if (!hasDocumentSignal) return 0;

  const focusMatches = getCandidateFocusMatches(candidate, context.focusTerms);
  if (focusMatches.length < 2) return 0;

  let score = 48 + Math.min(36, focusMatches.length * 6);
  if (candidate.matchedTerms.includes('document-title')) score += 28;
  if (candidate.sourceType === 'guide' || candidate.sourceType === 'manual') score += 24;
  if (
    (candidate.sourceType === 'guide' || candidate.sourceType === 'manual') &&
    context.workflowDocumentQuery &&
    /(업무|처리|흐름|바로알기|매뉴얼)/u.test(`${candidate.docTitle} ${candidate.parentSectionTitle}`)
  ) {
    score += 64;
  }
  if (candidate.sourceType === 'qa' || candidate.sourceType === 'comparison') score += 12;
  return score;
}

function rerankCandidate(
  candidate: SearchCandidate,
  context: RerankQueryContext,
  intent: QueryIntent,
  mode: PromptMode,
  options?: SearchOptions,
): SearchCandidate {
  const ontologyScore = options?.documentScoreBoosts?.get(candidate.documentId) ?? 0;
  const chunkScoreBoost = options?.chunkScoreBoosts?.get(candidate.id) ?? 0;
  const semanticScore = scoreSemanticAlignment(candidate, options?.semanticFrame);
  const priorityClass = options?.retrievalPriorityClass ?? (mode === 'evaluation' ? 'evaluation_readiness' : undefined);
  const headingAlignment = scoreHeadingAlignment(candidate, context);
  const headingScore = priorityClass === 'legal_judgment' ? Math.min(headingAlignment.score, 8) : headingAlignment.score;
  const documentLookupSourceScore = scoreDocumentLookupSourcePriority(candidate, context, mode);
  let matchedTerms = candidate.matchedTerms;
  let score = candidate.fusedScore * 100;
  score += candidate.exactScore * 1.8;
  score += candidate.lexicalScore * 15;
  score += candidate.vectorScore * 30;
  score += ontologyScore;
  score += chunkScoreBoost;
  score += semanticScore;
  score += headingScore;
  score += documentLookupSourceScore;
  if (headingAlignment.matchedTerms.length > 0) {
    matchedTerms = Array.from(new Set([...matchedTerms, ...headingAlignment.matchedTerms, 'heading-match']));
  }
  if (documentLookupSourceScore > 0) {
    matchedTerms = Array.from(new Set([...matchedTerms, 'document-lookup-source']));
  }

  if (intent === 'legal-exact' && candidate.articleNo) score += 10;
  if (intent === 'legal-exact' && ['law', 'ordinance', 'rule', 'notice'].includes(candidate.sourceType)) score += 8;
  if (intent === 'manual-qna' && candidate.sourceType === 'qa') score += 8;
  if (intent === 'manual-qna' && ['manual', 'guide', 'wiki'].includes(candidate.sourceType)) score += 5;
  if (intent === 'synthesis' && candidate.sourceType === 'comparison') score += 6;
  if (mode === 'evaluation' && candidate.mode === 'evaluation') score += 6;

  if (
    (mode === 'evaluation' || mode === 'integrated') &&
    candidate.sourceType === 'evaluation' &&
    candidate.sourceRole === 'primary_evaluation' &&
    candidate.matchedTerms.some((term) => !CANDIDATE_METADATA_TERMS.has(term))
  ) {
    score += 6;
    const hasFoodPreferenceMatch = candidate.matchedTerms.some((term) => FOOD_PREFERENCE_EVALUATION_MATCH_RE.test(term));
    const hasFoodPreferenceContentMatch =
      FOOD_PREFERENCE_EVALUATION_MATCH_RE.test(candidate.textPreview) || FOOD_PREFERENCE_EVALUATION_MATCH_RE.test(candidate.text);
    if (hasFoodPreferenceMatch) {
      score += 56;
      if (candidate.path.includes('/knowledge/evaluation/') && hasFoodPreferenceContentMatch && !isThinEvaluationIndicatorChunk(candidate)) {
        score += 280;
      }
    }
    matchedTerms = Array.from(new Set([...candidate.matchedTerms, 'evaluation-indicator']));
  }

  if (
    candidate.sourceRole === 'primary_evaluation' &&
    candidate.path.includes('/knowledge/eval/') &&
    /평가매뉴얼/u.test(`${candidate.docTitle} ${candidate.fileName}`)
  ) {
    matchedTerms = Array.from(new Set([...matchedTerms, 'primary-manual-boosted']));
  }

  const evaluationAuthorityScore = scoreEvaluationAuthority(candidate);
  if (priorityClass === 'legal_judgment') {
    score += Math.min(evaluationAuthorityScore, 8);
  } else if (priorityClass === 'evaluation_readiness') {
    score += evaluationAuthorityScore;
  } else {
    score += Math.min(evaluationAuthorityScore, 24);
  }

  if (isThinEvaluationIndicatorChunk(candidate)) {
    score -= 96;
  }

  if (mode === 'integrated' && intent === 'legal-exact') {
    if (candidate.mode === 'integrated') score += 12;
    if (candidate.mode === 'evaluation') score -= 8;
  }

  if ((options?.lawRefs?.length ?? 0) > 0 && ['law', 'ordinance', 'rule', 'notice'].includes(candidate.sourceType)) {
    score += 12;
  }

  if (options?.queryType === 'checklist' && ['manual', 'guide', 'wiki', 'qa'].includes(candidate.sourceType)) {
    score += 6;
  }

  if (options?.queryType === 'procedure' && ['manual', 'guide', 'notice'].includes(candidate.sourceType)) {
    score += 6;
  }

  if (options?.retrievalPriorityClass && options?.retrievalPriorityPolicy) {
    score += scoreCandidateByPriority({
      candidate,
      priorityClass: options.retrievalPriorityClass,
      policy: options.retrievalPriorityPolicy,
      evaluationLinked: options.evaluationLinked ?? false,
    });
  }

  const effectiveServiceScopes = getEffectiveServiceScopes(options?.selectedServiceScopes);
  if (effectiveServiceScopes.length > 0) {
    if (chunkMatchesSelectedServiceScopes(candidate, options?.selectedServiceScopes)) {
      score += options?.retrievalPriorityPolicy?.scopeBoost ?? 14;
    } else if (!isChunkCompatibleWithServiceScopes(candidate, options?.selectedServiceScopes)) {
      score -= options?.retrievalPriorityPolicy?.mismatchPenalty ?? 10;
    }
  }

  return {
    ...candidate,
    matchedTerms,
    rerankScore: score,
    headingScore,
    ontologyScore: ontologyScore + semanticScore,
  };
}

function applyEvaluationAuthorityDriftGuard(params: {
  candidates: SearchCandidate[];
  exactCandidates: SearchCandidate[];
  mode: PromptMode;
  options?: SearchOptions;
}): SearchCandidate[] {
  const enabled =
    params.options?.evaluationAuthorityDriftGuard ||
    (process.env.RAG_ENABLE_EVALUATION_AUTHORITY_DRIFT_GUARD || 'false').toLowerCase() === 'true';
  if (!enabled) return params.candidates;
  const [topCandidate] = params.candidates;
  const [exactTop] = params.exactCandidates;
  if (!topCandidate || !exactTop || topCandidate.documentId === exactTop.documentId) return params.candidates;
  if (
    exactTop.mode !== 'evaluation' &&
    exactTop.sourceRole !== 'primary_evaluation' &&
    params.mode !== 'evaluation'
  ) {
    return params.candidates;
  }
  const targetIndex = params.candidates.findIndex((candidate) => candidate.documentId === exactTop.documentId);
  if (targetIndex < 0) return params.candidates;

  const target = params.candidates[targetIndex];
  const requiredBoost = topCandidate.rerankScore - target.rerankScore + 1;
  const boost = Math.min(96, Math.max(18, requiredBoost));
  const guardedTarget: SearchCandidate = {
    ...target,
    rerankScore: target.rerankScore + boost,
    matchedTerms: Array.from(new Set([...target.matchedTerms, 'evaluation-authority-drift-guard'])),
  };

  return params.candidates
    .map((candidate, index) => (index === targetIndex ? guardedTarget : candidate))
    .sort((left, right) => right.rerankScore - left.rerankScore);
}

function scoreSemanticAlignment(candidate: SearchCandidate, semanticFrame: SemanticFrame | undefined): number {
  if (!semanticFrame) return 0;

  const haystack = `${candidate.docTitle} ${candidate.parentSectionTitle} ${candidate.searchText}`.toLowerCase();
  let score = 0;
  const concreteTermMatches: string[] = [];

  for (const term of semanticFrame.canonicalTerms.slice(0, 12)) {
    if (term && haystack.includes(term.toLowerCase())) {
      score += 2.5;
      if (term.length >= 2 && !GENERIC_QUERY_TERMS.has(term)) {
        concreteTermMatches.push(term);
      }
    }
  }

  if (semanticFrame.primaryIntent === 'workflow' && concreteTermMatches.length >= 3) {
    score += 120 + concreteTermMatches.length * 35;
  }

  for (const values of Object.values(semanticFrame.slots)) {
    for (const value of values ?? []) {
      if (value.canonical && haystack.includes(value.canonical.toLowerCase())) {
        score += 4;
      }
    }
  }

  for (const request of semanticFrame.relationRequests) {
    switch (request.relation) {
      case 'eligible-for':
      case 'not-eligible-for':
        if (/(대상|가능|불가|제외|조건)/u.test(candidate.searchText)) score += 5 * request.weight;
        break;
      case 'has-cost':
        if (/(비용|본인부담|금액|산정)/u.test(candidate.searchText)) score += 5 * request.weight;
        break;
      case 'uses-document':
        if (/(서류|문서|서식|작성|제출)/u.test(candidate.searchText)) score += 4.5 * request.weight;
        break;
      case 'exception-of':
      case 'not-applies-to':
        if (/(예외|감경|면제|제외|단서)/u.test(candidate.searchText)) score += 5 * request.weight;
        break;
      case 'follows-step':
      case 'requires':
        if (/(절차|순서|작성|제출|신청|신고|청구|필수)/u.test(candidate.searchText)) score += 4 * request.weight;
        break;
      case 'applies-to':
      case 'limited-by':
        if (/(적용|기준|제한|상한|조건)/u.test(candidate.searchText)) score += 4 * request.weight;
        break;
      case 'conflicts-with':
        if (/(위반|제재|처분|주의)/u.test(candidate.searchText)) score += 4.5 * request.weight;
        break;
      case 'belongs-to':
      case 'same-as':
      case 'alias-of':
        if (/(분류|정의|개념|동일|같은)/u.test(candidate.searchText)) score += 3.5 * request.weight;
        break;
      case 'evidenced-by':
        if (/(증빙|근거|증거)/u.test(candidate.searchText)) score += 3 * request.weight;
        break;
    }
  }

  return score;
}

function isAdjacentWindow(left: SearchCandidate, right: SearchCandidate): boolean {
  return (
    left.parentSectionId === right.parentSectionId &&
    left.documentId === right.documentId &&
    Math.abs(left.windowIndex - right.windowIndex) === 1
  );
}

function shouldExpandChecklistEvidence(query: string): boolean {
  return buildQueryExpansionProfile(query).checklistExpansion;
}

function expandEvidenceWithListGroups(
  selected: SearchCandidate[],
  candidates: SearchCandidate[],
  evidenceTopK: number,
): SearchCandidate[] {
  const selectedById = new Map(selected.map((candidate) => [candidate.id, candidate] as const));
  const selectedListGroupIds = new Set(
    candidates
      .slice(0, 30)
      .filter((candidate) => candidate.containsCheckList || candidate.listGroupId)
      .map((candidate) => candidate.listGroupId)
      .filter(Boolean),
  );

  if (selectedListGroupIds.size === 0) return selected;

  for (const candidate of candidates) {
    if (selectedById.size >= evidenceTopK) break;
    if (!candidate.listGroupId || !selectedListGroupIds.has(candidate.listGroupId)) continue;
    if (selectedById.has(candidate.id)) continue;
    selectedById.set(candidate.id, {
      ...candidate,
      rerankScore: candidate.rerankScore + 4,
      matchedTerms: Array.from(new Set([...candidate.matchedTerms, 'list-group-expanded'])),
    });
  }

  return Array.from(selectedById.values()).sort((left, right) => right.rerankScore - left.rerankScore).slice(0, evidenceTopK);
}

function indicatorKey(candidate: Pick<SearchCandidate, 'docTitle' | 'articleNo' | 'parentSectionTitle'>): string {
  return `${candidate.docTitle}::${candidate.articleNo ?? candidate.parentSectionTitle}`;
}

function enforceEntityCoverage(selected: SearchCandidate[], candidates: SearchCandidate[], query: string): SearchCandidate[] {
  const profile = buildQueryExpansionProfile(query);
  if (profile.maxForcedInjections === 0) return selected;

  const annotateSelectedCandidate = (candidate: SearchCandidate): SearchCandidate => {
    const matchedAnchor = profile.entityAnchors.find((anchor) => scoreEntityAnchorText(candidate.text, anchor.id) > 0);
    if (!matchedAnchor) return candidate;
    return {
      ...candidate,
      forcedByEntity: true,
      entityAnchorId: candidate.entityAnchorId ?? matchedAnchor.id,
      matchedTerms: Array.from(new Set([...candidate.matchedTerms, `entity-match:${matchedAnchor.id}`])),
    };
  };

  const annotatedSelected = selected.map(annotateSelectedCandidate);
  const selectedIds = new Set(annotatedSelected.map((candidate) => candidate.id));
  const selectedIndicators = new Set(annotatedSelected.map((candidate) => indicatorKey(candidate)));
  const forced: SearchCandidate[] = [];

  for (const anchor of profile.entityAnchors) {
    const bestByIndicator = new Map<string, { candidate: SearchCandidate; score: number }>();
    for (const candidate of candidates) {
      if (selectedIds.has(candidate.id)) continue;
      const score = scoreEntityAnchorText(candidate.text, anchor.id);
      if (score <= 0) continue;

      const key = indicatorKey(candidate);
      if (selectedIndicators.has(key)) continue;
      const current = bestByIndicator.get(key);
      if (!current || score > current.score || (score === current.score && candidate.rerankScore > current.candidate.rerankScore)) {
        bestByIndicator.set(key, { candidate, score });
      }
    }

    for (const { candidate } of Array.from(bestByIndicator.values()).sort((left, right) => {
      const scoreDiff = right.score - left.score;
      return scoreDiff !== 0 ? scoreDiff : right.candidate.rerankScore - left.candidate.rerankScore;
    })) {
      if (forced.length >= profile.maxForcedInjections) break;
      const key = indicatorKey(candidate);
      if (selectedIndicators.has(key)) continue;
      selectedIndicators.add(key);
      selectedIds.add(candidate.id);
      forced.push({
        ...candidate,
        forcedByEntity: true,
        entityAnchorId: anchor.id,
        matchedTerms: Array.from(new Set([...candidate.matchedTerms, 'entity-forced', `entity-forced:${anchor.id}`])),
      });
    }

    if (forced.length >= profile.maxForcedInjections) break;
  }

  return forced.length > 0 ? [...annotatedSelected, ...forced] : annotatedSelected;
}

function buildEntityAnchoredCandidates(params: {
  index: RagCorpusIndex;
  query: string;
  rerankContext: RerankQueryContext;
  mode: PromptMode;
  intent: QueryIntent;
  options?: SearchOptions;
}): SearchCandidate[] {
  const profile = buildQueryExpansionProfile(params.query);
  if (profile.entityAnchors.length === 0) return [];

  const bestByIndicator = new Map<string, SearchCandidate>();
  const candidateIds = new Set<string>();
  for (const anchor of profile.entityAnchors) {
    for (const chunkId of params.index.entityAnchorPostingMap.get(anchor.id) ?? []) {
      candidateIds.add(chunkId);
    }
  }

  const candidateChunks = Array.from(candidateIds)
    .map((chunkId) => params.index.chunkById.get(chunkId))
    .filter((chunk): chunk is StructuredChunk => Boolean(chunk) && isChunkInScope(chunk, params.mode, params.options))
    .sort(
      (left, right) =>
        (params.index.chunkOrdinalMap.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
        (params.index.chunkOrdinalMap.get(right.id) ?? Number.MAX_SAFE_INTEGER),
    );

  for (const chunk of candidateChunks) {
    if (!isChunkInScope(chunk, params.mode, params.options)) continue;

    let strongestAnchorId: string | undefined;
    let strongestScore = 0;
    const anchorScores = params.index.entityAnchorScoresByChunkId.get(chunk.id);
    for (const anchor of profile.entityAnchors) {
      const score = anchorScores?.get(anchor.id) ?? 0;
      if (score > strongestScore) {
        strongestScore = score;
        strongestAnchorId = anchor.id;
      }
    }

    if (!strongestAnchorId || strongestScore <= 0) continue;

    const checklistBoost = chunk.containsCheckList ? 18 : 0;
    const qualifierBoost = hasQualifierSignal(chunk.text) ? 8 : 0;
    const sectionBoost = scoreEntityAnchorText(chunk.parentSectionTitle, strongestAnchorId) > 0 ? 12 : 0;
    const primaryEvaluationBoost = chunk.sourceRole === 'primary_evaluation' ? 40 : 0;
    const structuredEvaluationDocBoost = /^\d{2}-\d{2}-/.test(chunk.docTitle) ? 80 : 0;
    const workflowTitleBoost = /(욕구사정|급여제공계획|정보제공|지침|상담|계획)/u.test(`${chunk.docTitle} ${chunk.parentSectionTitle}`) ? 30 : 0;
    const qualifierTextBoost = /(14일\s*이내|급여제공\s*시작일|8가지|연\s*1회|분기별|다만)/u.test(chunk.text) ? 20 : 0;
    const qaPenalty = /(Q&A|qa|사례집|업무의 이해)/u.test(`${chunk.docTitle} ${chunk.parentSectionTitle}`) ? -28 : 0;
    const candidate = rerankCandidate(
      {
        ...createCandidate(chunk),
        lexicalScore: strongestScore / 10,
        matchedTerms: ['entity-anchor', `entity-anchor:${strongestAnchorId}`],
      },
      params.rerankContext,
      params.intent,
      params.mode,
      params.options,
    );
    const boostedCandidate: SearchCandidate = {
      ...candidate,
      rerankScore:
        candidate.rerankScore +
        24 +
        strongestScore +
        checklistBoost +
        qualifierBoost +
        sectionBoost +
        primaryEvaluationBoost +
        structuredEvaluationDocBoost +
        workflowTitleBoost +
        qualifierTextBoost +
        qaPenalty,
      matchedTerms: Array.from(new Set([...candidate.matchedTerms, 'entity-anchor-boosted'])),
    };
    const key = indicatorKey(boostedCandidate);
    const current = bestByIndicator.get(key);
    if (!current || boostedCandidate.rerankScore > current.rerankScore) {
      bestByIndicator.set(key, boostedCandidate);
    }
  }

  return Array.from(bestByIndicator.values())
    .sort((left, right) => right.rerankScore - left.rerankScore)
    .slice(0, 12);
}

function selectEvidence(candidates: SearchCandidate[], query: string, options?: SearchOptions): SearchCandidate[] {
  const selected: SearchCandidate[] = [];
  const documentClusters = new Map<string, Set<string>>();
  const clusterWindowCounts = new Map<string, number>();
  const profile = buildQueryExpansionProfile(query);
  const evidenceTopK = profile.evidenceTopK;
  const maxEvidenceClustersPerDocument = profile.maxEvidenceClustersPerDocument;

  for (const candidate of candidates) {
    if (selected.length >= evidenceTopK) break;
    if (options?.excludedEvidenceRoles?.has(candidate.sourceRole)) continue;

    const clusterKey = `${candidate.documentId}:${candidate.parentSectionId}`;
    const activeClusters = documentClusters.get(candidate.documentId) ?? new Set<string>();
    const clusterCount = clusterWindowCounts.get(clusterKey) ?? 0;
    const existingClusterWindows = selected.filter((item) => `${item.documentId}:${item.parentSectionId}` === clusterKey);
    const clusterAlreadySelected = activeClusters.has(clusterKey);

    if (!clusterAlreadySelected && activeClusters.size >= maxEvidenceClustersPerDocument) continue;
    if (clusterCount >= MAX_WINDOWS_PER_CLUSTER) continue;
    if (
      clusterAlreadySelected &&
      existingClusterWindows.length > 0 &&
      !existingClusterWindows.some((window) => isAdjacentWindow(window, candidate))
    ) {
      continue;
    }

    selected.push(candidate);
    activeClusters.add(clusterKey);
    documentClusters.set(candidate.documentId, activeClusters);
    clusterWindowCounts.set(clusterKey, clusterCount + 1);
  }

  const expanded = expandEvidenceWithListGroups(selected, candidates, evidenceTopK);
  return enforceEntityCoverage(expanded, candidates, query);
}

function detectTopicMismatch(query: string, candidates: SearchCandidate[]): { focusTerms: string[]; mismatchSignals: string[] } {
  const focusTerms = deriveFocusTerms(query);
  if (focusTerms.length === 0 || candidates.length === 0) {
    return { focusTerms, mismatchSignals: [] };
  }

  const topCandidates = candidates.slice(0, 5);
  const matchedFocusTerms = new Set(topCandidates.flatMap((candidate) => getCandidateFocusMatches(candidate, focusTerms)));
  const genericOnlyMatches = topCandidates.every((candidate) => {
    const matchedQueryTerms = candidate.matchedTerms.filter((term) => !CANDIDATE_METADATA_TERMS.has(term));
    return matchedQueryTerms.length === 0 || matchedQueryTerms.every((term) => GENERIC_QUERY_TERMS.has(term));
  });

  const mismatchSignals: string[] = [];
  if (matchedFocusTerms.size === 0) {
    mismatchSignals.push('no-focus-terms-in-top-candidates');
    if (genericOnlyMatches) {
      mismatchSignals.push('generic-only-match');
    }
  }

  return { focusTerms, mismatchSignals };
}

function inferConfidence(intent: QueryIntent, evidence: SearchCandidate[], mismatchSignals: string[]): ConfidenceLevel {
  if (evidence.length === 0) return 'low';
  if (mismatchSignals.length > 0) return 'low';

  const top = evidence[0];
  const exactHeavy = top.exactScore >= 25 || Boolean(top.articleNo && top.matchedTerms.includes(top.articleNo));
  const mixedDocs = new Set(evidence.map((item) => item.docTitle)).size >= 3;
  const focusMatchedEvidenceCount = evidence.filter((item) => item.matchedTerms.some((term) => !CANDIDATE_METADATA_TERMS.has(term))).length;
  const evalEvidenceCount = evidence.filter((item) => item.mode === 'evaluation').length;

  if (exactHeavy && top.rerankScore >= 72 && focusMatchedEvidenceCount >= 1) return 'high';
  if (intent === 'synthesis' && mixedDocs && focusMatchedEvidenceCount >= 1) return 'medium';
  if (evalEvidenceCount >= 3 && focusMatchedEvidenceCount >= 1) return 'medium';
  if (top.rerankScore >= 42 && focusMatchedEvidenceCount >= 1) return 'medium';
  return 'low';
}

function diversifyCandidatePool(
  candidates: SearchCandidate[],
  limit: number,
  maxPerDocument = 4,
  maxPerParentSection = 2,
): SearchCandidate[] {
  const selected: SearchCandidate[] = [];
  const documentCounts = new Map<string, number>();
  const sectionCounts = new Map<string, number>();

  for (const candidate of candidates) {
    if (selected.length >= limit) break;

    const documentCount = documentCounts.get(candidate.documentId) ?? 0;
    const sectionKey = `${candidate.documentId}:${candidate.parentSectionId}`;
    const sectionCount = sectionCounts.get(sectionKey) ?? 0;
    if (documentCount >= maxPerDocument || sectionCount >= maxPerParentSection) continue;

    selected.push(candidate);
    documentCounts.set(candidate.documentId, documentCount + 1);
    sectionCounts.set(sectionKey, sectionCount + 1);
  }

  return selected;
}

export function diversifyVisibleCandidates(
  candidates: SearchCandidate[],
  limit: number,
  maxPerDocument = MAX_VISIBLE_CANDIDATES_PER_DOCUMENT,
  maxPerParentSection = MAX_VISIBLE_CANDIDATES_PER_PARENT_SECTION,
): SearchCandidate[] {
  const selected: SearchCandidate[] = [];
  const deferred: SearchCandidate[] = [];
  const documentCounts = new Map<string, number>();
  const sectionCounts = new Map<string, number>();

  for (const candidate of candidates) {
    const documentCount = documentCounts.get(candidate.documentId) ?? 0;
    const sectionKey = `${candidate.documentId}:${candidate.parentSectionId}`;
    const sectionCount = sectionCounts.get(sectionKey) ?? 0;

    if (documentCount >= maxPerDocument || sectionCount >= maxPerParentSection) {
      deferred.push({
        ...candidate,
        matchedTerms: Array.from(new Set([...candidate.matchedTerms, 'document-cap'])),
      });
      continue;
    }

    selected.push(candidate);
    documentCounts.set(candidate.documentId, documentCount + 1);
    sectionCounts.set(sectionKey, sectionCount + 1);
  }

  return [...selected, ...deferred]
    .slice(0, limit)
    .map((candidate, index) => ({
      ...candidate,
      rerankScore: candidate.matchedTerms.includes('document-cap')
        ? candidate.rerankScore - Math.max(1, limit - index) * 0.01
        : candidate.rerankScore,
    }));
}

function buildStageTrace(params: {
  query: string;
  lexicalCandidates: SearchCandidate[];
  vectorCandidates: SearchCandidate[];
  exactCandidates: SearchCandidate[];
  fusedCandidates: SearchCandidate[];
  evidence: SearchCandidate[];
  groundingGatePassed: boolean;
  documentFastPathDocumentIds?: Set<string> | null;
  lexicalPoolShared?: boolean;
  lexicalPoolMerged?: boolean;
  lexicalPoolSize?: number;
  lexicalPoolSource?: string;
  lexicalScoringSource?: string;
  exactScoringSource?: string;
  exactRankingSource?: string;
  rerankContextSource?: string;
  entityAnchorSource?: string;
  entityAnchorCandidatePoolSize?: number;
  evaluationAuthorityDriftGuard?: boolean;
  lexicalScoringCacheStats?: {
    hits: number;
    misses: number;
    size: number;
  };
}): RetrievalStageTrace[] {
  const lexicalNotes = params.lexicalCandidates.length > 0
    ? [`top=${params.lexicalCandidates[0].docTitle}`]
    : ['no-lexical-match'];
  if (params.lexicalPoolShared) {
    lexicalNotes.push(params.lexicalPoolMerged ? 'lexical-pool=merged' : 'lexical-pool=shared');
    lexicalNotes.push(`lexical-pool-size=${params.lexicalPoolSize ?? 0}`);
    if (params.lexicalPoolSource) {
      lexicalNotes.push(`lexical-pool-source=${params.lexicalPoolSource}`);
    }
  }
  if (params.documentFastPathDocumentIds && params.documentFastPathDocumentIds.size > 0) {
    lexicalNotes.push(`document-fast-path=${params.documentFastPathDocumentIds.size}`);
  }
  if (params.lexicalScoringSource) {
    lexicalNotes.push(`lexical-scoring=${params.lexicalScoringSource}`);
  }
  if (params.lexicalScoringCacheStats) {
    lexicalNotes.push(
      `lexical-score-cache=hits:${params.lexicalScoringCacheStats.hits},misses:${params.lexicalScoringCacheStats.misses},size:${params.lexicalScoringCacheStats.size}`,
    );
  }

  return [
    {
      stage: 'query_normalization',
      inputCount: 1,
      outputCount: params.query.trim() ? 1 : 0,
      notes: params.query.trim() ? [`normalizedLength=${params.query.trim().length}`] : ['empty-query'],
    },
    {
      stage: 'lexical_candidates',
      inputCount: 1,
      outputCount: params.lexicalCandidates.length,
      notes: lexicalNotes,
    },
    {
      stage: 'vector_candidates',
      inputCount: 1,
      outputCount: params.vectorCandidates.length,
      notes: params.vectorCandidates.length > 0 ? [`top=${params.vectorCandidates[0].docTitle}`] : ['vector-unavailable-or-empty'],
    },
    {
      stage: 'fusion',
      inputCount: params.exactCandidates.length + params.lexicalCandidates.length + params.vectorCandidates.length,
      outputCount: params.fusedCandidates.length,
      notes: [
        `exact=${params.exactCandidates.length}`,
        `lexical=${params.lexicalCandidates.length}`,
        `vector=${params.vectorCandidates.length}`,
        ...(params.exactCandidates.length > 0 ? [`exact-top=${params.exactCandidates[0].docTitle}`] : []),
        ...(params.fusedCandidates.length > 0 ? [`fusion-top=${params.fusedCandidates[0].docTitle}`] : []),
        ...(params.exactScoringSource
          ? params.exactScoringSource.split(',').filter(Boolean).map((source) => `exact-scoring=${source}`)
          : []),
        ...(params.exactRankingSource ? [`exact-ranking=${params.exactRankingSource}`] : []),
        ...(params.rerankContextSource ? [`rerank-context=${params.rerankContextSource}`] : []),
        ...(params.entityAnchorSource ? [`entity-anchor-source=${params.entityAnchorSource}`] : []),
        ...(params.entityAnchorCandidatePoolSize !== undefined
          ? [`entity-anchor-pool-size=${params.entityAnchorCandidatePoolSize}`]
          : []),
        ...(params.evaluationAuthorityDriftGuard ? ['evaluation-authority-drift-guard=enabled'] : []),
      ],
    },
    {
      stage: 'document_diversification',
      inputCount: params.fusedCandidates.length,
      outputCount: params.evidence.length,
      notes:
        params.evidence.length > 0
          ? [`documents=${new Set(params.evidence.map((item) => item.documentId)).size}`, `clusters=${new Set(params.evidence.map((item) => item.citationGroupId)).size}`]
          : ['no-evidence-selected'],
    },
    {
      stage: 'answer_evidence_gate',
      inputCount: params.evidence.length,
      outputCount: params.groundingGatePassed ? params.evidence.length : 0,
      notes: [params.groundingGatePassed ? 'grounding-passed' : 'grounding-failed'],
    },
  ];
}

export function searchCorpus(params: {
  index: RagCorpusIndex;
  query: string;
  mode: PromptMode;
  queryEmbedding?: number[] | null;
  queryAliases?: string[];
  options?: SearchOptions;
}): SearchRun {
  const totalStartedAt = Date.now();
  const { index, query, mode, queryEmbedding = null, queryAliases = [], options } = params;
  const documentFastPathDocumentIds = resolveDocumentFastPathDocumentIds(index, query, mode, options);
  const searchOptions = documentFastPathDocumentIds
    ? {
        ...options,
        allowedDocumentIds: documentFastPathDocumentIds,
      }
    : options;
  const expansionProfile = buildQueryExpansionProfile(query);
  const intent = detectIntent(mode, query);
  const lexicalTokens = queryTokens(query);
  const lexicalTokenSet = new Set(lexicalTokens);
  const lexicalScoringContext = buildLexicalScoringContext(index, lexicalTokens);
  const lexicalPoolStartedAt = Date.now();
  const lexicalChunkPool =
    searchOptions?.precomputedLexicalCandidateChunks ||
    searchOptions?.allowedDocumentIds ||
    Number.isFinite(searchOptions?.maxLexicalCandidateChunks ?? Number.POSITIVE_INFINITY)
      ? resolveLexicalCandidateChunks(index, lexicalTokens, lexicalTokenSet, mode, searchOptions)
      : undefined;
  const lexicalPoolMs = Date.now() - lexicalPoolStartedAt;
  const lexicalPoolSource =
    lexicalChunkPool && searchOptions?.precomputedLexicalCandidateChunks
      ? searchOptions.mergePrecomputedLexicalCandidateChunks
        ? 'merged'
        : 'precomputed'
      : lexicalChunkPool && searchOptions?.allowedDocumentIds
        ? 'posting-scope'
        : lexicalChunkPool
          ? 'posting-global'
          : undefined;
  const exactScoringContext = buildExactScoringContext(query, queryAliases, intent, mode, searchOptions?.lawRefs);
  const exactStartedAt = Date.now();
  const exactCandidateLimit = expansionProfile.fusedTopK * 4;
  const exactCandidates: SearchCandidate[] = [];
  const exactInputChunks = exactCandidateChunks(index, query, lexicalTokens, mode, searchOptions, lexicalChunkPool);
  let exactScoredChunks = 0;
  for (const chunk of exactInputChunks) {
    if (!isChunkInScope(chunk, mode, searchOptions)) continue;
    exactScoredChunks += 1;
    const candidate = scoreExact(
      chunk,
      exactScoringContext,
      index.exactMetadataByChunkId.get(chunk.id) ?? {
        titleCompact: compactForMetadata(chunk.docTitle),
        fileNameCompact: compactForMetadata(chunk.fileName),
        sectionCompact: compactForMetadata(chunk.sectionPath.join(' ')),
      },
    );
    if (candidate) insertBoundedExactCandidate(exactCandidates, candidate, exactCandidateLimit);
  }
  const diversifiedExactCandidates = diversifyCandidatePool(exactCandidates, expansionProfile.fusedTopK);
  const exactMs = Date.now() - exactStartedAt;

  const lexicalStartedAt = Date.now();
  const lexicalScoringCacheBefore = searchOptions?.lexicalScoringCache?.getStats();
  const lexicalInputChunks =
    lexicalTokens.length > 0 ? (lexicalChunkPool ?? lexicalCandidateChunks(index, lexicalTokens, mode, searchOptions)) : [];
  const lexicalCandidates = mergePrecomputedCandidates(
    scoreLexical(index, lexicalScoringContext, mode, searchOptions, expansionProfile.fusedTopK, lexicalInputChunks),
    options?.precomputedLexicalCandidates,
    expansionProfile.fusedTopK,
    'lexicalScore',
  );
  const lexicalScoringCacheAfter = searchOptions?.lexicalScoringCache?.getStats();
  const lexicalScoringCacheStats =
    lexicalScoringCacheBefore && lexicalScoringCacheAfter
      ? {
          hits: lexicalScoringCacheAfter.hits - lexicalScoringCacheBefore.hits,
          misses: lexicalScoringCacheAfter.misses - lexicalScoringCacheBefore.misses,
          size: lexicalScoringCacheAfter.size,
        }
      : undefined;
  const lexicalMs = Date.now() - lexicalStartedAt;
  const vectorStartedAt = Date.now();
  const vectorCandidates = options?.precomputedVectorCandidates ?? scoreVector(index, queryEmbedding, mode, searchOptions);
  const vectorMs = Date.now() - vectorStartedAt;
  const rerankContext = buildRerankQueryContext(query);
  const fusionStartedAt = Date.now();
  const fusionRrfStartedAt = Date.now();
  const initialFusedCandidates = reciprocalRankFuse([diversifiedExactCandidates, lexicalCandidates, vectorCandidates]);
  const fusionRrfMs = Date.now() - fusionRrfStartedAt;
  const fusionRerankStartedAt = Date.now();
  const rerankedCandidates = initialFusedCandidates
    .map((candidate) => rerankCandidate(candidate, rerankContext, intent, mode, searchOptions))
    .sort((left, right) => right.rerankScore - left.rerankScore);
  const fusionRerankMs = Date.now() - fusionRerankStartedAt;
  const fusionEntityAnchorStartedAt = Date.now();
  const entityAnchoredCandidates = buildEntityAnchoredCandidates({
    index,
    query,
    rerankContext,
    mode,
    intent,
    options: searchOptions,
  });
  const fusionEntityAnchorMs = Date.now() - fusionEntityAnchorStartedAt;
  const fusionMergeStartedAt = Date.now();
  const mergedRerankedCandidates = reciprocalRankFuse([rerankedCandidates, entityAnchoredCandidates])
    .map((candidate) => {
      const injected = entityAnchoredCandidates.find((item) => item.id === candidate.id);
      return injected && injected.rerankScore > candidate.rerankScore ? injected : candidate;
    })
    .sort((left, right) => right.rerankScore - left.rerankScore)
    .slice(0, expansionProfile.fusedTopK * 2);
  const fusionMergeMs = Date.now() - fusionMergeStartedAt;
  const authorityGuardedCandidates = applyEvaluationAuthorityDriftGuard({
    candidates: mergedRerankedCandidates,
    exactCandidates: diversifiedExactCandidates,
    mode,
    options: searchOptions,
  });
  const fusionDiversifyStartedAt = Date.now();
  const fusedCandidates = diversifyVisibleCandidates(
    authorityGuardedCandidates,
    expansionProfile.fusedTopK,
    expansionProfile.maxVisibleCandidatesPerDocument,
  );
  debugRecallStage('fusion', query, fusedCandidates);
  const fusionDiversifyMs = Date.now() - fusionDiversifyStartedAt;
  const fusionMs = Date.now() - fusionStartedAt;

  const evidenceStartedAt = Date.now();
  const evidence = selectEvidence(fusedCandidates, query, options);
  debugRecallStage('evidence', query, evidence);
  const { focusTerms, mismatchSignals } = detectTopicMismatch(query, fusedCandidates);
  const confidence = inferConfidence(intent, evidence, mismatchSignals);
  const evidenceMs = Date.now() - evidenceStartedAt;
  const corpusPhaseTimings: SearchCorpusPhaseTimings = {
    lexicalPoolMs,
    exactMs,
    lexicalMs,
    vectorMs,
    fusionMs,
    fusionDetails: {
      rrfMs: fusionRrfMs,
      rerankMs: fusionRerankMs,
      entityAnchorMs: fusionEntityAnchorMs,
      mergeMs: fusionMergeMs,
      diversifyMs: fusionDiversifyMs,
    },
    candidateCounts: {
      lexicalPoolChunks: lexicalChunkPool?.length ?? 0,
      exactInputChunks: exactInputChunks.length,
      exactScoredChunks,
      exactCandidates: diversifiedExactCandidates.length,
      lexicalInputChunks: lexicalInputChunks.length,
      lexicalCandidates: lexicalCandidates.length,
    },
    evidenceMs,
    totalMs: Date.now() - totalStartedAt,
  };

  return {
    query,
    mode,
    intent,
    confidence,
    exactCandidates: diversifiedExactCandidates,
    lexicalCandidates,
    vectorCandidates,
    fusedCandidates,
    evidence,
    focusTerms,
    mismatchSignals,
    corpusPhaseTimings,
    enumerationIntent: expansionProfile.enumeration,
    matchedEntityAnchors: expansionProfile.entityAnchors.map((item) => item.id),
    stageTrace: buildStageTrace({
      query,
      lexicalCandidates,
      vectorCandidates,
      exactCandidates,
      fusedCandidates,
      evidence,
      groundingGatePassed: confidence !== 'low',
      documentFastPathDocumentIds,
      lexicalPoolShared: Boolean(lexicalChunkPool),
      lexicalPoolMerged: Boolean(searchOptions?.mergePrecomputedLexicalCandidateChunks),
      lexicalPoolSize: lexicalChunkPool?.length,
      lexicalPoolSource,
      lexicalScoringSource: lexicalTokens.length > 0 ? 'idf-precomputed' : undefined,
      exactScoringSource: 'indexed-metadata,lazy-candidate,compact-query-terms,query-signals',
      exactRankingSource: 'bounded-topk',
      rerankContextSource: 'shared',
      entityAnchorSource: expansionProfile.entityAnchors.length > 0 ? 'index' : undefined,
      entityAnchorCandidatePoolSize: entityAnchoredCandidates.length,
      evaluationAuthorityDriftGuard: Boolean(searchOptions?.evaluationAuthorityDriftGuard),
      lexicalScoringCacheStats,
    }),
  };
}
