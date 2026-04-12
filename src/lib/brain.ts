import fs from 'fs';
import path from 'path';
import { normalizeDocumentTitle } from './ragMetadata';
import type { BasisBucketKey, ExpertAnswerType, PromptMode, RetrievalMode, StructuredChunk, CompiledPage } from './ragTypes';

export interface BrainQuestionArchetype {
  id: string;
  label: string;
  preferred_answer_type: ExpertAnswerType;
  retrieval_mode: RetrievalMode;
  triggers: string[];
}

export interface BrainWorkflowEvent {
  id: string;
  label: string;
  synonyms: string[];
  tasks: string[];
  service_scope?: PromptMode[];
}

export interface BrainActor {
  id: string;
  label: string;
  synonyms?: string[];
}

export interface BrainArtifact {
  id: string;
  label: string;
  synonyms?: string[];
}

export interface BrainTimeWindow {
  id: string;
  label: string;
  synonyms?: string[];
}

export interface BrainTask {
  id: string;
  label: string;
  workflow_event: string;
  actor: string;
  time_window: string;
  required_artifact: string[];
  obligation_level: 'mandatory' | 'recommended' | 'conditional';
  service_scope?: PromptMode[];
  legal_basis: string[];
  evaluation_basis: string[];
  practical_basis: string[];
  synonyms?: string[];
}

export interface BrainTerm {
  term: string;
  synonyms: string[];
  related_terms?: string[];
}

export interface BrainManifestFile {
  question_archetypes?: BrainQuestionArchetype[];
  workflow_events?: BrainWorkflowEvent[];
  actors?: BrainActor[];
  artifacts?: BrainArtifact[];
  time_windows?: BrainTimeWindow[];
  tasks?: BrainTask[];
  terms?: BrainTerm[];
}

export interface DomainBrain {
  questionArchetypes: BrainQuestionArchetype[];
  workflowEvents: BrainWorkflowEvent[];
  actors: BrainActor[];
  artifacts: BrainArtifact[];
  timeWindows: BrainTimeWindow[];
  tasks: BrainTask[];
  terms: BrainTerm[];
}

export interface WorkflowBrief {
  eventId: string;
  label: string;
  summary: string;
  taskIds: string[];
  snippets: string[];
}

export interface BrainQueryProfile {
  questionArchetype: string;
  recommendedAnswerType: ExpertAnswerType;
  preferredRetrievalMode: RetrievalMode;
  workflowEvents: string[];
  aliases: string[];
  relatedTerms: string[];
}

export type ServiceScopeId = 'day-care' | 'home-visit' | 'facility';

export interface ServiceScopeClarification {
  needsClarification: boolean;
  candidateScopes: Array<{
    id: ServiceScopeId;
    label: string;
    score: number;
    explicitHits: string[];
    contextualHits: string[];
  }>;
  ambiguitySignals: string[];
  clarificationQuestion?: string;
}

function compact(value: string): string {
  return value.replace(/\s+/g, '').toLowerCase();
}

function safeArray<T>(value: T[] | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function uniqueStrings(values: Iterable<string>): string[] {
  return Array.from(new Set(Array.from(values).map((value) => value.trim()).filter(Boolean)));
}

const SERVICE_SCOPE_PATTERNS: Array<{
  id: ServiceScopeId;
  label: string;
  explicitTerms: string[];
  contextualTerms: string[];
}> = [
  {
    id: 'day-care',
    label: '주간보호(주야간보호)',
    explicitTerms: ['주간보호', '주야간보호', '데이케어', '데이케어센터'],
    contextualTerms: ['프로그램', '송영', '등원', '하원', '토요일', '센터', '오시', '오시는데'],
  },
  {
    id: 'home-visit',
    label: '방문요양',
    explicitTerms: ['방문요양', '인지활동형 방문요양', '인지활동형방문요양'],
    contextualTerms: ['인지활동형', '5등급', '방문선생님', '댁', '가정', '집으로'],
  },
  {
    id: 'facility',
    label: '시설급여(입소시설)',
    explicitTerms: ['시설급여', '입소시설', '요양원', '노인의료복지시설'],
    contextualTerms: ['입소', '생활실', '입실', '시설'],
  },
];

function listJsonFiles(root: string): string[] {
  if (!fs.existsSync(root)) return [];
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => path.join(root, entry.name))
    .sort((left, right) => left.localeCompare(right, 'ko'));
}

function validateBrain(brain: DomainBrain): void {
  const workflowEvents = new Map(brain.workflowEvents.map((event) => [event.id, event]));
  const actors = new Set(brain.actors.map((item) => item.id));
  const artifacts = new Set(brain.artifacts.map((item) => item.id));
  const timeWindows = new Set(brain.timeWindows.map((item) => item.id));
  const taskIds = new Set(brain.tasks.map((task) => task.id));
  const seenSynonyms = new Map<string, string>();

  for (const task of brain.tasks) {
    if (!workflowEvents.has(task.workflow_event)) {
      throw new Error(`Brain task "${task.id}" references missing workflow_event "${task.workflow_event}".`);
    }
    if (!actors.has(task.actor)) {
      throw new Error(`Brain task "${task.id}" references missing actor "${task.actor}".`);
    }
    if (!timeWindows.has(task.time_window)) {
      throw new Error(`Brain task "${task.id}" references missing time_window "${task.time_window}".`);
    }
    for (const artifact of task.required_artifact) {
      if (!artifacts.has(artifact)) {
        throw new Error(`Brain task "${task.id}" references missing artifact "${artifact}".`);
      }
    }
    const basisCount = task.legal_basis.length + task.evaluation_basis.length + task.practical_basis.length;
    if (basisCount === 0) {
      throw new Error(`Brain task "${task.id}" must have at least one basis.`);
    }
  }

  for (const event of brain.workflowEvents) {
    for (const taskId of event.tasks) {
      if (!taskIds.has(taskId)) {
        throw new Error(`Workflow event "${event.id}" references missing task "${taskId}".`);
      }
    }
  }

  const registerSynonym = (value: string, owner: string) => {
    const key = compact(value);
    if (!key) return;
    const existing = seenSynonyms.get(key);
    if (existing && existing !== owner) {
      throw new Error(`Duplicate brain synonym "${value}" appears in both "${existing}" and "${owner}".`);
    }
    seenSynonyms.set(key, owner);
  };

  for (const event of brain.workflowEvents) {
    event.synonyms.forEach((synonym) => registerSynonym(synonym, `workflow_event:${event.id}`));
  }
  for (const task of brain.tasks) {
    safeArray(task.synonyms).forEach((synonym) => registerSynonym(synonym, `task:${task.id}`));
  }
  for (const term of brain.terms) {
    term.synonyms.forEach((synonym) => registerSynonym(synonym, `term:${term.term}`));
  }
}

export function loadDomainBrain(projectRoot: string): DomainBrain {
  const brainRoot = path.join(projectRoot, 'knowledge', 'brain');
  const files = listJsonFiles(brainRoot);
  const aggregate: DomainBrain = {
    questionArchetypes: [],
    workflowEvents: [],
    actors: [],
    artifacts: [],
    timeWindows: [],
    tasks: [],
    terms: [],
  };

  for (const filePath of files) {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as BrainManifestFile;
    aggregate.questionArchetypes.push(...safeArray(parsed.question_archetypes));
    aggregate.workflowEvents.push(...safeArray(parsed.workflow_events));
    aggregate.actors.push(...safeArray(parsed.actors));
    aggregate.artifacts.push(...safeArray(parsed.artifacts));
    aggregate.timeWindows.push(...safeArray(parsed.time_windows));
    aggregate.tasks.push(...safeArray(parsed.tasks));
    aggregate.terms.push(...safeArray(parsed.terms));
  }

  validateBrain(aggregate);
  return aggregate;
}

function scoreMatches(queryCompact: string, values: string[]): number {
  return values.reduce((score, value) => (queryCompact.includes(compact(value)) ? score + 1 : score), 0);
}

export function classifyQuestionArchetype(brain: DomainBrain, query: string): BrainQuestionArchetype {
  const queryCompact = compact(query);
  const scored = brain.questionArchetypes
    .map((archetype) => ({
      archetype,
      score: scoreMatches(queryCompact, archetype.triggers),
    }))
    .sort((left, right) => right.score - left.score);

  return (
    scored.find((entry) => entry.score > 0)?.archetype ??
    brain.questionArchetypes.find((entry) => entry.id === 'mixed-general') ??
    {
      id: 'mixed-general',
      label: '혼합형',
      preferred_answer_type: 'mixed',
      retrieval_mode: 'local',
      triggers: [],
    }
  );
}

export function matchWorkflowEvents(brain: DomainBrain, query: string, mode: PromptMode): BrainWorkflowEvent[] {
  const queryCompact = compact(query);
  return brain.workflowEvents
    .filter((event) => !event.service_scope || event.service_scope.includes(mode))
    .map((event) => ({
      event,
      score: scoreMatches(queryCompact, [event.label, ...event.synonyms]),
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 3)
    .map((entry) => entry.event);
}

export function buildBrainQueryProfile(brain: DomainBrain, query: string, mode: PromptMode): BrainQueryProfile {
  const archetype = classifyQuestionArchetype(brain, query);
  const workflowEvents = matchWorkflowEvents(brain, query, mode);
  const queryCompact = compact(query);
  const broadWorkflowCue =
    /무엇|뭐|준비|정리|체크|확인|업무|절차/.test(query) ||
    ['준비', '정리', '확인', '업무', '평가'].some((term) => queryCompact.includes(compact(term)));
  const recommendedAnswerType =
    workflowEvents.length > 0 && broadWorkflowCue && archetype.preferred_answer_type === 'definition'
      ? 'checklist'
      : archetype.preferred_answer_type;
  const preferredRetrievalMode =
    workflowEvents.length > 0 && broadWorkflowCue && archetype.retrieval_mode === 'local'
      ? 'workflow-global'
      : archetype.retrieval_mode;
  const aliases = uniqueStrings([
    archetype.label,
    ...workflowEvents.flatMap((event) => [event.label, ...event.synonyms]),
    ...brain.terms.flatMap((term) => (compact(query).includes(compact(term.term)) ? [term.term, ...term.synonyms] : [])),
  ]).slice(0, 24);
  const relatedTerms = uniqueStrings(
    brain.terms.flatMap((term) =>
      compact(query).includes(compact(term.term)) ? [...term.synonyms, ...(term.related_terms ?? [])] : [],
    ),
  ).slice(0, 18);

  return {
    questionArchetype: archetype.id,
    recommendedAnswerType,
    preferredRetrievalMode,
    workflowEvents: workflowEvents.map((event) => event.id),
    aliases,
    relatedTerms,
  };
}

export function detectServiceScopeClarification(query: string): ServiceScopeClarification {
  const queryCompact = compact(query);
  const containsProgramCue = ['프로그램', '인지', '신체'].some((term) => queryCompact.includes(compact(term)));
  const containsAttendanceCue = ['오시', '오시는데', '토요일', '요일'].some((term) => queryCompact.includes(compact(term)));

  const candidateScopes = SERVICE_SCOPE_PATTERNS.map((scope) => {
    const explicitHits = scope.explicitTerms.filter((term) => queryCompact.includes(compact(term)));
    const contextualHits = scope.contextualTerms.filter((term) => queryCompact.includes(compact(term)));
    const score = explicitHits.length * 4 + contextualHits.length;
    return {
      id: scope.id,
      label: scope.label,
      score,
      explicitHits,
      contextualHits,
    };
  }).sort((left, right) => right.score - left.score);

  const explicitMatches = candidateScopes.filter((scope) => scope.explicitHits.length > 0);
  const meaningfulCandidates = candidateScopes.filter((scope) => scope.score >= 2);
  const ambiguitySignals: string[] = [];

  if (explicitMatches.length > 1) {
    ambiguitySignals.push('multiple-explicit-service-scopes');
  }

  if (
    explicitMatches.length === 0 &&
    meaningfulCandidates.length >= 2 &&
    meaningfulCandidates[0].score - meaningfulCandidates[1].score <= 2
  ) {
    ambiguitySignals.push('competing-service-scope-signals');
  }

  if (
    explicitMatches.length === 0 &&
    queryCompact.includes('5등급') &&
    containsProgramCue &&
    containsAttendanceCue
  ) {
    ambiguitySignals.push('grade-5-program-attendance-mix');
  }

  const needsClarification = ambiguitySignals.length > 0;
  const topCandidates = candidateScopes.filter((scope) => scope.score > 0).slice(0, 3);

  return {
    needsClarification,
    candidateScopes: topCandidates,
    ambiguitySignals,
    clarificationQuestion: needsClarification
      ? `${topCandidates.slice(0, 2).map((scope) => scope.label).join('인지, ')}인지 먼저 알려주세요. 급여 유형에 따라 인지·신체 프로그램 기준이 달라집니다.`
      : undefined,
  };
}

function addDocumentScore(scores: Map<string, number>, documentId: string, value: number): void {
  scores.set(documentId, (scores.get(documentId) ?? 0) + value);
}

export function buildBrainDocumentBoosts(
  brain: DomainBrain,
  chunks: StructuredChunk[],
  workflowEventIds: string[],
  query: string,
): Map<string, number> {
  const tasks = brain.tasks.filter((task) => workflowEventIds.includes(task.workflow_event));
  if (tasks.length === 0) {
    return new Map<string, number>();
  }

  const queryCompact = compact(query);
  const scores = new Map<string, number>();
  for (const chunk of chunks) {
    const searchCompact = compact([chunk.docTitle, chunk.parentSectionTitle, chunk.searchText].join(' '));
    let score = 0;

    for (const task of tasks) {
      if (task.service_scope && !task.service_scope.includes(chunk.mode)) continue;
      const taskSignals = [
        task.label,
        ...(task.synonyms ?? []),
        ...task.legal_basis,
        ...task.evaluation_basis,
        ...task.practical_basis,
      ];
      const taskScore = taskSignals.reduce((sum, signal) => {
        const normalized = compact(signal);
        if (!normalized) return sum;
        if (searchCompact.includes(normalized)) return sum + 8;
        if (queryCompact.includes(normalized) && searchCompact.includes(normalized.slice(0, Math.max(2, normalized.length - 2)))) {
          return sum + 4;
        }
        return sum;
      }, 0);
      score += taskScore;
    }

    if (score > 0) {
      addDocumentScore(scores, chunk.documentId, score);
    }
  }

  return new Map(
    Array.from(scores.entries())
      .sort((left, right) => right[1] - left[1])
      .slice(0, 12),
  );
}

export function buildWorkflowBriefs(brain: DomainBrain, pages: CompiledPage[], chunks: StructuredChunk[]): WorkflowBrief[] {
  const representativeChunks = new Map<string, StructuredChunk>();
  for (const chunk of chunks) {
    if (!representativeChunks.has(chunk.documentId)) {
      representativeChunks.set(chunk.documentId, chunk);
    }
  }

  return brain.workflowEvents.map((event) => {
    const tasks = brain.tasks.filter((task) => task.workflow_event === event.id);
    const signals = uniqueStrings([
      event.label,
      ...event.synonyms,
      ...tasks.flatMap((task) => [task.label, ...(task.synonyms ?? []), ...task.legal_basis, ...task.evaluation_basis, ...task.practical_basis]),
    ]);

    const snippets = pages
      .map((page) => {
        const haystack = compact([page.title, page.summary, page.body, ...(page.tags ?? [])].join(' '));
        const matches = signals.filter((signal) => haystack.includes(compact(signal)));
        return matches.length > 0 ? `${page.title}: ${page.summary}` : null;
      })
      .filter((value): value is string => Boolean(value))
      .slice(0, 4);

    if (snippets.length === 0) {
      const fallbackSnippets = Array.from(representativeChunks.values())
        .map((chunk) => {
          const haystack = compact([chunk.docTitle, chunk.parentSectionTitle, chunk.searchText].join(' '));
          const matches = signals.filter((signal) => haystack.includes(compact(signal)));
          return matches.length > 0 ? `${chunk.docTitle}: ${chunk.textPreview}` : null;
        })
        .filter((value): value is string => Boolean(value))
        .slice(0, 3);
      snippets.push(...fallbackSnippets);
    }

    return {
      eventId: event.id,
      label: event.label,
      summary: uniqueStrings(tasks.map((task) => task.label)).slice(0, 4).join(', '),
      taskIds: event.tasks,
      snippets,
    };
  });
}

export function selectWorkflowBriefs(briefs: WorkflowBrief[], eventIds: string[]): WorkflowBrief[] {
  return briefs.filter((brief) => eventIds.includes(brief.eventId)).slice(0, 3);
}

export function buildWorkflowBriefContext(briefs: WorkflowBrief[]): string {
  if (briefs.length === 0) return '';
  return briefs
    .map((brief) =>
      [
        `WorkflowEvent: ${brief.label}`,
        brief.summary ? `Summary: ${brief.summary}` : null,
        brief.snippets.length > 0 ? `Snippets:\n- ${brief.snippets.join('\n- ')}` : null,
      ]
        .filter(Boolean)
        .join('\n'),
    )
    .join('\n\n---\n\n');
}

export function buildDriftSubquestions(
  brain: DomainBrain,
  query: string,
  profile: BrainQueryProfile,
  mode: PromptMode,
): string[] {
  const tasks = brain.tasks.filter((task) => profile.workflowEvents.includes(task.workflow_event) && (!task.service_scope || task.service_scope.includes(mode)));
  const subquestions = uniqueStrings([
    profile.recommendedAnswerType === 'comparison' ? `${query}\n차이점을 기준별로 다시 정리` : '',
    profile.recommendedAnswerType === 'definition' ? `${query}\n정의와 구분 포인트를 다시 확인` : '',
    tasks[0] ? `${tasks[0].label}는 누가 언제 무엇을 준비해야 하는가?` : '',
    tasks[1] ? `${tasks[1].label}의 근거 문서와 필요한 기록은 무엇인가?` : '',
    `${query}\n법적 의무와 평가 준비를 분리해서 확인`,
  ]);
  return subquestions.filter((value) => value && compact(value) !== compact(query)).slice(0, 3);
}

export function summarizeWorkflowEvents(brain: DomainBrain, eventIds: string[]): string[] {
  const labelById = new Map(brain.workflowEvents.map((event) => [event.id, event.label]));
  return eventIds.map((eventId) => labelById.get(eventId) ?? eventId);
}

export function findTasksForWorkflowEvents(brain: DomainBrain, eventIds: string[], mode: PromptMode): BrainTask[] {
  return brain.tasks.filter(
    (task) => eventIds.includes(task.workflow_event) && (!task.service_scope || task.service_scope.includes(mode)),
  );
}

export function collectBasisSignals(task: BrainTask): Record<BasisBucketKey, string[]> {
  return {
    legal: task.legal_basis,
    evaluation: task.evaluation_basis,
    practical: task.practical_basis,
  };
}

export function findRelatedTerms(brain: DomainBrain, query: string): string[] {
  const normalizedQuery = compact(query);
  return uniqueStrings(
    brain.terms.flatMap((term) => {
      const terms = [term.term, ...term.synonyms];
      return terms.some((entry) => normalizedQuery.includes(compact(entry)))
        ? [term.term, ...term.synonyms, ...(term.related_terms ?? [])]
        : [];
    }),
  );
}

export function inferBasisBucketFromChunk(chunk: StructuredChunk): BasisBucketKey {
  if (['law', 'ordinance', 'rule', 'notice'].includes(chunk.sourceType)) {
    return 'legal';
  }
  if (chunk.mode === 'evaluation' || chunk.sourceRole === 'primary_evaluation') {
    return 'evaluation';
  }
  return 'practical';
}

export function normalizeBrainLabel(value: string): string {
  return normalizeDocumentTitle(value);
}
