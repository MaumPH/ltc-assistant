import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CATEGORY_ORDER,
  buildKnowledgeCategoryCounts,
  categorizeKnowledgeFileName,
} from '../src/lib/knowledgeCategories';

test('categorizeKnowledgeFileName maps known file naming rules', () => {
  assert.equal(categorizeKnowledgeFileName('노인장기요양보험법(법률).md'), '법령');
  assert.equal(categorizeKnowledgeFileName('노인장기요양보험법 시행령(시행령).md'), '시행령');
  assert.equal(categorizeKnowledgeFileName('노인장기요양보험법 시행규칙(시행규칙).md'), '시행규칙');
  assert.equal(categorizeKnowledgeFileName('[별표 1] 장기요양기관 기준.md'), '별표·별지');
  assert.equal(categorizeKnowledgeFileName('장기요양기관 운영 고시(고시).md'), '고시');
  assert.equal(categorizeKnowledgeFileName('현지조사 Q&A 사례집.md'), '평가·매뉴얼');
  assert.equal(categorizeKnowledgeFileName('기타 참고문서.md'), '참고자료');
});

test('buildKnowledgeCategoryCounts returns fixed-order counts including zeros', () => {
  const counts = buildKnowledgeCategoryCounts([
    { name: '노인장기요양보험법(법률).md' },
    { name: '장기요양기관 운영 고시(고시).md' },
    { name: '현지조사 Q&A 사례집.md' },
    { name: '기타 참고문서.md' },
    { name: '기타 참고문서 2.md' },
  ]);

  assert.deepEqual(
    counts,
    CATEGORY_ORDER.map((category) => ({
      category,
      count:
        category === '법령'
          ? 1
          : category === '고시'
            ? 1
            : category === '평가·매뉴얼'
              ? 1
              : category === '참고자료'
                ? 2
                : 0,
    })),
  );
});
