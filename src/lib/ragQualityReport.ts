import { detectSourceType, inferDocumentGroup, inferSourceRole } from './ragMetadata';
import type {
  BenchmarkCorpusPhaseLatencySummary,
  BenchmarkEvaluationAuthorityTraceSummary,
  BenchmarkIntegratedRerankedPathSummary,
  BenchmarkLexicalPoolReuseSummary,
  BenchmarkLexicalScoreCacheSummary,
  BenchmarkPerformanceSummary,
  BenchmarkSemanticValidationLatencySummary,
  BenchmarkSearchStoreLatencySummary,
  BenchmarkSlowCaseSummary,
} from './ragBenchmarkReport';
import type { IndexManifestEntry, KnowledgeDoctorIssue, PromptMode, SourceRole, SourceType } from './ragTypes';

const HIGH_CHUNK_COUNT_THRESHOLD = 100;
const LOW_CHUNK_COUNT_THRESHOLD = 1;
const LOW_CHUNK_DOCUMENT_SIZE_THRESHOLD = 2000;
const OVERSIZED_CHUNK_CHARS = 2400;
const SHORT_NOISY_CHUNK_CHARS = 32;

export interface RagBenchmarkSummaryInput {
  totalCases: number;
  top3Hits?: number;
  top5Hits?: number;
  expectedEvidenceHits?: number;
  forbiddenEvidencePasses?: number;
  requiredCitationHits?: number;
  failedCaseIds?: string[];
  failedRecallCaseIds?: string[];
  failedEvidenceCaseIds?: string[];
  acceptedAbstainCaseIds?: string[];
  performance?: BenchmarkPerformanceSummary;
}

export interface RagQualityReportInput {
  manifestEntries: IndexManifestEntry[];
  doctorIssues?: KnowledgeDoctorIssue[];
  chunks?: RagQualityChunkInput[];
  benchmark?: RagBenchmarkSummaryInput;
  generatedAt?: string;
}

export interface RagQualityChunkInput {
  documentId?: string;
  document_id?: string;
  docTitle?: string;
  doc_title?: string;
  path?: string;
  text?: string;
  matchedLabels?: string[];
  matched_labels?: unknown;
  parentSectionId?: string;
  parent_section_id?: string;
  parentSectionTitle?: string;
  parent_section_title?: string;
  windowIndex?: number;
  window_index?: number;
  listGroupId?: string | null;
  list_group_id?: string | null;
  containsCheckList?: boolean;
  contains_checklist?: boolean;
}

export interface RagQualityDocumentReport {
  documentId: string;
  path: string;
  name: string;
  mode: PromptMode;
  sourceType: SourceType;
  sourceRole: SourceRole;
  documentGroup: string;
  chunkCount: number;
  embeddingCount: number;
  embeddingCoverageRatio: number;
  size: number;
  doctorIssueCount: number;
  doctorIssueCodes: string[];
}

export interface RagQualitySourceTypeDiagnostics {
  sourceType: SourceType;
  documentCount: number;
  chunkCount: number;
  embeddingCount: number;
  embeddingCoverageRatio: number;
  averageChunksPerDocument: number;
  doctorIssueCount: number;
  doctorIssueCodeCounts: Partial<Record<KnowledgeDoctorIssue['code'], number>>;
}

export interface RagQualityChunkPolicyDiagnostics {
  policy: string;
  chunkCount: number;
  protectedChunkCount: number;
  checklistChunkCount: number;
  oversizedChunkCount: number;
  shortNoisyChunkCount: number;
  boundaryReasonCounts: Record<string, number>;
}

export interface RagQualityParentSectionDiagnostics {
  documentId: string;
  docTitle: string;
  path: string;
  parentSectionId: string;
  parentSectionTitle: string;
  chunkCount: number;
  firstWindowIndex: number;
  lastWindowIndex: number;
}

export interface RagQualityParentChildDiagnostics {
  parentSectionCount: number;
  multiWindowParentSectionCount: number;
  isolatedParentSectionCount: number;
  averageChunksPerParentSection: number;
  maxChunksPerParentSection: number;
  neighborExpandableChunkCount: number;
  neighborCandidateWindowCount: number;
  topParentSections: RagQualityParentSectionDiagnostics[];
}

export interface RagQualityBenchmarkReport {
  totalCases: number;
  top3Hits: number;
  top5Hits: number;
  expectedEvidenceHits: number;
  forbiddenEvidencePasses: number;
  requiredCitationHits: number;
  top3HitRate: number;
  top5HitRate: number;
  expectedEvidenceHitRate: number;
  forbiddenEvidencePassRate: number;
  requiredCitationHitRate: number;
  failedCaseIds: string[];
  failedRecallCaseIds: string[];
  failedEvidenceCaseIds: string[];
  acceptedAbstainCaseIds: string[];
  performance?: BenchmarkPerformanceSummary;
}

export interface RagQualityReport {
  generatedAt: string;
  summary: {
    documentCount: number;
    chunkCount: number;
    embeddingCount: number;
    embeddingCoverageRatio: number;
    modeCounts: Record<PromptMode, number>;
    doctorIssueCount: number;
  };
  coverage: {
    zeroChunkDocuments: RagQualityDocumentReport[];
    zeroEmbeddingDocuments: RagQualityDocumentReport[];
    partialEmbeddingDocuments: RagQualityDocumentReport[];
  };
  chunkDiagnostics: {
    bySourceType: RagQualitySourceTypeDiagnostics[];
    byPolicy: RagQualityChunkPolicyDiagnostics[];
    policyTaggedChunkCount: number;
    protectedChunkCount: number;
    checklistChunkCount: number;
    oversizedChunkCount: number;
    shortNoisyChunkCount: number;
    boundaryReasonCounts: Record<string, number>;
    parentChild: RagQualityParentChildDiagnostics;
    doctorIssueCodeCounts: Partial<Record<KnowledgeDoctorIssue['code'], number>>;
    highChunkDocuments: RagQualityDocumentReport[];
    lowChunkDocuments: RagQualityDocumentReport[];
    embeddingScopeNote: string;
  };
  documents: RagQualityDocumentReport[];
  benchmark?: RagQualityBenchmarkReport;
}

function safeRatio(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return numerator / denominator;
}

function countByPath(issues: KnowledgeDoctorIssue[]): Map<string, KnowledgeDoctorIssue[]> {
  const grouped = new Map<string, KnowledgeDoctorIssue[]>();
  for (const issue of issues) {
    const current = grouped.get(issue.path) ?? [];
    current.push(issue);
    grouped.set(issue.path, current);
  }
  return grouped;
}

function countIssueCodes(issues: KnowledgeDoctorIssue[]): Partial<Record<KnowledgeDoctorIssue['code'], number>> {
  const counts: Partial<Record<KnowledgeDoctorIssue['code'], number>> = {};
  for (const issue of issues) {
    counts[issue.code] = (counts[issue.code] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right, 'ko')));
}

function normalizeCount(value: number | undefined): number {
  return Number.isFinite(value) && typeof value === 'number' ? value : 0;
}

function buildBenchmarkReport(input: RagBenchmarkSummaryInput): RagQualityBenchmarkReport {
  const totalCases = normalizeCount(input.totalCases);
  const top3Hits = normalizeCount(input.top3Hits);
  const top5Hits = normalizeCount(input.top5Hits);
  const expectedEvidenceHits = normalizeCount(input.expectedEvidenceHits);
  const forbiddenEvidencePasses = normalizeCount(input.forbiddenEvidencePasses);
  const requiredCitationHits = normalizeCount(input.requiredCitationHits);

  return {
    totalCases,
    top3Hits,
    top5Hits,
    expectedEvidenceHits,
    forbiddenEvidencePasses,
    requiredCitationHits,
    top3HitRate: safeRatio(top3Hits, totalCases),
    top5HitRate: safeRatio(top5Hits, totalCases),
    expectedEvidenceHitRate: safeRatio(expectedEvidenceHits, totalCases),
    forbiddenEvidencePassRate: safeRatio(forbiddenEvidencePasses, totalCases),
    requiredCitationHitRate: safeRatio(requiredCitationHits, totalCases),
    failedCaseIds: input.failedCaseIds ?? [],
    failedRecallCaseIds: input.failedRecallCaseIds ?? [],
    failedEvidenceCaseIds: input.failedEvidenceCaseIds ?? [],
    acceptedAbstainCaseIds: input.acceptedAbstainCaseIds ?? [],
    performance: input.performance,
  };
}

function inferEntryDocumentShape(entry: IndexManifestEntry): {
  sourceType: SourceType;
  sourceRole: SourceRole;
  documentGroup: string;
} {
  const sourceType = detectSourceType(entry.name, entry.path);
  return {
    sourceType,
    sourceRole: inferSourceRole({
      path: entry.path,
      fileName: entry.name,
      mode: entry.mode,
      sourceType,
    }),
    documentGroup: inferDocumentGroup(entry.name, sourceType),
  };
}

function buildSourceTypeDiagnostics(
  documents: RagQualityDocumentReport[],
  issuesByPath: Map<string, KnowledgeDoctorIssue[]>,
): RagQualitySourceTypeDiagnostics[] {
  const bySourceType = new Map<SourceType, RagQualityDocumentReport[]>();
  for (const document of documents) {
    const current = bySourceType.get(document.sourceType) ?? [];
    current.push(document);
    bySourceType.set(document.sourceType, current);
  }

  return Array.from(bySourceType.entries())
    .map(([sourceType, sourceTypeDocuments]) => {
      const chunkCount = sourceTypeDocuments.reduce((sum, document) => sum + document.chunkCount, 0);
      const embeddingCount = sourceTypeDocuments.reduce((sum, document) => sum + document.embeddingCount, 0);
      const issues = sourceTypeDocuments.flatMap((document) => issuesByPath.get(document.path) ?? []);

      return {
        sourceType,
        documentCount: sourceTypeDocuments.length,
        chunkCount,
        embeddingCount,
        embeddingCoverageRatio: safeRatio(embeddingCount, chunkCount),
        averageChunksPerDocument: safeRatio(chunkCount, sourceTypeDocuments.length),
        doctorIssueCount: issues.length,
        doctorIssueCodeCounts: countIssueCodes(issues),
      };
    })
    .sort((left, right) => left.sourceType.localeCompare(right.sourceType, 'ko'));
}

function normalizeMatchedLabels(value: RagQualityChunkInput): string[] {
  if (Array.isArray(value.matchedLabels)) return value.matchedLabels.map(String);
  if (Array.isArray(value.matched_labels)) return value.matched_labels.map(String);
  return [];
}

function extractLabelValue(labels: string[], prefix: string): string | undefined {
  return labels.find((label) => label.startsWith(prefix))?.slice(prefix.length);
}

function incrementCount(counts: Record<string, number>, key: string): void {
  counts[key] = (counts[key] ?? 0) + 1;
}

function sortedCounts(counts: Record<string, number>): Record<string, number> {
  return Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right, 'ko')));
}

function roundMetric(value: number): number {
  return Number(value.toFixed(1));
}

function isProtectedChunk(chunk: RagQualityChunkInput, labels: string[]): boolean {
  return (
    labels.some((label) => label.startsWith('chunk-protected:')) ||
    Boolean(chunk.listGroupId || chunk.list_group_id)
  );
}

function isChecklistChunk(chunk: RagQualityChunkInput, labels: string[]): boolean {
  return (
    labels.includes('chunk-protected:checklist') ||
    chunk.containsCheckList === true ||
    chunk.contains_checklist === true
  );
}

function buildChunkPolicyDiagnostics(chunks: RagQualityChunkInput[]): {
  byPolicy: RagQualityChunkPolicyDiagnostics[];
  policyTaggedChunkCount: number;
  protectedChunkCount: number;
  checklistChunkCount: number;
  oversizedChunkCount: number;
  shortNoisyChunkCount: number;
  boundaryReasonCounts: Record<string, number>;
} {
  const policyStats = new Map<string, RagQualityChunkPolicyDiagnostics>();
  const boundaryReasonCounts: Record<string, number> = {};
  let policyTaggedChunkCount = 0;
  let protectedChunkCount = 0;
  let checklistChunkCount = 0;
  let oversizedChunkCount = 0;
  let shortNoisyChunkCount = 0;

  for (const chunk of chunks) {
    const labels = normalizeMatchedLabels(chunk);
    const policy = extractLabelValue(labels, 'chunk-policy:') ?? 'unclassified';
    const boundaryReason = extractLabelValue(labels, 'chunk-boundary:') ?? 'unknown';
    const text = String(chunk.text ?? '');
    const protectedChunk = isProtectedChunk(chunk, labels);
    const checklistChunk = isChecklistChunk(chunk, labels);
    const oversizedChunk = text.length > OVERSIZED_CHUNK_CHARS;
    const shortNoisyChunk = text.trim().length > 0 && text.trim().length < SHORT_NOISY_CHUNK_CHARS && !protectedChunk;

    if (policy !== 'unclassified') policyTaggedChunkCount += 1;
    if (protectedChunk) protectedChunkCount += 1;
    if (checklistChunk) checklistChunkCount += 1;
    if (oversizedChunk) oversizedChunkCount += 1;
    if (shortNoisyChunk) shortNoisyChunkCount += 1;
    incrementCount(boundaryReasonCounts, boundaryReason);

    const current =
      policyStats.get(policy) ??
      {
        policy,
        chunkCount: 0,
        protectedChunkCount: 0,
        checklistChunkCount: 0,
        oversizedChunkCount: 0,
        shortNoisyChunkCount: 0,
        boundaryReasonCounts: {},
      };
    current.chunkCount += 1;
    if (protectedChunk) current.protectedChunkCount += 1;
    if (checklistChunk) current.checklistChunkCount += 1;
    if (oversizedChunk) current.oversizedChunkCount += 1;
    if (shortNoisyChunk) current.shortNoisyChunkCount += 1;
    incrementCount(current.boundaryReasonCounts, boundaryReason);
    policyStats.set(policy, current);
  }

  return {
    byPolicy: Array.from(policyStats.values())
      .map((item) => ({
        ...item,
        boundaryReasonCounts: sortedCounts(item.boundaryReasonCounts),
      }))
      .sort((left, right) => left.policy.localeCompare(right.policy, 'ko')),
    policyTaggedChunkCount,
    protectedChunkCount,
    checklistChunkCount,
    oversizedChunkCount,
    shortNoisyChunkCount,
    boundaryReasonCounts: sortedCounts(boundaryReasonCounts),
  };
}

function normalizeChunkNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function buildParentChildDiagnostics(chunks: RagQualityChunkInput[]): RagQualityParentChildDiagnostics {
  const byParent = new Map<
    string,
    {
      documentId: string;
      docTitle: string;
      path: string;
      parentSectionId: string;
      parentSectionTitle: string;
      windowIndexes: number[];
    }
  >();

  for (const chunk of chunks) {
    const documentId = String(chunk.documentId ?? chunk.document_id ?? '');
    const parentSectionId = String(chunk.parentSectionId ?? chunk.parent_section_id ?? '');
    const windowIndex = normalizeChunkNumber(chunk.windowIndex ?? chunk.window_index);
    if (!documentId || !parentSectionId || windowIndex === undefined) continue;

    const key = `${documentId}:${parentSectionId}`;
    const current =
      byParent.get(key) ??
      {
        documentId,
        docTitle: String(chunk.docTitle ?? chunk.doc_title ?? documentId),
        path: String(chunk.path ?? ''),
        parentSectionId,
        parentSectionTitle: String(chunk.parentSectionTitle ?? chunk.parent_section_title ?? parentSectionId),
        windowIndexes: [],
      };
    current.windowIndexes.push(windowIndex);
    byParent.set(key, current);
  }

  const parentSections = Array.from(byParent.values()).map((item): RagQualityParentSectionDiagnostics => {
    const uniqueWindowIndexes = Array.from(new Set(item.windowIndexes)).sort((left, right) => left - right);
    return {
      documentId: item.documentId,
      docTitle: item.docTitle,
      path: item.path,
      parentSectionId: item.parentSectionId,
      parentSectionTitle: item.parentSectionTitle,
      chunkCount: uniqueWindowIndexes.length,
      firstWindowIndex: uniqueWindowIndexes[0] ?? 0,
      lastWindowIndex: uniqueWindowIndexes.at(-1) ?? 0,
    };
  });

  let neighborExpandableChunkCount = 0;
  let neighborCandidateWindowCount = 0;
  for (const item of byParent.values()) {
    const indexes = new Set(item.windowIndexes);
    for (const windowIndex of indexes) {
      const hasPrevious = indexes.has(windowIndex - 1);
      const hasNext = indexes.has(windowIndex + 1);
      if (hasPrevious || hasNext) neighborExpandableChunkCount += 1;
      if (hasPrevious) neighborCandidateWindowCount += 1;
      if (hasNext) neighborCandidateWindowCount += 1;
    }
  }

  const parentSectionCount = parentSections.length;
  const totalChunks = parentSections.reduce((sum, item) => sum + item.chunkCount, 0);

  return {
    parentSectionCount,
    multiWindowParentSectionCount: parentSections.filter((item) => item.chunkCount > 1).length,
    isolatedParentSectionCount: parentSections.filter((item) => item.chunkCount === 1).length,
    averageChunksPerParentSection: parentSectionCount > 0 ? roundMetric(totalChunks / parentSectionCount) : 0,
    maxChunksPerParentSection: parentSections.reduce((max, item) => Math.max(max, item.chunkCount), 0),
    neighborExpandableChunkCount,
    neighborCandidateWindowCount,
    topParentSections: parentSections
      .sort(
        (left, right) =>
          right.chunkCount - left.chunkCount ||
          left.path.localeCompare(right.path, 'ko') ||
          left.parentSectionTitle.localeCompare(right.parentSectionTitle, 'ko'),
      )
      .slice(0, 10),
  };
}

export function buildRagQualityReport(input: RagQualityReportInput): RagQualityReport {
  const doctorIssues = input.doctorIssues ?? [];
  const issuesByPath = countByPath(doctorIssues);
  const modeCounts: Record<PromptMode, number> = { integrated: 0, evaluation: 0 };
  const chunks = input.chunks ?? [];
  const chunkPolicyDiagnostics = buildChunkPolicyDiagnostics(chunks);
  const parentChildDiagnostics = buildParentChildDiagnostics(chunks);

  const documents = input.manifestEntries
    .map((entry): RagQualityDocumentReport => {
      const issues = issuesByPath.get(entry.path) ?? [];
      const documentShape = inferEntryDocumentShape(entry);
      modeCounts[entry.mode] += 1;
      return {
        documentId: entry.documentId,
        path: entry.path,
        name: entry.name,
        mode: entry.mode,
        sourceType: documentShape.sourceType,
        sourceRole: documentShape.sourceRole,
        documentGroup: documentShape.documentGroup,
        chunkCount: entry.chunkCount,
        embeddingCount: entry.embeddingCount,
        embeddingCoverageRatio: safeRatio(entry.embeddingCount, entry.chunkCount),
        size: entry.size,
        doctorIssueCount: issues.length,
        doctorIssueCodes: Array.from(new Set(issues.map((issue) => issue.code))).sort(),
      };
    })
    .sort((left, right) => left.path.localeCompare(right.path, 'ko'));

  const chunkCount = documents.reduce((sum, document) => sum + document.chunkCount, 0);
  const embeddingCount = documents.reduce((sum, document) => sum + document.embeddingCount, 0);
  const highChunkDocuments = documents
    .filter((document) => document.chunkCount >= HIGH_CHUNK_COUNT_THRESHOLD)
    .sort((left, right) => right.chunkCount - left.chunkCount || left.path.localeCompare(right.path, 'ko'));
  const lowChunkDocuments = documents
    .filter(
      (document) =>
        document.chunkCount > 0 &&
        document.chunkCount <= LOW_CHUNK_COUNT_THRESHOLD &&
        document.size >= LOW_CHUNK_DOCUMENT_SIZE_THRESHOLD,
    )
    .sort((left, right) => right.size - left.size || left.path.localeCompare(right.path, 'ko'));

  return {
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    summary: {
      documentCount: documents.length,
      chunkCount,
      embeddingCount,
      embeddingCoverageRatio: safeRatio(embeddingCount, chunkCount),
      modeCounts,
      doctorIssueCount: doctorIssues.length,
    },
    coverage: {
      zeroChunkDocuments: documents.filter((document) => document.chunkCount === 0),
      zeroEmbeddingDocuments: documents.filter((document) => document.chunkCount > 0 && document.embeddingCount === 0),
      partialEmbeddingDocuments: documents.filter(
        (document) => document.embeddingCount > 0 && document.embeddingCount < document.chunkCount,
      ),
    },
    chunkDiagnostics: {
      bySourceType: buildSourceTypeDiagnostics(documents, issuesByPath),
      ...chunkPolicyDiagnostics,
      parentChild: parentChildDiagnostics,
      doctorIssueCodeCounts: countIssueCodes(doctorIssues),
      highChunkDocuments,
      lowChunkDocuments,
      embeddingScopeNote:
        'Embedding counts are read from the local manifest; server-side DB embeddings may differ until a DB-level embedding diagnostic is connected.',
    },
    documents,
    benchmark: input.benchmark ? buildBenchmarkReport(input.benchmark) : undefined,
  };
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatDocumentList(documents: RagQualityDocumentReport[]): string {
  if (documents.length === 0) return '- 없음';
  return documents
    .map(
      (document) =>
        `- ${document.path} — type ${document.sourceType}, role ${document.sourceRole}, chunks ${document.chunkCount}, embeddings ${document.embeddingCount}, issues ${document.doctorIssueCodes.join(', ') || 'none'}`,
    )
    .join('\n');
}

function formatIssueCounts(counts: Partial<Record<KnowledgeDoctorIssue['code'], number>>): string {
  const entries = Object.entries(counts);
  if (entries.length === 0) return '- 없음';
  return entries.map(([code, count]) => `- ${code}: ${count}`).join('\n');
}

function formatGenericCounts(counts: Record<string, number>): string {
  const entries = Object.entries(counts);
  if (entries.length === 0) return 'none';
  return entries.map(([key, count]) => `${key}=${count}`).join(', ');
}

function formatSlowCaseOutputs(stageOutputCounts: BenchmarkSlowCaseSummary['stageOutputCounts']): string {
  const entries = Object.entries(stageOutputCounts);
  if (entries.length === 0) return 'no-stage-counts';
  return entries.map(([stage, count]) => `${stage}=${count}`).join(', ');
}

function formatSubSearchLatency(subSearchLatencyMs: BenchmarkSlowCaseSummary['subSearchLatencyMs']): string {
  const entries = Object.entries(subSearchLatencyMs);
  if (entries.length === 0) return 'none';
  return entries.map(([stage, latencyMs]) => `${stage}=${latencyMs}ms`).join(', ');
}

function formatRetrievalPhaseLatency(retrievalPhaseLatencyMs: BenchmarkSlowCaseSummary['retrievalPhaseLatencyMs']): string {
  const entries = Object.entries(retrievalPhaseLatencyMs);
  if (entries.length === 0) return 'none';
  return entries.map(([stage, latencyMs]) => `${stage}=${latencyMs}ms`).join(', ');
}

function formatExecuteSearchPhaseLatency(executeSearchPhaseLatencyMs: BenchmarkSlowCaseSummary['executeSearchPhaseLatencyMs']): string {
  const entries = Object.entries(executeSearchPhaseLatencyMs);
  if (entries.length === 0) return 'none';
  return entries.map(([stage, latencyMs]) => `${stage}=${latencyMs}ms`).join(', ');
}

function formatOntologyExpansionDiagnostics(
  ontologyExpansionDiagnostics: BenchmarkSlowCaseSummary['ontologyExpansionDiagnostics'],
): string {
  if (ontologyExpansionDiagnostics.length === 0) return 'none';
  return ontologyExpansionDiagnostics
    .map(
      (item) =>
        `${item.stage} seeds=${item.seedDocuments}, hits=${item.hits}, boosts=${item.boostedDocuments}, trace=${item.traceEntries}, elapsed=${item.elapsedMs}ms`,
    )
    .join('; ');
}

function formatSlowCaseSearchMemo(item: BenchmarkSlowCaseSummary): string {
  if (!item.searchMemoStats) return 'search-memo none';
  return `search-memo hits=${item.searchMemoStats.hits}, misses=${item.searchMemoStats.misses}, size=${item.searchMemoStats.size}`;
}

function formatGuardResultCounts(counts: Record<string, number>): string {
  const entries = Object.entries(counts);
  if (entries.length === 0) return 'none';
  return entries.map(([result, count]) => `${result}=${count}`).join(', ');
}

function formatLexicalPoolReuse(summary: BenchmarkLexicalPoolReuseSummary | undefined): string[] {
  if (!summary || (summary.casesWithDiagnostics === 0 && Object.keys(summary.guardResultCounts).length === 0)) {
    return [];
  }

  return [
    `- Lexical pool reuse: cases ${summary.casesWithDiagnostics}, avg coverage ${summary.averageCoverage.toFixed(1)}%, min coverage ${summary.minCoverage.toFixed(1)}%, full/partial ${summary.fullCoverageCases}/${summary.partialCoverageCases}, guard ${formatGuardResultCounts(summary.guardResultCounts)}`,
  ];
}

function formatNeighborWindowExpansion(performance: BenchmarkPerformanceSummary): string[] {
  const summary = performance.neighborWindowExpansion;
  if (!summary || summary.casesWithDiagnostics === 0) return [];

  return [
    `- Neighbor window expansion: cases ${summary.casesWithDiagnostics}, candidate windows ${summary.expansionCandidateWindows}, avg candidates ${summary.averageExpansionCandidates.toFixed(1)}, current/previous/next ${summary.currentWindows}/${summary.previousWindows}/${summary.nextWindows}`,
  ];
}

function formatSmallToBigContext(performance: BenchmarkPerformanceSummary): string[] {
  const summary = performance.smallToBigContext;
  if (!summary || summary.casesWithDiagnostics === 0) return [];

  return [
    `- Small-to-big context: cases ${summary.casesWithDiagnostics}, included/candidate ${summary.totalIncludedWindows}/${summary.totalCandidateWindows}, skipped ${summary.totalSkippedWindows} (chunks ${summary.totalSkippedByMaxChunks}, chars ${summary.totalSkippedByMaxChars}), chars ${summary.totalIncludedChars}, inclusion rate ${(summary.inclusionRate * 100).toFixed(1)}%`,
  ];
}

function formatIntegratedRerankedPath(summary: BenchmarkIntegratedRerankedPathSummary | undefined): string[] {
  if (!summary || summary.casesWithRerankedPath === 0) return [];

  return [
    `- Integrated reranked path: cases ${summary.casesWithRerankedPath}, sub-search avg ${summary.averageSubSearchMs}ms, p95 ${summary.p95SubSearchMs}ms, max ${summary.maxSubSearchMs}ms, phase total avg ${summary.averagePhaseTotalMs}ms, exact input/output avg ${summary.averageExactInputChunks}/${summary.averageExactCandidateCount}, lexical input/output avg ${summary.averageLexicalInputChunks}/${summary.averageLexicalCandidateCount}, rerank/entity/diversify avg ${summary.averageFusionRerankMs}/${summary.averageFusionEntityMs}/${summary.averageFusionDiversifyMs}ms, slow cases ${summary.slowCaseIds.join(', ') || 'none'}`,
  ];
}

function formatSemanticValidationLatency(summary: BenchmarkSemanticValidationLatencySummary | undefined): string[] {
  if (!summary || summary.casesWithTiming === 0) return [];

  return [
    `- Semantic validation latency: cases ${summary.casesWithTiming}, avg ${summary.averageMs}ms, p95 ${summary.p95Ms}ms, max ${summary.maxMs}ms, avg retrieval share ${(summary.averageRetrievalShare * 100).toFixed(1)}%, slow cases ${summary.slowCaseIds.join(', ') || 'none'}`,
  ];
}

function formatEvaluationAuthorityTrace(summary: BenchmarkEvaluationAuthorityTraceSummary | undefined): string[] {
  if (!summary || summary.casesWithExpectedDoc === 0) return [];

  return [
    `- Evaluation authority trace: cases ${summary.casesWithExpectedDoc}, lexical/exact/fusion top matches ${summary.lexicalTopMatches}/${summary.exactTopMatches}/${summary.fusionTopMatches}, visible Top-5 matches ${summary.visibleTop5Matches}, drift ${summary.driftCases}, missed Top-5 ${summary.missedTop5Cases}`,
  ];
}

function formatLexicalScoreCache(summary: BenchmarkLexicalScoreCacheSummary | undefined): string[] {
  if (!summary || (summary.totalHits === 0 && summary.totalMisses === 0)) {
    return [];
  }

  const totalLookups = summary.totalHits + summary.totalMisses;
  return [
    `- Lexical score cache: hits ${summary.totalHits}, misses ${summary.totalMisses}, cases with hits ${summary.casesWithHits}/${summary.casesWithTrace}, hit rate ${totalLookups > 0 ? (summary.hitRate * 100).toFixed(1) : '0.0'}%`,
  ];
}

function formatSearchStoreLatency(items: BenchmarkSearchStoreLatencySummary[] | undefined): string[] {
  const lines = (items ?? [])
    .slice(0, 8)
    .map(
      (item) =>
        `- ${item.stage}: cases ${item.caseCount}, total avg ${item.averageTotalMs}ms, p95 ${item.p95TotalMs}ms, db lexical avg ${item.averageDbLexicalMs}ms, vector avg ${item.averageVectorMs}ms, corpus avg ${item.averageCorpusMs}ms, db/vector candidates ${item.averageDbLexicalCandidates}/${item.averageVectorCandidates}, slow cases ${item.slowCaseIds.join(', ') || 'none'}`,
    );

  return [
    '',
    '### Search store latency breakdown',
    '',
    ...(lines.length > 0 ? lines : ['- none']),
  ];
}

function formatCorpusPhaseLatency(items: BenchmarkCorpusPhaseLatencySummary[] | undefined): string[] {
  const lines = (items ?? [])
    .slice(0, 8)
    .map(
      (item) =>
        `- ${item.stage}: cases ${item.caseCount}, total avg ${item.averageTotalMs}ms, p95 ${item.p95TotalMs}ms, lexical pool avg ${item.averageLexicalPoolMs}ms, exact avg ${item.averageExactMs}ms, lexical avg ${item.averageLexicalMs}ms, vector avg ${item.averageVectorMs}ms, fusion avg ${item.averageFusionMs}ms, evidence avg ${item.averageEvidenceMs}ms, exact input avg ${item.averageExactInputChunks}, exact scored avg ${item.averageExactScoredChunks}, exact output avg ${item.averageExactCandidateCount}, lexical input avg ${item.averageLexicalInputChunks}, lexical output avg ${item.averageLexicalCandidateCount}, fusion detail rrf avg ${item.averageFusionRrfMs}ms, rerank avg ${item.averageFusionRerankMs}ms, entity avg ${item.averageFusionEntityMs}ms, merge avg ${item.averageFusionMergeMs}ms, diversify avg ${item.averageFusionDiversifyMs}ms, slow cases ${item.slowCaseIds.join(', ') || 'none'}`,
    );

  return [
    '',
    '### Search corpus phase timing',
    '',
    ...(lines.length > 0 ? lines : ['- none']),
  ];
}

function formatBenchmarkPerformance(performance: BenchmarkPerformanceSummary | undefined): string[] {
  if (!performance) return [];
  const retrieval = performance.stageLatencyMs.retrievalMs;
  const queryEmbedding = performance.stageLatencyMs.queryEmbeddingMs;
  const retrievalSetup = performance.stageLatencyMs.retrievalSetupMs;
  const total = performance.stageLatencyMs.totalMs;
  const searchMemoLookups = performance.searchMemo.totalHits + performance.searchMemo.totalMisses;
  const subSearchLatencyLines = performance.subSearchLatencySummary
    .slice(0, 8)
    .map(
      (item) =>
        `- ${item.stage}: cases ${item.caseCount}, avg ${item.averageMs}ms, p95 ${item.p95Ms}ms, max ${item.maxMs}ms, slow cases ${item.slowCaseIds.join(', ') || 'none'}`,
    );
  const candidateLines = performance.candidateOutputCounts
    .slice(0, 8)
    .map((item) => `- Stage ${item.stage}: avg output ${item.averageOutputCount}, max output ${item.maxOutputCount}`);
  const slowCaseLines = performance.slowCases
    .slice(0, 8)
    .map(
      (item) =>
        `- ${item.id}: total ${item.totalMs}ms, retrieval ${item.retrievalMs}ms, sub-search total ${item.subSearchTotalMs}ms, retrieval overhead ${item.retrievalOverheadMs}ms, dominant ${item.dominantLatencyStage} ${item.dominantLatencyMs}ms, ${formatSlowCaseSearchMemo(item)}, sub-search ${formatSubSearchLatency(item.subSearchLatencyMs)}, retrieval phases ${formatRetrievalPhaseLatency(item.retrievalPhaseLatencyMs)}, execute-search phases ${formatExecuteSearchPhaseLatency(item.executeSearchPhaseLatencyMs)}, ontology expansion ${formatOntologyExpansionDiagnostics(item.ontologyExpansionDiagnostics)}, outputs ${formatSlowCaseOutputs(item.stageOutputCounts)}`,
    );

  return [
    '',
    '### Benchmark Performance',
    '',
    `- Total duration: ${performance.totalDurationMs}ms`,
    `- Case latency: avg ${performance.caseLatencyMs.average}ms, p50 ${performance.caseLatencyMs.p50}ms, p95 ${performance.caseLatencyMs.p95}ms, max ${performance.caseLatencyMs.max}ms`,
    ...(retrieval
      ? [`- Retrieval latency: avg ${retrieval.average}ms, p50 ${retrieval.p50}ms, p95 ${retrieval.p95}ms, max ${retrieval.max}ms`]
      : []),
    ...(queryEmbedding
      ? [
          `- Query embedding latency: avg ${queryEmbedding.average}ms, p50 ${queryEmbedding.p50}ms, p95 ${queryEmbedding.p95}ms, max ${queryEmbedding.max}ms`,
        ]
      : []),
    ...(retrievalSetup
      ? [
          `- Retrieval setup latency: avg ${retrievalSetup.average}ms, p50 ${retrievalSetup.p50}ms, p95 ${retrievalSetup.p95}ms, max ${retrievalSetup.max}ms`,
        ]
      : []),
    ...(total
      ? [`- Total stage latency: avg ${total.average}ms, p50 ${total.p50}ms, p95 ${total.p95}ms, max ${total.max}ms`]
      : []),
    `- Search memo: hits ${performance.searchMemo.totalHits}, misses ${performance.searchMemo.totalMisses}, cases with hits ${performance.searchMemo.casesWithHits}/${performance.searchMemo.casesWithTrace}, hit rate ${searchMemoLookups > 0 ? (performance.searchMemo.hitRate * 100).toFixed(1) : '0.0'}%`,
    ...formatLexicalScoreCache(performance.lexicalScoreCache),
    ...formatLexicalPoolReuse(performance.lexicalPoolReuse),
    ...formatNeighborWindowExpansion(performance),
    ...formatSmallToBigContext(performance),
    ...formatIntegratedRerankedPath(performance.integratedRerankedPath),
    ...formatSemanticValidationLatency(performance.semanticValidationLatency),
    ...formatEvaluationAuthorityTrace(performance.evaluationAuthorityTrace),
    '',
    '### Sub-search latency targets',
    '',
    ...(subSearchLatencyLines.length > 0 ? subSearchLatencyLines : ['- none']),
    ...formatSearchStoreLatency(performance.searchStoreLatencySummary),
    ...formatCorpusPhaseLatency(performance.corpusPhaseLatencySummary),
    '',
    '### Candidate output counts',
    '',
    ...(candidateLines.length > 0 ? candidateLines : ['- none']),
    '',
    '### Slow benchmark cases',
    '',
    ...(slowCaseLines.length > 0 ? slowCaseLines : ['- none']),
  ];
}

function formatSourceTypeDiagnostics(items: RagQualitySourceTypeDiagnostics[]): string {
  if (items.length === 0) return '- 없음';
  return items
    .map(
      (item) =>
        `- ${item.sourceType}: documents ${item.documentCount}, chunks ${item.chunkCount}, avg chunks ${item.averageChunksPerDocument.toFixed(1)}, embeddings ${item.embeddingCount}, embedding coverage ${formatPercent(item.embeddingCoverageRatio)}, issues ${item.doctorIssueCount}`,
    )
    .join('\n');
}

function formatChunkPolicyDiagnostics(items: RagQualityChunkPolicyDiagnostics[]): string {
  if (items.length === 0) return '- none';
  return items
    .map(
      (item) =>
        `- ${item.policy}: chunks ${item.chunkCount}, protected ${item.protectedChunkCount}, checklist ${item.checklistChunkCount}, oversized ${item.oversizedChunkCount}, short-noisy ${item.shortNoisyChunkCount}, boundaries ${formatGenericCounts(item.boundaryReasonCounts)}`,
    )
    .join('\n');
}

function formatParentChildDiagnostics(item: RagQualityParentChildDiagnostics): string[] {
  const topSectionLines = item.topParentSections.map(
    (section) =>
      `- ${section.path} / ${section.parentSectionTitle}: chunks ${section.chunkCount}, windows ${section.firstWindowIndex}-${section.lastWindowIndex}`,
  );

  return [
    '### Parent-child baseline',
    '',
    `- Parent sections: ${item.parentSectionCount}`,
    `- Multi-window parent sections: ${item.multiWindowParentSectionCount}`,
    `- Isolated parent sections: ${item.isolatedParentSectionCount}`,
    `- Average chunks per parent section: ${item.averageChunksPerParentSection}`,
    `- Max chunks per parent section: ${item.maxChunksPerParentSection}`,
    `- Neighbor-expandable chunks: ${item.neighborExpandableChunkCount}`,
    `- Neighbor candidate windows: ${item.neighborCandidateWindowCount}`,
    '',
    ...(topSectionLines.length > 0 ? topSectionLines : ['- none']),
  ];
}

export function formatRagQualityReportMarkdown(report: RagQualityReport): string {
  const benchmarkLines = report.benchmark
    ? [
        '## Benchmark',
        '',
        `- Total cases: ${report.benchmark.totalCases}`,
        `- Top-3 hit rate: ${formatPercent(report.benchmark.top3HitRate)} (${report.benchmark.top3Hits}/${report.benchmark.totalCases})`,
        `- Top-5 hit rate: ${formatPercent(report.benchmark.top5HitRate)} (${report.benchmark.top5Hits}/${report.benchmark.totalCases})`,
        `- Expected evidence hit rate: ${formatPercent(report.benchmark.expectedEvidenceHitRate)}`,
        `- Forbidden evidence pass rate: ${formatPercent(report.benchmark.forbiddenEvidencePassRate)}`,
        `- Required citation hit rate: ${formatPercent(report.benchmark.requiredCitationHitRate)}`,
        `- Failed cases: ${report.benchmark.failedCaseIds.length > 0 ? report.benchmark.failedCaseIds.join(', ') : 'none'}`,
        `- Failed recall cases: ${report.benchmark.failedRecallCaseIds.length > 0 ? report.benchmark.failedRecallCaseIds.join(', ') : 'none'}`,
        `- Failed evidence cases: ${report.benchmark.failedEvidenceCaseIds.length > 0 ? report.benchmark.failedEvidenceCaseIds.join(', ') : 'none'}`,
        `- Accepted abstain cases: ${report.benchmark.acceptedAbstainCaseIds.length > 0 ? report.benchmark.acceptedAbstainCaseIds.join(', ') : 'none'}`,
        ...formatBenchmarkPerformance(report.benchmark.performance),
        '',
      ]
    : ['## Benchmark', '', '- 아직 benchmark 결과가 연결되지 않았다.', ''];

  return [
    '# RAG Quality Report',
    '',
    `Generated at: ${report.generatedAt}`,
    '',
    '## Summary',
    '',
    `- Documents: ${report.summary.documentCount}`,
    `- Chunks: ${report.summary.chunkCount}`,
    `- Embeddings: ${report.summary.embeddingCount}`,
    `- Embedding coverage: ${formatPercent(report.summary.embeddingCoverageRatio)}`,
    `- Integrated documents: ${report.summary.modeCounts.integrated}`,
    `- Evaluation documents: ${report.summary.modeCounts.evaluation}`,
    `- Doctor issues: ${report.summary.doctorIssueCount}`,
    '',
    '## Coverage Alerts',
    '',
    '### Zero chunk documents',
    '',
    formatDocumentList(report.coverage.zeroChunkDocuments),
    '',
    '### Zero embedding documents',
    '',
    formatDocumentList(report.coverage.zeroEmbeddingDocuments),
    '',
    '### Partial embedding documents',
    '',
    formatDocumentList(report.coverage.partialEmbeddingDocuments),
    '',
    '## Chunk Diagnostics',
    '',
    '### By source type',
    '',
    formatSourceTypeDiagnostics(report.chunkDiagnostics.bySourceType),
    '',
    '### By chunk policy',
    '',
    `- Policy-tagged chunks: ${report.chunkDiagnostics.policyTaggedChunkCount}/${report.summary.chunkCount}`,
    `- Protected chunks: ${report.chunkDiagnostics.protectedChunkCount}`,
    `- Checklist chunks: ${report.chunkDiagnostics.checklistChunkCount}`,
    `- Oversized chunks: ${report.chunkDiagnostics.oversizedChunkCount}`,
    `- Short/noisy chunks: ${report.chunkDiagnostics.shortNoisyChunkCount}`,
    `- Boundary reasons: ${formatGenericCounts(report.chunkDiagnostics.boundaryReasonCounts)}`,
    '',
    formatChunkPolicyDiagnostics(report.chunkDiagnostics.byPolicy),
    '',
    ...formatParentChildDiagnostics(report.chunkDiagnostics.parentChild),
    '',
    '### Doctor issue codes',
    '',
    formatIssueCounts(report.chunkDiagnostics.doctorIssueCodeCounts),
    '',
    '### High chunk documents',
    '',
    formatDocumentList(report.chunkDiagnostics.highChunkDocuments),
    '',
    '### Low chunk documents',
    '',
    formatDocumentList(report.chunkDiagnostics.lowChunkDocuments),
    '',
    `Note: ${report.chunkDiagnostics.embeddingScopeNote}`,
    '',
    ...benchmarkLines,
  ].join('\n');
}
