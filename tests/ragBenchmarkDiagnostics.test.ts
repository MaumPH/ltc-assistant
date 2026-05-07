import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRagBenchmarkDiagnosticsReport,
  formatRagBenchmarkDiagnosticsMarkdown,
} from '../src/lib/ragBenchmarkDiagnostics';

test('buildRagBenchmarkDiagnosticsReport classifies top3 top5 and evidence visibility misses', () => {
  const report = buildRagBenchmarkDiagnosticsReport({
    generatedAt: '2026-04-30T03:00:00.000Z',
    totalCases: 4,
    results: [
      {
        id: 'top3-miss',
        question: '민원상담 사례집 찾아줘',
        expectedDoc: '민원상담_사례집',
        top3Hit: false,
        top5Hit: true,
        abstained: false,
        confidence: 'high',
        top5: [
          { docTitle: '다른 문서' },
          { docTitle: '2026년_노인장기요양보험_민원상담_사례집' },
        ],
        evidenceDocs: ['2026년_노인장기요양보험_민원상담_사례집'],
      },
      {
        id: 'evidence-visible-miss',
        question: '통합재가서비스 운영기준',
        expectedDoc: '통합재가서비스_운영_매뉴얼',
        top3Hit: false,
        top5Hit: false,
        abstained: false,
        confidence: 'high',
        top5: [{ docTitle: '노인장기요양보험법 시행규칙' }],
        evidenceDocs: ['(붙임)_통합재가서비스_운영_매뉴얼'],
      },
      {
        id: 'recall-miss',
        question: '없는 문서',
        expectedDoc: '없는_문서',
        top3Hit: false,
        top5Hit: false,
        abstained: false,
        confidence: 'medium',
        top5: [{ docTitle: '다른 문서' }],
        evidenceDocs: ['다른 문서'],
      },
      {
        id: 'accepted-abstain',
        question: '드론 배송 비용 청구',
        expectedDoc: '노인장기요양보험법',
        top3Hit: false,
        top5Hit: false,
        abstained: true,
        confidence: 'low',
        top5: [{ docTitle: '급여비용 고시' }],
        evidenceDocs: ['급여비용 고시'],
      },
    ],
  });

  assert.equal(report.summary.analyzedCases, 4);
  assert.equal(report.summary.actionableCases, 3);
  assert.equal(report.summary.acceptedAbstainCases, 1);
  assert.equal(report.summary.issueCounts['top3-rerank-priority-miss'], 1);
  assert.equal(report.summary.issueCounts['evidence-visible-fusion-miss'], 1);
  assert.equal(report.summary.issueCounts['candidate-recall-miss'], 1);
  assert.equal(report.summary.issueCounts['accepted-abstain-negative-case'], 1);
  assert.equal(report.cases.find((item) => item.id === 'evidence-visible-miss')?.expectedDocInEvidence, true);
});

test('formatRagBenchmarkDiagnosticsMarkdown summarizes issues and recommended actions', () => {
  const report = buildRagBenchmarkDiagnosticsReport({
    generatedAt: '2026-04-30T03:00:00.000Z',
    totalCases: 1,
    results: [
      {
        id: 'evidence-visible-miss',
        question: '통합재가서비스 운영기준',
        expectedDoc: '통합재가서비스_운영_매뉴얼',
        top3Hit: false,
        top5Hit: false,
        abstained: false,
        confidence: 'high',
        top5: [{ docTitle: '노인장기요양보험법 시행규칙' }],
        evidenceDocs: ['(붙임)_통합재가서비스_운영_매뉴얼'],
      },
    ],
  });

  const markdown = formatRagBenchmarkDiagnosticsMarkdown(report);

  assert.match(markdown, /RAG Benchmark Diagnostics/);
  assert.match(markdown, /Actionable cases: 1/);
  assert.match(markdown, /evidence-visible-fusion-miss/);
  assert.match(markdown, /promote evidence/);
});

test('benchmark diagnostics surfaces search memo and repeated sub-search latency targets', () => {
  const report = buildRagBenchmarkDiagnosticsReport({
    generatedAt: '2026-04-30T03:00:00.000Z',
    totalCases: 2,
    performance: {
      totalDurationMs: 1800,
      caseLatencyMs: { average: 900, p50: 700, p95: 1100, max: 1100 },
      stageLatencyMs: {},
      candidateOutputCounts: [],
      slowCases: [],
      searchMemo: {
        totalHits: 0,
        totalMisses: 9,
        casesWithTrace: 2,
        casesWithHits: 0,
        hitRate: 0,
        cases: [
          { id: 'slow-a', hits: 0, misses: 5, size: 5 },
          { id: 'slow-b', hits: 0, misses: 4, size: 4 },
        ],
      },
      lexicalScoreCache: {
        totalHits: 14,
        totalMisses: 21,
        casesWithTrace: 2,
        casesWithHits: 1,
        hitRate: 0.4,
        cases: [
          { id: 'slow-a', hits: 14, misses: 11, size: 11 },
          { id: 'slow-b', hits: 0, misses: 10, size: 10 },
        ],
      },
      subSearchLatencySummary: [
        {
          stage: 'evaluation-base',
          caseCount: 2,
          averageMs: 420,
          p95Ms: 500,
          maxMs: 500,
          slowCaseIds: ['slow-a', 'slow-b'],
        },
        {
          stage: 'evaluation-routing',
          caseCount: 2,
          averageMs: 310,
          p95Ms: 350,
          maxMs: 350,
          slowCaseIds: ['slow-a', 'slow-b'],
        },
      ],
      searchStoreLatencySummary: [
        {
          stage: 'evaluation-base',
          caseCount: 2,
          averageTotalMs: 430,
          p95TotalMs: 520,
          maxTotalMs: 520,
          averageDbLexicalMs: 40,
          averageVectorMs: 320,
          averageCorpusMs: 70,
          averageDbLexicalCandidates: 24,
          averageVectorCandidates: 48,
          slowCaseIds: ['slow-a', 'slow-b'],
        },
      ],
      corpusPhaseLatencySummary: [
        {
          stage: 'evaluation-base',
          caseCount: 2,
          averageTotalMs: 410,
          p95TotalMs: 500,
          maxTotalMs: 500,
          averageLexicalPoolMs: 20,
          averageExactMs: 70,
          averageLexicalMs: 230,
          averageVectorMs: 0,
          averageFusionMs: 60,
          averageFusionRrfMs: 6,
          averageFusionRerankMs: 14,
          averageFusionEntityMs: 25,
          averageFusionMergeMs: 7,
          averageFusionDiversifyMs: 8,
          averageEvidenceMs: 30,
          slowCaseIds: ['slow-a', 'slow-b'],
        },
      ],
      lexicalPoolReuse: {
        casesWithDiagnostics: 2,
        averageCoverage: 97.9,
        minCoverage: 95.8,
        fullCoverageCases: 1,
        partialCoverageCases: 1,
        guardResultCounts: {
          disabled: 1,
          fallback: 1,
        },
        cases: [
          {
            id: 'slow-b',
            targetStage: 'evaluation-base',
            previousCandidates: 48,
            targetLexicalCandidates: 24,
            overlap: 23,
            coverage: 95.8,
            sourceStages: ['evaluation-routing:24', 'evaluation-direct-support:24'],
            guardPool: 48,
            guardResult: 'fallback',
          },
        ],
      },
      neighborWindowExpansion: {
        casesWithDiagnostics: 1,
        totalWindows: 3,
        currentWindows: 1,
        previousWindows: 1,
        nextWindows: 1,
        selectedEvidenceWindows: 1,
        expansionCandidateWindows: 2,
        averageExpansionCandidates: 2,
        cases: [
          {
            id: 'slow-a',
            totalWindows: 3,
            currentWindows: 1,
            previousWindows: 1,
            nextWindows: 1,
            selectedEvidenceWindows: 1,
            expansionCandidateWindows: 2,
            parentSectionCount: 1,
          },
        ],
      },
      smallToBigContext: {
        casesWithDiagnostics: 1,
        totalCandidateWindows: 2,
        totalIncludedWindows: 1,
        totalSkippedWindows: 1,
        totalSkippedByMaxChunks: 1,
        totalSkippedByMaxChars: 0,
        totalIncludedChars: 640,
        inclusionRate: 0.5,
        cases: [
          {
            id: 'slow-a',
            candidateWindows: 2,
            includedWindows: 1,
            skippedWindows: 1,
            skippedByMaxChunks: 1,
            skippedByMaxChars: 0,
            includedChars: 640,
            maxChars: 2400,
          },
        ],
      },
      integratedRerankedPath: {
        casesWithRerankedPath: 1,
        averageSubSearchMs: 260,
        p95SubSearchMs: 260,
        maxSubSearchMs: 260,
        averagePhaseTotalMs: 250,
        averageExactInputChunks: 1900,
        averageExactCandidateCount: 24,
        averageLexicalInputChunks: 1900,
        averageLexicalCandidateCount: 24,
        averageFusionRerankMs: 31,
        averageFusionEntityMs: 14,
        averageFusionDiversifyMs: 4,
        slowCaseIds: ['slow-a'],
        cases: [
          {
            id: 'slow-a',
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
        ],
      },
      semanticValidationLatency: {
        casesWithTiming: 1,
        averageMs: 60,
        p95Ms: 60,
        maxMs: 60,
        averageRetrievalShare: 0.3,
        slowCaseIds: ['slow-a'],
        cases: [
          {
            id: 'slow-a',
            semanticValidationMs: 60,
            retrievalMs: 200,
            retrievalShare: 0.3,
            evidenceOutputCount: 8,
          },
        ],
      },
      evaluationAuthorityTrace: {
        casesWithExpectedDoc: 1,
        lexicalTopMatches: 1,
        exactTopMatches: 0,
        fusionTopMatches: 0,
        visibleTop5Matches: 1,
        driftCases: 1,
        missedTop5Cases: 0,
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
        ],
      },
    },
    results: [],
  });

  assert.equal(report.summary.searchMemo.totalMisses, 9);
  assert.equal(report.summary.searchMemo.casesWithHits, 0);
  assert.equal(report.summary.lexicalScoreCache.totalHits, 14);
  assert.equal(report.summary.lexicalScoreCache.casesWithHits, 1);
  assert.equal(report.summary.subSearchLatencyTargets[0]?.stage, 'evaluation-base');
  assert.equal(report.summary.subSearchLatencyTargets[0]?.averageMs, 420);
  assert.equal(report.summary.lexicalPoolReuse.casesWithDiagnostics, 2);
  assert.equal(report.summary.lexicalPoolReuse.guardResultCounts.fallback, 1);
  assert.equal(report.summary.neighborWindowExpansion.expansionCandidateWindows, 2);
  assert.equal(report.summary.smallToBigContext.totalIncludedWindows, 1);
  assert.equal(report.summary.integratedRerankedPath.casesWithRerankedPath, 1);
  assert.equal(report.summary.semanticValidationLatency.averageMs, 60);
  assert.equal(report.summary.evaluationAuthorityTrace.driftCases, 1);

  const markdown = formatRagBenchmarkDiagnosticsMarkdown(report);

  assert.match(markdown, /Search memo diagnostics/);
  assert.match(markdown, /Hit rate: 0.0%/);
  assert.match(markdown, /Lexical score cache diagnostics/);
  assert.match(markdown, /Total hits\/misses: 14\/21/);
  assert.match(markdown, /slow-a: hits 14, misses 11, size 11/);
  assert.match(markdown, /Search store latency breakdown/);
  assert.match(markdown, /evaluation-base: cases 2, total avg 430ms, p95 520ms, db lexical avg 40ms, vector avg 320ms, corpus avg 70ms/);
  assert.match(markdown, /Search corpus phase timing/);
  assert.match(markdown, /evaluation-base: cases 2, total avg 410ms, p95 500ms, lexical pool avg 20ms, exact avg 70ms, lexical avg 230ms, vector avg 0ms, fusion avg 60ms, evidence avg 30ms/);
  assert.match(markdown, /fusion detail rrf avg 6ms, rerank avg 14ms, entity avg 25ms, merge avg 7ms, diversify avg 8ms/);
  assert.match(markdown, /evaluation-base/);
  assert.match(markdown, /Lexical pool reuse diagnostics/);
  assert.match(markdown, /Average coverage: 97.9%/);
  assert.match(markdown, /Guard results: disabled=1, fallback=1/);
  assert.match(markdown, /Neighbor window expansion diagnostics/);
  assert.match(markdown, /Expansion candidate windows: 2/);
  assert.match(markdown, /slow-a: windows 3, candidates 2, parents 1/);
  assert.match(markdown, /Small-to-big context inclusion diagnostics/);
  assert.match(markdown, /Included\/candidate windows: 1\/2/);
  assert.match(markdown, /Skip reasons: max chunks 1, max chars 0/);
  assert.match(markdown, /slow-a: included 1\/2, skipped 1 \(chunks 1, chars 0\), chars 640, max chars 2400/);
  assert.match(markdown, /Integrated reranked path diagnostics/);
  assert.match(markdown, /Cases with reranked path: 1/);
  assert.match(markdown, /Exact input\/output avg: 1900\/24/);
  assert.match(markdown, /slow-a: sub-search 260ms, phase total 250ms/);
  assert.match(markdown, /Semantic validation latency diagnostics/);
  assert.match(markdown, /Average retrieval share: 30.0%/);
  assert.match(markdown, /slow-a: semantic validation 60ms, retrieval 200ms, share 30.0%, evidence output 8/);
  assert.match(markdown, /Evaluation authority trace diagnostics/);
  assert.match(markdown, /Lexical\/exact\/fusion top matches: 1\/0\/0/);
  assert.match(markdown, /evaluation-employee-rights-education: expected stage lexical-top/);
});
