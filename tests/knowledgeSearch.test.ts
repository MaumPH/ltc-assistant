import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesKnowledgeSearch, type KnowledgeSearchItem } from '../src/lib/knowledgeSearch';

function makeItem(patch: Partial<KnowledgeSearchItem>): KnowledgeSearchItem {
  const name = patch.name ?? '01-07-직원인권보호.md';
  return {
    path: patch.path ?? `/knowledge/evaluation/${name}`,
    name,
    displayTitle: patch.displayTitle ?? name.replace(/\.md$/i, ''),
    category: patch.category ?? '평가·매뉴얼',
    sourceLabel: patch.sourceLabel ?? '평가 문서',
  };
}

test('matchesKnowledgeSearch ignores spacing inside Korean compound terms', () => {
  assert.equal(matchesKnowledgeSearch(makeItem({}), '직원 인권 보호'), true);
  assert.equal(matchesKnowledgeSearch(makeItem({ name: '(붙임)_재가요양보호사_인권보호_매뉴얼(PDF)_최종.md' }), '인권 보호'), true);
});

test('matchesKnowledgeSearch handles punctuation and whitespace differences in law titles', () => {
  const item = makeItem({
    name: '노인장기요양보험법 시행규칙(보건복지부령)(제01138호)(20251212).md',
    displayTitle: '노인장기요양보험법 시행규칙 보건복지부령 제01138호 20251212',
    category: '시행규칙',
    sourceLabel: '일반 문서',
  });

  assert.equal(matchesKnowledgeSearch(item, '노인 장기 요양 보험 법 시행 규칙'), true);
  assert.equal(matchesKnowledgeSearch(item, '제01138호'), true);
});

test('matchesKnowledgeSearch still rejects unrelated queries', () => {
  assert.equal(matchesKnowledgeSearch(makeItem({}), '급여비용 청구'), false);
});
