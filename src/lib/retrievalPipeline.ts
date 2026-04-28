import {
  deriveFocusTerms,
  diversifyVisibleCandidates,
  getCandidateFocusMatches,
  isGenericQueryTerm,
} from './ragEngine';
import { getProcedureEvidenceMatches, isProcedureLikeQuery } from './koreanCompounds';
import { safeTrim } from './textGuards';
import type {
  CandidateDiagnostic,
  ChunkWindowRef,
  SearchCandidate,
  SearchRun,
  SectionRoutingDecision,
  StructuredChunk,
} from './ragTypes';

export interface RetrievalScopeContext {
  routeOnlyDocumentIds: Set<string>;
  primaryExpansionDocumentIds: Set<string>;
  routingDocuments: string[];
  primaryExpansionDocuments: string[];
}

function uniqueNonEmptyLines(values: unknown[]): string[] {
  return Array.from(new Set(values.map((value) => safeTrim(value)).filter(Boolean)));
}

export function summarizeSectionRouting(chunks: StructuredChunk[], enabled: boolean): SectionRoutingDecision {
  if (!enabled || chunks.length === 0) {
    return {
      enabled,
      strategy: 'chunk_only',
      selectedSectionIds: [],
      selectedSectionTitles: [],
      selectedDocumentIds: [],
      detail: enabled ? 'No section route could be derived from the current candidate set.' : 'Section routing is disabled by profile.',
    };
  }

  const sectionMap = new Map<string, { title: string; documentId: string; count: number }>();
  for (const chunk of chunks) {
    const current = sectionMap.get(chunk.parentSectionId) ?? {
      title: chunk.parentSectionTitle,
      documentId: chunk.documentId,
      count: 0,
    };
    current.count += 1;
    sectionMap.set(chunk.parentSectionId, current);
  }

  const selected = Array.from(sectionMap.entries())
    .sort((left, right) => right[1].count - left[1].count)
    .slice(0, 3);

  return {
    enabled: true,
    strategy: 'document_to_section',
    selectedSectionIds: selected.map(([sectionId]) => sectionId),
    selectedSectionTitles: selected.map(([, value]) => value.title),
    selectedDocumentIds: Array.from(new Set(selected.map(([, value]) => value.documentId))),
    detail: selected.length > 0 ? `Top routed sections: ${selected.map(([, value]) => value.title).join(', ')}` : 'No routed section selected.',
  };
}

export function applySectionRoutingBoost(search: SearchRun, enabled: boolean): SearchRun {
  if (!enabled || search.fusedCandidates.length === 0) {
    return search;
  }

  const topSectionIds = new Set(search.fusedCandidates.slice(0, 6).map((candidate) => candidate.parentSectionId));
  const fusedCandidates = search.fusedCandidates
    .map((candidate) =>
      topSectionIds.has(candidate.parentSectionId)
        ? {
            ...candidate,
            rerankScore: candidate.rerankScore + 3,
            matchedTerms: uniqueNonEmptyLines([...candidate.matchedTerms, 'section-routing']),
          }
        : candidate,
    )
    .sort((left, right) => right.rerankScore - left.rerankScore);

  return {
    ...search,
    fusedCandidates,
    evidence: diversifyVisibleCandidates(fusedCandidates, Math.max(search.evidence.length, 12)),
  };
}

export function buildChunkWindowRef(
  chunk: StructuredChunk,
  relation: ChunkWindowRef['relation'],
  selectedAsEvidence: boolean,
): ChunkWindowRef {
  return {
    id: chunk.id,
    documentId: chunk.documentId,
    path: chunk.path,
    docTitle: chunk.docTitle,
    articleNo: chunk.articleNo,
    sectionPath: chunk.sectionPath,
    parentSectionId: chunk.parentSectionId,
    parentSectionTitle: chunk.parentSectionTitle,
    windowIndex: chunk.windowIndex,
    spanStart: chunk.spanStart,
    spanEnd: chunk.spanEnd,
    relation,
    selectedAsEvidence,
  };
}

export function uniqueDocumentPaths(chunks: Array<Pick<StructuredChunk, 'documentId' | 'path'>>): string[] {
  const seen = new Set<string>();
  const paths: string[] = [];
  for (const chunk of chunks) {
    if (seen.has(chunk.documentId)) continue;
    seen.add(chunk.documentId);
    paths.push(chunk.path);
  }
  return paths;
}

export function documentPathsFromIds(documentIds: Iterable<string>, representatives: Map<string, StructuredChunk>): string[] {
  const paths: string[] = [];
  for (const documentId of documentIds) {
    const chunk = representatives.get(documentId);
    if (!chunk) continue;
    paths.push(chunk.path);
  }
  return paths;
}

export function mergeDocumentScoreBoostMaps(...maps: Array<Map<string, number>>): Map<string, number> {
  const merged = new Map<string, number>();
  for (const map of maps) {
    for (const [documentId, score] of map.entries()) {
      merged.set(documentId, (merged.get(documentId) ?? 0) + score);
    }
  }
  return merged;
}

export function buildDocumentRepresentativeMap(chunks: StructuredChunk[]): Map<string, StructuredChunk> {
  const representatives = new Map<string, StructuredChunk>();
  for (const chunk of chunks) {
    if (!representatives.has(chunk.documentId)) {
      representatives.set(chunk.documentId, chunk);
    }
  }
  return representatives;
}

export function uniqueDocumentCandidates(candidates: SearchCandidate[], limit = 4): SearchCandidate[] {
  const seen = new Set<string>();
  const documents: SearchCandidate[] = [];

  for (const candidate of candidates) {
    if (seen.has(candidate.documentId)) continue;
    seen.add(candidate.documentId);
    documents.push(candidate);
    if (documents.length >= limit) break;
  }

  return documents;
}

export function injectEvidenceCandidates(search: SearchRun, candidates: Array<SearchCandidate | null>): SearchRun {
  const uniqueCandidates: SearchCandidate[] = [];
  const seenDocuments = new Set(search.evidence.map((item) => item.documentId));
  for (const candidate of candidates) {
    if (!candidate) continue;
    if (seenDocuments.has(candidate.documentId)) {
      const existing =
        search.evidence.find((item) => item.documentId === candidate.documentId) ??
        search.fusedCandidates.find((item) => item.documentId === candidate.documentId);
      if (existing && !uniqueCandidates.some((item) => item.documentId === existing.documentId)) {
        uniqueCandidates.push(existing);
      }
      continue;
    }
    uniqueCandidates.push(candidate);
    seenDocuments.add(candidate.documentId);
    if (uniqueCandidates.length >= 4) break;
  }

  if (uniqueCandidates.length === 0) return search;

  const topScore = search.fusedCandidates[0]?.rerankScore ?? uniqueCandidates[0].rerankScore;
  const promotedCandidates = uniqueCandidates.map((candidate, index) =>
    candidate.sourceRole === 'primary_evaluation' || candidate.sourceRole === 'support_reference'
      ? {
          ...candidate,
          rerankScore: Math.max(candidate.rerankScore, topScore + 1 - index * 0.1),
          matchedTerms: Array.from(new Set([...candidate.matchedTerms, 'routing-expanded-primary'])),
        }
      : candidate,
  );
  const promotedIds = new Set(promotedCandidates.map((candidate) => candidate.id));

  return applyGroundingGate({
    ...search,
    fusedCandidates: diversifyVisibleCandidates(
      [...promotedCandidates, ...search.fusedCandidates.filter((item) => !promotedIds.has(item.id))]
        .sort((left, right) => right.rerankScore - left.rerankScore),
      Math.max(search.fusedCandidates.length, 24),
    ),
    evidence: diversifyVisibleCandidates(
      [...promotedCandidates, ...search.evidence.filter((item) => !promotedIds.has(item.id))]
        .sort((left, right) => right.rerankScore - left.rerankScore),
      Math.max(search.evidence.length, 12),
    ),
  });
}

export function buildCandidateDiagnostics(
  search: SearchRun,
  neighborWindows: ChunkWindowRef[],
  scope: RetrievalScopeContext,
): CandidateDiagnostic[] {
  const focusTerms = search.focusTerms ?? deriveFocusTerms(search.query);
  const evidenceIds = new Set(search.evidence.map((item) => item.id));
  const selectedClusters = new Set(search.evidence.map((item) => item.citationGroupId));
  const selectedDocuments = new Set(search.evidence.map((item) => item.documentId));
  const neighborWindowIds = new Set(neighborWindows.map((item) => item.id));

  return search.fusedCandidates.map((candidate) => {
    const focusTermMatches = getCandidateFocusMatches(candidate, focusTerms);
    const concreteMatchedTerms = candidate.matchedTerms.filter((term) => !term.includes('-'));
    const matchedOnlyGenericTerms =
      focusTermMatches.length === 0 &&
      (concreteMatchedTerms.length === 0 || concreteMatchedTerms.every((term) => isGenericQueryTerm(term)));
    const rejectionReasons: string[] = [];
    const selectedAsEvidence = evidenceIds.has(candidate.id);
    const routeOnly = scope.routeOnlyDocumentIds.has(candidate.documentId);
    const expandedFromRouting = scope.primaryExpansionDocumentIds.has(candidate.documentId);
    const primaryExpansionHit = expandedFromRouting && selectedAsEvidence;

    if (!selectedAsEvidence) {
      if (routeOnly) {
        rejectionReasons.push('route-only-document');
      }
      if (matchedOnlyGenericTerms) {
        rejectionReasons.push('generic-only-match');
      }
      if (selectedDocuments.has(candidate.documentId) && !selectedClusters.has(candidate.citationGroupId)) {
        rejectionReasons.push('document-cluster-limit');
      }
      if (selectedClusters.has(candidate.citationGroupId) && !neighborWindowIds.has(candidate.id)) {
        rejectionReasons.push('non-adjacent-window-in-selected-cluster');
      }
      if (candidate.rerankScore < (search.evidence.at(-1)?.rerankScore ?? Infinity)) {
        rejectionReasons.push('lower-rerank-score-than-selected-evidence');
      }
      if (candidate.vectorScore <= 0) {
        rejectionReasons.push('no-vector-signal');
      }
    }

    return {
      id: candidate.id,
      path: candidate.path,
      docTitle: candidate.docTitle,
      sourceRole: candidate.sourceRole,
      rerankScore: candidate.rerankScore,
      matchedTerms: candidate.matchedTerms,
      focusTermMatches,
      selectedAsEvidence,
      routeOnly,
      expandedFromRouting,
      primaryExpansionHit,
      matchedOnlyGenericTerms,
      rejectionReasons,
      citationGroupId: candidate.citationGroupId,
      parentSectionId: candidate.parentSectionId,
      windowIndex: candidate.windowIndex,
    };
  });
}

function hasExactArticleGrounding(evidence: SearchRun['evidence']): boolean {
  return evidence.some(
    (candidate) =>
      candidate.exactScore >= 40 ||
      Boolean(candidate.articleNo && candidate.matchedTerms.includes(candidate.articleNo)),
  );
}

function hasSequentialDocumentGrounding(evidence: SearchRun['evidence']): boolean {
  const chunkIndexesByDocument = new Map<string, number[]>();
  for (const candidate of evidence) {
    const key = `${candidate.documentId}:${candidate.parentSectionId}`;
    const list = chunkIndexesByDocument.get(key) ?? [];
    list.push(candidate.windowIndex);
    chunkIndexesByDocument.set(key, list);
  }

  for (const indexes of chunkIndexesByDocument.values()) {
    const sorted = indexes.slice().sort((left, right) => left - right);
    for (let index = 1; index < sorted.length; index += 1) {
      if (sorted[index] - sorted[index - 1] === 1) {
        return true;
      }
    }
  }

  return false;
}

function hasCrossDocumentGrounding(evidence: SearchRun['evidence'], focusTerms: string[]): boolean {
  const supportedDocuments = new Set(
    evidence
      .filter((candidate) => {
        const focusMatches = getCandidateFocusMatches(candidate, focusTerms);
        if (focusMatches.length > 0) return true;
        if (candidate.exactScore >= 25) return true;
        return candidate.lexicalScore > 0;
      })
      .map((candidate) => candidate.documentId),
  );
  return supportedDocuments.size >= 2;
}

function getCandidateGroundingText(candidate: SearchCandidate): string {
  return [
    candidate.docTitle,
    candidate.parentSectionTitle,
    ...candidate.sectionPath,
    candidate.searchText,
    candidate.textPreview,
    candidate.text,
  ].join(' ');
}

function hasProcedureGrounding(search: SearchRun, focusTerms: string[]): boolean {
  if (!isProcedureLikeQuery(search.query) || search.evidence.length < 2) return false;

  const matchedProcedureTerms = new Set<string>();
  const supportedEvidence = search.evidence.filter((candidate) => {
    const groundingText = getCandidateGroundingText(candidate);
    const procedureMatches = getProcedureEvidenceMatches(groundingText);
    procedureMatches.forEach((term) => matchedProcedureTerms.add(term));

    return (
      procedureMatches.length >= 2 ||
      getCandidateFocusMatches(candidate, focusTerms).length > 0 ||
      candidate.lexicalScore > 0 ||
      candidate.exactScore >= 10
    );
  });

  return supportedEvidence.length >= 2 && matchedProcedureTerms.size >= 3;
}

const GROUNDING_GATE_SIGNAL = 'grounding-gate-failed';
const ORIGINAL_FOCUS_GATE_SIGNAL = 'insufficient-original-focus-terms-in-top-candidates';

function clearGateSignals(search: SearchRun, staleSignals: string[]): string[] {
  const staleSignalSet = new Set(staleSignals);
  return Array.from(new Set((search.mismatchSignals ?? []).filter((signal) => !staleSignalSet.has(signal))));
}

function resolveGateConfidence(search: SearchRun, mismatchSignals: string[], staleSignals: string[]): SearchRun['confidence'] {
  if (mismatchSignals.length > 0) return 'low';
  if (search.confidence === 'low' && staleSignals.some((signal) => search.mismatchSignals?.includes(signal))) {
    return 'medium';
  }
  return search.confidence;
}

export function applyGroundingGate(search: SearchRun): SearchRun {
  const focusTerms = search.focusTerms ?? deriveFocusTerms(search.query);
  const hasGrounding =
    hasExactArticleGrounding(search.evidence) ||
    hasSequentialDocumentGrounding(search.evidence) ||
    hasCrossDocumentGrounding(search.evidence, focusTerms) ||
    hasProcedureGrounding(search, focusTerms);

  const mismatchSignals = clearGateSignals(search, [GROUNDING_GATE_SIGNAL]);
  if (!hasGrounding) {
    mismatchSignals.push(GROUNDING_GATE_SIGNAL);
  }

  return {
    ...search,
    confidence: resolveGateConfidence(search, mismatchSignals, [GROUNDING_GATE_SIGNAL]),
    mismatchSignals: Array.from(new Set(mismatchSignals)),
    groundingGatePassed: hasGrounding,
  };
}

function hasRequiredFocusMatches(candidates: SearchCandidate[], focusTerms: string[], relaxed = false): boolean {
  if (focusTerms.length === 0 || candidates.length === 0) return true;
  const topCandidates = candidates.slice(0, 10);
  const matchedFocusTerms = new Set(topCandidates.flatMap((candidate) => getCandidateFocusMatches(candidate, focusTerms)));
  const requiredMatches = relaxed ? 1 : Math.min(focusTerms.length >= 3 ? 2 : 1, focusTerms.length);
  return matchedFocusTerms.size >= requiredMatches;
}

function downgradeFocusConfidence(confidence: SearchRun['confidence'], relaxed: boolean): SearchRun['confidence'] {
  if (relaxed && confidence === 'medium') return 'medium';
  if (confidence === 'high') return 'medium';
  if (confidence === 'medium') return 'low';
  return confidence;
}

export function applyOriginalFocusGate(search: SearchRun, originalQuery: string, focusAliases: string[] = []): SearchRun {
  const focusTerms = deriveFocusTerms(originalQuery);
  const relaxedFocusGate = isProcedureLikeQuery(originalQuery);
  if (focusTerms.length === 0 || search.fusedCandidates.length === 0) return search;

  if (hasRequiredFocusMatches(search.fusedCandidates, focusTerms, relaxedFocusGate)) {
    const mismatchSignals = clearGateSignals(search, [ORIGINAL_FOCUS_GATE_SIGNAL]);
    return {
      ...search,
      confidence: resolveGateConfidence(search, mismatchSignals, [ORIGINAL_FOCUS_GATE_SIGNAL]),
      mismatchSignals,
    };
  }

  const aliasFocusTerms = uniqueNonEmptyLines(focusAliases.flatMap((alias) => deriveFocusTerms(alias)));
  if (hasRequiredFocusMatches(search.fusedCandidates, aliasFocusTerms, relaxedFocusGate)) {
    const mismatchSignals = clearGateSignals(search, [ORIGINAL_FOCUS_GATE_SIGNAL]);
    return {
      ...search,
      confidence: resolveGateConfidence(search, mismatchSignals, [ORIGINAL_FOCUS_GATE_SIGNAL]),
      mismatchSignals,
    };
  }

  const mismatchSignals = clearGateSignals(search, [ORIGINAL_FOCUS_GATE_SIGNAL]);
  mismatchSignals.push(ORIGINAL_FOCUS_GATE_SIGNAL);

  return {
    ...search,
    confidence: downgradeFocusConfidence(search.confidence, relaxedFocusGate),
    mismatchSignals: Array.from(new Set(mismatchSignals)),
    groundingGatePassed: search.groundingGatePassed,
  };
}

export function buildRetrievalStageTrace(
  search: SearchRun,
  normalizedQuery: string,
  querySources: string[],
  scope: RetrievalScopeContext,
): SearchRun['stageTrace'] {
  const stages: SearchRun['stageTrace'] = [
    {
      stage: 'query_normalization',
      inputCount: querySources.length > 0 ? querySources.length : 1,
      outputCount: normalizedQuery.trim() ? 1 : 0,
      notes: querySources.length > 1 ? ['follow-up-query-combined'] : ['latest-user-query'],
    },
    {
      stage: 'lexical_candidates',
      inputCount: 1,
      outputCount: search.lexicalCandidates.length,
      notes: search.lexicalCandidates.length > 0 ? [`top=${search.lexicalCandidates[0].docTitle}`] : ['no-lexical-match'],
    },
    {
      stage: 'vector_candidates',
      inputCount: 1,
      outputCount: search.vectorCandidates.length,
      notes: search.vectorCandidates.length > 0 ? [`top=${search.vectorCandidates[0].docTitle}`] : ['vector-unavailable-or-empty'],
    },
  ];

  if (scope.routingDocuments.length > 0 || scope.primaryExpansionDocuments.length > 0) {
    stages.push({
      stage: 'section_routing',
      inputCount: search.fusedCandidates.length,
      outputCount: scope.primaryExpansionDocuments.length,
      notes: [
        ...(scope.routingDocuments.length > 0 ? [`routing=${scope.routingDocuments.length}`] : []),
        ...(scope.primaryExpansionDocuments.length > 0 ? [`expanded=${scope.primaryExpansionDocuments.length}`] : []),
      ],
    });
  }

  stages.push({
    stage: 'fusion',
    inputCount: search.exactCandidates.length + search.lexicalCandidates.length + search.vectorCandidates.length,
    outputCount: search.fusedCandidates.length,
    notes: [
      `exact=${search.exactCandidates.length}`,
      `lexical=${search.lexicalCandidates.length}`,
      `vector=${search.vectorCandidates.length}`,
    ],
  });
  stages.push({
    stage: 'document_diversification',
    inputCount: search.fusedCandidates.length,
    outputCount: search.evidence.length,
    notes: [
      `documents=${new Set(search.evidence.map((item) => item.documentId)).size}`,
      `clusters=${new Set(search.evidence.map((item) => item.citationGroupId)).size}`,
    ],
  });
  stages.push({
    stage: 'answer_evidence_gate',
    inputCount: search.evidence.length,
    outputCount: search.groundingGatePassed ? search.evidence.length : 0,
    notes: search.mismatchSignals && search.mismatchSignals.length > 0 ? search.mismatchSignals : [search.groundingGatePassed ? 'grounding-passed' : 'grounding-failed'],
  });
  return stages;
}
