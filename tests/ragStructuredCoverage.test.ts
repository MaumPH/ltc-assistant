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

test('qa chunk policy keeps question and answer pairs together', () => {
  const file = knowledgeFile(`# 급여 Q&A

질문 1. 방문요양 급여계약은 언제 작성하나요?
답변 1. 급여계약은 서비스 시작 전에 작성하고 보호자에게 주요 내용을 설명합니다.

질문 2. 상담 기록은 언제 반영하나요?
답변 2. 상담 결과는 상담일로부터 30일 이내에 급여제공계획에 반영합니다.
`, '급여 질의응답 사례집.md');

  const chunks = buildStructuredChunks([file]);
  const firstPair = chunks.find((chunk) => chunk.text.includes('방문요양 급여계약') && chunk.text.includes('서비스 시작 전에 작성'));
  const secondPair = chunks.find((chunk) => chunk.text.includes('상담 기록') && chunk.text.includes('30일 이내'));

  assert.ok(firstPair, 'expected question 1 and answer 1 to stay in one chunk');
  assert.ok(secondPair, 'expected question 2 and answer 2 to stay in one chunk');
  assert.equal(firstPair?.sourceType, 'qa');
  assert.ok(firstPair?.matchedLabels.includes('chunk-policy:qa'));
});

test('evaluation chunk policy keeps criteria method and evidence blocks searchable', () => {
  const file = knowledgeFile(`# 평가매뉴얼

평가기준
수급자 상태 변화에 따라 급여제공계획을 정기적으로 점검한다.

확인방법
급여제공기록과 상담일지를 함께 확인한다.

관련근거
장기요양급여 제공기준 및 급여비용 산정방법 등에 관한 고시를 적용한다.
`, '2026 평가매뉴얼.md');

  const chunks = buildStructuredChunks([file]);

  assert.ok(chunks.some((chunk) => chunk.title === '평가기준' && chunk.text.includes('정기적으로 점검')));
  assert.ok(chunks.some((chunk) => chunk.title === '확인방법' && chunk.text.includes('상담일지')));
  assert.ok(chunks.some((chunk) => chunk.title === '관련근거' && chunk.text.includes('고시')));
  assert.ok(chunks.every((chunk) => chunk.matchedLabels.includes('chunk-policy:evaluation')));
});

test('law chunk policy keeps article heading with body clauses', () => {
  const file = knowledgeFile(`제1조(목적)
이 법은 장기요양급여의 기준을 정하는 것을 목적으로 한다.

제2조(정의)
① 수급자란 장기요양인정을 받은 사람을 말한다.
② 장기요양기관은 급여 제공 기록을 보관한다.
`, '노인장기요양보험법.md');

  const chunks = buildStructuredChunks([file]);
  const articleChunk = chunks.find((chunk) => chunk.articleNo === '제2조');

  assert.ok(articleChunk, 'expected article 2 chunk');
  assert.match(articleChunk?.text ?? '', /^제2조\(정의\)/);
  assert.ok(articleChunk?.text.includes('① 수급자란'));
  assert.ok(articleChunk?.matchedLabels.includes('chunk-policy:law'));
});




