# LTC Assistant 2차 개선·고도화 Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** 브리프에 명시된 3가지 문제(구조화된 필수 항목 누락 — 8대 지침은 대표 예시, 응답 속도, 온톨로지 구조 미흡)를 근본 원인부터 보완하여 장기요양 평가형 질의의 정답성, 응답시간, 회귀 검증력을 동시에 개선한다.

**Architecture:** 현재 파이프라인은 `knowledge/` Markdown → `scripts/rag-index.ts` → `src/lib/ragStructured.ts`/`nodeRagService.ts` → `src/lib/ragEngine.ts` 검색 → `expertAnswering.ts` 생성 → `answerMarkdown.ts` 표시 구조다. 2차 개선은 (1) 노인인권보호/8대 지침을 “예시 케이스”로 삼아 모든 평가형 checklist·기한·대상·증빙·불인정 조건의 누락을 방지하는 일반화된 구조를 만들고, (2) 평가형 enumeration/compliance 질의에 대한 deterministic retrieval boost와 answer guard를 추가하며, (3) 온톨로지를 단순 alias 그래프에서 “평가지표-요건-대상-기한-체크리스트-근거문서” 구조로 확장하는 방식으로 진행한다.

**Tech Stack:** TypeScript, Node/tsx, React, Express, local RAG cache/Postgres pgvector, Gemini embedding/generation, JSON ontology manifests, Markdown knowledge base.

---

## 0. 실제 확인한 현재 상태 요약

### 0.1 읽은 핵심 파일

- 브리프: `docs/plans/2026-05-07-ltc-assistant-2nd-improvement-plan-brief.md`
- 지식 원문: `knowledge/evaluation/02-05-노인인권보호.md`
- 온톨로지 코드: `src/lib/ragOntology.ts`
- RAG 타입: `src/lib/ragTypes.ts`
- RAG 서비스/검색 orchestration: `src/lib/nodeRagService.ts`
- RAG store: `src/lib/ragStore.ts`
- 답변 생성: `src/lib/expertAnswering.ts`
- 답변 Markdown: `src/lib/answerMarkdown.ts`
- 인덱싱 스크립트: `scripts/rag-index.ts`
- 품질/벤치마크: `.rag-cache/rag-quality-report.json`, `.rag-cache/rag-index.json`, `benchmarks/golden-cases.json`
- 온톨로지 manifest: `knowledge/ontology/curated.json`, `knowledge/ontology/rules.json`, `knowledge/ontology/lexicon.json`
- 스크립트 목록: `package.json`

### 0.2 확인된 지표와 증거

- `.rag-cache/rag-index.json`
  - 크기: 약 172MB
  - documents: 144
  - sections: 10,483
  - chunks: 13,799
  - ontology: top-level dict 3개
- `.rag-cache/rag-quality-report.json`
  - `generatedAt`: `2026-05-06T14:46:23.940Z`
  - `summary.embeddingCount`: 0
  - `summary.embeddingCoverageRatio`: 0
  - 모든 문서가 사실상 zero embedding 상태
- `knowledge/evaluation/02-05-노인인권보호.md`
  - `평가기준` chunk에 “모든 수급자(보호자)에게 8가지 지침을 연 1회 이상 설명” 및 “신규수급자는 급여제공 시작일부터 토요일, 공휴일 포함 14일 이내” 근거 존재
  - `확인방법` chunk에 8가지 지침 목록 존재: 욕창예방, 낙상예방, 탈수예방, 배변도움, 관절구축예방, 치매예방, 감염예방, 노인인권보호
- `.rag-cache/rag-index.json` 안 핵심 chunk
  - `3cf7a3890181ff42c94e9aa8479e22ec857b5980` — `02-05-노인인권보호 / 평가기준`, `embedding: false`
  - `1731edf94e870e107d4a58d28734e985887fb8f4` — `02-05-노인인권보호 / 확인방법`, `embedding: false`
- `benchmarks/golden-cases.json`
  - 총 27개 case
  - “신규수급자 14일”, “8가지/8대 지침”, “노인인권보호”, “욕창/낙상/탈수/배변/관절구축/치매/감염” 관련 golden case 없음
- `package.json`
  - 검증 명령: `npm run lint`, `npm run rag:index`, `npm run rag:bench`, `npm run rag:test`, `npm run rag:quality-report`, `npm run rag:baseline`
- git 상태
  - branch: `codex/rag-optimization-mainline`
  - 작업트리에 이미 다수 파일 변경 존재. 본 계획 구현 시 사용자 변경과 충돌하지 않도록 반드시 `git status --short` 후 대상 파일만 제한 수정해야 함.

---

## 1. 문제 1 — 구조화된 필수 항목 누락 근본 원인 분석

### 1.1 증상

브리프의 “8대 지침 누락”은 대표 예시다. 실제 위험은 평가문서 안의 구조화된 필수 요소가 답변에서 부분 누락되는 전체 범주다. 사용자가 “신규수급자에게 설명해야 하는 8대 지침/8가지 지침”, “14일 이내 안내”, “노인인권보호 지침 포함 여부”를 물을 때 답변이 8개 항목 전체 또는 신규수급자 기한을 누락할 수 있는 것처럼, 다른 평가지표에서도 다음 요소가 누락될 수 있다.

- 평가기준의 복수 bullet/checklist 항목
- 확인방법의 대상·증빙·확인 시점
- 필수 기록 필드
- 교육/점검/설명 주기
- 신규/변경/예외 상황의 기한
- 불인정(N), 감점, 예외 조건

따라서 본 계획은 8대 지침을 seed case로 사용하되, 최종 구현 목표는 일반적인 `EvaluationRequirementCompleteness` 문제 해결이다.

8대 지침 seed case에서 정답으로 고정해야 하는 내용:

1. 모든 수급자(보호자)에게 8가지 지침을 연 1회 이상 설명한다.
2. 신규수급자는 급여제공 시작일부터 토요일·공휴일 포함 14일 이내 실시 여부를 확인한다.
3. 8가지 지침은 다음 전체 목록이다.
   - 욕창예방
   - 낙상예방
   - 탈수예방
   - 배변도움
   - 관절구축예방
   - 치매예방
   - 감염예방
   - 노인인권보호
4. 평가 당일 장기요양 급여계약을 유지하고 있는 모든 수급자(보호자)에 대해 기록으로 확인하며, 평가 당일 기록이 없으면 불인정(N)이다.

### 1.2 직접 원인

1. 지식 문서는 존재하나 회귀 테스트가 없다.
   - `knowledge/evaluation/02-05-노인인권보호.md`에는 정답 근거가 있다.
   - 그러나 `benchmarks/golden-cases.json`에 해당 질의군이 없어 검색/생성 변경 시 누락을 자동 감지하지 못한다.

2. enumeration intent guard가 약하다.
   - `src/lib/expertAnswering.ts`의 `buildEnumerationCoverageInstructions()`는 evidence의 `parentSectionTitle/title/docTitle` 기준 indicator를 제시한다.
   - 하지만 8대 지침처럼 “한 chunk 내부의 목록 항목 8개”를 반드시 모두 출력해야 하는 경우, 현재 로직은 chunk 제목 수준만 강제하고 항목 단위 coverage를 보장하지 않는다.

3. semantic frame/ontology가 8대 지침을 구조화하지 못한다.
   - `src/lib/ragTypes.ts`의 `SemanticSlotKey`는 `service_scope`, `institution_type`, `actor_role`, `time_scope` 등 범용 슬롯만 있다.
   - “평가지표 19 노인인권보호 → 수급자 지침 설명 → 신규수급자 → 14일 이내 → 8개 checklist item”을 표현할 `evaluation_indicator`, `compliance_requirement`, `checklist_item`, `deadline` 같은 도메인 구조가 없다.

4. embedding 기반 보강이 사실상 꺼져 있다.
   - 품질 리포트 기준 `embeddingCount=0`, `embeddingCoverageRatio=0`.
   - 핵심 chunk 2개 모두 `embedding: false`다.
   - 현 상태에서는 `src/lib/ragStore.ts`/`nodeRagService.ts`가 vector path를 갖고 있어도 실제 검색은 lexical 중심이 되며, “8대” vs “8가지”, “신규 입소/신규 수급자”, “안내/설명/교육” 같은 변형 질의 recall이 취약하다.

5. 평가형 authoritative source boost가 이 질의군에 특화되어 있지 않다.
   - `src/lib/nodeRagService.ts`의 `executeSearch()`는 section routing, ontology expansion, document score boosts를 적용한다.
   - 다만 `02-05-노인인권보호`를 “8대 지침/신규수급자 안내”의 canonical primary evidence로 고정하는 rule이 없다.

### 1.3 근본 원인

이 문제는 “문서가 없는 문제”가 아니라 “근거는 있으나 도메인 단위로 구조화·테스트·강제되지 않은 문제”다. 즉, RAG 시스템이 평가 매뉴얼의 체크리스트/기한/대상/불인정 조건을 일반 텍스트 chunk로만 취급하고 있어, 생성 모델이 일부 항목을 생략해도 회귀 게이트가 잡지 못한다.

---

## 2. 문제 2 — 응답 속도 근본 원인 분석

### 2.1 현재 응답 경로

`src/lib/nodeRagService.ts::generateChatResponse()` 주요 흐름:

1. `initialize()`
2. API key 확인 및 `GoogleGenAI` 생성
3. `this.store.ensureEmbeddings()` 호출 가능
4. `runRetrievalPlan()` 호출
5. retrieval diagnostics 생성
6. clarification 필요 여부 LLM 호출 가능: `detectClarificationNeed()`
7. `generateAnswerPlan()` LLM 호출
8. `buildClaimPlan()`
9. `synthesizeExpertAnswer()` LLM 호출
10. `validateAnswerEnvelope()`
11. `formatAnswerAsMarkdown()`
12. answer cache 저장

### 2.2 직접 원인

1. 기본 balanced profile이 비싼 query processing을 켠다.
   - `src/lib/ragProfiles.ts`
   - `balanced.queryProcessing`: `rewrite=true`, `clarify=true`, `hyde=true`, `decompose=true`
   - 짧고 명확한 평가형 질의에도 rewrite/hyde/decompose/clarify/answerPlan/synthesize가 누적될 수 있다.

2. `generateChatResponse()`가 streaming이 아닌 최종 응답 반환 구조다.
   - `GroundedChatResponse`를 완성한 뒤 반환한다.
   - 사용자 체감 latency는 retrieval+planner+synthesis 전체 완료시간에 종속된다.

3. answer planning과 synthesis가 분리되어 LLM 호출이 2회 이상이다.
   - `generateAnswerPlan()` timeout 20초
   - `synthesizeExpertAnswer()` timeout 75초
   - 평가형 단답/체크리스트 질의는 deterministic template로 처리 가능한 경우가 많다.

4. embedding readiness가 낮아 hybrid 효과 없이 lexical 후보를 많이 뒤진다.
   - `embeddingCount=0`이면 vector candidate가 없고 lexical/exact/rerank 부담이 커진다.

5. ontology expansion/diagnostics는 품질에는 필요하지만 사용자-facing fast path와 admin diagnostics path가 명확히 분리되어 있지 않다.
   - `inspectRetrieval()`은 diagnostics 용도이므로 상세 trace가 적절하다.
   - `generateChatResponse()`는 운영 path인데도 상당한 diagnostics를 만들고 저장한다.

### 2.3 근본 원인

현재 구조는 모든 질문을 “고정밀 multi-stage RAG + LLM plan + LLM synthesis”로 처리한다. 하지만 장기요양 평가 도메인은 많은 질의가 “정해진 평가기준/확인방법/체크리스트/기한”을 묻는 deterministic compliance 질의다. 이 유형을 fast path로 분기하지 않아 체감 속도가 느리고 비용도 크다.

---

## 3. 문제 3 — 온톨로지 구조 미흡 근본 원인 분석

### 3.1 현재 구조

- `src/lib/ragTypes.ts`
  - `OntologyRelationType`: `alias-of`, `requires`, `applies-to`, `belongs-to`, `uses-document`, `evidenced-by`, `follows-step` 등 범용 관계
  - `SemanticSlotKey`: `service_scope`, `institution_type`, `actor_role`, `time_scope` 등
- `src/lib/ragOntology.ts`
  - `GeneratedOntologyConcept`: `label`, `entity_type`, `aliases`, `slot_hints`, `relations`, `evidence`
  - `buildOntologyGraph()`, `expandDocumentsWithOntology()`, `searchOntologyGraph()` 형태의 graph expansion
- `knowledge/ontology/curated.json`, `lexicon.json`, `rules.json`
  - alias/용어 확장 중심

### 3.2 한계

1. 평가지표 단위가 entity로 충분히 표현되지 않는다.
   - 예: `02-05-노인인권보호`, `19. 노인인권보호`, `평가기준`, `확인방법`을 독립적이면서 연결된 entity로 표현해야 한다.

2. 요건(requirement)의 속성이 구조화되어 있지 않다.
   - 대상: 모든 수급자(보호자), 신규수급자
   - 행위: 설명/안내/기록 확인
   - 빈도: 연 1회 이상
   - 기한: 급여제공 시작일부터 토요일·공휴일 포함 14일 이내
   - 불인정 조건: 평가 당일 기록 미확인 시 N
   - 체크리스트 항목: 8개

3. relation vocabulary가 compliance 도메인에 부족하다.
   - 현재 `requires`/`applies-to`로는 `has-deadline`, `has-frequency`, `has-checklist-item`, `verified-by-record`, `noncompliant-if` 등을 명확히 표현하기 어렵다.

4. 자동 생성 후보는 suffix 기반이라 checklist item/기한/대상 추출에 약하다.
   - `ragOntology.ts::CONCEPT_CANDIDATE_SUFFIXES`는 “기준/절차/방법/교육/보호/관리/기록” 중심이다.
   - “욕창예방”, “낙상예방”, “14일 이내”, “연 1회” 같은 평가 체크리스트 원자 단위를 놓치기 쉽다.

### 3.3 근본 원인

온톨로지가 “검색 확장용 alias graph”에 머물러 있고, 평가 매뉴얼의 규정형 지식(대상-행위-기한-빈도-증빙-불인정-체크리스트)을 first-class schema로 다루지 않는다. 따라서 검색은 문서를 찾더라도 답변 생성 단계에서 어떤 필드를 반드시 출력해야 하는지 알 수 없다.

---

## 4. 개선 원칙

0. 8대 지침은 “단일 버그”가 아니라 “대표 샘플”로 취급
   - 본 계획의 `02-05-노인인권보호/8대 지침` 대응은 P0 재현·검증용 seed case다.
   - 최종 목표는 모든 평가형 구조 지식에서 발생할 수 있는 누락을 방지하는 것이다. 예: 교육 필수사항(교육일시·교육내용·교육방법·강사명·참석자명/서명), 반기별/연 1회 이상 빈도, 14일 이내 같은 기한, 평가 당일 기록 확인, 불인정(N) 조건, 평가기준의 복수 bullet/checklist, 확인방법의 대상·증빙·예외 조건.
   - 따라서 구현은 `RecipientRightsGuidelines` 전용 hotfix만으로 끝내지 말고, `EvaluationRequirementCompleteness` 계층으로 일반화할 수 있게 설계한다.

1. 문서 추가보다 구조화 우선
   - 근거 문서는 이미 존재한다. 핵심은 구조화, routing, answer guard, regression gate다.

2. 평가형 deterministic fast path 우선
   - “8대 지침 목록”, “신규수급자 기한”, “평가 인정/불인정 조건”은 LLM 창작이 아니라 근거 기반 template로 답변한다.

3. 검색 품질 개선은 golden case로 잠근 뒤 구현
   - 먼저 failing golden case를 추가하고, 이후 검색/온톨로지/답변 수정을 한다.

4. 기존 사용자 변경 보호
   - 작업트리에 대량 변경이 있으므로 대상 파일만 수정하고 자동 포맷/대규모 reformat 금지.

5. 운영 path와 admin diagnostics path 분리
   - 사용자-facing chat에는 fast path와 최소 diagnostics.
   - `inspectRetrieval()`/admin panel에는 상세 trace 유지.

---

## 5. 개선 방안 A — 8대 지침 누락 방지

### A0. 일반화 대상: EvaluationRequirementCompleteness 계층

8대 지침 누락은 아래 일반 문제의 예시로 다룬다.

- 평가기준/확인방법 문서의 checklist 항목 일부 누락
- 필수 증빙 필드 일부 누락
- 대상자/행위자 누락
- 빈도/기한/산정기간 누락
- 예외/불인정/감점 조건 누락
- 여러 section에 흩어진 “평가기준 + 확인방법 + 확인사항” 중 하나만 답변에 반영되는 문제

따라서 P0에서는 `02-05-노인인권보호`를 seed case로 구현하되, 함수/타입 이름은 다음처럼 일반화한다.

- `EvaluationRequirementCompletenessRule`
- `EvaluationRequirementChecklistItem`
- `detectEvaluationRequirementQuestion()`
- `buildEvaluationRequirementCompletenessInstructions()`
- `validateEvaluationRequirementCompleteness()`
- `tryBuildDeterministicEvaluationRequirementAnswer()`

`RecipientRightsGuidelines`는 위 일반 계층의 첫 번째 built-in rule로 등록한다.

### A1. golden cases 추가

**파일:** `benchmarks/golden-cases.json`

추가할 case 후보:

1. `evaluation-recipient-rights-eight-guidelines-list`
   - query: `신규 수급자에게 안내해야 하는 8가지 지침이 뭐고 언제까지 설명해야 해?`
   - mode: `evaluation`
   - expectedDoc: `02-05-노인인권보호`
   - mustContain:
     - `욕창예방`
     - `낙상예방`
     - `탈수예방`
     - `배변도움`
     - `관절구축예방`
     - `치매예방`
     - `감염예방`
     - `노인인권보호`
     - `14일 이내`
     - `토요일`
     - `공휴일`

2. `evaluation-recipient-rights-annual-explanation`
   - query: `수급자 보호자에게 노인인권보호 지침은 얼마나 자주 설명해야 하나요?`
   - expectedDoc: `02-05-노인인권보호`
   - mustContain: `연 1회 이상`, `모든 수급자`, `보호자`, `8가지 지침`

3. `evaluation-recipient-rights-record-noncompliance`
   - query: `8대 지침 설명 기록이 평가 당일 없으면 인정되나요?`
   - expectedDoc: `02-05-노인인권보호`
   - mustContain: `불인정`, `평가 당일`, `기록`

4. `evaluation-recipient-rights-alias-eight-principles`
   - query: `8대 지침 교육 신규 입소자는 며칠 안에 해야 돼?`
   - expectedDoc: `02-05-노인인권보호`
   - mustContain: `급여제공 시작일`, `14일 이내`, `토요일`, `공휴일 포함`

**구현 메모:** 기존 JSON schema를 그대로 따라 추가한다. schema가 `expectedDocuments`, `mustContain`, `forbiddenValidationCodes`, `minSupportedClaims` 등으로 되어 있으면 기존 case 하나를 복사하여 필드명을 맞춘다.

### A2. 평가형 구조 요구사항 completeness guard 추가

**수정 파일:** `src/lib/expertAnswering.ts`

8대 지침 전용 guard를 바로 박는 대신, 일반 rule registry를 먼저 만들고 8대 지침을 첫 built-in rule로 등록한다.

새 파일 제안: `src/lib/evaluationRequirementCompleteness.ts`

```ts
export interface EvaluationRequirementCompletenessRule {
  id: string;
  label: string;
  detectQuestion(question: string): boolean;
  detectEvidence(chunk: StructuredChunk): boolean;
  requiredTerms: string[];
  conditionalRequiredTerms?: Array<{
    whenQuestionMatches: RegExp;
    terms: string[];
  }>;
  canonicalDocumentTitleIncludes: string[];
  answerInstruction: string;
}

export const RECIPIENT_RIGHTS_GUIDELINE_ITEMS = [
  '욕창예방',
  '낙상예방',
  '탈수예방',
  '배변도움',
  '관절구축예방',
  '치매예방',
  '감염예방',
  '노인인권보호',
] as const;

export const EVALUATION_REQUIREMENT_COMPLETENESS_RULES: EvaluationRequirementCompletenessRule[] = [
  {
    id: 'recipient-rights-eight-guidelines',
    label: '수급자 8가지 지침 설명',
    canonicalDocumentTitleIncludes: ['02-05-노인인권보호'],
    detectQuestion: (question) => /8\s*(?:대|가지)\s*지침|욕창예방|낙상예방|탈수예방|관절구축|노인인권보호\s*지침|신규\s*(?:수급자|입소자).*(?:14일|지침|안내|설명)/u.test(question),
    detectEvidence: (chunk) => chunk.docTitle.includes('02-05-노인인권보호') && /8가지\s*지침|욕창예방|낙상예방|14일/u.test(chunk.text),
    requiredTerms: [...RECIPIENT_RIGHTS_GUIDELINE_ITEMS],
    conditionalRequiredTerms: [
      {
        whenQuestionMatches: /신규\s*(?:수급자|입소자)|급여제공\s*시작/u,
        terms: ['급여제공 시작', '14일 이내', '토요일', '공휴일'],
      },
      {
        whenQuestionMatches: /연\s*1회|얼마나\s*자주|주기|빈도/u,
        terms: ['연 1회 이상', '모든 수급자', '보호자'],
      },
      {
        whenQuestionMatches: /기록|평가\s*당일|인정|불인정/u,
        terms: ['평가 당일', '기록', '불인정'],
      },
    ],
    answerInstruction: '수급자 8가지 지침 질문에서는 8개 항목, 신규수급자 14일 기한, 연 1회 이상 설명, 평가 당일 기록 확인/불인정 조건을 질문 맥락에 맞게 누락하지 않는다.',
  },
];

export function findEvaluationRequirementCompletenessRules(question: string, evidence: StructuredChunk[]): EvaluationRequirementCompletenessRule[] {
  return EVALUATION_REQUIREMENT_COMPLETENESS_RULES.filter(
    (rule) => rule.detectQuestion(question) && evidence.some(rule.detectEvidence),
  );
}
```

`src/lib/expertAnswering.ts` 연결:

```ts
export function buildEvaluationRequirementCompletenessInstructions(question: string, evidence: StructuredChunk[]): string[] {
  return findEvaluationRequirementCompletenessRules(question, evidence).map((rule) => {
    const required = rule.requiredTerms.join(', ');
    const conditional = (rule.conditionalRequiredTerms ?? [])
      .filter((item) => item.whenQuestionMatches.test(question))
      .map((item) => item.terms.join(', '))
      .join(' / ');
    return `Evaluation completeness rule [${rule.id}]: ${rule.answerInstruction} Required terms: ${required}. Conditional required terms: ${conditional || 'none'}.`;
  });
}
```

이렇게 하면 이후 다른 평가지표도 `EVALUATION_REQUIREMENT_COMPLETENESS_RULES`에 rule만 추가하면 같은 guard/validation/fast path를 재사용할 수 있다.

### A3. 답변 후 validation guard 추가

**수정 파일:** `src/lib/ragSemanticValidation.ts`

새 validation code 제안:

- `missing-recipient-rights-guideline-item`
- `missing-recipient-rights-new-recipient-deadline`

새 함수 제안:

```ts
const REQUIRED_RECIPIENT_RIGHTS_GUIDELINE_TERMS = [
  '욕창예방', '낙상예방', '탈수예방', '배변도움',
  '관절구축예방', '치매예방', '감염예방', '노인인권보호',
];

function validateRecipientRightsGuidelineAnswer(params: {
  question: string;
  answerText: string;
  evidence: StructuredChunk[];
}): ValidationIssue[] {
  if (!detectRecipientRightsGuidelineQuestion(params.question)) return [];
  const hasPrimaryEvidence = params.evidence.some((chunk) =>
    chunk.docTitle.includes('02-05-노인인권보호') && /8가지\s*지침|욕창예방|낙상예방/u.test(chunk.text),
  );
  if (!hasPrimaryEvidence) return [];

  const issues: ValidationIssue[] = [];
  const missing = REQUIRED_RECIPIENT_RIGHTS_GUIDELINE_TERMS.filter((term) => !params.answerText.includes(term));
  if (missing.length > 0) {
    issues.push({
      code: 'missing-recipient-rights-guideline-item',
      severity: 'blocking',
      message: `8가지 지침 항목 누락: ${missing.join(', ')}`,
    });
  }

  if (/신규\s*(?:수급자|입소자)|급여제공\s*시작/u.test(params.question)) {
    if (!/14일\s*이내/u.test(params.answerText) || !/토요일|공휴일/u.test(params.answerText)) {
      issues.push({
        code: 'missing-recipient-rights-new-recipient-deadline',
        severity: 'blocking',
        message: '신규수급자 14일 이내(토요일·공휴일 포함) 요건 누락',
      });
    }
  }
  return issues;
}
```

주의: 실제 `ValidationIssue` 타입 필드명은 현재 파일의 기존 issue 생성 패턴에 맞춘다.

### A4. 검색 boost 추가

**수정 파일:** `src/lib/nodeRagService.ts`

새 helper 제안:

```ts
function buildRecipientRightsGuidelineBoosts(chunks: StructuredChunk[], query: string): Map<string, number> {
  if (!/8\s*(?:대|가지)\s*지침|신규\s*(?:수급자|입소자).*14일|욕창예방|낙상예방|노인인권보호/u.test(query)) {
    return new Map();
  }
  const boosts = new Map<string, number>();
  for (const chunk of chunks) {
    if (chunk.docTitle.includes('02-05-노인인권보호')) {
      const base = /8가지\s*지침|욕창예방|낙상예방|14일/u.test(chunk.text) ? 3.5 : 1.5;
      boosts.set(chunk.documentId, Math.max(boosts.get(chunk.documentId) ?? 0, base));
    }
  }
  return boosts;
}
```

연결 위치:

- `nodeRagService.ts::executeSearch()` integrated/evaluation setup에서 `baseDocumentScoreBoosts` 또는 evaluation path의 document boost merge에 추가.
- integrated/evaluation 양쪽 모두 적용해야 함. 사용자가 evaluation mode를 명시하지 않아도 “8대 지침” 질의는 `02-05`로 라우팅되어야 한다.

---

## 6. 개선 방안 B — 응답 속도 개선

### B1. 평가형 fast path 추가

**수정 파일:** `src/lib/nodeRagService.ts`, `src/lib/expertAnswering.ts`

목표: 8대 지침/기한/평가 확인방법처럼 근거와 출력이 정형화된 질의는 `generateAnswerPlan()` + `synthesizeExpertAnswer()` 2회 LLM 호출 없이 template answer를 생성한다.

새 타입 제안 (`src/lib/ragTypes.ts`):

```ts
export type DeterministicAnswerKind =
  | 'recipient-rights-guideline'
  | 'evaluation-deadline'
  | 'evaluation-record-check';
```

새 함수 제안 (`src/lib/expertAnswering.ts`):

```ts
export function tryBuildDeterministicEvaluationAnswer(params: {
  question: string;
  evidence: StructuredChunk[];
  confidence: ConfidenceLevel;
  keyIssueDate?: string;
}): ExpertAnswerEnvelope | null {
  if (!detectRecipientRightsGuidelineQuestion(params.question)) return null;
  const primary = params.evidence.find((chunk) =>
    chunk.docTitle.includes('02-05-노인인권보호') && /8가지\s*지침|욕창예방|낙상예방|14일/u.test(chunk.text),
  );
  if (!primary) return null;

  return {
    answerType: 'checklist',
    confidence: params.confidence,
    evidenceState: 'confirmed',
    keyIssueDate: params.keyIssueDate,
    summary: '모든 수급자(보호자)에게 8가지 지침을 연 1회 이상 설명해야 하며, 신규수급자는 급여제공 시작일부터 토요일·공휴일 포함 14일 이내 안내 여부를 확인합니다.',
    blocks: [
      {
        title: '8가지 지침',
        items: RECIPIENT_RIGHTS_GUIDELINE_ITEMS.map((item) => ({ text: item, citationIds: [primary.id] })),
      },
      {
        title: '기한·확인 기준',
        items: [
          { text: '모든 수급자(보호자): 연 1회 이상 설명', citationIds: [primary.id] },
          { text: '신규수급자: 급여제공 시작일부터 토요일·공휴일 포함 14일 이내', citationIds: [primary.id] },
          { text: '평가 당일 기록이 확인되지 않으면 불인정(N)', citationIds: [primary.id] },
        ],
      },
    ],
    citations: [{ evidenceId: primary.id, label: buildPreciseCitationLabel(primary), quote: selectQuoteText(primary) }],
    basis: toBasisEntriesFromEvidence([primary]),
    warnings: [],
  };
}
```

실제 `ExpertAnswerEnvelope` 필드명은 `src/lib/ragTypes.ts`의 정의와 `createExpertAbstainAnswer()`/`synthesizeExpertAnswer()` 반환 구조를 확인해 맞춘다.

연결 위치 (`nodeRagService.ts::generateChatResponse()`):

- `planned.evidence.length === 0` 처리 이후,
- `generateAnswerPlan()` 호출 이전에 삽입.

```ts
const deterministicAnswer = tryBuildDeterministicEvaluationAnswer({
  question,
  evidence: planned.evidence,
  confidence: planned.search.confidence,
  keyIssueDate,
});
if (deterministicAnswer) {
  latency.answerMs = 0;
  latency.planningMs = 0;
  latency.totalMs = Date.now() - startedAt;
  retrieval.agentDecision = 'answer';
  retrieval.plannerTrace = [
    ...retrieval.plannerTrace,
    { step: 'deterministic-answer', detail: 'recipient-rights-guideline fast path' },
  ];
  return { answer: deterministicAnswer, text: formatAnswerAsMarkdown(deterministicAnswer), search: { ...planned.search, evidence: planned.evidence }, citations, retrieval };
}
```

### B2. `fast-evaluation` retrieval profile 추가

**수정 파일:** `src/lib/ragProfiles.ts`

새 profile:

```ts
{
  id: 'fast-evaluation',
  label: 'Fast Evaluation',
  description: '정형 평가기준/확인방법 질의에서 LLM 전처리를 줄이고 평가문서 lexical/ontology routing을 우선합니다.',
  queryProcessing: {
    rewrite: false,
    clarify: false,
    hyde: false,
    decompose: false,
  },
  retrieval: {
    sectionRouting: true,
    reranker: true,
    externalElasticsearch: false,
    scopeBoosts: true,
  },
  guardrails: {
    piiMasking: true,
    promptInjection: true,
    citationWarning: true,
    hallucinationSignal: true,
    abstainOnLowConfidence: true,
  },
  cache: {
    normalization: true,
    hyde: false,
    retrieval: true,
    answer: true,
    fallback: true,
  },
  weights: {
    lexical: 1.35,
    vector: 0.65,
    rerank: 0.9,
    section: 1.2,
  },
}
```

운영 방식:

- 기본 profile을 즉시 바꾸지 않는다.
- admin/bench에서 `fast-evaluation`을 비교한다.
- 특정 질의 패턴은 내부적으로 `fast-evaluation` equivalent flags를 적용하는 방식을 추후 검토한다.

### B3. latency diagnostics를 목표 지표로 관리

**수정 파일:** `scripts/rag-benchmark-diagnostics.ts`, `scripts/rag-quality-report.ts`

추가 지표:

- deterministic fast path hit count
- `planningMs`, `answerMs`, `retrievalMs`, `totalMs` per case
- `queryProcessing` LLM call count
- profile별 p50/p95 total latency

목표:

- 8대 지침 fast path: local benchmark 기준 total retrieval+answer p95 250ms 이하(LLM synthesis 미사용 시)
- 전체 benchmark: 기존 README 기준 retrieval latency avg 120ms 이하, p95 250ms 이하 유지
- LLM 포함 사용자-facing 첫 응답까지 체감 지연은 streaming 도입 전까지 별도 측정만 수행

---

## 7. 개선 방안 C — 온톨로지 설계 초안

### C1. schema version 2 제안

**수정 파일:** `src/lib/ragTypes.ts`, `src/lib/ragOntology.ts`, `knowledge/ontology/curated.json`

#### 새 entity_type 후보

- `evaluation_indicator`
- `evaluation_requirement`
- `checklist_item`
- `deadline`
- `frequency`
- `actor`
- `target_subject`
- `verification_method`
- `noncompliance_condition`
- `document_section`

#### 새 relation 후보

`src/lib/ragTypes.ts::OntologyRelationType`에 추가:

```ts
| 'has-requirement'
| 'has-checklist-item'
| 'has-deadline'
| 'has-frequency'
| 'has-target'
| 'has-actor'
| 'verified-by'
| 'noncompliant-if'
| 'grounded-in-section'
```

#### 새 slot 후보

`src/lib/ragTypes.ts::SemanticSlotKey`에 추가:

```ts
| 'evaluation_indicator'
| 'checklist_item'
| 'deadline'
| 'frequency'
| 'verification_method'
```

### C2. `02-05-노인인권보호` 온톨로지 seed 초안

**수정 파일:** `knowledge/ontology/curated.json`

추가 concept 예시:

```json
{
  "label": "노인인권보호 평가지표",
  "status": "promoted",
  "confidence": 1,
  "entity_type": "evaluation_indicator",
  "aliases": ["02-05-노인인권보호", "19. 노인인권보호", "수급자 인권보호", "노인인권보호 지표"],
  "slot_hints": ["evaluation_indicator"],
  "relations": [
    { "relation": "has-requirement", "target_label": "수급자 8가지 지침 설명", "target_entity_type": "evaluation_requirement", "weight": 1.2 },
    { "relation": "grounded-in-section", "target_label": "02-05-노인인권보호 평가기준", "target_entity_type": "document_section", "weight": 1.2 },
    { "relation": "grounded-in-section", "target_label": "02-05-노인인권보호 확인방법", "target_entity_type": "document_section", "weight": 1.2 }
  ],
  "evidence": [{ "path": "/knowledge/evaluation/02-05-노인인권보호.md", "label": "평가기준/확인방법" }]
}
```

```json
{
  "label": "수급자 8가지 지침 설명",
  "status": "promoted",
  "confidence": 1,
  "entity_type": "evaluation_requirement",
  "aliases": ["8대 지침", "8가지 지침", "수급자 지침", "보호자 지침", "신규수급자 지침 안내", "신규 입소자 지침 안내"],
  "slot_hints": ["evaluation_indicator", "checklist_item", "deadline", "frequency"],
  "relations": [
    { "relation": "has-target", "target_label": "모든 수급자(보호자)", "target_entity_type": "target_subject", "weight": 1.1 },
    { "relation": "has-frequency", "target_label": "연 1회 이상", "target_entity_type": "frequency", "weight": 1.1 },
    { "relation": "has-target", "target_label": "신규수급자", "target_entity_type": "target_subject", "weight": 1.1 },
    { "relation": "has-deadline", "target_label": "급여제공 시작일부터 토요일·공휴일 포함 14일 이내", "target_entity_type": "deadline", "weight": 1.2 },
    { "relation": "verified-by", "target_label": "평가 당일 설명 기록 확인", "target_entity_type": "verification_method", "weight": 1.1 },
    { "relation": "noncompliant-if", "target_label": "평가 당일 기록 미확인", "target_entity_type": "noncompliance_condition", "weight": 1.1 },
    { "relation": "has-checklist-item", "target_label": "욕창예방", "target_entity_type": "checklist_item", "weight": 1.0 },
    { "relation": "has-checklist-item", "target_label": "낙상예방", "target_entity_type": "checklist_item", "weight": 1.0 },
    { "relation": "has-checklist-item", "target_label": "탈수예방", "target_entity_type": "checklist_item", "weight": 1.0 },
    { "relation": "has-checklist-item", "target_label": "배변도움", "target_entity_type": "checklist_item", "weight": 1.0 },
    { "relation": "has-checklist-item", "target_label": "관절구축예방", "target_entity_type": "checklist_item", "weight": 1.0 },
    { "relation": "has-checklist-item", "target_label": "치매예방", "target_entity_type": "checklist_item", "weight": 1.0 },
    { "relation": "has-checklist-item", "target_label": "감염예방", "target_entity_type": "checklist_item", "weight": 1.0 },
    { "relation": "has-checklist-item", "target_label": "노인인권보호", "target_entity_type": "checklist_item", "weight": 1.0 }
  ],
  "evidence": [{ "path": "/knowledge/evaluation/02-05-노인인권보호.md", "label": "확인방법" }]
}
```

### C3. 온톨로지 graph expansion 개선

**수정 파일:** `src/lib/ragOntology.ts`

구현 포인트:

1. `extractGeneratedRelationCandidates()`에 평가형 문서 규칙 추가

```ts
if (/노인인권보호|8가지 지침|8대 지침/u.test(label) || /욕창예방|낙상예방|탈수예방|배변도움|관절구축예방|치매예방|감염예방/u.test(compactText)) {
  addRelation('has-requirement', '수급자 8가지 지침 설명', 'evaluation_requirement', 1.2, '노인인권보호 지표의 수급자 지침 설명 요건');
  addRelation('has-deadline', '급여제공 시작일부터 토요일·공휴일 포함 14일 이내', 'deadline', 1.1, '신규수급자 안내 기한');
}
```

2. `guessConceptEntityType()` 확장

```ts
if (/평가지표|노인인권보호/u.test(label)) return 'evaluation_indicator';
if (/8가지 지침|8대 지침|설명/u.test(label)) return 'evaluation_requirement';
if (/욕창예방|낙상예방|탈수예방|배변도움|관절구축예방|치매예방|감염예방/u.test(label)) return 'checklist_item';
if (/14일|이내|연 1회|반기별/u.test(label)) return 'deadline';
```

3. `guessSlotHints()` 확장

```ts
if (/평가지표|평가기준|확인방법/u.test(label)) hints.add('evaluation_indicator');
if (/8가지 지침|8대 지침|욕창예방|낙상예방/u.test(label)) hints.add('checklist_item');
if (/14일|이내|연 1회/u.test(label)) hints.add('deadline');
```

4. `expandDocumentsWithOntology()`의 relation weight 정책 확인 및 보강
   - `has-requirement`, `has-checklist-item`, `has-deadline`, `grounded-in-section`은 평가 질의에서 boost weight를 높게 둔다.
   - 단, support_reference보다 `source_role=primary_evaluation` chunk를 우선한다.

### C4. lexicon/rules 보강

**수정 파일:** `knowledge/ontology/lexicon.json`

alias group 예시:

```json
{
  "canonical": "수급자 8가지 지침 설명",
  "aliases": ["8대 지침", "8가지 지침", "수급자 지침", "보호자 지침", "신규수급자 지침", "신규 입소자 지침", "노인인권보호 지침"],
  "boost_terms": ["욕창예방", "낙상예방", "탈수예방", "배변도움", "관절구축예방", "치매예방", "감염예방", "노인인권보호", "14일", "토요일", "공휴일"]
}
```

**수정 파일:** `knowledge/ontology/rules.json`

rule 예시:

```json
{
  "id": "recipient-rights-guideline-completeness",
  "when": {
    "query_any": ["8대 지침", "8가지 지침", "신규수급자 지침", "노인인권보호 지침"]
  },
  "must_evidence_doc": ["02-05-노인인권보호"],
  "must_answer_terms": ["욕창예방", "낙상예방", "탈수예방", "배변도움", "관절구축예방", "치매예방", "감염예방", "노인인권보호"],
  "must_answer_terms_if_query_any": {
    "신규": ["14일 이내", "토요일", "공휴일"]
  }
}
```

실제 rules parser가 위 schema를 지원하지 않으면, 먼저 `ragSemanticValidation.ts`에 hard-coded rule로 구현하고 schema 확장은 후속 task로 분리한다.

---

## 8. 구현 로드맵

### Phase 0 — 안전장치와 baseline 고정

#### Task 0.1: 작업트리 보호 및 baseline 기록

**Objective:** 기존 사용자 변경을 건드리지 않고 현재 RAG baseline을 문서화한다.

**Files:**
- Read only: `git status --short --branch`
- Read only: `.rag-cache/rag-quality-report.json`
- Modify: `docs/plans/rag-search-performance-progress.md` 또는 별도 progress 파일(선택)

**Steps:**
1. `git status --short --branch` 실행.
2. 수정 대상 파일 목록을 명시한다.
3. `.rag-cache/rag-quality-report.json`에서 embedding coverage, benchmark latency를 기록한다.
4. 구현 전 baseline으로 `embeddingCount=0`, `embeddingCoverageRatio=0`, golden case 27개를 기록한다.

**Verification:** baseline 기록에 `02-05-노인인권보호` chunkCount 18, embeddingCount 0이 포함되어야 한다.

#### Task 0.2: 8대 지침 golden case RED 추가

**Objective:** 누락 문제를 테스트로 먼저 고정한다.

**Files:**
- Modify: `benchmarks/golden-cases.json`

**Steps:**
1. 기존 case schema 하나를 복사한다.
2. `evaluation-recipient-rights-eight-guidelines-list` 등 4개 case를 추가한다.
3. `npm run rag:bench` 또는 최소 `npm run rag:test` 실행.
4. 기대: 현재 구현에서는 최소 1개 case가 문서/필수어 누락으로 실패하거나, 새 case가 benchmark 결과에 반영된다.

**Verification:** `.rag-cache/rag-benchmark.json` 또는 benchmark 출력에 신규 case id가 보인다.

### Phase 1 — 검색 recall 및 authority 고정

#### Task 1.1: 8대 지침 query detector 추가

**Objective:** 검색/생성/검증에서 공통으로 쓸 질의 판별기를 만든다.

**Files:**
- Create: `src/lib/recipientRightsGuidelines.ts`
- Modify: `src/lib/expertAnswering.ts`
- Modify: `src/lib/nodeRagService.ts`
- Modify: `src/lib/ragSemanticValidation.ts`

**Implementation:**

```ts
export const RECIPIENT_RIGHTS_GUIDELINE_ITEMS = [
  '욕창예방',
  '낙상예방',
  '탈수예방',
  '배변도움',
  '관절구축예방',
  '치매예방',
  '감염예방',
  '노인인권보호',
] as const;

export function detectRecipientRightsGuidelineQuestion(question: string): boolean {
  return /8\s*(?:대|가지)\s*지침|신규\s*(?:수급자|입소자).*(?:지침|안내|설명|14일)|욕창예방|낙상예방|탈수예방|관절구축예방|노인인권보호\s*지침/u.test(question);
}

export function isRecipientRightsGuidelineEvidenceText(text: string): boolean {
  return /8가지\s*지침/u.test(text) && /욕창예방/u.test(text) && /낙상예방/u.test(text);
}
```

**Verification:** `npm run lint` 통과.

#### Task 1.2: document boost 적용

**Objective:** 관련 질의에서 `02-05-노인인권보호`가 Top-5 evidence 안에 안정적으로 들어오게 한다.

**Files:**
- Modify: `src/lib/nodeRagService.ts`

**Steps:**
1. `buildRecipientRightsGuidelineBoosts()` 추가.
2. integrated path와 evaluation path의 `documentScoreBoosts` merge 지점에 연결.
3. `plannerTrace`에 `recipient-rights-guideline-boost` step을 남긴다.

**Verification:** `npm run rag:bench`에서 신규 case의 expected doc Top-5 hit.

#### Task 1.3: ontology alias/curated seed 추가

**Objective:** “8대/8가지/신규입소자/지침교육” 질의 변형을 같은 canonical requirement로 묶는다.

**Files:**
- Modify: `knowledge/ontology/curated.json`
- Modify: `knowledge/ontology/lexicon.json`

**Steps:**
1. `노인인권보호 평가지표` concept 추가.
2. `수급자 8가지 지침 설명` concept 추가.
3. 8개 checklist item concept 추가 또는 relations target으로 추가.
4. alias에 `8대 지침`, `8가지 지침`, `노인인권보호 지침`, `신규 입소자 지침 안내` 포함.

**Verification:** `npm run rag:index` 후 `.rag-cache/rag-index.json` ontology rows에 신규 entity/alias가 포함된다.

### Phase 2 — 답변 completeness guard

#### Task 2.1: prompt-level completeness instruction 추가

**Objective:** LLM synthesis가 8개 항목을 생략하지 않도록 evidence 기반 instruction을 넣는다.

**Files:**
- Modify: `src/lib/expertAnswering.ts`

**Steps:**
1. `buildRecipientRightsGuidelineInstructions()` 추가.
2. `synthesizeExpertAnswer()` prompt 조립부에서 기존 enumeration instruction과 병합.
3. forced evidence hints에 `02-05` chunk preview 포함.

**Verification:** 신규 benchmark case 답변에 8개 항목이 모두 포함된다.

#### Task 2.2: answer validation 추가

**Objective:** 생성 후에도 누락 답변을 blocking issue로 잡는다.

**Files:**
- Modify: `src/lib/ragSemanticValidation.ts`
- Import: `detectRecipientRightsGuidelineQuestion`, `RECIPIENT_RIGHTS_GUIDELINE_ITEMS`

**Steps:**
1. `validateRecipientRightsGuidelineAnswer()` 추가.
2. `validateAnswerEnvelope()` 내부 issue list에 병합.
3. `missing-recipient-rights-guideline-item`, `missing-recipient-rights-new-recipient-deadline` code 추가.
4. benchmark forbidden codes에 새 blocking code가 뜨지 않도록 한다.

**Verification:** 일부러 항목을 누락한 mock answer validation이 실패하는 regression case 추가 또는 기존 benchmark에서 validation issue 0 확인.

### Phase 3 — fast path와 응답 속도 개선

#### Task 3.1: deterministic answer builder 추가

**Objective:** 8대 지침 질의는 LLM synthesis 없이 정형 답변을 반환한다.

**Files:**
- Modify: `src/lib/expertAnswering.ts`
- Modify: `src/lib/ragTypes.ts` 필요 시

**Steps:**
1. `tryBuildDeterministicEvaluationAnswer()` 추가.
2. `ExpertAnswerEnvelope` 기존 구조에 맞춰 checklist block 구성.
3. citations/basis는 primary chunk id로 구성.

**Verification:** unit-like script 또는 `npm run rag:bench`에서 fast path trace가 나타난다.

#### Task 3.2: `generateChatResponse()`에 fast path 연결

**Objective:** planning/synthesis 전에 deterministic answer를 반환한다.

**Files:**
- Modify: `src/lib/nodeRagService.ts:4307` 근처

**Steps:**
1. `planned.evidence.length === 0` 처리 다음에 fast path 삽입.
2. `latency.planningMs=0`, `latency.answerMs=0` 기록.
3. `retrieval.plannerTrace`에 `deterministic-answer` 기록.
4. answer cache 저장 로직과 일관되게 처리한다.

**Verification:** 신규 case latency에서 planning/answer가 0 또는 매우 낮게 기록된다.

#### Task 3.3: fast-evaluation profile 추가

**Objective:** 정형 평가 질의용 경량 profile을 실험 가능하게 한다.

**Files:**
- Modify: `src/lib/ragProfiles.ts`
- Modify: `src/components/RagAdminPanel.tsx` 필요 시 profile 표시 확인

**Steps:**
1. `DEFAULT_RETRIEVAL_PROFILES`에 `fast-evaluation` 추가.
2. Admin profile selector에서 자동 노출되는지 확인.
3. benchmark에서 `RAG_RETRIEVAL_PROFILE=fast-evaluation` 또는 기존 profile 선택 mechanism 확인 후 문서화.

**Verification:** `/api/chat/capabilities` 또는 admin panel에서 profile id 노출.

### Phase 4 — 온톨로지 v2 구조화

#### Task 4.1: 타입 확장

**Objective:** 평가 요건 구조를 타입에 반영한다.

**Files:**
- Modify: `src/lib/ragTypes.ts`

**Steps:**
1. `OntologyRelationType`에 v2 relation 추가.
2. `SemanticSlotKey`에 평가/체크리스트/기한 슬롯 추가.
3. `npm run lint`로 exhaustiveness error 확인.

**Verification:** TypeScript compile 통과.

#### Task 4.2: ontology extractor 확장

**Objective:** 문서 텍스트에서 checklist/deadline/frequency concept를 후보로 잡는다.

**Files:**
- Modify: `src/lib/ragOntology.ts`

**Steps:**
1. `CONCEPT_CANDIDATE_SUFFIXES`에 `예방`, `도움`, `이내`, `연 1회`, `반기별`은 suffix 방식과 맞지 않으므로 별도 regex extractor를 추가한다.
2. `extractDocumentConceptCandidates()`에서 bullet/table line뿐 아니라 `8가지 지침` 주변 문장을 parse한다.
3. `guessConceptEntityType()`/`guessSlotHints()` 확장.
4. `extractGeneratedRelationCandidates()`에 노인인권보호 규칙 추가.

**Verification:** `npm run ontology:generate` 또는 `npm run rag:index` 후 generated/rows에 checklist concept가 생긴다.

#### Task 4.3: graph expansion weight 조정

**Objective:** ontology가 찾은 requirement가 primary evaluation chunk로 이어지게 한다.

**Files:**
- Modify: `src/lib/ragOntology.ts`
- Modify: `src/lib/nodeRagService.ts` 필요 시

**Steps:**
1. `has-requirement`, `has-checklist-item`, `has-deadline`, `grounded-in-section` relation weight를 평가 질의에서 높게 반영.
2. `sourceRole === 'primary_evaluation'` 문서의 boost floor를 둔다.
3. noisy OCR/목차 chunk는 `routing_summary`나 oversized support chunk보다 낮게 둔다.

**Verification:** 신규 golden case에서 visible Top-3에 `02-05-노인인권보호` 또는 해당 section chunk가 포함된다.

### Phase 5 — embedding readiness 복구

#### Task 5.1: embedding 0 원인 문서화

**Objective:** 현재 `embeddingCount=0`이 환경/API key 문제인지 인덱스 정책 문제인지 분리한다.

**Files:**
- Read: `env.example`
- Read: `src/lib/ragRuntime.ts`
- Read: `scripts/rag-index.ts`
- Modify: `docs/plans/rag-search-performance-progress.md` 또는 구현 progress

**Steps:**
1. `resolveEmbeddingApiKey()` 동작 확인.
2. `RAG_EMBEDDING_API_KEY`/`GEMINI_API_KEY` 없을 때 `scripts/rag-index.ts`가 embedding 없이 index만 생성하는 현재 동작 기록.
3. `embed-until-ready.sh` 사용 여부 확인.

**Verification:** embedding key 없이 `npm run rag:index`를 실행하면 embeddingCount 0이 재현되는지 확인. key가 있으면 일부 embeddingCount 증가 확인.

#### Task 5.2: embedding coverage gate 추가

**Objective:** primary evaluation 문서가 zero embedding인 상태를 품질 리포트에서 경고/실패로 표시한다.

**Files:**
- Modify: `scripts/rag-quality-report.ts`
- Modify: `docs/reports/rag-quality-report.md` generated output

**Steps:**
1. `primary_evaluation` 문서의 embeddingCoverageRatio가 0이면 별도 severity를 높인다.
2. `02-05-노인인권보호` 같은 promoted ontology evidence 문서는 critical list로 표시한다.
3. README/quality report에 “lexical-only mode” 표시를 명확히 한다.

**Verification:** 현재 상태에서 `02-05-노인인권보호`가 critical zero embedding 문서로 표시된다.

---

## 9. 테스트 및 검증 계획

### 9.1 필수 명령

```bash
npm run lint
npm run rag:index
npm run rag:test
npm run rag:bench
npm run rag:quality-report
npm run rag:baseline
```

### 9.2 수동 inspect 질의

Admin retrieval inspect 또는 `/api/chat`에서 다음 질의를 확인한다.

1. `신규 수급자에게 안내해야 하는 8가지 지침이 뭐고 언제까지 설명해야 해?`
2. `8대 지침 교육 신규 입소자는 며칠 안에 해야 돼?`
3. `수급자 보호자에게 노인인권보호 지침은 얼마나 자주 설명해야 하나요?`
4. `8대 지침 설명 기록이 평가 당일 없으면 인정되나요?`

각 질의 acceptance criteria:

- `02-05-노인인권보호`가 evidence Top-5 안에 포함
- 답변에 8개 항목 전부 포함
- 신규수급자 질의는 `급여제공 시작일부터`, `14일 이내`, `토요일·공휴일 포함` 포함
- 빈도 질의는 `연 1회 이상` 포함
- 기록 질의는 `평가 당일 기록 미확인 시 불인정(N)` 포함
- hallucination/citation validation issue 없음

### 9.3 성능 acceptance criteria

- 신규 8대 지침 deterministic fast path case:
  - `retrieval.latency.planningMs === 0` 또는 planner skip trace 존재
  - `retrieval.latency.answerMs === 0` 또는 synthesis skip trace 존재
  - local benchmark total p95 250ms 이하 목표
- 전체 기존 benchmark:
  - Top-3/Top-5 기존 baseline 악화 금지
  - evidence/citation/validation/claim coverage 100% 유지
  - retrieval latency avg 120ms 이하, p95 250ms 이하 유지(README baseline 기준)

---

## 10. 리스크와 대응

### Risk 1: hard-coded rule이 도메인 확장성을 해칠 수 있음

- 영향: 8대 지침은 잘 맞지만 다른 평가지표에도 개별 rule이 늘어날 수 있다.
- 대응: hard-coded detector는 P0 hotfix로 두고, Phase 4에서 ontology v2 schema로 일반화한다.

### Risk 2: document boost가 다른 노인인권/인권교육 문서를 과도하게 밀어낼 수 있음

- 영향: 직원인권보호(`01-07`)와 수급자 노인인권보호(`02-05`) 혼동 가능.
- 대응: query detector에 `수급자/보호자/8대/8가지/욕창/낙상/신규수급자/14일` anchor를 요구하고, 직원/종사자/반기별 교육 질의에는 boost를 적용하지 않는다.

### Risk 3: deterministic answer가 evidence 없는 상황에서 과신 답변할 수 있음

- 영향: citation 없는 template 답변 가능성.
- 대응: 반드시 `02-05-노인인권보호` primary evidence chunk가 retrieval된 경우에만 fast path를 탄다. evidence 없으면 기존 abstain/LLM path 유지.

### Risk 4: ontology relation type 확장이 DB schema/rows 저장과 충돌할 수 있음

- 영향: `db/rag-schema.sql` enum이 아니라 text면 안전하지만, 코드 exhaustiveness에서 compile error 가능.
- 대응: `src/lib/ragTypes.ts`, `src/lib/ragOntology.ts`, `db/rag-schema.sql` 저장 타입을 함께 확인하고 `npm run lint`를 첫 gate로 둔다.

### Risk 5: embedding 재생성이 API quota를 소모할 수 있음

- 영향: `npm run rag:index`가 13,799 chunks embedding 시 quota/time 비용 발생.
- 대응: `RAG_EMBEDDING_MAX_CHUNKS_PER_PASS`, `RAG_EMBEDDING_MAX_CHUNKS_PER_RUN`, `embed-until-ready.sh`를 사용해 점진 실행한다. key가 없으면 lexical-only로 동작하되 quality report에 명확히 경고한다.

### Risk 6: 작업트리에 이미 많은 변경이 있어 충돌/오염 위험

- 영향: 계획 구현 중 기존 변경을 덮어쓸 수 있음.
- 대응: 각 task 시작 전 `git status --short`, 대상 파일별 `git diff -- path` 확인. 자동 formatter 전체 실행 금지. 필요한 파일만 patch.

### Risk 7: benchmark schema 오해

- 영향: `benchmarks/golden-cases.json` 필드명을 잘못 추가하면 benchmark 자체가 깨질 수 있음.
- 대응: 기존 case 하나를 복사해 필드명을 맞추고, JSON parse 및 `npm run rag:bench`를 즉시 실행한다.

---

## 11. 우선순위 티켓

### P0 — 즉시 착수

1. `benchmarks/golden-cases.json`에 8대 지침/14일/기록 관련 golden case 추가.
2. `src/lib/recipientRightsGuidelines.ts` 공통 detector/상수 추가.
3. `src/lib/nodeRagService.ts`에 `02-05-노인인권보호` document boost 추가.
4. `src/lib/expertAnswering.ts`에 8개 항목 completeness prompt instruction 추가.
5. `src/lib/ragSemanticValidation.ts`에 누락 검증 추가.

### P1 — 속도 개선

1. `tryBuildDeterministicEvaluationAnswer()` 추가.
2. `generateChatResponse()`에서 fast path 연결.
3. `fast-evaluation` profile 추가.
4. benchmark diagnostics에 fast path hit/latency 추가.

### P2 — 온톨로지 v2

1. `OntologyRelationType`/`SemanticSlotKey` 확장.
2. `curated.json`에 노인인권보호 평가지표 seed 추가.
3. `lexicon.json`/`rules.json` 보강.
4. `ragOntology.ts` extractor/graph expansion weight 개선.

### P3 — embedding 및 운영 품질

1. embedding key/coverage 원인 확정.
2. primary evaluation zero embedding critical gate 추가.
3. embedding 재생성 운영 절차 문서화.

---

## 12. 구현 담당자 체크리스트

- [ ] 구현 전 `git status --short --branch` 확인.
- [ ] 기존 대량 변경 파일을 불필요하게 reformat하지 않음.
- [ ] golden case부터 추가하고 RED/반영 확인.
- [ ] `02-05-노인인권보호` evidence가 없으면 deterministic answer 금지.
- [ ] 답변에는 8개 항목을 정확히 모두 포함.
- [ ] 신규수급자 답변에는 “급여제공 시작일부터 토요일·공휴일 포함 14일 이내” 포함.
- [ ] 연례 설명 답변에는 “모든 수급자(보호자)에게 연 1회 이상” 포함.
- [ ] 기록 확인 질의에는 “평가 당일 기록 미확인 시 불인정(N)” 포함.
- [ ] `npm run lint`, `npm run rag:test`, `npm run rag:bench`, `npm run rag:quality-report` 실행 결과를 progress에 기록.

---

## 13. 완료 기준

이 계획의 완료 기준은 다음과 같다.

1. 신규 golden case 4개가 benchmark에 포함되고 모두 통과한다.
2. 관련 질의에서 `02-05-노인인권보호`가 Top-5 evidence 안에 안정적으로 포함된다.
3. 답변에 8가지 지침 전체와 신규수급자 14일 요건이 누락되지 않는다.
4. deterministic fast path 적용 case는 planner/synthesis LLM 호출을 생략하거나 latency trace상 0으로 표시된다.
5. 온톨로지에 `노인인권보호 평가지표`와 `수급자 8가지 지침 설명` canonical concept가 promoted 상태로 존재한다.
6. quality report가 primary evaluation zero embedding 상태를 명확히 경고한다.
7. 기존 benchmark baseline(Top-K, citation, validation, latency)이 악화되지 않는다.
