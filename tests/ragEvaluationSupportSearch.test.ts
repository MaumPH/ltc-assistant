import test from 'node:test';
import assert from 'node:assert/strict';
import { selectIntegratedSupportReferenceScope, shouldSearchIntegratedSupportReferences } from '../src/lib/nodeRagService';
import type { SemanticFrame, StructuredChunk } from '../src/lib/ragTypes';

function semanticFrame(primaryIntent: SemanticFrame['primaryIntent']): SemanticFrame {
  return {
    primaryIntent,
    secondaryIntents: [],
    canonicalTerms: [],
    entityRefs: [],
    relationRequests: [],
    slots: {},
    assumptions: [],
    missingCriticalSlots: [],
    riskLevel: 'medium',
  };
}

function chunk(overrides: Partial<StructuredChunk> & { id: string; documentId: string; docTitle: string; text: string }): StructuredChunk {
  return {
    id: overrides.id,
    documentId: overrides.documentId,
    chunkIndex: overrides.chunkIndex ?? 0,
    title: overrides.title ?? overrides.docTitle,
    text: overrides.text,
    textPreview: overrides.text.slice(0, 120),
    searchText: overrides.searchText ?? overrides.text,
    mode: overrides.mode ?? 'integrated',
    sourceType: overrides.sourceType ?? 'guide',
    sourceRole: overrides.sourceRole ?? 'support_reference',
    documentGroup: overrides.documentGroup ?? 'guide',
    docTitle: overrides.docTitle,
    fileName: overrides.fileName ?? `${overrides.docTitle}.md`,
    path: overrides.path ?? `/knowledge/${overrides.docTitle}.md`,
    effectiveDate: overrides.effectiveDate,
    publishedDate: overrides.publishedDate,
    sectionPath: overrides.sectionPath ?? [overrides.docTitle],
    headingPath: overrides.headingPath ?? [overrides.docTitle],
    articleNo: overrides.articleNo,
    matchedLabels: overrides.matchedLabels ?? [],
    chunkHash: overrides.chunkHash ?? `hash-${overrides.id}`,
    parentSectionId: overrides.parentSectionId ?? `section-${overrides.id}`,
    parentSectionTitle: overrides.parentSectionTitle ?? overrides.docTitle,
    listGroupId: overrides.listGroupId,
    containsCheckList: overrides.containsCheckList ?? false,
    embeddingInput: overrides.embeddingInput,
    windowIndex: overrides.windowIndex ?? 0,
    spanStart: overrides.spanStart ?? 0,
    spanEnd: overrides.spanEnd ?? overrides.text.length,
    citationGroupId: overrides.citationGroupId ?? `${overrides.documentId}:section-${overrides.id}`,
    linkedDocumentTitles: overrides.linkedDocumentTitles ?? [],
    embedding: overrides.embedding,
  };
}

test('evaluation compliance questions skip broad integrated support reference search', () => {
  assert.equal(
    shouldSearchIntegratedSupportReferences({
      mode: 'evaluation',
      normalizedQuery: '주야간보호 평가에서 평가예정통보는 언제까지 안내해야 하나요?',
      semanticFrame: semanticFrame('compliance'),
    }),
    false,
  );
});

test('evaluation document lookup questions still search integrated support references', () => {
  assert.equal(
    shouldSearchIntegratedSupportReferences({
      mode: 'evaluation',
      normalizedQuery: '기능회복훈련 운영 참고 문서는 어떤 게 있나요?',
      semanticFrame: semanticFrame('compliance'),
    }),
    true,
  );
});

test('non-compliance evaluation questions keep integrated support reference search', () => {
  assert.equal(
    shouldSearchIntegratedSupportReferences({
      mode: 'evaluation',
      normalizedQuery: '기피식품과 식품선호도 조사를 설명해줘',
      semanticFrame: semanticFrame('definition'),
    }),
    true,
  );
});

test('direct support reference scope keeps focused support documents without searching every support reference', () => {
  const focused = chunk({
    id: 'food-preference-guide',
    documentId: 'food-preference-guide-doc',
    docTitle: 'Food Preference Guide',
    text: 'Food preference disliked foods nutrition assessment and meal planning reference.',
  });
  const distractors = Array.from({ length: 16 }, (_, index) =>
    chunk({
      id: `generic-reference-${index}`,
      documentId: `generic-reference-doc-${index}`,
      docTitle: `Generic Reference ${index}`,
      text: 'Reference document manual guide for general operations.',
    }),
  );

  const scoped = selectIntegratedSupportReferenceScope({
    chunks: [focused, ...distractors],
    query: 'Which reference document covers disliked foods and food preference assessment?',
    aliases: ['nutrition assessment'],
  });

  assert.ok(scoped.has('food-preference-guide-doc'));
  assert.ok(scoped.size < 8, `expected narrow direct support scope, got ${scoped.size}`);
});
