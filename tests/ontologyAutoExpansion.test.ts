import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  buildGeneratedOntologyManifest,
  buildOntologyGraph,
  expandDocumentsWithOntology,
  loadGeneratedOntologyManifest,
  writeGeneratedOntologyManifest,
} from '../src/lib/ragOntology';
import type { DomainBrain } from '../src/lib/brain';
import type { NaturalLanguageQueryProfile, StructuredChunk } from '../src/lib/ragTypes';

const emptyBrain: DomainBrain = {
  questionArchetypes: [],
  workflowEvents: [],
  actors: [],
  artifacts: [],
  timeWindows: [],
  tasks: [],
  terms: [],
};

function chunk(overrides: Partial<StructuredChunk>): StructuredChunk {
  return {
    id: 'chunk-staffing-1',
    documentId: 'doc-staffing',
    chunkIndex: 0,
    title: '준비 서류',
    text: [
      '## 준비 서류',
      '- 인력신고 현황 자료',
      '- 직원 근로계약서 또는 채용자료',
      '- 추가배치 가산 적용 자료 및 청구내역',
    ].join('\n'),
    textPreview: '인력신고 현황 자료',
    searchText: '3. 인력기준 준비 서류 인력신고 현황 자료 직원 근로계약서 추가배치 가산',
    mode: 'evaluation',
    sourceType: 'wiki',
    sourceRole: 'primary_evaluation',
    documentGroup: 'evaluation',
    docTitle: '3. 인력기준',
    fileName: '01-03-인력기준.md',
    path: '/knowledge/evaluation/01-03-인력기준.md',
    sectionPath: ['3. 인력기준', '준비 서류'],
    matchedLabels: [],
    chunkHash: 'hash-staffing-1',
    parentSectionId: 'section-staffing-docs',
    parentSectionTitle: '준비 서류',
    windowIndex: 0,
    spanStart: 0,
    spanEnd: 100,
    citationGroupId: 'doc-staffing:0',
    linkedDocumentTitles: [],
    ...overrides,
  };
}

function profile(query: string): NaturalLanguageQueryProfile {
  return {
    originalQuery: query,
    normalizedQuery: query,
    queryType: 'application',
    aliasResolutions: [],
    parsedLawRefs: [],
    synonymExpansions: [],
    searchVariants: [query],
    normalizationTrace: [],
  };
}

test('ontology graph extracts document concept candidates without brain synonyms', () => {
  const graph = buildOntologyGraph(emptyBrain, [chunk({})]);

  assert.ok(
    graph.entities.some(
      (entity) =>
        entity.entityType === 'concept' &&
        entity.label === '인력신고 현황 자료' &&
        entity.metadata?.status === 'candidate' &&
        entity.metadata?.source === 'document-text',
    ),
  );
});

test('ontology token overlap links conversational status wording to generated document concepts', () => {
  const graph = buildOntologyGraph(emptyBrain, [chunk({})]);
  const result = expandDocumentsWithOntology(graph, profile('인력현황 알려줘'), [], 1);

  assert.ok(
    result.hits.some((hit) => hit.label === '인력신고 현황 자료' && hit.matchedAlias === '인력신고 현황 자료'),
    `expected generated concept hit, got ${result.hits.map((hit) => `${hit.label}:${hit.matchedAlias}`).join(', ')}`,
  );
  assert.ok(result.documentScoreBoosts.has('doc-staffing'));
  assert.ok(
    result.trace[0]?.boostedDocumentPaths.includes('/knowledge/evaluation/01-03-인력기준.md'),
    `expected staffing document boost, got ${result.trace[0]?.boostedDocumentPaths.join(', ')}`,
  );
});

test('promoted generated ontology aliases are merged into graph lookup', () => {
  const graph = buildOntologyGraph(emptyBrain, [chunk({})], {
    schema_version: 1,
    concepts: [
      {
        label: '인력기준',
        status: 'promoted',
        confidence: 0.96,
        aliases: ['인력현황'],
        related_terms: ['인력배치기준', '직원배치기준'],
        evidence: [{ documentId: 'doc-staffing', path: '/knowledge/evaluation/01-03-인력기준.md' }],
      },
    ],
  });

  const result = expandDocumentsWithOntology(graph, profile('인력현황 알려줘'), [], 1);

  assert.ok(
    result.hits.some((hit) => hit.label === '인력기준' && hit.matchedAlias === '인력현황'),
    `expected promoted alias hit, got ${result.hits.map((hit) => `${hit.label}:${hit.matchedAlias}`).join(', ')}`,
  );
  assert.equal(graph.entityById.get('concept:인력기준')?.metadata?.status, 'promoted');
  assert.ok(result.documentScoreBoosts.has('doc-staffing'));
});

test('rejected generated ontology concepts are not merged into graph lookup', () => {
  const graph = buildOntologyGraph(emptyBrain, [], {
    schema_version: 1,
    concepts: [
      {
        label: '급여제공계획',
        status: 'rejected',
        confidence: 0.91,
        aliases: ['케어플랜'],
      },
    ],
  });

  assert.equal(graph.entityById.has('concept:급여제공계획'), false);
  assert.equal(expandDocumentsWithOntology(graph, profile('케어플랜'), [], 1).hits.length, 0);
});

test('generated ontology manifest loader reads optional generated store safely', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ontology-generated-'));

  assert.deepEqual(loadGeneratedOntologyManifest(tempRoot), { schema_version: 1, concepts: [] });

  const ontologyRoot = path.join(tempRoot, 'knowledge', 'ontology');
  fs.mkdirSync(ontologyRoot, { recursive: true });
  fs.writeFileSync(
    path.join(ontologyRoot, 'generated.json'),
    JSON.stringify({
      schema_version: 1,
      concepts: [{ label: '인력기준', status: 'validated', aliases: ['인력현황'] }],
    }),
    'utf8',
  );

  const manifest = loadGeneratedOntologyManifest(tempRoot);

  assert.equal(manifest.concepts.length, 1);
  assert.equal(manifest.concepts[0]?.label, '인력기준');
  assert.equal(manifest.concepts[0]?.status, 'validated');
});

test('generated ontology builder preserves reviewed statuses and appends new candidates', () => {
  const manifest = buildGeneratedOntologyManifest([chunk({})], {
    schema_version: 1,
    concepts: [
      { label: '인력기준', status: 'promoted', confidence: 0.96, aliases: ['인력현황'] },
      { label: '급여제공계획', status: 'rejected', confidence: 0.8, aliases: ['케어플랜'] },
    ],
  });

  const promoted = manifest.concepts.find((concept) => concept.label === '인력기준');
  const rejected = manifest.concepts.find((concept) => concept.label === '급여제공계획');
  const candidate = manifest.concepts.find((concept) => concept.label === '인력신고 현황 자료');

  assert.equal(promoted?.status, 'promoted');
  assert.deepEqual(promoted?.aliases, ['인력현황']);
  assert.equal(rejected?.status, 'rejected');
  assert.equal(candidate?.status, 'candidate');
  assert.equal(candidate?.evidence?.[0]?.documentId, 'doc-staffing');
});

test('generated ontology writer persists manifest in the expected store path', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ontology-write-'));
  const manifest = buildGeneratedOntologyManifest([chunk({})]);

  writeGeneratedOntologyManifest(tempRoot, manifest);

  const writtenPath = path.join(tempRoot, 'knowledge', 'ontology', 'generated.json');
  assert.equal(fs.existsSync(writtenPath), true);
  assert.equal(loadGeneratedOntologyManifest(tempRoot).concepts.length, manifest.concepts.length);
});
