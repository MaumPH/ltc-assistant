import assert from 'node:assert/strict';
import test from 'node:test';
import { buildRagCorpusIndex, searchCorpus } from '../src/lib/ragEngine';
import { buildStructuredChunks } from '../src/lib/ragStructured';
import type { KnowledgeFile } from '../src/lib/ragTypes';

function knowledgeFile(content: string, name = '?좉퇋?섍툒???낅Т.md'): KnowledgeFile {
  return {
    path: `/knowledge/manual/${name}`,
    name,
    size: content.length,
    content,
    updatedAt: '2026-04-28T00:00:00.000Z',
  };
}

test('heading-aware chunking keeps checklist and deadline evidence together', () => {
  const file = knowledgeFile(`# ?좉퇋?섍툒???낅Т

?좉퇋?섍툒?먭? ?붿쓣??珥덇린 ?낅Т???곷떞, ?뺢뎄?ъ젙, 湲됱뿬?쒓났怨꾪쉷 ?섎┰, 怨꾩빟 泥닿껐???뺤씤?쒕떎.
紐⑤뱺 ?섍툒??蹂댄샇???먭쾶 8媛吏 吏移⑥뿉 ?????1???댁긽 ?ㅻ챸?쒕떎.
1. ?뺤갹?덈갑
2. ?숈긽?덈갑
3. ?덉닔?덈갑
4. 諛곕??꾩?
5. 愿?덇뎄異뺤삁諛?6. 移섎ℓ?덈갑
7. 媛먯뿼?덈갑
8. ?몄씤?멸텒蹂댄샇
?좉퇋?섍툒?먮뒗 湲됱뿬?쒓났 ?쒖옉?쇰????좎슂?셋룰났?댁씪 ?ы븿 14???대궡???ㅼ떆?섏??붿? ?뺤씤??
`);

  const chunks = buildStructuredChunks([file]);
  const checklistChunk = chunks.find((chunk) => chunk.text.includes('8媛吏') && chunk.text.includes('14???대궡'));

  assert.ok(checklistChunk, 'expected one chunk to keep 8媛吏 吏移?and 14??湲고븳 together');
  assert.equal(checklistChunk?.containsCheckList, true);
  assert.ok(checklistChunk?.listGroupId);
  assert.deepEqual(checklistChunk?.headingPath, ['?좉퇋?섍툒???낅Т', '?좉퇋?섍툒???낅Т']);
  assert.ok((checklistChunk?.embeddingInput ?? '').includes('[문서:'));
  assert.ok((checklistChunk?.embeddingInput ?? '').includes('[섹션:'));
});

test('procedure retrieval includes protected checklist chunk as evidence', () => {
  const target = knowledgeFile(`# ?좉퇋?섍툒???낅Т

?좉퇋?섍툒?먭? ?붿쓣??珥덇린 ?낅Т???곷떞, ?뺢뎄?ъ젙, 湲됱뿬?쒓났怨꾪쉷 ?섎┰, 怨꾩빟 泥닿껐???뺤씤?쒕떎.
紐⑤뱺 ?섍툒??蹂댄샇???먭쾶 8媛吏 吏移⑥뿉 ?????1???댁긽 ?ㅻ챸?쒕떎.
1. ?뺤갹?덈갑
2. ?숈긽?덈갑
3. ?덉닔?덈갑
4. 諛곕??꾩?
5. 愿?덇뎄異뺤삁諛?6. 移섎ℓ?덈갑
7. 媛먯뿼?덈갑
8. ?몄씤?멸텒蹂댄샇
?좉퇋?섍툒?먮뒗 湲됱뿬?쒓났 ?쒖옉?쇰????좎슂?셋룰났?댁씪 ?ы븿 14???대궡???ㅼ떆?섏??붿? ?뺤씤??
`);
  const distractors = Array.from({ length: 10 }, (_, index) =>
    knowledgeFile(`# ?쇰컲 ?낅Т ${index}

湲곌? ?댁쁺 湲곕줉怨??쇰컲 ?먭? ?ы빆???뺣━?쒕떎. ?좉퇋 ?낅Т?쇰뒗 ?⑥뼱留??ы븿??臾닿? 臾몄꽌?대떎.
`, `?쇰컲?낅Т-${index}.md`),
  );

  const chunks = buildStructuredChunks([target, ...distractors]);
  const result = searchCorpus({
    index: buildRagCorpusIndex(chunks),
    query: '?좉퇋?섍툒?먭? ?붿쓣???댁빞?섎뒗 ?낅Т??',
    mode: 'integrated',
  });
  const evidenceText = result.evidence.map((chunk) => chunk.text).join('\n');

  assert.ok(evidenceText.includes('8'));
  assert.ok(evidenceText.length > 0);
  assert.ok(evidenceText.includes('14'));
});


test('qualifier-only paragraph is treated as protected checklist evidence', () => {
  const file = knowledgeFile(`# 방문상담

모든 수급자(보호자)에게 상담을 매월 1회 이상 실시한다.
다만, 수급자가 12월에 신규로 급여계약을 한 경우에는 예외 기준을 적용한다.
상담 결과는 상담일로부터 30일 이내에 급여에 반영한다.
`);

  const chunks = buildStructuredChunks([file]);
  const qualifierChunk = chunks.find((chunk) => chunk.text.includes('12월에 신규로 급여계약') && chunk.text.includes('30일 이내'));

  assert.ok(qualifierChunk, 'expected qualifier paragraph to remain in one chunk');
  assert.equal(qualifierChunk?.containsCheckList, true);
});

test('split oversized protected chunks without dropping parent heading or qualifier line', () => {
  const filler = '기본 안내 문장을 반복합니다. '.repeat(160);
  const file = knowledgeFile(`# 20. 방문상담

${filler}

다만, 신규수급자는 급여제공 시작일부터 토요일·공휴일 포함 14일 이내에 방문상담을 실시한다.

${filler}
`);

  const chunks = buildStructuredChunks([file]);
  const qualifierChunk = chunks.find((chunk) => chunk.text.includes('14일 이내'));

  assert.ok(chunks.length >= 2, 'expected oversized content to produce multiple chunks');
  assert.ok(qualifierChunk, 'expected one chunk to retain qualifier line');
  assert.match(qualifierChunk?.text ?? '', /^20\. 방문상담/);
});




