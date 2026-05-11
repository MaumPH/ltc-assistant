# Evaluation Requirement Completeness Progress

## 2026-05-07 / P0 진행: 범용 completeness layer 착수

### 목표

브리프의 “8대 지침 누락”을 전용 기능으로 고치는 대신, 평가문서 안의 구조화된 필수 요소(checklist, 대상, 주기, 기한, 확인방법, 기록/증빙, 불인정 조건)가 답변에서 빠지는 문제를 범용 계층으로 막는다.

### 중요한 방향 정정

- 8대 지침은 production logic의 전용 detector, 전용 rule, 전용 fast path가 아니다.
- 8대 지침은 golden case, regression test, fixture, sample ontology instance로만 취급한다.
- production 함수명과 validation code는 지표명이 아니라 generic evaluation completeness 개념을 사용한다.
- 다른 평가문서도 fixture/rule만 추가하면 같은 retrieval boost, prompt instruction, deterministic answer, validation을 재사용할 수 있어야 한다.

### 이번 작업에서 수정한 파일

- `src/lib/evaluationRequirementCompleteness.ts`
  - `EvaluationRequirementCompletenessRule`, `EvaluationRequirementItem`, `EvaluationRequirementConditionalItem`, `EvaluationEvidenceSelector` 추가.
  - `EVALUATION_REQUIREMENT_FIXTURES`, `recipientRightsGuidelineFixture`, `buildEvaluationRequirementFixtures()` 추가.
  - `findMatchingEvaluationRequirements()`, `buildEvaluationRequirementDocumentBoosts()`, `buildEvaluationRequirementChunkBoosts()` 추가.
  - `buildEvaluationRequirementCompletenessInstructions()`, `validateEvaluationRequirementCompleteness()` 추가.
- `src/lib/ragTypes.ts`
  - evaluation requirement 관련 ontology slot/relation 후보 추가.
  - generic validation issue code 추가.
  - benchmark case에 `requiredAnswerTerms` optional 필드 추가.
- `src/lib/nodeRagService.ts`
  - matched requirement 기반 document/chunk boost 연결.
  - matched requirement 기반 deterministic answer fast path 연결.
  - planner trace에 `evaluation-requirement-match`, `deterministic-answer` 기록.
- `src/lib/expertAnswering.ts`
  - planner/synthesizer prompt에 generic completeness instruction 연결.
  - `tryBuildDeterministicEvaluationRequirementAnswer()` 추가.
- `src/lib/ragSemanticValidation.ts`
  - answer validation에서 generic `validateEvaluationRequirementCompleteness()` 연결.
  - answer text 수집에 `directAnswer` 포함.
- `src/lib/ragProfiles.ts`
  - 실험용 `fast-evaluation` profile 추가.
- `knowledge/ontology/curated.json`
  - `노인인권보호 평가지표`, `수급자 8가지 지침 설명`을 generic ontology schema의 promoted seed instance로 추가.
- `knowledge/ontology/lexicon.json`
  - 8대/8가지/신규수급자/노인인권보호 지침 alias seed 추가.
- `benchmarks/golden-cases.json`
  - `evaluation-completeness-*` 이름의 generic golden case 4건 추가.
- `scripts/rag-regression-test.ts`
  - generic completeness matching/instruction/validation/deterministic answer regression 추가.
- `tests/evaluationRequirementCompleteness.test.ts`
  - standalone node:test coverage 추가.
- `tests/ragGoldenCases.test.ts`
  - 신규 generic golden case id 존재 확인 추가.

### 의도적으로 피한 구현

- `detectRecipientRightsGuidelineQuestion()`
- `RECIPIENT_RIGHTS_GUIDELINE_ITEMS` 중심 production logic
- `missing-recipient-rights-*` 또는 `missing-eight-guideline-*` validation code
- 특정 문서명만 보는 retrieval fast path
- 8대 지침 문자열을 validation/generation/retrieval 함수 내부의 직접 기준으로 삼는 구조

### 현재 검증 상태

- `npm.cmd run lint`
  - 통과.
  - TypeScript client/server compile 모두 통과.
- `npm.cmd run rag:test`
  - 통과.
  - 조치: `queryIntent.ts`의 non-enumeration visible document cap을 2로 맞춰 `testTopFiveCandidatesAreDocumentDiverse` 기대와 일치시켰다.
  - 관련 조정: `ragEngine.ts` 기본 visible document cap도 2로 맞췄다.
  - generic completeness regression도 `scripts/rag-regression-test.ts`에 포함되어 통과했다.
- `npm.cmd run rag:bench`
  - 실행 완료, exit code 0.
  - 결과 저장: `.rag-cache/rag-benchmark.json`
  - latest archive: `benchmarks/results/rag-benchmark-2026-05-07T14-30-48-467Z.json`
  - Top-3 / Top-5 doc recall: 90.3% / 90.3%
  - Expected evidence pass: 100.0%
  - Forbidden evidence pass: 100.0%
  - Required citation pass: 100.0%
  - Validation signal pass: 100.0% (7 checks)
  - Claim coverage pass: 100.0% (3 checks)
  - 신규 `evaluation-completeness-*` 4건은 모두 Top-3/Top-5/evidence/validation pass.
  - Top-5 miss: `integrated-protection-manual`, `evaluation-employee-rights-education`, `integrated-no-grounded-answer`.
  - benchmark 명령 자체는 성공했지만 README의 Phase 2 final 기준선(Top-3/Top-5 96.3%)보다 낮으므로 위 3개 기존 case recall은 후속 ranking 검토 필요.
- `npx.cmd tsx --test tests/evaluationRequirementCompleteness.test.ts tests/ragGoldenCases.test.ts`
  - 실패.
  - 원인: sandbox child process 제한으로 보이는 `spawn EPERM`.
  - 테스트 코드 자체의 assertion 실패가 아니라 runner 실행 제한.

### 다음 스레드 handoff

다음 스레드는 먼저 `git status --short --branch`로 작업 파일을 확인한다. 현재 completeness layer 자체는 `npm.cmd run lint`, `npm.cmd run rag:test`, `npm.cmd run rag:bench`를 통과했고, 신규 `evaluation-completeness-*` 4건도 benchmark에서 모두 통과했다. 다음 우선순위는 기존 Top-5 miss 3건(`integrated-protection-manual`, `evaluation-employee-rights-education`, `integrated-no-grounded-answer`)이 이번 변경 전후의 품질 기준선에서 허용 가능한지 확인하는 것이다.

## 2026-05-07 / 후속 정리

### 정리 내용

- `src/lib/expertAnswering.ts`의 `suppressSelectedServiceScopeClarification()` 안에 잘못 삽입되어 있던 죽은 checklist block 코드를 제거했다.
- 금지된 production naming 재확인:
  - `detectRecipientRights*`, `RECIPIENT_RIGHTS*`, `missing-recipient-*`, `missing-eight-*`, `eight-guideline`은 production code에 없음.
  - 위 문자열은 이 보고서의 "피한 구현" 목록 또는 test fixture 식별자에만 남아 있다.

### 최신 검증 결과

- `npm.cmd run lint`: 통과.
- `npm.cmd run rag:test`: 통과.
- `npm.cmd run rag:bench`: 통과.
  - latest archive: `benchmarks/results/rag-benchmark-2026-05-07T14-34-22-493Z.json`
  - Top-3 / Top-5 doc recall: 90.3% / 90.3%
  - Expected evidence pass: 100.0%
  - Forbidden evidence pass: 100.0%
  - Required citation pass: 100.0%
  - Validation signal pass: 100.0% (7 checks)
  - Claim coverage pass: 100.0% (3 checks)

### 이어서 볼 지점

- 이번 P0 범위는 "8대 지침 전용 기능"이 아니라 `EvaluationRequirementCompleteness` 범용 layer를 도입하고 8대 지침을 fixture/golden case로 고정하는 데 초점을 맞췄다.
- 다음 단계에서 다른 평가문서 fixture를 하나 더 추가하면, 현재 설계가 특정 샘플에 과적합되지 않았는지 더 강하게 검증할 수 있다.

## 2026-05-07 / 두 번째 fixture 추가

### 추가 목적

8대 지침 checklist 샘플에만 구조가 맞춰지지 않았는지 확인하기 위해 `01-06-직원교육`을 두 번째 평가 요구사항 fixture로 추가했다. 이 fixture는 checklist보다 기록 필드와 조건부 기한에 초점을 둔다.

### 추가 내용

- `src/lib/evaluationRequirementCompleteness.ts`
  - `employeeEducationFixture` 추가.
  - 요구사항: 모든 직원, 연 1회 이상, 운영규정 교육, 급여제공지침 교육, 교육일자, 교육방법, 강사명, 참석자명(서명).
  - 조건부 요구사항: 신규직원은 급여제공 시작일로부터 7일 이내, 퇴사/퇴직신고 관련 예외·불인정, 기준①/기준③ 연동 불인정.
  - evidence selector는 split 문서 `01-06-직원교육`과 원문 `2026년 주야간보호 평가매뉴얼` 양쪽을 허용한다.
- `benchmarks/golden-cases.json`
  - `evaluation-completeness-staff-education-record-fields`
  - `evaluation-completeness-new-staff-education-deadline`
- `scripts/rag-regression-test.ts`
  - 두 번째 fixture가 generic matching, generic validation issue, deterministic answer builder를 재사용하는지 확인하는 regression 추가.
- `tests/evaluationRequirementCompleteness.test.ts`
  - 직원교육 record field/deadline fixture 단위 테스트 추가.
- `tests/ragGoldenCases.test.ts`
  - 신규 golden case id 존재 확인 추가.

### 최신 검증 결과

- `npm.cmd run lint`: 통과.
- `npm.cmd run rag:test`: 통과.
- `npm.cmd run rag:bench`: 통과.
  - latest archive: `benchmarks/results/rag-benchmark-2026-05-07T14-49-56-036Z.json`
  - Top-3 / Top-5 doc recall: 90.9% / 90.9%
  - Expected evidence pass: 100.0%
  - Forbidden evidence pass: 100.0%
  - Required citation pass: 100.0%
  - Validation signal pass: 100.0% (9 checks)
  - Claim coverage pass: 100.0% (3 checks)
  - 신규 직원교육 completeness 2건은 모두 Top-3/Top-5/evidence/validation pass.

### 다음 후보

- benchmark는 성공하지만 Top-3/Top-5 recall은 90.9%로, 기존 ranking miss가 여전히 남아 있다.
- 최신 `failedCaseIds`는 `integrated-protection-manual`, `evaluation-employee-rights-education` 2건이다.
- 다음 단계는 위 2건의 ranking miss를 completeness layer와 분리해서 조정하는 것이 좋다.

## 2026-05-07 / ranking miss 2건 회복

### 원인

- `integrated-protection-manual`
  - 질문은 "재가요양보호사 인권보호 매뉴얼"을 찾는 document lookup인데, evaluation completeness matching이 query alias까지 포함해 `02-05-노인인권보호` requirement를 잘못 매칭했다.
  - 결과적으로 문서 찾기 질문에 평가요건 boost가 적용되어 `02-05-노인인권보호`가 Top-K를 점유했다.
- `evaluation-employee-rights-education`
  - `직원인권침해교육` 질의를 표현하는 별도 직원인권보호 requirement fixture가 없어 `01-06-직원교육`, `02-05-노인인권보호` 쪽으로 신호가 분산됐다.

### 조치

- `src/lib/nodeRagService.ts`
  - evaluation completeness boost/instruction matching을 `document_lookup` retrieval priority에서는 적용하지 않도록 제한했다.
  - requirement matching 입력을 broad alias 전체가 아니라 normalized query와 search variants 중심으로 줄여, ontology alias가 unrelated requirement를 끌어오는 현상을 줄였다.
- `src/lib/evaluationRequirementCompleteness.ts`
  - `employeeRightsProtectionFixture` 추가.
  - 요구사항: 직원 인권보호 기관 노력, 모든 수급자(보호자), 연 1회 이상, 폭언·폭행·성희롱 예방, 직원과 수급자의 상호존중, 안내일자/방법/내용, 수급자명, 보호자명(관계), 평가 당일 기록 확인.
  - 조건부 요구사항: 신규수급자 급여제공 시작일까지 안내, 평가 당일 기록 미확인 시 불인정(N).
  - `questionHasEvaluationRequirementIntent()`에 `교육`을 추가했다.
  - matching scorer를 조정해 requirement title/alias 같은 core hit를 우선하고, 조건부 item 단독 hit가 다른 requirement를 과하게 앞지르지 않도록 했다.
- `scripts/rag-regression-test.ts`, `tests/evaluationRequirementCompleteness.test.ts`
  - `직원인권침해교육은 어떻게 해야해`가 `evaluation-completeness-staff-rights-protection-guidance` fixture로 매칭되는 regression 추가.

### 최신 검증 결과

- `npm.cmd run lint`: 통과.
- `npm.cmd run rag:test`: 통과.
- `npm.cmd run rag:bench`: 통과.
  - latest archive: `benchmarks/results/rag-benchmark-2026-05-07T14-58-30-601Z.json`
  - total cases: 33
  - Top-3 / Top-5 doc recall: 97.0% / 97.0%
  - Expected evidence pass: 100.0%
  - Forbidden evidence pass: 100.0%
  - Required citation pass: 100.0%
  - Validation signal pass: 100.0% (9 checks)
  - Claim coverage pass: 100.0% (3 checks)
  - `failedCaseIds`: none
  - `failedEvidenceCaseIds`: none

### 확인된 회복 케이스

- `integrated-protection-manual`
  - Top-3/Top-5 pass.
  - evidence docs: `(붙임)_재가요양보호사_인권보호_매뉴얼(PDF)_최종`, `「재가요양보호사 인권보호 매뉴얼」 활용 안내`.
- `evaluation-employee-rights-education`
  - Top-3/Top-5 pass.
  - final evidence는 기존 primary evidence 기준대로 `2026년 주야간보호 평가매뉴얼(26년꺼만)` 유지.
- `evaluation-employee-rights-primary-evidence`
  - Top-3/Top-5/evidence/forbidden evidence/citation 모두 pass.

## 2026-05-08 / checkpoint 검증 고정

### 실행한 명령

- `npm.cmd run rag:index`
  - 통과.
  - cached embeddings 20개 복원.
  - local cache 기준 13,799 chunks 인덱싱.
- `npm.cmd run rag:bench`
  - 통과.
  - latest archive: `benchmarks/results/rag-benchmark-2026-05-07T15-07-43-992Z.json`
- `npm.cmd run rag:quality-report`
  - 통과.
  - sandbox에서는 `tsx/esbuild spawn EPERM`이 발생해 escalated 실행으로 완료.
  - `.rag-cache/rag-quality-report.json`, `docs/reports/rag-quality-report.md` 갱신.
- `npm.cmd run rag:baseline`
  - 통과.
  - sandbox에서는 `tsx/esbuild spawn EPERM`이 발생해 escalated 실행으로 완료.
  - 출력 기준선: `benchmarks/results/rag-benchmark-2026-05-06T14-46-10-399Z.json`

### 최신 benchmark 지표

- total cases: 33
- Top-3 / Top-5 doc recall: 97.0% / 97.0%
- Expected evidence pass: 100.0%
- Forbidden evidence pass: 100.0%
- Required citation pass: 100.0%
- Validation signal pass: 100.0% (9 checks)
- Claim coverage pass: 100.0% (3 checks)
- `failedCaseIds`: none
- `failedEvidenceCaseIds`: none
- accepted abstain: `integrated-no-grounded-answer`

### 최신 quality report 요약

- generatedAt: `2026-05-07T15:07:54.002Z`
- documents: 144
- chunks: 13,799
- embeddingCount: 20
- embeddingCoverageRatio: 0.001449380389883325
- doctorIssueCount: 91
- latency:
  - average total: 524ms
  - p50 total: 120ms
  - p95 total: 2,115ms
  - max total: 6,090ms
- 주요 slow case:
  - `evaluation-completeness-recipient-rights-checklist`
  - `evaluation-completeness-new-recipient-deadline`
  - `evaluation-employee-rights-education`

### 최종 점검

- 금지된 production logic 이름 재확인:
  - `detectRecipientRights*`, `RECIPIENT_RIGHTS*`, `missing-recipient-*`, `missing-eight-*`, `eight-guideline`은 production code에 없음.
  - 위 문자열은 이 progress report와 golden case note에만 남아 있다.
- 현재 implementation은 `EvaluationRequirementCompleteness` 범용 layer 중심이다.
- 8대 지침은 fixture/golden/regression sample로만 사용한다.

### 남은 리스크

- embedding coverage가 20 / 13,799 chunks로 매우 낮다. 검색은 현재 lexical/ontology 중심으로 통과하지만, 변형 질의 recall을 장기적으로 안정화하려면 embedding coverage 복구가 필요하다.
- p95 latency가 2초 이상이며, 느린 케이스는 procedure-aspect retrieval overhead가 크다. 다음 성능 단계에서는 completeness matched requirement 기반 fast path나 procedure-aspect 제한 조건을 별도로 다루는 것이 좋다.

## 2026-05-08 / completeness latency 최적화

### 원인

checkpoint quality report에서 느린 케이스가 `evaluation-completeness-*`와 `evaluation-employee-rights-education`에 집중됐다. 상세 trace를 확인하니 matched evaluation requirement evidence가 이미 선택된 뒤에도 `procedure-aspect-union`이 5개 aspect query를 추가 실행하면서 retrieval overhead가 커졌다.

### 조치

- `src/lib/nodeRagService.ts`
  - `evidenceMatchesEvaluationRequirement()`를 사용해 matched requirement의 source evidence가 이미 검색 evidence에 포함됐는지 확인한다.
  - matched requirement evidence가 있으면 `procedure-aspect` 확장을 건너뛴다.
  - trace에 `procedure-aspect-skip: matched evaluation requirement evidence already selected`를 남긴다.
  - 기존 document lookup/evaluation completeness 분리 로직은 유지한다.

### 최신 검증 결과

- `npm.cmd run lint`: 통과.
- `npm.cmd run rag:test`: 통과.
- `npm.cmd run rag:bench`: 통과.
  - latest archive: `benchmarks/results/rag-benchmark-2026-05-07T15-13-14-221Z.json`
  - total cases: 33
  - Top-3 / Top-5 doc recall: 97.0% / 97.0%
  - Expected evidence pass: 100.0%
  - Forbidden evidence pass: 100.0%
  - Required citation pass: 100.0%
  - Validation signal pass: 100.0% (9 checks)
  - Claim coverage pass: 100.0% (3 checks)
  - `failedCaseIds`: none
  - `failedEvidenceCaseIds`: none
- `npm.cmd run rag:quality-report`: 통과.
  - sandbox에서는 `tsx/esbuild spawn EPERM`이 발생할 수 있어 escalated 실행으로 완료.
  - generatedAt: `2026-05-07T15:15:15.585Z`
- `npm.cmd run rag:baseline`: 통과.
  - sandbox에서는 `tsx/esbuild spawn EPERM`이 발생할 수 있어 escalated 실행으로 완료.

### latency 변화

- 이전 checkpoint:
  - average total: 524ms
  - p50 total: 120ms
  - p95 total: 2,115ms
  - max total: 6,090ms
  - retrieval p95: 1,516ms
- 최적화 후:
  - average total: 322ms
  - p50 total: 118ms
  - p95 total: 1,544ms
  - max total: 2,088ms
  - retrieval p95: 295ms

### 확인된 trace

- `evaluation-completeness-recipient-rights-checklist`
  - `evaluation-requirement-match`
  - `procedure-aspect-skip`
- `evaluation-completeness-new-recipient-deadline`
  - `evaluation-requirement-match`
  - `procedure-aspect-skip`
- `evaluation-employee-rights-education`
  - `evaluation-requirement-match`
  - `procedure-aspect-skip`

### 남은 리스크

- correctness 지표는 유지됐지만 p95 total은 아직 1.5초대다. 다음 성능 단계는 deterministic answer fast path가 실제 chat path에서 더 일찍 반환되도록 retrieval/evidence assembly 이후 경로를 더 줄이는 방향이 좋다.
- embedding coverage는 여전히 20 / 13,799 chunks 수준이다. 변형 질의 recall 안정화는 embedding coverage 복구가 별도 과제로 남아 있다.

## 2026-05-08 / embedding readiness investigation

### 목적

evaluation completeness layer는 현재 lexical/ontology 중심에서도 benchmark를 통과하지만, 변형 질의 recall을 안정화하려면 embedding coverage 복구가 필요하다. 이번 단계는 embedding 0에 가까운 상태가 인덱서 버그인지, 환경/API key 미설정인지 분리하는 것이다.

### 확인한 환경

- `RAG_EMBEDDING_API_KEY`: not configured
- `GEMINI_API_KEY`: not configured
- `DATABASE_URL`: not configured
- `resolveEmbeddingApiKey()` would return: none
- `.rag-cache/embeddings.json`: exists, but only restores 20 cached embeddings

### 확인한 코드 경로

- `src/lib/ragRuntime.ts`
  - `resolveEmbeddingApiKey()`는 `RAG_EMBEDDING_API_KEY || GEMINI_API_KEY || ''` 순서로 key를 찾는다.
- `scripts/rag-index.ts`
  - `.rag-cache/embeddings.json`에 있는 cached embeddings를 먼저 복원한다.
  - embedding API key가 있을 때만 `GoogleGenAI`를 만들고 missing chunks embedding 생성을 시도한다.
  - key가 없으면 embedding generation 없이 local index만 쓴다.
- `src/lib/embeddingService.ts`
  - model: `gemini-embedding-001`
  - dimensions: 768
  - default batch size: 20
  - default max chunks per pass: 400
  - quota cooldown 기본값: 6 hours
- `scripts/rag-embedding-verify.ts`
  - `.rag-cache/rag-embedding-verify.json`와 `docs/reports/rag-embedding-verify.md`를 생성한다.
  - missing reason이 `embedding_api_key_missing`, `cache_available_not_restored`, `embedding_not_generated` 등으로 분리된다.

### 실행한 명령과 결과

- environment check
  - secrets는 출력하지 않고 key 존재 여부만 확인했다.
  - 결과: embedding key 없음, Gemini key 없음, DB URL 없음.
- `npm.cmd run rag:embedding-verify`
  - sandbox에서는 `tsx/esbuild spawn EPERM`으로 실패했다.
  - escalated run으로 재실행하여 통과했다.
  - 생성/갱신 파일:
    - `.rag-cache/rag-embedding-verify.json`
    - `docs/reports/rag-embedding-verify.md`

### 현재 embedding 상태

- total chunks: 13,799
- embedded chunks: 20
- missing chunks: 13,779
- missing reason summary:
  - `embedding_api_key_missing`: 13,779
- 결론: 현재 embedding coverage 부족의 직접 원인은 production code의 추출/복원 실패가 아니라 embedding API key 미설정이다. key가 없어서 20개 cached embedding 외에는 생성이 수행되지 않는다.

### 다음 스레드 handoff

먼저 읽을 파일:

1. `docs/reports/evaluation-requirement-completeness-progress.md`
   - 전체 작업 흐름, 완료된 구현, benchmark 결과, 남은 리스크를 확인한다.
2. `docs/reports/rag-embedding-verify.md`
   - 현재 embedding 누락 수와 누락 reason summary를 확인한다.
3. `src/lib/evaluationRequirementCompleteness.ts`
   - generic completeness rule/fixture/matching/boost/instruction/validation의 중심 구현이다.
4. `src/lib/nodeRagService.ts`
   - matched evaluation requirement 기반 retrieval boost, chunk boost, deterministic answer fast path 연결 지점을 확인한다.
5. `src/lib/expertAnswering.ts`
   - completeness instruction과 `tryBuildDeterministicEvaluationRequirementAnswer()` 구현을 확인한다.
6. `src/lib/ragSemanticValidation.ts`
   - generic validation issue 연결과 `validateAnswerEnvelope({ question })` 흐름을 확인한다.
7. `benchmarks/golden-cases.json`
   - evaluation completeness golden cases와 `requiredAnswerTerms` 필드를 확인한다.
8. `tests/evaluationRequirementCompleteness.test.ts`, `tests/ragGoldenCases.test.ts`, `scripts/rag-regression-test.ts`
   - fixture 기반 regression과 golden case 포함 여부를 확인한다.
9. `src/lib/ragRuntime.ts`, `scripts/rag-index.ts`, `src/lib/embeddingService.ts`, `scripts/rag-embedding-verify.ts`
   - embedding key resolution, cached embedding restore, missing embedding generation, verification report 경로를 확인한다.

현재 작업트리에서 관련 신규/수정 파일이 많으므로, 다음 스레드는 시작 시 `git status --short --branch`를 먼저 실행하고 위 파일들 위주로 diff를 확인하는 것이 안전하다.

환경 파일 상태:

- `.env.local`을 생성했다.
- `.env.local`은 `.gitignore`에 포함되어 있으며 `git check-ignore .env.local`로 ignore 적용을 확인했다.
- 사용자가 local test용 `RAG_EMBEDDING_API_KEY` 값을 `.env.local`에 저장했다.
- 다음 스레드는 key 값을 출력하거나 report에 복사하지 말고, 존재 여부만 확인해야 한다.

다음 작업:

1. `.env.local`에서 `RAG_EMBEDDING_API_KEY`가 설정되어 있는지 값 출력 없이 확인한다.
2. quota 확인을 위해 작은 smoke부터 실행한다.

```powershell
npm.cmd run rag:index
npm.cmd run rag:embedding-verify
```

3. 기대 결과:
   - missing chunks가 13,779에서 최소 일부 감소한다.
   - embedded chunks가 20에서 증가한다.
   - `embedding_api_key_missing` reason이 사라지거나 크게 줄어든다.
4. smoke가 통과하면 pass size를 50, 100, 400 순서로 점진 확대한다.
5. embedding coverage가 늘어난 뒤 다시 실행한다.

```powershell
npm.cmd run rag:bench
npm.cmd run rag:quality-report
```

### 주의

- 현재 sandbox에서는 `tsx/esbuild spawn EPERM` 때문에 `rag:embedding-verify`, `rag:quality-report`, `rag:baseline` 계열 명령이 escalation을 필요로 할 수 있다.
- `DATABASE_URL`이 없어 이번 검증은 local cache/index 기준이다. Postgres pgvector 서버 상태는 별도 DB 연결 후 확인해야 한다.

## 2026-05-08 / 5-chunk embedding smoke completed

### 실행 전 확인

- `.env.local`에 `RAG_EMBEDDING_API_KEY` line이 있고 값이 비어 있지 않음을 확인했다.
- key 값은 출력하지 않았다.
- 중요한 발견:
  - 현재 scripts는 `dotenv.config()`만 호출하므로 `.env.local`을 자동 로드하지 않는다.
  - 이번 smoke에서는 PowerShell에서 `.env.local`을 읽어 process env로 주입한 뒤 `npm.cmd run rag:index`와 `npm.cmd run rag:embedding-verify`를 실행했다.
  - 후속 개선으로 scripts 공통 env loading을 `.env.local` + `.env` 순서로 명시화하는 작업을 고려할 수 있다.

### 실행한 명령

`rag:index`와 `rag:embedding-verify`는 sandbox에서 `tsx/esbuild spawn EPERM`이 발생하여 escalated run으로 완료했다. key 값은 출력하지 않았다.

```powershell
# .env.local 값을 process env로 주입한 뒤 실행
npm.cmd run rag:index
npm.cmd run rag:embedding-verify
```

추가 검증:

```powershell
npm.cmd run rag:bench
npm.cmd run rag:quality-report
npm.cmd run rag:test
```

`rag:quality-report`도 sandbox에서 `tsx/esbuild spawn EPERM`이 발생하여 escalated run으로 완료했다.

### smoke 결과

- `npm.cmd run rag:index`
  - Restored cached embeddings before indexing: 20
  - Embedded in pass 1: 5
  - Missing after pass 1: 13,774 / 13,799
  - Indexed chunks: 13,799
- `npm.cmd run rag:embedding-verify`
  - total chunks: 13,799
  - embedded chunks: 25
  - missing chunks: 13,774
  - missing reason summary:
    - `embedding_not_generated`: 13,774
  - 이전의 `embedding_api_key_missing` reason은 사라졌다.

### benchmark / quality 결과

- `npm.cmd run rag:bench`: 통과
  - archive: `benchmarks/results/rag-benchmark-2026-05-07T15-37-25-724Z.json`
  - total cases: 33
  - Top-3 / Top-5 doc recall: 97.0% / 97.0%
  - Expected evidence pass: 100.0%
  - Forbidden evidence pass: 100.0%
  - Required citation pass: 100.0%
  - Validation signal pass: 100.0% (9 checks)
  - Claim coverage pass: 100.0% (3 checks)
  - `failedCaseIds`: none
  - `failedEvidenceCaseIds`: none
  - latency:
    - average total: 316.5ms
    - p50 total: 123ms
    - p95 total: 1,532ms
    - max total: 2,064ms
    - retrieval p95: 291ms
- `npm.cmd run rag:quality-report`: 통과
  - generatedAt: `2026-05-07T15:37:37.726Z`
  - embeddingCount: 25
  - embeddingCoverageRatio: 0.001811725487354156
  - doctorIssueCount: 91
- `npm.cmd run rag:test`: 통과

### 다음 스레드 handoff update

다음 스레드는 embedding smoke가 성공했다는 전제에서 시작하면 된다. 먼저 `docs/reports/evaluation-requirement-completeness-progress.md`의 이 섹션과 `docs/reports/rag-embedding-verify.md`를 읽고, `.env.local`의 key 값은 출력하지 말 것.

다음 작업 후보:

1. scripts가 `.env.local`을 자동 로드하도록 공통 env loading을 정리한다.
   - 현재는 `.env.local`에 key가 있어도 `dotenv.config()`만으로는 자동 반영되지 않는다.
   - 후속 실행 편의를 위해 `.env.local`을 먼저 읽고 `.env`를 fallback으로 읽는 helper를 만들거나 각 script entry에서 명시 로드할 수 있다.
2. embedding pass size를 점진 확대한다.
   - 현재 `.env.local`은 smoke limit 상태다.
   - 다음 단계 예:

```powershell
RAG_EMBEDDING_MAX_CHUNKS_PER_PASS=50
RAG_EMBEDDING_INDEX_MAX_PASSES=1
RAG_EMBEDDING_BATCH_SIZE=5
```

3. 확대 후 다시 실행한다.

```powershell
npm.cmd run rag:index
npm.cmd run rag:embedding-verify
npm.cmd run rag:bench
npm.cmd run rag:quality-report
```

4. coverage가 충분히 늘어난 뒤 vector candidate가 benchmark diagnostics에서 실제로 나타나는지 확인한다.

## 2026-05-08 / common env loading and 50-chunk pass

### Code changes

- Added `scripts/load-env.ts`.
  - Loads `.env.local` first and `.env` second.
  - Uses `override: false`, so existing shell/process env values remain authoritative.
  - Uses `quiet: true`, so dotenv tips do not pollute script output.
- Added `scripts/register-env.ts` and imported it as the first import in TS script entries.
  - This is intentionally a side-effect import because ESM evaluates static imports before script body code.
  - A body-level `loadScriptEnv()` call would be too late for import-time env constants such as embedding settings.
- Replaced direct `dotenv.config()` calls in scripts with the common register import.
- Added `tests/scriptEnv.test.ts` to cover `.env.local` first, `.env` fallback, and shell env precedence.
- Updated `src/lib/nodeRagService.ts` to call `unref()` on the background embedding refresh timer.
  - Without this, `rag:bench` produced output but stayed alive when `.env.local` provided an embedding key.

### Verification

- `npx.cmd tsx --test tests/scriptEnv.test.ts`: passed.
- `npm.cmd run lint`: passed.
- `npm.cmd run rag:test`: passed.
- `npm.cmd run rag:index` with `RAG_EMBEDDING_MAX_CHUNKS_PER_PASS=50`, `RAG_EMBEDDING_INDEX_MAX_PASSES=1`, `RAG_EMBEDDING_BATCH_SIZE=5`:
  - First pass after env loading: restored 25 cached embeddings, embedded 50, missing 13,724 / 13,799.
  - Final consistency pass: restored 90 cached embeddings, embedded 35 before quota exhaustion, missing 13,674 / 13,799.
  - Quota stopped the final pass at batch 35-40; no secret value was printed.
- `npm.cmd run rag:embedding-verify`: passed.
  - total chunks: 13,799
  - embedded chunks: 125
  - missing chunks: 13,674
  - missing reason summary: `embedding_not_generated`: 13,674
  - embedding API configured: yes
  - database configured: no
- `npm.cmd run rag:bench`: passed after timer `unref()` fix.
  - archive: `benchmarks/results/rag-benchmark-2026-05-08T02-15-08-727Z.json`
  - total cases: 33
  - Top-3 / Top-5 doc recall: 97.0% / 97.0%
  - Expected evidence pass: 100.0%
  - Forbidden evidence pass: 100.0%
  - Required citation pass: 100.0%
  - Validation signal pass: 100.0% (9 checks)
  - Claim coverage pass: 100.0% (3 checks)
  - `failedCaseIds`: none
  - `failedEvidenceCaseIds`: none
  - latency: average total 1,120.2ms, p95 total 3,923ms, retrieval p95 672ms
- `npm.cmd run rag:quality-report`: passed.
  - embeddingCount: 125
  - embeddingCoverageRatio: 0.00905862743677078
  - doctorIssueCount: 91

### Next handoff

- Embedding coverage improved from 25 / 13,799 to 125 / 13,799.
- The direct missing-key failure is resolved; missing reason is now `embedding_not_generated`.
- Further embedding passes should wait for quota recovery or use smaller passes.
- `DATABASE_URL` is still not configured, so verification remains local cache/index based.
- Because scripts now load `.env.local`, benchmark/runtime scripts can generate a small amount of embedding work when an embedding key is configured. The `unref()` fix prevents that background timer from hanging CLI runs.

## 2026-05-08 / read-only benchmark embedding guard

### Why

After common env loading, `rag:bench` restored cached chunk embeddings but could also trigger chunk embedding generation through `NodeRagService.initialize()`. That made benchmark runs consume embedding quota and mutate `.rag-cache/embeddings.json`, even though chunk generation is already owned by `rag:index`.

### Code changes

- Added `RAG_DISABLE_CHUNK_EMBEDDING_GENERATION` support in `src/lib/embeddingService.ts`.
  - When set to `true`, `embedChunks()` returns without calling the embedding API.
  - Query embeddings remain enabled, so benchmark can still exercise vector retrieval against already cached chunk embeddings.
- Set `process.env.RAG_DISABLE_CHUNK_EMBEDDING_GENERATION ??= 'true'` in `scripts/rag-benchmark.ts`.
  - `rag:bench` is now read-only for chunk embedding cache by default.
  - Operators can still override by setting the env var before running the script if needed.
- Extended `tests/embeddingService.test.ts` to prove disabled chunk embedding does not call the AI client and does not mutate chunks.

### Verification

- `npx.cmd tsx --test tests/embeddingService.test.ts tests/scriptEnv.test.ts`: passed.
- `npm.cmd run lint`: passed.
- `npm.cmd run rag:bench`: passed.
  - restored 125 cached chunk embeddings from disk.
  - no `cached additional chunk embeddings` log appeared.
  - archive: `benchmarks/results/rag-benchmark-2026-05-08T02-44-24-867Z.json`
  - total cases: 33
  - Top-3 / Top-5 doc recall: 97.0% / 97.0%
  - Expected evidence pass: 100.0%
  - Forbidden evidence pass: 100.0%
  - Required citation pass: 100.0%
  - Validation signal pass: 100.0% (9 checks)
  - Claim coverage pass: 100.0% (3 checks)
  - `failedCaseIds`: none
  - `failedEvidenceCaseIds`: none
  - vector candidate output: average 21.8, max 48
  - latency: average total 3,773.4ms, p95 total 15,460ms, retrieval p95 6,917ms
- `npm.cmd run rag:embedding-verify`: passed.
  - embedded chunks: 125
  - missing chunks: 13,674
  - missing reason summary: `embedding_not_generated`: 13,674
- `npm.cmd run rag:quality-report`: passed.
  - embeddingCount: 125
  - embeddingCoverageRatio: 0.00905862743677078
- `npm.cmd run rag:test`: passed.

### Next handoff

- Correctness remains stable with vector candidates active.
- The next optimization target is latency with query/vector embedding enabled. Current p95 total rose to 15.46s, driven by retrieval/query embedding path rather than answer generation.
- Good next options:
  - cache benchmark query embeddings across cases/runs, or
  - add a benchmark mode that reports lexical-only vs vector-enabled latency separately, or
  - continue chunk embedding only after quota recovery via `rag:index`, then rerun read-only `rag:bench`.

## 2026-05-08 / query embedding disk cache

### Why

The read-only benchmark guard stopped chunk embedding mutation, but query embeddings were still generated on every fresh `rag:bench` process. With vector retrieval active, this dominated benchmark latency and consumed avoidable API calls.

### Code changes

- Added `src/lib/queryEmbeddingCache.ts`.
  - Builds SHA-1 cache keys from `model + dimensions + trimmed query`.
  - Persists only vectors, not raw query text.
  - Ignores malformed cache entries.
- Updated `NodeRagService.getQueryEmbedding()` to use `.rag-cache/query-embeddings.json`.
  - In-memory cache is still checked first.
  - Disk cache is loaded once per service instance.
  - Successful query embeddings are persisted for later CLI runs.
- Added `tests/queryEmbeddingCache.test.ts`.

### Verification

- `npx.cmd tsx --test tests/queryEmbeddingCache.test.ts tests/embeddingService.test.ts tests/scriptEnv.test.ts`: passed.
- `npm.cmd run lint`: passed.
- `npm.cmd run rag:bench` cold query-cache warm-up: passed.
  - archive: `benchmarks/results/rag-benchmark-2026-05-08T03-05-57-993Z.json`
- `npm.cmd run rag:bench` warm query-cache run: passed.
  - archive: `benchmarks/results/rag-benchmark-2026-05-08T03-07-29-981Z.json`
  - total cases: 33
  - Top-3 / Top-5 doc recall: 97.0% / 97.0%
  - Expected evidence pass: 100.0%
  - Forbidden evidence pass: 100.0%
  - Required citation pass: 100.0%
  - Validation signal pass: 100.0% (9 checks)
  - Claim coverage pass: 100.0% (3 checks)
  - `failedCaseIds`: none
  - vector candidate output: average 21.8, max 48
  - latency: average total 618.7ms, p50 213ms, p95 total 3,149ms, max 4,339ms
  - retrieval latency: average 309.3ms, p50 205ms, p95 669ms, max 2,467ms
  - query embedding cache entries: 32
- `npm.cmd run rag:embedding-verify`: passed.
  - embedded chunks: 125 / 13,799
  - missing reason summary: `embedding_not_generated`: 13,674
- `npm.cmd run rag:quality-report`: passed.
  - embeddingCount: 125
  - embeddingCoverageRatio: 0.00905862743677078
- `npm.cmd run rag:test`: passed.

### Result

- Vector-enabled benchmark remains correct and now has stable warm-cache latency.
- p95 total improved from 15,460ms in the previous vector-enabled benchmark to 3,149ms with query embedding disk cache.
- Chunk embedding generation remains owned by `rag:index`; `rag:bench` is still read-only for chunk embeddings.

### Next handoff

- Next useful target is the remaining p95 retrieval spike.
- Focus case from latest benchmark: inspect slow cases in `.rag-cache/rag-benchmark.json`, especially evaluation completeness cases where retrieval max is still above 2s.
- Do not run more chunk embedding passes until quota recovers unless using a very small pass.

## 2026-05-08 / evaluation completeness retrieval spike reduced

### Why

The warm query embedding cache run still had a retrieval max above 2s. The slowest case was `evaluation-completeness-recipient-rights-checklist`, where direct evaluation requirement evidence was already selected but workflow facet expansion still added extra searches.

### Code changes

- Updated `src/lib/nodeRagService.ts` so matched evaluation requirement evidence short-circuits workflow facet expansion.
  - Adds planner trace step `workflow-facet-skip`.
  - Keeps the existing `procedure-aspect-skip` behavior.
- Added `tests/evaluationWorkflowFacetSkip.test.ts`.
- Added a cached `SearchCorpusSnapshot` in `NodeRagService`.
  - Reuses `allChunks`, representative document map, stable document id sets, and recipient onboarding document boosts.
  - Invalidates on runtime rebuild, disk overlay changes, and law fallback chunk insertion.
  - Prewarms after runtime rebuild so the first request does not pay snapshot construction cost.
- Extended `tests/ragExecutionTrace.test.ts` to guard the snapshot/prewarm path.

### Verification

- `npx.cmd tsx --test tests/evaluationWorkflowFacetSkip.test.ts tests/queryEmbeddingCache.test.ts tests/embeddingService.test.ts tests/scriptEnv.test.ts tests/ragExecutionTrace.test.ts`: passed.
- `npm.cmd run lint`: passed.
- `npm.cmd run rag:test`: passed.
- `npm.cmd run rag:bench`: passed.
  - archive: `benchmarks/results/rag-benchmark-2026-05-08T04-26-01-422Z.json`
  - total cases: 33
  - Top-3 / Top-5 doc recall: 97.0% / 97.0%
  - Expected evidence pass: 100.0%
  - Forbidden evidence pass: 100.0%
  - Required citation pass: 100.0%
  - Validation signal pass: 100.0% (9 checks)
  - Claim coverage pass: 100.0% (3 checks)
  - `failedCaseIds`: none
  - `workflow-facet-evidence`: 0 cases
  - `workflow-facet-skip`: `evaluation-completeness-recipient-rights-checklist`
  - latency: average total 620.8ms, p50 206ms, p95 total 2,818ms, max 3,279ms
  - retrieval latency: average 290.6ms, p50 207ms, p95 643ms, max 1,091ms
- `npm.cmd run rag:embedding-verify`: passed.
  - embedded chunks: 135 / 13,799
  - missing chunks: 13,664
  - missing reason summary: `embedding_not_generated`: 13,664
- `npm.cmd run rag:quality-report`: passed.

### Notes

- Embedded chunks are now 135 / 13,799. During cache restore cleanup, `rag:index` restored 130 cached embeddings and added 5 more through the index embedding path. The key value was not printed or copied.
- `rag:bench` remains read-only for chunk embedding generation.
- `rag:index` still has a separate embedding path that does not fully honor `RAG_DISABLE_CHUNK_EMBEDDING_GENERATION`; a useful follow-up is to apply the same guard there.

### Next handoff

- Correctness is stable and the largest retrieval spike has been reduced.
- Remaining slow total latency is dominated by deterministic answer/report assembly in a few evaluation cases rather than `workflow-facet`.
- Next useful options:
  - make `rag:index` honor `RAG_DISABLE_CHUNK_EMBEDDING_GENERATION` in its index embedding path, or
  - continue small embedding passes after quota recovery, then rerun `rag:embedding-verify`, `rag:bench`, and `rag:quality-report`.

## 2026-05-08 / rag:index read-only embedding guard completed

### Why

`rag:bench` was already read-only for chunk embeddings, but `rag:index` used the separate `embedIndexRows()` path. When `RAG_DISABLE_CHUNK_EMBEDDING_GENERATION=true` was set, `rag:index` still generated 5 new embeddings during cache restore cleanup.

### Code changes

- Exported `isChunkEmbeddingGenerationDisabled()` from `src/lib/embeddingService.ts`.
- Updated `src/lib/adminOperations.ts` so `embedIndexRows()` returns `0` before API calls when `RAG_DISABLE_CHUNK_EMBEDDING_GENERATION` is enabled.
- Added a regression case in `tests/embeddingService.test.ts` proving `embedIndexRows()` does not call the AI client or mutate rows while disabled.

### Verification

- RED first: `npx.cmd tsx --test tests/embeddingService.test.ts` failed because `embedIndexRows()` returned `1` and called the fake AI client.
- GREEN after fix: `npx.cmd tsx --test tests/embeddingService.test.ts`: passed.
- `npx.cmd tsx --test tests/embeddingService.test.ts tests/scriptEnv.test.ts tests/ragExecutionTrace.test.ts`: passed.
- `npm.cmd run lint`: passed.
- `RAG_DISABLE_CHUNK_EMBEDDING_GENERATION=true npm.cmd run rag:index`: passed.
  - restored cached embeddings: 135
  - embedding pass: embedded 0
  - missing: 13,664 / 13,799
- `npm.cmd run rag:embedding-verify`: passed.
  - embedded chunks: 135 / 13,799
  - missing reason summary: `embedding_not_generated`: 13,664
- `npm.cmd run rag:quality-report`: passed.
- `npm.cmd run rag:test`: passed.

### Next handoff

- `rag:index` and `rag:bench` now both support read-only chunk embedding runs.
- Embedded chunks remain 135 / 13,799; no new embedding generation happened during the guarded `rag:index` verification.
- Next useful step is either:
  - wait for quota recovery and run a deliberately small embedding pass without the disable flag, or
  - inspect remaining total-latency slow cases in `.rag-cache/rag-benchmark.json` where retrieval is already acceptable but total time is still high.

## 2026-05-08 / 50-chunk pass partial success and latency triage

### What ran

- Ran a deliberately small embedding pass:
  - `RAG_EMBEDDING_MAX_CHUNKS_PER_PASS=50`
  - `RAG_EMBEDDING_INDEX_MAX_PASSES=1`
  - `RAG_EMBEDDING_BATCH_SIZE=5`
  - `npm.cmd run rag:index`

### Result

- Cached embeddings restored before indexing: 135
- New embeddings generated before quota exhaustion: 15
- Missing chunks after pass: 13,649 / 13,799
- The index embedding path hit quota at batch 15-20 and entered cooldown.
- No API key value was printed or copied.

### Verification

- `npm.cmd run rag:embedding-verify`: passed.
  - embedded chunks: 150 / 13,799
  - missing chunks: 13,649
  - missing reason summary: `embedding_not_generated`: 13,649
  - database configured: false
  - embedding API configured: true
- `npm.cmd run rag:bench`: passed.
  - archive: `benchmarks/results/rag-benchmark-2026-05-08T05-48-56-403Z.json`
  - Top-3 / Top-5 doc recall: 97.0% / 97.0%
  - `failedCaseIds`: none
  - Expected evidence pass: 100.0%
  - Forbidden evidence pass: 100.0%
  - Required citation pass: 100.0%
  - Validation signal pass: 100.0% (9 checks)
  - Claim coverage pass: 100.0% (3 checks)
  - total latency: average 825.1ms, p50 308ms, p95 4,478ms, max 5,054ms
  - retrieval latency: average 376.5ms, p50 268ms, p95 960ms, max 1,820ms
- `npm.cmd run rag:quality-report`: passed.
  - embeddingCount: 150
  - embeddingCoverageRatio: 0.010870352924124936
  - doctorIssueCount: 91

### Latency triage after quota failure

- Top total-latency slow cases:
  - `evaluation-day-night-care-disliked-foods`: total 5,054ms, retrieval 626ms, non-retrieval 4,428ms
  - `evaluation-completeness-recipient-rights-checklist`: total 4,478ms, retrieval 1,820ms, non-retrieval 2,658ms
  - `evaluation-completeness-new-recipient-deadline`: total 2,974ms, retrieval 842ms, non-retrieval 2,132ms
  - `evaluation-completeness-staff-education-record-fields`: total 2,073ms, retrieval 596ms, non-retrieval 1,477ms
- Top retrieval slow cases:
  - `evaluation-completeness-recipient-rights-checklist`: retrieval 1,820ms
  - `evaluation-completeness-record-noncompliance`: retrieval 960ms
  - `evaluation-completeness-recipient-rights-frequency`: retrieval 846ms
  - `evaluation-completeness-new-recipient-deadline`: retrieval 842ms
- `evaluation-completeness-recipient-rights-checklist` still shows `workflow-facet-skip`, so the prior workflow facet guard is active.

### Next handoff

- Do not run another embedding generation pass until quota cooldown is over.
- If continuing latency work now, focus first on non-retrieval time in `evaluation-day-night-care-disliked-foods`, then `evaluation-completeness-recipient-rights-checklist`.
- Useful next diagnostic:
  - add benchmark timing around `inspectRetrieval()` post-retrieval work, especially compiled page loading, `buildRetrievalDiagnostics()`, deterministic answer/completeness checks, and benchmark assertion/report assembly.

## 2026-05-11 / non-retrieval latency timing and query read-only guard

### Why

Quota was still not recovered, so no additional embedding generation pass was run. The latest slow cases had large `totalMs - retrievalMs` gaps, so this pass focused on decomposing non-retrieval time and removing avoidable quota/cache-miss latency.

### Code changes

- Added `RAG_DISABLE_QUERY_EMBEDDING_GENERATION` support in `src/lib/embeddingService.ts`.
  - `rag:bench` now sets this to `true` by default, while still reading existing disk-cached query embeddings.
  - This prevents a benchmark cache miss from making a live query embedding API call during quota cooldown.
- Added `queryEmbeddingMs` and `retrievalSetupMs` to `StageLatencyBreakdown`.
  - Benchmark and quality report output now surface query embedding and retrieval setup latency separately.
  - Planner trace now includes `retrieval-setup-timing` with setup sub-phases.
- Reduced retrieval setup work:
  - Cached service-scope compact text and brain workflow boost compact text.
  - Prewarmed those text caches with the existing search corpus snapshot.
  - Cached priority document boosts by retrieval priority class.
  - Skipped brain workflow document boosts when matched evaluation requirement evidence is already driving the query.
  - Made service-scope chunk boosts avoid full body checks unless metadata first matches the selected scope.
- Added a regression test proving disabled query embedding does not call the AI client.

### Verification

- RED first: `npx.cmd tsx --test tests/embeddingService.test.ts` failed because `embedQuery()` still called the fake AI client while `RAG_DISABLE_QUERY_EMBEDDING_GENERATION=true`.
- GREEN after fix: `npx.cmd tsx --test tests/embeddingService.test.ts`: passed.
- `npm.cmd run lint`: passed.
- `npm.cmd run rag:test`: passed.
- `npm.cmd run rag:bench`: passed.
  - archive: `benchmarks/results/rag-benchmark-2026-05-11T01-56-17-537Z.json`
  - total cases: 33
  - Top-3 / Top-5 doc recall: 97.0% / 97.0%
  - Expected evidence pass: 100.0%
  - Forbidden evidence pass: 100.0%
  - Required citation pass: 100.0%
  - Validation signal pass: 100.0% (9 checks)
  - Claim coverage pass: 100.0% (3 checks)
  - `failedCaseIds`: none
  - total latency: average 1,229ms, p50 688ms, p95 3,808ms, max 4,322ms
  - retrieval latency: average 973.4ms, p50 692ms, p95 2,231ms, max 3,762ms
  - query embedding latency: average 1.2ms, p50 0ms, p95 1ms, max 35ms
  - retrieval setup latency: average 299.2ms, p50 1ms, p95 1,242ms, max 2,185ms
- `npm.cmd run rag:quality-report`: passed.
  - generatedAt: `2026-05-11T01:58:33.103Z`
  - embeddingCount: 150
  - embeddingCoverageRatio: 0.010870352924124936
  - doctorIssueCount: 91

### Slow case follow-up

- `evaluation-day-night-care-disliked-foods`
  - before: total 5,054ms, retrieval 626ms, non-retrieval 4,428ms
  - after: total 3,808ms, retrieval 1,592ms, retrieval setup 2,185ms
  - setup detail: `service-scope-chunk-boosts=789ms`, `workflow-document-boosts=1395ms`
- `evaluation-completeness-recipient-rights-checklist`
  - before: total 4,478ms, retrieval 1,820ms, non-retrieval 2,658ms
  - after: total 4,322ms, retrieval 3,762ms, retrieval setup 509ms
  - `workflow-facet-skip` remains active.
- `evaluation-completeness-new-recipient-deadline`
  - before: total 2,974ms, retrieval 842ms, non-retrieval 2,132ms
  - after: total 2,034ms, retrieval 1,664ms, retrieval setup 332ms

### Next handoff

- Non-retrieval setup is now attributed and lower, especially for evaluation completeness cases.
- The remaining p95 is mostly retrieval/sub-search latency, not query embedding or benchmark result assembly.
- Next useful target is evaluation sub-search cost, especially `evaluation-routing` and `evaluation-base` exact/entity scoring for `evaluation-completeness-recipient-rights-checklist`.
- Keep `rag:bench` read-only for both chunk embeddings and query embedding cache misses while quota is exhausted.

## 2026-05-11 / exact scoring cache diagnostics and evaluation boost scan reduction

### Why

Quota is still treated as unavailable, so no embedding pass was run. This pass continued the latency handoff by decomposing retrieval sub-search cost after `inspectRetrieval()`, especially exact scoring in repeated evaluation sub-searches.

### Code changes

- Shared an exact scoring cache across the retrieval plan's memoized sub-searches.
  - `evaluation-routing` still does the first exact pass.
  - Later overlapping sub-searches such as `evaluation-base` can reuse exact candidates/nulls instead of recomputing `scoreExact()`.
- Added exact cache diagnostics to corpus phase timing and search-store latency traces:
  - `phaseExactCacheHits`
  - `phaseExactCacheMisses`
  - `phaseExactCacheSize`
- Reduced per-chunk exact cache key overhead by building the stable exact context signature once per search, then composing chunk-specific keys from corpus size, chunk id, chunk hash, and that signature.
- Combined evaluation requirement document/chunk boost construction into one scan of the chunk corpus instead of two.
- Added a static regression check that retrieval plans create and pass the shared exact scoring cache, and that exact cache diagnostics remain surfaced.
- Attempted a workflow document boost signal index, but reverted it because it reduced `evaluation-notice-period` recall. The final change set does not include that optimization.

### Verification

- `npm.cmd run lint`: passed.
- `npx.cmd tsx --test tests/ragExecutionTrace.test.ts tests/embeddingService.test.ts`: passed.
- `npm.cmd run rag:test`: passed.
- `npm.cmd run rag:bench`: passed.
  - archive: `benchmarks/results/rag-benchmark-2026-05-11T05-17-52-010Z.json`
  - total cases: 33
  - Top-3 / Top-5 doc recall: 97.0% / 97.0%
  - Expected evidence pass: 100.0%
  - Forbidden evidence pass: 100.0%
  - Required citation pass: 100.0%
  - Validation signal pass: 100.0% (9 checks)
  - Claim coverage pass: 100.0% (3 checks)
  - `failedCaseIds`: none
  - total latency: average 756.5ms, p50 410ms, p95 2,068ms, max 2,360ms
  - retrieval latency: average 633.9ms, p50 452ms, p95 1,672ms, max 2,184ms
  - retrieval setup latency: average 138.0ms, p50 1ms, p95 658ms, max 1,237ms
- `npm.cmd run rag:quality-report`: passed.
  - generatedAt: `2026-05-11T05:20:51.380Z`
  - documentCount: 144
  - chunkCount: 13,799
  - embeddingCount: 150
  - embeddingCoverageRatio: 0.010870352924124936
  - doctorIssueCount: 91

### Slow case follow-up

- `evaluation-completeness-recipient-rights-checklist`
  - total 2,360ms, retrieval 2,184ms, retrieval setup 146ms
  - setup detail: `service-scope-chunk-boosts=1ms`, `evaluation-requirement-boosts=145ms`
  - exact cache detail:
    - `evaluation-routing`: hits 0, misses 2,384, `phaseExact=511ms`
    - `evaluation-base`: hits 2,800, misses 0, `phaseExact=136ms`
- `evaluation-completeness-new-recipient-deadline`
  - total 1,258ms, retrieval 1,094ms, retrieval setup 119ms
  - exact cache detail:
    - `evaluation-routing`: hits 0, misses 2,384, `phaseExact=267ms`
    - `evaluation-base`: hits 2,384, misses 0, `phaseExact=75ms`
- `evaluation-day-night-care-disliked-foods`
  - total 2,054ms, retrieval 790ms, retrieval setup 1,237ms
  - setup detail: `service-scope-chunk-boosts=446ms`, `workflow-document-boosts=790ms`
  - exact cache detail:
    - `evaluation-base`: hits 2,437, misses 363, `phaseExact=63ms`

### Next handoff

- Exact scoring reuse is now visible and active; the remaining slow completeness cases are mostly first-pass `evaluation-routing` exact/entity scoring and some workflow/service-scope setup.
- Do not lower `RAG_EVALUATION_ROUTING_MAX_EXACT_CHUNKS` / `RAG_EVALUATION_BASE_MAX_EXACT_CHUNKS` blindly: earlier 1,200 and 1,800 trials caused recall failures for `evaluation-completeness-new-recipient-deadline`.
- The workflow document boost signal-index attempt showed a tempting setup drop but broke `evaluation-notice-period`; any future workflow boost optimization needs a behavioral test for that case before being kept.
- Continue to keep `rag:bench` read-only for chunk embeddings and query embedding cache misses while quota is exhausted.
