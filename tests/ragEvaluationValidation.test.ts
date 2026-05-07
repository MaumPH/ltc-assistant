import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateRetrievalValidation } from '../src/lib/ragSemanticValidation';
import type { SemanticFrame, StructuredChunk } from '../src/lib/ragTypes';

function makeChunk(id: string, patch: Partial<StructuredChunk>): StructuredChunk {
  return {
    id,
    documentId: patch.documentId ?? `doc-${id}`,
    chunkIndex: patch.chunkIndex ?? 0,
    title: patch.title ?? patch.docTitle ?? 'Test document',
    text: patch.text ?? patch.searchText ?? '',
    textPreview: patch.textPreview ?? (patch.text ?? patch.searchText ?? '').slice(0, 120),
    searchText: patch.searchText ?? patch.text ?? '',
    mode: patch.mode ?? 'evaluation',
    sourceType: patch.sourceType ?? 'evaluation',
    sourceRole: patch.sourceRole ?? 'primary_evaluation',
    documentGroup: patch.documentGroup ?? 'evaluation',
    docTitle: patch.docTitle ?? 'Test evaluation manual',
    fileName: patch.fileName ?? `${patch.docTitle ?? 'Test evaluation manual'}.md`,
    path: patch.path ?? `/knowledge/evaluation/${patch.fileName ?? `${patch.docTitle ?? 'Test evaluation manual'}.md`}`,
    effectiveDate: patch.effectiveDate,
    publishedDate: patch.publishedDate,
    sectionPath: patch.sectionPath ?? [patch.docTitle ?? 'Test evaluation manual'],
    articleNo: patch.articleNo,
    matchedLabels: patch.matchedLabels ?? [],
    chunkHash: patch.chunkHash ?? `hash-${id}`,
    parentSectionId: patch.parentSectionId ?? `section-${id}`,
    parentSectionTitle: patch.parentSectionTitle ?? patch.title ?? patch.docTitle ?? 'Test evaluation section',
    windowIndex: patch.windowIndex ?? 0,
    spanStart: patch.spanStart ?? 0,
    spanEnd: patch.spanEnd ?? (patch.text ?? patch.searchText ?? '').length,
    citationGroupId: patch.citationGroupId ?? `citation-${id}`,
    linkedDocumentTitles: patch.linkedDocumentTitles ?? [],
    embedding: patch.embedding,
  };
}

test('evaluation compliance evidence from primary evaluation docs is authoritative without legal basis', () => {
  const semanticFrame: SemanticFrame = {
    primaryIntent: 'compliance',
    secondaryIntents: [],
    canonicalTerms: ['evaluation notice period', 'staff rights education'],
    entityRefs: [],
    relationRequests: [
      {
        relation: 'requires',
        target: 'evaluation notice period',
        reason: 'evaluation manual requirement',
        confidence: 1,
      },
    ],
    slots: {},
    assumptions: [],
    missingCriticalSlots: ['institution_type'],
    riskLevel: 'medium',
  };
  const evidence = [
    makeChunk('evaluation-notice', {
      docTitle: '2026 evaluation manual',
      parentSectionTitle: 'Information notice',
      searchText: 'evaluation notice period requirement manual evidence',
      text: 'The evaluation manual specifies the notice period requirement.',
    }),
    makeChunk('evaluation-rights', {
      docTitle: '2026 evaluation manual',
      parentSectionTitle: 'Staff rights education',
      searchText: 'staff rights education required evaluation manual evidence',
      text: 'The evaluation manual specifies staff rights education evidence.',
    }),
  ];

  const summary = evaluateRetrievalValidation({
    semanticFrame,
    evidence,
  });

  assert.equal(summary.validationIssues.some((issue) => issue.severity === 'block'), false);
  assert.equal(summary.validationIssues.some((issue) => issue.code === 'basis-confusion'), false);
});
