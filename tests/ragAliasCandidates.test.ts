import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRagAliasCandidateReport,
  formatRagAliasCandidateMarkdown,
} from '../src/lib/ragAliasCandidates';
import type { BenchmarkCase, IndexManifestEntry } from '../src/lib/ragTypes';

const manifestEntries: IndexManifestEntry[] = [
  {
    documentId: 'payroll-doc',
    path: '/knowledge/2026년_인건비지출비율_다빈도_질의응답.md',
    name: '2026년_인건비지출비율_다빈도_질의응답.md',
    mode: 'integrated',
    contentHash: 'hash-payroll',
    size: 1000,
    chunkCount: 10,
    embeddingCount: 0,
  },
  {
    documentId: 'eval-doc',
    path: '/knowledge/eval/2026년 주야간보호 평가매뉴얼.md',
    name: '2026년 주야간보호 평가매뉴얼.md',
    mode: 'evaluation',
    contentHash: 'hash-eval',
    size: 2000,
    chunkCount: 20,
    embeddingCount: 0,
  },
];

const chunks = [
  {
    id: 'payroll-q',
    document_id: 'payroll-doc',
    doc_title: '2026년_인건비지출비율_다빈도_질의응답',
    file_name: '2026년_인건비지출비율_다빈도_질의응답.md',
    path: '/knowledge/2026년_인건비지출비율_다빈도_질의응답.md',
    title: 'Q&A',
    parent_section_title: '인건비지출비율',
    section_path: ['2026년_인건비지출비율_다빈도_질의응답', 'Q&A'],
    text: '질문: 인건비 지출 비율은 어디에서 확인하나요?\n답변: 관련 고시와 질의응답을 확인합니다.',
  },
  {
    id: 'eval-heading',
    document_id: 'eval-doc',
    doc_title: '2026년 주야간보호 평가매뉴얼',
    file_name: '2026년 주야간보호 평가매뉴얼.md',
    path: '/knowledge/eval/2026년 주야간보호 평가매뉴얼.md',
    title: '직원 인권보호',
    parent_section_title: '직원 인권보호',
    section_path: ['2026년 주야간보호 평가매뉴얼', '직원 인권보호'],
    text: '직원 인권보호 교육과 침해 예방 지침을 확인합니다.',
  },
];

const benchmarkCases: BenchmarkCase[] = [
  {
    id: 'employee-rights',
    mode: 'evaluation',
    question: '직원인권침해교육은 어떻게 해야해',
    expectedDoc: '직원인권보호',
    expectedSection: '',
    acceptableAbstain: false,
  },
];

test('buildRagAliasCandidateReport extracts aliases from titles headings Q&A and benchmark cases', () => {
  const report = buildRagAliasCandidateReport({
    manifestEntries,
    chunks,
    benchmarkCases,
    generatedAt: '2026-04-30T00:00:00.000Z',
  });

  assert.equal(report.summary.documentCount, 2);
  assert.ok(report.summary.candidateCount >= 6);

  const payroll = report.documents.find((document) => document.documentId === 'payroll-doc');
  assert.ok(payroll);
  assert.ok(payroll?.aliases.some((candidate) => candidate.alias === '2026년 인건비지출비율 다빈도 질의응답'));
  assert.ok(payroll?.aliases.some((candidate) => candidate.alias === '인건비지출비율' && candidate.source === 'heading'));
  assert.ok(payroll?.aliases.some((candidate) => candidate.alias === '인건비 지출 비율은 어디에서 확인하나요?' && candidate.source === 'qa-question'));

  const evaluation = report.documents.find((document) => document.documentId === 'eval-doc');
  assert.ok(evaluation?.aliases.some((candidate) => candidate.alias === '직원 인권보호' && candidate.source === 'heading'));
  assert.ok(
    evaluation?.aliases.some(
      (candidate) => candidate.alias === '직원인권침해교육은 어떻게 해야해' && candidate.source === 'benchmark-question',
    ),
  );
  assert.ok(evaluation?.curationHints.some((hint) => hint.includes('knowledge/ontology/curated.json')));
});

test('buildRagAliasCandidateReport deduplicates by compact alias per document and ranks high-value sources first', () => {
  const report = buildRagAliasCandidateReport({
    manifestEntries: [manifestEntries[0]],
    chunks: [
      chunks[0],
      {
        ...chunks[0],
        id: 'payroll-duplicate-heading',
        title: '인건비 지출 비율',
        parent_section_title: '인건비 지출 비율',
      },
    ],
    benchmarkCases: [],
  });

  const aliases = report.documents[0].aliases.filter((candidate) => candidate.compactAlias === '인건비지출비율');
  assert.equal(aliases.length, 1);
  assert.equal(aliases[0].source, 'heading');
});

test('formatRagAliasCandidateMarkdown includes candidate counts and curation hint', () => {
  const report = buildRagAliasCandidateReport({
    manifestEntries,
    chunks,
    benchmarkCases,
  });

  const markdown = formatRagAliasCandidateMarkdown(report);
  assert.match(markdown, /# RAG Alias Candidate Report/);
  assert.match(markdown, /Candidate count:/);
  assert.match(markdown, /직원인권침해교육은 어떻게 해야해/);
  assert.match(markdown, /knowledge\/ontology\/curated\.json/);
});
