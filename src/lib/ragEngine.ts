import { compareIsoDateDesc, detectIntent, extractArticleNo, tokenize } from './ragMetadata';
import type { ConfidenceLevel, PromptMode, QueryIntent, SearchCandidate, SearchRun, StructuredChunk } from './ragTypes';

export interface RagCorpusIndex {
  chunks: StructuredChunk[];
  tokenMap: Map<string, string[]>;
  dfMap: Map<string, number>;
}

const VECTOR_TOP_K = 36;
const FUSED_TOP_K = 24;
const EVIDENCE_TOP_K = 12;
const MAX_EVIDENCE_PER_DOCUMENT = 2;
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
  '허용',
  '가능',
  '관련',
  '요양',
  '시설',
  '내용',
  '대상',
  '질문',
  '이용',
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

function scoreExact(chunk: StructuredChunk, query: string, intent: QueryIntent, mode: PromptMode): SearchCandidate {
  const candidate = createCandidate(chunk);
  const compactQuery = query.replace(/\s+/g, '').toLowerCase();
  const titleCompact = chunk.docTitle.replace(/\s+/g, '').toLowerCase();
  const sectionCompact = chunk.sectionPath.join(' ').replace(/\s+/g, '').toLowerCase();
  const matchedTerms = new Set<string>();
  let score = 0;

  if (titleCompact.includes(compactQuery) && compactQuery.length >= 4) {
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

function scoreLexical(index: RagCorpusIndex, query: string, mode: PromptMode): SearchCandidate[] {
  const tokens = queryTokens(query);
  if (tokens.length === 0) return [];

  const corpusSize = index.chunks.length;
  const scored: SearchCandidate[] = [];

  for (const chunk of index.chunks) {
    if (mode === 'evaluation' && chunk.mode !== 'evaluation') continue;
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

function scoreVector(index: RagCorpusIndex, queryEmbedding: number[] | null, mode: PromptMode): SearchCandidate[] {
  if (!queryEmbedding) return [];

  const scored: SearchCandidate[] = [];
  for (const chunk of index.chunks) {
    if (mode === 'evaluation' && chunk.mode !== 'evaluation') continue;
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

function rerankCandidate(candidate: SearchCandidate, intent: QueryIntent, mode: PromptMode): SearchCandidate {
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

  return {
    ...candidate,
    rerankScore: score,
  };
}

function selectEvidence(candidates: SearchCandidate[], intent: QueryIntent): SearchCandidate[] {
  const selected: SearchCandidate[] = [];
  const fingerprintCounts = new Map<string, number>();
  const documentCounts = new Map<string, number>();

  for (let pass = 0; pass < MAX_EVIDENCE_PER_DOCUMENT && selected.length < EVIDENCE_TOP_K; pass += 1) {
    for (const candidate of candidates) {
      if (selected.some((item) => item.id === candidate.id)) continue;

      const documentCount = documentCounts.get(candidate.documentId) ?? 0;
      if (documentCount > pass || documentCount >= MAX_EVIDENCE_PER_DOCUMENT) continue;

      const fingerprint = `${candidate.docTitle}:${candidate.articleNo ?? candidate.sectionPath.join('>')}`;
      const fingerprintCount = fingerprintCounts.get(fingerprint) ?? 0;
      if (fingerprintCount >= 2) continue;

      if (intent !== 'synthesis' && selected.some((item) => item.id === candidate.id)) {
        continue;
      }

      selected.push(candidate);
      documentCounts.set(candidate.documentId, documentCount + 1);
      fingerprintCounts.set(fingerprint, fingerprintCount + 1);
      if (selected.length >= EVIDENCE_TOP_K) break;
    }
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

export function searchCorpus(params: {
  index: RagCorpusIndex;
  query: string;
  mode: PromptMode;
  queryEmbedding?: number[] | null;
}): SearchRun {
  const { index, query, mode, queryEmbedding = null } = params;
  const intent = detectIntent(mode, query);
  const exactCandidates = index.chunks
    .filter((chunk) => mode !== 'evaluation' || chunk.mode === 'evaluation')
    .map((chunk) => scoreExact(chunk, query, intent, mode))
    .filter((candidate) => candidate.exactScore > 0)
    .sort((left, right) => {
      const scoreDiff = right.exactScore - left.exactScore;
      return scoreDiff !== 0 ? scoreDiff : compareIsoDateDesc(left.effectiveDate, right.effectiveDate);
    })
    .slice(0, FUSED_TOP_K);

  const lexicalCandidates = scoreLexical(index, query, mode).slice(0, FUSED_TOP_K);
  const vectorCandidates = scoreVector(index, queryEmbedding, mode);
  const fusedCandidates = reciprocalRankFuse([exactCandidates, lexicalCandidates, vectorCandidates])
    .map((candidate) => rerankCandidate(candidate, intent, mode))
    .sort((left, right) => right.rerankScore - left.rerankScore)
    .slice(0, FUSED_TOP_K);

  const evidence = selectEvidence(fusedCandidates, intent);
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
  };
}
