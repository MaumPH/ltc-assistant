import * as path from 'path';

export interface BenchmarkOutputTargetInput {
  projectRoot: string;
  generatedAt: string;
  requestedOutputPath?: string;
}

export interface BenchmarkOutputTargets {
  primaryPath: string;
  archivePath: string;
}

export interface BenchmarkOutcomeResultInput {
  id: string;
  top5Hit: boolean;
  expectedEvidenceHit: boolean;
  forbiddenEvidencePass: boolean;
  requiredCitationHit: boolean;
  acceptableAbstain?: boolean;
  abstained?: boolean;
}

export interface BenchmarkOutcomeSummary {
  failedCaseIds: string[];
  failedRecallCaseIds: string[];
  failedEvidenceCaseIds: string[];
  acceptedAbstainCaseIds: string[];
}

export type BenchmarkLatencyKey =
  | 'queryNormalizationMs'
  | 'cacheLookupMs'
  | 'hydeMs'
  | 'retrievalMs'
  | 'fallbackMs'
  | 'planningMs'
  | 'answerMs'
  | 'totalMs';

export interface BenchmarkStageTraceInput {
  stage: string;
  outputCount: number;
  notes?: string[];
}

export interface BenchmarkPlannerTraceInput {
  step: string;
  detail: string;
}

export interface BenchmarkNeighborWindowInput {
  id?: string;
  relation: 'previous' | 'current' | 'next';
  selectedAsEvidence?: boolean;
  parentSectionId?: string;
  windowIndex?: number;
}

export interface BenchmarkPerformanceResultInput {
  id: string;
  expectedDoc?: string;
  top3Hit?: boolean;
  top5Hit?: boolean;
  top5?: Array<{
    docTitle?: string;
  }>;
  latency?: Partial<Record<BenchmarkLatencyKey, number>>;
  stageTrace?: BenchmarkStageTraceInput[];
  plannerTrace?: BenchmarkPlannerTraceInput[];
  neighborWindows?: BenchmarkNeighborWindowInput[];
}

export interface BenchmarkLatencySummary {
  average: number;
  p50: number;
  p95: number;
  max: number;
}

export interface BenchmarkCandidateOutputSummary {
  stage: string;
  averageOutputCount: number;
  maxOutputCount: number;
}

export interface BenchmarkSlowCaseSummary {
  id: string;
  totalMs: number;
  retrievalMs: number;
  dominantLatencyStage: BenchmarkLatencyKey;
  dominantLatencyMs: number;
  subSearchTotalMs: number;
  retrievalOverheadMs: number;
  retrievalPhaseLatencyMs: Record<string, number>;
  executeSearchPhaseLatencyMs: Record<string, number>;
  ontologyExpansionDiagnostics: BenchmarkOntologyExpansionDiagnostic[];
  searchMemoStats?: BenchmarkSearchMemoStats;
  subSearchLatencyMs: Record<string, number>;
  stageOutputCounts: Record<string, number>;
}

export interface BenchmarkOntologyExpansionDiagnostic {
  stage: string;
  seedDocuments: number;
  hits: number;
  boostedDocuments: number;
  traceEntries: number;
  elapsedMs: number;
}

export interface BenchmarkSearchMemoStats {
  hits: number;
  misses: number;
  size: number;
}

export interface BenchmarkSearchMemoCaseSummary extends BenchmarkSearchMemoStats {
  id: string;
}

export interface BenchmarkSearchMemoSummary {
  totalHits: number;
  totalMisses: number;
  casesWithTrace: number;
  casesWithHits: number;
  hitRate: number;
  cases: BenchmarkSearchMemoCaseSummary[];
}

export interface BenchmarkLexicalScoreCacheCaseSummary extends BenchmarkSearchMemoStats {
  id: string;
}

export interface BenchmarkLexicalScoreCacheSummary {
  totalHits: number;
  totalMisses: number;
  casesWithTrace: number;
  casesWithHits: number;
  hitRate: number;
  cases: BenchmarkLexicalScoreCacheCaseSummary[];
}

export interface BenchmarkSubSearchLatencySummary {
  stage: string;
  caseCount: number;
  averageMs: number;
  p95Ms: number;
  maxMs: number;
  slowCaseIds: string[];
}

export interface BenchmarkSearchStoreLatencySummary {
  stage: string;
  caseCount: number;
  averageTotalMs: number;
  p95TotalMs: number;
  maxTotalMs: number;
  averageDbLexicalMs: number;
  averageVectorMs: number;
  averageCorpusMs: number;
  averageDbLexicalCandidates: number;
  averageVectorCandidates: number;
  slowCaseIds: string[];
}

export interface BenchmarkCorpusPhaseLatencySummary {
  stage: string;
  caseCount: number;
  averageTotalMs: number;
  p95TotalMs: number;
  maxTotalMs: number;
  averageLexicalPoolMs: number;
  averageExactMs: number;
  averageLexicalMs: number;
  averageVectorMs: number;
  averageFusionMs: number;
  averageFusionRrfMs: number;
  averageFusionRerankMs: number;
  averageFusionEntityMs: number;
  averageFusionMergeMs: number;
  averageFusionDiversifyMs: number;
  averageEvidenceMs: number;
  averageExactInputChunks: number;
  averageExactScoredChunks: number;
  averageExactCandidateCount: number;
  averageLexicalInputChunks: number;
  averageLexicalCandidateCount: number;
  slowCaseIds: string[];
}

export interface BenchmarkLexicalPoolReuseCaseSummary {
  id: string;
  targetStage: string;
  previousCandidates: number;
  targetLexicalCandidates: number;
  overlap: number;
  coverage: number;
  sourceStages: string[];
  guardPool?: number;
  guardResult?: string;
}

export interface BenchmarkLexicalPoolReuseSummary {
  casesWithDiagnostics: number;
  averageCoverage: number;
  minCoverage: number;
  fullCoverageCases: number;
  partialCoverageCases: number;
  guardResultCounts: Record<string, number>;
  cases: BenchmarkLexicalPoolReuseCaseSummary[];
}

export interface BenchmarkNeighborWindowCaseSummary {
  id: string;
  totalWindows: number;
  currentWindows: number;
  previousWindows: number;
  nextWindows: number;
  selectedEvidenceWindows: number;
  expansionCandidateWindows: number;
  parentSectionCount: number;
}

export interface BenchmarkNeighborWindowSummary {
  casesWithDiagnostics: number;
  totalWindows: number;
  currentWindows: number;
  previousWindows: number;
  nextWindows: number;
  selectedEvidenceWindows: number;
  expansionCandidateWindows: number;
  averageExpansionCandidates: number;
  cases: BenchmarkNeighborWindowCaseSummary[];
}

export interface BenchmarkSmallToBigContextCaseSummary {
  id: string;
  candidateWindows: number;
  includedWindows: number;
  skippedWindows: number;
  skippedByMaxChunks: number;
  skippedByMaxChars: number;
  includedChars: number;
  maxChars?: number;
}

export interface BenchmarkSmallToBigContextSummary {
  casesWithDiagnostics: number;
  totalCandidateWindows: number;
  totalIncludedWindows: number;
  totalSkippedWindows: number;
  totalSkippedByMaxChunks: number;
  totalSkippedByMaxChars: number;
  totalIncludedChars: number;
  inclusionRate: number;
  cases: BenchmarkSmallToBigContextCaseSummary[];
}

export interface BenchmarkIntegratedRerankedPathCaseSummary {
  id: string;
  subSearchMs: number;
  searchStoreTotalMs: number;
  phaseTotalMs: number;
  lexicalPoolMs: number;
  exactMs: number;
  lexicalMs: number;
  vectorMs: number;
  fusionMs: number;
  fusionRerankMs: number;
  fusionEntityMs: number;
  fusionDiversifyMs: number;
  evidenceMs: number;
  exactInputChunks: number;
  exactCandidateCount: number;
  lexicalInputChunks: number;
  lexicalCandidateCount: number;
}

export interface BenchmarkIntegratedRerankedPathSummary {
  casesWithRerankedPath: number;
  averageSubSearchMs: number;
  p95SubSearchMs: number;
  maxSubSearchMs: number;
  averagePhaseTotalMs: number;
  averageExactInputChunks: number;
  averageExactCandidateCount: number;
  averageLexicalInputChunks: number;
  averageLexicalCandidateCount: number;
  averageFusionRerankMs: number;
  averageFusionEntityMs: number;
  averageFusionDiversifyMs: number;
  slowCaseIds: string[];
  cases: BenchmarkIntegratedRerankedPathCaseSummary[];
}

export interface BenchmarkSemanticValidationLatencyCaseSummary {
  id: string;
  semanticValidationMs: number;
  retrievalMs: number;
  retrievalShare: number;
  evidenceOutputCount: number;
}

export interface BenchmarkSemanticValidationLatencySummary {
  casesWithTiming: number;
  averageMs: number;
  p95Ms: number;
  maxMs: number;
  averageRetrievalShare: number;
  slowCaseIds: string[];
  cases: BenchmarkSemanticValidationLatencyCaseSummary[];
}

export interface BenchmarkEvaluationAuthorityTraceCaseSummary {
  id: string;
  expectedDoc: string;
  top3Hit: boolean;
  top5Hit: boolean;
  lexicalTopDoc?: string;
  exactTopDoc?: string;
  fusionTopDoc?: string;
  visibleTopDoc?: string;
  expectedDocStage: 'lexical-top' | 'exact-top' | 'fusion-top' | 'visible-top5' | 'missing';
  drift: boolean;
}

export interface BenchmarkEvaluationAuthorityTraceSummary {
  casesWithExpectedDoc: number;
  lexicalTopMatches: number;
  exactTopMatches: number;
  fusionTopMatches: number;
  visibleTop5Matches: number;
  driftCases: number;
  missedTop5Cases: number;
  cases: BenchmarkEvaluationAuthorityTraceCaseSummary[];
}

export interface BenchmarkPerformanceSummary {
  totalDurationMs: number;
  caseLatencyMs: BenchmarkLatencySummary;
  stageLatencyMs: Partial<Record<BenchmarkLatencyKey, BenchmarkLatencySummary>>;
  candidateOutputCounts: BenchmarkCandidateOutputSummary[];
  slowCases: BenchmarkSlowCaseSummary[];
  searchMemo: BenchmarkSearchMemoSummary;
  lexicalScoreCache?: BenchmarkLexicalScoreCacheSummary;
  subSearchLatencySummary: BenchmarkSubSearchLatencySummary[];
  searchStoreLatencySummary: BenchmarkSearchStoreLatencySummary[];
  corpusPhaseLatencySummary: BenchmarkCorpusPhaseLatencySummary[];
  lexicalPoolReuse?: BenchmarkLexicalPoolReuseSummary;
  neighborWindowExpansion: BenchmarkNeighborWindowSummary;
  smallToBigContext: BenchmarkSmallToBigContextSummary;
  integratedRerankedPath: BenchmarkIntegratedRerankedPathSummary;
  semanticValidationLatency: BenchmarkSemanticValidationLatencySummary;
  evaluationAuthorityTrace?: BenchmarkEvaluationAuthorityTraceSummary;
}

export interface BenchmarkPerformanceSummaryInput {
  totalDurationMs: number;
  results: BenchmarkPerformanceResultInput[];
}

const LATENCY_KEYS: BenchmarkLatencyKey[] = [
  'queryNormalizationMs',
  'cacheLookupMs',
  'hydeMs',
  'retrievalMs',
  'fallbackMs',
  'planningMs',
  'answerMs',
  'totalMs',
];

function timestampForFileName(value: string): string {
  return value.replace(/[:.]/g, '-');
}

function resolveProjectPath(projectRoot: string, filePath: string): string {
  return path.isAbsolute(filePath) ? filePath : path.join(projectRoot, filePath);
}

export function buildBenchmarkOutputTargets(input: BenchmarkOutputTargetInput): BenchmarkOutputTargets {
  const archivePath = path.join(
    input.projectRoot,
    'benchmarks',
    'results',
    `rag-benchmark-${timestampForFileName(input.generatedAt)}.json`,
  );

  return {
    primaryPath: input.requestedOutputPath
      ? resolveProjectPath(input.projectRoot, input.requestedOutputPath)
      : path.join(input.projectRoot, '.rag-cache', 'rag-benchmark.json'),
    archivePath,
  };
}

export function buildBenchmarkOutcomeSummary(results: BenchmarkOutcomeResultInput[]): BenchmarkOutcomeSummary {
  const acceptedAbstainCaseIds = results
    .filter((result) => result.acceptableAbstain === true && result.abstained === true)
    .map((result) => result.id);
  const acceptedAbstainSet = new Set(acceptedAbstainCaseIds);
  const failedRecallCaseIds = results
    .filter((result) => !result.top5Hit && !acceptedAbstainSet.has(result.id))
    .map((result) => result.id);
  const failedEvidenceCaseIds = results
    .filter((result) => !result.expectedEvidenceHit || !result.forbiddenEvidencePass || !result.requiredCitationHit)
    .map((result) => result.id);

  return {
    failedCaseIds: Array.from(new Set([...failedRecallCaseIds, ...failedEvidenceCaseIds])),
    failedRecallCaseIds,
    failedEvidenceCaseIds,
    acceptedAbstainCaseIds,
  };
}

function roundMetric(value: number): number {
  return Number(value.toFixed(1));
}

function summarizeValues(values: number[]): BenchmarkLatencySummary {
  const sorted = values.filter(Number.isFinite).sort((left, right) => left - right);
  if (sorted.length === 0) {
    return { average: 0, p50: 0, p95: 0, max: 0 };
  }

  const percentile = (ratio: number) => {
    const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1));
    return sorted[index];
  };

  return {
    average: roundMetric(sorted.reduce((sum, value) => sum + value, 0) / sorted.length),
    p50: roundMetric(percentile(0.5)),
    p95: roundMetric(percentile(0.95)),
    max: roundMetric(sorted[sorted.length - 1]),
  };
}

function buildStageOutputCounts(stageTrace: BenchmarkStageTraceInput[] | undefined): Record<string, number> {
  const entries = (stageTrace ?? [])
    .filter((stage) => Number.isFinite(stage.outputCount))
    .map((stage) => [stage.stage, stage.outputCount] as const)
    .sort(([left], [right]) => left.localeCompare(right, 'ko'));
  return Object.fromEntries(entries);
}

function buildSubSearchLatencyMs(plannerTrace: BenchmarkPlannerTraceInput[] | undefined): Record<string, number> {
  const values = new Map<string, number>();
  for (const entry of plannerTrace ?? []) {
    if (entry.step !== 'sub-search-latency') continue;
    for (const part of entry.detail.split(',')) {
      const match = part.trim().match(/^([a-z0-9_.-]+)=(\d+(?:\.\d+)?)ms$/i);
      if (!match) continue;
      values.set(match[1], roundMetric(Number(match[2])));
    }
  }

  return Object.fromEntries(Array.from(values.entries()).sort(([left], [right]) => left.localeCompare(right, 'ko')));
}

function buildRetrievalPhaseLatencyMs(plannerTrace: BenchmarkPlannerTraceInput[] | undefined): Record<string, number> {
  return buildTraceLatencyMap(plannerTrace, 'retrieval-phase-timing');
}

function buildExecuteSearchPhaseLatencyMs(plannerTrace: BenchmarkPlannerTraceInput[] | undefined): Record<string, number> {
  return buildTraceLatencyMap(plannerTrace, 'execute-search-phase-timing');
}

function buildTraceLatencyMap(plannerTrace: BenchmarkPlannerTraceInput[] | undefined, step: string): Record<string, number> {
  const values = new Map<string, number>();
  for (const entry of plannerTrace ?? []) {
    if (entry.step !== step) continue;
    for (const part of entry.detail.split(',')) {
      const match = part.trim().match(/^([a-z0-9_.-]+)=(\d+(?:\.\d+)?)ms$/i);
      if (!match) continue;
      values.set(match[1], Number(match[2]));
    }
  }
  return Object.fromEntries(Array.from(values.entries()).sort(([left], [right]) => left.localeCompare(right)));
}

function buildOntologyExpansionDiagnostics(
  plannerTrace: BenchmarkPlannerTraceInput[] | undefined,
): BenchmarkOntologyExpansionDiagnostic[] {
  const diagnostics: BenchmarkOntologyExpansionDiagnostic[] = [];
  for (const entry of plannerTrace ?? []) {
    if (entry.step !== 'ontology-expansion') continue;
    for (const rawPart of entry.detail.split(';')) {
      const parsed = parseTraceDetail(rawPart);
      const stage = parsed.stage;
      const seedDocuments = parseTraceCount(parsed.seeds);
      const hits = parseTraceCount(parsed.hits);
      const boostedDocuments = parseTraceCount(parsed.boosts);
      const traceEntries = parseTraceCount(parsed.trace);
      const elapsedMs = parseTraceCount(parsed.elapsed);
      if (
        !stage ||
        seedDocuments === undefined ||
        hits === undefined ||
        boostedDocuments === undefined ||
        traceEntries === undefined ||
        elapsedMs === undefined
      ) {
        continue;
      }
      diagnostics.push({
        stage,
        seedDocuments,
        hits,
        boostedDocuments,
        traceEntries,
        elapsedMs,
      });
    }
  }
  return diagnostics.sort((left, right) => right.elapsedMs - left.elapsedMs || left.stage.localeCompare(right.stage));
}

interface SearchStoreLatencyEntry {
  id: string;
  stage: string;
  dbLexicalMs: number;
  vectorMs: number;
  corpusMs: number;
  totalMs: number;
  dbLexicalCandidates: number;
  vectorCandidates: number;
}

interface CorpusPhaseLatencyEntry {
  id: string;
  stage: string;
  lexicalPoolMs: number;
  exactMs: number;
  lexicalMs: number;
  vectorMs: number;
  fusionMs: number;
  fusionRrfMs: number;
  fusionRerankMs: number;
  fusionEntityMs: number;
  fusionMergeMs: number;
  fusionDiversifyMs: number;
  evidenceMs: number;
  totalMs: number;
  exactInputChunks: number;
  exactScoredChunks: number;
  exactCandidateCount: number;
  lexicalInputChunks: number;
  lexicalCandidateCount: number;
}

function buildSearchStoreLatencyEntries(result: BenchmarkPerformanceResultInput): SearchStoreLatencyEntry[] {
  const entries: SearchStoreLatencyEntry[] = [];
  for (const trace of result.plannerTrace ?? []) {
    if (trace.step !== 'search-store-latency') continue;
    for (const rawPart of trace.detail.split(';')) {
      const part = rawPart.trim();
      const separatorIndex = part.indexOf(':');
      if (separatorIndex <= 0) continue;
      const stage = part.slice(0, separatorIndex).trim();
      const parsed = parseTraceDetail(part.slice(separatorIndex + 1));
      const dbLexicalMs = parseTraceCount(parsed.dbLexical);
      const vectorMs = parseTraceCount(parsed.vector);
      const corpusMs = parseTraceCount(parsed.corpus);
      const totalMs = parseTraceCount(parsed.total);
      const dbLexicalCandidates = parseTraceCount(parsed.dbLexicalCandidates);
      const vectorCandidates = parseTraceCount(parsed.vectorCandidates);
      if (
        dbLexicalMs === undefined ||
        vectorMs === undefined ||
        corpusMs === undefined ||
        totalMs === undefined ||
        dbLexicalCandidates === undefined ||
        vectorCandidates === undefined
      ) {
        continue;
      }
      entries.push({
        id: result.id,
        stage,
        dbLexicalMs,
        vectorMs,
        corpusMs,
        totalMs,
        dbLexicalCandidates,
        vectorCandidates,
      });
    }
  }
  return entries;
}

function buildCorpusPhaseLatencyEntries(result: BenchmarkPerformanceResultInput): CorpusPhaseLatencyEntry[] {
  const entries: CorpusPhaseLatencyEntry[] = [];
  for (const trace of result.plannerTrace ?? []) {
    if (trace.step !== 'search-store-latency') continue;
    for (const rawPart of trace.detail.split(';')) {
      const part = rawPart.trim();
      const separatorIndex = part.indexOf(':');
      if (separatorIndex <= 0) continue;
      const stage = part.slice(0, separatorIndex).trim();
      const parsed = parseTraceDetail(part.slice(separatorIndex + 1));
      const lexicalPoolMs = parseTraceCount(parsed.phaseLexicalPool);
      const exactMs = parseTraceCount(parsed.phaseExact);
      const lexicalMs = parseTraceCount(parsed.phaseLexical);
      const vectorMs = parseTraceCount(parsed.phaseVector);
      const fusionMs = parseTraceCount(parsed.phaseFusion);
      const fusionRrfMs = parseTraceCount(parsed.phaseFusionRrf) ?? 0;
      const fusionRerankMs = parseTraceCount(parsed.phaseFusionRerank) ?? 0;
      const fusionEntityMs = parseTraceCount(parsed.phaseFusionEntity) ?? 0;
      const fusionMergeMs = parseTraceCount(parsed.phaseFusionMerge) ?? 0;
      const fusionDiversifyMs = parseTraceCount(parsed.phaseFusionDiversify) ?? 0;
      const evidenceMs = parseTraceCount(parsed.phaseEvidence);
      const totalMs = parseTraceCount(parsed.phaseTotal);
      const exactInputChunks = parseTraceCount(parsed.phaseExactInput) ?? 0;
      const exactScoredChunks = parseTraceCount(parsed.phaseExactScored) ?? 0;
      const exactCandidateCount = parseTraceCount(parsed.phaseExactCandidates) ?? 0;
      const lexicalInputChunks = parseTraceCount(parsed.phaseLexicalInput) ?? 0;
      const lexicalCandidateCount = parseTraceCount(parsed.phaseLexicalCandidates) ?? 0;
      if (
        lexicalPoolMs === undefined ||
        exactMs === undefined ||
        lexicalMs === undefined ||
        vectorMs === undefined ||
        fusionMs === undefined ||
        evidenceMs === undefined ||
        totalMs === undefined
      ) {
        continue;
      }
      entries.push({
        id: result.id,
        stage,
        lexicalPoolMs,
        exactMs,
        lexicalMs,
        vectorMs,
        fusionMs,
        fusionRrfMs,
        fusionRerankMs,
        fusionEntityMs,
        fusionMergeMs,
        fusionDiversifyMs,
        evidenceMs,
        totalMs,
        exactInputChunks,
        exactScoredChunks,
        exactCandidateCount,
        lexicalInputChunks,
        lexicalCandidateCount,
      });
    }
  }
  return entries;
}

function buildSearchMemoStats(plannerTrace: BenchmarkPlannerTraceInput[] | undefined): BenchmarkSearchMemoStats | undefined {
  return buildPlannerCounterStats(plannerTrace, 'search-memo');
}

function buildLexicalScoreCacheStats(
  plannerTrace: BenchmarkPlannerTraceInput[] | undefined,
): BenchmarkSearchMemoStats | undefined {
  return buildPlannerCounterStats(plannerTrace, 'lexical-score-cache');
}

function buildPlannerCounterStats(
  plannerTrace: BenchmarkPlannerTraceInput[] | undefined,
  step: string,
): BenchmarkSearchMemoStats | undefined {
  let hits = 0;
  let misses = 0;
  let size = 0;
  let matched = false;

  for (const entry of plannerTrace ?? []) {
    if (entry.step !== step) continue;
    const hitMatch = entry.detail.match(/\bhits=(\d+)/i);
    const missMatch = entry.detail.match(/\bmisses=(\d+)/i);
    const sizeMatch = entry.detail.match(/\bsize=(\d+)/i);
    if (!hitMatch || !missMatch || !sizeMatch) continue;
    matched = true;
    hits += Number(hitMatch[1]);
    misses += Number(missMatch[1]);
    size = Math.max(size, Number(sizeMatch[1]));
  }

  return matched
    ? {
        hits,
        misses,
        size,
      }
    : undefined;
}

function parseTraceDetail(detail: string): Record<string, string> {
  const entries = detail.split(',').flatMap((part) => {
    const match = part.trim().match(/^([^=]+)=(.*)$/);
    if (!match) return [];
    return [[match[1].trim(), match[2].trim()] as const];
  });

  return Object.fromEntries(entries);
}

function parseTraceCount(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value.replace(/(?:ms|%)$/i, ''));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeAuthorityDocText(value: string): string {
  return value
    .normalize('NFC')
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, '');
}

function authorityDocMatchesExpected(docTitle: string | undefined, expectedDoc: string): boolean {
  if (!docTitle) return false;
  const normalizedDoc = normalizeAuthorityDocText(docTitle);
  const normalizedExpected = normalizeAuthorityDocText(expectedDoc);
  if (!normalizedExpected) return false;
  if (normalizedDoc.includes(normalizedExpected)) return true;

  const expectedTerms = expectedDoc
    .normalize('NFC')
    .split(/[^\p{Letter}\p{Number}]+/gu)
    .map(normalizeAuthorityDocText)
    .filter((term) => term.length >= 2);

  return expectedTerms.length > 0 && expectedTerms.every((term) => normalizedDoc.includes(term));
}

function stageNoteValue(stageTrace: BenchmarkStageTraceInput[] | undefined, stage: string, key: string): string | undefined {
  const notes = stageTrace?.find((item) => item.stage === stage)?.notes ?? [];
  const prefix = `${key}=`;
  return notes.find((note) => note.startsWith(prefix))?.slice(prefix.length);
}

function buildLexicalPoolReuseGuardMap(
  plannerTrace: BenchmarkPlannerTraceInput[] | undefined,
): Map<string, { pool?: number; result?: string }> {
  const guards = new Map<string, { pool?: number; result?: string }>();

  for (const entry of plannerTrace ?? []) {
    if (entry.step !== 'lexical-pool-reuse-guard') continue;
    const parsed = parseTraceDetail(entry.detail);
    const target = parsed.target;
    if (!target) continue;
    guards.set(target, {
      pool: parseTraceCount(parsed.pool),
      result: parsed.result,
    });
  }

  return guards;
}

function buildLexicalPoolReuseCaseSummaries(
  result: BenchmarkPerformanceResultInput,
): BenchmarkLexicalPoolReuseCaseSummary[] {
  const guards = buildLexicalPoolReuseGuardMap(result.plannerTrace);
  const summaries: BenchmarkLexicalPoolReuseCaseSummary[] = [];

  for (const entry of result.plannerTrace ?? []) {
    if (entry.step !== 'lexical-pool-reuse') continue;
    const parsed = parseTraceDetail(entry.detail);
    const targetStage = parsed.target;
    const previousCandidates = parseTraceCount(parsed.previous);
    const targetLexicalCandidates = parseTraceCount(parsed.targetLexical);
    const overlap = parseTraceCount(parsed.overlap);
    const coverage = parseTraceCount(parsed.coverage);
    if (
      !targetStage ||
      previousCandidates === undefined ||
      targetLexicalCandidates === undefined ||
      overlap === undefined ||
      coverage === undefined
    ) {
      continue;
    }

    const guard = guards.get(targetStage);
    summaries.push({
      id: result.id,
      targetStage,
      previousCandidates,
      targetLexicalCandidates,
      overlap,
      coverage: roundMetric(coverage),
      sourceStages: parsed.stages ? parsed.stages.split('|').filter(Boolean) : [],
      ...(guard?.pool !== undefined ? { guardPool: guard.pool } : {}),
      ...(guard?.result ? { guardResult: guard.result } : {}),
    });
  }

  return summaries;
}

function buildLexicalPoolReuseSummary(results: BenchmarkPerformanceResultInput[]): BenchmarkLexicalPoolReuseSummary {
  const cases = results
    .flatMap((result) => buildLexicalPoolReuseCaseSummaries(result))
    .sort(
      (left, right) =>
        left.coverage - right.coverage ||
        left.targetStage.localeCompare(right.targetStage, 'ko') ||
        left.id.localeCompare(right.id),
    );
  const guardResultCounts: Record<string, number> = {};
  for (const item of cases) {
    if (!item.guardResult) continue;
    guardResultCounts[item.guardResult] = (guardResultCounts[item.guardResult] ?? 0) + 1;
  }
  const coverages = cases.map((item) => item.coverage);

  return {
    casesWithDiagnostics: cases.length,
    averageCoverage: coverages.length > 0 ? roundMetric(coverages.reduce((sum, value) => sum + value, 0) / coverages.length) : 0,
    minCoverage: coverages.length > 0 ? roundMetric(Math.min(...coverages)) : 0,
    fullCoverageCases: cases.filter((item) => item.coverage >= 100).length,
    partialCoverageCases: cases.filter((item) => item.coverage < 100).length,
    guardResultCounts: Object.fromEntries(Object.entries(guardResultCounts).sort(([left], [right]) => left.localeCompare(right))),
    cases,
  };
}

function buildNeighborWindowCaseSummary(result: BenchmarkPerformanceResultInput): BenchmarkNeighborWindowCaseSummary | null {
  const windows = result.neighborWindows ?? [];
  if (windows.length === 0) return null;

  const currentWindows = windows.filter((item) => item.relation === 'current').length;
  const previousWindows = windows.filter((item) => item.relation === 'previous').length;
  const nextWindows = windows.filter((item) => item.relation === 'next').length;
  const parentSectionIds = new Set(windows.map((item) => item.parentSectionId).filter(Boolean));

  return {
    id: result.id,
    totalWindows: windows.length,
    currentWindows,
    previousWindows,
    nextWindows,
    selectedEvidenceWindows: windows.filter((item) => item.selectedAsEvidence === true).length,
    expansionCandidateWindows: previousWindows + nextWindows,
    parentSectionCount: parentSectionIds.size,
  };
}

function buildNeighborWindowSummary(results: BenchmarkPerformanceResultInput[]): BenchmarkNeighborWindowSummary {
  const cases = results
    .map(buildNeighborWindowCaseSummary)
    .filter((item): item is BenchmarkNeighborWindowCaseSummary => Boolean(item))
    .sort(
      (left, right) =>
        right.expansionCandidateWindows - left.expansionCandidateWindows ||
        right.totalWindows - left.totalWindows ||
        left.id.localeCompare(right.id),
    );
  const expansionCandidateWindows = cases.reduce((sum, item) => sum + item.expansionCandidateWindows, 0);

  return {
    casesWithDiagnostics: cases.length,
    totalWindows: cases.reduce((sum, item) => sum + item.totalWindows, 0),
    currentWindows: cases.reduce((sum, item) => sum + item.currentWindows, 0),
    previousWindows: cases.reduce((sum, item) => sum + item.previousWindows, 0),
    nextWindows: cases.reduce((sum, item) => sum + item.nextWindows, 0),
    selectedEvidenceWindows: cases.reduce((sum, item) => sum + item.selectedEvidenceWindows, 0),
    expansionCandidateWindows,
    averageExpansionCandidates: cases.length > 0 ? roundMetric(expansionCandidateWindows / cases.length) : 0,
    cases: cases.slice(0, 8),
  };
}

function buildSmallToBigContextCaseSummary(
  result: BenchmarkPerformanceResultInput,
): BenchmarkSmallToBigContextCaseSummary | null {
  const trace = (result.plannerTrace ?? []).find((entry) => entry.step === 'small-to-big-context');
  if (!trace) return null;
  const parsed = parseTraceDetail(trace.detail);
  const candidateWindows = parseTraceCount(parsed.candidates);
  const includedWindows = parseTraceCount(parsed.included);
  const skippedWindows = parseTraceCount(parsed.skipped);
  const skippedByMaxChunks = parseTraceCount(parsed.skippedByMaxChunks) ?? 0;
  const skippedByMaxChars = parseTraceCount(parsed.skippedByMaxChars) ?? 0;
  const includedChars = parseTraceCount(parsed.chars);
  const maxChars = parseTraceCount(parsed.maxChars);
  if (
    candidateWindows === undefined ||
    includedWindows === undefined ||
    skippedWindows === undefined ||
    includedChars === undefined
  ) {
    return null;
  }

  return {
    id: result.id,
    candidateWindows,
    includedWindows,
    skippedWindows,
    skippedByMaxChunks,
    skippedByMaxChars,
    includedChars,
    ...(maxChars !== undefined ? { maxChars } : {}),
  };
}

function buildSmallToBigContextSummary(results: BenchmarkPerformanceResultInput[]): BenchmarkSmallToBigContextSummary {
  const cases = results
    .map(buildSmallToBigContextCaseSummary)
    .filter((item): item is BenchmarkSmallToBigContextCaseSummary => Boolean(item))
    .sort(
      (left, right) =>
        right.skippedWindows - left.skippedWindows ||
        right.skippedByMaxChars - left.skippedByMaxChars ||
        right.skippedByMaxChunks - left.skippedByMaxChunks ||
        right.candidateWindows - left.candidateWindows ||
        left.includedWindows - right.includedWindows ||
        left.id.localeCompare(right.id),
    );
  const totalCandidateWindows = cases.reduce((sum, item) => sum + item.candidateWindows, 0);
  const totalIncludedWindows = cases.reduce((sum, item) => sum + item.includedWindows, 0);

  return {
    casesWithDiagnostics: cases.length,
    totalCandidateWindows,
    totalIncludedWindows,
    totalSkippedWindows: cases.reduce((sum, item) => sum + item.skippedWindows, 0),
    totalSkippedByMaxChunks: cases.reduce((sum, item) => sum + item.skippedByMaxChunks, 0),
    totalSkippedByMaxChars: cases.reduce((sum, item) => sum + item.skippedByMaxChars, 0),
    totalIncludedChars: cases.reduce((sum, item) => sum + item.includedChars, 0),
    inclusionRate: totalCandidateWindows > 0 ? Number((totalIncludedWindows / totalCandidateWindows).toFixed(4)) : 0,
    cases: cases.slice(0, 8),
  };
}

function buildIntegratedRerankedPathCaseSummary(
  result: BenchmarkPerformanceResultInput,
): BenchmarkIntegratedRerankedPathCaseSummary | null {
  const phaseEntry = buildCorpusPhaseLatencyEntries(result).find((entry) => entry.stage === 'integrated-reranked');
  if (!phaseEntry) return null;

  const searchStoreEntry = buildSearchStoreLatencyEntries(result).find((entry) => entry.stage === 'integrated-reranked');
  const subSearchLatencyMs = buildSubSearchLatencyMs(result.plannerTrace)['integrated-reranked'];

  return {
    id: result.id,
    subSearchMs: roundMetric(subSearchLatencyMs ?? searchStoreEntry?.totalMs ?? phaseEntry.totalMs),
    searchStoreTotalMs: roundMetric(searchStoreEntry?.totalMs ?? 0),
    phaseTotalMs: roundMetric(phaseEntry.totalMs),
    lexicalPoolMs: roundMetric(phaseEntry.lexicalPoolMs),
    exactMs: roundMetric(phaseEntry.exactMs),
    lexicalMs: roundMetric(phaseEntry.lexicalMs),
    vectorMs: roundMetric(phaseEntry.vectorMs),
    fusionMs: roundMetric(phaseEntry.fusionMs),
    fusionRerankMs: roundMetric(phaseEntry.fusionRerankMs),
    fusionEntityMs: roundMetric(phaseEntry.fusionEntityMs),
    fusionDiversifyMs: roundMetric(phaseEntry.fusionDiversifyMs),
    evidenceMs: roundMetric(phaseEntry.evidenceMs),
    exactInputChunks: roundMetric(phaseEntry.exactInputChunks),
    exactCandidateCount: roundMetric(phaseEntry.exactCandidateCount),
    lexicalInputChunks: roundMetric(phaseEntry.lexicalInputChunks),
    lexicalCandidateCount: roundMetric(phaseEntry.lexicalCandidateCount),
  };
}

function buildIntegratedRerankedPathSummary(
  results: BenchmarkPerformanceResultInput[],
): BenchmarkIntegratedRerankedPathSummary {
  const cases = results
    .map(buildIntegratedRerankedPathCaseSummary)
    .filter((item): item is BenchmarkIntegratedRerankedPathCaseSummary => Boolean(item))
    .sort(
      (left, right) =>
        right.subSearchMs - left.subSearchMs ||
        right.phaseTotalMs - left.phaseTotalMs ||
        right.lexicalInputChunks - left.lexicalInputChunks ||
        left.id.localeCompare(right.id),
    );
  const subSearchLatency = summarizeValues(cases.map((item) => item.subSearchMs));
  const average = (values: number[]) =>
    values.length > 0 ? roundMetric(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;

  return {
    casesWithRerankedPath: cases.length,
    averageSubSearchMs: subSearchLatency.average,
    p95SubSearchMs: subSearchLatency.p95,
    maxSubSearchMs: subSearchLatency.max,
    averagePhaseTotalMs: average(cases.map((item) => item.phaseTotalMs)),
    averageExactInputChunks: average(cases.map((item) => item.exactInputChunks)),
    averageExactCandidateCount: average(cases.map((item) => item.exactCandidateCount)),
    averageLexicalInputChunks: average(cases.map((item) => item.lexicalInputChunks)),
    averageLexicalCandidateCount: average(cases.map((item) => item.lexicalCandidateCount)),
    averageFusionRerankMs: average(cases.map((item) => item.fusionRerankMs)),
    averageFusionEntityMs: average(cases.map((item) => item.fusionEntityMs)),
    averageFusionDiversifyMs: average(cases.map((item) => item.fusionDiversifyMs)),
    slowCaseIds: cases.slice(0, 5).map((item) => item.id),
    cases: cases.slice(0, 8),
  };
}

function buildSemanticValidationLatencyCaseSummary(
  result: BenchmarkPerformanceResultInput,
): BenchmarkSemanticValidationLatencyCaseSummary | null {
  const phaseLatency = buildRetrievalPhaseLatencyMs(result.plannerTrace);
  const semanticValidationMs = phaseLatency['semantic-validation'];
  if (!Number.isFinite(semanticValidationMs)) return null;

  const retrievalMs = roundMetric(result.latency?.retrievalMs ?? 0);
  const evidenceOutputCount = result.stageTrace?.find((stage) => stage.stage === 'answer_evidence_gate')?.outputCount ?? 0;

  return {
    id: result.id,
    semanticValidationMs: roundMetric(semanticValidationMs),
    retrievalMs,
    retrievalShare: retrievalMs > 0 ? Number((semanticValidationMs / retrievalMs).toFixed(4)) : 0,
    evidenceOutputCount,
  };
}

function buildSemanticValidationLatencySummary(
  results: BenchmarkPerformanceResultInput[],
): BenchmarkSemanticValidationLatencySummary {
  const cases = results
    .map(buildSemanticValidationLatencyCaseSummary)
    .filter((item): item is BenchmarkSemanticValidationLatencyCaseSummary => Boolean(item))
    .sort(
      (left, right) =>
        right.semanticValidationMs - left.semanticValidationMs ||
        right.retrievalShare - left.retrievalShare ||
        left.id.localeCompare(right.id),
    );
  const latency = summarizeValues(cases.map((item) => item.semanticValidationMs));
  const averageRetrievalShare =
    cases.length > 0 ? Number((cases.reduce((sum, item) => sum + item.retrievalShare, 0) / cases.length).toFixed(4)) : 0;

  return {
    casesWithTiming: cases.length,
    averageMs: latency.average,
    p95Ms: latency.p95,
    maxMs: latency.max,
    averageRetrievalShare,
    slowCaseIds: cases.slice(0, 5).map((item) => item.id),
    cases: cases.slice(0, 8),
  };
}

function buildEvaluationAuthorityTraceCaseSummary(
  result: BenchmarkPerformanceResultInput,
): BenchmarkEvaluationAuthorityTraceCaseSummary | null {
  if (!result.id.startsWith('evaluation-') || !result.expectedDoc) return null;

  const lexicalTopDoc = stageNoteValue(result.stageTrace, 'lexical_candidates', 'top');
  const exactTopDoc = stageNoteValue(result.stageTrace, 'fusion', 'exact-top');
  const fusionTopDoc = stageNoteValue(result.stageTrace, 'fusion', 'fusion-top');
  const visibleTopDoc = result.top5?.find((candidate) => Boolean(candidate.docTitle))?.docTitle;
  const visibleTop5Matches = (result.top5 ?? []).some((candidate) =>
    authorityDocMatchesExpected(candidate.docTitle, result.expectedDoc ?? ''),
  );
  const lexicalTopMatches = authorityDocMatchesExpected(lexicalTopDoc, result.expectedDoc);
  const exactTopMatches = authorityDocMatchesExpected(exactTopDoc, result.expectedDoc);
  const fusionTopMatches = authorityDocMatchesExpected(fusionTopDoc, result.expectedDoc);

  const expectedDocStage: BenchmarkEvaluationAuthorityTraceCaseSummary['expectedDocStage'] = lexicalTopMatches
    ? 'lexical-top'
    : exactTopMatches
      ? 'exact-top'
      : fusionTopMatches
        ? 'fusion-top'
        : visibleTop5Matches
          ? 'visible-top5'
          : 'missing';

  return {
    id: result.id,
    expectedDoc: result.expectedDoc,
    top3Hit: result.top3Hit ?? false,
    top5Hit: result.top5Hit ?? visibleTop5Matches,
    ...(lexicalTopDoc ? { lexicalTopDoc } : {}),
    ...(exactTopDoc ? { exactTopDoc } : {}),
    ...(fusionTopDoc ? { fusionTopDoc } : {}),
    ...(visibleTopDoc ? { visibleTopDoc } : {}),
    expectedDocStage,
    drift: Boolean(
      (lexicalTopMatches && !authorityDocMatchesExpected(fusionTopDoc, result.expectedDoc)) ||
        (exactTopMatches && !authorityDocMatchesExpected(fusionTopDoc, result.expectedDoc)),
    ),
  };
}

function buildEvaluationAuthorityTraceSummary(
  results: BenchmarkPerformanceResultInput[],
): BenchmarkEvaluationAuthorityTraceSummary {
  const cases = results
    .map(buildEvaluationAuthorityTraceCaseSummary)
    .filter((item): item is BenchmarkEvaluationAuthorityTraceCaseSummary => Boolean(item))
    .sort(
      (left, right) =>
        Number(right.drift) - Number(left.drift) ||
        Number(!right.top5Hit) - Number(!left.top5Hit) ||
        left.id.localeCompare(right.id),
    );

  return {
    casesWithExpectedDoc: cases.length,
    lexicalTopMatches: cases.filter((item) => authorityDocMatchesExpected(item.lexicalTopDoc, item.expectedDoc)).length,
    exactTopMatches: cases.filter((item) => authorityDocMatchesExpected(item.exactTopDoc, item.expectedDoc)).length,
    fusionTopMatches: cases.filter((item) => authorityDocMatchesExpected(item.fusionTopDoc, item.expectedDoc)).length,
    visibleTop5Matches: cases.filter((item) => item.top5Hit).length,
    driftCases: cases.filter((item) => item.drift).length,
    missedTop5Cases: cases.filter((item) => !item.top5Hit).length,
    cases: cases.slice(0, 8),
  };
}

function findDominantLatencyStage(latency: Partial<Record<BenchmarkLatencyKey, number>> | undefined): {
  stage: BenchmarkLatencyKey;
  value: number;
} {
  let stage: BenchmarkLatencyKey = 'totalMs';
  let value = 0;

  for (const key of LATENCY_KEYS.filter((item) => item !== 'totalMs')) {
    const current = latency?.[key] ?? 0;
    if (Number.isFinite(current) && current > value) {
      stage = key;
      value = current;
    }
  }

  if (value === 0) {
    value = latency?.totalMs ?? 0;
  }

  return { stage, value: roundMetric(value) };
}

function buildSlowCases(results: BenchmarkPerformanceResultInput[], limit = 5): BenchmarkSlowCaseSummary[] {
  return results
    .filter((result) => Number.isFinite(result.latency?.totalMs ?? NaN))
    .sort((left, right) => (right.latency?.totalMs ?? 0) - (left.latency?.totalMs ?? 0))
    .slice(0, limit)
    .map((result) => {
      const dominant = findDominantLatencyStage(result.latency);
      const searchMemoStats = buildSearchMemoStats(result.plannerTrace);
      const subSearchLatencyMs = buildSubSearchLatencyMs(result.plannerTrace);
      const retrievalPhaseLatencyMs = buildRetrievalPhaseLatencyMs(result.plannerTrace);
      const executeSearchPhaseLatencyMs = buildExecuteSearchPhaseLatencyMs(result.plannerTrace);
      const ontologyExpansionDiagnostics = buildOntologyExpansionDiagnostics(result.plannerTrace);
      const subSearchTotalMs = Object.values(subSearchLatencyMs).reduce((sum, value) => sum + value, 0);
      const retrievalMs = roundMetric(result.latency?.retrievalMs ?? 0);
      return {
        id: result.id,
        totalMs: roundMetric(result.latency?.totalMs ?? 0),
        retrievalMs,
        dominantLatencyStage: dominant.stage,
        dominantLatencyMs: dominant.value,
        subSearchTotalMs: roundMetric(subSearchTotalMs),
        retrievalOverheadMs: roundMetric(Math.max(0, retrievalMs - subSearchTotalMs)),
        retrievalPhaseLatencyMs,
        executeSearchPhaseLatencyMs,
        ontologyExpansionDiagnostics,
        ...(searchMemoStats ? { searchMemoStats } : {}),
        subSearchLatencyMs,
        stageOutputCounts: buildStageOutputCounts(result.stageTrace),
      };
    });
}

function buildSearchMemoSummary(results: BenchmarkPerformanceResultInput[]): BenchmarkSearchMemoSummary {
  const cases = results
    .flatMap((result): BenchmarkSearchMemoCaseSummary[] => {
      const stats = buildSearchMemoStats(result.plannerTrace);
      return stats ? [{ id: result.id, ...stats }] : [];
    })
    .sort((left, right) => right.hits - left.hits || right.misses - left.misses || left.id.localeCompare(right.id));
  const totalHits = cases.reduce((sum, item) => sum + item.hits, 0);
  const totalMisses = cases.reduce((sum, item) => sum + item.misses, 0);
  const denominator = totalHits + totalMisses;

  return {
    totalHits,
    totalMisses,
    casesWithTrace: cases.length,
    casesWithHits: cases.filter((item) => item.hits > 0).length,
    hitRate: denominator > 0 ? Number((totalHits / denominator).toFixed(4)) : 0,
    cases,
  };
}

function buildLexicalScoreCacheSummary(results: BenchmarkPerformanceResultInput[]): BenchmarkLexicalScoreCacheSummary {
  const cases = results
    .flatMap((result): BenchmarkLexicalScoreCacheCaseSummary[] => {
      const stats = buildLexicalScoreCacheStats(result.plannerTrace);
      return stats ? [{ id: result.id, ...stats }] : [];
    })
    .sort((left, right) => right.hits - left.hits || right.misses - left.misses || left.id.localeCompare(right.id));
  const totalHits = cases.reduce((sum, item) => sum + item.hits, 0);
  const totalMisses = cases.reduce((sum, item) => sum + item.misses, 0);
  const denominator = totalHits + totalMisses;

  return {
    totalHits,
    totalMisses,
    casesWithTrace: cases.length,
    casesWithHits: cases.filter((item) => item.hits > 0).length,
    hitRate: denominator > 0 ? Number((totalHits / denominator).toFixed(4)) : 0,
    cases,
  };
}

function buildSubSearchLatencySummary(results: BenchmarkPerformanceResultInput[]): BenchmarkSubSearchLatencySummary[] {
  const byStage = new Map<string, Array<{ id: string; value: number }>>();
  for (const result of results) {
    const subSearchLatencyMs = buildSubSearchLatencyMs(result.plannerTrace);
    for (const [stage, value] of Object.entries(subSearchLatencyMs)) {
      const current = byStage.get(stage) ?? [];
      current.push({ id: result.id, value });
      byStage.set(stage, current);
    }
  }

  return Array.from(byStage.entries())
    .map(([stage, values]) => {
      const latency = summarizeValues(values.map((item) => item.value));
      return {
        stage,
        caseCount: values.length,
        averageMs: latency.average,
        p95Ms: latency.p95,
        maxMs: latency.max,
        slowCaseIds: values
          .sort((left, right) => right.value - left.value || left.id.localeCompare(right.id))
          .slice(0, 5)
          .map((item) => item.id),
      };
    })
    .sort((left, right) => right.averageMs - left.averageMs || right.maxMs - left.maxMs || left.stage.localeCompare(right.stage, 'ko'));
}

function buildSearchStoreLatencySummary(results: BenchmarkPerformanceResultInput[]): BenchmarkSearchStoreLatencySummary[] {
  const byStage = new Map<string, SearchStoreLatencyEntry[]>();
  for (const result of results) {
    for (const entry of buildSearchStoreLatencyEntries(result)) {
      const current = byStage.get(entry.stage) ?? [];
      current.push(entry);
      byStage.set(entry.stage, current);
    }
  }

  return Array.from(byStage.entries())
    .map(([stage, values]) => {
      const total = summarizeValues(values.map((item) => item.totalMs));
      return {
        stage,
        caseCount: values.length,
        averageTotalMs: total.average,
        p95TotalMs: total.p95,
        maxTotalMs: total.max,
        averageDbLexicalMs: roundMetric(values.reduce((sum, item) => sum + item.dbLexicalMs, 0) / values.length),
        averageVectorMs: roundMetric(values.reduce((sum, item) => sum + item.vectorMs, 0) / values.length),
        averageCorpusMs: roundMetric(values.reduce((sum, item) => sum + item.corpusMs, 0) / values.length),
        averageDbLexicalCandidates: roundMetric(values.reduce((sum, item) => sum + item.dbLexicalCandidates, 0) / values.length),
        averageVectorCandidates: roundMetric(values.reduce((sum, item) => sum + item.vectorCandidates, 0) / values.length),
        slowCaseIds: values
          .sort((left, right) => right.totalMs - left.totalMs || left.id.localeCompare(right.id))
          .slice(0, 5)
          .map((item) => item.id),
      };
    })
    .sort((left, right) => right.averageTotalMs - left.averageTotalMs || left.stage.localeCompare(right.stage, 'ko'));
}

function buildCorpusPhaseLatencySummary(results: BenchmarkPerformanceResultInput[]): BenchmarkCorpusPhaseLatencySummary[] {
  const byStage = new Map<string, CorpusPhaseLatencyEntry[]>();
  for (const result of results) {
    for (const entry of buildCorpusPhaseLatencyEntries(result)) {
      const current = byStage.get(entry.stage) ?? [];
      current.push(entry);
      byStage.set(entry.stage, current);
    }
  }

  return Array.from(byStage.entries())
    .map(([stage, values]) => {
      const total = summarizeValues(values.map((item) => item.totalMs));
      return {
        stage,
        caseCount: values.length,
        averageTotalMs: total.average,
        p95TotalMs: total.p95,
        maxTotalMs: total.max,
        averageLexicalPoolMs: roundMetric(values.reduce((sum, item) => sum + item.lexicalPoolMs, 0) / values.length),
        averageExactMs: roundMetric(values.reduce((sum, item) => sum + item.exactMs, 0) / values.length),
        averageLexicalMs: roundMetric(values.reduce((sum, item) => sum + item.lexicalMs, 0) / values.length),
        averageVectorMs: roundMetric(values.reduce((sum, item) => sum + item.vectorMs, 0) / values.length),
        averageFusionMs: roundMetric(values.reduce((sum, item) => sum + item.fusionMs, 0) / values.length),
        averageFusionRrfMs: roundMetric(values.reduce((sum, item) => sum + item.fusionRrfMs, 0) / values.length),
        averageFusionRerankMs: roundMetric(values.reduce((sum, item) => sum + item.fusionRerankMs, 0) / values.length),
        averageFusionEntityMs: roundMetric(values.reduce((sum, item) => sum + item.fusionEntityMs, 0) / values.length),
        averageFusionMergeMs: roundMetric(values.reduce((sum, item) => sum + item.fusionMergeMs, 0) / values.length),
        averageFusionDiversifyMs: roundMetric(values.reduce((sum, item) => sum + item.fusionDiversifyMs, 0) / values.length),
        averageEvidenceMs: roundMetric(values.reduce((sum, item) => sum + item.evidenceMs, 0) / values.length),
        averageExactInputChunks: roundMetric(values.reduce((sum, item) => sum + item.exactInputChunks, 0) / values.length),
        averageExactScoredChunks: roundMetric(values.reduce((sum, item) => sum + item.exactScoredChunks, 0) / values.length),
        averageExactCandidateCount: roundMetric(values.reduce((sum, item) => sum + item.exactCandidateCount, 0) / values.length),
        averageLexicalInputChunks: roundMetric(values.reduce((sum, item) => sum + item.lexicalInputChunks, 0) / values.length),
        averageLexicalCandidateCount: roundMetric(values.reduce((sum, item) => sum + item.lexicalCandidateCount, 0) / values.length),
        slowCaseIds: values
          .sort((left, right) => right.totalMs - left.totalMs || left.id.localeCompare(right.id))
          .slice(0, 5)
          .map((item) => item.id),
      };
    })
    .sort((left, right) => right.averageTotalMs - left.averageTotalMs || left.stage.localeCompare(right.stage, 'ko'));
}

export function buildBenchmarkPerformanceSummary(input: BenchmarkPerformanceSummaryInput): BenchmarkPerformanceSummary {
  const stageLatencyMs: Partial<Record<BenchmarkLatencyKey, BenchmarkLatencySummary>> = {};
  for (const key of LATENCY_KEYS) {
    const values = input.results
      .map((result) => result.latency?.[key])
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
    if (values.length > 0) stageLatencyMs[key] = summarizeValues(values);
  }

  const candidateOutputs = new Map<string, number[]>();
  for (const result of input.results) {
    for (const stage of result.stageTrace ?? []) {
      if (!Number.isFinite(stage.outputCount)) continue;
      const current = candidateOutputs.get(stage.stage) ?? [];
      current.push(stage.outputCount);
      candidateOutputs.set(stage.stage, current);
    }
  }

  return {
    totalDurationMs: roundMetric(input.totalDurationMs),
    caseLatencyMs: summarizeValues(input.results.map((result) => result.latency?.totalMs ?? 0)),
    stageLatencyMs,
    candidateOutputCounts: Array.from(candidateOutputs.entries())
      .map(([stage, values]) => ({
        stage,
        averageOutputCount: roundMetric(values.reduce((sum, value) => sum + value, 0) / values.length),
        maxOutputCount: Math.max(...values),
      }))
      .sort((left, right) => left.stage.localeCompare(right.stage, 'ko')),
    slowCases: buildSlowCases(input.results),
    searchMemo: buildSearchMemoSummary(input.results),
    lexicalScoreCache: buildLexicalScoreCacheSummary(input.results),
    subSearchLatencySummary: buildSubSearchLatencySummary(input.results),
    searchStoreLatencySummary: buildSearchStoreLatencySummary(input.results),
    corpusPhaseLatencySummary: buildCorpusPhaseLatencySummary(input.results),
    lexicalPoolReuse: buildLexicalPoolReuseSummary(input.results),
    neighborWindowExpansion: buildNeighborWindowSummary(input.results),
    smallToBigContext: buildSmallToBigContextSummary(input.results),
    integratedRerankedPath: buildIntegratedRerankedPathSummary(input.results),
    semanticValidationLatency: buildSemanticValidationLatencySummary(input.results),
    evaluationAuthorityTrace: buildEvaluationAuthorityTraceSummary(input.results),
  };
}
