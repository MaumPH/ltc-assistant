import { GoogleGenAI } from '@google/genai';
import {
  type ServiceScopeClarification,
  findTasksForWorkflowEvents,
  inferBasisBucketFromChunk,
  summarizeWorkflowEvents,
  type DomainBrain,
  type WorkflowBrief,
} from './brain';
import {
  buildPlannerSystemInstruction,
  buildSynthesizerSystemInstruction,
  type PromptSourceSet,
  type PromptVariant,
} from './promptAssembly';
import { buildPreciseCitationLabel, formatEvidenceStateLabel } from './ragMetadata';
import { chunksToEvidenceContext } from './ragStructured';
import type {
  AnswerPlan,
  AnswerPlanTaskCandidate,
  BasisBucketKey,
  ChatMessage,
  ClaimPlan,
  ConfidenceLevel,
  EvidenceState,
  ExpertAnswerBlock,
  ExpertAnswerCitation,
  ExpertAnswerEnvelope,
  ExpertAnswerType,
  PromptMode,
  RetrievalMode,
  SemanticFrame,
  StructuredChunk,
} from './ragTypes';

type ClarificationDimension =
  | 'service_scope'
  | 'comparison_target'
  | 'document_reference'
  | 'time_reference'
  | 'actor_scope'
  | 'workflow_stage'
  | 'target_subject';

export interface ClarificationDecision {
  needsClarification: boolean;
  reason: string;
  missingDimensions: ClarificationDimension[];
  clarificationQuestion?: string;
  candidateOptions: string[];
}

export function suppressSelectedServiceScopeClarification(
  decision: ClarificationDecision,
  selectedServiceScopeLabels: readonly string[],
): ClarificationDecision {
  if (selectedServiceScopeLabels.length === 0 || !decision.needsClarification) {
    return decision;
  }

  const remainingDimensions = decision.missingDimensions.filter((dimension) => dimension !== 'service_scope');
  const clarificationText = [decision.clarificationQuestion ?? '', ...decision.candidateOptions].join(' ');
  const looksLikeServiceScopeOnly =
    decision.missingDimensions.length === 0 &&
    /급여\s*유형|서비스\s*유형|기관\s*유형|주야간보호|주간보호|요양원|방문요양/.test(clarificationText);

  if (remainingDimensions.length === 0 && (decision.missingDimensions.includes('service_scope') || looksLikeServiceScopeOnly)) {
    return {
      needsClarification: false,
      reason: `선택된 급여유형(${selectedServiceScopeLabels.join(', ')})이 이미 적용되어 서비스 유형 확인 질문을 생략합니다.`,
      missingDimensions: [],
      clarificationQuestion: undefined,
      candidateOptions: [],
    };
  }

  return {
    ...decision,
    missingDimensions: remainingDimensions,
  };
}

function uniqueStrings(values: Iterable<string>): string[] {
  return Array.from(new Set(Array.from(values).map((value) => value.trim()).filter(Boolean)));
}

function sanitizeText(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() || fallback : fallback;
}

function sanitizeStringList(value: unknown, limit = 8): string[] {
  if (!Array.isArray(value)) return [];
  return uniqueStrings(value.map((item) => (typeof item === 'string' ? item : '')).filter(Boolean)).slice(0, limit);
}

function sanitizeCitationIds(value: unknown, allowedIds: Set<string>, limit = 6): string[] {
  if (!Array.isArray(value)) return [];
  return uniqueStrings(
    value.map((item) => (typeof item === 'string' ? item : '')).filter((item) => allowedIds.has(item)),
  ).slice(0, limit);
}

function toBasisEntriesFromEvidence(evidence: StructuredChunk[]): ExpertAnswerEnvelope['basis'] {
  const buckets: ExpertAnswerEnvelope['basis'] = {
    legal: [],
    evaluation: [],
    practical: [],
  };

  for (const chunk of evidence) {
    const bucket = inferBasisBucketFromChunk(chunk);
    const existing = buckets[bucket].find((entry) => entry.label === chunk.docTitle);
    const summary = chunk.textPreview.length > 120 ? `${chunk.textPreview.slice(0, 117)}...` : chunk.textPreview;

    if (existing) {
      existing.citationIds = uniqueStrings([...existing.citationIds, chunk.id]);
      continue;
    }

    buckets[bucket].push({
      label: chunk.docTitle,
      summary,
      citationIds: [chunk.id],
    });
  }

  return {
    legal: buckets.legal.slice(0, 4),
    evaluation: buckets.evaluation.slice(0, 4),
    practical: buckets.practical.slice(0, 4),
  };
}

export function buildBasisCoverage(evidence: StructuredChunk[]): Record<BasisBucketKey, number> {
  const coverage: Record<BasisBucketKey, number> = {
    legal: 0,
    evaluation: 0,
    practical: 0,
  };

  for (const chunk of evidence) {
    coverage[inferBasisBucketFromChunk(chunk)] += 1;
  }

  return coverage;
}

function buildExpertCitations(evidence: StructuredChunk[], whyItMattersById?: Map<string, string>): ExpertAnswerCitation[] {
  return evidence.slice(0, 8).map((chunk) => ({
    evidenceId: chunk.id,
    label: buildPreciseCitationLabel(chunk),
    docTitle: chunk.docTitle,
    articleNo: chunk.articleNo,
    sectionPath: chunk.sectionPath,
    effectiveDate: chunk.effectiveDate,
    whyItMatters: whyItMattersById?.get(chunk.id),
  }));
}

function buildTaskCandidates(brain: DomainBrain, workflowEventIds: string[], mode: PromptMode): AnswerPlanTaskCandidate[] {
  return findTasksForWorkflowEvents(brain, workflowEventIds, mode).slice(0, 6).map((task) => ({
    title: task.label,
    actor: task.actor,
    timeWindow: task.time_window,
    artifact: task.required_artifact.join(', '),
    basis:
      task.legal_basis.length > 0
        ? 'legal'
        : task.evaluation_basis.length > 0
          ? 'evaluation'
          : 'practical',
    note: uniqueStrings([
      ...task.legal_basis,
      ...task.evaluation_basis,
      ...task.practical_basis,
    ]).slice(0, 3).join(', '),
  }));
}

export function buildHeuristicAnswerPlan(params: {
  brain: DomainBrain;
  question: string;
  mode: PromptMode;
  retrievalMode: RetrievalMode;
  questionArchetype: string;
  recommendedAnswerType: ExpertAnswerType;
  workflowEventIds: string[];
  evidence: StructuredChunk[];
}): AnswerPlan {
  const evidenceBasis = toBasisEntriesFromEvidence(params.evidence);
  const tasks = buildTaskCandidates(params.brain, params.workflowEventIds, params.mode);
  const selectedEvidenceIds = params.evidence.slice(0, 6).map((item) => item.id);

  return {
    questionArchetype: params.questionArchetype,
    selectedRetrievalMode: params.retrievalMode,
    intentSummary: sanitizeText(params.question, '질문 의도를 요약하지 못했습니다.'),
    workflowEvents: params.workflowEventIds,
    taskCandidates: tasks,
    basisBuckets: {
      legal: evidenceBasis.legal.map((entry) => entry.summary),
      evaluation: evidenceBasis.evaluation.map((entry) => entry.summary),
      practical: evidenceBasis.practical.map((entry) => entry.summary),
    },
    missingDimensions: uniqueStrings([
      evidenceBasis.legal.length === 0 ? 'legal-basis-thin' : '',
      evidenceBasis.evaluation.length === 0 ? 'evaluation-basis-thin' : '',
      tasks.length === 0 && (params.recommendedAnswerType === 'checklist' || params.recommendedAnswerType === 'procedure')
        ? 'workflow-task-thin'
        : '',
    ]),
    selectedEvidenceIds,
    recommendedAnswerType: params.recommendedAnswerType,
  };
}

function buildPlanPrompt(params: {
  question: string;
  retrievalMode: RetrievalMode;
  workflowEventLabels: string[];
  evidence: StructuredChunk[];
  briefs: WorkflowBrief[];
  heuristicPlan: AnswerPlan;
}): string {
  return [
    'Question:',
    params.question,
    '',
    `Selected retrieval mode: ${params.retrievalMode}`,
    params.workflowEventLabels.length > 0 ? `Workflow events: ${params.workflowEventLabels.join(', ')}` : 'Workflow events: none',
    '',
    'Heuristic planner draft:',
    JSON.stringify(params.heuristicPlan, null, 2),
    '',
    'Workflow briefs:',
    params.briefs.length > 0 ? JSON.stringify(params.briefs, null, 2) : '[]',
    '',
    'Evidence ids available for selection:',
    JSON.stringify(params.evidence.map((item) => ({ id: item.id, label: buildPreciseCitationLabel(item) })), null, 2),
    '',
    'Return a concise plan that preserves basis separation and uses only the listed evidence ids.',
  ].join('\n');
}

function buildPlanSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    required: [
      'questionArchetype',
      'selectedRetrievalMode',
      'intentSummary',
      'workflowEvents',
      'taskCandidates',
      'basisBuckets',
      'missingDimensions',
      'selectedEvidenceIds',
      'recommendedAnswerType',
    ],
    properties: {
      questionArchetype: { type: 'string' },
      selectedRetrievalMode: { type: 'string', enum: ['local', 'workflow-global', 'drift-refine'] },
      intentSummary: { type: 'string' },
      workflowEvents: { type: 'array', items: { type: 'string' } },
      taskCandidates: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['title', 'basis', 'note'],
          properties: {
            title: { type: 'string' },
            actor: { type: 'string' },
            timeWindow: { type: 'string' },
            artifact: { type: 'string' },
            basis: { type: 'string', enum: ['legal', 'evaluation', 'practical'] },
            note: { type: 'string' },
          },
        },
      },
      basisBuckets: {
        type: 'object',
        additionalProperties: false,
        required: ['legal', 'evaluation', 'practical'],
        properties: {
          legal: { type: 'array', items: { type: 'string' } },
          evaluation: { type: 'array', items: { type: 'string' } },
          practical: { type: 'array', items: { type: 'string' } },
        },
      },
      missingDimensions: { type: 'array', items: { type: 'string' } },
      selectedEvidenceIds: { type: 'array', items: { type: 'string' } },
      recommendedAnswerType: {
        type: 'string',
        enum: ['verdict', 'checklist', 'procedure', 'comparison', 'definition', 'mixed'],
      },
    },
  };
}

function normalizePlan(
  candidate: Partial<AnswerPlan>,
  fallback: AnswerPlan,
  allowedEvidenceIds: Set<string>,
  allowedWorkflowEvents: Set<string>,
): AnswerPlan {
  const selectedEvidenceIds = sanitizeCitationIds(candidate.selectedEvidenceIds, allowedEvidenceIds, 8);
  const workflowEvents = sanitizeStringList(candidate.workflowEvents, 4).filter((item) => allowedWorkflowEvents.has(item));

  return {
    questionArchetype: sanitizeText(candidate.questionArchetype, fallback.questionArchetype),
    selectedRetrievalMode:
      candidate.selectedRetrievalMode === 'local' ||
      candidate.selectedRetrievalMode === 'workflow-global' ||
      candidate.selectedRetrievalMode === 'drift-refine'
        ? candidate.selectedRetrievalMode
        : fallback.selectedRetrievalMode,
    intentSummary: sanitizeText(candidate.intentSummary, fallback.intentSummary),
    workflowEvents: workflowEvents.length > 0 ? workflowEvents : fallback.workflowEvents,
    taskCandidates: Array.isArray(candidate.taskCandidates)
      ? ((candidate.taskCandidates
          .map((item) => {
            if (!item || typeof item !== 'object') return null;
            const task = item as Partial<AnswerPlanTaskCandidate>;
            const basis =
              task.basis === 'legal' || task.basis === 'evaluation' || task.basis === 'practical'
                ? task.basis
                : null;
            const title = sanitizeText(task.title);
            const note = sanitizeText(task.note);
            if (!title || !basis || !note) return null;
            return {
              title,
              actor: sanitizeText(task.actor) || undefined,
              timeWindow: sanitizeText(task.timeWindow) || undefined,
              artifact: sanitizeText(task.artifact) || undefined,
              basis,
              note,
            };
          })
          .filter(Boolean)) as AnswerPlanTaskCandidate[]).slice(0, 8)
      : fallback.taskCandidates,
    basisBuckets: {
      legal: sanitizeStringList(candidate.basisBuckets?.legal ?? [], 6),
      evaluation: sanitizeStringList(candidate.basisBuckets?.evaluation ?? [], 6),
      practical: sanitizeStringList(candidate.basisBuckets?.practical ?? [], 6),
    },
    missingDimensions: sanitizeStringList(candidate.missingDimensions, 6),
    selectedEvidenceIds: selectedEvidenceIds.length > 0 ? selectedEvidenceIds : fallback.selectedEvidenceIds,
    recommendedAnswerType:
      candidate.recommendedAnswerType === 'verdict' ||
      candidate.recommendedAnswerType === 'checklist' ||
      candidate.recommendedAnswerType === 'procedure' ||
      candidate.recommendedAnswerType === 'comparison' ||
      candidate.recommendedAnswerType === 'definition' ||
      candidate.recommendedAnswerType === 'mixed'
        ? candidate.recommendedAnswerType
        : fallback.recommendedAnswerType,
  };
}

function sanitizeClarificationDimensions(value: unknown): ClarificationDimension[] {
  if (!Array.isArray(value)) return [];
  return uniqueStrings(
    value
      .map((item) => (typeof item === 'string' ? item : ''))
      .filter(
        (item): item is ClarificationDimension =>
          item === 'service_scope' ||
          item === 'comparison_target' ||
          item === 'document_reference' ||
          item === 'time_reference' ||
          item === 'actor_scope' ||
          item === 'workflow_stage' ||
          item === 'target_subject',
      ),
  ).slice(0, 4) as ClarificationDimension[];
}

function buildClarificationSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['needsClarification', 'reason', 'missingDimensions', 'clarificationQuestion', 'candidateOptions'],
    properties: {
      needsClarification: { type: 'boolean' },
      reason: { type: 'string' },
      missingDimensions: {
        type: 'array',
        items: {
          type: 'string',
          enum: [
            'service_scope',
            'comparison_target',
            'document_reference',
            'time_reference',
            'actor_scope',
            'workflow_stage',
            'target_subject',
          ],
        },
      },
      clarificationQuestion: { type: 'string' },
      candidateOptions: { type: 'array', items: { type: 'string' } },
    },
  };
}

function normalizeClarificationDecision(
  candidate: Partial<ClarificationDecision>,
  fallback: ClarificationDecision,
): ClarificationDecision {
  const needsClarification =
    typeof candidate.needsClarification === 'boolean' ? candidate.needsClarification : fallback.needsClarification;
  const missingDimensions = sanitizeClarificationDimensions(candidate.missingDimensions);
  const candidateOptions = sanitizeStringList(candidate.candidateOptions, 4);
  const clarificationQuestion = sanitizeText(candidate.clarificationQuestion, fallback.clarificationQuestion ?? '');

  return {
    needsClarification,
    reason: sanitizeText(candidate.reason, fallback.reason),
    missingDimensions: missingDimensions.length > 0 ? missingDimensions : fallback.missingDimensions,
    clarificationQuestion: needsClarification ? clarificationQuestion || fallback.clarificationQuestion : undefined,
    candidateOptions: candidateOptions.length > 0 ? candidateOptions : fallback.candidateOptions,
  };
}

function buildClarificationPrompt(params: {
  recentMessages: ChatMessage[];
  question: string;
  normalizedQuery: string;
  mode: PromptMode;
  questionArchetype: string;
  retrievalMode: RetrievalMode;
  workflowEvents: string[];
  serviceScopeClarification: ServiceScopeClarification;
}): string {
  const conversation = params.recentMessages.map((message) => `${message.role}: ${message.text}`).join('\n');

  return [
    'Conversation:',
    conversation || '(none)',
    '',
    `Current question: ${params.question}`,
    `Normalized query: ${params.normalizedQuery}`,
    `Mode: ${params.mode}`,
    `Question archetype: ${params.questionArchetype}`,
    `Retrieval mode: ${params.retrievalMode}`,
    params.workflowEvents.length > 0 ? `Workflow events: ${params.workflowEvents.join(', ')}` : 'Workflow events: none',
    '',
    'Heuristic service-scope signal:',
    JSON.stringify(params.serviceScopeClarification, null, 2),
    '',
    'Decide whether exactly one clarifying question is required before answering.',
    'Set needsClarification=true only when answering now would likely choose the wrong rule, workflow, comparison target, document target, time reference, actor scope, or subject.',
    'Default to false when the question can be answered safely with conditional guidance or when recent conversation already resolves the ambiguity.',
    'Do not ask the user to choose between legal/evaluation/practical basis because the system always covers all three.',
    'If clarification is needed, return one short Korean question and optional candidate options.',
    'If clarification is not needed, leave clarificationQuestion empty and candidateOptions empty.',
  ].join('\n');
}

export async function detectClarificationNeed(params: {
  ai: GoogleGenAI;
  model: string;
  recentMessages: ChatMessage[];
  question: string;
  normalizedQuery: string;
  mode: PromptMode;
  questionArchetype: string;
  retrievalMode: RetrievalMode;
  workflowEvents: string[];
  serviceScopeClarification: ServiceScopeClarification;
}): Promise<ClarificationDecision> {
  const serviceScopeFallback: ClarificationDecision = params.serviceScopeClarification.needsClarification
    ? {
        needsClarification: true,
        reason: '적용 급여 유형이 둘 이상으로 읽혀 먼저 확인하지 않으면 잘못된 기준으로 답할 가능성이 큽니다.',
        missingDimensions: ['service_scope'],
        clarificationQuestion: params.serviceScopeClarification.clarificationQuestion,
        candidateOptions: params.serviceScopeClarification.candidateScopes.map((scope) => scope.label).slice(0, 3),
      }
    : {
        needsClarification: false,
        reason: '',
        missingDimensions: [],
        clarificationQuestion: undefined,
        candidateOptions: [],
      };

  if (serviceScopeFallback.needsClarification) {
    return serviceScopeFallback;
  }

  if (!params.question.trim()) {
    return serviceScopeFallback;
  }

  try {
    const response = await params.ai.models.generateContent({
      model: params.model,
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: buildClarificationPrompt(params),
            },
          ],
        },
      ],
      config: {
        temperature: 0,
        responseMimeType: 'application/json',
        responseJsonSchema: buildClarificationSchema(),
      },
    });

    const parsed = JSON.parse(response.text || '{}') as Partial<ClarificationDecision>;
    return normalizeClarificationDecision(parsed, serviceScopeFallback);
  } catch {
    return serviceScopeFallback;
  }
}

export async function generateAnswerPlan(params: {
  ai: GoogleGenAI;
  model: string;
  brain: DomainBrain;
  mode: PromptMode;
  variant: PromptVariant;
  sources: PromptSourceSet;
  question: string;
  retrievalMode: RetrievalMode;
  questionArchetype: string;
  recommendedAnswerType: ExpertAnswerType;
  workflowEventIds: string[];
  workflowBriefs: WorkflowBrief[];
  evidence: StructuredChunk[];
  knowledgeContext: string;
}): Promise<AnswerPlan> {
  const fallback = buildHeuristicAnswerPlan({
    brain: params.brain,
    question: params.question,
    mode: params.mode,
    retrievalMode: params.retrievalMode,
    questionArchetype: params.questionArchetype,
    recommendedAnswerType: params.recommendedAnswerType,
    workflowEventIds: params.workflowEventIds,
    evidence: params.evidence,
  });

  if (params.evidence.length === 0) {
    return fallback;
  }

  const allowedEvidenceIds = new Set(params.evidence.map((item) => item.id));
  const allowedWorkflowEvents = new Set(params.brain.workflowEvents.map((item) => item.id));
  const systemInstruction = buildPlannerSystemInstruction({
    mode: params.mode,
    variant: params.variant,
    knowledgeContext: params.knowledgeContext,
    sources: params.sources,
    retrievalMode: params.retrievalMode,
    extraInstructions: [
      'Return a compact JSON planning object only.',
      'For workflowEvents use only known workflow event ids.',
      'For selectedEvidenceIds use only the evidence ids provided in the user payload.',
    ],
  });

  try {
    const response = await params.ai.models.generateContent({
      model: params.model,
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: buildPlanPrompt({
                question: params.question,
                retrievalMode: params.retrievalMode,
                workflowEventLabels: summarizeWorkflowEvents(params.brain, params.workflowEventIds),
                evidence: params.evidence,
                briefs: params.workflowBriefs,
                heuristicPlan: fallback,
              }),
            },
          ],
        },
      ],
      config: {
        systemInstruction,
        temperature: 0,
        responseMimeType: 'application/json',
        responseJsonSchema: buildPlanSchema(),
      },
    });

    const parsed = JSON.parse(response.text || '{}') as Partial<AnswerPlan>;
    return normalizePlan(parsed, fallback, allowedEvidenceIds, allowedWorkflowEvents);
  } catch {
    return fallback;
  }
}

function buildAnswerSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    required: [
      'answerType',
      'headline',
      'summary',
      'confidence',
      'evidenceState',
      'scope',
      'basis',
      'blocks',
      'citations',
      'followUps',
    ],
    properties: {
      answerType: {
        type: 'string',
        enum: ['verdict', 'checklist', 'procedure', 'comparison', 'definition', 'mixed'],
      },
      headline: { type: 'string' },
      summary: { type: 'string' },
      confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
      evidenceState: { type: 'string', enum: ['confirmed', 'partial', 'conflict', 'not_enough'] },
      keyIssueDate: { type: 'string' },
      scope: { type: 'string' },
      basis: {
        type: 'object',
        additionalProperties: false,
        required: ['legal', 'evaluation', 'practical'],
        properties: {
          legal: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['label', 'summary', 'citationIds'],
              properties: {
                label: { type: 'string' },
                summary: { type: 'string' },
                citationIds: { type: 'array', items: { type: 'string' } },
              },
            },
          },
          evaluation: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['label', 'summary', 'citationIds'],
              properties: {
                label: { type: 'string' },
                summary: { type: 'string' },
                citationIds: { type: 'array', items: { type: 'string' } },
              },
            },
          },
          practical: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['label', 'summary', 'citationIds'],
              properties: {
                label: { type: 'string' },
                summary: { type: 'string' },
                citationIds: { type: 'array', items: { type: 'string' } },
              },
            },
          },
        },
      },
      blocks: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['type', 'title', 'items'],
          properties: {
            type: {
              type: 'string',
              enum: ['checklist', 'steps', 'comparison', 'bullets', 'warning', 'definition', 'followup'],
            },
            title: { type: 'string' },
            intro: { type: 'string' },
            items: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['label', 'detail'],
                properties: {
                  label: { type: 'string' },
                  detail: { type: 'string' },
                  actor: { type: 'string' },
                  timeWindow: { type: 'string' },
                  artifact: { type: 'string' },
                  basis: { type: 'string', enum: ['legal', 'evaluation', 'practical'] },
                  citationIds: { type: 'array', items: { type: 'string' } },
                  side: { type: 'string' },
                  term: { type: 'string' },
                },
              },
            },
          },
        },
      },
      citations: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['evidenceId', 'label', 'docTitle', 'sectionPath'],
          properties: {
            evidenceId: { type: 'string' },
            label: { type: 'string' },
            docTitle: { type: 'string' },
            articleNo: { type: 'string' },
            sectionPath: { type: 'array', items: { type: 'string' } },
            effectiveDate: { type: 'string' },
            whyItMatters: { type: 'string' },
          },
        },
      },
      followUps: { type: 'array', items: { type: 'string' } },
    },
  };
}

function buildFallbackBlocks(plan: AnswerPlan, citations: StructuredChunk[]): ExpertAnswerBlock[] {
  if (plan.recommendedAnswerType === 'checklist') {
    return [
      {
        type: 'checklist',
        title: '핵심 업무 체크리스트',
        items: plan.taskCandidates.slice(0, 6).map((task) => ({
          label: task.title,
          detail: task.note,
          actor: task.actor,
          timeWindow: task.timeWindow,
          artifact: task.artifact,
          basis: task.basis,
          citationIds: plan.selectedEvidenceIds,
        })),
      },
    ];
  }

  if (plan.recommendedAnswerType === 'procedure') {
    return [
      {
        type: 'steps',
        title: '권장 진행 순서',
        items: plan.taskCandidates.slice(0, 6).map((task) => ({
          label: task.title,
          detail: task.note,
          actor: task.actor,
          timeWindow: task.timeWindow,
          artifact: task.artifact,
          basis: task.basis,
          citationIds: plan.selectedEvidenceIds,
        })),
      },
    ];
  }

  if (plan.recommendedAnswerType === 'comparison') {
    return [
      {
        type: 'comparison',
        title: '기준별 비교',
        items: [
          {
            label: '법적 기준',
            detail: plan.basisBuckets.legal.join(' / ') || '직접 근거가 약합니다.',
            basis: 'legal',
            citationIds: plan.selectedEvidenceIds,
          },
          {
            label: '평가 기준',
            detail: plan.basisBuckets.evaluation.join(' / ') || '직접 근거가 약합니다.',
            basis: 'evaluation',
            citationIds: plan.selectedEvidenceIds,
          },
          {
            label: '실무 운영',
            detail: plan.basisBuckets.practical.join(' / ') || '직접 근거가 약합니다.',
            basis: 'practical',
            citationIds: plan.selectedEvidenceIds,
          },
        ],
      },
    ];
  }

  if (plan.recommendedAnswerType === 'definition') {
    return [
      {
        type: 'definition',
        title: '핵심 개념',
        items: [
          {
            label: '정의',
            detail: plan.intentSummary,
            citationIds: plan.selectedEvidenceIds,
          },
        ],
      },
    ];
  }

  return [
    {
      type: 'bullets',
      title: '핵심 정리',
      items: citations.slice(0, 4).map((citation) => ({
        label: citation.docTitle,
        detail: citation.textPreview,
        citationIds: [citation.id],
      })),
    },
  ];
}

function buildFallbackAnswer(params: {
  question: string;
  plan: AnswerPlan;
  evidenceState: EvidenceState;
  confidence: ConfidenceLevel;
  keyIssueDate?: string;
  citations: StructuredChunk[];
}): ExpertAnswerEnvelope {
  const citations = buildExpertCitations(params.citations);
  return {
    answerType: params.plan.recommendedAnswerType,
    headline: params.question.length > 36 ? `${params.question.slice(0, 35)}...` : params.question,
    summary:
      params.plan.taskCandidates.length > 0
        ? `질문과 직접 연결되는 업무·판단 포인트를 ${params.plan.taskCandidates.length}개 기준으로 묶었습니다.`
        : '검색된 근거를 기준으로 바로 적용할 수 있는 판단 포인트를 우선 정리했습니다.',
    confidence: params.confidence,
    evidenceState: params.evidenceState,
    keyIssueDate: params.keyIssueDate,
    scope: params.plan.intentSummary,
    basis: toBasisEntriesFromEvidence(params.citations),
    blocks: buildFallbackBlocks(params.plan, params.citations),
    citations,
    followUps: params.plan.missingDimensions.map((dimension) => `추가 확인 필요: ${dimension}`),
  };
}

function normalizeBasisEntries(
  value: unknown,
  fallback: ExpertAnswerEnvelope['basis'],
  allowedCitationIds: Set<string>,
): ExpertAnswerEnvelope['basis'] {
  const normalizeBucket = (entries: unknown, fallbackEntries: ExpertAnswerEnvelope['basis'][BasisBucketKey]) => {
    if (!Array.isArray(entries)) return fallbackEntries;
    const normalized = entries
      .map((entry) => {
        if (!entry || typeof entry !== 'object') return null;
        const item = entry as Partial<ExpertAnswerEnvelope['basis'][BasisBucketKey][number]>;
        const label = sanitizeText(item.label);
        const summary = sanitizeText(item.summary);
        const citationIds = sanitizeCitationIds(item.citationIds, allowedCitationIds, 6);
        if (!label || !summary) return null;
        return {
          label,
          summary,
          citationIds,
        };
      })
      .filter((entry): entry is ExpertAnswerEnvelope['basis'][BasisBucketKey][number] => Boolean(entry))
      .slice(0, 6);
    return normalized.length > 0 ? normalized : fallbackEntries;
  };

  const input = value as Partial<ExpertAnswerEnvelope['basis']> | undefined;
  return {
    legal: normalizeBucket(input?.legal, fallback.legal),
    evaluation: normalizeBucket(input?.evaluation, fallback.evaluation),
    practical: normalizeBucket(input?.practical, fallback.practical),
  };
}

function normalizeBlocks(
  value: unknown,
  fallback: ExpertAnswerBlock[],
  allowedCitationIds: Set<string>,
): ExpertAnswerBlock[] {
  if (!Array.isArray(value)) return fallback;
  const normalized = value
    .map((block) => {
      if (!block || typeof block !== 'object') return null;
      const candidate = block as Partial<ExpertAnswerBlock>;
      const type = candidate.type;
      if (
        type !== 'checklist' &&
        type !== 'steps' &&
        type !== 'comparison' &&
        type !== 'bullets' &&
        type !== 'warning' &&
        type !== 'definition' &&
        type !== 'followup'
      ) {
        return null;
      }

      const title = sanitizeText(candidate.title);
      const items = Array.isArray(candidate.items)
        ? (candidate.items
            .map((item) => {
              if (!item || typeof item !== 'object') return null;
              const entry = item as Partial<ExpertAnswerBlock['items'][number]>;
              const label = sanitizeText(entry.label);
              const detail = sanitizeText(entry.detail);
              if (!label || !detail) return null;
              const basis =
                entry.basis === 'legal' || entry.basis === 'evaluation' || entry.basis === 'practical'
                  ? entry.basis
                  : undefined;
              return {
                label,
                detail,
                actor: sanitizeText(entry.actor) || undefined,
                timeWindow: sanitizeText(entry.timeWindow) || undefined,
                artifact: sanitizeText(entry.artifact) || undefined,
                basis,
                citationIds: sanitizeCitationIds(entry.citationIds, allowedCitationIds, 6),
                side: sanitizeText(entry.side) || undefined,
                term: sanitizeText(entry.term) || undefined,
              };
            })
            .filter(Boolean) as ExpertAnswerBlock['items'])
        : [];

      const slicedItems = items.slice(0, 10);
      if (!title || slicedItems.length === 0) return null;
      return {
        type,
        title,
        intro: sanitizeText(candidate.intro) || undefined,
        items: slicedItems,
      };
    })
    .filter(Boolean) as ExpertAnswerBlock[];

  return normalized.slice(0, 6).length > 0 ? normalized.slice(0, 6) : fallback;
}

function normalizeCitations(
  value: unknown,
  fallback: ExpertAnswerCitation[],
  allowedCitationIds: Set<string>,
): ExpertAnswerCitation[] {
  if (!Array.isArray(value)) return fallback;
  const normalized = value
    .map((citation) => {
      if (!citation || typeof citation !== 'object') return null;
      const entry = citation as Partial<ExpertAnswerCitation>;
      const evidenceId = sanitizeText(entry.evidenceId);
      if (!evidenceId || !allowedCitationIds.has(evidenceId)) return null;
      const label = sanitizeText(entry.label);
      const docTitle = sanitizeText(entry.docTitle);
      if (!label || !docTitle) return null;
      return {
        evidenceId,
        label,
        docTitle,
        articleNo: sanitizeText(entry.articleNo) || undefined,
        sectionPath: Array.isArray(entry.sectionPath)
          ? entry.sectionPath.map((item) => sanitizeText(item)).filter(Boolean).slice(0, 6)
          : [],
        effectiveDate: sanitizeText(entry.effectiveDate) || undefined,
        whyItMatters: sanitizeText(entry.whyItMatters) || undefined,
      };
    })
    .filter(Boolean);
  const narrowed = normalized as ExpertAnswerCitation[];
  return narrowed.slice(0, 8).length > 0 ? narrowed.slice(0, 8) : fallback;
}

function normalizeExpertAnswer(
  candidate: Partial<ExpertAnswerEnvelope>,
  fallback: ExpertAnswerEnvelope,
  allowedCitationIds: Set<string>,
): ExpertAnswerEnvelope {
  return {
    answerType:
      candidate.answerType === 'verdict' ||
      candidate.answerType === 'checklist' ||
      candidate.answerType === 'procedure' ||
      candidate.answerType === 'comparison' ||
      candidate.answerType === 'definition' ||
      candidate.answerType === 'mixed'
        ? candidate.answerType
        : fallback.answerType,
    headline: sanitizeText(candidate.headline, fallback.headline),
    summary: sanitizeText(candidate.summary, fallback.summary),
    confidence:
      candidate.confidence === 'high' || candidate.confidence === 'medium' || candidate.confidence === 'low'
        ? candidate.confidence
        : fallback.confidence,
    evidenceState:
      candidate.evidenceState === 'confirmed' ||
      candidate.evidenceState === 'partial' ||
      candidate.evidenceState === 'conflict' ||
      candidate.evidenceState === 'not_enough'
        ? candidate.evidenceState
        : fallback.evidenceState,
    keyIssueDate: sanitizeText(candidate.keyIssueDate) || fallback.keyIssueDate,
    scope: sanitizeText(candidate.scope, fallback.scope),
    basis: normalizeBasisEntries(candidate.basis, fallback.basis, allowedCitationIds),
    blocks: normalizeBlocks(candidate.blocks, fallback.blocks, allowedCitationIds),
    citations: normalizeCitations(candidate.citations, fallback.citations, allowedCitationIds),
    followUps: sanitizeStringList(candidate.followUps, 6),
  };
}

function buildSynthesisPrompt(params: {
  question: string;
  plan: AnswerPlan;
  claimPlan?: ClaimPlan;
  semanticFrame?: SemanticFrame;
  evidenceState: EvidenceState;
  confidence: ConfidenceLevel;
  keyIssueDate?: string;
  workflowEventLabels: string[];
}): string {
  return [
    'Question:',
    params.question,
    '',
    'Planner output:',
    JSON.stringify(params.plan, null, 2),
    '',
    'Claim plan:',
    JSON.stringify(params.claimPlan ?? { claims: [] }, null, 2),
    '',
    'Semantic frame:',
    JSON.stringify(params.semanticFrame ?? {}, null, 2),
    '',
    `Evidence state: ${params.evidenceState}`,
    `Confidence: ${params.confidence}`,
    params.keyIssueDate ? `Key issue date: ${params.keyIssueDate}` : 'Key issue date: unknown',
    params.workflowEventLabels.length > 0 ? `Workflow events: ${params.workflowEventLabels.join(', ')}` : 'Workflow events: none',
    '',
    'Build the most useful expert answer for an LTC operations assistant. The answer should be practical, grounded, and directly usable.',
  ].join('\n');
}

export async function synthesizeExpertAnswer(params: {
  ai: GoogleGenAI;
  model: string;
  mode: PromptMode;
  variant: PromptVariant;
  sources: PromptSourceSet;
  question: string;
  brain: DomainBrain;
  plan: AnswerPlan;
  evidence: StructuredChunk[];
  knowledgeContext: string;
  retrievalMode: RetrievalMode;
  evidenceState: EvidenceState;
  confidence: ConfidenceLevel;
  keyIssueDate?: string;
  claimPlan?: ClaimPlan;
  semanticFrame?: SemanticFrame;
}): Promise<ExpertAnswerEnvelope> {
  const selectedEvidence = params.evidence.filter((item) => params.plan.selectedEvidenceIds.includes(item.id));
  const citations = selectedEvidence.length > 0 ? selectedEvidence : params.evidence.slice(0, 6);
  const fallback = buildFallbackAnswer({
    question: params.question,
    plan: params.plan,
    evidenceState: params.evidenceState,
    confidence: params.confidence,
    keyIssueDate: params.keyIssueDate,
    citations,
  });
  const allowedCitationIds = new Set(citations.map((item) => item.id));

  if (citations.length === 0) {
    return fallback;
  }

  const systemInstruction = buildSynthesizerSystemInstruction({
    mode: params.mode,
    variant: params.variant,
    knowledgeContext: params.knowledgeContext,
    sources: params.sources,
    retrievalMode: params.retrievalMode,
    extraInstructions: [
      'Return semantic JSON only.',
      'Do not emit presentation markdown, HTML, or numbered headings.',
      'Prefer checklist or procedure blocks for broad operational questions.',
      'Citations and basis entries must use only the provided evidence ids.',
      'If the semantic frame contains assumptions, reflect them conservatively in scope or caveat-like wording.',
    ],
  });

  try {
    const response = await params.ai.models.generateContent({
      model: params.model,
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: buildSynthesisPrompt({
                question: params.question,
                plan: params.plan,
                claimPlan: params.claimPlan,
                semanticFrame: params.semanticFrame,
                evidenceState: params.evidenceState,
                confidence: params.confidence,
                keyIssueDate: params.keyIssueDate,
                workflowEventLabels: summarizeWorkflowEvents(params.brain, params.plan.workflowEvents),
              }),
            },
          ],
        },
      ],
      config: {
        systemInstruction,
        temperature: 0.1,
        responseMimeType: 'application/json',
        responseJsonSchema: buildAnswerSchema(),
      },
    });

    const parsed = JSON.parse(response.text || '{}') as Partial<ExpertAnswerEnvelope>;
    return normalizeExpertAnswer(parsed, fallback, allowedCitationIds);
  } catch {
    return fallback;
  }
}

export function createExpertAbstainAnswer(params: {
  question: string;
  confidence: ConfidenceLevel;
  evidenceState: EvidenceState;
  keyIssueDate?: string;
  evidence: StructuredChunk[];
}): ExpertAnswerEnvelope {
  const citations = buildExpertCitations(params.evidence.slice(0, 4));
  const basis = toBasisEntriesFromEvidence(params.evidence.slice(0, 4));
  return {
    answerType: 'mixed',
    headline: params.question.length > 36 ? `${params.question.slice(0, 35)}...` : params.question,
    summary: '검색된 근거만으로 질문에 직접 대응하는 전문가형 결론을 안전하게 확정하기 어려운 상태입니다.',
    confidence: params.confidence,
    evidenceState: params.evidenceState,
    keyIssueDate: params.keyIssueDate,
    scope: '질문과 직접 연결되는 근거 범위를 다시 좁혀야 합니다.',
    basis,
    blocks: [
      {
        type: 'warning',
        title: '현재 부족한 점',
        items: [
          {
            label: '직접 근거 부족',
            detail: '검색된 문맥 안에서 질문의 핵심 판단을 바로 확정할 조문·지표·실무 근거가 충분히 연결되지 않았습니다.',
            citationIds: citations.map((item) => item.evidenceId),
          },
        ],
      },
      {
        type: 'followup',
        title: '다음 확인이 있으면 좋아집니다',
        items: [
          { label: '기관 유형', detail: '시설, 재가, 주야간보호 등 적용 범위를 좁혀주세요.' },
          { label: '기준 시점', detail: '평가 기준인지, 현재 시행 중 법령인지 알려주면 근거가 더 정확해집니다.' },
        ],
      },
    ],
    citations,
    followUps: ['기관 유형 또는 기준 시점을 알려주면 근거를 다시 좁혀보겠습니다.'],
  };
}

function describeClarificationDimension(dimension: ClarificationDimension): string {
  switch (dimension) {
    case 'service_scope':
      return '급여 유형';
    case 'comparison_target':
      return '비교 대상';
    case 'document_reference':
      return '대상 문서나 항목';
    case 'time_reference':
      return '기준 시점';
    case 'actor_scope':
      return '적용 대상 또는 수행 주체';
    case 'workflow_stage':
      return '업무 단계';
    case 'target_subject':
      return '질문이 가리키는 대상';
  }
}

export function createExpertClarificationAnswer(params: {
  question: string;
  decision: ClarificationDecision;
  serviceScopeClarification?: ServiceScopeClarification;
}): ExpertAnswerEnvelope {
  const serviceScopeCandidates = params.serviceScopeClarification?.candidateScopes.slice(0, 2) ?? [];
  const optionItems =
    serviceScopeCandidates.length > 0
      ? serviceScopeCandidates.map((candidate) => ({
          label: candidate.label,
          detail:
            candidate.explicitHits.length > 0 || candidate.contextualHits.length > 0
              ? `질문에 ${[...candidate.explicitHits, ...candidate.contextualHits].slice(0, 4).join(', ')} 신호가 보여 이 가능성을 함께 보고 있습니다.`
              : '현재 질문만으로는 이 가능성을 배제하기 어렵습니다.',
        }))
      : params.decision.candidateOptions.slice(0, 3).map((option) => ({
          label: option,
          detail: `${option} 기준으로 확인되면 그 기준에 맞춰 바로 답변하겠습니다.`,
        }));

  const followUpQuestion =
    params.decision.clarificationQuestion ??
    '정확한 답변을 위해 적용 기준을 한 가지만 더 알려주세요.';
  const missingDimensionLabels = uniqueStrings(params.decision.missingDimensions.map(describeClarificationDimension));

  return {
    answerType: 'mixed',
    headline: '먼저 한 가지만 확인할게요',
    summary:
      params.decision.reason || '현재 질문은 해석이 둘 이상 가능해 바로 답하면 잘못된 기준을 적용할 수 있습니다.',
    confidence: 'low',
    evidenceState: 'not_enough',
    scope: '핵심 기준이 확인되면 같은 질문이라도 적용 조문, 평가 포인트, 실무 안내가 달라질 수 있습니다.',
    basis: {
      legal: [],
      evaluation: [],
      practical: [],
    },
    blocks: [
      {
        type: 'warning',
        title: '왜 확인이 필요한지',
        items: [
          {
            label: '오답 위험 방지',
            detail:
              params.decision.reason || '현재 정보만으로는 서로 다른 기준 중 하나를 임의로 선택하게 되어 답변 정확도가 떨어질 수 있습니다.',
          },
          {
            label: '추가로 필요한 축',
            detail:
              missingDimensionLabels.length > 0
                ? `${missingDimensionLabels.join(', ')} 정보가 확인되면 바로 정확한 기준으로 정리할 수 있습니다.`
                : '질문의 적용 범위를 한 번만 더 확인하면 정확한 답변으로 바로 이어질 수 있습니다.',
          },
        ],
      },
      {
        type: 'followup',
        title: '확인 질문',
        intro: '한 번만 확인되면 그 기준으로 바로 정리해드릴 수 있습니다.',
        items:
          optionItems.length > 0
            ? optionItems
            : [
                {
                  label: '추가 확인',
                  detail: followUpQuestion,
                },
              ],
      },
    ],
    citations: [],
    followUps: [followUpQuestion],
  };
}

function renderBasisBucket(title: string, entries: ExpertAnswerEnvelope['basis'][BasisBucketKey]): string {
  if (entries.length === 0) return `### ${title}\n- 직접 연결된 근거가 충분하지 않습니다.`;
  return `### ${title}\n${entries.map((entry) => `- ${entry.label}: ${entry.summary}`).join('\n')}`;
}

function renderBlock(block: ExpertAnswerBlock): string {
  const intro = block.intro ? `${block.intro}\n` : '';
  return `## ${block.title}\n${intro}${block.items.map((item) => `- ${item.label}: ${item.detail}`).join('\n')}`;
}

export function renderExpertAnswerMarkdown(answer: ExpertAnswerEnvelope): string {
  return [
    `# ${answer.headline}`,
    '',
    `${answer.summary}`,
    '',
    `- 답변 유형: ${answer.answerType}`,
    `- 근거 상태: ${formatEvidenceStateLabel(answer.evidenceState)}`,
    `- 신뢰도: ${answer.confidence}`,
    answer.keyIssueDate ? `- 기준 시점: ${answer.keyIssueDate}` : null,
    answer.scope ? `- 적용 범위: ${answer.scope}` : null,
    '',
    renderBasisBucket('법적 근거', answer.basis.legal),
    '',
    renderBasisBucket('평가 근거', answer.basis.evaluation),
    '',
    renderBasisBucket('실무 근거', answer.basis.practical),
    '',
    ...answer.blocks.map(renderBlock),
    '',
    '## 출처',
    ...answer.citations.map((citation) => `- ${citation.label}`),
    answer.followUps.length > 0 ? `\n## 추가 확인\n${answer.followUps.map((item) => `- ${item}`).join('\n')}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

export function buildExpertKnowledgeContext(params: {
  evidence: StructuredChunk[];
  workflowBriefs: WorkflowBrief[];
}): string {
  return [
    chunksToEvidenceContext(params.evidence),
    params.workflowBriefs.length > 0 ? JSON.stringify(params.workflowBriefs, null, 2) : '',
  ]
    .filter(Boolean)
    .join('\n\n---\n\n');
}
