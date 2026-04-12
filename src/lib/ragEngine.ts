import { compareIsoDateDesc, detectIntent, extractArticleNo, tokenize } from './ragMetadata';
import type {
  ConfidenceLevel,
  PromptMode,
  QueryIntent,
  RetrievalStageTrace,
  SearchCandidate,
  SearchRun,
  SourceRole,
  StructuredChunk,
} from './ragTypes';

export interface RagCorpusIndex {
  chunks: StructuredChunk[];
  tokenMap: Map<string, string[]>;
  dfMap: Map<string, number>;
}

export interface SearchOptions {
  allowedDocumentIds?: Set<string>;
  documentScoreBoosts?: Map<string, number>;
  excludedEvidenceRoles?: Set<SourceRole>;
}

const VECTOR_TOP_K = 36;
const FUSED_TOP_K = 24;
const EVIDENCE_TOP_K = 12;
const MAX_EVIDENCE_CLUSTERS_PER_DOCUMENT = 2;
const MAX_WINDOWS_PER_CLUSTER = 2;
const RRF_K = 50;
const CANDIDATE_METADATA_TERMS = new Set([
  'document-title',
  'legal-source',
  'manual-source',
  'synthesis-source',
  'evaluation-mode',
  'date-match',
]);

const GENERIC_QUERY_TERMS = new Set([
  '장기요양',
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

export function buildRagCorpusIndex(chunks: StructuredChunk[]): RagCorpusIndex {
  const tokenMap = new Map<string, string[]>();
  const dfMap = new Map<string, number>();

  for (const chunk of chunks) {
    const tokens = tokenize(chunk.searchText);
    tokenMap.set(chunk.id, tokens);
    const uniqueTokens = new Set(tokens);
    for (const token of uniqueTokens) {
      dfMap.set(token, (dfMap.get(token) ?? 0) + 1);
    }
  }

  return { chunks, tokenMap, dfMap };
}

function createCandidate(chunk: StructuredChunk): SearchCandidate {
  return {
    ...chunk,
    exactScore: 0,
    lexicalScore: 0,
    vectorScore: 0,
    fusedScore: 0,
    rerankScore: 0,
    matchedTerms: [],
  };
}

function isChunkInScope(chunk: StructuredChunk, mode: PromptMode, options?: SearchOptions): boolean {
  if (options?.allowedDocumentIds) {
    return options.allowedDocumentIds.has(chunk.documentId);
  }

  return mode !== 'evaluation' || chunk.mode === 'evaluation';
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
  return queryTokens(query).filter((token) => !GENERIC_QUERY_TERMS.has(token));
}

export function isGenericQueryTerm(term: string): boolean {
  return GENERIC_QUERY_TERMS.has(term);
}

export function getCandidateFocusMatches(candidate: StructuredChunk, focusTerms: string[]): string[] {
  const searchText = candidate.searchText.toLowerCase();
  return focusTerms.filter((term) => searchText.includes(term.toLowerCase()));
}

function scoreAliasMetadata(alias: string, titleCompact: string, sectionCompact: string, matchedTerms: Set<string>): number {
  const aliasCompact = alias.replace(/\s+/g, '').toLowerCase();
  if (aliasCompact.length < 2) return 0;

  if (titleCompact.includes(aliasCompact)) {
    matchedTerms.add(alias);
    return 30;
  }

  if (sectionCompact.includes(aliasCompact)) {
    matchedTerms.add(alias);
    return 18;
  }

  return 0;
}

function scoreExact(
  chunk: StructuredChunk,
  query: string,
  intent: QueryIntent,
  mode: PromptMode,
  queryAliases: string[] = [],
): SearchCandidate {
  const candidate = createCandidate(chunk);
  const compactQuery = query.replace(/\s+/g, '').toLowerCase();
  const titleCompact = chunk.docTitle.replace(/\s+/g, '').toLowerCase();
  const sectionCompact = chunk.sectionPath.join(' ').replace(/\s+/g, '').toLowerCase();
  const matchedTerms = new Set<string>();
  let score = 0;

  if (compactQuery.length >= 4 && titleCompact.includes(compactQuery)) {
    score += 28;
    matchedTerms.add('document-title');
  }

  const queryArticle = extractArticleNo(query);
  if (queryArticle && chunk.articleNo === queryArticle) {
    score += 40;
    matchedTerms.add(queryArticle);
  } else if (queryArticle && chunk.searchText.includes(queryArticle)) {
    score += 18;
    matchedTerms.add(queryArticle);
  }

  for (const token of queryTokens(query)) {
    if (titleCompact.includes(token)) {
      score += 6;
      matchedTerms.add(token);
    }
    if (sectionCompact.includes(token)) {
      score += 4;
      matchedTerms.add(token);
    }
  }

  for (const alias of queryAliases) {
    score += scoreAliasMetadata(alias, titleCompact, sectionCompact, matchedTerms);
  }

  if (intent === 'legal-exact' && ['law', 'ordinance', 'rule', 'notice'].includes(chunk.sourceType)) {
    score += 8;
    matchedTerms.add('legal-source');
  }

  if (intent === 'manual-qna' && ['manual', 'qa', 'guide', 'wiki'].includes(chunk.sourceType)) {
    score += 8;
    matchedTerms.add('manual-source');
  }

  if (intent === 'synthesis' && ['comparison', 'qa', 'manual', 'notice'].includes(chunk.sourceType)) {
    score += 4;
    matchedTerms.add('synthesis-source');
  }

  if (mode === 'evaluation' && chunk.mode === 'evaluation') {
    score += 6;
    matchedTerms.add('evaluation-mode');
  }

  const queryDateMatch = query.match(/20\d{2}[.\-/]\d{1,2}(?:[.\-/]\d{1,2})?/);
  if (
    queryDateMatch &&
    chunk.effectiveDate &&
    queryDateMatch[0].replace(/[^\d]/g, '').slice(0, 6) === chunk.effectiveDate.replace(/-/g, '').slice(0, 6)
  ) {
    score += 10;
    matchedTerms.add('date-match');
  }

  return boostCandidate(candidate, {
    exactScore: score,
    matchedTerms: Array.from(matchedTerms),
  });
}

function scoreLexical(index: RagCorpusIndex, query: string, mode: PromptMode, options?: SearchOptions): SearchCandidate[] {
  const tokens = queryTokens(query);
  if (tokens.length === 0) return [];

  const corpusSize = index.chunks.length;
  const scored: SearchCandidate[] = [];

  for (const chunk of index.chunks) {
    if (!isChunkInScope(chunk, mode, options)) continue;
    const candidate = createCandidate(chunk);
    const chunkTokens = index.tokenMap.get(chunk.id) ?? [];
    const total = chunkTokens.length || 1;
    const tfMap = new Map<string, number>();
    for (const token of chunkTokens) {
      tfMap.set(token, (tfMap.get(token) ?? 0) + 1);
    }

    let score = 0;
    const matchedTerms = new Set<string>();
    for (const token of tokens) {
      const tf = (tfMap.get(token) ?? 0) / total;
      const df = index.dfMap.get(token) ?? 0;
      if (df > 0 && tf > 0) {
        score += tf * (Math.log((corpusSize + 1) / (df + 1)) + 1);
        matchedTerms.add(token);
      }
    }

    if (score > 0) {
      scored.push(
        boostCandidate(candidate, {
          lexicalScore: score,
          matchedTerms: Array.from(matchedTerms),
        }),
      );
    }
  }

  return scored.sort((left, right) => right.lexicalScore - left.lexicalScore);
}

function scoreVector(
  index: RagCorpusIndex,
  queryEmbedding: number[] | null,
  mode: PromptMode,
  options?: SearchOptions,
): SearchCandidate[] {
  if (!queryEmbedding) return [];

  const scored: SearchCandidate[] = [];
  for (const chunk of index.chunks) {
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

function rerankCandidate(
  candidate: SearchCandidate,
  intent: QueryIntent,
  mode: PromptMode,
  options?: SearchOptions,
): SearchCandidate {
  let score = candidate.fusedScore * 100;
  score += candidate.exactScore * 1.8;
  score += candidate.lexicalScore * 15;
  score += candidate.vectorScore * 30;

  if (intent === 'legal-exact' && candidate.articleNo) score += 10;
  if (intent === 'legal-exact' && ['law', 'ordinance', 'rule', 'notice'].includes(candidate.sourceType)) score += 8;
  if (intent === 'manual-qna' && candidate.sourceType === 'qa') score += 8;
  if (intent === 'manual-qna' && ['manual', 'guide', 'wiki'].includes(candidate.sourceType)) score += 5;
  if (intent === 'synthesis' && candidate.sourceType === 'comparison') score += 6;
  if (mode === 'evaluation' && candidate.mode === 'evaluation') score += 6;

  if (mode === 'evaluation') {
    if (candidate.sourceRole === 'primary_evaluation') score += 10;
    if (candidate.sourceRole === 'support_reference') score += 6;
    if (candidate.sourceRole === 'routing_summary') score -= 14;
  }

  score += options?.documentScoreBoosts?.get(candidate.documentId) ?? 0;

  return {
    ...candidate,
    rerankScore: score,
  };
}

function isAdjacentWindow(left: SearchCandidate, right: SearchCandidate): boolean {
  return (
    left.parentSectionId === right.parentSectionId &&
    left.documentId === right.documentId &&
    Math.abs(left.windowIndex - right.windowIndex) === 1
  );
}

function selectEvidence(candidates: SearchCandidate[], options?: SearchOptions): SearchCandidate[] {
  const selected: SearchCandidate[] = [];
  const documentClusters = new Map<string, Set<string>>();
  const clusterWindowCounts = new Map<string, number>();

  for (const candidate of candidates) {
    if (selected.length >= EVIDENCE_TOP_K) break;
    if (options?.excludedEvidenceRoles?.has(candidate.sourceRole)) continue;

    const clusterKey = `${candidate.documentId}:${candidate.parentSectionId}`;
    const activeClusters = documentClusters.get(candidate.documentId) ?? new Set<string>();
    const clusterCount = clusterWindowCounts.get(clusterKey) ?? 0;
    const existingClusterWindows = selected.filter((item) => `${item.documentId}:${item.parentSectionId}` === clusterKey);
    const clusterAlreadySelected = activeClusters.has(clusterKey);

    if (!clusterAlreadySelected && activeClusters.size >= MAX_EVIDENCE_CLUSTERS_PER_DOCUMENT) continue;
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

  return selected;
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

  if (exactHeavy && top.rerankScore >= 60) return 'high';
  if (intent === 'synthesis' && mixedDocs) return 'medium';
  if (top.rerankScore >= 35) return 'medium';
  return 'low';
}

function buildStageTrace(params: {
  query: string;
  lexicalCandidates: SearchCandidate[];
  vectorCandidates: SearchCandidate[];
  exactCandidates: SearchCandidate[];
  fusedCandidates: SearchCandidate[];
  evidence: SearchCandidate[];
  groundingGatePassed: boolean;
}): RetrievalStageTrace[] {
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
      notes: params.lexicalCandidates.length > 0 ? [`top=${params.lexicalCandidates[0].docTitle}`] : ['no-lexical-match'],
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
      notes: [`exact=${params.exactCandidates.length}`, `lexical=${params.lexicalCandidates.length}`, `vector=${params.vectorCandidates.length}`],
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
  const { index, query, mode, queryEmbedding = null, queryAliases = [], options } = params;
  const intent = detectIntent(mode, query);
  const exactCandidates = index.chunks
    .filter((chunk) => isChunkInScope(chunk, mode, options))
    .map((chunk) => scoreExact(chunk, query, intent, mode, queryAliases))
    .filter((candidate) => candidate.exactScore > 0)
    .sort((left, right) => {
      const scoreDiff = right.exactScore - left.exactScore;
      return scoreDiff !== 0 ? scoreDiff : compareIsoDateDesc(left.effectiveDate, right.effectiveDate);
    })
    .slice(0, FUSED_TOP_K);

  const lexicalCandidates = scoreLexical(index, query, mode, options).slice(0, FUSED_TOP_K);
  const vectorCandidates = scoreVector(index, queryEmbedding, mode, options);
  const fusedCandidates = reciprocalRankFuse([exactCandidates, lexicalCandidates, vectorCandidates])
    .map((candidate) => rerankCandidate(candidate, intent, mode, options))
    .sort((left, right) => right.rerankScore - left.rerankScore)
    .slice(0, FUSED_TOP_K);

  const evidence = selectEvidence(fusedCandidates, options);
  const { focusTerms, mismatchSignals } = detectTopicMismatch(query, fusedCandidates);
  const confidence = inferConfidence(intent, evidence, mismatchSignals);

  return {
    query,
    mode,
    intent,
    confidence,
    exactCandidates,
    lexicalCandidates,
    vectorCandidates,
    fusedCandidates,
    evidence,
    focusTerms,
    mismatchSignals,
    stageTrace: buildStageTrace({
      query,
      lexicalCandidates,
      vectorCandidates,
      exactCandidates,
      fusedCandidates,
      evidence,
      groundingGatePassed: confidence !== 'low',
    }),
  };
}
