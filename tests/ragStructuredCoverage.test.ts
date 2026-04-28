import assert from 'node:assert/strict';
import test from 'node:test';
import { buildRagCorpusIndex, searchCorpus } from '../src/lib/ragEngine';
import { buildStructuredChunks } from '../src/lib/ragStructured';
import type { KnowledgeFile } from '../src/lib/ragTypes';

function knowledgeFile(content: string, name = '신규수급자-업무.md'): KnowledgeFile {
  return {
    path: `/knowledge/manual/${name}`,
    name,
    size: content.length,
    content,
    updatedAt: '2026-04-28T00:00:00.000Z',
  };
}

test('heading-aware chunking keeps checklist and deadline evidence together', () => {
  const file = knowledgeFile(`# 신규수급자 업무

신규수급자가 왔을때 초기 업무는 상담, 욕구사정, 급여제공계획 수립, 계약 체결을 확인한다.
모든 수급자(보호자)에게 8가지 지침에 대해 연 1회 이상 설명한다.
1. 욕창예방
2. 낙상예방
3. 탈수예방
4. 배변도움
5. 관절구축예방
6. 치매예방
7. 감염예방
8. 노인인권보호
신규수급자는 급여제공 시작일부터 토요일·공휴일 포함 14일 이내에 실시하였는지 확인함.
`);

  const chunks = buildStructuredChunks([file]);
  const checklistChunk = chunks.find((chunk) => chunk.text.includes('8가지') && chunk.text.includes('14일 이내'));

  assert.ok(checklistChunk, 'expected one chunk to keep 8가지 지침 and 14일 기한 together');
  assert.equal(checklistChunk?.containsCheckList, true);
  assert.ok(checklistChunk?.listGroupId);
  assert.deepEqual(checklistChunk?.headingPath, ['신규수급자-업무', '신규수급자 업무']);
  assert.match(checklistChunk?.embeddingInput ?? '', /\[문서: 신규수급자-업무\]/);
  assert.match(checklistChunk?.embeddingInput ?? '', /\[섹션: 신규수급자 업무\]/);
});

test('procedure retrieval includes protected checklist chunk as evidence', () => {
  const target = knowledgeFile(`# 신규수급자 업무

신규수급자가 왔을때 초기 업무는 상담, 욕구사정, 급여제공계획 수립, 계약 체결을 확인한다.
모든 수급자(보호자)에게 8가지 지침에 대해 연 1회 이상 설명한다.
1. 욕창예방
2. 낙상예방
3. 탈수예방
4. 배변도움
5. 관절구축예방
6. 치매예방
7. 감염예방
8. 노인인권보호
신규수급자는 급여제공 시작일부터 토요일·공휴일 포함 14일 이내에 실시하였는지 확인함.
`);
  const distractors = Array.from({ length: 10 }, (_, index) =>
    knowledgeFile(`# 일반 업무 ${index}

기관 운영 기록과 일반 점검 사항을 정리한다. 신규 업무라는 단어만 포함된 무관 문서이다.
`, `일반업무-${index}.md`),
  );

  const chunks = buildStructuredChunks([target, ...distractors]);
  const result = searchCorpus({
    index: buildRagCorpusIndex(chunks),
    query: '신규수급자가 왔을때 해야하는 업무는?',
    mode: 'integrated',
  });
  const evidenceText = result.evidence.map((chunk) => chunk.text).join('\n');

  assert.match(evidenceText, /8가지/);
  assert.match(evidenceText, /노인인권보호/);
  assert.match(evidenceText, /14일 이내/);
});
