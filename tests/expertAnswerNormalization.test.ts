import test from 'node:test';
import assert from 'node:assert/strict';
import { synthesizeExpertAnswer } from '../src/lib/expertAnswering';
import type { AnswerPlan, StructuredChunk } from '../src/lib/ragTypes';

function makeChunk(id: string, patch: Partial<StructuredChunk> = {}): StructuredChunk {
  const text = patch.text ?? 'The manual says this evidence is directly relevant to the answer.';
  return {
    id,
    documentId: patch.documentId ?? `doc-${id}`,
    chunkIndex: patch.chunkIndex ?? 0,
    title: patch.title ?? 'Test section',
    text,
    textPreview: patch.textPreview ?? text,
    searchText: patch.searchText ?? text,
    mode: patch.mode ?? 'integrated',
    sourceType: patch.sourceType ?? 'manual',
    sourceRole: patch.sourceRole ?? 'support_reference',
    documentGroup: patch.documentGroup ?? 'manual',
    docTitle: patch.docTitle ?? 'Test manual',
    fileName: patch.fileName ?? 'test-manual.md',
    path: patch.path ?? '/knowledge/test-manual.md',
    effectiveDate: patch.effectiveDate,
    publishedDate: patch.publishedDate,
    sectionPath: patch.sectionPath ?? ['Test manual', 'Test section'],
    articleNo: patch.articleNo,
    matchedLabels: patch.matchedLabels ?? [],
    chunkHash: patch.chunkHash ?? `hash-${id}`,
    parentSectionId: patch.parentSectionId ?? `section-${id}`,
    parentSectionTitle: patch.parentSectionTitle ?? 'Test section',
    windowIndex: patch.windowIndex ?? 0,
    spanStart: patch.spanStart ?? 0,
    spanEnd: patch.spanEnd ?? text.length,
    citationGroupId: patch.citationGroupId ?? `citation-${id}`,
    linkedDocumentTitles: patch.linkedDocumentTitles ?? [],
    embedding: patch.embedding,
  };
}

const plan: AnswerPlan = {
  questionArchetype: 'definition',
  selectedRetrievalMode: 'local',
  intentSummary: 'Answer the test question.',
  workflowEvents: [],
  taskCandidates: [],
  basisBuckets: { legal: [], evaluation: [], practical: [] },
  missingDimensions: [],
  selectedEvidenceIds: ['evidence-1'],
  recommendedAnswerType: 'definition',
};

test('synthesizeExpertAnswer normalizes non-string model date fields', async () => {
  const ai = {
    models: {
      generateContent: async () => ({
        text: JSON.stringify({
          answerType: 'definition',
          headline: 'Object date response',
          summary: { text: 'Summary from nested text.' },
          directAnswer: ['Direct', 'answer'],
          confidence: 'medium',
          evidenceState: 'confirmed',
          keyIssueDate: { value: '2026-01-01' },
          referenceDate: ['2026-01-02'],
          conclusion: 123,
          groundedBasis: {
            legal: [],
            evaluation: [],
            practical: [],
          },
          practicalInterpretation: [],
          additionalChecks: [],
          appliedScope: 'All',
          scope: 'Test',
          basis: { legal: [], evaluation: [], practical: [] },
          blocks: [],
          citations: [
            {
              evidenceId: 'evidence-1',
              label: 'Test manual',
              docTitle: 'Test manual',
              sectionPath: ['Test manual'],
            },
          ],
          followUps: [],
        }),
      }),
    },
  };

  const answer = await synthesizeExpertAnswer({
    ai: ai as never,
    model: 'gemini-3-flash-preview',
    mode: 'integrated',
    variant: 'v2',
    sources: { baseline: '', base: '', overlays: { integrated: '', evaluation: '' } },
    question: 'What is the rule?',
    brain: {
      questionArchetypes: [],
      workflowEvents: [],
      actors: [],
      artifacts: [],
      timeWindows: [],
      tasks: [],
      terms: [],
    },
    plan,
    evidence: [makeChunk('evidence-1', { effectiveDate: '2026-01-03' })],
    knowledgeContext: '',
    retrievalMode: 'local',
    priorityClass: 'comparison_definition',
    evidenceState: 'confirmed',
    confidence: 'medium',
  });

  assert.equal(answer.keyIssueDate, '2026-01-01');
  assert.equal(answer.referenceDate, '2026-01-02');
  assert.equal(answer.summary, 'Summary from nested text.');
  assert.equal(answer.directAnswer, 'Direct, answer');
  assert.equal(answer.conclusion, '123');
});
