import fs from 'fs';
import path from 'path';
import type {
  GraphExpansionTrace,
  NaturalLanguageQueryProfile,
  OntologyAlias,
  OntologyEdge,
  OntologyEntity,
  OntologyHit,
  StructuredChunk,
} from './ragTypes';
import type { DomainBrain } from './brain';
import { compactQueryText } from './ragNaturalQuery';
import { normalizeDocumentTitle, sha1, tokenize } from './ragMetadata';

interface AliasMatch {
  entityId: string;
  alias: string;
  weight: number;
}

interface GeneratedConceptCandidate {
  label: string;
  source: 'document-title' | 'section-title' | 'document-text';
  confidence: number;
}

export type GeneratedOntologyStatus = 'candidate' | 'validated' | 'promoted' | 'rejected';

export interface GeneratedOntologyEvidence {
  documentId?: string;
  path?: string;
  label?: string;
  reason?: string;
}

export interface GeneratedOntologyConcept {
  label: string;
  status?: GeneratedOntologyStatus;
  confidence?: number;
  aliases?: string[];
  related_terms?: string[];
  source?: string;
  evidence?: GeneratedOntologyEvidence[];
}

export interface GeneratedOntologyManifest {
  schema_version: number;
  concepts: GeneratedOntologyConcept[];
}

export interface OntologyGraph {
  entities: OntologyEntity[];
  aliases: OntologyAlias[];
  edges: OntologyEdge[];
  entityById: Map<string, OntologyEntity>;
  aliasIndex: Map<string, AliasMatch[]>;
  adjacency: Map<string, OntologyEdge[]>;
  documentIdsByEntityId: Map<string, Set<string>>;
  documentPathsById: Map<string, string>;
  documentEntityIdByDocumentId: Map<string, string>;
}

export interface OntologySearchResult {
  documentScoreBoosts: Map<string, number>;
  hits: OntologyHit[];
  trace: GraphExpansionTrace[];
}

function uniqueStrings(values: Iterable<string>): string[] {
  return Array.from(new Set(Array.from(values).map((value) => value.trim()).filter(Boolean)));
}

function upsertSet(map: Map<string, Set<string>>, key: string, value: string): void {
  const set = map.get(key) ?? new Set<string>();
  set.add(value);
  map.set(key, set);
}

const CONCEPT_CANDIDATE_SUFFIXES = [
  '기준',
  '현황',
  '절차',
  '방법',
  '가산',
  '서류',
  '계획',
  '교육',
  '보호',
  '관리',
  '기록',
  '계약서',
  '신고',
  '내역',
  '자료',
  '지표',
  '매뉴얼',
  '처분',
  '규칙',
  '고시',
];

const ONTOLOGY_QUERY_STOP_TOKENS = new Set([
  '알려줘',
  '알려주세요',
  '설명해줘',
  '설명해주세요',
  '찾아줘',
  '찾아주세요',
  '이게',
  '이거',
  '뭐야',
  '뭐예요',
  '뭐',
  '뭘',
  '무엇',
  '어떻게',
  '어떡해',
]);

const LOW_SIGNAL_CONCEPT_LABELS = new Set([
  '판단 기준',
  '충족 기준',
  '미충족 기준',
  '확인 방법',
  '확정 근거',
  '관련 근거',
  '실무 해석',
  '주의사항',
  '관련 지표',
]);

const EMPTY_GENERATED_ONTOLOGY: GeneratedOntologyManifest = {
  schema_version: 1,
  concepts: [],
};

function safeGeneratedOntologyConcepts(value: unknown): GeneratedOntologyConcept[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .map((item) => ({
      label: typeof item.label === 'string' ? item.label : '',
      status: normalizeGeneratedStatusValue(item.status),
      confidence: typeof item.confidence === 'number' ? item.confidence : undefined,
      aliases: Array.isArray(item.aliases) ? item.aliases.filter((alias): alias is string => typeof alias === 'string') : [],
      related_terms: Array.isArray(item.related_terms)
        ? item.related_terms.filter((term): term is string => typeof term === 'string')
        : [],
      source: typeof item.source === 'string' ? item.source : undefined,
      evidence: Array.isArray(item.evidence)
        ? item.evidence
            .filter((evidence): evidence is Record<string, unknown> => Boolean(evidence) && typeof evidence === 'object')
            .map((evidence) => ({
              documentId: typeof evidence.documentId === 'string' ? evidence.documentId : undefined,
              path: typeof evidence.path === 'string' ? evidence.path : undefined,
              label: typeof evidence.label === 'string' ? evidence.label : undefined,
              reason: typeof evidence.reason === 'string' ? evidence.reason : undefined,
            }))
        : [],
    }))
    .filter((item) => item.label.trim().length > 0);
}

function normalizeGeneratedStatusValue(value: unknown): GeneratedOntologyStatus {
  return value === 'candidate' || value === 'validated' || value === 'promoted' || value === 'rejected'
    ? value
    : 'candidate';
}

export function loadGeneratedOntologyManifest(projectRoot: string): GeneratedOntologyManifest {
  const manifestPath = path.join(projectRoot, 'knowledge', 'ontology', 'generated.json');
  if (!fs.existsSync(manifestPath)) {
    return { ...EMPTY_GENERATED_ONTOLOGY, concepts: [] };
  }

  const parsed = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as Record<string, unknown>;
  return {
    schema_version: typeof parsed.schema_version === 'number' ? parsed.schema_version : 1,
    concepts: safeGeneratedOntologyConcepts(parsed.concepts),
  };
}

function stripFileExtension(value: string): string {
  return value.replace(/\.(?:md|txt|json)$/iu, '');
}

function cleanConceptCandidate(raw: string): string {
  return stripFileExtension(raw)
    .normalize('NFC')
    .replace(/`([^`]+)`/gu, '$1')
    .replace(/\*\*/gu, '')
    .replace(/<br\s*\/?>/giu, ' ')
    .replace(/^\s*[-*+]\s+/u, '')
    .replace(/^\s*#+\s*/u, '')
    .replace(/^\s*\|/u, '')
    .replace(/\|\s*$/u, '')
    .replace(/^\s*(?:\(?붙임\)?\s*)?\d+(?:[-.)_]\d+)*[-.)_\s]*/u, '')
    .replace(/^\s*(?:제\s*)?\d+\s*[조항호]\s*/u, '')
    .replace(/\s+/gu, ' ')
    .replace(/^[\s:|]+|[\s:|.,;]+$/gu, '')
    .trim();
}

function hasMeaningfulConceptShape(label: string): boolean {
  if (label.length < 2 || label.length > 42) return false;
  if (!/[가-힣]/u.test(label)) return false;
  if (LOW_SIGNAL_CONCEPT_LABELS.has(label)) return false;

  const compact = compactQueryText(label);
  return CONCEPT_CANDIDATE_SUFFIXES.some((suffix) => compact.includes(compactQueryText(suffix)));
}

function addConceptCandidate(
  candidates: Map<string, GeneratedConceptCandidate>,
  raw: string,
  source: GeneratedConceptCandidate['source'],
  confidence: number,
): void {
  const label = cleanConceptCandidate(raw);
  if (!hasMeaningfulConceptShape(label)) return;

  const key = compactQueryText(label);
  const current = candidates.get(key);
  if (!current || current.confidence < confidence) {
    candidates.set(key, { label, source, confidence });
  }
}

function extractDocumentConceptCandidates(
  representative: StructuredChunk,
  chunks: StructuredChunk[],
): GeneratedConceptCandidate[] {
  const candidates = new Map<string, GeneratedConceptCandidate>();

  addConceptCandidate(candidates, representative.docTitle, 'document-title', 0.82);
  addConceptCandidate(candidates, representative.fileName, 'document-title', 0.78);

  for (const chunk of chunks.slice(0, 12)) {
    addConceptCandidate(candidates, chunk.parentSectionTitle, 'section-title', 0.72);
    addConceptCandidate(candidates, chunk.title, 'section-title', 0.7);

    for (const line of chunk.text.split(/\r?\n/u)) {
      if (!/^\s*[-*+]\s+/u.test(line)) continue;
      addConceptCandidate(candidates, line, 'document-text', 0.74);
    }
  }

  return Array.from(candidates.values()).slice(0, 24);
}

function significantOntologyTokens(value: string): string[] {
  return uniqueStrings(
    tokenize(value).filter(
      (token) =>
        token.length >= 2 &&
        !ONTOLOGY_QUERY_STOP_TOKENS.has(token) &&
        !/^\d+$/u.test(token),
    ),
  );
}

function scoreAliasTokenOverlap(queryTokens: string[], alias: string): number {
  if (queryTokens.length === 0) return 0;

  const aliasTokens = significantOntologyTokens(alias);
  if (aliasTokens.length === 0) return 0;

  const queryTokenSet = new Set(queryTokens);
  const overlap = aliasTokens.filter((token) => queryTokenSet.has(token)).length;
  if (overlap < 2) return 0;

  const coverage = overlap / Math.min(queryTokens.length, aliasTokens.length);
  if (coverage < 0.45) return 0;

  return 4 + overlap * 2 + coverage * 4;
}

function createGraph(): OntologyGraph {
  return {
    entities: [],
    aliases: [],
    edges: [],
    entityById: new Map<string, OntologyEntity>(),
    aliasIndex: new Map<string, AliasMatch[]>(),
    adjacency: new Map<string, OntologyEdge[]>(),
    documentIdsByEntityId: new Map<string, Set<string>>(),
    documentPathsById: new Map<string, string>(),
    documentEntityIdByDocumentId: new Map<string, string>(),
  };
}

function addEntity(graph: OntologyGraph, entityType: string, label: string, metadata?: Record<string, unknown>): string {
  const id = `${entityType}:${compactQueryText(label) || sha1(label)}`;
  if (!graph.entityById.has(id)) {
    const entity: OntologyEntity = { id, entityType, label, metadata };
    graph.entities.push(entity);
    graph.entityById.set(id, entity);
  } else if (metadata) {
    const entity = graph.entityById.get(id);
    if (entity) {
      entity.metadata = { ...(entity.metadata ?? {}), ...metadata };
    }
  }
  return id;
}

function addAlias(
  graph: OntologyGraph,
  entityId: string,
  alias: string,
  aliasType: string,
  weight = 1,
): void {
  const normalized = compactQueryText(alias);
  if (!normalized) return;
  const id = sha1(`${entityId}:${aliasType}:${normalized}`);
  if (graph.aliases.some((entry) => entry.id === id)) return;

  const record: OntologyAlias = {
    id,
    entityId,
    alias,
    aliasType,
    weight,
  };
  graph.aliases.push(record);

  const index = graph.aliasIndex.get(normalized) ?? [];
  index.push({ entityId, alias, weight });
  graph.aliasIndex.set(normalized, index);
}

function addEdge(
  graph: OntologyGraph,
  fromEntityId: string,
  toEntityId: string,
  relation: string,
  weight = 1,
  metadata?: Record<string, unknown>,
): void {
  const id = sha1(`${fromEntityId}:${relation}:${toEntityId}`);
  if (graph.edges.some((entry) => entry.id === id)) return;

  const edge: OntologyEdge = {
    id,
    fromEntityId,
    toEntityId,
    relation,
    weight,
    metadata,
  };
  graph.edges.push(edge);

  const forward = graph.adjacency.get(fromEntityId) ?? [];
  forward.push(edge);
  graph.adjacency.set(fromEntityId, forward);

  const reverse = graph.adjacency.get(toEntityId) ?? [];
  reverse.push(edge);
  graph.adjacency.set(toEntityId, reverse);
}

function bindDocument(graph: OntologyGraph, entityId: string, documentId: string, path: string): void {
  upsertSet(graph.documentIdsByEntityId, entityId, documentId);
  graph.documentPathsById.set(documentId, path);
}

function normalizeGeneratedStatus(status: GeneratedOntologyConcept['status']): GeneratedOntologyStatus {
  return status ?? 'candidate';
}

function uniqueEvidence(values: GeneratedOntologyEvidence[]): GeneratedOntologyEvidence[] {
  const seen = new Set<string>();
  const results: GeneratedOntologyEvidence[] = [];

  for (const value of values) {
    const key = [value.documentId ?? '', value.path ?? '', value.label ?? '', value.reason ?? ''].join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    results.push(value);
  }

  return results;
}

function normalizeGeneratedConcept(concept: GeneratedOntologyConcept): GeneratedOntologyConcept | null {
  const label = cleanConceptCandidate(concept.label);
  if (!label) return null;

  return {
    label,
    status: normalizeGeneratedStatus(concept.status),
    confidence:
      typeof concept.confidence === 'number'
        ? Math.max(0, Math.min(1, Number(concept.confidence.toFixed(3))))
        : undefined,
    aliases: uniqueStrings(concept.aliases ?? []),
    related_terms: uniqueStrings(concept.related_terms ?? []),
    source: concept.source,
    evidence: uniqueEvidence(concept.evidence ?? []),
  };
}

function mergeGeneratedConcepts(
  current: GeneratedOntologyConcept | undefined,
  next: GeneratedOntologyConcept,
): GeneratedOntologyConcept {
  if (!current) return next;

  const currentStatus = normalizeGeneratedStatus(current.status);
  const nextStatus = normalizeGeneratedStatus(next.status);
  const status: GeneratedOntologyStatus =
    currentStatus === 'promoted' || currentStatus === 'validated' || currentStatus === 'rejected'
      ? currentStatus
      : nextStatus;

  return {
    label: current.label || next.label,
    status,
    confidence: Math.max(current.confidence ?? 0, next.confidence ?? 0) || undefined,
    aliases: uniqueStrings([...(current.aliases ?? []), ...(next.aliases ?? [])]),
    related_terms: uniqueStrings([...(current.related_terms ?? []), ...(next.related_terms ?? [])]),
    source: current.source ?? next.source,
    evidence: uniqueEvidence([...(current.evidence ?? []), ...(next.evidence ?? [])]),
  };
}

export function buildGeneratedOntologyManifest(
  chunks: StructuredChunk[],
  existing: GeneratedOntologyManifest = EMPTY_GENERATED_ONTOLOGY,
): GeneratedOntologyManifest {
  const conceptsByKey = new Map<string, GeneratedOntologyConcept>();

  for (const concept of existing.concepts) {
    const normalized = normalizeGeneratedConcept(concept);
    if (!normalized) continue;
    conceptsByKey.set(compactQueryText(normalized.label), normalized);
  }

  const representatives = documentRepresentatives(chunks);
  const chunksByDocumentId = new Map<string, StructuredChunk[]>();
  for (const chunk of chunks) {
    const list = chunksByDocumentId.get(chunk.documentId) ?? [];
    list.push(chunk);
    chunksByDocumentId.set(chunk.documentId, list);
  }

  for (const representative of representatives.values()) {
    for (const candidate of extractDocumentConceptCandidates(
      representative,
      chunksByDocumentId.get(representative.documentId) ?? [],
    )) {
      const normalized = normalizeGeneratedConcept({
        label: candidate.label,
        status: 'candidate',
        confidence: candidate.confidence,
        source: candidate.source,
        evidence: [
          {
            documentId: representative.documentId,
            path: representative.path,
            label: representative.docTitle,
            reason: candidate.source,
          },
        ],
      });
      if (!normalized) continue;

      const key = compactQueryText(normalized.label);
      conceptsByKey.set(key, mergeGeneratedConcepts(conceptsByKey.get(key), normalized));
    }
  }

  return {
    schema_version: existing.schema_version || 1,
    concepts: Array.from(conceptsByKey.values()).sort((left, right) => left.label.localeCompare(right.label, 'ko')),
  };
}

export function writeGeneratedOntologyManifest(projectRoot: string, manifest: GeneratedOntologyManifest): string {
  const ontologyRoot = path.join(projectRoot, 'knowledge', 'ontology');
  const manifestPath = path.join(ontologyRoot, 'generated.json');
  fs.mkdirSync(ontologyRoot, { recursive: true });
  fs.writeFileSync(manifestPath, `${JSON.stringify(buildGeneratedOntologyManifest([], manifest), null, 2)}\n`, 'utf8');
  return manifestPath;
}

function resolveEvidenceDocuments(graph: OntologyGraph, evidence: GeneratedOntologyEvidence[] = []): Array<{ documentId: string; path: string }> {
  const documents: Array<{ documentId: string; path: string }> = [];

  for (const item of evidence) {
    if (item.documentId) {
      documents.push({
        documentId: item.documentId,
        path: item.path ?? graph.documentPathsById.get(item.documentId) ?? item.documentId,
      });
      continue;
    }

    if (!item.path) continue;
    const normalizedPath = item.path.replace(/\\/gu, '/');
    const match = Array.from(graph.documentPathsById.entries()).find(
      ([, documentPath]) => documentPath.replace(/\\/gu, '/') === normalizedPath,
    );
    if (match) {
      documents.push({ documentId: match[0], path: match[1] });
    }
  }

  return documents;
}

function documentRepresentatives(chunks: StructuredChunk[]): Map<string, StructuredChunk> {
  const representatives = new Map<string, StructuredChunk>();
  for (const chunk of chunks) {
    if (!representatives.has(chunk.documentId)) {
      representatives.set(chunk.documentId, chunk);
    }
  }
  return representatives;
}

function attachBrainEntities(graph: OntologyGraph, brain: DomainBrain): void {
  const workflowIds = new Map<string, string>();
  const actorIds = new Map<string, string>();
  const artifactIds = new Map<string, string>();
  const timeWindowIds = new Map<string, string>();
  const taskIds = new Map<string, string>();

  for (const workflow of brain.workflowEvents) {
    const entityId = addEntity(graph, 'workflow', workflow.label, { workflowId: workflow.id });
    workflowIds.set(workflow.id, entityId);
    addAlias(graph, entityId, workflow.label, 'label', 1.4);
    for (const synonym of workflow.synonyms) addAlias(graph, entityId, synonym, 'synonym', 1.1);
  }

  for (const actor of brain.actors) {
    const entityId = addEntity(graph, 'actor', actor.label, { actorId: actor.id });
    actorIds.set(actor.id, entityId);
    addAlias(graph, entityId, actor.label, 'label', 1.2);
    for (const synonym of actor.synonyms ?? []) addAlias(graph, entityId, synonym, 'synonym', 1);
  }

  for (const artifact of brain.artifacts) {
    const entityId = addEntity(graph, 'artifact', artifact.label, { artifactId: artifact.id });
    artifactIds.set(artifact.id, entityId);
    addAlias(graph, entityId, artifact.label, 'label', 1.2);
    for (const synonym of artifact.synonyms ?? []) addAlias(graph, entityId, synonym, 'synonym', 1);
  }

  for (const timeWindow of brain.timeWindows) {
    const entityId = addEntity(graph, 'time-window', timeWindow.label, { timeWindowId: timeWindow.id });
    timeWindowIds.set(timeWindow.id, entityId);
    addAlias(graph, entityId, timeWindow.label, 'label', 1.1);
    for (const synonym of timeWindow.synonyms ?? []) addAlias(graph, entityId, synonym, 'synonym', 0.9);
  }

  for (const term of brain.terms) {
    const entityId = addEntity(graph, 'term', term.term, { kind: 'brain-term' });
    addAlias(graph, entityId, term.term, 'label', 1.3);
    for (const synonym of term.synonyms) addAlias(graph, entityId, synonym, 'synonym', 1.1);
    for (const related of term.related_terms ?? []) {
      const relatedId = addEntity(graph, 'term', related, { kind: 'brain-term-related' });
      addAlias(graph, relatedId, related, 'label', 1.1);
      addEdge(graph, entityId, relatedId, 'related-term', 0.8);
    }
  }

  for (const task of brain.tasks) {
    const entityId = addEntity(graph, 'task', task.label, {
      taskId: task.id,
      obligationLevel: task.obligation_level,
    });
    taskIds.set(task.id, entityId);
    addAlias(graph, entityId, task.label, 'label', 1.4);
    for (const synonym of task.synonyms ?? []) addAlias(graph, entityId, synonym, 'synonym', 1.2);

    const workflowId = workflowIds.get(task.workflow_event);
    if (workflowId) addEdge(graph, workflowId, entityId, 'has-task', 1.4);

    const actorId = actorIds.get(task.actor);
    if (actorId) addEdge(graph, entityId, actorId, 'handled-by', 1.1);

    const timeWindowId = timeWindowIds.get(task.time_window);
    if (timeWindowId) addEdge(graph, entityId, timeWindowId, 'time-window', 1);

    for (const artifact of task.required_artifact) {
      const artifactId = artifactIds.get(artifact);
      if (artifactId) addEdge(graph, entityId, artifactId, 'requires-artifact', 1.2);
    }
  }
}

function attachDocumentEntities(graph: OntologyGraph, chunks: StructuredChunk[], brain: DomainBrain): void {
  const representatives = documentRepresentatives(chunks);
  const chunksByDocumentId = new Map<string, StructuredChunk[]>();
  const titleToDocumentId = new Map<string, string>();

  for (const chunk of chunks) {
    const list = chunksByDocumentId.get(chunk.documentId) ?? [];
    list.push(chunk);
    chunksByDocumentId.set(chunk.documentId, list);
  }

  for (const representative of representatives.values()) {
    titleToDocumentId.set(normalizeDocumentTitle(representative.docTitle), representative.documentId);
    titleToDocumentId.set(normalizeDocumentTitle(representative.fileName), representative.documentId);
  }

  for (const representative of representatives.values()) {
    const documentEntityId = addEntity(graph, 'document', representative.docTitle, {
      documentId: representative.documentId,
      mode: representative.mode,
      sourceType: representative.sourceType,
      sourceRole: representative.sourceRole,
      path: representative.path,
    });
    graph.documentEntityIdByDocumentId.set(representative.documentId, documentEntityId);
    bindDocument(graph, documentEntityId, representative.documentId, representative.path);
    addAlias(graph, documentEntityId, representative.docTitle, 'title', 1.4);
    addAlias(graph, documentEntityId, representative.fileName, 'file-name', 1.2);

    for (const candidate of extractDocumentConceptCandidates(
      representative,
      chunksByDocumentId.get(representative.documentId) ?? [],
    )) {
      const conceptEntityId = addEntity(graph, 'concept', candidate.label, {
        kind: 'generated-document-concept',
        status: 'candidate',
        confidence: candidate.confidence,
        source: candidate.source,
        sourceDocumentId: representative.documentId,
        path: representative.path,
      });
      bindDocument(graph, conceptEntityId, representative.documentId, representative.path);
      addAlias(graph, conceptEntityId, candidate.label, 'generated-concept', candidate.confidence);
      addEdge(graph, documentEntityId, conceptEntityId, 'mentions-concept', candidate.confidence, {
        source: candidate.source,
        status: 'candidate',
      });
    }

    const compactText = compactQueryText(
      chunksByDocumentId
        .get(representative.documentId)
        ?.slice(0, 8)
        .map((chunk) => `${chunk.docTitle} ${chunk.parentSectionTitle} ${chunk.text}`)
        .join(' ') ?? representative.searchText,
    );

    if (['law', 'ordinance', 'rule', 'notice'].includes(representative.sourceType)) {
      const lawEntityId = addEntity(graph, 'law', representative.docTitle, {
        documentId: representative.documentId,
        sourceType: representative.sourceType,
      });
      bindDocument(graph, lawEntityId, representative.documentId, representative.path);
      addAlias(graph, lawEntityId, representative.docTitle, 'canonical-law', 1.6);
      addAlias(graph, lawEntityId, representative.fileName, 'canonical-law-file', 1.2);
      addEdge(graph, documentEntityId, lawEntityId, 'documents-law', 1.3);
    }

    for (const workflow of brain.workflowEvents) {
      const terms = [workflow.label, ...workflow.synonyms].map(compactQueryText);
      if (!terms.some((term) => term && compactText.includes(term))) continue;
      const workflowEntityId = addEntity(graph, 'workflow', workflow.label, { workflowId: workflow.id });
      bindDocument(graph, workflowEntityId, representative.documentId, representative.path);
      addEdge(graph, documentEntityId, workflowEntityId, 'covers-workflow', 1.3);
    }

    for (const term of brain.terms) {
      const terms = [term.term, ...term.synonyms, ...(term.related_terms ?? [])].map(compactQueryText);
      if (!terms.some((token) => token && compactText.includes(token))) continue;
      const termEntityId = addEntity(graph, 'term', term.term, { kind: 'brain-term' });
      bindDocument(graph, termEntityId, representative.documentId, representative.path);
      addEdge(graph, documentEntityId, termEntityId, 'mentions-term', 1.1);
    }
  }

  for (const representative of representatives.values()) {
    const documentEntityId = graph.documentEntityIdByDocumentId.get(representative.documentId);
    if (!documentEntityId) continue;
    for (const linked of representative.linkedDocumentTitles) {
      const linkedDocumentId = titleToDocumentId.get(normalizeDocumentTitle(linked));
      if (!linkedDocumentId || linkedDocumentId === representative.documentId) continue;
      const linkedEntityId = graph.documentEntityIdByDocumentId.get(linkedDocumentId);
      if (!linkedEntityId) continue;
      addEdge(graph, documentEntityId, linkedEntityId, 'linked-document', 0.9);
    }
  }
}

function statusWeight(status: GeneratedOntologyStatus): number {
  switch (status) {
    case 'promoted':
      return 1.35;
    case 'validated':
      return 1.15;
    case 'candidate':
      return 0.78;
    case 'rejected':
      return 0;
  }
}

function attachGeneratedOntologyManifest(graph: OntologyGraph, manifest: GeneratedOntologyManifest): void {
  for (const concept of manifest.concepts) {
    const status = concept.status ?? 'candidate';
    if (status === 'rejected') continue;

    const label = cleanConceptCandidate(concept.label);
    if (!label) continue;

    const confidence = Math.max(0, Math.min(1, concept.confidence ?? statusWeight(status)));
    const conceptEntityId = addEntity(graph, 'concept', label, {
      kind: 'generated-ontology-concept',
      status,
      confidence,
      source: concept.source ?? 'generated-ontology',
    });
    addAlias(graph, conceptEntityId, label, `generated-${status}-label`, statusWeight(status));

    for (const alias of uniqueStrings(concept.aliases ?? [])) {
      addAlias(graph, conceptEntityId, alias, `generated-${status}-alias`, statusWeight(status));
    }

    for (const related of uniqueStrings(concept.related_terms ?? [])) {
      const relatedLabel = cleanConceptCandidate(related);
      if (!relatedLabel) continue;
      const relatedEntityId = addEntity(graph, 'concept', relatedLabel, {
        kind: 'generated-ontology-related',
        status,
        confidence,
        source: concept.source ?? 'generated-ontology',
      });
      addAlias(graph, relatedEntityId, relatedLabel, `generated-${status}-related`, Math.max(0.7, statusWeight(status) - 0.15));
      addEdge(graph, conceptEntityId, relatedEntityId, 'generated-related-term', Math.max(0.6, statusWeight(status) - 0.2), {
        status,
        source: concept.source ?? 'generated-ontology',
      });
    }

    for (const document of resolveEvidenceDocuments(graph, concept.evidence)) {
      bindDocument(graph, conceptEntityId, document.documentId, document.path);
      const documentEntityId = graph.documentEntityIdByDocumentId.get(document.documentId);
      if (documentEntityId) {
        addEdge(graph, documentEntityId, conceptEntityId, 'supports-generated-concept', statusWeight(status), {
          status,
          source: concept.source ?? 'generated-ontology',
        });
      }
    }
  }
}

export function buildOntologyGraph(
  brain: DomainBrain,
  chunks: StructuredChunk[],
  generatedOntology: GeneratedOntologyManifest = EMPTY_GENERATED_ONTOLOGY,
): OntologyGraph {
  const graph = createGraph();
  attachBrainEntities(graph, brain);
  attachDocumentEntities(graph, chunks, brain);
  attachGeneratedOntologyManifest(graph, generatedOntology);
  return graph;
}

export function buildOntologyRows(graph: OntologyGraph): {
  entityRows: Array<Record<string, unknown>>;
  aliasRows: Array<Record<string, unknown>>;
  edgeRows: Array<Record<string, unknown>>;
} {
  return {
    entityRows: graph.entities.map((entity) => ({
      id: entity.id,
      entity_type: entity.entityType,
      label: entity.label,
      metadata: entity.metadata ?? {},
    })),
    aliasRows: graph.aliases.map((alias) => ({
      id: alias.id,
      entity_id: alias.entityId,
      alias: alias.alias,
      alias_type: alias.aliasType,
      weight: alias.weight,
    })),
    edgeRows: graph.edges.map((edge) => ({
      id: edge.id,
      from_entity_id: edge.fromEntityId,
      to_entity_id: edge.toEntityId,
      relation: edge.relation,
      weight: edge.weight,
      metadata: edge.metadata ?? {},
    })),
  };
}

function lookupEntityHits(graph: OntologyGraph, profile: NaturalLanguageQueryProfile): OntologyHit[] {
  const hits = new Map<string, OntologyHit>();
  const variants = uniqueStrings([
    profile.normalizedQuery,
    ...profile.searchVariants,
    ...profile.aliasResolutions.map((item) => item.canonical),
    ...profile.parsedLawRefs.flatMap((item) => [item.canonicalLawName, item.article ?? '']),
  ]);

  for (const variant of variants) {
    const compact = compactQueryText(variant);
    if (!compact) continue;
    const queryTokens = significantOntologyTokens(variant);

    const directMatches = graph.aliasIndex.get(compact) ?? [];
    for (const match of directMatches) {
      const entity = graph.entityById.get(match.entityId);
      if (!entity) continue;
      const current = hits.get(match.entityId);
      const score = Math.max(current?.score ?? 0, 12 * match.weight);
      hits.set(match.entityId, {
        entityId: entity.id,
        label: entity.label,
        entityType: entity.entityType,
        matchedAlias: match.alias,
        score,
        documentIds: Array.from(graph.documentIdsByEntityId.get(entity.id) ?? []),
        depth: 0,
      });
    }

    for (const [aliasKey, matches] of graph.aliasIndex.entries()) {
      if (aliasKey.length < 3 || !compact.includes(aliasKey)) continue;
      for (const match of matches) {
        const entity = graph.entityById.get(match.entityId);
        if (!entity) continue;
        const current = hits.get(match.entityId);
        const score = Math.max(current?.score ?? 0, 6 * match.weight);
        hits.set(match.entityId, {
          entityId: entity.id,
          label: entity.label,
          entityType: entity.entityType,
          matchedAlias: match.alias,
          score,
          documentIds: Array.from(graph.documentIdsByEntityId.get(entity.id) ?? []),
          depth: 0,
        });
      }
    }

    for (const matches of graph.aliasIndex.values()) {
      for (const match of matches) {
        const scoreFromOverlap = scoreAliasTokenOverlap(queryTokens, match.alias);
        if (scoreFromOverlap <= 0) continue;

        const entity = graph.entityById.get(match.entityId);
        if (!entity) continue;
        const current = hits.get(match.entityId);
        const score = Math.max(current?.score ?? 0, scoreFromOverlap * match.weight);
        hits.set(match.entityId, {
          entityId: entity.id,
          label: entity.label,
          entityType: entity.entityType,
          matchedAlias: match.alias,
          score,
          documentIds: Array.from(graph.documentIdsByEntityId.get(entity.id) ?? []),
          depth: 0,
        });
      }
    }
  }

  return Array.from(hits.values()).sort((left, right) => right.score - left.score);
}

export function expandDocumentsWithOntology(
  graph: OntologyGraph,
  profile: NaturalLanguageQueryProfile,
  anchorDocumentIds: string[],
  depth = 1,
): OntologySearchResult {
  const directHits = lookupEntityHits(graph, profile).slice(0, 12);
  const queue: Array<{ entityId: string; depth: number }> = [];
  const visited = new Set<string>();
  const documentScoreBoosts = new Map<string, number>();
  const expandedEntityIds = new Set<string>();

  for (const hit of directHits) {
    queue.push({ entityId: hit.entityId, depth: 0 });
    visited.add(hit.entityId);
    for (const documentId of hit.documentIds) {
      documentScoreBoosts.set(documentId, (documentScoreBoosts.get(documentId) ?? 0) + hit.score);
    }
  }

  for (const documentId of anchorDocumentIds) {
    const entityId = graph.documentEntityIdByDocumentId.get(documentId);
    if (!entityId || visited.has(entityId)) continue;
    visited.add(entityId);
    queue.push({ entityId, depth: 0 });
  }

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;
    expandedEntityIds.add(current.entityId);
    if (current.depth >= depth) continue;

    const neighbors = graph.adjacency.get(current.entityId) ?? [];
    for (const edge of neighbors) {
      const nextEntityId = edge.fromEntityId === current.entityId ? edge.toEntityId : edge.fromEntityId;
      const nextDepth = current.depth + 1;
      const docs = Array.from(graph.documentIdsByEntityId.get(nextEntityId) ?? []);

      for (const documentId of docs) {
        const boost = Math.max(2, edge.weight * (nextDepth === 1 ? 6 : 3));
        documentScoreBoosts.set(documentId, (documentScoreBoosts.get(documentId) ?? 0) + boost);
      }

      if (visited.has(nextEntityId)) continue;
      visited.add(nextEntityId);
      queue.push({ entityId: nextEntityId, depth: nextDepth });
    }
  }

  const boostedDocumentPaths = Array.from(documentScoreBoosts.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 8)
    .map(([documentId]) => graph.documentPathsById.get(documentId) ?? documentId);

  return {
    documentScoreBoosts,
    hits: directHits,
    trace: [
      {
        anchorEntityIds: directHits.map((item) => item.entityId),
        expandedEntityIds: Array.from(expandedEntityIds),
        boostedDocumentPaths,
        depth,
      },
    ],
  };
}
