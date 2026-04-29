import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { formatMarkdownAnswer } from '../src/lib/answerGeneration';
import type { GroundedAnswer, StructuredChunk } from '../src/lib/ragTypes';

type GoldenCase = {
  query: string;
  must_include_substrings: string[];
  must_cite_indicators?: string[];
};

function parseGoldenQualifierYaml(raw: string): GoldenCase[] {
  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  const cases: GoldenCase[] = [];
  let current: GoldenCase | null = null;
  let activeListKey: 'must_include_substrings' | 'must_cite_indicators' | null = null;

  for (const line of lines) {
    if (!line.trim()) continue;
    if (line.startsWith('- query: ')) {
      if (current) cases.push(current);
      current = {
        query: stripYamlString(line.slice('- query: '.length)),
        must_include_substrings: [],
        must_cite_indicators: [],
      };
      activeListKey = null;
      continue;
    }
    if (!current) continue;
    if (line.startsWith('  must_include_substrings:')) {
      activeListKey = 'must_include_substrings';
      continue;
    }
    if (line.startsWith('  must_cite_indicators:')) {
      activeListKey = 'must_cite_indicators';
      continue;
    }
    if (line.startsWith('    - ') && activeListKey) {
      current[activeListKey]?.push(stripYamlString(line.slice('    - '.length)));
    }
  }

  if (current) cases.push(current);
  return cases;
}

function stripYamlString(value: string): string {
  return value.trim().replace(/^"(.*)"$/, '$1');
}

function buildChunk(overrides: Partial<StructuredChunk> & { text: string }): StructuredChunk {
  return {
    id: overrides.id ?? 'chunk-1',
    documentId: overrides.documentId ?? 'doc-1',
    chunkIndex: overrides.chunkIndex ?? 0,
    title: overrides.title ?? '테스트 지표',
    text: overrides.text,
    textPreview: overrides.text.slice(0, 120),
    searchText: overrides.searchText ?? overrides.text,
    mode: overrides.mode ?? 'evaluation',
    sourceType: overrides.sourceType ?? 'manual',
    sourceRole: overrides.sourceRole ?? 'primary_evaluation',
    documentGroup: overrides.documentGroup ?? 'manual',
    docTitle: overrides.docTitle ?? '2026년 재가급여 평가매뉴얼',
    fileName: overrides.fileName ?? '2026년_재가급여_평가매뉴얼.md',
    path: overrides.path ?? '/knowledge/2026-manual.md',
    effectiveDate: overrides.effectiveDate ?? '2026-01-01',
    publishedDate: overrides.publishedDate ?? '2026-01-01',
    sectionPath: overrides.sectionPath ?? ['2026년 재가급여 평가매뉴얼', overrides.title ?? '테스트 지표'],
    headingPath: overrides.headingPath ?? ['2026년 재가급여 평가매뉴얼', overrides.title ?? '테스트 지표'],
    articleNo: overrides.articleNo,
    matchedLabels: overrides.matchedLabels ?? [],
    chunkHash: overrides.chunkHash ?? 'hash-1',
    parentSectionId: overrides.parentSectionId ?? 'section-1',
    parentSectionTitle: overrides.parentSectionTitle ?? overrides.title ?? '테스트 지표',
    listGroupId: overrides.listGroupId,
    containsCheckList: overrides.containsCheckList ?? true,
    embeddingInput: overrides.embeddingInput,
    windowIndex: overrides.windowIndex ?? 0,
    spanStart: overrides.spanStart ?? 0,
    spanEnd: overrides.spanEnd ?? overrides.text.length,
    citationGroupId: overrides.citationGroupId ?? `${overrides.documentId ?? 'doc-1'}:${overrides.parentSectionId ?? 'section-1'}`,
    linkedDocumentTitles: overrides.linkedDocumentTitles ?? [],
    embedding: overrides.embedding,
  };
}

function buildAnswer(): GroundedAnswer {
  return {
    evidenceState: 'confirmed',
    confidence: 'medium',
    conclusion: '근거를 묶어 신규수급자 업무를 요약합니다.',
    applicabilityConditions: [
      '신규수급자는 급여제공 시작일부터 토요일·공휴일 포함 14일 이내에 실시합니다.',
      '연 1회 이상 설명합니다.',
    ],
    coverageIndicators: ['욕구사정', '급여제공계획', '지침설명'],
    directEvidence: ['평가 지표상 기본 업무와 시한을 함께 확인했습니다.'],
    practicalGuidance: ['각 지표별 기록 여부를 확인합니다.'],
    caveats: [],
    citationEvidenceIds: ['chunk-1', 'chunk-2', 'chunk-3'],
  };
}

function buildFixtures() {
  return new Map<string, StructuredChunk[]>([
    [
      '신규수급자가 오면 해야하는 업무는?',
      [
        buildChunk({
          id: 'chunk-1',
          title: '욕구사정',
          articleNo: '지표 20',
          parentSectionTitle: '욕구사정',
          text: [
            '모든 수급자에게 욕구사정을 실시합니다.',
            '신규수급자는 급여제공 시작일부터 토요일·공휴일 포함 14일 이내에 욕구사정을 완료합니다.',
          ].join('\n'),
        }),
        buildChunk({
          id: 'chunk-2',
          title: '급여제공계획',
          articleNo: '지표 22',
          parentSectionTitle: '급여제공계획',
          parentSectionId: 'section-2',
          citationGroupId: 'doc-1:section-2',
          text: [
            '신규수급자는 급여제공 시작일까지 급여제공계획을 작성합니다.',
            '보호자와 공유한 계획을 기록으로 남깁니다.',
          ].join('\n'),
        }),
        buildChunk({
          id: 'chunk-3',
          title: '지침설명',
          articleNo: '지표 19',
          parentSectionTitle: '지침설명',
          parentSectionId: 'section-3',
          citationGroupId: 'doc-1:section-3',
          text: [
            '모든 수급자와 보호자에게 8가지 지침을 연 1회 이상 설명합니다.',
            '신규수급자는 급여제공 시작일부터 토요일·공휴일 포함 14일 이내에 설명합니다.',
          ].join('\n'),
        }),
      ],
    ],
    [
      '수급자(보호자)에게 8가지 지침은 얼마나 자주 설명해야 하나?',
      [
        buildChunk({
          id: 'chunk-1',
          title: '지침설명',
          articleNo: '지표 19',
          parentSectionTitle: '지침설명',
          text: [
            '모든 수급자와 보호자에게 8가지 지침을 설명합니다.',
            '연 1회 이상 설명하고 이용 시 기록으로 확인합니다.',
          ].join('\n'),
        }),
      ],
    ],
    [
      '방문상담은 얼마나 자주 해야 하나?',
      [
        buildChunk({
          id: 'chunk-1',
          title: '방문상담',
          articleNo: '지표 22',
          parentSectionTitle: '방문상담',
          text: [
            '모든 수급자에게 방문상담을 분기별 1회 이상 실시합니다.',
            '다만, 12월 신규 수급자는 예외 기준을 적용할 수 있습니다.',
          ].join('\n'),
        }),
      ],
    ],
    [
      '상담 결과를 급여에 언제까지 반영해야 하나?',
      [
        buildChunk({
          id: 'chunk-1',
          title: '방문상담',
          articleNo: '지표 22',
          parentSectionTitle: '방문상담',
          text: [
            '상담 결과는 상담일로부터 30일 이내 급여에 반영합니다.',
            '다만, 12월 신규 수급자는 예외 기준을 적용할 수 있습니다.',
          ].join('\n'),
        }),
      ],
    ],
    [
      '직원변경 상담은 언제까지 해야 하나?',
      [
        buildChunk({
          id: 'chunk-1',
          title: '직원변경 상담',
          articleNo: '지표 25',
          parentSectionTitle: '직원변경 상담',
          text: [
            '변경된 직원이 급여를 시작한 날부터 토요일·공휴일 포함 14일 이내 상담을 실시합니다.',
            '다만, 동일 직원이 일시적으로 대체된 경우는 예외로 인정합니다.',
          ].join('\n'),
        }),
      ],
    ],
    [
      '프로그램관리자 급여관리는 얼마나 자주 해야 하나?',
      [
        buildChunk({
          id: 'chunk-1',
          title: '가정방문',
          articleNo: '가정방문',
          parentSectionTitle: '가정방문',
          text: [
            '프로그램관리자는 모든 수급자를 방문합니다.',
            '월 1회 이상 급여제공 시간 중 방문하여 적정 서비스 제공 여부를 확인합니다.',
          ].join('\n'),
        }),
      ],
    ],
    [
      '기능회복훈련 계획은 얼마나 자주 세워야 하나?',
      [
        buildChunk({
          id: 'chunk-1',
          title: '기능회복훈련',
          articleNo: '지표 18',
          parentSectionTitle: '기능회복훈련',
          text: [
            '기능회복훈련 계획은 연 1회 이상 수립합니다.',
            '다만, 12월 계획이 포함된 급여제공계획은 예외로 인정할 수 있습니다.',
            '신규수급자는 급여제공 시작일까지 작성합니다.',
          ].join('\n'),
        }),
      ],
    ],
  ]);
}

const goldenCases = parseGoldenQualifierYaml(
  readFileSync(new URL('../knowledge/_golden_qualifiers.yaml', import.meta.url), 'utf8'),
);
const fixtures = buildFixtures();

for (const goldenCase of goldenCases) {
  test(`formatMarkdownAnswer preserves qualifiers for: ${goldenCase.query}`, () => {
    const citations = fixtures.get(goldenCase.query);
    assert.ok(citations, `missing fixture for query: ${goldenCase.query}`);

    const markdown = formatMarkdownAnswer(buildAnswer(), citations);

    for (const expected of goldenCase.must_include_substrings) {
      assert.match(markdown, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }

    for (const indicator of goldenCase.must_cite_indicators ?? []) {
      assert.match(markdown, new RegExp(indicator.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }
  });
}

test('formatMarkdownAnswer prints indicator coverage before sources when provided', () => {
  const markdown = formatMarkdownAnswer(buildAnswer(), fixtures.get('신규수급자가 오면 해야하는 업무는?') ?? []);

  assert.match(markdown, /\[지표 커버리지\]/);
  assert.match(markdown, /욕구사정/);
  assert.match(markdown, /급여제공계획/);
  assert.match(markdown, /지침설명/);
});
