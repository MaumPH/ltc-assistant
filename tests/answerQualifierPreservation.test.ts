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
    searchText: overrides.text,
    mode: overrides.mode ?? 'evaluation',
    sourceType: overrides.sourceType ?? 'manual',
    sourceRole: overrides.sourceRole ?? 'primary_evaluation',
    documentGroup: overrides.documentGroup ?? 'manual',
    docTitle: overrides.docTitle ?? '2026년 평가매뉴얼',
    fileName: overrides.fileName ?? '2026년 평가매뉴얼.md',
    path: overrides.path ?? '/knowledge/2026-manual.md',
    effectiveDate: overrides.effectiveDate ?? '2026-01-01',
    publishedDate: overrides.publishedDate ?? '2026-01-01',
    sectionPath: overrides.sectionPath ?? ['2026년 평가매뉴얼', overrides.title ?? '테스트 지표'],
    headingPath: overrides.headingPath ?? ['2026년 평가매뉴얼', overrides.title ?? '테스트 지표'],
    articleNo: overrides.articleNo,
    matchedLabels: overrides.matchedLabels ?? [],
    chunkHash: overrides.chunkHash ?? 'hash-1',
    parentSectionId: overrides.parentSectionId ?? 'section-1',
    parentSectionTitle: overrides.parentSectionTitle ?? (overrides.title ?? '테스트 지표'),
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
    conclusion: '핵심 의무만 간단히 요약합니다.',
    directEvidence: ['평가지표상 기본 의무를 확인했습니다.'],
    practicalGuidance: ['근거 원문을 기준으로 업무를 준비합니다.'],
    caveats: [],
    citationEvidenceIds: ['chunk-1'],
  };
}

function buildFixtures() {
  return new Map<string, StructuredChunk[]>([
    [
      '신규수급자가 오면 해야하는 업무는?',
      [
        buildChunk({
          id: 'chunk-1',
          title: '지표 20',
          articleNo: '지표 20',
          text: [
            '모든 수급자에게 필요한 초기 업무를 실시한다.',
            '신규수급자의 경우 급여제공 시작일부터 토요일·공휴일 포함 14일 이내에 욕구사정을 완료한다.',
            '수급자 또는 보호자가 희망하는 욕구를 기록에 반영한다.',
          ].join('\n'),
        }),
        buildChunk({
          id: 'chunk-2',
          title: '지표 22',
          articleNo: '지표 22',
          parentSectionId: 'section-2',
          citationGroupId: 'doc-1:section-2',
          text: [
            '모든 수급자(보호자)에게 8가지 지침을 설명한다.',
            '신규수급자는 급여제공 시작일까지 안내하고 필요한 기록을 남긴다.',
          ].join('\n'),
        }),
      ],
    ],
    [
      '수급자(보호자)에게 8가지 지침은 얼마나 자주 설명해야 하나?',
      [
        buildChunk({
          id: 'chunk-1',
          title: '지표 19',
          articleNo: '지표 19',
          text: [
            '모든 수급자(보호자)에게 8가지 지침을 설명한다.',
            '욕창예방, 낙상예방, 탈수예방, 배변도움, 관절구축예방, 치매예방, 감염예방, 노인인권보호를 포함한다.',
            '연 1회 이상 설명한 내용을 기록으로 확인한다.',
          ].join('\n'),
        }),
      ],
    ],
    [
      '방문상담은 얼마나 자주 해야 하나?',
      [
        buildChunk({
          id: 'chunk-1',
          title: '지표 22',
          articleNo: '지표 22',
          text: [
            '모든 수급자(보호자)에게 상담을 매월 1회 이상 실시한다.',
            '상담을 통해 파악된 욕구나 상태변화는 상담일로부터 30일 이내에 실제 급여에 반영한다.',
            '다만, 수급자가 12월에 신규로 급여계약을 한 경우에는 1월부터 11월까지 계약을 시작한 수급자에 대해 12월까지 매월 방문상담을 실시하였는지 확인한다.',
          ].join('\n'),
        }),
      ],
    ],
    [
      '상담 결과를 급여에 언제까지 반영해야 하나?',
      [
        buildChunk({
          id: 'chunk-1',
          title: '지표 22',
          articleNo: '지표 22',
          text: [
            '모든 수급자(보호자)에게 상담을 매월 1회 이상 실시한다.',
            '상담 결과는 상담일로부터 30일 이내에 실제 급여에 반영한다.',
            '다만, 수급자가 12월에 신규로 급여계약을 한 경우에는 예외 기준을 적용한다.',
          ].join('\n'),
        }),
      ],
    ],
    [
      '직원변경 상담은 언제까지 해야 하나?',
      [
        buildChunk({
          id: 'chunk-1',
          title: '지표 25',
          articleNo: '지표 25',
          text: [
            '급여제공직원이 변경된 경우 수급자에게 동일한 수준의 서비스를 보장해야 한다.',
            '변경된 직원이 급여를 개시한 날로부터 토요일, 공휴일 포함 14일 이내에 유선 또는 방문상담을 실시한다.',
            '다만, 14일이 도래하기 전에 급여제공직원이 다시 교체되는 경우 일시적인 대체인력은 예외로 인정한다.',
          ].join('\n'),
        }),
      ],
    ],
    [
      '프로그램관리자 급여관리는 얼마나 자주 해야 하나?',
      [
        buildChunk({
          id: 'chunk-1',
          title: '가산',
          articleNo: '가산',
          text: [
            '프로그램관리자는 모든 수급자의 가정을 방문한다.',
            '월 1회 이상 급여제공시간 중에 방문하여 적정 서비스 제공 여부를 확인하고 기록한다.',
          ].join('\n'),
        }),
      ],
    ],
    [
      '기능회복훈련 계획은 얼마나 자주 세워야 하나?',
      [
        buildChunk({
          id: 'chunk-1',
          title: '지표 18',
          articleNo: '지표 18',
          text: [
            '수급자의 개별 기능상태를 고려한 기능회복훈련을 연 1회 이상 계획한다.',
            '다만, 직전년도 12월에 기능회복훈련계획을 포함한 급여제공계획서를 작성하는 경우 예외적으로 인정한다.',
            '신규수급자의 경우 급여제공 시작일까지 작성하였는지 확인한다.',
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
