import type {
  BenchmarkCorpusPhaseLatencySummary,
  BenchmarkEvaluationAuthorityTraceSummary,
  BenchmarkIntegratedRerankedPathSummary,
  BenchmarkLexicalPoolReuseSummary,
  BenchmarkLexicalScoreCacheSummary,
  BenchmarkNeighborWindowSummary,
  BenchmarkPerformanceSummary,
  BenchmarkSemanticValidationLatencySummary,
  BenchmarkSmallToBigContextSummary,
  BenchmarkSearchMemoSummary,
  BenchmarkSearchStoreLatencySummary,
  BenchmarkSubSearchLatencySummary,
} from './ragBenchmarkReport';

export type BenchmarkDiagnosticsIssueCode =
  | 'top3-rerank-priority-miss'
  | 'evidence-visible-fusion-miss'
  | 'candidate-recall-miss'
  | 'accepted-abstain-negative-case';

export interface BenchmarkDiagnosticsCandidateInput {
  docTitle?: string;
  articleNo?: string;
  rerankScore?: number;
}

export interface BenchmarkDiagnosticsResultInput {
  id: string;
  question?: string;
  expectedDoc: string;
  top3Hit: boolean;
  top5Hit: boolean;
  abstained?: boolean;
  confidence?: string;
  top5?: BenchmarkDiagnosticsCandidateInput[];
  evidenceDocs?: string[];
  evidencePaths?: string[];
}

export interface BenchmarkDiagnosticsInput {
  generatedAt?: string;
  totalCases: number;
  performance?: BenchmarkPerformanceSummary;
  results: BenchmarkDiagnosticsResultInput[];
}

export interface BenchmarkDiagnosticsCase {
  id: string;
  question: string;
  expectedDoc: string;
  issueCode: BenchmarkDiagnosticsIssueCode;
  confidence: string;
  top3Hit: boolean;
  top5Hit: boolean;
  abstained: boolean;
  expectedDocInEvidence: boolean;
  expectedDocInTop5: boolean;
  top5Docs: string[];
  evidenceDocs: string[];
  recommendedAction: string;
}

export interface BenchmarkDiagnosticsReport {
  generatedAt: string;
  benchmarkGeneratedAt?: string;
  totalCases: number;
  summary: {
    analyzedCases: number;
    actionableCases: number;
    acceptedAbstainCases: number;
    issueCounts: Record<BenchmarkDiagnosticsIssueCode, number>;
    searchMemo: BenchmarkSearchMemoSummary;
    lexicalScoreCache: BenchmarkLexicalScoreCacheSummary;
    subSearchLatencyTargets: BenchmarkSubSearchLatencySummary[];
    searchStoreLatencyTargets: BenchmarkSearchStoreLatencySummary[];
    corpusPhaseLatencyTargets: BenchmarkCorpusPhaseLatencySummary[];
    lexicalPoolReuse: BenchmarkLexicalPoolReuseSummary;
    neighborWindowExpansion: BenchmarkNeighborWindowSummary;
    smallToBigContext: BenchmarkSmallToBigContextSummary;
    integratedRerankedPath: BenchmarkIntegratedRerankedPathSummary;
    semanticValidationLatency: BenchmarkSemanticValidationLatencySummary;
    evaluationAuthorityTrace: BenchmarkEvaluationAuthorityTraceSummary;
  };
  cases: BenchmarkDiagnosticsCase[];
}

const ISSUE_CODES: BenchmarkDiagnosticsIssueCode[] = [
  'top3-rerank-priority-miss',
  'evidence-visible-fusion-miss',
  'candidate-recall-miss',
  'accepted-abstain-negative-case',
];

const EMPTY_SEARCH_MEMO_SUMMARY: BenchmarkSearchMemoSummary = {
  totalHits: 0,
  totalMisses: 0,
  casesWithTrace: 0,
  casesWithHits: 0,
  hitRate: 0,
  cases: [],
};

const EMPTY_LEXICAL_SCORE_CACHE_SUMMARY: BenchmarkLexicalScoreCacheSummary = {
  totalHits: 0,
  totalMisses: 0,
  casesWithTrace: 0,
  casesWithHits: 0,
  hitRate: 0,
  cases: [],
};

const EMPTY_LEXICAL_POOL_REUSE_SUMMARY: BenchmarkLexicalPoolReuseSummary = {
  casesWithDiagnostics: 0,
  averageCoverage: 0,
  minCoverage: 0,
  fullCoverageCases: 0,
  partialCoverageCases: 0,
  guardResultCounts: {},
  cases: [],
};

const EMPTY_NEIGHBOR_WINDOW_SUMMARY: BenchmarkNeighborWindowSummary = {
  casesWithDiagnostics: 0,
  totalWindows: 0,
  currentWindows: 0,
  previousWindows: 0,
  nextWindows: 0,
  selectedEvidenceWindows: 0,
  expansionCandidateWindows: 0,
  averageExpansionCandidates: 0,
  cases: [],
};

const EMPTY_SMALL_TO_BIG_CONTEXT_SUMMARY: BenchmarkSmallToBigContextSummary = {
  casesWithDiagnostics: 0,
  totalCandidateWindows: 0,
  totalIncludedWindows: 0,
  totalSkippedWindows: 0,
  totalSkippedByMaxChunks: 0,
  totalSkippedByMaxChars: 0,
  totalIncludedChars: 0,
  inclusionRate: 0,
  cases: [],
};

const EMPTY_INTEGRATED_RERANKED_PATH_SUMMARY: BenchmarkIntegratedRerankedPathSummary = {
  casesWithRerankedPath: 0,
  averageSubSearchMs: 0,
  p95SubSearchMs: 0,
  maxSubSearchMs: 0,
  averagePhaseTotalMs: 0,
  averageExactInputChunks: 0,
  averageExactCandidateCount: 0,
  averageLexicalInputChunks: 0,
  averageLexicalCandidateCount: 0,
  averageFusionRerankMs: 0,
  averageFusionEntityMs: 0,
  averageFusionDiversifyMs: 0,
  slowCaseIds: [],
  cases: [],
};

const EMPTY_SEMANTIC_VALIDATION_LATENCY_SUMMARY: BenchmarkSemanticValidationLatencySummary = {
  casesWithTiming: 0,
  averageMs: 0,
  p95Ms: 0,
  maxMs: 0,
  averageRetrievalShare: 0,
  slowCaseIds: [],
  cases: [],
};

const EMPTY_EVALUATION_AUTHORITY_TRACE_SUMMARY: BenchmarkEvaluationAuthorityTraceSummary = {
  casesWithExpectedDoc: 0,
  lexicalTopMatches: 0,
  exactTopMatches: 0,
  fusionTopMatches: 0,
  visibleTop5Matches: 0,
  driftCases: 0,
  missedTop5Cases: 0,
  cases: [],
};

function normalizeDocMatchText(value: string): string {
  return value
    .normalize('NFC')
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, '');
}

function documentMatchesExpected(docTitle: string, expectedDoc: string): boolean {
  const normalizedDoc = normalizeDocMatchText(docTitle);
  const normalizedExpected = normalizeDocMatchText(expectedDoc);
  if (!normalizedExpected) return false;
  if (normalizedDoc.includes(normalizedExpected)) return true;

  const expectedTerms = expectedDoc
    .normalize('NFC')
    .split(/[^\p{Letter}\p{Number}]+/gu)
    .map(normalizeDocMatchText)
    .filter((term) => term.length >= 2);

  return expectedTerms.length > 0 && expectedTerms.every((term) => normalizedDoc.includes(term));
}

function classifyCase(input: BenchmarkDiagnosticsResultInput): BenchmarkDiagnosticsIssueCode {
  if (input.abstained && input.confidence === 'low' && !input.top5Hit) return 'accepted-abstain-negative-case';
  if (!input.top3Hit && input.top5Hit) return 'top3-rerank-priority-miss';

  const evidenceDocs = [...(input.evidenceDocs ?? []), ...(input.evidencePaths ?? [])];
  if (!input.top5Hit && evidenceDocs.some((doc) => documentMatchesExpected(doc, input.expectedDoc))) {
    return 'evidence-visible-fusion-miss';
  }

  return 'candidate-recall-miss';
}

function recommendedActionFor(issueCode: BenchmarkDiagnosticsIssueCode): string {
  switch (issueCode) {
    case 'top3-rerank-priority-miss':
      return 'Increase title/exact-document and source-priority rerank weight for the expected document family.';
    case 'evidence-visible-fusion-miss':
      return 'Inspect why evidence is selected but not visible in fused Top-5; promote evidence candidates or adjust diversification/rerank.';
    case 'candidate-recall-miss':
      return 'Add alias/ontology expansion or lexical candidate coverage so the expected document enters the candidate pool.';
    case 'accepted-abstain-negative-case':
      return 'Keep as negative-case coverage and separate accepted abstain from document-recall failure metrics.';
  }
}

export function buildRagBenchmarkDiagnosticsReport(input: BenchmarkDiagnosticsInput): BenchmarkDiagnosticsReport {
  const cases = input.results
    .filter((result) => !result.top3Hit || !result.top5Hit)
    .map((result): BenchmarkDiagnosticsCase => {
      const top5Docs = (result.top5 ?? []).map((candidate) => candidate.docTitle ?? '').filter(Boolean);
      const evidenceDocs = [...(result.evidenceDocs ?? []), ...(result.evidencePaths ?? [])].filter(Boolean);
      const issueCode = classifyCase(result);

      return {
        id: result.id,
        question: result.question ?? '',
        expectedDoc: result.expectedDoc,
        issueCode,
        confidence: result.confidence ?? 'unknown',
        top3Hit: result.top3Hit,
        top5Hit: result.top5Hit,
        abstained: result.abstained ?? false,
        expectedDocInEvidence: evidenceDocs.some((doc) => documentMatchesExpected(doc, result.expectedDoc)),
        expectedDocInTop5: top5Docs.some((doc) => documentMatchesExpected(doc, result.expectedDoc)),
        top5Docs,
        evidenceDocs,
        recommendedAction: recommendedActionFor(issueCode),
      };
    });

  const issueCounts = Object.fromEntries(ISSUE_CODES.map((code) => [code, 0])) as Record<
    BenchmarkDiagnosticsIssueCode,
    number
  >;
  for (const item of cases) {
    issueCounts[item.issueCode] += 1;
  }
  const acceptedAbstainCases = issueCounts['accepted-abstain-negative-case'];

  return {
    generatedAt: new Date().toISOString(),
    benchmarkGeneratedAt: input.generatedAt,
    totalCases: input.totalCases,
    summary: {
      analyzedCases: cases.length,
      actionableCases: cases.length - acceptedAbstainCases,
      acceptedAbstainCases,
      issueCounts,
      searchMemo: input.performance?.searchMemo ?? EMPTY_SEARCH_MEMO_SUMMARY,
      lexicalScoreCache: input.performance?.lexicalScoreCache ?? EMPTY_LEXICAL_SCORE_CACHE_SUMMARY,
      subSearchLatencyTargets: input.performance?.subSearchLatencySummary.slice(0, 8) ?? [],
      searchStoreLatencyTargets: input.performance?.searchStoreLatencySummary.slice(0, 8) ?? [],
      corpusPhaseLatencyTargets: input.performance?.corpusPhaseLatencySummary.slice(0, 8) ?? [],
      lexicalPoolReuse: input.performance?.lexicalPoolReuse ?? EMPTY_LEXICAL_POOL_REUSE_SUMMARY,
      neighborWindowExpansion: input.performance?.neighborWindowExpansion ?? EMPTY_NEIGHBOR_WINDOW_SUMMARY,
      smallToBigContext: input.performance?.smallToBigContext ?? EMPTY_SMALL_TO_BIG_CONTEXT_SUMMARY,
      integratedRerankedPath: input.performance?.integratedRerankedPath ?? EMPTY_INTEGRATED_RERANKED_PATH_SUMMARY,
      semanticValidationLatency:
        input.performance?.semanticValidationLatency ?? EMPTY_SEMANTIC_VALIDATION_LATENCY_SUMMARY,
      evaluationAuthorityTrace:
        input.performance?.evaluationAuthorityTrace ?? EMPTY_EVALUATION_AUTHORITY_TRACE_SUMMARY,
    },
    cases,
  };
}

function formatSearchMemoDiagnostics(searchMemo: BenchmarkSearchMemoSummary): string[] {
  const totalLookups = searchMemo.totalHits + searchMemo.totalMisses;
  const caseLines = searchMemo.cases
    .slice(0, 8)
    .map((item) => `- ${item.id}: hits ${item.hits}, misses ${item.misses}, size ${item.size}`);
  return [
    '',
    '## Search memo diagnostics',
    '',
    `- Cases with memo trace: ${searchMemo.casesWithTrace}`,
    `- Cases with memo hits: ${searchMemo.casesWithHits}`,
    `- Total hits/misses: ${searchMemo.totalHits}/${searchMemo.totalMisses}`,
    `- Hit rate: ${totalLookups > 0 ? (searchMemo.hitRate * 100).toFixed(1) : '0.0'}%`,
    '',
    ...(caseLines.length > 0 ? caseLines : ['- none']),
  ];
}

function formatLexicalScoreCacheDiagnostics(summary: BenchmarkLexicalScoreCacheSummary): string[] {
  const totalLookups = summary.totalHits + summary.totalMisses;
  const caseLines = summary.cases
    .slice(0, 8)
    .map((item) => `- ${item.id}: hits ${item.hits}, misses ${item.misses}, size ${item.size}`);
  return [
    '',
    '## Lexical score cache diagnostics',
    '',
    `- Cases with cache trace: ${summary.casesWithTrace}`,
    `- Cases with hits: ${summary.casesWithHits}`,
    `- Total hits/misses: ${summary.totalHits}/${summary.totalMisses}`,
    `- Hit rate: ${totalLookups > 0 ? (summary.hitRate * 100).toFixed(1) : '0.0'}%`,
    '',
    ...(caseLines.length > 0 ? caseLines : ['- none']),
  ];
}

function formatSubSearchLatencyTargets(targets: BenchmarkSubSearchLatencySummary[]): string[] {
  return [
    '',
    '## Repeated sub-search latency targets',
    '',
    ...(targets.length > 0
      ? targets.map(
          (item) =>
            `- ${item.stage}: cases ${item.caseCount}, avg ${item.averageMs}ms, p95 ${item.p95Ms}ms, max ${item.maxMs}ms, slow cases ${item.slowCaseIds.join(', ') || 'none'}`,
        )
      : ['- none']),
  ];
}

function formatSearchStoreLatencyTargets(targets: BenchmarkSearchStoreLatencySummary[]): string[] {
  return [
    '',
    '## Search store latency breakdown',
    '',
    ...(targets.length > 0
      ? targets.map(
          (item) =>
            `- ${item.stage}: cases ${item.caseCount}, total avg ${item.averageTotalMs}ms, p95 ${item.p95TotalMs}ms, db lexical avg ${item.averageDbLexicalMs}ms, vector avg ${item.averageVectorMs}ms, corpus avg ${item.averageCorpusMs}ms, db/vector candidates ${item.averageDbLexicalCandidates}/${item.averageVectorCandidates}, slow cases ${item.slowCaseIds.join(', ') || 'none'}`,
        )
      : ['- none']),
  ];
}

function formatGuardResultCounts(counts: Record<string, number>): string {
  const entries = Object.entries(counts);
  if (entries.length === 0) return 'none';
  return entries.map(([result, count]) => `${result}=${count}`).join(', ');
}

function formatCorpusPhaseLatencyTargets(targets: BenchmarkCorpusPhaseLatencySummary[]): string[] {
  return [
    '',
    '## Search corpus phase timing',
    '',
    ...(targets.length > 0
      ? targets.map(
          (item) =>
            `- ${item.stage}: cases ${item.caseCount}, total avg ${item.averageTotalMs}ms, p95 ${item.p95TotalMs}ms, lexical pool avg ${item.averageLexicalPoolMs}ms, exact avg ${item.averageExactMs}ms, lexical avg ${item.averageLexicalMs}ms, vector avg ${item.averageVectorMs}ms, fusion avg ${item.averageFusionMs}ms, evidence avg ${item.averageEvidenceMs}ms, fusion detail rrf avg ${item.averageFusionRrfMs}ms, rerank avg ${item.averageFusionRerankMs}ms, entity avg ${item.averageFusionEntityMs}ms, merge avg ${item.averageFusionMergeMs}ms, diversify avg ${item.averageFusionDiversifyMs}ms, slow cases ${item.slowCaseIds.join(', ') || 'none'}`,
        )
      : ['- none']),
  ];
}

function formatLexicalPoolReuseDiagnostics(summary: BenchmarkLexicalPoolReuseSummary): string[] {
  const caseLines = summary.cases
    .slice(0, 8)
    .map(
      (item) =>
        `- ${item.id}: target ${item.targetStage}, coverage ${item.coverage.toFixed(1)}%, overlap ${item.overlap}/${item.targetLexicalCandidates}, previous ${item.previousCandidates}, guard ${item.guardResult ?? 'unknown'}, stages ${item.sourceStages.join('|') || 'none'}`,
    );

  return [
    '',
    '## Lexical pool reuse diagnostics',
    '',
    `- Cases with diagnostics: ${summary.casesWithDiagnostics}`,
    `- Average coverage: ${summary.averageCoverage.toFixed(1)}%`,
    `- Minimum coverage: ${summary.minCoverage.toFixed(1)}%`,
    `- Full/partial coverage cases: ${summary.fullCoverageCases}/${summary.partialCoverageCases}`,
    `- Guard results: ${formatGuardResultCounts(summary.guardResultCounts)}`,
    '',
    ...(caseLines.length > 0 ? caseLines : ['- none']),
  ];
}

function formatNeighborWindowExpansionDiagnostics(summary: BenchmarkNeighborWindowSummary): string[] {
  const caseLines = summary.cases
    .slice(0, 8)
    .map(
      (item) =>
        `- ${item.id}: windows ${item.totalWindows}, candidates ${item.expansionCandidateWindows}, parents ${item.parentSectionCount}, current/previous/next ${item.currentWindows}/${item.previousWindows}/${item.nextWindows}`,
    );

  return [
    '',
    '## Neighbor window expansion diagnostics',
    '',
    `- Cases with diagnostics: ${summary.casesWithDiagnostics}`,
    `- Total windows: ${summary.totalWindows}`,
    `- Selected evidence windows: ${summary.selectedEvidenceWindows}`,
    `- Expansion candidate windows: ${summary.expansionCandidateWindows}`,
    `- Average expansion candidates: ${summary.averageExpansionCandidates.toFixed(1)}`,
    `- Current/previous/next windows: ${summary.currentWindows}/${summary.previousWindows}/${summary.nextWindows}`,
    '',
    ...(caseLines.length > 0 ? caseLines : ['- none']),
  ];
}

function formatSmallToBigContextDiagnostics(summary: BenchmarkSmallToBigContextSummary): string[] {
  const caseLines = summary.cases
    .slice(0, 8)
    .map((item) => {
      const maxCharsSuffix = item.maxChars !== undefined ? `, max chars ${item.maxChars}` : '';
      return `- ${item.id}: included ${item.includedWindows}/${item.candidateWindows}, skipped ${item.skippedWindows} (chunks ${item.skippedByMaxChunks}, chars ${item.skippedByMaxChars}), chars ${item.includedChars}${maxCharsSuffix}`;
    });

  return [
    '',
    '## Small-to-big context inclusion diagnostics',
    '',
    `- Cases with diagnostics: ${summary.casesWithDiagnostics}`,
    `- Included/candidate windows: ${summary.totalIncludedWindows}/${summary.totalCandidateWindows}`,
    `- Skipped windows: ${summary.totalSkippedWindows}`,
    `- Skip reasons: max chunks ${summary.totalSkippedByMaxChunks}, max chars ${summary.totalSkippedByMaxChars}`,
    `- Included chars: ${summary.totalIncludedChars}`,
    `- Inclusion rate: ${(summary.inclusionRate * 100).toFixed(1)}%`,
    '',
    ...(caseLines.length > 0 ? caseLines : ['- none']),
  ];
}

function formatIntegratedRerankedPathDiagnostics(summary: BenchmarkIntegratedRerankedPathSummary): string[] {
  const caseLines = summary.cases
    .slice(0, 8)
    .map(
      (item) =>
        `- ${item.id}: sub-search ${item.subSearchMs}ms, phase total ${item.phaseTotalMs}ms, exact input/output ${item.exactInputChunks}/${item.exactCandidateCount}, lexical input/output ${item.lexicalInputChunks}/${item.lexicalCandidateCount}, rerank/entity/diversify ${item.fusionRerankMs}/${item.fusionEntityMs}/${item.fusionDiversifyMs}ms`,
    );

  return [
    '',
    '## Integrated reranked path diagnostics',
    '',
    `- Cases with reranked path: ${summary.casesWithRerankedPath}`,
    `- Sub-search latency: avg ${summary.averageSubSearchMs}ms, p95 ${summary.p95SubSearchMs}ms, max ${summary.maxSubSearchMs}ms`,
    `- Corpus phase total avg: ${summary.averagePhaseTotalMs}ms`,
    `- Exact input/output avg: ${summary.averageExactInputChunks}/${summary.averageExactCandidateCount}`,
    `- Lexical input/output avg: ${summary.averageLexicalInputChunks}/${summary.averageLexicalCandidateCount}`,
    `- Fusion rerank/entity/diversify avg: ${summary.averageFusionRerankMs}/${summary.averageFusionEntityMs}/${summary.averageFusionDiversifyMs}ms`,
    `- Slow cases: ${summary.slowCaseIds.join(', ') || 'none'}`,
    '',
    ...(caseLines.length > 0 ? caseLines : ['- none']),
  ];
}

function formatSemanticValidationLatencyDiagnostics(summary: BenchmarkSemanticValidationLatencySummary): string[] {
  const caseLines = summary.cases
    .slice(0, 8)
    .map(
      (item) =>
        `- ${item.id}: semantic validation ${item.semanticValidationMs}ms, retrieval ${item.retrievalMs}ms, share ${(item.retrievalShare * 100).toFixed(1)}%, evidence output ${item.evidenceOutputCount}`,
    );

  return [
    '',
    '## Semantic validation latency diagnostics',
    '',
    `- Cases with timing: ${summary.casesWithTiming}`,
    `- Latency: avg ${summary.averageMs}ms, p95 ${summary.p95Ms}ms, max ${summary.maxMs}ms`,
    `- Average retrieval share: ${(summary.averageRetrievalShare * 100).toFixed(1)}%`,
    `- Slow cases: ${summary.slowCaseIds.join(', ') || 'none'}`,
    '',
    ...(caseLines.length > 0 ? caseLines : ['- none']),
  ];
}

function formatEvaluationAuthorityTraceDiagnostics(summary: BenchmarkEvaluationAuthorityTraceSummary): string[] {
  const caseLines = summary.cases
    .slice(0, 8)
    .map(
      (item) =>
        `- ${item.id}: expected stage ${item.expectedDocStage}, top3/top5 ${item.top3Hit ? 'yes' : 'no'}/${item.top5Hit ? 'yes' : 'no'}, drift ${item.drift ? 'yes' : 'no'}, lexical "${item.lexicalTopDoc ?? 'none'}", exact "${item.exactTopDoc ?? 'none'}", fusion "${item.fusionTopDoc ?? 'none'}", visible "${item.visibleTopDoc ?? 'none'}"`,
    );

  return [
    '',
    '## Evaluation authority trace diagnostics',
    '',
    `- Cases with expected doc: ${summary.casesWithExpectedDoc}`,
    `- Lexical/exact/fusion top matches: ${summary.lexicalTopMatches}/${summary.exactTopMatches}/${summary.fusionTopMatches}`,
    `- Visible Top-5 matches: ${summary.visibleTop5Matches}`,
    `- Drift cases: ${summary.driftCases}`,
    `- Missed Top-5 cases: ${summary.missedTop5Cases}`,
    '',
    ...(caseLines.length > 0 ? caseLines : ['- none']),
  ];
}

export function formatRagBenchmarkDiagnosticsMarkdown(report: BenchmarkDiagnosticsReport): string {
  const lines: string[] = [];
  lines.push('# RAG Benchmark Diagnostics');
  lines.push('');
  lines.push(`Generated at: ${report.generatedAt}`);
  if (report.benchmarkGeneratedAt) lines.push(`Benchmark generated at: ${report.benchmarkGeneratedAt}`);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`- Total benchmark cases: ${report.totalCases}`);
  lines.push(`- Analyzed cases: ${report.summary.analyzedCases}`);
  lines.push(`- Actionable cases: ${report.summary.actionableCases}`);
  lines.push(`- Accepted abstain cases: ${report.summary.acceptedAbstainCases}`);
  for (const code of ISSUE_CODES) {
    lines.push(`- ${code}: ${report.summary.issueCounts[code]}`);
  }
  lines.push(...formatSearchMemoDiagnostics(report.summary.searchMemo));
  lines.push(...formatLexicalScoreCacheDiagnostics(report.summary.lexicalScoreCache));
  lines.push(...formatSubSearchLatencyTargets(report.summary.subSearchLatencyTargets));
  lines.push(...formatSearchStoreLatencyTargets(report.summary.searchStoreLatencyTargets));
  lines.push(...formatCorpusPhaseLatencyTargets(report.summary.corpusPhaseLatencyTargets));
  lines.push(...formatLexicalPoolReuseDiagnostics(report.summary.lexicalPoolReuse));
  lines.push(...formatNeighborWindowExpansionDiagnostics(report.summary.neighborWindowExpansion));
  lines.push(...formatSmallToBigContextDiagnostics(report.summary.smallToBigContext));
  lines.push(...formatIntegratedRerankedPathDiagnostics(report.summary.integratedRerankedPath));
  lines.push(...formatSemanticValidationLatencyDiagnostics(report.summary.semanticValidationLatency));
  lines.push(...formatEvaluationAuthorityTraceDiagnostics(report.summary.evaluationAuthorityTrace));
  lines.push('');
  lines.push('## Cases');
  lines.push('');

  if (report.cases.length === 0) {
    lines.push('- 없음');
    return `${lines.join('\n')}\n`;
  }

  for (const item of report.cases) {
    lines.push(`### ${item.id}`);
    lines.push('');
    lines.push(`- Issue: ${item.issueCode}`);
    lines.push(`- Expected doc: ${item.expectedDoc}`);
    lines.push(`- Confidence: ${item.confidence}`);
    lines.push(`- Top-3 hit: ${item.top3Hit ? 'yes' : 'no'}`);
    lines.push(`- Top-5 hit: ${item.top5Hit ? 'yes' : 'no'}`);
    lines.push(`- Expected doc in evidence: ${item.expectedDocInEvidence ? 'yes' : 'no'}`);
    lines.push(`- Recommended action: ${item.recommendedAction}`);
    if (item.top5Docs.length > 0) {
      lines.push('- Top-5 docs:');
      for (const doc of item.top5Docs.slice(0, 5)) lines.push(`  - ${doc}`);
    }
    if (item.evidenceDocs.length > 0) {
      lines.push('- Evidence docs:');
      for (const doc of item.evidenceDocs.slice(0, 8)) lines.push(`  - ${doc}`);
    }
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}
