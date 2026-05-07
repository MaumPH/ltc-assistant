import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRagQualityReport, formatRagQualityReportMarkdown } from '../src/lib/ragQualityReport';
import type { IndexManifestEntry, KnowledgeDoctorIssue } from '../src/lib/ragTypes';

const manifestEntries: IndexManifestEntry[] = [
  {
    documentId: 'doc-a',
    path: '/knowledge/a.md',
    name: 'a.md',
    mode: 'integrated',
    contentHash: 'hash-a',
    size: 1000,
    chunkCount: 4,
    embeddingCount: 4,
  },
  {
    documentId: 'doc-b',
    path: '/knowledge/b.md',
    name: 'b.md',
    mode: 'evaluation',
    contentHash: 'hash-b',
    size: 500,
    chunkCount: 2,
    embeddingCount: 1,
  },
  {
    documentId: 'doc-c',
    path: '/knowledge/c.md',
    name: 'c.md',
    mode: 'integrated',
    contentHash: 'hash-c',
    size: 300,
    chunkCount: 0,
    embeddingCount: 0,
  },
];

const doctorIssues: KnowledgeDoctorIssue[] = [
  {
    code: 'zero-chunks',
    path: '/knowledge/c.md',
    severity: 'warning',
    message: 'No chunks generated.',
  },
];

test('buildRagQualityReport summarizes document and embedding coverage', () => {
  const report = buildRagQualityReport({ manifestEntries, doctorIssues });

  assert.equal(report.summary.documentCount, 3);
  assert.equal(report.summary.chunkCount, 6);
  assert.equal(report.summary.embeddingCount, 5);
  assert.equal(report.summary.embeddingCoverageRatio, 5 / 6);
  assert.deepEqual(report.coverage.zeroChunkDocuments.map((item) => item.path), ['/knowledge/c.md']);
  assert.deepEqual(report.coverage.partialEmbeddingDocuments.map((item) => item.path), ['/knowledge/b.md']);
  assert.equal(report.documents.find((item) => item.path === '/knowledge/c.md')?.doctorIssueCount, 1);
});

test('buildRagQualityReport folds benchmark metrics when supplied', () => {
  const report = buildRagQualityReport({
    manifestEntries,
    doctorIssues,
    benchmark: {
      totalCases: 4,
      top3Hits: 3,
      top5Hits: 4,
      expectedEvidenceHits: 2,
      forbiddenEvidencePasses: 3,
      requiredCitationHits: 1,
      failedCaseIds: ['case-a'],
      failedRecallCaseIds: ['case-a'],
      failedEvidenceCaseIds: [],
      acceptedAbstainCaseIds: ['negative-a'],
      performance: {
        totalDurationMs: 1200,
        caseLatencyMs: {
          average: 300,
          p50: 250,
          p95: 500,
          max: 500,
        },
        stageLatencyMs: {
          retrievalMs: {
            average: 200,
            p50: 180,
            p95: 350,
            max: 350,
          },
        },
        candidateOutputCounts: [
          {
            stage: 'fusion',
            averageOutputCount: 15,
            maxOutputCount: 20,
          },
        ],
        searchMemo: {
          totalHits: 1,
          totalMisses: 3,
          casesWithTrace: 1,
          casesWithHits: 1,
          hitRate: 0.25,
          cases: [
            {
              id: 'case-a',
              hits: 1,
              misses: 3,
              size: 3,
            },
          ],
        },
        lexicalScoreCache: {
          totalHits: 14,
          totalMisses: 21,
          casesWithTrace: 2,
          casesWithHits: 1,
          hitRate: 0.4,
          cases: [
            {
              id: 'case-a',
              hits: 14,
              misses: 11,
              size: 11,
            },
            {
              id: 'case-b',
              hits: 0,
              misses: 10,
              size: 10,
            },
          ],
        },
        subSearchLatencySummary: [
          {
            stage: 'evaluation-base',
            caseCount: 1,
            averageMs: 220,
            p95Ms: 220,
            maxMs: 220,
            slowCaseIds: ['case-a'],
          },
        ],
            searchStoreLatencySummary: [
              {
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
                slowCaseIds: ['case-a'],
              },
            ],
        corpusPhaseLatencySummary: [
          {
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
                slowCaseIds: ['case-a'],
              },
            ],
        lexicalPoolReuse: {
          casesWithDiagnostics: 1,
          averageCoverage: 95.8,
          minCoverage: 95.8,
          fullCoverageCases: 0,
          partialCoverageCases: 1,
          guardResultCounts: {
            disabled: 1,
          },
          cases: [
            {
              id: 'case-a',
              targetStage: 'evaluation-base',
              previousCandidates: 48,
              targetLexicalCandidates: 24,
              overlap: 23,
              coverage: 95.8,
              sourceStages: ['evaluation-routing:24', 'evaluation-direct-support:24'],
              guardPool: 48,
              guardResult: 'disabled',
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
          slowCaseIds: ['case-a'],
          cases: [],
        },
        semanticValidationLatency: {
          casesWithTiming: 1,
          averageMs: 60,
          p95Ms: 60,
          maxMs: 60,
          averageRetrievalShare: 0.3,
          slowCaseIds: ['case-a'],
          cases: [],
        },
        slowCases: [
          {
            id: 'case-a',
            totalMs: 500,
            retrievalMs: 350,
            dominantLatencyStage: 'retrievalMs',
            dominantLatencyMs: 350,
            subSearchTotalMs: 220,
            retrievalOverheadMs: 130,
            retrievalPhaseLatencyMs: {
              'execute-search': 300,
              'evidence-assembly': 30,
            },
            executeSearchPhaseLatencyMs: {
              'evaluation-setup': 40,
              'evaluation-base-setup': 70,
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
              hits: 1,
              misses: 3,
              size: 3,
            },
            subSearchLatencyMs: {
              'evaluation-base': 220,
            },
            stageOutputCounts: {
              fusion: 20,
              lexical_candidates: 18,
            },
          },
        ],
      },
    },
  });

  assert.equal(report.benchmark?.top3HitRate, 0.75);
  assert.equal(report.benchmark?.top5HitRate, 1);
  assert.deepEqual(report.benchmark?.failedCaseIds, ['case-a']);
  assert.deepEqual(report.benchmark?.failedRecallCaseIds, ['case-a']);
  assert.deepEqual(report.benchmark?.failedEvidenceCaseIds, []);
  assert.deepEqual(report.benchmark?.acceptedAbstainCaseIds, ['negative-a']);
  assert.equal(report.benchmark?.performance?.totalDurationMs, 1200);
  assert.equal(report.benchmark?.performance?.caseLatencyMs.p95, 500);
  assert.equal(report.benchmark?.performance?.stageLatencyMs.retrievalMs?.average, 200);
  assert.equal(report.benchmark?.performance?.candidateOutputCounts[0]?.stage, 'fusion');
  assert.equal(report.benchmark?.performance?.slowCases[0]?.id, 'case-a');

  const markdown = formatRagQualityReportMarkdown(report);
  assert.match(markdown, /### Slow benchmark cases/);
  assert.match(markdown, /case-a: total 500ms, retrieval 350ms, sub-search total 220ms, retrieval overhead 130ms, dominant retrievalMs 350ms/);
  assert.match(markdown, /retrieval phases execute-search=300ms, evidence-assembly=30ms/);
  assert.match(markdown, /execute-search phases evaluation-setup=40ms, evaluation-base-setup=70ms/);
  assert.match(markdown, /ontology expansion evaluation-routing seeds=4, hits=6, boosts=9, trace=1, elapsed=35ms/);
  assert.match(markdown, /Search memo: hits 1, misses 3/);
  assert.match(markdown, /Lexical score cache: hits 14, misses 21, cases with hits 1\/2, hit rate 40.0%/);
  assert.match(markdown, /Lexical pool reuse: cases 1, avg coverage 95.8%, min coverage 95.8%, full\/partial 0\/1, guard disabled=1/);
  assert.match(markdown, /evaluation-base: cases 1, total avg 310ms, p95 310ms, db lexical avg 30ms, vector avg 200ms, corpus avg 50ms/);
  assert.match(markdown, /Search corpus phase timing/);
  assert.match(markdown, /evaluation-base: cases 1, total avg 285ms, p95 285ms, lexical pool avg 10ms, exact avg 40ms, lexical avg 120ms, vector avg 5ms, fusion avg 80ms, evidence avg 30ms/);
  assert.match(markdown, /exact input avg 120, exact scored avg 118, exact output avg 16, lexical input avg 120, lexical output avg 24/);
  assert.match(markdown, /fusion detail rrf avg 8ms, rerank avg 18ms, entity avg 35ms, merge avg 9ms, diversify avg 10ms/);
  assert.match(markdown, /Integrated reranked path: cases 1, sub-search avg 260ms, p95 260ms, max 260ms/);
  assert.match(markdown, /exact input\/output avg 1900\/24, lexical input\/output avg 1900\/24/);
  assert.match(markdown, /Semantic validation latency: cases 1, avg 60ms, p95 60ms, max 60ms, avg retrieval share 30.0%/);
  assert.match(markdown, /sub-search evaluation-base=220ms/);
});

test('buildRagQualityReport groups chunk diagnostics by inferred document type', () => {
  const report = buildRagQualityReport({
    manifestEntries: [
      {
        documentId: 'law-doc',
        path: '/knowledge/legal/노인장기요양보험법률.md',
        name: '노인장기요양보험법률.md',
        mode: 'integrated',
        contentHash: 'hash-law',
        size: 12000,
        chunkCount: 12,
        embeddingCount: 6,
      },
      {
        documentId: 'qa-doc',
        path: '/knowledge/eval/평가_Q&A.md',
        name: '평가_Q&A.md',
        mode: 'evaluation',
        contentHash: 'hash-qa',
        size: 5000,
        chunkCount: 1,
        embeddingCount: 0,
      },
      {
        documentId: 'manual-doc',
        path: '/knowledge/eval/2026년 주야간보호 평가매뉴얼.md',
        name: '2026년 주야간보호 평가매뉴얼.md',
        mode: 'evaluation',
        contentHash: 'hash-manual',
        size: 90000,
        chunkCount: 130,
        embeddingCount: 130,
      },
    ],
    doctorIssues: [
      {
        code: 'oversized-section',
        path: '/knowledge/eval/2026년 주야간보호 평가매뉴얼.md',
        severity: 'warning',
        message: 'Large section.',
      },
      {
        code: 'duplicate-content',
        path: '/knowledge/eval/평가_Q&A.md',
        severity: 'warning',
        message: 'Duplicate content.',
      },
    ],
  });

  assert.equal(report.documents.find((item) => item.documentId === 'law-doc')?.sourceType, 'law');
  assert.equal(report.documents.find((item) => item.documentId === 'manual-doc')?.sourceRole, 'primary_evaluation');

  const evaluationGroup = report.chunkDiagnostics.bySourceType.find((item) => item.sourceType === 'evaluation');
  assert.equal(evaluationGroup?.documentCount, 1);
  assert.equal(evaluationGroup?.chunkCount, 130);
  assert.equal(evaluationGroup?.doctorIssueCodeCounts['oversized-section'], 1);

  assert.deepEqual(report.chunkDiagnostics.doctorIssueCodeCounts, {
    'duplicate-content': 1,
    'oversized-section': 1,
  });
  assert.deepEqual(report.chunkDiagnostics.highChunkDocuments.map((item) => item.documentId), ['manual-doc']);
  assert.deepEqual(report.chunkDiagnostics.lowChunkDocuments.map((item) => item.documentId), ['qa-doc']);
  assert.match(report.chunkDiagnostics.embeddingScopeNote, /server-side DB embeddings may differ/);
});

test('buildRagQualityReport summarizes chunk policy boundary and protected group diagnostics', () => {
  const report = buildRagQualityReport({
    manifestEntries: [
      {
        documentId: 'qa-doc',
        path: '/knowledge/faq/급여 질의응답.md',
        name: '급여 질의응답.md',
        mode: 'integrated',
        contentHash: 'hash-qa',
        size: 4000,
        chunkCount: 2,
        embeddingCount: 2,
      },
      {
        documentId: 'law-doc',
        path: '/knowledge/legal/노인장기요양보험법률.md',
        name: '노인장기요양보험법률.md',
        mode: 'integrated',
        contentHash: 'hash-law',
        size: 12000,
        chunkCount: 1,
        embeddingCount: 1,
      },
    ],
    chunks: [
      {
        documentId: 'qa-doc',
        text: '질문 1. 급여계약은 언제 작성하나요?\n답변 1. 서비스 시작 전에 작성합니다.',
        matchedLabels: ['chunk-policy:qa', 'chunk-boundary:qa-boundary'],
        containsCheckList: false,
      },
      {
        documentId: 'qa-doc',
        text: '확인해야 할 서류 목록\n1. 급여계약서\n2. 상담일지',
        matchedLabels: ['chunk-policy:qa', 'chunk-boundary:markdown-heading', 'chunk-protected:checklist'],
        listGroupId: 'list-a',
        containsCheckList: true,
      },
      {
        documentId: 'law-doc',
        text: '제1조(목적)\n' + '법령 본문 '.repeat(400),
        matchedLabels: ['chunk-policy:law', 'chunk-boundary:law-heading'],
      },
    ],
  });

  const qaPolicy = report.chunkDiagnostics.byPolicy.find((item) => item.policy === 'qa');
  const lawPolicy = report.chunkDiagnostics.byPolicy.find((item) => item.policy === 'law');

  assert.equal(report.chunkDiagnostics.policyTaggedChunkCount, 3);
  assert.equal(report.chunkDiagnostics.protectedChunkCount, 1);
  assert.equal(report.chunkDiagnostics.oversizedChunkCount, 1);
  assert.equal(qaPolicy?.chunkCount, 2);
  assert.equal(qaPolicy?.protectedChunkCount, 1);
  assert.equal(qaPolicy?.boundaryReasonCounts['qa-boundary'], 1);
  assert.equal(lawPolicy?.oversizedChunkCount, 1);

  const markdown = formatRagQualityReportMarkdown(report);
  assert.match(markdown, /### By chunk policy/);
  assert.match(markdown, /qa: chunks 2, protected 1, checklist 1, oversized 0, short-noisy 0, boundaries markdown-heading=1, qa-boundary=1/);
  assert.match(markdown, /law: chunks 1, protected 0, checklist 0, oversized 1, short-noisy 0, boundaries law-heading=1/);
});

test('buildRagQualityReport summarizes parent section and neighbor expansion baseline diagnostics', () => {
  const report = buildRagQualityReport({
    manifestEntries: [
      {
        documentId: 'manual-doc',
        path: '/knowledge/manual.md',
        name: 'manual.md',
        mode: 'integrated',
        chunkCount: 4,
        embeddingCount: 0,
        size: 4000,
      },
    ],
    chunks: [
      {
        documentId: 'manual-doc',
        docTitle: '운영 매뉴얼',
        path: '/knowledge/manual.md',
        text: '첫 번째 child chunk',
        parentSectionId: 'section-a',
        parentSectionTitle: '급여 제공 절차',
        windowIndex: 0,
      },
      {
        documentId: 'manual-doc',
        docTitle: '운영 매뉴얼',
        path: '/knowledge/manual.md',
        text: '두 번째 child chunk',
        parentSectionId: 'section-a',
        parentSectionTitle: '급여 제공 절차',
        windowIndex: 1,
      },
      {
        documentId: 'manual-doc',
        docTitle: '운영 매뉴얼',
        path: '/knowledge/manual.md',
        text: '세 번째 child chunk',
        parentSectionId: 'section-a',
        parentSectionTitle: '급여 제공 절차',
        windowIndex: 2,
      },
      {
        documentId: 'manual-doc',
        docTitle: '운영 매뉴얼',
        path: '/knowledge/manual.md',
        text: '독립 chunk',
        parentSectionId: 'section-b',
        parentSectionTitle: '단독 섹션',
        windowIndex: 0,
      },
    ],
  });

  assert.deepEqual(report.chunkDiagnostics.parentChild, {
    parentSectionCount: 2,
    multiWindowParentSectionCount: 1,
    isolatedParentSectionCount: 1,
    averageChunksPerParentSection: 2,
    maxChunksPerParentSection: 3,
    neighborExpandableChunkCount: 3,
    neighborCandidateWindowCount: 4,
    topParentSections: [
      {
        documentId: 'manual-doc',
        docTitle: '운영 매뉴얼',
        path: '/knowledge/manual.md',
        parentSectionId: 'section-a',
        parentSectionTitle: '급여 제공 절차',
        chunkCount: 3,
        firstWindowIndex: 0,
        lastWindowIndex: 2,
      },
      {
        documentId: 'manual-doc',
        docTitle: '운영 매뉴얼',
        path: '/knowledge/manual.md',
        parentSectionId: 'section-b',
        parentSectionTitle: '단독 섹션',
        chunkCount: 1,
        firstWindowIndex: 0,
        lastWindowIndex: 0,
      },
    ],
  });

  const markdown = formatRagQualityReportMarkdown(report);
  assert.match(markdown, /### Parent-child baseline/);
  assert.match(markdown, /Parent sections: 2/);
  assert.match(markdown, /Neighbor-expandable chunks: 3/);
  assert.match(markdown, /급여 제공 절차: chunks 3, windows 0-2/);
});
