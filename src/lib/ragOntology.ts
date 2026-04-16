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
import { normalizeDocumentTitle, sha1 } from './ragMetadata';

interface AliasMatch {
  entityId: string;
  alias: string;
  weight: number;
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

export function buildOntologyGraph(brain: DomainBrain, chunks: StructuredChunk[]): OntologyGraph {
  const graph = createGraph();
  attachBrainEntities(graph, brain);
  attachDocumentEntities(graph, chunks, brain);
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
