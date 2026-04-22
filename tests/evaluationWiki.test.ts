import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildJudgementSummary,
  parseEvaluationPage,
  prepareEvaluationSectionMarkdown,
  splitEvaluationSections,
} from '../src/lib/evaluationWiki';

const rawEvaluationPage = `---
title: 4. 경력직
area: 1영역: 기관 운영
service: 주야간보호
source: 2026년 주야간보호 평가매뉴얼
status: draft
---

# 4. 경력직

## 한눈에 보기
- **지표 목적**: 수급자에게 양질의 서비스를 제공할 수 있는 숙련성과 전문성을 갖춘 인력이 근무하는지 평가합니다.
- **핵심 확인 포인트**:
  - ① 2년 이상 운영기관
  - 원문 확인방법의 기준별 체크포인트 대조

## 판단 기준
수급자에게 양질의 서비스를 제공할 수 있는 숙련성과 전문성을 갖춘 인력이 근무하는지 평가합니다.
- 원문에 없는 예외나 완화 기준은 적용하지 않는다.
`;

test('parseEvaluationPage strips frontmatter and the duplicate H1 from rendered body', () => {
  const page = parseEvaluationPage('01-04-경력직.md', rawEvaluationPage);
  const sections = splitEvaluationSections(page.body);

  assert.equal(page.title, '4. 경력직');
  assert.equal(sections.some((section) => section.title === '개요'), false);
  assert.equal(sections[0]?.title, '한눈에 보기');
  assert.doesNotMatch(page.body, /^---/u);
  assert.doesNotMatch(page.body, /^# 4\. 경력직/mu);
});

test('buildJudgementSummary uses the practical judgement sentence only', () => {
  const page = parseEvaluationPage('01-04-경력직.md', rawEvaluationPage);
  const judgement = splitEvaluationSections(page.body).find((section) => section.title === '판단 기준');

  assert.ok(judgement);
  assert.equal(
    buildJudgementSummary(judgement.content, page.body),
    '수급자에게 양질의 서비스를 제공할 수 있는 숙련성과 전문성을 갖춘 인력이 근무하는지 평가합니다.',
  );
});

test('prepareEvaluationSectionMarkdown cleans table conversion noise from criteria', () => {
  const content = `- **② 기 관 인력을 법적기준보다 추가 배치하여 운영한다. 전산**
  - 기 관 인력을 법적기준보다 추가 배치하여 운영한다. 전산
  - ① 기 관
  - 법적 인력배치기준을 준수하는지 확인함`;

  assert.equal(
    prepareEvaluationSectionMarkdown('평가기준', content),
    `- **② 인력을 법적기준보다 추가 배치하여 운영한다.**
  - 법적 인력배치기준을 준수하는지 확인함`,
  );
});
