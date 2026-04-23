import { compareIsoDateDesc, detectIntent, extractArticleNo, tokenize } from './ragMetadata';
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
  SearchRun,
  ServiceScopeId,
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
  chunkScoreBoosts?: Map<string, number>;
  excludedEvidenceRoles?: Set<SourceRole>;
  lawRefs?: ParsedLawReference[];
  queryType?: NaturalLanguageQueryType;
  semanticFrame?: SemanticFrame;
  selectedServiceScopes?: ServiceScopeId[];
  retrievalPriorityClass?: RetrievalPriorityClass;
  retrievalPriorityPolicy?: RetrievalPriorityPolicy;
  evaluationLinked?: boolean;
  precomputedVectorCandidates?: SearchCandidate[];
}

const VECTOR_TOP_K = 36;
const FUSED_TOP_K = 24;
const EVIDENCE_TOP_K = 12;
const CHECKLIST_EVIDENCE_TOP_K = 14;
const MAX_EVIDENCE_CLUSTERS_PER_DOCUMENT = 2;
const CHECKLIST_MAX_EVIDENCE_CLUSTERS_PER_DOCUMENT = 3;
const MAX_WINDOWS_PER_CLUSTER = 2;
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
  const aliasCompact = compactForMetadata(alias);
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

function compact(value: string): string {
  return value.replace(/\s+/g, '').toLowerCase();
}

function scoreLawReference(
  chunk: StructuredChunk,
  lawRef: ParsedLawReference,
  titleCompact: string,
  sectionCompact: string,
  matchedTerms: Set<string>,
): number {
  let score = 0;
  const lawCompact = compact(lawRef.canonicalLawName);

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

function scoreExact(
  chunk: StructuredChunk,
  query: string,
  intent: QueryIntent,
  mode: PromptMode,
  queryAliases: string[] = [],
  options?: SearchOptions,
): SearchCandidate {
  const candidate = createCandidate(chunk);
  const compactQuery = compactForMetadata(query);
  const titleCompact = compactForMetadata(chunk.docTitle);
  const fileNameCompact = compactForMetadata(chunk.fileName);
  const sectionCompact = compactForMetadata(chunk.sectionPath.join(' '));
  const documentQueryProbe = stripDocumentQueryNoise(compactQuery);
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

  const queryArticle = extractArticleNo(query);
  if (queryArticle && chunk.articleNo === queryArticle) {
    score += 40;
    matchedTerms.add(queryArticle);
  } else if (queryArticle && chunk.searchText.includes(queryArticle)) {
    score += 18;
    matchedTerms.add(queryArticle);
  }

  for (const token of queryTokens(query)) {
    const compactToken = compactForMetadata(token);
    if (titleCompact.includes(compactToken)) {
      score += 6;
      matchedTerms.add(token);
    }
    if (sectionCompact.includes(compactToken)) {
      score += 4;
      matchedTerms.add(token);
    }
  }

  for (const alias of queryAliases) {
    score += scoreAliasMetadata(alias, titleCompact, sectionCompact, matchedTerms);
  }

  for (const lawRef of options?.lawRefs ?? []) {
    score += scoreLawReference(chunk, lawRef, titleCompact, sectionCompact, matchedTerms);
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

function isThinEvaluationIndicatorChunk(candidate: SearchCandidate): boolean {
  if (candidate.sourceType !== 'evaluation' || candidate.sourceRole !== 'primary_evaluation') return false;

  const meaningfulText = candidate.text
    .replace(/해당\s*없음/gu, '')
    .replace(/[\s#*_`>|:.\-()[\]{}]/g, '')
    .trim();
  return meaningfulText.length < 24;
}

function rerankCandidate(
  candidate: SearchCandidate,
  intent: QueryIntent,
  mode: PromptMode,
  options?: SearchOptions,
): SearchCandidate {
  const ontologyScore = options?.documentScoreBoosts?.get(candidate.documentId) ?? 0;
  const chunkScoreBoost = options?.chunkScoreBoosts?.get(candidate.id) ?? 0;
  const semanticScore = scoreSemanticAlignment(candidate, options?.semanticFrame);
  let matchedTerms = candidate.matchedTerms;
  let score = candidate.fusedScore * 100;
  score += candidate.exactScore * 1.8;
  score += candidate.lexicalScore * 15;
  score += candidate.vectorScore * 30;
  score += ontologyScore;
  score += chunkScoreBoost;
  score += semanticScore;

  if (intent === 'legal-exact' && candidate.articleNo) score += 10;
  if (intent === 'legal-exact' && ['law', 'ordinance', 'rule', 'notice'].includes(candidate.sourceType)) score += 8;
  if (intent === 'manual-qna' && candidate.sourceType === 'qa') score += 8;
  if (intent === 'manual-qna' && ['manual', 'guide', 'wiki'].includes(candidate.sourceType)) score += 5;
  if (intent === 'synthesis' && candidate.sourceType === 'comparison') score += 6;
  if (mode === 'evaluation' && candidate.mode === 'evaluation') score += 6;

  if (
    mode === 'evaluation' &&
    candidate.sourceType === 'evaluation' &&
    candidate.sourceRole === 'primary_evaluation' &&
    candidate.matchedTerms.some((term) => !CANDIDATE_METADATA_TERMS.has(term))
  ) {
    score += 6;
    if (candidate.matchedTerms.some((term) => FOOD_PREFERENCE_EVALUATION_MATCH_RE.test(term))) {
      score += 56;
    }
    matchedTerms = Array.from(new Set([...candidate.matchedTerms, 'evaluation-indicator']));
  }

  if (mode === 'evaluation') {
    score += scoreEvaluationAuthority(candidate);
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
    ontologyScore: ontologyScore + semanticScore,
  };
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
  const compact = query.replace(/\s+/g, '');
  const checklistCueTerms = ['해야할', '해야하는', '해야되는', '할일', '체크리스트', '무엇', '뭐', '안내', '설명', '교육', '업무', '절차'];
  const onboardingOrOperationalTerms = ['입소', '신규', '초기', '준비', '수급자', '보호자', '직원', '평가', '오면', '왔을때', '처음'];
  const broadChecklistCue =
    checklistCueTerms.some((term) => compact.includes(term));
  const onboardingOrOperationalCue =
    onboardingOrOperationalTerms.some((term) => compact.includes(term));

  return broadChecklistCue && onboardingOrOperationalCue;
}

function selectEvidence(candidates: SearchCandidate[], query: string, options?: SearchOptions): SearchCandidate[] {
  const selected: SearchCandidate[] = [];
  const documentClusters = new Map<string, Set<string>>();
  const clusterWindowCounts = new Map<string, number>();
  const useChecklistExpansion = shouldExpandChecklistEvidence(query);
  const evidenceTopK = useChecklistExpansion ? CHECKLIST_EVIDENCE_TOP_K : EVIDENCE_TOP_K;
  const maxEvidenceClustersPerDocument = useChecklistExpansion
    ? CHECKLIST_MAX_EVIDENCE_CLUSTERS_PER_DOCUMENT
    : MAX_EVIDENCE_CLUSTERS_PER_DOCUMENT;

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
    .map((chunk) => scoreExact(chunk, query, intent, mode, queryAliases, options))
    .filter((candidate) => candidate.exactScore > 0)
    .sort((left, right) => {
      const scoreDiff = right.exactScore - left.exactScore;
      return scoreDiff !== 0 ? scoreDiff : compareIsoDateDesc(left.effectiveDate, right.effectiveDate);
    })
    .slice(0, FUSED_TOP_K * 4);
  const diversifiedExactCandidates = diversifyCandidatePool(exactCandidates, FUSED_TOP_K);

  const lexicalCandidates = scoreLexical(index, query, mode, options).slice(0, FUSED_TOP_K);
  const vectorCandidates = options?.precomputedVectorCandidates ?? scoreVector(index, queryEmbedding, mode, options);
  const fusedCandidates = reciprocalRankFuse([diversifiedExactCandidates, lexicalCandidates, vectorCandidates])
    .map((candidate) => rerankCandidate(candidate, intent, mode, options))
    .sort((left, right) => right.rerankScore - left.rerankScore)
    .slice(0, FUSED_TOP_K);

  const evidence = selectEvidence(fusedCandidates, query, options);
  const { focusTerms, mismatchSignals } = detectTopicMismatch(query, fusedCandidates);
  const confidence = inferConfidence(intent, evidence, mismatchSignals);

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
