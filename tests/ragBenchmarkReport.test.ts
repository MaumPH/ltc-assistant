import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {
  buildBenchmarkOutcomeSummary,
  buildBenchmarkOutputTargets,
  buildBenchmarkPerformanceSummary,
} from '../src/lib/ragBenchmarkReport';

test('buildBenchmarkOutputTargets writes a stable cache file and timestamped archive by default', () => {
  const projectRoot = '/repo';
  const generatedAt = '2026-04-30T01:02:03.004Z';
  const targets = buildBenchmarkOutputTargets({ projectRoot, generatedAt });

  assert.deepEqual(targets, {
    primaryPath: path.join(projectRoot, '.rag-cache', 'rag-benchmark.json'),
    archivePath: path.join(projectRoot, 'benchmarks', 'results', 'rag-benchmark-2026-04-30T01-02-03-004Z.json'),
  });
});

test('buildBenchmarkOutputTargets honors RAG_BENCH_OUTPUT while keeping an archive copy', () => {
  const projectRoot = '/repo';
  const generatedAt = '2026-04-30T01:02:03.004Z';
  const targets = buildBenchmarkOutputTargets({
    projectRoot,
    generatedAt,
    requestedOutputPath: 'tmp/custom-bench.json',
  });

  assert.equal(targets.primaryPath, path.join(projectRoot, 'tmp/custom-bench.json'));
  assert.equal(targets.archivePath, path.join(projectRoot, 'benchmarks', 'results', 'rag-benchmark-2026-04-30T01-02-03-004Z.json'));
});

test('buildBenchmarkOutcomeSummary separates accepted abstain cases from failed recall cases', () => {
  const summary = buildBenchmarkOutcomeSummary([
    {
      id: 'positive-hit',
      top5Hit: true,
      expectedEvidenceHit: true,
      forbiddenEvidencePass: true,
      requiredCitationHit: true,
      acceptableAbstain: false,
      abstained: false,
    },
    {
      id: 'accepted-negative',
      top5Hit: false,
      expectedEvidenceHit: true,
      forbiddenEvidencePass: true,
      requiredCitationHit: true,
      acceptableAbstain: true,
      abstained: true,
    },
    {
      id: 'real-miss',
      top5Hit: false,
      expectedEvidenceHit: true,
      forbiddenEvidencePass: true,
      requiredCitationHit: true,
      acceptableAbstain: false,
      abstained: false,
    },
  ]);

  assert.deepEqual(summary.acceptedAbstainCaseIds, ['accepted-negative']);
  assert.deepEqual(summary.failedRecallCaseIds, ['real-miss']);
  assert.deepEqual(summary.failedCaseIds, ['real-miss']);
});

test('buildBenchmarkPerformanceSummary summarizes case latency and stage candidate counts', () => {
  const summary = buildBenchmarkPerformanceSummary({
    totalDurationMs: 1200,
    results: [
      {
        id: 'case-a',
        latency: {
          queryNormalizationMs: 10,
          retrievalMs: 100,
          totalMs: 150,
        },
        stageTrace: [
          { stage: 'lexical_candidates', outputCount: 20 },
          { stage: 'fusion', outputCount: 12 },
        ],
      },
      {
        id: 'case-b',
        latency: {
          queryNormalizationMs: 20,
          retrievalMs: 300,
          totalMs: 450,
        },
        stageTrace: [
          { stage: 'lexical_candidates', outputCount: 10 },
          { stage: 'fusion', outputCount: 18 },
        ],
      },
      {
        id: 'case-c',
        latency: {
          queryNormalizationMs: 5,
          retrievalMs: 800,
          totalMs: 900,
        },
        plannerTrace: [
          {
            step: 'search-memo',
            detail: 'hits=2, misses=4, size=4',
          },
          {
            step: 'lexical-score-cache',
            detail: 'hits=7, misses=11, size=11',
          },
          {
            step: 'sub-search-latency',
            detail: 'evaluation-routing=120ms, evaluation-base=310ms, evaluation-primary-manual=45ms',
          },
          {
            step: 'retrieval-phase-timing',
            detail: 'execute-search=650ms, evidence-assembly=80ms, context-assembly=40ms',
          },
          {
            step: 'execute-search-phase-timing',
            detail: 'evaluation-setup=40ms, evaluation-routing-postprocess=35ms, evaluation-base-setup=70ms',
          },
          {
            step: 'ontology-expansion',
            detail: 'stage=evaluation-routing,seeds=4,hits=6,boosts=9,trace=1,elapsed=35ms',
          },
          {
            step: 'search-store-latency',
            detail:
              'evaluation-routing:dbLexical=20ms,vector=80ms,corpus=10ms,total=120ms,dbLexicalCandidates=24,vectorCandidates=48,phaseLexicalPool=4ms,phaseExact=12ms,phaseLexical=30ms,phaseVector=5ms,phaseFusion=20ms,phaseFusionRrf=3ms,phaseFusionRerank=7ms,phaseFusionEntity=6ms,phaseFusionMerge=2ms,phaseFusionDiversify=2ms,phaseEvidence=8ms,phaseTotal=79ms,phaseExactInput=80,phaseExactScored=78,phaseExactCandidates=12,phaseLexicalInput=80,phaseLexicalCandidates=18; evaluation-base:dbLexical=30ms,vector=200ms,corpus=50ms,total=310ms,dbLexicalCandidates=24,vectorCandidates=48,phaseLexicalPool=10ms,phaseExact=40ms,phaseLexical=120ms,phaseVector=5ms,phaseFusion=80ms,phaseFusionRrf=8ms,phaseFusionRerank=18ms,phaseFusionEntity=35ms,phaseFusionMerge=9ms,phaseFusionDiversify=10ms,phaseEvidence=30ms,phaseTotal=285ms,phaseExactInput=120,phaseExactScored=118,phaseExactCandidates=16,phaseLexicalInput=120,phaseLexicalCandidates=24',
          },
        ],
        stageTrace: [
          { stage: 'lexical_candidates', outputCount: 24 },
          { stage: 'fusion', outputCount: 25 },
          { stage: 'answer_evidence_gate', outputCount: 9 },
        ],
      },
    ],
  });

  assert.equal(summary.totalDurationMs, 1200);
  assert.deepEqual(summary.caseLatencyMs, {
    average: 500,
    p50: 450,
    p95: 900,
    max: 900,
  });
  assert.deepEqual(summary.stageLatencyMs.retrievalMs, {
    average: 400,
    p50: 300,
    p95: 800,
    max: 800,
  });
  assert.deepEqual(summary.candidateOutputCounts.find((item) => item.stage === 'fusion'), {
    stage: 'fusion',
    averageOutputCount: 18.3,
    maxOutputCount: 25,
  });
  assert.deepEqual(summary.slowCases[0], {
    id: 'case-c',
    totalMs: 900,
    retrievalMs: 800,
    dominantLatencyStage: 'retrievalMs',
    dominantLatencyMs: 800,
    subSearchTotalMs: 475,
    retrievalOverheadMs: 325,
    retrievalPhaseLatencyMs: {
      'context-assembly': 40,
      'evidence-assembly': 80,
      'execute-search': 650,
    },
    executeSearchPhaseLatencyMs: {
      'evaluation-base-setup': 70,
      'evaluation-routing-postprocess': 35,
      'evaluation-setup': 40,
    },
    ontologyExpansionDiagnostics: [
      {
        stage: 'evaluation-routing',
        seedDocuments: 4,
        hits: 6,
        boostedDocuments: 9,
        traceEntries: 1,
        elapsedMs: 35,
      },
    ],
    searchMemoStats: {
      hits: 2,
      misses: 4,
      size: 4,
    },
    subSearchLatencyMs: {
      'evaluation-base': 310,
      'evaluation-primary-manual': 45,
      'evaluation-routing': 120,
    },
    stageOutputCounts: {
      answer_evidence_gate: 9,
      fusion: 25,
      lexical_candidates: 24,
    },
  });
  assert.deepEqual(summary.searchMemo, {
    totalHits: 2,
    totalMisses: 4,
    casesWithTrace: 1,
    casesWithHits: 1,
    hitRate: 0.3333,
    cases: [
      {
        id: 'case-c',
        hits: 2,
        misses: 4,
        size: 4,
      },
    ],
  });
  assert.deepEqual(summary.lexicalScoreCache, {
    totalHits: 7,
    totalMisses: 11,
    casesWithTrace: 1,
    casesWithHits: 1,
    hitRate: 0.3889,
    cases: [
      {
        id: 'case-c',
        hits: 7,
        misses: 11,
        size: 11,
      },
    ],
  });
  assert.deepEqual(summary.subSearchLatencySummary.find((item) => item.stage === 'evaluation-base'), {
    stage: 'evaluation-base',
    caseCount: 1,
    averageMs: 310,
    p95Ms: 310,
    maxMs: 310,
    slowCaseIds: ['case-c'],
  });
  assert.deepEqual(summary.searchStoreLatencySummary.find((item) => item.stage === 'evaluation-base'), {
    stage: 'evaluation-base',
    caseCount: 1,
    averageTotalMs: 310,
    p95TotalMs: 310,
    maxTotalMs: 310,
    averageDbLexicalMs: 30,
    averageVectorMs: 200,
    averageCorpusMs: 50,
    averageDbLexicalCandidates: 24,
    averageVectorCandidates: 48,
    slowCaseIds: ['case-c'],
  });
  assert.deepEqual(summary.corpusPhaseLatencySummary.find((item) => item.stage === 'evaluation-base'), {
    stage: 'evaluation-base',
    caseCount: 1,
    averageTotalMs: 285,
    p95TotalMs: 285,
    maxTotalMs: 285,
    averageLexicalPoolMs: 10,
    averageExactMs: 40,
    averageLexicalMs: 120,
    averageVectorMs: 5,
    averageFusionMs: 80,
    averageFusionRrfMs: 8,
    averageFusionRerankMs: 18,
    averageFusionEntityMs: 35,
    averageFusionMergeMs: 9,
    averageFusionDiversifyMs: 10,
    averageEvidenceMs: 30,
    averageExactInputChunks: 120,
    averageExactScoredChunks: 118,
    averageExactCandidateCount: 16,
    averageLexicalInputChunks: 120,
    averageLexicalCandidateCount: 24,
    slowCaseIds: ['case-c'],
  });
});

test('buildBenchmarkPerformanceSummary summarizes lexical pool reuse diagnostics and guard results', () => {
  const summary = buildBenchmarkPerformanceSummary({
    totalDurationMs: 900,
    results: [
      {
        id: 'evaluation-a',
        latency: { totalMs: 400 },
        plannerTrace: [
          {
            step: 'lexical-pool-reuse-guard',
            detail: 'target=evaluation-base, pool=48, result=disabled',
          },
          {
            step: 'lexical-pool-reuse',
            detail:
              'target=evaluation-base, previous=48, targetLexical=24, overlap=24, coverage=100.0%, stages=evaluation-routing:24|evaluation-direct-support:24',
          },
        ],
      },
      {
        id: 'evaluation-b',
        latency: { totalMs: 500 },
        plannerTrace: [
          {
            step: 'lexical-pool-reuse-guard',
            detail: 'target=evaluation-base, pool=48, result=fallback',
          },
          {
            step: 'lexical-pool-reuse',
            detail:
              'target=evaluation-base, previous=48, targetLexical=24, overlap=23, coverage=95.8%, stages=evaluation-routing:24|evaluation-direct-support:24',
          },
        ],
      },
    ],
  });

  assert.equal(summary.lexicalPoolReuse?.casesWithDiagnostics, 2);
  assert.equal(summary.lexicalPoolReuse?.averageCoverage, 97.9);
  assert.equal(summary.lexicalPoolReuse?.minCoverage, 95.8);
  assert.equal(summary.lexicalPoolReuse?.fullCoverageCases, 1);
  assert.equal(summary.lexicalPoolReuse?.partialCoverageCases, 1);
  assert.deepEqual(summary.lexicalPoolReuse?.guardResultCounts, {
    disabled: 1,
    fallback: 1,
  });
  assert.deepEqual(summary.lexicalPoolReuse?.cases[0], {
    id: 'evaluation-b',
    targetStage: 'evaluation-base',
    previousCandidates: 48,
    targetLexicalCandidates: 24,
    overlap: 23,
    coverage: 95.8,
    sourceStages: ['evaluation-routing:24', 'evaluation-direct-support:24'],
    guardPool: 48,
    guardResult: 'fallback',
  });
});

test('buildBenchmarkPerformanceSummary summarizes integrated reranked path diagnostics', () => {
  const summary = buildBenchmarkPerformanceSummary({
    totalDurationMs: 700,
    results: [
      {
        id: 'integrated-slow',
        latency: { totalMs: 700 },
        plannerTrace: [
          {
            step: 'sub-search-latency',
            detail: 'integrated-initial=80ms, integrated-reranked=260ms, integrated-promoted-primary=40ms',
          },
          {
            step: 'search-store-latency',
            detail:
              'integrated-reranked:dbLexical=0ms,vector=0ms,corpus=250ms,total=255ms,dbLexicalCandidates=0,vectorCandidates=0,phaseLexicalPool=12ms,phaseExact=70ms,phaseLexical=90ms,phaseVector=0ms,phaseFusion=60ms,phaseFusionRrf=7ms,phaseFusionRerank=31ms,phaseFusionEntity=14ms,phaseFusionMerge=4ms,phaseFusionDiversify=4ms,phaseEvidence=18ms,phaseTotal=250ms,phaseExactInput=1900,phaseExactScored=1880,phaseExactCandidates=24,phaseLexicalInput=1900,phaseLexicalCandidates=24',
          },
        ],
      },
      {
        id: 'integrated-fast',
        latency: { totalMs: 400 },
        plannerTrace: [
          {
            step: 'sub-search-latency',
            detail: 'integrated-reranked=100ms',
          },
          {
            step: 'search-store-latency',
            detail:
              'integrated-reranked:dbLexical=0ms,vector=0ms,corpus=95ms,total=98ms,dbLexicalCandidates=0,vectorCandidates=0,phaseLexicalPool=5ms,phaseExact=20ms,phaseLexical=30ms,phaseVector=0ms,phaseFusion=25ms,phaseFusionRrf=2ms,phaseFusionRerank=9ms,phaseFusionEntity=8ms,phaseFusionMerge=3ms,phaseFusionDiversify=3ms,phaseEvidence=12ms,phaseTotal=92ms,phaseExactInput=900,phaseExactScored=880,phaseExactCandidates=12,phaseLexicalInput=900,phaseLexicalCandidates=18',
          },
        ],
      },
    ],
  });

  assert.deepEqual(summary.integratedRerankedPath, {
    casesWithRerankedPath: 2,
    averageSubSearchMs: 180,
    p95SubSearchMs: 260,
    maxSubSearchMs: 260,
    averagePhaseTotalMs: 171,
    averageExactInputChunks: 1400,
    averageExactCandidateCount: 18,
    averageLexicalInputChunks: 1400,
    averageLexicalCandidateCount: 21,
    averageFusionRerankMs: 20,
    averageFusionEntityMs: 11,
    averageFusionDiversifyMs: 3.5,
    slowCaseIds: ['integrated-slow', 'integrated-fast'],
    cases: [
      {
        id: 'integrated-slow',
        subSearchMs: 260,
        searchStoreTotalMs: 255,
        phaseTotalMs: 250,
        lexicalPoolMs: 12,
        exactMs: 70,
        lexicalMs: 90,
        vectorMs: 0,
        fusionMs: 60,
        fusionRerankMs: 31,
        fusionEntityMs: 14,
        fusionDiversifyMs: 4,
        evidenceMs: 18,
        exactInputChunks: 1900,
        exactCandidateCount: 24,
        lexicalInputChunks: 1900,
        lexicalCandidateCount: 24,
      },
      {
        id: 'integrated-fast',
        subSearchMs: 100,
        searchStoreTotalMs: 98,
        phaseTotalMs: 92,
        lexicalPoolMs: 5,
        exactMs: 20,
        lexicalMs: 30,
        vectorMs: 0,
        fusionMs: 25,
        fusionRerankMs: 9,
        fusionEntityMs: 8,
        fusionDiversifyMs: 3,
        evidenceMs: 12,
        exactInputChunks: 900,
        exactCandidateCount: 12,
        lexicalInputChunks: 900,
        lexicalCandidateCount: 18,
      },
    ],
  });
});

test('buildBenchmarkPerformanceSummary summarizes semantic validation latency diagnostics', () => {
  const summary = buildBenchmarkPerformanceSummary({
    totalDurationMs: 900,
    results: [
      {
        id: 'validation-slow',
        latency: { retrievalMs: 200, totalMs: 260 },
        plannerTrace: [
          {
            step: 'retrieval-phase-timing',
            detail: 'execute-search=120ms, semantic-validation=60ms, context-assembly=20ms',
          },
        ],
        stageTrace: [{ stage: 'answer_evidence_gate', outputCount: 8 }],
      },
      {
        id: 'validation-fast',
        latency: { retrievalMs: 100, totalMs: 140 },
        plannerTrace: [
          {
            step: 'retrieval-phase-timing',
            detail: 'execute-search=80ms, semantic-validation=10ms, context-assembly=10ms',
          },
        ],
        stageTrace: [{ stage: 'answer_evidence_gate', outputCount: 4 }],
      },
    ],
  });

  assert.deepEqual(summary.semanticValidationLatency, {
    casesWithTiming: 2,
    averageMs: 35,
    p95Ms: 60,
    maxMs: 60,
    averageRetrievalShare: 0.2,
    slowCaseIds: ['validation-slow', 'validation-fast'],
    cases: [
      {
        id: 'validation-slow',
        semanticValidationMs: 60,
        retrievalMs: 200,
        retrievalShare: 0.3,
        evidenceOutputCount: 8,
      },
      {
        id: 'validation-fast',
        semanticValidationMs: 10,
        retrievalMs: 100,
        retrievalShare: 0.1,
        evidenceOutputCount: 4,
      },
    ],
  });
});

test('buildBenchmarkPerformanceSummary summarizes evaluation authority trace diagnostics', () => {
  const summary = buildBenchmarkPerformanceSummary({
    totalDurationMs: 900,
    results: [
      {
        id: 'evaluation-employee-rights-education',
        expectedDoc: '직원인권보호',
        top3Hit: true,
        top5Hit: true,
        top5: [{ docTitle: '2026년 주야간보호 평가매뉴얼' }, { docTitle: '01-07-직원인권보호' }],
        stageTrace: [
          { stage: 'lexical_candidates', outputCount: 24, notes: ['top=01-07-직원인권보호'] },
          {
            stage: 'fusion',
            outputCount: 24,
            notes: [
              'exact=22',
              'lexical=24',
              'vector=0',
              'exact-top=2026년 주야간보호 평가매뉴얼',
              'fusion-top=2026년 주야간보호 평가매뉴얼',
            ],
          },
        ],
      },
      {
        id: 'evaluation-base-miss',
        expectedDoc: '급여제공지침',
        top3Hit: false,
        top5Hit: false,
        top5: [{ docTitle: '일반 운영 매뉴얼' }],
        stageTrace: [
          { stage: 'lexical_candidates', outputCount: 24, notes: ['top=일반 운영 매뉴얼'] },
          {
            stage: 'fusion',
            outputCount: 24,
            notes: ['exact=0', 'lexical=24', 'vector=0', 'fusion-top=일반 운영 매뉴얼'],
          },
        ],
      },
    ],
  });

  assert.deepEqual(summary.evaluationAuthorityTrace, {
    casesWithExpectedDoc: 2,
    lexicalTopMatches: 1,
    exactTopMatches: 0,
    fusionTopMatches: 0,
    visibleTop5Matches: 1,
    driftCases: 1,
    missedTop5Cases: 1,
    cases: [
      {
        id: 'evaluation-employee-rights-education',
        expectedDoc: '직원인권보호',
        top3Hit: true,
        top5Hit: true,
        lexicalTopDoc: '01-07-직원인권보호',
        exactTopDoc: '2026년 주야간보호 평가매뉴얼',
        fusionTopDoc: '2026년 주야간보호 평가매뉴얼',
        visibleTopDoc: '2026년 주야간보호 평가매뉴얼',
        expectedDocStage: 'lexical-top',
        drift: true,
      },
      {
        id: 'evaluation-base-miss',
        expectedDoc: '급여제공지침',
        top3Hit: false,
        top5Hit: false,
        lexicalTopDoc: '일반 운영 매뉴얼',
        fusionTopDoc: '일반 운영 매뉴얼',
        visibleTopDoc: '일반 운영 매뉴얼',
        expectedDocStage: 'missing',
        drift: false,
      },
    ],
  });
});

test('buildBenchmarkPerformanceSummary summarizes neighbor window expansion diagnostics', () => {
  const summary = buildBenchmarkPerformanceSummary({
    totalDurationMs: 700,
    results: [
      {
        id: 'case-with-neighbors',
        latency: { totalMs: 300 },
        neighborWindows: [
          {
            id: 'chunk-a-0',
            relation: 'current',
            selectedAsEvidence: true,
            parentSectionId: 'section-a',
            windowIndex: 0,
          },
          {
            id: 'chunk-a-1',
            relation: 'next',
            selectedAsEvidence: false,
            parentSectionId: 'section-a',
            windowIndex: 1,
          },
          {
            id: 'chunk-b-0',
            relation: 'previous',
            selectedAsEvidence: false,
            parentSectionId: 'section-b',
            windowIndex: 0,
          },
        ],
      },
      {
        id: 'case-current-only',
        latency: { totalMs: 400 },
        neighborWindows: [
          {
            id: 'chunk-c-0',
            relation: 'current',
            selectedAsEvidence: true,
            parentSectionId: 'section-c',
            windowIndex: 0,
          },
        ],
      },
    ],
  });

  assert.deepEqual(summary.neighborWindowExpansion, {
    casesWithDiagnostics: 2,
    totalWindows: 4,
    currentWindows: 2,
    previousWindows: 1,
    nextWindows: 1,
    selectedEvidenceWindows: 2,
    expansionCandidateWindows: 2,
    averageExpansionCandidates: 1,
    cases: [
      {
        id: 'case-with-neighbors',
        totalWindows: 3,
        currentWindows: 1,
        previousWindows: 1,
        nextWindows: 1,
        selectedEvidenceWindows: 1,
        expansionCandidateWindows: 2,
        parentSectionCount: 2,
      },
      {
        id: 'case-current-only',
        totalWindows: 1,
        currentWindows: 1,
        previousWindows: 0,
        nextWindows: 0,
        selectedEvidenceWindows: 1,
        expansionCandidateWindows: 0,
        parentSectionCount: 1,
      },
    ],
  });
});

test('buildBenchmarkPerformanceSummary summarizes small-to-big context inclusion traces', () => {
  const summary = buildBenchmarkPerformanceSummary({
    totalDurationMs: 900,
    results: [
      {
        id: 'case-with-context',
        latency: { totalMs: 500 },
        plannerTrace: [
          {
            step: 'small-to-big-context',
            detail: 'candidates=4, included=3, skipped=1, skippedByMaxChunks=1, skippedByMaxChars=0, chars=1200, maxChars=3200',
          },
        ],
      },
      {
        id: 'case-without-context',
        latency: { totalMs: 400 },
        plannerTrace: [
          {
            step: 'small-to-big-context',
            detail: 'candidates=2, included=0, skipped=2, skippedByMaxChunks=0, skippedByMaxChars=2, chars=0, maxChars=2400',
          },
        ],
      },
      {
        id: 'case-no-candidates',
        latency: { totalMs: 300 },
        plannerTrace: [
          {
            step: 'small-to-big-context',
            detail: 'candidates=0, included=0, skipped=0, skippedByMaxChunks=0, skippedByMaxChars=0, chars=0, maxChars=2400',
          },
        ],
      },
    ],
  });

  assert.deepEqual(summary.smallToBigContext, {
    casesWithDiagnostics: 3,
    totalCandidateWindows: 6,
    totalIncludedWindows: 3,
    totalSkippedWindows: 3,
    totalSkippedByMaxChunks: 1,
    totalSkippedByMaxChars: 2,
    totalIncludedChars: 1200,
    inclusionRate: 0.5,
    cases: [
      {
        id: 'case-without-context',
        candidateWindows: 2,
        includedWindows: 0,
        skippedWindows: 2,
        skippedByMaxChunks: 0,
        skippedByMaxChars: 2,
        includedChars: 0,
        maxChars: 2400,
      },
      {
        id: 'case-with-context',
        candidateWindows: 4,
        includedWindows: 3,
        skippedWindows: 1,
        skippedByMaxChunks: 1,
        skippedByMaxChars: 0,
        includedChars: 1200,
        maxChars: 3200,
      },
      {
        id: 'case-no-candidates',
        candidateWindows: 0,
        includedWindows: 0,
        skippedWindows: 0,
        skippedByMaxChunks: 0,
        skippedByMaxChars: 0,
        includedChars: 0,
        maxChars: 2400,
      },
    ],
  });
});
