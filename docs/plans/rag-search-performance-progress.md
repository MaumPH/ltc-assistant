# RAG 검색성능 고도화 진행상황

기준 계획서: `docs/plans/2026-04-30-rag-search-performance-optimization-plan.md`
시작일: 2026-04-30

---

## 진행 원칙

- 계획서의 작업을 단계별로 진행한다.
- 한 단계가 끝날 때마다 이 파일에 진행상황, 변경 파일, 검증 결과, 다음 단계를 기록한다.
- 기능 구현은 가능한 한 테스트 먼저 작성하고 실패를 확인한 뒤 진행한다.
- 토큰/컨텍스트가 부족해져도 이 파일을 보면 다음 작업자가 이어서 진행할 수 있어야 한다.

---

## 단계별 상태

| 단계 | 상태 | 요약 |
| --- | --- | --- |
| Stage 0 | 완료 | 진행상황 기록 파일 생성 |
| P0-1 | 완료 | RAG 품질 리포트 생성 기능 추가 |
| P0-2 | 완료 | Benchmark 결과 JSON 저장 및 품질 리포트 통합 |
| P0-3 | 완료 | 문서유형별 chunk diagnostics를 품질 리포트에 추가 |
| P0-4 | 완료 | Missing embedding 검증 명령 및 리포트 추가 |
| P1-1 | 완료 | DB lexical retrieval 후보 추가 |
| P1-2 | 완료 | Alias candidate generation 리포트 추가 |
| P1-3 | 완료 | Golden cases 5건 확장 및 기준선 갱신 |
| P1-4 | 완료 | Benchmark miss 진단 리포트 및 stage trace 점검 |
| P1-5 | 완료 | 문서명/exact/evidence 기반 rerank 우선순위 조정 |
| P1-6 | 완료 | 평가-mode 비교표 Top-3 조정 및 원문 우선 회귀 방어 |
| P1-7 | 완료 | accepted abstain/negative case metric 분리 |
| P2-1 | 완료 | benchmark latency/candidate baseline 추가 |
| P2-2 | 완료 | 일반 질의 candidate cap 축소, lexical TF cache, procedure aspect gating으로 p95 latency 개선 |
| P2-3 | 완료 | benchmark/quality report에 slow case diagnostics 추가 |
| P2-4 | 완료 | slow case 기준 retrieval cache 반복 측정 리포트 추가 |
| P2-5 | 완료 | explicit document lookup fast path와 lexical posting index로 cold path latency 개선 |
| P2-6 | 완료 | evaluation compliance query의 support-reference 검색 gate 추가 |
| P2-7 | 완료 | slow case별 sub-search latency 계측 및 benchmark/quality report 연결 |
| P2-8 | 완료 | direct-support scope 축소와 integrated-initial lexical 후보 예산 적용으로 cold path latency 개선 |
| P2-9 | 완료 | evaluation compliance evidence gate 0 case 완화 및 primary evaluation authority 인정 |
| P2-10 | 완료 | retrieval plan 내부 searchStore memoization으로 동일 search 호출 재사용 기반 추가 |
| P2-11 | 완료 | search memo hit/miss 및 repeated sub-search latency diagnostics를 benchmark/quality report에 노출 |
| P2-12 | 완료 | searchCorpus 내부 exact/lexical scoring의 lexical candidate chunk pool precompute 공유 |
| P2-13 | 완료 | shared lexical pool trace와 query token/tokenSet 재사용으로 searchCorpus 미세 최적화 |
| P2-14 | 완료 | evaluation sub-search 간 lexical pool reuse coverage 진단 trace 추가 |
| P2-15 | 완료 | evaluation-base lexical pool reuse guarded 실험 및 opt-in 비활성화로 품질 회귀 방지 |
| P2-16 | 완료 | lexical pool reuse diagnostics aggregate를 benchmark diagnostics/quality report에 정식 노출 |
| P2-17 | 완료 | evaluation-base lexical pool merge-only 실험 경로 추가 및 품질 회귀 없음 확인 |
| P2-18 | 완료 | sub-search 간 lexical scoring cache 추가 및 planner trace hit/miss 노출 |
| P2-19 | 완료 | lexical score cache diagnostics aggregate를 benchmark diagnostics/quality report에 정식 노출 |
| P2-20 | 완료 | evaluation slow case search-store latency breakdown trace/aggregate 추가 및 report/cache 검증 완료 |
| P2-21 | 완료 | scoped lexical 후보 수집을 posting-backed pool로 전환, 품질 회귀 없음 확인 |
| P2-22 | 완료 | searchCorpus 내부 phase timing 진단을 planner trace/benchmark/quality report에 노출 |
| P2-23 | 완료 | exact scoring query/metadata 반복 계산 제거로 cold retrieval latency 개선 |
| P2-24 | 완료 | exact score 0 후보 lazy allocation 적용, 품질 유지 및 성능 영향 미미 확인 |
| P2-25 | 완료 | fusion phase 내부 timing 분해 및 scoped entity anchor scan 적용 |
| P2-26 | 완료 | entity anchor 후보 posting/score precompute로 evaluation fusion entity 병목 완화 |
| P2-27 | 완료 | shared rerank query context로 fusion rerank 반복 계산 제거, 품질 유지 및 latency 개선 |
| P2-28 | 완료 | exact query token/alias compact precompute로 exact phase latency 개선 |
| P2-29 | 완료 | lexical scoring IDF/token signature precompute로 lexical phase latency 개선 |
| P2-30 | 완료 | exact candidate ranking bounded top-k 적용, 품질 유지 및 성능 효과 미미 확인 |
| P2-31 | 완료 | exact query signal/source score precompute 적용 및 Phase 2 성능 micro-optimization 마무리 판단 |
| P2-32 | 완료 | 문서유형별 chunk policy baseline 도입 및 Q&A/evaluation/law coverage test 추가 |
| P2-33 | 완료 | chunk policy/boundary/protected group diagnostics 구현 및 리포트 계열 명령 재검증 완료 |
| P2-34 | 완료 | parent-child/small-to-big retrieval baseline diagnostics를 quality/benchmark report에 연결 |
| P2-35 | 완료 | guarded small-to-big context-only neighbor expansion 도입 및 inclusion diagnostics 연결 |
| P2-36 | 완료 | small-to-big context inclusion priority를 sourceRole/policy/evidence score 기준으로 조정 |
| P2-37 | 완료 | context-only neighbor bounded excerpt trimming으로 inclusion rate 개선 |
| P2-38 | 완료 | context-only citation safety regression 및 cache latency 반복 확인 |
| P2-39 | 완료 | sourceRole별 context-only excerpt cap 적용으로 inclusion rate 추가 개선 |
| P2-40 | 완료 | small-to-big context skip reason을 chunk/char cap별로 분리 진단 |
| P2-41 | 완료 | primary evaluation anchor에 adaptive context char budget 적용 |
| P2-42 | 완료 | small-to-big diagnostics case list를 skipped 병목 우선으로 정렬 |
| P2-43 | 완료 | support reference anchor에 adaptive context char budget 적용 |
| P2-44 | 완료 | small-to-big trace/report에 실제 적용 maxChars 노출 |
| P2-45 | 완료 | support reference adaptive budget을 2,520자로 보수화 |
| P2-46 | 완료 | cache benchmark cold spike 반복 측정 및 비재현 확인 |
| P2-47 | 완료 | small-to-big 이후 다음 latency target을 retrieval overhead로 선정 |
| P2-48 | 완료 | slow case에 sub-search total 및 retrieval overhead 계측 추가 |
| P2-49 | 완료 | retrieval plan phase timing trace 추가 및 execute-search 병목 확인 |
| P2-50 | 완료 | executeSearch 내부 phase timing trace 추가 및 routing/integrated postprocess 병목 확인 |
| P2-51 | 완료 | routing/integrated postprocess phase split으로 ontology expansion 병목 확인 |
| P2-52 | 완료 | ontology expansion diagnostics 추가로 seed/hit/boost/elapsed 병목 수치화 |
| P2-53 | 완료 | ontology alias token index로 overlap lookup 전체 스캔 제거 |
| P2-54 | 완료 | post-ontology slow target을 search corpus exact/lexical phase로 재선정 |
| P2-55 | 완료 | search corpus exact/lexical input count diagnostics 추가 |
| P2-56 | 완료 | integrated initial lexical candidate cap 2,000으로 보수 축소 |
| P2-57 | 완료 | integrated reranked path diagnostics 추가 |
| P2-58 | 완료 | integrated reranked lexical candidate cap 2,000으로 보수 축소 |
| P2-59 | 완료 | evaluation routing/base candidate cap review |
| P2-60 | 완료 | semantic validation latency split |
| P2-61 | 완료 | semantic validation support scoring cache |
| P2-62 | 완료 | post-cache retrieval latency target refresh |
| P2-63 | 완료 | semantic validation residual test stabilization |
| P2-64 | 완료 | execute-search corpus scoring target refresh |
| P2-65 | 완료 | evaluation exact scoring safety analysis |
| P2-66 | 완료 | exact cap verification refresh after quota reset |
| P2-67 | 완료 | evaluation authority-sensitive rerank guard analysis |
| P2-68 | 완료 | evaluation authority trace diagnostics |
| P2-69 | 완료 | evaluation authority drift rerank guard probe |
| P2-70 | 완료 | handoff-ready default benchmark/report refresh |
| P2-71 | 완료 | evaluation subsection-aware authority guard 검토 및 추가 튜닝 중단 결정 |
| P2-72 | 완료 | Phase 2 final 기준선 고정 및 종료 선언 |

---

## 2026-04-30 / Stage 0 시작

### 수행 내용

- 단계별 진행상황 기록 파일을 생성했다.
- 다음 착수 항목은 계획서의 P0-1 `RAG 품질 리포트 생성`이다.

### 변경 파일

- `docs/plans/rag-search-performance-progress.md`

### 다음 작업

1. P0-1 실패 테스트 작성.
2. RAG 품질 리포트 생성 로직 최소 구현.
3. 테스트/타입체크 실행.
4. 완료 결과를 이 파일에 기록.

---

## 2026-04-30 / P0-1 완료: RAG 품질 리포트 생성

### 수행 내용

- TDD 방식으로 `RAG 품질 리포트 생성` 기능을 추가했다.
- 실패 테스트를 먼저 작성하고 실행했다.
  - 명령: `npx tsx --test tests/ragQualityReport.test.ts`
  - RED 결과: `ERR_MODULE_NOT_FOUND`로 실패. 아직 `src/lib/ragQualityReport.ts`가 없어서 기대한 실패였다.
- 최소 구현을 추가했다.
  - `src/lib/ragQualityReport.ts`
    - `buildRagQualityReport()` 추가.
    - 문서 수, chunk 수, embedding 수, embedding coverage ratio, mode count, doctor issue count 계산.
    - zero chunk / zero embedding / partial embedding 문서 목록 계산.
    - benchmark summary가 주어지면 Top-3/Top-5/evidence/citation rate 계산.
    - Markdown formatter `formatRagQualityReportMarkdown()` 추가.
  - `scripts/rag-quality-report.ts`
    - `.rag-cache/rag-index.json`을 읽어 `.rag-cache/rag-quality-report.json`과 `docs/reports/rag-quality-report.md`를 생성.
    - 향후 P0-2에서 생성될 `.rag-cache/rag-benchmark.json`이 있으면 benchmark metric도 포함하도록 준비.
  - `package.json`
    - `npm run rag:quality-report` 스크립트 추가.
- 실제 리포트를 생성했다.
  - 명령: `npm run rag:quality-report`
  - 출력:
    - `.rag-cache/rag-quality-report.json`
    - `docs/reports/rag-quality-report.md`

### 검증 결과

- 기존 테스트 러너 확인:
  - `npx tsx --test tests/ragMetadata.test.ts`
  - 결과: pass 2 / fail 0
- 신규 테스트:
  - `npx tsx --test tests/ragQualityReport.test.ts`
  - 결과: pass 2 / fail 0
- 타입 체크:
  - `npx tsc -p tsconfig.server.json --noEmit`
  - 결과: exit 0
- 리포트 생성:
  - `npm run rag:quality-report`
  - 결과: exit 0

### 생성된 현재 기준선

현재 `.rag-cache/rag-index.json` 기준:

- Documents: 144
- Chunks: 13,799
- Embeddings: 0
- Embedding coverage: 0.0%
- Integrated documents: 89
- Evaluation documents: 55
- Doctor issues: 91
- Zero chunk documents: 0
- Zero embedding documents: 다수. 현재 모든 chunk가 embedding 미완료 상태로 보임.

이 결과는 로컬 `.rag-cache/rag-index.json` 기준이다. 사용자가 확인해 준 것처럼 실제 embedding은 서버에서 수행되므로, 로컬 리포트의 `Embeddings: 0`은 서버-side embedding 상태를 반영하지 못할 수 있다. 따라서 이후 embedding 관련 단계에서는 서버/DB 기준의 embedding 진단 경로를 별도로 연결해야 한다.

### 변경 파일

- `package.json`
- `src/lib/ragQualityReport.ts`
- `scripts/rag-quality-report.ts`
- `tests/ragQualityReport.test.ts`
- `docs/reports/rag-quality-report.md`
- `docs/plans/rag-search-performance-progress.md`

### 다음 작업

P0-2 `Benchmark 결과 JSON 저장`으로 넘어간다.

권장 작업:

1. `scripts/rag-benchmark.ts`가 콘솔뿐 아니라 JSON 파일을 저장하도록 수정한다.
2. 환경변수 `RAG_BENCH_OUTPUT=.rag-cache/rag-benchmark.json` 또는 기본 경로를 지원한다.
3. `rag:quality-report`가 해당 benchmark JSON을 읽어 Top-3/Top-5/evidence/citation 지표를 통합 표시하는지 확인한다.
4. 완료 후 이 진행상황 파일에 P0-2 결과를 기록한다.

---

## 2026-04-30 / P0-2 완료: Benchmark 결과 JSON 저장 및 리포트 통합

### 수행 내용

- TDD 방식으로 benchmark JSON 출력 대상 계산 로직을 추가했다.
- 실패 테스트를 먼저 작성하고 실행했다.
  - 명령: `npx tsx --test tests/ragBenchmarkReport.test.ts`
  - RED 결과: `ERR_MODULE_NOT_FOUND`로 실패. 아직 `src/lib/ragBenchmarkReport.ts`가 없어서 기대한 실패였다.
- 최소 구현을 추가했다.
  - `src/lib/ragBenchmarkReport.ts`
    - `buildBenchmarkOutputTargets()` 추가.
    - 기본 benchmark JSON 경로를 `.rag-cache/rag-benchmark.json`로 고정.
    - timestamp archive 경로를 `benchmarks/results/rag-benchmark-<timestamp>.json`로 계산.
    - `RAG_BENCH_OUTPUT`으로 primary output 경로를 override할 수 있게 설계.
  - `scripts/rag-benchmark.ts`
    - benchmark payload에 quality report가 바로 읽을 수 있는 count 필드 추가:
      - `top3Hits`
      - `top5Hits`
      - `expectedEvidenceHits`
      - `forbiddenEvidencePasses`
      - `requiredCitationHits`
      - `failedCaseIds`
    - benchmark 실행 시 stable cache JSON과 timestamp archive JSON을 모두 저장하도록 변경.
- `npm run rag:bench` 실행으로 실제 benchmark JSON을 생성했다.
  - Stable cache: `.rag-cache/rag-benchmark.json`
  - Archive: `benchmarks/results/rag-benchmark-2026-04-29T16-47-21-317Z.json`
- `npm run rag:quality-report`를 다시 실행해 benchmark 결과가 `docs/reports/rag-quality-report.md`에 통합되는 것을 확인했다.

### 검증 결과

- 신규 benchmark output 테스트:
  - `npx tsx --test tests/ragBenchmarkReport.test.ts`
  - 결과: pass 2 / fail 0
- 관련 리포트 테스트 포함 실행:
  - `npx tsx --test tests/ragBenchmarkReport.test.ts tests/ragQualityReport.test.ts`
  - 결과: pass 4 / fail 0
- 타입 체크:
  - `npx tsc -p tsconfig.server.json --noEmit`
  - 결과: exit 0
- 실제 benchmark 실행:
  - `npm run rag:bench`
  - 결과: exit 0
- 품질 리포트 재생성:
  - `npm run rag:quality-report`
  - 결과: exit 0

### 생성된 benchmark 기준선

현재 `benchmarks/golden-cases.json` 기준:

- Total cases: 22
- Top-3 doc recall: 90.9% (20/22)
- Top-5 doc recall: 95.5% (21/22)
- Expected evidence pass: 100.0%
- Forbidden evidence pass: 100.0%
- Required citation pass: 100.0%
- Failed cases: `integrated-no-grounded-answer`

### 변경 파일

- `scripts/rag-benchmark.ts`
- `src/lib/ragBenchmarkReport.ts`
- `tests/ragBenchmarkReport.test.ts`
- `.rag-cache/rag-benchmark.json`
- `benchmarks/results/rag-benchmark-2026-04-29T16-47-21-317Z.json`
- `docs/reports/rag-quality-report.md`
- `docs/plans/rag-search-performance-progress.md`

### 다음 작업

P0-3 `문서유형별 chunk diagnostics`로 넘어간다.

권장 작업:

1. manifest entry를 문서유형/경로 패턴별로 그룹화하는 진단 함수를 추가한다.
2. oversized-section, duplicate-content, nul-stripped 등 doctor issue를 유형별로 집계한다.
3. chunk 수가 과도하거나 너무 적은 문서군을 리포트에 표시한다.
4. 서버 embedding과 로컬 manifest embedding 수가 다를 수 있다는 점을 리포트/진단에 명시한다.

---

## 2026-04-30 / P0-3 완료: 문서유형별 chunk diagnostics

### 수행 내용

- TDD 방식으로 `문서유형별 chunk diagnostics`를 품질 리포트에 추가했다.
- 실패 테스트를 먼저 작성하고 실행했다.
  - 명령: `npx.cmd tsx --test tests/ragQualityReport.test.ts`
  - RED 결과: 신규 테스트가 `sourceType` 필드 부재로 실패했다. 문서별 유형 진단이 아직 리포트에 없어서 기대한 실패였다.
- 최소 구현을 추가했다.
  - `src/lib/ragQualityReport.ts`
    - manifest entry의 `name/path/mode` 기준으로 `sourceType`, `sourceRole`, `documentGroup`을 추론해 문서별 리포트에 포함했다.
    - `chunkDiagnostics.bySourceType`을 추가해 문서유형별 document/chunk/embedding/doctor issue 수를 집계했다.
    - `doctorIssueCodeCounts`를 추가해 `oversized-section`, `duplicate-content`, `nul-stripped` 등 issue code별 기준선을 표시했다.
    - chunk 수가 과도한 문서와 너무 적은 문서를 각각 `highChunkDocuments`, `lowChunkDocuments`로 표시했다.
    - 로컬 manifest embedding 수와 서버/DB embedding 수가 다를 수 있다는 note를 추가했다.
  - `tests/ragQualityReport.test.ts`
    - 문서유형 추론, source role 추론, 유형별 issue 집계, high/low chunk 문서 감지를 검증하는 테스트를 추가했다.
  - `docs/reports/rag-quality-report.md`
    - `Chunk Diagnostics` 섹션이 추가되도록 실제 리포트를 재생성했다.

### 검증 결과

- 신규/기존 품질 리포트 테스트:
  - `npx.cmd tsx --test tests/ragQualityReport.test.ts`
  - 결과: pass 3 / fail 0
- 관련 리포트 테스트 포함 실행:
  - `npx.cmd tsx --test tests/ragBenchmarkReport.test.ts tests/ragQualityReport.test.ts`
  - 결과: pass 5 / fail 0
- 타입 체크:
  - `npx.cmd tsc -p tsconfig.server.json --noEmit`
  - 결과: exit 0
- 품질 리포트 재생성:
  - `npm.cmd run rag:quality-report`
  - 결과: exit 0

### 생성된 chunk diagnostics 기준선

현재 `.rag-cache/rag-index.json` 기준:

- Source type별 문서/chunk:
  - comparison: documents 2, chunks 76
  - evaluation: documents 36, chunks 723
  - guide: documents 6, chunks 3,809
  - law: documents 5, chunks 996
  - manual: documents 7, chunks 2,478
  - notice: documents 9, chunks 594
  - ordinance: documents 5, chunks 675
  - other: documents 14, chunks 1,421
  - qa: documents 26, chunks 1,854
  - rule: documents 31, chunks 1,157
  - wiki: documents 3, chunks 16
- Doctor issue code:
  - duplicate-content: 36
  - nul-stripped: 3
  - oversized-section: 52
- High chunk 문서 예시:
  - `/knowledge/2026 노인복지사업안내(2nd).md`: 1,872 chunks
  - `/knowledge/2026 노인복지사업안내(1st).md`: 1,674 chunks
  - `/knowledge/요양보호사_보수교육_운영지침_개정_전문(2026.3.).md`: 639 chunks
  - `/knowledge/일상생활기능훈련_매뉴얼 (1).md`: 568 chunks
  - `/knowledge/eval/일상생활기능훈련_매뉴얼 (1).md`: 568 chunks
- Low chunk 문서:
  - `/knowledge/[별표 1의2] 장기요양급여의 제한에 관한 세부기준(제22조의2 관련)(노인장기요양보험법 시행규칙).md`: 1 chunk
  - `/knowledge/[별표 7] 노인여가복지시설의 시설기준 및 직원배치기준(제26조제1항 관련)(노인복지법 시행규칙).md`: 1 chunk

### 변경 파일

- `src/lib/ragQualityReport.ts`
- `tests/ragQualityReport.test.ts`
- `docs/reports/rag-quality-report.md`
- `.rag-cache/rag-quality-report.json`
- `docs/plans/rag-search-performance-progress.md`

### 다음 작업

P0-4 `Missing embedding 재시도/검증`으로 넘어간다.

권장 작업:

1. 로컬 manifest 기준 missing embedding chunk 수와 문서별 누락 상태를 별도 검증 명령으로 출력한다.
2. quota 대기/일반 실패/서버 DB 상태 미연결을 구분할 수 있는 진단 구조를 만든다.
3. 가능하면 `scripts/rag-index.ts`의 현재 embedding cache/DB restore 흐름을 먼저 읽고, 신규 `scripts/rag-embedding-verify.ts` 또는 기존 index verify 옵션 중 작은 쪽으로 구현한다.
4. 완료 후 이 진행상황 파일에 P0-4 결과를 기록한다.

---

## 2026-04-30 / P0-4 완료: Missing embedding 재시도/검증

### 수행 내용

- TDD 방식으로 missing embedding 검증 리포트 기능을 추가했다.
- 실패 테스트를 먼저 작성하고 실행했다.
  - 명령: `npx.cmd tsx --test tests/ragEmbeddingVerify.test.ts`
  - RED 결과: `ERR_MODULE_NOT_FOUND`로 실패. 아직 `src/lib/ragEmbeddingVerify.ts`가 없어서 기대한 실패였다.
- 최소 구현을 추가했다.
  - `src/lib/ragEmbeddingVerify.ts`
    - `buildRagEmbeddingVerifyReport()` 추가.
    - local manifest와 chunk cache 기준 total/embedded/missing chunk 수를 계산한다.
    - missing chunk를 retry reason별로 분류한다.
      - `cache_available_not_restored`
      - `quota_cooldown`
      - `embedding_api_key_missing`
      - `embedding_not_generated`
    - 문서별 missing chunk 수와 reason count를 집계한다.
    - retry queue를 chunk 단위로 생성한다.
    - Markdown formatter `formatRagEmbeddingVerifyMarkdown()` 추가.
  - `scripts/rag-embedding-verify.ts`
    - `.rag-cache/rag-index.json`과 `.rag-cache/embeddings.json`을 읽어 검증 리포트를 생성한다.
    - 출력:
      - `.rag-cache/rag-embedding-verify.json`
      - `docs/reports/rag-embedding-verify.md`
    - `DATABASE_URL`과 embedding API key 설정 여부를 리포트에 포함한다.
  - `package.json`
    - `npm run rag:embedding-verify` 스크립트 추가.

### 검증 결과

- 신규 embedding verify 테스트:
  - `npx.cmd tsx --test tests/ragEmbeddingVerify.test.ts`
  - 결과: pass 3 / fail 0
- P0 관련 리포트 테스트 포함 실행:
  - `npx.cmd tsx --test tests/ragBenchmarkReport.test.ts tests/ragQualityReport.test.ts tests/ragEmbeddingVerify.test.ts`
  - 결과: pass 8 / fail 0
- 타입 체크:
  - `npx.cmd tsc -p tsconfig.server.json --noEmit`
  - 결과: exit 0
  - `npx.cmd tsc --noEmit`
  - 결과: exit 0
- 실제 embedding 검증 리포트 생성:
  - `npm.cmd run rag:embedding-verify`
  - 결과: exit 0

### 생성된 embedding 기준선

현재 `.rag-cache/rag-index.json` 기준:

- Documents: 144
- Total chunks: 13,799
- Embedded chunks: 0
- Missing chunks: 13,799
- Embedding coverage: 0.0%
- Documents with missing embeddings: 144
- Embedding API configured: no
- Database configured: no
- Missing reason:
  - `embedding_api_key_missing`: 13,799

이 결과는 로컬 manifest와 local chunk cache 기준이다. 리포트에도 명시했듯이 서버-side DB embedding 상태는 아직 직접 검증하지 않는다. `DATABASE_URL`이 없는 현재 실행에서는 Postgres embedding count와 local manifest의 차이를 비교할 수 없다.

### 변경 파일

- `package.json`
- `src/lib/ragEmbeddingVerify.ts`
- `scripts/rag-embedding-verify.ts`
- `tests/ragEmbeddingVerify.test.ts`
- `docs/reports/rag-embedding-verify.md`
- `.rag-cache/rag-embedding-verify.json`
- `docs/plans/rag-search-performance-progress.md`

### 다음 작업

P1-1 `DB lexical retrieval 후보 추가`로 넘어간다.

권장 작업:

1. `db/rag-schema.sql`과 `src/lib/ragStore.ts`의 현재 chunk schema/index를 기준으로 lexical candidate query를 추가한다.
2. PostgreSQL이 없을 때 memory/local path가 깨지지 않도록 DB lexical retrieval은 Postgres store 내부 후보 stage로 제한한다.
3. title/article/search_text 기반 exact/lexical 후보를 pgvector 후보와 함께 fusion에 넘긴다.
4. stage trace 또는 candidate diagnostic에서 DB lexical 후보가 식별되도록 최소 표시를 추가한다.

---

## 2026-04-30 / P1-1 완료: DB lexical retrieval 후보 추가

### 수행 내용

- TDD 방식으로 Postgres DB lexical 후보 검색 기능을 추가했다.
- 실패 테스트를 먼저 작성하고 실행했다.
  - 명령: `npx.cmd tsx --test tests/ragDbLexical.test.ts`
  - RED 결과: `ERR_MODULE_NOT_FOUND`로 실패. 아직 `src/lib/ragDbLexical.ts`가 없어서 기대한 실패였다.
- 최소 구현을 추가했다.
  - `src/lib/ragDbLexical.ts`
    - `buildPostgresLexicalCandidateQuery()` 추가.
    - query를 tokenizer 기반 term 배열로 정규화한다.
    - `doc_title`, `file_name`, `title`, `article_no`, `search_text`에 대한 DB lexical score SQL을 생성한다.
    - `mode`, `allowedDocumentIds`, `excludedEvidenceRoles`, `limit` 조건을 parameterized query로 반영한다.
  - `src/lib/ragEngine.ts`
    - `SearchOptions.precomputedLexicalCandidates` 추가.
    - local lexical 후보와 DB lexical 후보를 병합한 뒤 기존 RRF/fusion/rerank 흐름에 넣도록 변경했다.
    - DB lexical 후보는 `matchedTerms`에 `db-lexical`을 포함하므로 candidate diagnostic에서 식별 가능하다.
  - `src/lib/ragStore.ts`
    - `PostgresRagStore.queryPostgresLexicalCandidates()` 추가.
    - Postgres에서 lexical 후보를 조회하고 `SearchCandidate`로 변환해 `searchCorpus()`에 전달한다.
    - 기존 memory store 경로는 변경하지 않았다.
  - `db/rag-schema.sql`
    - `pg_trgm` extension 추가.
    - `search_text`, `doc_title`, `title`에 대한 trigram GIN index 추가.
  - `tests/ragDbLexical.test.ts`
    - SQL builder가 scope 조건과 term 값을 만드는지 검증.
    - precomputed DB lexical 후보가 lexical/fusion stage에 들어가는지 검증.

### 검증 결과

- 신규 DB lexical 테스트:
  - `npx.cmd tsx --test tests/ragDbLexical.test.ts`
  - 결과: pass 2 / fail 0
- 관련 RAG 테스트 포함 실행:
  - `npx.cmd tsx --test tests/ragDbLexical.test.ts tests/ragBenchmarkReport.test.ts tests/ragQualityReport.test.ts tests/ragEmbeddingVerify.test.ts tests/retrievalPipelineGate.test.ts`
  - 결과: pass 16 / fail 0
- 타입 체크:
  - `npx.cmd tsc -p tsconfig.server.json --noEmit`
  - 결과: exit 0
  - `npx.cmd tsc --noEmit`
  - 결과: exit 0
- 리포트 생성 확인:
  - `npm.cmd run rag:quality-report`
  - 결과: exit 0
  - `npm.cmd run rag:embedding-verify`
  - 결과: exit 0
- benchmark:
  - `npm.cmd run rag:bench`
  - 1차 결과: timeout. 3분 제한 안에 완료되지 않았다.
  - 재실행: timeout을 15분으로 늘려 다시 실행했다.
  - 재실행 결과: exit 0, 약 139.5초 소요.
  - Top-3 doc recall: 90.9%
  - Top-5 doc recall: 95.5%
  - Expected evidence pass: 100.0%
  - Forbidden evidence pass: 100.0%
  - Required citation pass: 100.0%
  - Benchmark JSON archive: `benchmarks/results/rag-benchmark-2026-04-30T02-26-34-818Z.json`
  - benchmark 재실행 후 `npm.cmd run rag:quality-report`도 다시 실행해 리포트 통합을 갱신했다.
  - 이번 변경은 Postgres store의 DB lexical 후보를 추가하는 것이므로, DATABASE_URL이 없는 local cache benchmark에서는 DB lexical 효과 자체는 직접 반영되지 않는다.

### 변경 파일

- `db/rag-schema.sql`
- `src/lib/ragDbLexical.ts`
- `src/lib/ragEngine.ts`
- `src/lib/ragStore.ts`
- `tests/ragDbLexical.test.ts`
- `docs/reports/rag-quality-report.md`
- `.rag-cache/rag-quality-report.json`
- `docs/reports/rag-embedding-verify.md`
- `.rag-cache/rag-embedding-verify.json`
- `docs/plans/rag-search-performance-progress.md`

### 다음 작업

P1-2 `Alias candidate generation`으로 넘어간다.

권장 작업:

1. 파일명, 문서 제목, heading, Q&A 질문, golden case 질문/expectedDoc에서 alias 후보를 추출한다.
2. `.rag-cache/alias-candidates.json`과 사람이 검수 가능한 Markdown 리포트를 생성한다.
3. curated alias 파일 후보 구조를 정한다.
4. 완료 후 이 진행상황 파일에 P1-2 결과를 기록한다.

---

## 2026-04-30 / P1-2 완료: Alias candidate generation

### 수행 내용

- TDD 방식으로 alias 후보 생성 기능을 추가했다.
- 실패 테스트를 먼저 작성하고 실행했다.
  - 명령: `npx.cmd tsx --test tests/ragAliasCandidates.test.ts`
  - RED 결과: `ERR_MODULE_NOT_FOUND`로 실패. 아직 `src/lib/ragAliasCandidates.ts`가 없어서 기대한 실패였다.
- 최소 구현을 추가했다.
  - `src/lib/ragAliasCandidates.ts`
    - `buildRagAliasCandidateReport()` 추가.
    - 파일명, 문서 제목, heading/section path, Q&A 질문, golden case 질문/expectedDoc에서 alias 후보를 생성한다.
    - document별 compact alias 중복을 제거하고 source score 기준으로 정렬한다.
    - 검수 후 `knowledge/ontology/curated.json`에 promotion할 수 있도록 curation hint를 포함한다.
    - 지나치게 긴 문장형 heading, URL, 연도 단독 alias 등 일부 잡음 후보를 필터링한다.
    - Markdown formatter `formatRagAliasCandidateMarkdown()` 추가.
  - `scripts/rag-alias-candidates.ts`
    - `.rag-cache/rag-index.json`과 `benchmarks/golden-cases.json`을 읽어 alias 후보 리포트를 생성한다.
    - 출력:
      - `.rag-cache/alias-candidates.json`
      - `docs/reports/rag-alias-candidates.md`
  - `package.json`
    - `npm run rag:alias-candidates` 스크립트 추가.

### 검증 결과

- 신규 alias candidate 테스트:
  - `npx.cmd tsx --test tests/ragAliasCandidates.test.ts`
  - 결과: pass 3 / fail 0
- 관련 P0/P1 리포트 테스트 포함 실행:
  - `npx.cmd tsx --test tests/ragAliasCandidates.test.ts tests/ragDbLexical.test.ts tests/ragBenchmarkReport.test.ts tests/ragQualityReport.test.ts tests/ragEmbeddingVerify.test.ts`
  - 결과: pass 13 / fail 0
- 타입 체크:
  - `npx.cmd tsc -p tsconfig.server.json --noEmit`
  - 결과: exit 0
  - `npx.cmd tsc --noEmit`
  - 결과: exit 0
- 실제 alias 후보 리포트 생성:
  - `npm.cmd run rag:alias-candidates`
  - 결과: exit 0

### 생성된 alias 후보 기준선

현재 `.rag-cache/rag-index.json` 및 `benchmarks/golden-cases.json` 기준:

- Documents: 144
- Candidate count: 8,210
- Curated alias target: `knowledge/ontology/curated.json`
- Source counts:
  - benchmark-expected-doc: 11
  - benchmark-question: 22
  - document-title: 16
  - heading: 7,732
  - qa-question: 429

주의: 현재 후보는 자동 생성 결과이므로 heading 기반 후보에 잡음이 아직 있다. 다음 alias/ontology 강화 단계에서는 검수 대상 우선순위를 더 좁히고, 안정적인 alias만 `knowledge/ontology/curated.json`에 promotion해야 한다.

### 변경 파일

- `package.json`
- `src/lib/ragAliasCandidates.ts`
- `scripts/rag-alias-candidates.ts`
- `tests/ragAliasCandidates.test.ts`
- `.rag-cache/alias-candidates.json`
- `docs/reports/rag-alias-candidates.md`
- `docs/plans/rag-search-performance-progress.md`

### 다음 작업

P1-3 `Golden cases 확장`으로 넘어간다.

권장 작업:

1. `alias-candidates`와 `rag-quality-report`를 함께 보고 문서별 대표 질의 후보를 고른다.
2. 우선 신규/중요 지식파일부터 `benchmarks/golden-cases.json`에 대표 질의를 추가한다.
3. 평가 원문 우선, 구어체 실무 질문, 법령 조문 exact lookup, negative/mixed-scope 케이스를 소량씩 추가한다.
4. 추가 후 `npm.cmd run rag:bench`와 `npm.cmd run rag:quality-report`로 기준선을 갱신한다.

---

## 2026-04-30 / P1-3 완료: Golden cases 확장

### 수행 내용

- TDD 방식으로 golden case 확장 검증을 추가했다.
- 실패 테스트를 먼저 작성하고 실행했다.
  - 명령: `npx.cmd tsx --test tests/ragGoldenCases.test.ts`
  - RED 결과: `integrated-complaint-casebook` 등 P1-3 대표 케이스가 아직 없어 실패했다.
- `benchmarks/golden-cases.json`에 대표 문서 질의 5건을 추가했다.
  - `integrated-complaint-casebook`
  - `integrated-fraud-claim-casebook`
  - `integrated-claim-work-guide`
  - `integrated-caregiver-continuing-education`
  - `integrated-integrated-homecare-manual`
- 추가 기준은 신규/중요 operational 문서, 문서명 직접 질의, 구어체 실무 질의를 우선했다.
- alias 후보 리포트도 golden case 확장분을 반영해 재생성했다.

### 검증 결과

- 신규 golden case 테스트:
  - `npx.cmd tsx --test tests/ragGoldenCases.test.ts`
  - 결과: pass 2 / fail 0
- 관련 P0/P1 리포트 테스트 포함 실행:
  - `npx.cmd tsx --test tests/ragGoldenCases.test.ts tests/ragAliasCandidates.test.ts tests/ragDbLexical.test.ts tests/ragBenchmarkReport.test.ts tests/ragQualityReport.test.ts tests/ragEmbeddingVerify.test.ts`
  - 결과: pass 15 / fail 0
- 타입 체크:
  - `npx.cmd tsc -p tsconfig.server.json --noEmit`
  - 결과: exit 0
  - `npx.cmd tsc --noEmit`
  - 결과: exit 0
- benchmark:
  - `npm.cmd run rag:bench`
  - 결과: exit 0, 약 183초 소요.
  - Benchmark JSON archive: `benchmarks/results/rag-benchmark-2026-04-30T02-56-28-174Z.json`
- 리포트 재생성:
  - `npm.cmd run rag:quality-report`
  - 결과: exit 0
  - `npm.cmd run rag:alias-candidates`
  - 결과: exit 0

### 갱신된 benchmark 기준선

현재 `benchmarks/golden-cases.json` 기준:

- Total cases: 27
- Top-3 doc recall: 81.5% (22/27)
- Top-5 doc recall: 92.6% (25/27)
- Expected evidence pass: 100.0% (27/27)
- Forbidden evidence pass: 100.0% (27/27)
- Required citation pass: 100.0% (27/27)
- Failed cases:
  - `integrated-no-grounded-answer`
  - `integrated-integrated-homecare-manual`

추가 케이스 중 `integrated-complaint-casebook`, `integrated-claim-work-guide`는 Top-5에는 들어오지만 Top-3에는 못 들어왔다. `integrated-integrated-homecare-manual`은 evidence에는 포함되지만 fused Top-5에는 못 들어와 다음 단계에서 alias/rerank 후보로 본다.

### 갱신된 alias 후보 기준선

현재 `.rag-cache/rag-index.json` 및 확장된 `benchmarks/golden-cases.json` 기준:

- Documents: 144
- Candidate count: 8,218
- Curated alias target: `knowledge/ontology/curated.json`
- Source counts:
  - benchmark-expected-doc: 14
  - benchmark-question: 27
  - document-title: 16
  - heading: 7,732
  - qa-question: 429

### 변경 파일

- `benchmarks/golden-cases.json`
- `tests/ragGoldenCases.test.ts`
- `.rag-cache/rag-benchmark.json`
- `benchmarks/results/rag-benchmark-2026-04-30T02-56-28-174Z.json`
- `.rag-cache/rag-quality-report.json`
- `docs/reports/rag-quality-report.md`
- `.rag-cache/alias-candidates.json`
- `docs/reports/rag-alias-candidates.md`
- `docs/plans/rag-search-performance-progress.md`

### 다음 작업

P1-4 `신규 실패 케이스 원인 분류 및 alias/rerank 개선 방향 결정`으로 넘어간다.

권장 작업:

1. `integrated-integrated-homecare-manual`이 evidence에는 있으나 fused Top-5에 없는 원인을 stage trace 기준으로 분류한다.
2. `integrated-complaint-casebook`, `integrated-claim-work-guide`의 Top-3 미진입 원인이 평가 원문 우선 정책, title exact boost 부족, alias normalization 부족 중 어디인지 확인한다.
3. 통합재가서비스 관련 alias를 `knowledge/ontology/curated.json`에 promotion할지, 아니면 title/document lexical weight를 먼저 조정할지 결정한다.
4. 변경 전후에는 `npm.cmd run rag:bench` 기준선을 유지하면서 Top-3 회복 여부를 확인한다.

---

## 2026-04-30 / P1-4 완료: Benchmark miss 진단 리포트 및 stage trace 점검

### 수행 내용

- TDD 방식으로 benchmark miss 원인 분류 리포트를 추가했다.
- 실패 테스트를 먼저 작성하고 실행했다.
  - 명령: `npx.cmd tsx --test tests/ragBenchmarkDiagnostics.test.ts`
  - RED 결과: `ERR_MODULE_NOT_FOUND`로 실패. 아직 `src/lib/ragBenchmarkDiagnostics.ts`가 없어서 기대한 실패였다.
- 최소 구현을 추가했다.
  - `src/lib/ragBenchmarkDiagnostics.ts`
    - benchmark 결과 JSON을 읽어 Top-3 미진입, Top-5 미진입, evidence에는 있으나 visible Top-5에서 밀린 경우, accepted abstain negative case를 분류한다.
    - Markdown formatter `formatRagBenchmarkDiagnosticsMarkdown()` 추가.
  - `scripts/rag-benchmark-diagnostics.ts`
    - `.rag-cache/rag-benchmark.json`을 읽어 다음 파일을 생성한다.
      - `.rag-cache/rag-benchmark-diagnostics.json`
      - `docs/reports/rag-benchmark-diagnostics.md`
  - `package.json`
    - `npm run rag:benchmark-diagnostics` 스크립트 추가.
- benchmark miss 5건을 `inspectRetrieval()`로 다시 조회해 stage trace와 Top-10 예상문서 rank를 확인했다.
  - 출력: `.rag-cache/rag-benchmark-miss-inspections.json`

### 검증 결과

- 신규 benchmark diagnostics 테스트:
  - `npx.cmd tsx --test tests/ragBenchmarkDiagnostics.test.ts`
  - 결과: pass 2 / fail 0
- 타입 체크:
  - `npx.cmd tsc -p tsconfig.server.json --noEmit`
  - 결과: exit 0
  - `npx.cmd tsc --noEmit`
  - 결과: exit 0
- 실제 diagnostics 리포트 생성:
  - `npm.cmd run rag:benchmark-diagnostics`
  - 결과: exit 0

### 진단 결과

현재 `.rag-cache/rag-benchmark.json` 기준:

- Analyzed cases: 5
- Issue counts:
  - `top3-rerank-priority-miss`: 3
  - `evidence-visible-fusion-miss`: 1
  - `candidate-recall-miss`: 0
  - `accepted-abstain-negative-case`: 1

케이스별 판단:

- `evaluation-change-comparison`
  - 예상 문서 rank: 4~9
  - issue: `top3-rerank-priority-miss`
- `integrated-complaint-casebook`
  - lexical stage top은 `2026년_노인장기요양보험_민원상담_사례집`
  - 예상 문서 rank: 4~6
  - issue: `top3-rerank-priority-miss`
- `integrated-claim-work-guide`
  - lexical stage top은 `급여비용_청구_업무_바로알기(2022.1)`
  - 예상 문서 rank: 5, 9, 10
  - issue: `top3-rerank-priority-miss`
- `integrated-integrated-homecare-manual`
  - lexical stage top은 `(붙임)_통합재가서비스_운영_매뉴얼`
  - 예상 문서 rank: 8
  - issue: `evidence-visible-fusion-miss`
- `integrated-no-grounded-answer`
  - confidence low 및 answer evidence gate에서 semantic validation failed/focus terms missing
  - issue: `accepted-abstain-negative-case`

공통 stage trace:

- `vector_candidates`는 모두 `vector-unavailable-or-empty`다.
- miss 케이스는 대부분 lexical/exact 후보에는 들어오지만 fusion 이후 Top-3/Top-5에서 밀린다.
- 따라서 다음 조정은 alias 추가보다 document title exact boost, evidence-selected candidate promotion, document diversification의 우선순위 정책을 먼저 보는 것이 맞다.

### 변경 파일

- `package.json`
- `src/lib/ragBenchmarkDiagnostics.ts`
- `scripts/rag-benchmark-diagnostics.ts`
- `tests/ragBenchmarkDiagnostics.test.ts`
- `.rag-cache/rag-benchmark-diagnostics.json`
- `.rag-cache/rag-benchmark-miss-inspections.json`
- `docs/reports/rag-benchmark-diagnostics.md`
- `docs/plans/rag-search-performance-progress.md`

### 다음 작업

P1-5 `문서명/exact/evidence 기반 rerank 우선순위 조정`으로 넘어간다.

권장 작업:

1. `SearchCandidate`의 title/document exact 신호가 rerank에서 얼마나 반영되는지 확인한다.
2. lexical stage top 문서가 fusion 이후 과도하게 밀리는 조건을 테스트로 재현한다.
3. evidence에는 선택됐지만 visible Top-5에서 빠지는 문서를 fused candidates에 재승격할지 검토한다.
4. 조정 후 `npm.cmd run rag:bench`로 Top-3 81.5%에서 회복되는지 확인한다.

---

## 2026-04-30 / P1-5 완료: 문서명/exact/evidence 기반 rerank 우선순위 조정

### 수행 내용

- TDD 방식으로 routing expansion이 강한 문서명 lookup 후보를 누르는 문제를 재현했다.
- 실패 테스트를 먼저 작성하고 실행했다.
  - 명령: `npx.cmd tsx --test tests/ragRerankPriority.test.ts`
  - RED 결과: `injectEvidenceCandidates`가 `document-title` hit 후보보다 routing expansion 후보를 위로 올려 실패했다.
- 최소 구현을 추가했다.
  - `src/lib/retrievalPipeline.ts`
    - `injectEvidenceCandidates()`에서 강한 `document-title` support 후보가 이미 있으면 다른 routing expansion 후보를 해당 후보 위로 올리지 않도록 promotion cap을 추가했다.
    - 이 변경으로 `integrated-complaint-casebook`은 예상 문서가 rank 4에서 rank 1로 회복됐다.
  - `src/lib/ragEngine.ts`
    - 문서 lookup 질의에서 `manual`, `guide`, `qa`, `comparison` support 문서가 generic 고시/시행규칙 매칭에 밀리지 않도록 제한적 `document-lookup-source` boost를 추가했다.
    - 적용 조건은 문서/매뉴얼/사례집/가이드/바로알기/어디서/찾아줘/봐야/확인 같은 문서 lookup 표현과 manual-source/document-title/list-group/synthesis-source 신호가 함께 있을 때로 제한했다.
  - `tests/ragRerankPriority.test.ts`
    - routing expansion 후보가 강한 document-title 후보를 넘지 않아야 함을 검증.
    - 문서 lookup 질문에서 manual/guide 문서가 generic notice chunk에 밀리지 않아야 함을 검증.

### 실제 miss 케이스 재점검

`inspectRetrieval()`로 P1-4 miss 케이스를 재확인했다.

- `integrated-complaint-casebook`
  - 변경 전 예상 문서 rank: 4
  - 변경 후 예상 문서 rank: 1
- `integrated-claim-work-guide`
  - 변경 전 예상 문서 rank: 5
  - 변경 후 예상 문서 rank: 2
- `integrated-integrated-homecare-manual`
  - 변경 전 예상 문서 rank: 8
  - 변경 후 예상 문서 rank: 1, 2, 3
- `evaluation-change-comparison`
  - 변경 후에도 예상 문서 rank: 4
  - 남은 이슈는 평가-mode primary evaluation routing 우선 정책과 비교표 support 문서 우선 정책 사이의 선택 문제로 분리한다.

### 검증 결과

- 신규 rerank priority 테스트:
  - `npx.cmd tsx --test tests/ragRerankPriority.test.ts`
  - 결과: pass 3 / fail 0
- 관련 P0/P1 리포트 테스트 포함 실행:
  - `npx.cmd tsx --test tests/ragRerankPriority.test.ts tests/ragBenchmarkDiagnostics.test.ts tests/ragGoldenCases.test.ts tests/ragAliasCandidates.test.ts tests/ragDbLexical.test.ts tests/ragBenchmarkReport.test.ts tests/ragQualityReport.test.ts tests/ragEmbeddingVerify.test.ts`
  - 결과: pass 20 / fail 0
- 타입 체크:
  - `npx.cmd tsc -p tsconfig.server.json --noEmit`
  - 결과: exit 0
  - `npx.cmd tsc --noEmit`
  - 결과: exit 0
- benchmark:
  - `npm.cmd run rag:bench`
  - 결과: exit 0, 약 216.7초 소요.
  - Benchmark JSON archive: `benchmarks/results/rag-benchmark-2026-04-30T03-25-03-952Z.json`
- 리포트 재생성:
  - `npm.cmd run rag:quality-report`
  - 결과: exit 0
  - `npm.cmd run rag:benchmark-diagnostics`
  - 결과: exit 0

### 갱신된 benchmark 기준선

현재 `benchmarks/golden-cases.json` 기준:

- Total cases: 27
- Top-3 doc recall: 92.6% (25/27)
- Top-5 doc recall: 96.3% (26/27)
- Expected evidence pass: 100.0% (27/27)
- Forbidden evidence pass: 100.0% (27/27)
- Required citation pass: 100.0% (27/27)
- Failed cases:
  - `integrated-no-grounded-answer`

P1-3 기준선 대비:

- Top-3: 81.5% -> 92.6%
- Top-5: 92.6% -> 96.3%
- `integrated-integrated-homecare-manual`은 failed case에서 제거됐다.

### 갱신된 diagnostics 기준선

현재 `.rag-cache/rag-benchmark-diagnostics.json` 기준:

- Analyzed cases: 2
- Issue counts:
  - `top3-rerank-priority-miss`: 1
  - `evidence-visible-fusion-miss`: 0
  - `candidate-recall-miss`: 0
  - `accepted-abstain-negative-case`: 1

남은 실제 개선 후보는 `evaluation-change-comparison` 한 건이다. `integrated-no-grounded-answer`는 confidence low와 abstain이 기대되는 negative case다.

### 변경 파일

- `src/lib/retrievalPipeline.ts`
- `src/lib/ragEngine.ts`
- `tests/ragRerankPriority.test.ts`
- `.rag-cache/rag-benchmark.json`
- `benchmarks/results/rag-benchmark-2026-04-30T03-25-03-952Z.json`
- `.rag-cache/rag-quality-report.json`
- `docs/reports/rag-quality-report.md`
- `.rag-cache/rag-benchmark-diagnostics.json`
- `docs/reports/rag-benchmark-diagnostics.md`
- `docs/plans/rag-search-performance-progress.md`

### 다음 작업

P1-6 `평가-mode 개정전후 비교표 Top-3 정책 조정 여부 결정`으로 넘어간다.

권장 작업:

1. `evaluation-change-comparison`에서 평가 원문 우선 정책이 개정전후 비교표 support 문서보다 항상 우선해야 하는지 결정한다.
2. 비교표 질문처럼 `개정 전후`, `비교표`가 명시된 경우에 한해 comparison 문서를 Top-3로 올리는 테스트를 작성한다.
3. 평가 원문 우선 회귀(`evaluation-employee-rights-primary-evidence`)가 깨지지 않는지 함께 검증한다.
4. 조정 후 `npm.cmd run rag:bench`와 `npm.cmd run rag:benchmark-diagnostics`로 기준선을 갱신한다.

---

## 2026-04-30 / P1-6 완료: 평가-mode 비교표 Top-3 조정 및 원문 우선 회귀 방어

### 수행 내용

- TDD 방식으로 평가-mode comparison support 문서가 routing expansion 평가 원문 후보에 밀리는 상황을 재현했다.
- 실패 테스트를 먼저 작성하고 실행했다.
  - 명령: `npx.cmd tsx --test tests/ragRerankPriority.test.ts`
  - RED 결과: `injectEvidenceCandidates`가 `개정전후_비교표` support 후보보다 primary evaluation expansion 후보를 위로 올려 실패했다.
- 최소 구현을 추가했다.
  - `src/lib/retrievalPipeline.ts`
    - `strongDocumentTitleHit` 개념을 `strongSupportLookupHit`로 확장했다.
    - `document-title`뿐 아니라 `document-lookup-source`가 붙은 `comparison`, `guide`, `manual`, `qa` support 후보도 exact score가 충분하면 routing expansion 후보 아래로 밀리지 않게 했다.
  - `src/lib/ragEngine.ts`
    - P1-5의 `document-lookup-source` boost가 evaluation mode 일반 질문에서 support guide/manual을 과도하게 올리지 않도록 제한했다.
    - evaluation mode에서는 `comparison` 문서이면서 질의에 `개정`, `전후`, `비교표`가 있을 때만 support 문서 lookup boost를 적용한다.
  - `tests/ragRerankPriority.test.ts`
    - comparison lookup 문서가 routing expansion 후보 위에 유지되는지 검증.
    - evaluation mode의 일반 직원인권 질문에서는 support guide가 primary evaluation보다 우선되지 않음을 검증.

### 실제 케이스 재점검

`inspectRetrieval()`로 핵심 회귀 케이스를 확인했다.

- `evaluation-change-comparison`
  - 변경 전 예상 문서 rank: 4
  - 변경 후 예상 문서 rank: 1
- `evaluation-employee-rights-primary-evidence`
  - 변경 후 `2026년 주야간보호 평가매뉴얼(26년꺼만)` rank: 1
  - final evidence도 평가매뉴얼 원문 중심으로 유지
- `evaluation-rights-required-colloquial`
  - 변경 후 `2026년 주야간보호 평가매뉴얼(26년꺼만)` rank: 1

### 검증 결과

- rerank priority 테스트:
  - `npx.cmd tsx --test tests/ragRerankPriority.test.ts`
  - 결과: pass 5 / fail 0
- 관련 P0/P1 리포트 테스트 포함 실행:
  - `npx.cmd tsx --test tests/ragRerankPriority.test.ts tests/ragBenchmarkDiagnostics.test.ts tests/ragGoldenCases.test.ts tests/ragAliasCandidates.test.ts tests/ragDbLexical.test.ts tests/ragBenchmarkReport.test.ts tests/ragQualityReport.test.ts tests/ragEmbeddingVerify.test.ts`
  - 결과: pass 22 / fail 0
- 타입 체크:
  - `npx.cmd tsc -p tsconfig.server.json --noEmit`
  - 결과: exit 0
  - `npx.cmd tsc --noEmit`
  - 결과: exit 0
- benchmark:
  - `npm.cmd run rag:bench`
  - 결과: exit 0, 약 151.9초 소요.
  - Benchmark JSON archive: `benchmarks/results/rag-benchmark-2026-04-30T06-45-27-398Z.json`
- 리포트 재생성:
  - `npm.cmd run rag:quality-report`
  - 결과: exit 0
  - `npm.cmd run rag:benchmark-diagnostics`
  - 결과: exit 0

### 갱신된 benchmark 기준선

현재 `benchmarks/golden-cases.json` 기준:

- Total cases: 27
- Top-3 doc recall: 96.3% (26/27)
- Top-5 doc recall: 96.3% (26/27)
- Expected evidence pass: 100.0% (27/27)
- Forbidden evidence pass: 100.0% (27/27)
- Required citation pass: 100.0% (27/27)
- Failed cases:
  - `integrated-no-grounded-answer`

P1-3 기준선 대비:

- Top-3: 81.5% -> 96.3%
- Top-5: 92.6% -> 96.3%

P1-5 기준선 대비:

- Top-3: 92.6% -> 96.3%
- Top-5: 96.3% 유지

### 갱신된 diagnostics 기준선

현재 `.rag-cache/rag-benchmark-diagnostics.json` 기준:

- Analyzed cases: 1
- Issue counts:
  - `top3-rerank-priority-miss`: 0
  - `evidence-visible-fusion-miss`: 0
  - `candidate-recall-miss`: 0
  - `accepted-abstain-negative-case`: 1

남은 항목은 `integrated-no-grounded-answer` 하나이며, 이는 confidence low와 abstain이 기대되는 negative case다.

### 변경 파일

- `src/lib/retrievalPipeline.ts`
- `src/lib/ragEngine.ts`
- `tests/ragRerankPriority.test.ts`
- `.rag-cache/rag-benchmark.json`
- `benchmarks/results/rag-benchmark-2026-04-30T06-45-27-398Z.json`
- `.rag-cache/rag-quality-report.json`
- `docs/reports/rag-quality-report.md`
- `.rag-cache/rag-benchmark-diagnostics.json`
- `docs/reports/rag-benchmark-diagnostics.md`
- `docs/plans/rag-search-performance-progress.md`

### 다음 작업

P1-7 `accepted abstain/negative case metric 분리 또는 다음 Phase 진입 결정`으로 넘어간다.

권장 작업:

1. `integrated-no-grounded-answer`처럼 허용된 negative abstain을 failed doc recall과 별도로 표시할지 결정한다.
2. benchmark summary에서 `acceptableAbstain` 성공 케이스를 failure 목록에서 제외하거나 별도 `acceptedAbstainCaseIds`로 분리한다.
3. 이 분리를 하면 Top-3/Top-5 doc recall과 negative safety metric을 동시에 읽기 쉬워진다.
4. 그 다음 Phase 2/5/6 중 다음 우선순위를 선택한다.

---

## 2026-04-30 / P1-7 완료: accepted abstain/negative case metric 분리

### 수행 내용

- TDD 방식으로 허용된 negative abstain 케이스를 실제 recall/evidence 실패와 분리했다.
- 먼저 실패 테스트를 추가했다.
  - `tests/ragBenchmarkReport.test.ts`
    - `acceptableAbstain=true`이고 실제 답변이 abstain된 케이스는 `acceptedAbstainCaseIds`로 분리하고, `failedCaseIds`/`failedRecallCaseIds`에는 넣지 않는지 검증했다.
  - `tests/ragQualityReport.test.ts`
    - quality report가 `failedRecallCaseIds`, `failedEvidenceCaseIds`, `acceptedAbstainCaseIds`를 benchmark summary에 그대로 반영하는지 검증했다.
  - `tests/ragBenchmarkDiagnostics.test.ts`
    - diagnostics summary가 `actionableCases`와 `acceptedAbstainCases`를 분리해 표시하는지 검증했다.
- 최소 구현을 추가했다.
  - `src/lib/ragBenchmarkReport.ts`
    - `buildBenchmarkOutcomeSummary()`를 추가해 실패 원인을 recall/evidence/accepted abstain으로 분리했다.
  - `scripts/rag-benchmark.ts`
    - benchmark result payload에 `acceptableAbstain`을 포함하고, top-level summary에 `failedRecallCaseIds`, `failedEvidenceCaseIds`, `acceptedAbstainCaseIds`를 기록하도록 변경했다.
  - `src/lib/ragQualityReport.ts`
    - benchmark summary에 분리된 실패/허용 abstain 목록을 포함했다.
  - `scripts/rag-quality-report.ts`
    - `.rag-cache/rag-benchmark.json`의 신규 필드를 quality report 입력으로 정규화했다.
  - `src/lib/ragBenchmarkDiagnostics.ts`
    - diagnostics summary에 `actionableCases`와 `acceptedAbstainCases`를 추가했다.

### 검증 결과

- 신규/관련 RAG 테스트:
  - `npx.cmd tsx --test tests/ragRerankPriority.test.ts tests/ragBenchmarkDiagnostics.test.ts tests/ragGoldenCases.test.ts tests/ragAliasCandidates.test.ts tests/ragDbLexical.test.ts tests/ragBenchmarkReport.test.ts tests/ragQualityReport.test.ts tests/ragEmbeddingVerify.test.ts`
  - 결과: pass 23 / fail 0
- 타입체크:
  - `npx.cmd tsc -p tsconfig.server.json --noEmit`
  - 결과: exit 0
  - `npx.cmd tsc --noEmit`
  - 결과: exit 0
- benchmark:
  - `npm.cmd run rag:bench`
  - 결과: exit 0, 약 157초 소요.
  - Benchmark JSON archive: `benchmarks/results/rag-benchmark-2026-04-30T06-58-54-983Z.json`
- 리포트 재생성:
  - `npm.cmd run rag:quality-report`
  - 결과: exit 0
  - `npm.cmd run rag:benchmark-diagnostics`
  - 결과: exit 0

### 갱신된 benchmark 기준선

현재 `benchmarks/golden-cases.json` 기준:

- Total cases: 27
- Top-3 doc recall: 96.3% (26/27)
- Top-5 doc recall: 96.3% (26/27)
- Expected evidence pass: 100.0% (27/27)
- Forbidden evidence pass: 100.0% (27/27)
- Required citation pass: 100.0% (27/27)
- Failed cases: 없음
- Failed recall cases: 없음
- Failed evidence cases: 없음
- Accepted abstain cases:
  - `integrated-no-grounded-answer`

### 갱신된 diagnostics 기준선

현재 `.rag-cache/rag-benchmark-diagnostics.json` 기준:

- Analyzed cases: 1
- Actionable cases: 0
- Accepted abstain cases: 1
- Issue counts:
  - `top3-rerank-priority-miss`: 0
  - `evidence-visible-fusion-miss`: 0
  - `candidate-recall-miss`: 0
  - `accepted-abstain-negative-case`: 1

이제 `integrated-no-grounded-answer`는 실패가 아니라 negative safety coverage로 따로 추적된다. 현 시점에서 benchmark상 조치 가능한 retrieval miss는 0건이다.

### 변경 파일

- `src/lib/ragBenchmarkReport.ts`
- `scripts/rag-benchmark.ts`
- `src/lib/ragQualityReport.ts`
- `scripts/rag-quality-report.ts`
- `src/lib/ragBenchmarkDiagnostics.ts`
- `tests/ragBenchmarkReport.test.ts`
- `tests/ragQualityReport.test.ts`
- `tests/ragBenchmarkDiagnostics.test.ts`
- `.rag-cache/rag-benchmark.json`
- `benchmarks/results/rag-benchmark-2026-04-30T06-58-54-983Z.json`
- `.rag-cache/rag-quality-report.json`
- `docs/reports/rag-quality-report.md`
- `.rag-cache/rag-benchmark-diagnostics.json`
- `docs/reports/rag-benchmark-diagnostics.md`
- `docs/plans/rag-search-performance-progress.md`

### 다음 작업

P2-1 `actionable miss 0건 기준에서 다음 최적화 축 선정`으로 넘어간다.

권장 작업:

1. 현재 기준선이 안정화됐으므로, 다음 단계가 recall 개선인지 latency/throughput 개선인지 우선순위를 확정한다.
2. 성능 최적화로 간다면 `rag:bench` 소요 시간과 stage별 candidate 수/latency를 리포트에 추가한다.
3. 품질 확장으로 간다면 alias candidate 중 high-value 항목을 curated ontology로 승격할 후보를 선별한다.
4. 운영 준비로 간다면 `failedCaseIds=[]`, `failedRecallCaseIds=[]`, `failedEvidenceCaseIds=[]`, `acceptedAbstainCaseIds` 분리 기준을 CI threshold로 고정한다.

---

## 2026-04-30 / P2-1 완료: benchmark latency/candidate baseline 추가

### 수행 내용

- P1-7 이후 benchmark상 조치 가능한 retrieval miss가 0건이므로, 다음 최적화 축은 recall 보정이 아니라 latency/throughput 관측으로 선정했다.
- TDD 방식으로 benchmark 성능 요약을 추가했다.
  - `tests/ragBenchmarkReport.test.ts`
    - `buildBenchmarkPerformanceSummary()`가 전체 benchmark duration, case latency p50/p95/max, stage latency, stage별 candidate output count를 집계하는지 검증했다.
  - `tests/ragQualityReport.test.ts`
    - quality report가 benchmark performance 요약을 전달하고 markdown에 표시할 수 있는지 검증했다.
- 최소 구현을 추가했다.
  - `src/lib/ragBenchmarkReport.ts`
    - `buildBenchmarkPerformanceSummary()` 추가.
    - case latency, stage latency, candidate output count 집계 구조 추가.
  - `scripts/rag-benchmark.ts`
    - benchmark 전체 실행 시간과 각 case의 `latency`, `stageTrace`를 JSON payload에 기록.
    - top-level `performance` 요약을 `.rag-cache/rag-benchmark.json`과 archive JSON에 포함.
  - `src/lib/ragQualityReport.ts`
    - benchmark performance 요약을 quality report에 포함.
    - markdown에 `Benchmark Performance`와 candidate output count 섹션 추가.
  - `scripts/rag-quality-report.ts`
    - benchmark JSON의 `performance` 필드를 quality report 입력으로 전달.

### 검증 결과

- 신규/관련 report 테스트:
  - `npx.cmd tsx --test tests/ragBenchmarkReport.test.ts tests/ragQualityReport.test.ts`
  - 결과: pass 7 / fail 0
- 전체 관련 RAG 테스트:
  - `npx.cmd tsx --test tests/ragRerankPriority.test.ts tests/ragBenchmarkDiagnostics.test.ts tests/ragGoldenCases.test.ts tests/ragAliasCandidates.test.ts tests/ragDbLexical.test.ts tests/ragBenchmarkReport.test.ts tests/ragQualityReport.test.ts tests/ragEmbeddingVerify.test.ts`
  - 결과: pass 24 / fail 0
- 타입체크:
  - `npx.cmd tsc -p tsconfig.server.json --noEmit`
  - 결과: exit 0
  - `npx.cmd tsc --noEmit`
  - 결과: exit 0
- benchmark:
  - `npm.cmd run rag:bench`
  - 결과: exit 0, 약 209초 소요.
  - Benchmark JSON archive: `benchmarks/results/rag-benchmark-2026-04-30T09-00-01-353Z.json`
- 리포트 재생성:
  - `npm.cmd run rag:quality-report`
  - 결과: exit 0
  - `npm.cmd run rag:benchmark-diagnostics`
  - 결과: exit 0

### 갱신된 quality 기준선

현재 `benchmarks/golden-cases.json` 기준:

- Total cases: 27
- Top-3 doc recall: 96.3% (26/27)
- Top-5 doc recall: 96.3% (26/27)
- Expected evidence pass: 100.0% (27/27)
- Forbidden evidence pass: 100.0% (27/27)
- Required citation pass: 100.0% (27/27)
- Failed cases: 없음
- Failed recall cases: 없음
- Failed evidence cases: 없음
- Accepted abstain cases:
  - `integrated-no-grounded-answer`

### 신규 latency/candidate 기준선

현재 `.rag-cache/rag-benchmark.json` 기준:

- Total benchmark duration: 198,841ms
- Case latency:
  - average: 6,569.1ms
  - p50: 3,461ms
  - p95: 21,901ms
  - max: 40,068ms
- Retrieval latency:
  - average: 7,187.1ms
  - p50: 3,509ms
  - p95: 21,892ms
  - max: 39,434ms
- Candidate output count:
  - `lexical_candidates`: avg 32, max 32
  - `fusion`: avg 32, max 32
  - `section_routing`: avg 3, max 3
  - `document_diversification`: avg 14.6, max 22
  - `answer_evidence_gate`: avg 10.4, max 22
  - `vector_candidates`: avg 0, max 0

해석:

- 현재 품질 실패는 없지만, p95 latency가 약 21.9초라 다음 병목은 retrieval latency다.
- lexical/fusion stage가 모든 케이스에서 32개 후보를 고정 출력하고 있어, P2-2에서는 candidate cap/early stop/문서 lookup fast path 중 하나를 검토할 가치가 있다.
- vector 후보는 현재 0개이므로, 이번 latency 기준선은 사실상 lexical/rerank 중심 성능 기준선이다.

### 변경 파일

- `src/lib/ragBenchmarkReport.ts`
- `scripts/rag-benchmark.ts`
- `src/lib/ragQualityReport.ts`
- `scripts/rag-quality-report.ts`
- `tests/ragBenchmarkReport.test.ts`
- `tests/ragQualityReport.test.ts`
- `.rag-cache/rag-benchmark.json`
- `benchmarks/results/rag-benchmark-2026-04-30T09-00-01-353Z.json`
- `.rag-cache/rag-quality-report.json`
- `docs/reports/rag-quality-report.md`
- `.rag-cache/rag-benchmark-diagnostics.json`
- `docs/reports/rag-benchmark-diagnostics.md`
- `docs/plans/rag-search-performance-progress.md`

### 다음 작업

P2-2 `latency 병목 기준으로 candidate cap 또는 retrieval cache 최적화`로 넘어간다.

권장 작업:

1. p95/max latency가 높은 case id를 benchmark performance report에 추가한다.
2. high latency case의 stage trace와 query 유형을 확인해 문서 lookup fast path가 가능한지 판단한다.
3. quality가 유지되는 범위에서 lexical/fusion candidate cap을 32에서 낮추거나, exact document lookup 케이스만 early stop하는 실험을 TDD로 진행한다.
4. 변경 후 `rag:bench`로 Top-3/Top-5 96.3%, failed case 0건 유지와 p95 latency 변화를 비교한다.

---

## 2026-05-04 / P2-2 완료: latency 병목 기준 candidate cap 및 procedure expansion 최적화

### 수행 내용

- TDD 방식으로 일반 질의 candidate cap 축소와 retrieval 병목 완화를 진행했다.
- 먼저 실패 테스트를 추가했다.
  - `tests/queryIntent.test.ts`
    - 일반 point lookup profile의 `fusedTopK`가 24로 낮아지는지 검증.
    - procedure aspect expansion이 broad/enumeration 또는 근거 부족 질의에만 적용되는지 검증.
  - `tests/retrievalPipelineGate.test.ts`
    - 일반 질의에서 `lexical_candidates`와 `fusion` stage output이 24로 제한되는지 검증.
    - `buildRagCorpusIndex()`가 lexical term frequency cache를 미리 만드는지 검증.
  - `tests/ragRerankPriority.test.ts`
    - 법령/고시 후보가 강하게 매칭되는 상황에서도 `급여비용_청구_업무_바로알기` 같은 workflow guide 문서가 Top-3 안에 남는지 검증.
- 구현 변경:
  - `src/lib/queryIntent.ts`
    - 일반 질의 `fusedTopK`를 32에서 24로 축소했다.
    - enumeration 질의는 기존처럼 `fusedTopK=48`을 유지했다.
  - `src/lib/ragEngine.ts`
    - lexical candidate limit 기본값을 24로 맞췄다.
    - `buildRagCorpusIndex()`에서 chunk별 `tokenCountMap`, `tfMap`을 미리 계산하도록 바꿨다.
    - `scoreLexical()`이 매 질의마다 모든 chunk의 term-frequency map을 재생성하지 않고 index cache를 재사용하도록 변경했다.
    - match가 있는 chunk에만 `SearchCandidate` 객체를 만들도록 후보 객체 생성을 지연했다.
    - 업무 처리/흐름/바로알기 성격의 문서 lookup 질의에서 guide/manual support 문서가 고시 조문 후보에 과도하게 밀리지 않도록 좁은 rerank boost를 추가했다.
  - `src/lib/ragNaturalQuery.ts`
    - `shouldExpandProcedureAspectQueries()`를 추가해 procedure aspect 추가 검색의 적용 기준을 분리했다.
  - `src/lib/nodeRagService.ts`
    - procedure aspect 추가 검색을 broad/enumeration 질의 또는 근거 부족 질의에만 실행하도록 gating했다.

### 검증 결과

- RED 확인:
  - `npx.cmd tsx --test tests/queryIntent.test.ts tests/retrievalPipelineGate.test.ts`
  - 구현 전 `32 !== 24`로 실패.
  - `npx.cmd tsx --test tests/retrievalPipelineGate.test.ts`
  - 구현 전 `tfMap` 부재로 실패.
  - `npx.cmd tsx --test tests/queryIntent.test.ts`
  - 구현 전 `shouldExpandProcedureAspectQueries` export 부재로 실패.
  - `npx.cmd tsx --test tests/ragRerankPriority.test.ts`
  - 구현 전 workflow guide 문서가 Top-3 밖으로 밀려 실패.
- 관련 RAG 테스트:
  - `npx.cmd tsx --test tests/queryIntent.test.ts tests/retrievalPipelineGate.test.ts tests/ragRerankPriority.test.ts tests/ragBenchmarkDiagnostics.test.ts tests/ragGoldenCases.test.ts tests/ragAliasCandidates.test.ts tests/ragDbLexical.test.ts tests/ragBenchmarkReport.test.ts tests/ragQualityReport.test.ts tests/ragEmbeddingVerify.test.ts`
  - 결과: pass 36 / fail 0
- 타입체크:
  - `npx.cmd tsc -p tsconfig.server.json --noEmit`
  - 결과: exit 0
  - `npx.cmd tsc --noEmit`
  - 결과: exit 0
- benchmark:
  - `npm.cmd run rag:bench`
  - 결과: exit 0, 약 141.5초 소요.
  - Benchmark JSON archive: `benchmarks/results/rag-benchmark-2026-05-04T02-26-55-071Z.json`
- 리포트 재생성:
  - `npm.cmd run rag:quality-report`
  - 결과: exit 0
  - `npm.cmd run rag:benchmark-diagnostics`
  - 결과: exit 0

### 갱신된 quality 기준선

현재 `benchmarks/golden-cases.json` 기준:

- Total cases: 27
- Top-3 doc recall: 96.3% (26/27)
- Top-5 doc recall: 96.3% (26/27)
- Expected evidence pass: 100.0% (27/27)
- Forbidden evidence pass: 100.0% (27/27)
- Required citation pass: 100.0% (27/27)
- Failed cases: 없음
- Failed recall cases: 없음
- Failed evidence cases: 없음
- Accepted abstain cases:
  - `integrated-no-grounded-answer`

### 갱신된 latency/candidate 기준선

현재 `.rag-cache/rag-benchmark.json` 기준:

- Total benchmark duration: 123,531ms
- Case latency:
  - average: 3,695.0ms
  - p50: 3,421ms
  - p95: 7,551ms
  - max: 7,733ms
- Retrieval latency:
  - average: 3,671.7ms
  - p50: 3,460ms
  - p95: 6,958ms
  - max: 7,111ms
- Candidate output count:
  - `lexical_candidates`: avg 24, max 24
  - `fusion`: avg 24.2, max 25
  - `section_routing`: avg 3, max 3
  - `document_diversification`: avg 14.6, max 22
  - `answer_evidence_gate`: avg 10.4, max 22
  - `vector_candidates`: avg 0, max 0

P2-1 기준 대비:

- Total benchmark duration: 198,841ms -> 123,531ms
- Case latency p95: 21,901ms -> 7,551ms
- Case latency max: 40,068ms -> 7,733ms
- Retrieval latency p95: 21,892ms -> 6,958ms
- Retrieval latency max: 39,434ms -> 7,111ms
- `lexical_candidates` avg/max: 32/32 -> 24/24
- `fusion` avg/max: 32/32 -> 24.2/25
- Top-3/Top-5/근거 metric은 P2-1 기준선을 유지했다.

### 변경 파일

- `src/lib/queryIntent.ts`
- `src/lib/ragEngine.ts`
- `src/lib/ragNaturalQuery.ts`
- `src/lib/nodeRagService.ts`
- `tests/queryIntent.test.ts`
- `tests/retrievalPipelineGate.test.ts`
- `tests/ragRerankPriority.test.ts`
- `.rag-cache/rag-benchmark.json`
- `benchmarks/results/rag-benchmark-2026-05-04T02-26-55-071Z.json`
- `.rag-cache/rag-quality-report.json`
- `docs/reports/rag-quality-report.md`
- `.rag-cache/rag-benchmark-diagnostics.json`
- `docs/reports/rag-benchmark-diagnostics.md`
- `docs/plans/rag-search-performance-progress.md`

### 다음 작업

P2-3 `남은 high latency 케이스 진단 및 선택적 fast path/캐시 기준 검토`로 넘어간다.

권장 작업:

1. `evaluation-notice-period`, `evaluation-day-night-care-disliked-foods`, `integrated-complaint-casebook`처럼 아직 상위 latency에 남는 케이스의 trace를 비교한다.
2. procedure aspect gating 이후에도 품질이 유지되는 케이스/위험 케이스를 별도 diagnostics에 표시할지 검토한다.
3. retrieval cache hit를 benchmark에서 반복 질의로 측정하는 작은 cache benchmark를 추가할지 결정한다.
4. 현재 p95 7초대가 운영 목표에 충분한지, 추가로 exact document lookup fast path를 도입할지 결정한다.

---

## 2026-05-04 / P2-3 완료: 남은 high latency 케이스 진단 리포트 추가

### 수행 내용

- P2-2 이후 p95/max는 내려갔지만, 어떤 케이스가 남은 latency를 지배하는지 매번 수동 파싱해야 하는 문제가 남아 있었다.
- TDD 방식으로 benchmark performance summary에 slow case diagnostics를 추가했다.
- 먼저 실패 테스트를 추가했다.
  - `tests/ragBenchmarkReport.test.ts`
    - `buildBenchmarkPerformanceSummary()`가 latency가 큰 case를 `slowCases`에 정렬해서 담는지 검증.
    - 각 slow case에 `id`, `totalMs`, `retrievalMs`, dominant latency stage, stage별 output count가 포함되는지 검증.
  - `tests/ragQualityReport.test.ts`
    - quality report가 benchmark performance의 `slowCases`를 보존하는지 검증.
    - Markdown에 `Slow benchmark cases` 섹션이 출력되는지 검증.
- 구현 변경:
  - `src/lib/ragBenchmarkReport.ts`
    - `BenchmarkSlowCaseSummary` 추가.
    - `BenchmarkPerformanceSummary.slowCases` 추가.
    - latency total 기준 상위 5개 케이스를 정렬하고, dominant latency stage와 stage output count를 계산하도록 구현.
  - `src/lib/ragQualityReport.ts`
    - benchmark performance markdown에 `Slow benchmark cases` 섹션 추가.
    - 각 케이스의 total/retrieval/dominant latency와 stage output count를 표시하도록 구현.

### 검증 결과

- RED 확인:
  - `npx.cmd tsx --test tests/ragBenchmarkReport.test.ts tests/ragQualityReport.test.ts`
  - 구현 전 `slowCases` 부재 및 Markdown 섹션 부재로 실패.
- 관련 RAG 테스트:
  - `npx.cmd tsx --test tests/queryIntent.test.ts tests/retrievalPipelineGate.test.ts tests/ragRerankPriority.test.ts tests/ragBenchmarkDiagnostics.test.ts tests/ragGoldenCases.test.ts tests/ragAliasCandidates.test.ts tests/ragDbLexical.test.ts tests/ragBenchmarkReport.test.ts tests/ragQualityReport.test.ts tests/ragEmbeddingVerify.test.ts`
  - 결과: pass 36 / fail 0
- 타입체크:
  - `npx.cmd tsc -p tsconfig.server.json --noEmit`
  - 결과: exit 0
  - `npx.cmd tsc --noEmit`
  - 결과: exit 0
- benchmark:
  - `npm.cmd run rag:bench`
  - 결과: exit 0, 약 164.3초 소요.
  - Benchmark JSON archive: `benchmarks/results/rag-benchmark-2026-05-04T02-42-51-811Z.json`
- 리포트 재생성:
  - `npm.cmd run rag:quality-report`
  - 결과: exit 0
  - `npm.cmd run rag:benchmark-diagnostics`
  - 결과: exit 0

### 갱신된 quality 기준선

현재 `benchmarks/golden-cases.json` 기준:

- Total cases: 27
- Top-3 doc recall: 96.3% (26/27)
- Top-5 doc recall: 96.3% (26/27)
- Expected evidence pass: 100.0% (27/27)
- Forbidden evidence pass: 100.0% (27/27)
- Required citation pass: 100.0% (27/27)
- Failed cases: 없음
- Failed recall cases: 없음
- Failed evidence cases: 없음
- Accepted abstain cases:
  - `integrated-no-grounded-answer`

### 갱신된 latency/candidate 기준선

현재 `.rag-cache/rag-benchmark.json` 기준:

- Total benchmark duration: 153,099ms
- Case latency:
  - average: 4,431.9ms
  - p50: 4,180ms
  - p95: 9,178ms
  - max: 9,486ms
- Retrieval latency:
  - average: 4,370.9ms
  - p50: 4,219ms
  - p95: 7,726ms
  - max: 8,404ms
- Candidate output count:
  - `lexical_candidates`: avg 24, max 24
  - `fusion`: avg 24.2, max 25
  - `section_routing`: avg 3, max 3
  - `document_diversification`: avg 14.6, max 22
  - `answer_evidence_gate`: avg 10.4, max 22
  - `vector_candidates`: avg 0, max 0

### 새 slow case diagnostics

`performance.slowCases` 상위 5개:

- `evaluation-notice-period`: total 9,486ms, retrieval 8,404ms, dominant `retrievalMs`, outputs lexical 24 / fusion 24 / evidence gate 0
- `evaluation-day-night-care-disliked-foods`: total 9,178ms, retrieval 5,952ms, dominant `retrievalMs`, outputs lexical 24 / fusion 24 / evidence gate 14
- `integrated-complaint-casebook`: total 7,738ms, retrieval 7,726ms, dominant `retrievalMs`, outputs lexical 24 / fusion 25 / evidence gate 9
- `integrated-workforce-standard`: total 6,204ms, retrieval 6,185ms, dominant `retrievalMs`, outputs lexical 24 / fusion 24 / evidence gate 18
- `evaluation-rights-required-colloquial`: total 6,002ms, retrieval 4,900ms, dominant `retrievalMs`, outputs lexical 24 / fusion 25 / evidence gate 15

해석:

- 남은 slow case도 모두 dominant stage는 retrieval이다.
- candidate cap은 이미 lexical 24 / fusion 24~25로 적용되고 있어 P2-2의 cap 최적화는 유지되고 있다.
- `evaluation-notice-period`는 evidence gate output이 0인데 low confidence/semantic gate 성격이므로, 더 줄이려면 low-confidence fallback/validation fast exit 기준을 따로 봐야 한다.
- `integrated-complaint-casebook`, `integrated-workforce-standard`처럼 품질 성공 케이스의 retrieval 시간이 남아 있어, 다음 단계에서는 반복 질의 retrieval cache 효과 또는 exact/document lookup fast path 중 하나를 실험하는 것이 적절하다.

### 변경 파일

- `src/lib/ragBenchmarkReport.ts`
- `src/lib/ragQualityReport.ts`
- `tests/ragBenchmarkReport.test.ts`
- `tests/ragQualityReport.test.ts`
- `.rag-cache/rag-benchmark.json`
- `benchmarks/results/rag-benchmark-2026-05-04T02-42-51-811Z.json`
- `.rag-cache/rag-quality-report.json`
- `docs/reports/rag-quality-report.md`
- `.rag-cache/rag-benchmark-diagnostics.json`
- `docs/reports/rag-benchmark-diagnostics.md`
- `docs/plans/rag-search-performance-progress.md`

### 다음 작업

P2-4 `slow case 기준으로 retrieval cache 반복 측정 또는 exact fast path 실험 결정`으로 넘어간다.

권장 작업:

1. `inspectRetrieval()` 반복 호출 benchmark를 추가해 retrieval cache hit 시 latency가 얼마나 줄어드는지 수치화한다.
2. `evaluation-notice-period`처럼 low confidence로 끝나는 케이스에 semantic gate fast exit가 가능한지 확인한다.
3. `integrated-complaint-casebook`처럼 문서명이 명확한 lookup 케이스에 exact/document lookup fast path를 적용해도 Top-3/근거 품질이 유지되는지 TDD로 검증한다.
4. cache와 fast path 중 더 안전한 축을 하나 골라 P2-4에서 구현한다.

---

## 2026-05-04 / P2-4 완료: slow case 기준 retrieval cache 반복 측정

### 수행 내용

- TDD 방식으로 slow case 반복 측정 리포트 계산 로직을 추가했다.
  - `tests/ragCacheBenchmarkReport.test.ts`
    - cold/warm run의 total latency, retrieval cache hit, reduction ratio, speedup 산출을 검증.
    - Markdown 리포트가 cache hit 요약과 decision guidance를 출력하는지 검증.
- `src/lib/ragCacheBenchmarkReport.ts`
  - `buildRagCacheBenchmarkReport()` 추가.
  - `formatRagCacheBenchmarkMarkdown()` 추가.
  - warm run의 `cacheHits.retrieval`과 total latency 감소율을 기준으로 cache 효과를 판단하도록 구현.
- `scripts/rag-cache-benchmark.ts`
  - 최신 `.rag-cache/rag-benchmark.json`의 `performance.slowCases` 상위 케이스를 선택.
  - 같은 `NodeRagService` 인스턴스에서 각 case를 2회 실행해 cold/warm retrieval cache 효과를 측정.
  - `.rag-cache/rag-cache-benchmark.json`, `benchmarks/results/rag-cache-benchmark-<timestamp>.json`, `docs/reports/rag-cache-benchmark.md` 생성.
- `package.json`
  - `npm.cmd run rag:cache-benchmark` 스크립트 추가.

### 검증 결과

- 관련 RAG 테스트:
  - `npx.cmd tsx --test tests/queryIntent.test.ts tests/retrievalPipelineGate.test.ts tests/ragRerankPriority.test.ts tests/ragBenchmarkDiagnostics.test.ts tests/ragGoldenCases.test.ts tests/ragAliasCandidates.test.ts tests/ragDbLexical.test.ts tests/ragBenchmarkReport.test.ts tests/ragQualityReport.test.ts tests/ragEmbeddingVerify.test.ts tests/ragCacheBenchmarkReport.test.ts`
  - 결과: pass 38 / fail 0
- 타입체크:
  - `npx.cmd tsc -p tsconfig.server.json --noEmit`
  - 결과: exit 0
  - `npx.cmd tsc --noEmit`
  - 결과: exit 0
- benchmark:
  - `npm.cmd run rag:bench`
  - 결과: exit 0
  - Benchmark JSON archive: `benchmarks/results/rag-benchmark-2026-05-04T03-06-07-748Z.json`
- 리포트 재생성:
  - `npm.cmd run rag:quality-report`
  - 결과: exit 0
  - `npm.cmd run rag:benchmark-diagnostics`
  - 결과: exit 0
- cache benchmark:
  - `npm.cmd run rag:cache-benchmark`
  - 결과: exit 0
  - Cache benchmark JSON archive: `benchmarks/results/rag-cache-benchmark-2026-05-04T03-10-06-823Z.json`

### 최신 quality/latency 기준선

현재 `.rag-cache/rag-benchmark.json` 기준:

- Total cases: 27
- Top-3 doc recall: 96.3% (26/27)
- Top-5 doc recall: 96.3% (26/27)
- Expected evidence pass: 100.0% (27/27)
- Forbidden evidence pass: 100.0% (27/27)
- Required citation pass: 100.0% (27/27)
- Failed cases: 없음
- Failed recall cases: 없음
- Failed evidence cases: 없음
- Accepted abstain cases:
  - `integrated-no-grounded-answer`

Latency:

- Total benchmark duration: 198,410ms
- Case latency:
  - average: 5,861.3ms
  - p50: 4,850ms
  - p95: 15,675ms
  - max: 20,470ms
- Retrieval latency:
  - average: 5,727.5ms
  - p50: 4,835ms
  - p95: 10,175ms
  - max: 20,442ms

Slow cases:

- `integrated-complaint-casebook`: total 20,470ms, retrieval 20,442ms
- `evaluation-day-night-care-disliked-foods`: total 15,675ms, retrieval 10,175ms
- `evaluation-notice-period`: total 9,586ms, retrieval 8,516ms
- `evaluation-rights-required-colloquial`: total 9,121ms, retrieval 7,958ms
- `integrated-benefit-cost-notice`: total 7,128ms, retrieval 7,099ms

### retrieval cache 반복 측정 결과

현재 `.rag-cache/rag-cache-benchmark.json` 기준:

- Cases: 5
- Runs: 10
- Warm retrieval cache hits: 5/5
- Average cold total: 9,403.8ms
- Average warm total: 26.2ms
- Average total reduction: 9,377.6ms (99.7%)
- Average speedup: 365.6x

Case별 cold/warm:

- `integrated-complaint-casebook`: 9,737ms -> 32ms, cache hit, 304.3x
- `evaluation-day-night-care-disliked-foods`: 11,999ms -> 28ms, cache hit, 428.5x
- `evaluation-notice-period`: 10,446ms -> 23ms, cache hit, 454.2x
- `evaluation-rights-required-colloquial`: 7,711ms -> 29ms, cache hit, 265.9x
- `integrated-benefit-cost-notice`: 7,126ms -> 19ms, cache hit, 375.1x

해석:

- 같은 쿼리가 반복되는 경우 retrieval cache는 매우 효과적이다.
- 하지만 `rag:bench`의 cold path p95/max는 여전히 retrieval stage가 지배한다.
- 따라서 다음 최적화는 cache 자체보다는 cold path를 줄이는 방향이 더 적절하다.
- 후보는 두 가지다.
  - 문서명이 명확한 lookup case에 exact/document fast path 적용.
  - `evaluation-notice-period`처럼 evidence gate 0으로 끝나는 case의 semantic fast exit/validation fast exit 검토.

### 변경 파일

- `package.json`
- `scripts/rag-cache-benchmark.ts`
- `src/lib/ragCacheBenchmarkReport.ts`
- `tests/ragCacheBenchmarkReport.test.ts`
- `.rag-cache/rag-benchmark.json`
- `.rag-cache/rag-quality-report.json`
- `.rag-cache/rag-benchmark-diagnostics.json`
- `.rag-cache/rag-cache-benchmark.json`
- `benchmarks/results/rag-benchmark-2026-05-04T03-06-07-748Z.json`
- `benchmarks/results/rag-cache-benchmark-2026-05-04T03-10-06-823Z.json`
- `docs/reports/rag-quality-report.md`
- `docs/reports/rag-benchmark-diagnostics.md`
- `docs/reports/rag-cache-benchmark.md`
- `docs/plans/rag-search-performance-progress.md`

### 다음 작업

P2-5 `cold path latency 기준 exact/document lookup fast path 또는 semantic fast exit 실험`으로 넘어간다.

권장 작업:

1. slow case 중 `integrated-complaint-casebook`, `integrated-benefit-cost-notice`처럼 문서/업무명이 강한 lookup query를 exact/document fast path 후보로 분류한다.
2. fast path가 적용되더라도 Top-3/Top-5/evidence/citation 지표가 유지되는지 TDD로 먼저 고정한다.
3. `evaluation-notice-period`처럼 evidence gate output 0인 case는 retrieval 이후 semantic gate에서 조기 종료 가능한지 별도 테스트로 검토한다.
4. cold path p95/max 개선 후 `rag:bench`, `rag:quality-report`, `rag:benchmark-diagnostics`, `rag:cache-benchmark`를 다시 실행해 비교한다.

---

## 2026-05-04 / P2-5 완료: document lookup fast path 및 lexical posting index

### 수행 내용

- TDD 방식으로 explicit document-title lookup fast path를 추가했다.
  - `tests/ragRerankPriority.test.ts`
    - 문서명이 쿼리에 명확히 포함된 경우 `searchCorpus()`가 lexical scoring 전에 후보 문서 범위를 좁히는지 검증.
    - `lexical_candidates` stage trace에 `document-fast-path=<n>`이 남는지 검증.
    - fast path 적용 시 lexical/fusion 후보가 대상 문서로 좁혀지고 top candidate가 대상 문서인지 검증.
- `src/lib/ragEngine.ts`
  - `RagCorpusIndex`에 `chunkById`, `chunksByDocumentId`, `documentLookupEntries`를 추가.
  - 쿼리와 문서명/파일명/path compact match가 강한 경우 내부적으로 `allowedDocumentIds`를 좁혀 exact/lexical/vector/entity 후보 계산에 적용.
  - enumeration query와 이미 scope가 주어진 검색에는 fast path를 적용하지 않도록 제한.
- 실제 golden case에서는 strict document fast path gate가 켜진 case가 없었다.
  - 현재 golden query들은 문서명 전체 문자열을 직접 포함하기보다 업무/평가 상황형 표현이 많다.
  - 따라서 fast path는 안전하게 준비됐지만 이번 benchmark 개선의 주효과는 아래 lexical posting index에서 발생했다.
- TDD 방식으로 lexical posting index를 추가했다.
  - `tests/retrievalPipelineGate.test.ts`
    - `buildRagCorpusIndex()`가 `postingMap`과 `chunkById`를 구성하는지 검증.
  - `scoreLexical()`이 전체 chunk를 매번 순회하지 않고 query token posting union에 포함된 chunk만 점수화하도록 변경.
  - 기존 P2-2의 `tfMap`/`tokenCountMap` cache와 결합해 lexical cold path 비용을 낮췄다.

### 검증 결과

- RED 확인:
  - `npx.cmd tsx --test tests/ragRerankPriority.test.ts`
  - 구현 전 `document-fast-path=1` stage note 부재로 실패.
  - `npx.cmd tsx --test tests/retrievalPipelineGate.test.ts`
  - 구현 전 `postingMap` 부재로 실패.
- 관련 RAG 테스트:
  - `npx.cmd tsx --test tests/queryIntent.test.ts tests/retrievalPipelineGate.test.ts tests/ragRerankPriority.test.ts tests/ragBenchmarkDiagnostics.test.ts tests/ragGoldenCases.test.ts tests/ragAliasCandidates.test.ts tests/ragDbLexical.test.ts tests/ragBenchmarkReport.test.ts tests/ragQualityReport.test.ts tests/ragEmbeddingVerify.test.ts tests/ragCacheBenchmarkReport.test.ts`
  - 결과: pass 39 / fail 0
- 타입체크:
  - `npx.cmd tsc -p tsconfig.server.json --noEmit`
  - 결과: exit 0
  - `npx.cmd tsc --noEmit`
  - 결과: exit 0
- benchmark:
  - `npm.cmd run rag:bench`
  - 결과: exit 0
  - Benchmark JSON archive: `benchmarks/results/rag-benchmark-2026-05-04T03-44-08-590Z.json`
- 리포트 재생성:
  - `npm.cmd run rag:quality-report`
  - 결과: exit 0
  - `npm.cmd run rag:benchmark-diagnostics`
  - 결과: exit 0
- cache benchmark:
  - `npm.cmd run rag:cache-benchmark`
  - 결과: exit 0
  - Cache benchmark JSON archive: `benchmarks/results/rag-cache-benchmark-2026-05-04T03-45-55-608Z.json`

### 최신 quality/latency 기준선

현재 `.rag-cache/rag-benchmark.json` 기준:

- Total cases: 27
- Top-3 doc recall: 96.3% (26/27)
- Top-5 doc recall: 96.3% (26/27)
- Expected evidence pass: 100.0% (27/27)
- Forbidden evidence pass: 100.0% (27/27)
- Required citation pass: 100.0% (27/27)
- Failed cases: 없음
- Failed recall cases: 없음
- Failed evidence cases: 없음
- Accepted abstain cases:
  - `integrated-no-grounded-answer`

Latency:

- Total benchmark duration: 130,186ms
- Case latency:
  - average: 3,504.3ms
  - p50: 3,091ms
  - p95: 6,973ms
  - max: 11,686ms
- Retrieval latency:
  - average: 3,428.4ms
  - p50: 3,077ms
  - p95: 6,591ms
  - max: 9,772ms

P2-4 기준선 대비:

- Total benchmark duration: 198,410ms -> 130,186ms
- Case latency average: 5,861.3ms -> 3,504.3ms
- Case latency p95: 15,675ms -> 6,973ms
- Case latency max: 20,470ms -> 11,686ms
- Retrieval latency average: 5,727.5ms -> 3,428.4ms
- Retrieval latency p95: 10,175ms -> 6,591ms
- Retrieval latency max: 20,442ms -> 9,772ms

Slow cases:

- `evaluation-notice-period`: total 11,686ms, retrieval 9,772ms, evidence gate 0
- `evaluation-day-night-care-disliked-foods`: total 6,973ms, retrieval 4,766ms
- `integrated-workforce-standard`: total 6,612ms, retrieval 6,591ms
- `evaluation-rights-required-colloquial`: total 4,769ms, retrieval 4,143ms
- `evaluation-function-training`: total 4,687ms, retrieval 4,675ms, evidence gate 0

### retrieval cache 반복 측정 결과

현재 `.rag-cache/rag-cache-benchmark.json` 기준:

- Cases: 5
- Runs: 10
- Warm retrieval cache hits: 5/5
- Average cold total: 6,168.8ms
- Average warm total: 16.0ms
- Average total reduction: 99.7%
- Average speedup: 421.4x

Case별 cold/warm:

- `evaluation-notice-period`: 7,064ms -> 20ms, 353.2x
- `evaluation-day-night-care-disliked-foods`: 7,945ms -> 11ms, 722.3x
- `integrated-workforce-standard`: 5,938ms -> 12ms, 494.8x
- `evaluation-rights-required-colloquial`: 5,395ms -> 18ms, 299.7x
- `evaluation-function-training`: 4,502ms -> 19ms, 236.9x

해석:

- lexical posting index는 품질 지표를 유지하면서 cold path 평균/p95를 낮췄다.
- explicit document fast path는 안전하게 준비됐지만 현재 golden case에는 발동하지 않았다.
- 남은 slow case 중 `evaluation-notice-period`, `evaluation-function-training`은 evidence gate output 0으로 끝난다.
- 다음 단계에서는 retrieval 이후 evidence gate 0 case를 더 빠르게 종료하거나 confidence/semantic gate를 최적화하는 것이 적절하다.

### 변경 파일

- `src/lib/ragEngine.ts`
- `tests/ragRerankPriority.test.ts`
- `tests/retrievalPipelineGate.test.ts`
- `.rag-cache/rag-benchmark.json`
- `.rag-cache/rag-quality-report.json`
- `.rag-cache/rag-benchmark-diagnostics.json`
- `.rag-cache/rag-cache-benchmark.json`
- `benchmarks/results/rag-benchmark-2026-05-04T03-44-08-590Z.json`
- `benchmarks/results/rag-cache-benchmark-2026-05-04T03-45-55-608Z.json`
- `docs/reports/rag-quality-report.md`
- `docs/reports/rag-benchmark-diagnostics.md`
- `docs/reports/rag-cache-benchmark.md`
- `docs/plans/rag-search-performance-progress.md`

### 다음 작업

P2-6 `evidence gate 0 slow case 기준 semantic fast exit 또는 confidence gate 최적화`로 넘어간다.

권장 작업:

1. `evaluation-notice-period`, `evaluation-function-training`처럼 `answer_evidence_gate=0`인 slow case의 validation/focus gate 실패 이유를 분리한다.
2. retrieval 결과가 이미 low confidence로 귀결될 조건이면 answer evidence gate 이후의 불필요한 확장/정렬을 줄일 수 있는지 TDD로 검증한다.
3. semantic fast exit가 recall/evidence 지표를 해치지 않는지 golden case 전체 benchmark로 확인한다.
4. 필요하면 benchmark performance summary에 `document-fast-path`/`evidence-gate-zero` count를 추가해 이후 반복 측정에서 직접 추적한다.

---

## 2026-05-04 / P2-6 완료: evaluation compliance query support-reference 검색 gate

### 수행 내용

- P2-5 이후 남은 slow case 중 `answer_evidence_gate=0` 패턴을 확인했다.
  - `evaluation-notice-period`
    - `answer_evidence_gate=0`
    - notes: `semantic-validation-failed`, `focus-terms-missing-in-evidence`
    - 문서/자료 lookup 질문이 아니라 평가 통보 기한을 묻는 compliance 질문.
  - `evaluation-function-training`
    - `answer_evidence_gate=0`
    - 다만 질문 자체가 `참고 문서`를 묻는 lookup 성격이 있어 support reference 검색을 유지해야 하는 케이스로 분류.
- TDD 방식으로 evaluation mode의 integrated support-reference 추가 검색 gate를 추가했다.
  - `tests/ragEvaluationSupportSearch.test.ts`
    - compliance 질문은 broad integrated support reference 검색을 건너뛰는지 검증.
    - `참고 문서`, `문서`, `자료`, `매뉴얼`, `사례집`, `어떤 게` 등 reference lookup 신호가 있으면 검색을 유지하는지 검증.
    - definition/comparison 등 non-compliance 질문은 검색을 유지하는지 검증.
- `src/lib/nodeRagService.ts`
  - `shouldSearchIntegratedSupportReferences()` 추가.
  - evaluation branch의 `directSupportSearch`를 위 helper 기준으로 gating.
  - 목표는 semantic validation에서 low confidence로 귀결될 가능성이 높은 compliance 질문에서 integrated support-reference 전체 재검색을 줄이는 것.

### 검증 결과

- RED 확인:
  - `npx.cmd tsx --test tests/ragEvaluationSupportSearch.test.ts`
  - 구현 전 `shouldSearchIntegratedSupportReferences` export 부재로 실패.
- 관련 RAG 테스트:
  - `npx.cmd tsx --test tests/queryIntent.test.ts tests/retrievalPipelineGate.test.ts tests/ragRerankPriority.test.ts tests/ragEvaluationSupportSearch.test.ts tests/ragBenchmarkDiagnostics.test.ts tests/ragGoldenCases.test.ts tests/ragAliasCandidates.test.ts tests/ragDbLexical.test.ts tests/ragBenchmarkReport.test.ts tests/ragQualityReport.test.ts tests/ragEmbeddingVerify.test.ts tests/ragCacheBenchmarkReport.test.ts`
  - 결과: pass 42 / fail 0
- 타입체크:
  - `npx.cmd tsc -p tsconfig.server.json --noEmit`
  - 결과: exit 0
  - `npx.cmd tsc --noEmit`
  - 결과: exit 0
- benchmark:
  - `npm.cmd run rag:bench`
  - 결과: exit 0
  - Benchmark JSON archive: `benchmarks/results/rag-benchmark-2026-05-04T04-09-11-638Z.json`
- 리포트 재생성:
  - `npm.cmd run rag:quality-report`
  - 결과: exit 0
  - `npm.cmd run rag:benchmark-diagnostics`
  - 결과: exit 0
- cache benchmark:
  - `npm.cmd run rag:cache-benchmark`
  - 결과: exit 0
  - Cache benchmark JSON archive: `benchmarks/results/rag-cache-benchmark-2026-05-04T04-11-16-076Z.json`

### 최신 quality/latency 기준선

현재 `.rag-cache/rag-benchmark.json` 기준:

- Total cases: 27
- Top-3 doc recall: 96.3% (26/27)
- Top-5 doc recall: 96.3% (26/27)
- Expected evidence pass: 100.0% (27/27)
- Forbidden evidence pass: 100.0% (27/27)
- Required citation pass: 100.0% (27/27)
- Failed cases: 없음
- Failed recall cases: 없음
- Failed evidence cases: 없음
- Accepted abstain cases:
  - `integrated-no-grounded-answer`

Latency:

- Total benchmark duration: 166,374ms
- Case latency:
  - average: 4,515.5ms
  - p50: 4,676ms
  - p95: 8,898ms
  - max: 11,047ms
- Retrieval latency:
  - average: 4,436.5ms
  - p50: 4,705ms
  - p95: 7,604ms
  - max: 8,570ms

P2-5 기준선 대비:

- Total benchmark duration: 130,186ms -> 166,374ms
- Case latency p95: 6,973ms -> 8,898ms
- Case latency max: 11,686ms -> 11,047ms
- Retrieval latency p95: 6,591ms -> 7,604ms
- Retrieval latency max: 9,772ms -> 8,570ms

P2-6 타깃 case 변화:

- `evaluation-notice-period`: total 11,686ms -> 8,322ms, retrieval 9,772ms -> 6,791ms
- `evaluation-function-training`: 이번 slow top5에서는 제외됨

해석:

- 품질 지표는 유지됐다.
- targeted evidence-gate-zero case인 `evaluation-notice-period`는 개선됐다.
- 그러나 전체 p95는 P2-5 대비 악화됐다. 이는 이번 gate가 특정 evaluation compliance case에는 효과가 있으나 전체 slow case를 안정적으로 낮추는 범용 최적화는 아니라는 뜻이다.
- 다음 단계는 전체 slow case를 evaluation/integrated, routing/direct-support/base-search 비용으로 분리해 어느 sub-search가 p95를 흔드는지 직접 계측하는 것이 적절하다.

### retrieval cache 반복 측정 결과

현재 `.rag-cache/rag-cache-benchmark.json` 기준:

- Cases: 5
- Runs: 10
- Warm retrieval cache hits: 5/5
- Average cold total: 6,410.0ms
- Average warm total: 25.8ms
- Average total reduction: 99.6%
- Average speedup: 293.6x

Case별 cold/warm:

- `evaluation-day-night-care-disliked-foods`: 7,928ms -> 37ms, 214.3x
- `integrated-eligibility-law`: 6,096ms -> 36ms, 169.3x
- `evaluation-notice-period`: 6,141ms -> 27ms, 227.4x
- `integrated-workforce-standard`: 7,002ms -> 19ms, 368.5x
- `integrated-benefit-cost-notice`: 4,883ms -> 10ms, 488.3x

### 변경 파일

- `src/lib/nodeRagService.ts`
- `tests/ragEvaluationSupportSearch.test.ts`
- `.rag-cache/rag-benchmark.json`
- `.rag-cache/rag-quality-report.json`
- `.rag-cache/rag-benchmark-diagnostics.json`
- `.rag-cache/rag-cache-benchmark.json`
- `benchmarks/results/rag-benchmark-2026-05-04T04-09-11-638Z.json`
- `benchmarks/results/rag-cache-benchmark-2026-05-04T04-11-16-076Z.json`
- `docs/reports/rag-quality-report.md`
- `docs/reports/rag-benchmark-diagnostics.md`
- `docs/reports/rag-cache-benchmark.md`
- `docs/plans/rag-search-performance-progress.md`

### 다음 작업

P2-7 `전체 slow case p95 안정화 및 evaluation/integrated 공통 retrieval 비용 분리`로 넘어간다.

권장 작업:

1. `executeSearch()` 내부 sub-search별 latency를 계측한다.
   - evaluation: routing search, direct support search, base search, promoted primary search, primary manual search.
   - integrated: initial search, reranked search, promoted primary search.
2. benchmark performance summary에 slow case별 sub-search latency를 기록한다.
3. p95를 흔드는 sub-search를 기준으로 추가 gate를 설계한다.
4. P2-6 support-reference gate는 품질을 해치지 않았고 targeted case에는 효과가 있으므로 유지하되, 전체 p95 기준으로는 추가 계측 후 재평가한다.

---

## 2026-05-04 / P2-7 완료: sub-search latency 계측 및 slow case 리포트 연결

### 수행 내용

- TDD 방식으로 benchmark performance summary와 quality report에 slow case별 sub-search latency를 노출했다.
  - `tests/ragBenchmarkReport.test.ts`
    - `plannerTrace`의 `sub-search-latency` 항목을 파싱해 slow case summary에 `subSearchLatencyMs`로 포함하는 기대값을 추가했다.
  - `tests/ragQualityReport.test.ts`
    - slow benchmark case markdown에 `sub-search evaluation-base=220ms` 형식의 출력이 포함되는지 검증했다.
- `src/lib/ragBenchmarkReport.ts`
  - `plannerTrace` 입력을 performance summary 입력에 포함했다.
  - `sub-search-latency` trace detail을 `stage=123ms` 형식으로 파싱해 slow case에 정렬된 map으로 기록한다.
- `src/lib/ragQualityReport.ts`
  - slow benchmark case 라인에 `sub-search ...` 항목을 추가했다.
- `src/lib/nodeRagService.ts`
  - `executeSearch()` 내부 `searchStore()` 호출별 latency를 기록했다.
  - evaluation mode:
    - `evaluation-routing`
    - `evaluation-direct-support`
    - `evaluation-base`
    - `evaluation-promoted-primary`
    - `evaluation-primary-manual`
  - integrated mode:
    - `integrated-initial`
    - `integrated-reranked`
    - `integrated-promoted-primary`
  - `runRetrievalPlan()`에서 해당 map을 `plannerTrace`의 `sub-search-latency` 항목으로 남긴다.
- `scripts/rag-benchmark.ts`
  - benchmark result에 `inspection.plannerTrace`를 포함해 performance summary와 quality report까지 계측값이 전달되도록 했다.

### 검증 결과

- RED 확인:
  - `npx.cmd tsx --test tests/ragQualityReport.test.ts`
  - 구현 전 `sub-search evaluation-base=220ms` 출력 누락으로 실패.
- focused report 테스트:
  - `npx.cmd tsx --test tests/ragBenchmarkReport.test.ts tests/ragQualityReport.test.ts`
  - 결과: pass 7 / fail 0
- 관련 RAG 테스트:
  - `npx.cmd tsx --test tests/queryIntent.test.ts tests/retrievalPipelineGate.test.ts tests/ragRerankPriority.test.ts tests/ragEvaluationSupportSearch.test.ts tests/ragBenchmarkDiagnostics.test.ts tests/ragGoldenCases.test.ts tests/ragAliasCandidates.test.ts tests/ragDbLexical.test.ts tests/ragBenchmarkReport.test.ts tests/ragQualityReport.test.ts tests/ragEmbeddingVerify.test.ts tests/ragCacheBenchmarkReport.test.ts`
  - 결과: pass 42 / fail 0
- 타입체크:
  - `npm.cmd run typecheck`
  - 결과: script 없음.
  - `npm.cmd run lint`
  - 결과: exit 0 (`tsc --noEmit && tsc -p tsconfig.server.json --noEmit`)
  - `npx.cmd tsc --noEmit`
  - 결과: exit 0
  - `npx.cmd tsc -p tsconfig.server.json --noEmit`
  - 결과: exit 0
- benchmark:
  - `npm.cmd run rag:bench`
  - 결과: exit 0
  - Benchmark JSON archive: `benchmarks/results/rag-benchmark-2026-05-04T07-01-59-699Z.json`
- 리포트 재생성:
  - `npm.cmd run rag:quality-report`
  - 결과: exit 0
  - `npm.cmd run rag:benchmark-diagnostics`
  - 결과: exit 0
- cache benchmark:
  - `npm.cmd run rag:cache-benchmark`
  - 결과: exit 0
  - Cache benchmark JSON archive: `benchmarks/results/rag-cache-benchmark-2026-05-04T07-04-19-300Z.json`

### 최신 quality/latency 기준선

현재 `.rag-cache/rag-benchmark.json` 기준:

- Total cases: 27
- Top-3 doc recall: 96.3% (26/27)
- Top-5 doc recall: 96.3% (26/27)
- Expected evidence pass: 100.0% (27/27)
- Forbidden evidence pass: 100.0% (27/27)
- Required citation pass: 100.0% (27/27)
- Failed cases: 없음
- Failed recall cases: 없음
- Failed evidence cases: 없음
- Accepted abstain cases:
  - `integrated-no-grounded-answer`

Latency:

- Total benchmark duration: 120,406ms
- Case latency:
  - average: 3,570ms
  - p50: 3,671ms
  - p95: 6,456ms
  - max: 11,436ms
- Retrieval latency:
  - average: 3,492.4ms
  - p50: 3,654ms
  - p95: 6,440ms
  - max: 7,323ms

P2-6 기준선 대비:

- Total benchmark duration: 166,374ms -> 120,406ms
- Case latency p95: 8,898ms -> 6,456ms
- Case latency max: 11,047ms -> 11,436ms
- Retrieval latency p95: 7,604ms -> 6,440ms
- Retrieval latency max: 8,570ms -> 7,323ms

Slow case sub-search latency:

- `evaluation-day-night-care-disliked-foods`: total 11,436ms, retrieval 7,323ms
  - `evaluation-direct-support=4180ms`
  - `evaluation-routing=1132ms`
  - `evaluation-base=1003ms`
  - `evaluation-primary-manual=71ms`
- `integrated-integrated-homecare-manual`: total 6,456ms, retrieval 6,440ms
  - `integrated-initial=5377ms`
- `integrated-workforce-standard`: total 4,777ms, retrieval 4,755ms
  - `integrated-initial=3997ms`
- `integrated-law-alias-article-variant`: total 4,370ms, retrieval 4,354ms
  - `integrated-initial=3475ms`
- `integrated-caregiver-continuing-education`: total 4,359ms, retrieval 4,335ms
  - `integrated-initial=3603ms`

해석:

- 품질 지표는 유지됐다.
- 이번 단계는 직접 latency 최적화가 아니라 병목 계측이므로, p95 개선은 런 편차와 이전 단계 효과가 섞인 결과로 봐야 한다.
- 현재 slow top case는 evaluation의 `direct-support` 추가 검색이 가장 크다.
- integrated slow cases는 대부분 `integrated-initial` 단일 검색 비용이 지배적이다.
- 다음 최적화는 `evaluation-direct-support`의 호출 조건/후보 범위 축소와 `integrated-initial` cold path 후보 생성 비용을 우선 대상으로 삼는 것이 적절하다.

### retrieval cache 반복 측정 결과

현재 `.rag-cache/rag-cache-benchmark.json` 기준:

- Cases: 5
- Runs: 10
- Warm retrieval cache hits: 5/5
- Average cold total: 7,027ms
- Average warm total: 22ms
- Average total reduction: 99.7%
- Average speedup: 336.0x

Case별 cold/warm:

- `evaluation-day-night-care-disliked-foods`: 9,684ms -> 19ms, 509.7x
- `integrated-integrated-homecare-manual`: 6,382ms -> 18ms, 354.6x
- `integrated-workforce-standard`: 7,857ms -> 20ms, 392.9x
- `integrated-law-alias-article-variant`: 5,254ms -> 25ms, 210.2x
- `integrated-caregiver-continuing-education`: 5,958ms -> 28ms, 212.8x

### 변경 파일

- `src/lib/nodeRagService.ts`
- `src/lib/ragBenchmarkReport.ts`
- `src/lib/ragQualityReport.ts`
- `scripts/rag-benchmark.ts`
- `tests/ragBenchmarkReport.test.ts`
- `tests/ragQualityReport.test.ts`
- `.rag-cache/rag-benchmark.json`
- `.rag-cache/rag-quality-report.json`
- `.rag-cache/rag-benchmark-diagnostics.json`
- `.rag-cache/rag-cache-benchmark.json`
- `benchmarks/results/rag-benchmark-2026-05-04T07-01-59-699Z.json`
- `benchmarks/results/rag-cache-benchmark-2026-05-04T07-04-19-300Z.json`
- `docs/reports/rag-quality-report.md`
- `docs/reports/rag-benchmark-diagnostics.md`
- `docs/reports/rag-cache-benchmark.md`
- `docs/plans/rag-search-performance-progress.md`

### 다음 작업

P2-8 `sub-search latency 병목 기준 direct-support/integrated-initial 최적화`로 넘어간다.

권장 작업:

1. `evaluation-day-night-care-disliked-foods`의 `evaluation-direct-support=4180ms`를 기준으로 direct support 검색의 reference lookup 조건 또는 candidate scope를 더 좁힌다.
2. integrated slow case의 `integrated-initial` 비용을 줄이기 위해 source role / query intent 기준 candidate cap 또는 posting index 후보 집합 축소를 실험한다.
3. 각 실험은 Top-3/Top-5/evidence/citation 100% 계열 지표를 유지하는지 benchmark 전체로 검증한다.

---

## 2026-05-04 / P2-8 완료: direct-support/integrated-initial 최적화

### 수행 내용

- TDD 방식으로 sub-search 병목 최적화를 진행했다.
- 실패 테스트를 먼저 추가했다.
  - `tests/ragEvaluationSupportSearch.test.ts`: evaluation direct support 검색 전에 통합 support reference 문서 scope를 focused query 기준으로 좁히는 기대값을 추가했다.
  - `tests/retrievalPipelineGate.test.ts`: lexical candidate budget을 적용해도 rare query term 후보가 먼저 살아남는 기대값을 추가했다.
- `src/lib/ragEngine.ts`
  - `SearchOptions.maxLexicalCandidateChunks`를 추가했다.
  - lexical posting union을 df가 낮은 rare token부터 펼치도록 바꿨다.
  - `allowedDocumentIds`가 있을 때는 전체 posting을 먼저 펼치지 않고 scoped document chunk만 token intersection으로 검사하도록 변경했다.
  - bounded search에서는 exact candidate scan도 lexical candidate chunk pool을 재사용해 integrated cold path의 전체 chunk scan 비용을 줄였다.
- `src/lib/nodeRagService.ts`
  - `selectIntegratedSupportReferenceScope()`를 추가해 evaluation direct support 검색 전 통합 support reference 문서를 focus term 기준으로 최대 8개까지 좁혔다.
  - direct support 검색에 `RAG_DIRECT_SUPPORT_MAX_LEXICAL_CHUNKS` 기본 900을 적용했다.
  - integrated initial 검색에 `RAG_INTEGRATED_INITIAL_MAX_LEXICAL_CHUNKS` 기본 2,800을 적용했다.
  - 기존 P2-7 sub-search latency 계측은 유지했다.

### 검증 결과

- RED 확인:
  - `npx.cmd tsx --test tests/ragEvaluationSupportSearch.test.ts tests/retrievalPipelineGate.test.ts`
  - 최초 sandbox 실행은 `spawn EPERM`으로 실패했다. 같은 명령을 권한 상승으로 재실행해 신규 테스트 포함 pass 13 / fail 0을 확인했다.
- 관련 RAG 테스트:
  - `npx.cmd tsx --test tests/queryIntent.test.ts tests/retrievalPipelineGate.test.ts tests/ragRerankPriority.test.ts tests/ragEvaluationSupportSearch.test.ts tests/ragBenchmarkDiagnostics.test.ts tests/ragGoldenCases.test.ts tests/ragAliasCandidates.test.ts tests/ragDbLexical.test.ts tests/ragBenchmarkReport.test.ts tests/ragQualityReport.test.ts tests/ragEmbeddingVerify.test.ts tests/ragCacheBenchmarkReport.test.ts`
  - 결과: pass 44 / fail 0
- 타입체크:
  - `npm.cmd run lint`: exit 0 (`tsc --noEmit && tsc -p tsconfig.server.json --noEmit`)
  - `npx.cmd tsc --noEmit`: exit 0
  - `npx.cmd tsc -p tsconfig.server.json --noEmit`: exit 0
- benchmark:
  - `npm.cmd run rag:bench`: exit 0
  - Benchmark JSON archive: `benchmarks/results/rag-benchmark-2026-05-04T11-21-47-663Z.json`
- 리포트 재생성:
  - `npm.cmd run rag:quality-report`: exit 0
  - `npm.cmd run rag:benchmark-diagnostics`: exit 0
- cache benchmark:
  - `npm.cmd run rag:cache-benchmark`: exit 0
  - Cache benchmark JSON archive: `benchmarks/results/rag-cache-benchmark-2026-05-04T11-22-31-154Z.json`

### 최신 quality/latency 기준선

현재 `.rag-cache/rag-benchmark.json` 기준:

- Total cases: 27
- Top-3 doc recall: 96.3% (26/27)
- Top-5 doc recall: 96.3% (26/27)
- Expected evidence pass: 100.0% (27/27)
- Forbidden evidence pass: 100.0% (27/27)
- Required citation pass: 100.0% (27/27)
- Failed cases: 없음
- Failed recall cases: 없음
- Failed evidence cases: 없음
- Accepted abstain cases:
  - `integrated-no-grounded-answer`

Latency:

- Total benchmark duration: 30,490ms
- Case latency:
  - average: 713.2ms
  - p50: 643ms
  - p95: 1,831ms
  - max: 2,588ms
- Retrieval latency:
  - average: 649.4ms
  - p50: 637ms
  - p95: 1,285ms
  - max: 1,394ms

P2-7 기준선 대비:

- Total benchmark duration: 120,406ms -> 30,490ms
- Case latency average: 3,570ms -> 713.2ms
- Case latency p95: 6,456ms -> 1,831ms
- Case latency max: 11,436ms -> 2,588ms
- Retrieval latency average: 3,492.4ms -> 649.4ms
- Retrieval latency p95: 6,440ms -> 1,285ms
- Retrieval latency max: 7,323ms -> 1,394ms

Slow case sub-search latency:

- `evaluation-day-night-care-disliked-foods`: total 2,588ms, retrieval 1,285ms
  - `evaluation-base=454ms`
  - `evaluation-routing=338ms`
  - `evaluation-direct-support=133ms`
  - `evaluation-primary-manual=35ms`
- `evaluation-notice-period`: total 1,831ms, retrieval 1,394ms
  - `evaluation-base=530ms`
  - `evaluation-routing=506ms`
  - `evaluation-promoted-primary=76ms`
- `evaluation-rights-required-colloquial`: total 1,171ms, retrieval 758ms
  - `evaluation-base=262ms`
  - `evaluation-routing=262ms`
  - `evaluation-primary-manual=26ms`
- `integrated-workforce-standard`: total 856ms, retrieval 840ms
  - `integrated-initial=454ms`
- `evaluation-employee-rights-education`: total 838ms, retrieval 823ms
  - `evaluation-base=274ms`
  - `evaluation-routing=203ms`
  - `evaluation-direct-support=78ms`
  - `evaluation-primary-manual=24ms`

해석:

- 품질 지표는 유지됐다.
- P2-7의 대표 병목이었던 `evaluation-day-night-care-disliked-foods`의 `evaluation-direct-support`는 4,180ms -> 133ms로 감소했다.
- integrated slow case의 `integrated-initial`도 3~5초대에서 대표 slow case 기준 454ms 수준으로 감소했다.
- 현재 p95는 direct-support/integrated-initial보다 evaluation base/routing 계열이 더 큰 비중을 차지한다.
- `evaluation-notice-period`, `evaluation-rights-required-colloquial`은 여전히 `answer_evidence_gate=0` 패턴이 남아 있어 latency보다는 evidence gate/semantic validation 품질 쪽 후속 점검이 더 적합하다.

### retrieval cache 반복 측정 결과

현재 `.rag-cache/rag-cache-benchmark.json` 기준:

- Cases: 5
- Runs: 10
- Warm retrieval cache hits: 5/5
- Average cold total: 1,522ms
- Average warm total: 16ms
- Average total reduction: 98.9%
- Average speedup: 93.0x

Case별 cold/warm:

- `evaluation-day-night-care-disliked-foods`: 2,778ms -> 18ms, 154.3x
- `evaluation-notice-period`: 1,876ms -> 16ms, 117.3x
- `evaluation-rights-required-colloquial`: 1,242ms -> 15ms, 82.8x
- `integrated-workforce-standard`: 849ms -> 16ms, 53.1x
- `evaluation-employee-rights-education`: 865ms -> 15ms, 57.7x

### 변경 파일

- `src/lib/ragEngine.ts`
- `src/lib/nodeRagService.ts`
- `tests/ragEvaluationSupportSearch.test.ts`
- `tests/retrievalPipelineGate.test.ts`
- `.rag-cache/rag-benchmark.json`
- `.rag-cache/rag-quality-report.json`
- `.rag-cache/rag-benchmark-diagnostics.json`
- `.rag-cache/rag-cache-benchmark.json`
- `benchmarks/results/rag-benchmark-2026-05-04T11-21-47-663Z.json`
- `benchmarks/results/rag-cache-benchmark-2026-05-04T11-22-31-154Z.json`
- `docs/reports/rag-quality-report.md`
- `docs/reports/rag-benchmark-diagnostics.md`
- `docs/reports/rag-cache-benchmark.md`
- `docs/plans/rag-search-performance-progress.md`

### 다음 작업

P2-9 `evaluation base/routing 및 evidence gate 0 case 후속 최적화`로 넘어간다.

권장 작업:

1. `evaluation-notice-period`, `evaluation-rights-required-colloquial`의 `answer_evidence_gate=0` 원인을 semantic validation/focus term/evidence composition 별로 분리한다.
2. `evaluation-base`와 `evaluation-routing`이 동시에 큰 case에서 routing 결과를 base search에 재사용하거나, primaryExpansionDocumentIds가 없는 경우 base scope를 더 좁힐 수 있는지 TDD로 검증한다.
3. latency 개선이 evidence/citation 100% 계열 지표를 해치지 않는지 전체 benchmark로 확인한다.

---

## 2026-05-04 / P2-9 완료: evaluation evidence gate 0 후속 최적화

### 수행 내용

- P2-8 이후 남은 slow/gate 0 case를 분석했다.
  - `evaluation-notice-period`: 검색 결과는 `2026년 주야간보호 평가매뉴얼`, `01-01-운영규정`, Q&A 근거를 포함했지만 semantic validation이 compliance 질의에 legal/practical 조합을 요구해 `answer_evidence_gate=0`으로 낮아졌다.
  - `evaluation-rights-required-colloquial`: `01-06-직원교육`, `01-07-직원인권보호` 계열 후보가 잡혔지만 evaluation 중심 근거를 compliance authority로 인정하지 않아 gate가 낮아졌다.
- TDD 방식으로 evaluation compliance validation test를 추가했다.
  - `tests/ragEvaluationValidation.test.ts`
  - primary evaluation evidence가 있는 compliance 질의는 별도 법령 근거가 없어도 blocking `basis-confusion`으로 처리하지 않는 기대값을 추가했다.
- `src/lib/ragSemanticValidation.ts`
  - `hasEvaluationComplianceAuthority()`를 추가했다.
  - compliance 질의에서 `mode=evaluation`이고 `sourceRole=primary_evaluation` 또는 `sourceType=evaluation` 근거가 있으면 evaluation 근거를 평가 compliance authoritative basis로 인정했다.
  - 이 경우 legal/practical 부족을 block으로 올리지 않고, 직접 법령 근거 없음에 따른 `basis-confusion`도 발생시키지 않도록 조정했다.
- evaluation routing/base lexical cap 실험도 진행했다.
  - `RAG_EVALUATION_ROUTING_MAX_LEXICAL_CHUNKS`, `RAG_EVALUATION_BASE_MAX_LEXICAL_CHUNKS` 형태로 후보 예산을 걸어봤다.
  - benchmark에서 Top-3/Top-5 recall이 96.3% -> 88.9%로 하락하고 `evaluation-notice-period`, `evaluation-employee-rights-education` recall miss가 발생해 해당 실험은 폐기했다.
  - 결론: evaluation routing/base는 현 corpus에서 후보 축소보다 정확도 민감도가 높으므로 별도 재사용/캐시 전략이 더 적합하다.

### 검증 결과

- RED 확인:
  - `npx.cmd tsx --test tests/ragEvaluationValidation.test.ts`
  - 구현 전 blocking validation으로 실패 확인.
- focused P2-9 테스트:
  - `npx.cmd tsx --test tests/ragEvaluationValidation.test.ts tests/ragEvaluationSupportSearch.test.ts tests/retrievalPipelineGate.test.ts`
  - 결과: pass 14 / fail 0
- 관련 RAG 테스트:
  - `npx.cmd tsx --test tests/queryIntent.test.ts tests/retrievalPipelineGate.test.ts tests/ragRerankPriority.test.ts tests/ragEvaluationSupportSearch.test.ts tests/ragEvaluationValidation.test.ts tests/ragBenchmarkDiagnostics.test.ts tests/ragGoldenCases.test.ts tests/ragAliasCandidates.test.ts tests/ragDbLexical.test.ts tests/ragBenchmarkReport.test.ts tests/ragQualityReport.test.ts tests/ragEmbeddingVerify.test.ts tests/ragCacheBenchmarkReport.test.ts`
  - 결과: pass 45 / fail 0
- 타입체크:
  - `npm.cmd run lint`: exit 0 (`tsc --noEmit && tsc -p tsconfig.server.json --noEmit`)
  - `npx.cmd tsc --noEmit`: exit 0
  - `npx.cmd tsc -p tsconfig.server.json --noEmit`: exit 0
- benchmark:
  - `npm.cmd run rag:bench`: exit 0
  - Benchmark JSON archive: `benchmarks/results/rag-benchmark-2026-05-04T12-01-04-463Z.json`
- 리포트 재생성:
  - `npm.cmd run rag:quality-report`: exit 0
  - `npm.cmd run rag:benchmark-diagnostics`: exit 0
- cache benchmark:
  - `npm.cmd run rag:cache-benchmark`: exit 0
  - Cache benchmark JSON archive: `benchmarks/results/rag-cache-benchmark-2026-05-04T12-01-37-433Z.json`

### 최신 quality/latency 기준선

현재 `.rag-cache/rag-benchmark.json` 기준:

- Total cases: 27
- Top-3 doc recall: 96.3% (26/27)
- Top-5 doc recall: 96.3% (26/27)
- Expected evidence pass: 100.0% (27/27)
- Forbidden evidence pass: 100.0% (27/27)
- Required citation pass: 100.0% (27/27)
- Failed cases: 없음
- Failed recall cases: 없음
- Failed evidence cases: 없음
- Accepted abstain cases:
  - `integrated-no-grounded-answer`

Latency:

- Total benchmark duration: 30,237ms
- Case latency:
  - average: 718.4ms
  - p50: 652ms
  - p95: 1,857ms
  - max: 2,588ms
- Retrieval latency:
  - average: 655.1ms
  - p50: 639ms
  - p95: 1,306ms
  - max: 1,416ms

P2-8 기준선 대비:

- Total benchmark duration: 30,490ms -> 30,237ms
- Case latency average: 713.2ms -> 718.4ms
- Case latency p95: 1,831ms -> 1,857ms
- Retrieval latency average: 649.4ms -> 655.1ms
- Retrieval latency p95: 1,285ms -> 1,306ms

Gate 0 개선:

- `evaluation-notice-period`
  - before: `answer_evidence_gate=0`, confidence low, `semantic-validation-failed`, `basis-confusion`
  - after: `answer_evidence_gate=7`, confidence high, validation warning만 남음
  - evidence docs: `2026년 주야간보호 평가매뉴얼(26년꺼만)`, `01-01-운영규정`, `2020년_재가급여_평가매뉴얼_다빈도_Q&A_사례집`
- `evaluation-rights-required-colloquial`
  - before: `answer_evidence_gate=0`, confidence low
  - after: `answer_evidence_gate=14`, confidence high, validation warning만 남음
  - evidence docs: `2026년 주야간보호 평가매뉴얼(26년꺼만)`, `02-05-노인인권보호`, `01-05-보수교육`, `01-08-직원권익향상` 등

Slow case sub-search latency:

- `evaluation-day-night-care-disliked-foods`: total 2,588ms, retrieval 1,306ms
  - `evaluation-base=466ms`
  - `evaluation-routing=336ms`
  - `evaluation-direct-support=140ms`
  - `evaluation-primary-manual=38ms`
- `evaluation-notice-period`: total 1,857ms, retrieval 1,416ms
  - `evaluation-base=538ms`
  - `evaluation-routing=523ms`
  - `evaluation-promoted-primary=77ms`
- `evaluation-rights-required-colloquial`: total 1,208ms, retrieval 779ms
  - `evaluation-base=265ms`
  - `evaluation-routing=268ms`
  - `evaluation-primary-manual=26ms`
- `evaluation-employee-rights-education`: total 840ms, retrieval 824ms
  - `evaluation-base=271ms`
  - `evaluation-routing=201ms`
  - `evaluation-direct-support=80ms`
  - `evaluation-primary-manual=23ms`
- `integrated-workforce-standard`: total 838ms, retrieval 822ms
  - `integrated-initial=447ms`

해석:

- 품질 지표는 P2-8 수준으로 유지됐다.
- 이번 단계의 핵심 목표였던 evaluation evidence gate 0 case는 개선됐다.
- latency는 P2-8과 거의 같은 수준이며, evaluation routing/base cap은 정확도 손실 때문에 폐기했다.
- 다음 latency 개선은 후보 cap보다 evaluation routing/base 결과 재사용, search result memoization, 또는 primaryExpansionDocumentIds 기반의 안전한 scoped rerun 쪽이 적합하다.

### retrieval cache 반복 측정 결과

현재 `.rag-cache/rag-cache-benchmark.json` 기준:

- Cases: 5
- Runs: 10
- Warm retrieval cache hits: 5/5
- Average cold total: 1,513.2ms
- Average warm total: 16.4ms
- Average total reduction: 98.9%
- Average speedup: 91.3x

Case별 cold/warm:

- `evaluation-day-night-care-disliked-foods`: 2,804ms -> 17ms, 164.9x
- `evaluation-notice-period`: 1,868ms -> 17ms, 109.9x
- `evaluation-rights-required-colloquial`: 1,220ms -> 16ms, 76.3x
- `evaluation-employee-rights-education`: 856ms -> 15ms, 57.1x
- `integrated-workforce-standard`: 818ms -> 17ms, 48.1x

### 변경 파일

- `src/lib/ragSemanticValidation.ts`
- `tests/ragEvaluationValidation.test.ts`
- `.rag-cache/rag-benchmark.json`
- `.rag-cache/rag-quality-report.json`
- `.rag-cache/rag-benchmark-diagnostics.json`
- `.rag-cache/rag-cache-benchmark.json`
- `benchmarks/results/rag-benchmark-2026-05-04T12-01-04-463Z.json`
- `benchmarks/results/rag-cache-benchmark-2026-05-04T12-01-37-433Z.json`
- `docs/reports/rag-quality-report.md`
- `docs/reports/rag-benchmark-diagnostics.md`
- `docs/reports/rag-cache-benchmark.md`
- `docs/plans/rag-search-performance-progress.md`

### 다음 작업

P2-10 `evaluation routing/base 결과 재사용 및 안전한 search memoization`으로 넘어간다.

권장 작업:

1. 동일 `searchQuery + mode + allowedDocumentIds + priority` 조합의 `searchStore()` 호출을 retrieval plan 내부에서 memoize할 수 있는지 TDD로 검증한다.
2. evaluation routing 결과에서 이미 충분한 primary evaluation evidence가 있는 경우 base search가 동일 corpus를 다시 full scan하지 않도록 재사용하는 전략을 실험한다.
3. 후보 cap처럼 recall을 해치는 방식은 피하고, 동일 결과 재사용/캐시 중심으로 p95를 줄인다.

## 2026-05-04 / P2-10 완료: retrieval plan searchStore memoization

### 목표

P2-9 이후 다음 병목 후보였던 evaluation routing/base 및 integrated sub-search 경로에서, 동일 retrieval plan 안의 같은 `searchStore()` 호출을 안전하게 재사용할 수 있는 기반을 추가했다. 이번 단계에서는 recall에 영향을 주는 후보 pruning은 더 진행하지 않고, search key 정규화와 per-plan memoization만 TDD로 고정했다.

### TDD

추가 테스트: `tests/ragSearchMemo.test.ts`

- `buildSearchStoreMemoKey()`가 `allowedDocumentIds`, `documentScoreBoosts`, `chunkScoreBoosts`, `excludedEvidenceRoles`처럼 순서가 없는 옵션을 canonical key로 정규화하는지 검증했다.
- document scope나 evidence exclusion이 달라지면 다른 key가 생성되는지 검증했다.
- `createSearchStoreMemo()`가 동일 호출을 1회만 실행하고, scope가 달라진 호출은 별도로 실행하는지 검증했다.

RED 확인:

- `npx.cmd tsx --test tests/ragSearchMemo.test.ts`
- 최초 sandbox 실행은 `spawn EPERM`으로 실패했고, escalated 재실행에서 expected failure: `nodeRagService`가 `buildSearchStoreMemoKey` export를 제공하지 않아 실패했다.

### 구현

변경 파일:

- `src/lib/nodeRagService.ts`
  - `buildSearchStoreMemoKey()` 추가
  - `createSearchStoreMemo()` 추가
  - `SearchPlanningOptions.searchMemo` 내부 옵션 추가
  - `executeSearch()`의 integrated/evaluation sub-search 호출을 memoized runner로 교체
  - `runRetrievalPlan()`에서 plan 단위 memo를 생성해 initial/facet/aspect/refine search가 공유하도록 연결
  - memo hit가 실제 발생한 경우 planner trace에 `search-memo` 통계를 남기도록 추가
- `tests/ragSearchMemo.test.ts`
- `docs/plans/rag-search-performance-progress.md`

### 검증

통과:

- `npx.cmd tsx --test tests/ragSearchMemo.test.ts`
- `npx.cmd tsx --test tests/queryIntent.test.ts tests/retrievalPipelineGate.test.ts tests/ragRerankPriority.test.ts tests/ragEvaluationSupportSearch.test.ts tests/ragEvaluationValidation.test.ts tests/ragSearchMemo.test.ts tests/ragBenchmarkDiagnostics.test.ts tests/ragGoldenCases.test.ts tests/ragAliasCandidates.test.ts tests/ragDbLexical.test.ts tests/ragBenchmarkReport.test.ts tests/ragQualityReport.test.ts tests/ragEmbeddingVerify.test.ts tests/ragCacheBenchmarkReport.test.ts`
  - 48 tests pass
- `npm.cmd run lint`
- `npx.cmd tsc --noEmit`
- `npx.cmd tsc -p tsconfig.server.json --noEmit`
- `npm.cmd run rag:bench`
- `npm.cmd run rag:quality-report`
- `npm.cmd run rag:benchmark-diagnostics`
- `npm.cmd run rag:cache-benchmark`

참고: `rag:quality-report`, `rag:benchmark-diagnostics`, `rag:cache-benchmark`는 sandbox에서 `spawn EPERM`으로 실패해 escalated로 재실행했다.

### benchmark 결과

현재 `.rag-cache/rag-benchmark.json` 기준:

- Total cases: 27
- Top-3 doc recall: 96.3% (26/27)
- Top-5 doc recall: 96.3% (26/27)
- Expected evidence pass: 100.0% (27/27)
- Forbidden evidence pass: 100.0% (27/27)
- Required citation pass: 100.0% (27/27)
- Failed recall cases: 없음
- Accepted abstain cases: `integrated-no-grounded-answer`

Latency:

- Total benchmark duration: 30,187ms
- Case latency average: 715.6ms
- Case latency p95: 1,877ms
- Retrieval latency average: 654.5ms
- Retrieval latency p95: 1,289ms

P2-9 기준 대비:

- Total benchmark duration: 30,237ms -> 30,187ms
- Case latency average: 718.4ms -> 715.6ms
- Case latency p95: 1,857ms -> 1,877ms
- Retrieval latency average: 655.1ms -> 654.5ms
- Retrieval latency p95: 1,306ms -> 1,289ms

Archive:

- `benchmarks/results/rag-benchmark-2026-05-04T12-17-42-160Z.json`

### cache benchmark 결과

현재 `.rag-cache/rag-cache-benchmark.json` 기준:

- Cases: 5
- Runs: 10
- Warm retrieval cache hits: 5/5
- Average cold total: 1,452.0ms
- Average warm total: 16.8ms
- Average speedup: 84.3x

Archive:

- `benchmarks/results/rag-cache-benchmark-2026-05-04T12-18-22-937Z.json`

### 해석

- P2-10은 후보 수를 더 줄이지 않아서 P2-9의 recall/evidence/citation 품질을 그대로 유지했다.
- 평균 retrieval latency는 거의 동일하고 p95 retrieval은 1,306ms -> 1,289ms로 소폭 개선됐다. case p95는 run 편차로 1,857ms -> 1,877ms가 됐다.
- 현재 benchmark set에서는 동일 search 호출이 항상 많이 반복되는 구조는 아니므로, 이번 단계의 효과는 큰 즉시 개선보다 안전한 재사용 기반 확보에 가깝다.
- memo key가 scope/exclusion/priority/semanticFrame/precomputed candidates를 포함하므로 서로 다른 검색 조건을 잘못 공유하는 위험은 낮게 잡았다.

### 다음 작업

P2-11 후보: `search-memo hit diagnostics 및 repeated sub-search target 발굴`

권장 작업:

1. benchmark diagnostics에 `plannerTrace.search-memo` 또는 sub-search별 memo hit/miss 집계를 노출한다.
2. hit가 거의 없는 slow case에서는 routing/base가 왜 다른 key가 되는지 분석해, 안전하게 재사용 가능한 중간 산출물 lexical/vector candidate cache를 더 작은 단위로 분리할지 판단한다.
3. P2-10의 plan-level memoization은 유지하되, 다음 최적화는 `searchCorpus` 내부 precomputed lexical/vector 후보 재사용처럼 실제 hot path에 더 가까운 계층에서 TDD로 진행한다.

추가 확인:

- Latest golden benchmark에서 `plannerTrace.search-memo` hit는 0건이었다. 즉 P2-10 memo는 품질-safe 기반은 마련했지만, 현재 slow case의 주 병목은 동일 `searchStore()` 호출 반복보다 routing/base 각각의 내부 lexical/vector 후보 생성 비용에 더 가깝다.
- 테스트 보강: `tests/ragSearchMemo.test.ts`의 memo reuse 검증을 `Promise.all` 병렬 호출로 변경해 in-flight promise 공유까지 확인했다.

## 2026-05-04 / P2-11 완료: search memo 및 repeated sub-search diagnostics

### 목표

P2-10에서 plan-level `searchStore()` memoization을 추가했지만, 최신 golden benchmark에서 실제 hit가 보이지 않았다. P2-11은 같은 최적화를 더 밀기 전에, memo hit/miss와 sub-search stage별 반복 latency를 benchmark/diagnostics/quality report에 노출해 다음 hot path를 확인하는 단계로 진행했다.

### TDD

수정/추가 테스트:

- `tests/ragBenchmarkReport.test.ts`
  - `plannerTrace.search-memo`를 parse해 `performance.searchMemo`로 집계하는지 검증했다.
  - slow case에 `searchMemoStats`가 포함되는지 검증했다.
  - `sub-search-latency`를 stage별 aggregate인 `subSearchLatencySummary`로 집계하는지 검증했다.
- `tests/ragBenchmarkDiagnostics.test.ts`
  - benchmark diagnostics summary에 search memo diagnostics와 repeated sub-search latency targets가 표시되는지 검증했다.
- `tests/ragQualityReport.test.ts`
  - quality report markdown에 search memo 및 sub-search latency target 요약이 출력되는지 검증했다.

RED 확인:

- `npx.cmd tsx --test tests/ragBenchmarkReport.test.ts tests/ragBenchmarkDiagnostics.test.ts`
- 예상대로 `summary.searchMemo`/`searchMemoStats`/`subSearchLatencyTargets`가 없어 실패했다.

### 구현

변경 파일:

- `src/lib/ragBenchmarkReport.ts`
  - `BenchmarkSearchMemoSummary`, `BenchmarkSearchMemoCaseSummary`, `BenchmarkSubSearchLatencySummary` 추가
  - `plannerTrace.search-memo` parser 추가
  - `performance.searchMemo` 및 `performance.subSearchLatencySummary` 집계 추가
  - slow case에 `searchMemoStats` 포함
- `src/lib/ragBenchmarkDiagnostics.ts`
  - diagnostics summary에 `searchMemo`, `subSearchLatencyTargets` 추가
  - markdown에 `Search memo diagnostics`, `Repeated sub-search latency targets` 섹션 추가
- `src/lib/ragQualityReport.ts`
  - benchmark performance 섹션에 search memo 요약과 sub-search latency target 요약 추가
  - slow case line에 case별 search memo stats 추가
- `src/lib/nodeRagService.ts`
  - memo hit가 없고 miss만 있는 경우에도 `search-memo` planner trace를 남기도록 보정
- tests 3개 업데이트
- `docs/plans/rag-search-performance-progress.md`

### 검증

통과:

- `npx.cmd tsx --test tests/ragBenchmarkReport.test.ts tests/ragBenchmarkDiagnostics.test.ts tests/ragQualityReport.test.ts`
- `npx.cmd tsx --test tests/ragSearchMemo.test.ts tests/ragBenchmarkReport.test.ts tests/ragBenchmarkDiagnostics.test.ts tests/ragQualityReport.test.ts`
- `npx.cmd tsx --test tests/queryIntent.test.ts tests/retrievalPipelineGate.test.ts tests/ragRerankPriority.test.ts tests/ragEvaluationSupportSearch.test.ts tests/ragEvaluationValidation.test.ts tests/ragSearchMemo.test.ts tests/ragBenchmarkDiagnostics.test.ts tests/ragGoldenCases.test.ts tests/ragAliasCandidates.test.ts tests/ragDbLexical.test.ts tests/ragBenchmarkReport.test.ts tests/ragQualityReport.test.ts tests/ragEmbeddingVerify.test.ts tests/ragCacheBenchmarkReport.test.ts`
  - 49 tests pass
- `npm.cmd run lint`
- `npx.cmd tsc --noEmit`
- `npx.cmd tsc -p tsconfig.server.json --noEmit`
- `npm.cmd run rag:bench`
- `npm.cmd run rag:quality-report`
- `npm.cmd run rag:benchmark-diagnostics`
- `npm.cmd run rag:cache-benchmark`

### benchmark 결과

현재 `.rag-cache/rag-benchmark.json` 기준:

- Total cases: 27
- Top-3 doc recall: 96.3% (26/27)
- Top-5 doc recall: 96.3% (26/27)
- Expected evidence pass: 100.0% (27/27)
- Forbidden evidence pass: 100.0% (27/27)
- Required citation pass: 100.0% (27/27)
- Failed recall cases: 없음
- Accepted abstain cases: `integrated-no-grounded-answer`

Latency:

- Total benchmark duration: 34,641ms
- Case latency average: 826.3ms
- Case latency p95: 1,921ms
- Retrieval latency average: 761.7ms
- Retrieval latency p95: 1,474ms

P2-10 기준 대비:

- Total benchmark duration: 30,187ms -> 34,641ms
- Case latency average: 715.6ms -> 826.3ms
- Case latency p95: 1,877ms -> 1,921ms
- Retrieval latency average: 654.5ms -> 761.7ms
- Retrieval latency p95: 1,289ms -> 1,474ms

이번 단계는 계측/리포트 확장이므로 latency 증가는 run variance와 trace/report 변경이 섞인 값으로 본다. 품질 지표는 유지됐다.

Archive:

- `benchmarks/results/rag-benchmark-2026-05-04T12-42-11-764Z.json`

### P2-11 diagnostics 결과

Search memo:

- Cases with memo trace: 27/27
- Cases with memo hits: 0/27
- Total hits/misses: 0/49
- Hit rate: 0.0%

Repeated sub-search latency targets:

- `evaluation-base`: cases 9, avg 385.9ms, p95 679ms, max 679ms
- `evaluation-routing`: cases 9, avg 320.6ms, p95 586ms, max 586ms
- `integrated-initial`: cases 18, avg 286.6ms, p95 623ms, max 623ms
- `evaluation-direct-support`: cases 7, avg 92.1ms, p95 223ms, max 223ms
- `evaluation-promoted-primary`: cases 2, avg 63.0ms, p95 83ms, max 83ms
- `evaluation-primary-manual`: cases 4, avg 38.8ms, p95 76ms, max 76ms

해석:

- 현재 benchmark에서는 plan-level `searchStore()` memo hit가 없다. 즉 같은 full search call을 재사용하는 방향은 당장 p95를 줄이지 못한다.
- 병목은 `evaluation-base`, `evaluation-routing`, `integrated-initial` 각각의 내부 후보 생성 비용이다.
- 다음 최적화는 full search memo보다 `searchCorpus`/store 내부 lexical candidate 산출물 재사용, 또는 routing/base 간 lexical/vector candidate precompute 공유가 더 적절하다.

### cache benchmark 결과

현재 `.rag-cache/rag-cache-benchmark.json` 기준:

- Cases: 5
- Runs: 10
- Warm retrieval cache hits: 5/5
- Average cold total: 1,498.4ms
- Average warm total: 17.0ms
- Average speedup: 86.6x

Archive:

- `benchmarks/results/rag-cache-benchmark-2026-05-04T12-42-45-157Z.json`

### 다음 작업

P2-12 후보: `searchCorpus lexical/vector candidate precompute 공유`

권장 작업:

1. evaluation mode에서 routing/base/direct-support가 같은 `searchQuery + embedding + aliases`를 쓰는 경우, allowed scope만 다른 lexical/vector candidate pool을 안전하게 재사용할 수 있는지 TDD로 검증한다.
2. 특히 `evaluation-base`와 `evaluation-routing`은 같은 query/embedding에서 document scope와 excluded role만 달라지는 구조이므로, scoped filter 전에 만드는 후보 산출물을 공유하는 계층을 검토한다.
3. integrated는 `integrated-initial` 단일 stage가 반복적으로 가장 큰 비중을 차지하므로, posting-map candidate extraction 및 vector candidate scoring의 cache/precompute target을 별도 계측한다.

## 2026-05-04 / P2-12 완료: searchCorpus lexical candidate chunk pool precompute 공유

### 목표

P2-11 diagnostics에서 `evaluation-base`, `evaluation-routing`, `integrated-initial`이 반복 hot stage로 확인됐다. P2-12는 full `searchStore()` 간 재사용보다 더 안전한 내부 최적화로, 단일 `searchCorpus()` 실행 안에서 exact scoring과 lexical scoring이 같은 lexical candidate chunk pool을 공유하도록 했다.

### TDD

추가/수정 테스트:

- `tests/ragDbLexical.test.ts`
  - `searchCorpus can reuse a precomputed lexical candidate chunk pool` 추가
  - `precomputedLexicalCandidateChunks`가 주어지면 searchCorpus가 전체 index를 다시 훑지 않고 해당 pool을 lexical/exact 후보 pool로 쓰는지 검증했다.
- `tests/ragSearchMemo.test.ts`
  - 서로 다른 `precomputedLexicalCandidateChunks`가 같은 search memo key로 충돌하지 않는지 검증했다.

RED 확인:

- `npx.cmd tsx --test tests/ragDbLexical.test.ts`
  - precomputed chunk pool이 무시되어 target candidate가 lexical/fused에 들어오면서 실패했다.
- `npx.cmd tsx --test tests/ragSearchMemo.test.ts`
  - precomputed chunk pool이 memo key에 포함되지 않아 같은 key가 생성되며 실패했다.

### 구현

변경 파일:

- `src/lib/ragEngine.ts`
  - `SearchOptions.precomputedLexicalCandidateChunks` 추가
  - `resolveLexicalCandidateChunks()` 추가
  - `exactCandidateChunks()`가 precomputed lexical chunk pool을 받을 수 있도록 변경
  - `scoreLexical()`이 같은 lexical chunk pool을 재사용할 수 있도록 변경
  - `searchCorpus()`에서 finite lexical budget 또는 precomputed pool이 있는 경우 lexical chunk pool을 한 번만 만들고 exact/lexical scoring에 공유
- `src/lib/nodeRagService.ts`
  - search memo key canonicalization에 `precomputedLexicalCandidateChunks` id/document scope를 포함
- `tests/ragDbLexical.test.ts`
- `tests/ragSearchMemo.test.ts`
- `docs/plans/rag-search-performance-progress.md`

### 검증

통과:

- `npx.cmd tsx --test tests/ragDbLexical.test.ts tests/retrievalPipelineGate.test.ts`
- `npx.cmd tsx --test tests/ragSearchMemo.test.ts tests/ragDbLexical.test.ts tests/retrievalPipelineGate.test.ts`
- `npx.cmd tsx --test tests/queryIntent.test.ts tests/retrievalPipelineGate.test.ts tests/ragRerankPriority.test.ts tests/ragEvaluationSupportSearch.test.ts tests/ragEvaluationValidation.test.ts tests/ragSearchMemo.test.ts tests/ragBenchmarkDiagnostics.test.ts tests/ragGoldenCases.test.ts tests/ragAliasCandidates.test.ts tests/ragDbLexical.test.ts tests/ragBenchmarkReport.test.ts tests/ragQualityReport.test.ts tests/ragEmbeddingVerify.test.ts tests/ragCacheBenchmarkReport.test.ts`
  - 51 tests pass
- `npm.cmd run lint`
- `npx.cmd tsc --noEmit`
- `npx.cmd tsc -p tsconfig.server.json --noEmit`
- `npm.cmd run rag:bench`
- `npm.cmd run rag:quality-report`
- `npm.cmd run rag:benchmark-diagnostics`
- `npm.cmd run rag:cache-benchmark`

### benchmark 결과

현재 `.rag-cache/rag-benchmark.json` 기준:

- Total cases: 27
- Top-3 doc recall: 96.3% (26/27)
- Top-5 doc recall: 96.3% (26/27)
- Expected evidence pass: 100.0% (27/27)
- Forbidden evidence pass: 100.0% (27/27)
- Required citation pass: 100.0% (27/27)
- Failed recall cases: 없음
- Accepted abstain cases: `integrated-no-grounded-answer`

Latency:

- Total benchmark duration: 31,546ms
- Case latency average: 754.5ms
- Case latency p95: 1,857ms
- Retrieval latency average: 689.4ms
- Retrieval latency p95: 1,422ms

P2-11 기준 대비:

- Total benchmark duration: 34,641ms -> 31,546ms
- Case latency average: 826.3ms -> 754.5ms
- Case latency p95: 1,921ms -> 1,857ms
- Retrieval latency average: 761.7ms -> 689.4ms
- Retrieval latency p95: 1,474ms -> 1,422ms

Repeated sub-search latency targets:

- `evaluation-base`: avg 385.9ms -> 343.9ms, p95 679ms -> 570ms
- `evaluation-routing`: avg 320.6ms -> 271.6ms, p95 586ms -> 506ms
- `integrated-initial`: avg 286.6ms -> 256.9ms, p95 623ms -> 451ms
- `evaluation-direct-support`: avg 92.1ms -> 80.3ms, p95 223ms -> 152ms

Archive:

- `benchmarks/results/rag-benchmark-2026-05-04T13-04-57-356Z.json`

### cache benchmark 결과

현재 `.rag-cache/rag-cache-benchmark.json` 기준:

- Cases: 5
- Runs: 10
- Warm retrieval cache hits: 5/5
- Average cold total: 1,475.0ms
- Average warm total: 17.0ms
- Average speedup: 86.5x

Archive:

- `benchmarks/results/rag-cache-benchmark-2026-05-04T13-05-33-287Z.json`

### 해석

- 품질 지표를 유지하면서 P2-11에서 확인한 hot stage들이 모두 개선됐다.
- 특히 `integrated-initial` p95가 623ms -> 451ms로 내려가, 단일 search 내부 중복 lexical pool 생성 제거가 효과가 있음을 확인했다.
- search memo hit는 여전히 0이므로, full search call memo보다 내부 candidate pool/cache 계층 최적화가 더 적합하다.

### 다음 작업

P2-13 후보: `queryTokens/tokenSet 및 lexical precompute 미세 최적화`

권장 작업:

1. `scoreLexical()`과 `resolveLexicalCandidateChunks()` 사이에서 `queryTokens()` 및 `Set(tokens)`가 다시 만들어지는 비용을 제거한다.
2. `resolveLexicalCandidateChunks()`의 precomputed pool 필터가 chunk마다 새 `Set`을 만들지 않도록 한다.
3. stage trace 또는 micro benchmark 없이도 확인 가능한 단위 테스트를 먼저 추가하고, 전체 rag:bench에서 p95 변화를 확인한다.

## 2026-05-05 / P2-13 완료: shared lexical pool trace 및 query token/tokenSet 재사용

### 목표

P2-12에서 `searchCorpus()` 내부 exact/lexical scoring이 lexical candidate chunk pool을 공유하도록 바꿨다. P2-13은 이 공유 경로를 단위 테스트에서 관찰 가능하게 만들고, 같은 query에 대해 `queryTokens()`와 `Set(tokens)`를 중복 생성하던 비용을 줄이는 미세 최적화로 진행했다.

### TDD

추가 테스트:

- `tests/ragDbLexical.test.ts`
  - `searchCorpus stage trace marks shared lexical candidate pool reuse` 추가
  - finite `maxLexicalCandidateChunks`가 있는 검색에서 lexical stage note에 `lexical-pool=shared`가 남는지 검증했다.

RED 확인:

- `npx.cmd tsx --test tests/ragDbLexical.test.ts`
- shared lexical pool note가 없어 실패했다.

### 구현

변경 파일:

- `src/lib/ragEngine.ts`
  - `resolveLexicalCandidateChunks()`가 외부에서 만든 `tokenSet`을 받도록 변경
  - `exactCandidateChunks()`와 `scoreLexical()`이 `lexicalTokens`를 인자로 받아 `queryTokens()` 재호출을 피하도록 변경
  - precomputed lexical chunk pool filtering에서 chunk마다 새 `Set(tokens)`를 만들지 않도록 변경
  - `buildStageTrace()` lexical stage note에 `lexical-pool=shared`, `lexical-pool-size=N` 추가
- `tests/ragDbLexical.test.ts`
- `docs/plans/rag-search-performance-progress.md`

참고:

- 직접 `searchCorpus()` 단위 테스트에서는 `lexical-pool=shared` note가 확인된다.
- benchmark JSON의 최종 `stageTrace`는 retrieval plan의 최종 검색 결과 중심이라, integrated/evaluation sub-search 내부의 shared pool note가 그대로 노출되지는 않는다. stage별 latency 개선은 `sub-search-latency` aggregate로 확인했다.

### 검증

통과:

- `npx.cmd tsx --test tests/ragDbLexical.test.ts tests/retrievalPipelineGate.test.ts`
- `npx.cmd tsx --test tests/queryIntent.test.ts tests/retrievalPipelineGate.test.ts tests/ragRerankPriority.test.ts tests/ragEvaluationSupportSearch.test.ts tests/ragEvaluationValidation.test.ts tests/ragSearchMemo.test.ts tests/ragBenchmarkDiagnostics.test.ts tests/ragGoldenCases.test.ts tests/ragAliasCandidates.test.ts tests/ragDbLexical.test.ts tests/ragBenchmarkReport.test.ts tests/ragQualityReport.test.ts tests/ragEmbeddingVerify.test.ts tests/ragCacheBenchmarkReport.test.ts`
  - 52 tests pass
- `npm.cmd run lint`
- `npx.cmd tsc --noEmit`
- `npx.cmd tsc -p tsconfig.server.json --noEmit`
- `npm.cmd run rag:bench`
- `npm.cmd run rag:quality-report`
- `npm.cmd run rag:benchmark-diagnostics`
- `npm.cmd run rag:cache-benchmark`

### benchmark 결과

현재 `.rag-cache/rag-benchmark.json` 기준:

- Total cases: 27
- Top-3 doc recall: 96.3% (26/27)
- Top-5 doc recall: 96.3% (26/27)
- Expected evidence pass: 100.0% (27/27)
- Forbidden evidence pass: 100.0% (27/27)
- Required citation pass: 100.0% (27/27)
- Failed recall cases: 없음
- Accepted abstain cases: `integrated-no-grounded-answer`

Latency:

- Total benchmark duration: 30,379ms
- Case latency average: 704.3ms
- Case latency p95: 1,851ms
- Retrieval latency average: 642.6ms
- Retrieval latency p95: 1,257ms

P2-12 기준 대비:

- Total benchmark duration: 31,546ms -> 30,379ms
- Case latency average: 754.5ms -> 704.3ms
- Case latency p95: 1,857ms -> 1,851ms
- Retrieval latency average: 689.4ms -> 642.6ms
- Retrieval latency p95: 1,422ms -> 1,257ms

Repeated sub-search latency targets:

- `evaluation-base`: avg 343.9ms -> 310.8ms, p95 570ms -> 543ms
- `evaluation-routing`: avg 271.6ms -> 257.4ms, p95 506ms -> 514ms
- `integrated-initial`: avg 256.9ms -> 247.1ms, p95 451ms -> 453ms
- `evaluation-direct-support`: avg 80.3ms -> 73.3ms, p95 152ms -> 133ms
- `evaluation-primary-manual`: avg 32.8ms -> 28.3ms, p95 53ms -> 39ms

Archive:

- `benchmarks/results/rag-benchmark-2026-05-05T01-55-57-867Z.json`

### cache benchmark 결과

현재 `.rag-cache/rag-cache-benchmark.json` 기준:

- Cases: 5
- Runs: 10
- Warm retrieval cache hits: 5/5
- Average cold total: 1,524.8ms
- Average warm total: 17.2ms
- Average speedup: 89.5x

Archive:

- `benchmarks/results/rag-cache-benchmark-2026-05-05T01-56-29-339Z.json`

### 해석

- 품질 지표는 유지됐고 retrieval p95가 추가로 개선됐다.
- 개선폭이 큰 이유는 코드 변경 자체의 미세 최적화와 run variance가 함께 섞인 결과로 보되, P2-12 이후 방향이 틀리지 않았다는 신호로 볼 수 있다.
- 다음 큰 병목은 여전히 `evaluation-base`, `evaluation-routing`, `integrated-initial`이다. 이제 단일 search 내부 중복은 줄였으므로, 다음 단계에서는 sub-search 간 공유나 Postgres precomputed candidate path를 더 직접적으로 다루는 것이 적절하다.

### 다음 작업

P2-14 후보: `sub-search 간 broad lexical candidate pool 공유 가능성 검증`

권장 작업:

1. evaluation routing/direct-support/base가 같은 `searchQuery + aliases`를 쓰는 케이스에서, 이전 sub-search들의 candidate chunk pool union이 base `allowedDocumentIds`를 충분히 커버하는지 diagnostics로 먼저 확인한다.
2. 품질 리스크를 줄이기 위해 곧바로 replace하지 말고, base search에 candidate pool union을 merge-only로 주입했을 때 recall/evidence가 유지되는지 TDD로 검증한다.
3. Postgres store는 DB lexical query가 precomputed 옵션을 어떻게 처리하는지도 별도 테스트로 잠가야 한다.

## 2026-05-05 / P2-14 완료: evaluation sub-search lexical pool reuse coverage 진단

### 목표

P2-13까지 단일 `searchCorpus()` 내부의 lexical candidate chunk pool 공유를 적용했다. P2-14는 다음 단계에서 sub-search 간 pool을 실제로 재사용하기 전에, evaluation routing/direct-support에서 이미 만든 lexical 후보가 base lexical 후보를 얼마나 덮는지 planner trace로 검증하는 단계로 진행했다.

이번 단계에서는 base search 결과를 대체하거나 candidate pool을 실제 주입하지 않았다. 품질 리스크를 줄이기 위해 관찰 가능한 coverage 진단만 추가했다.

### TDD

추가 테스트:

- `tests/ragLexicalPoolReuse.test.ts`
  - `buildLexicalPoolReuseDiagnostic()`가 이전 sub-search lexical 후보 union과 target base lexical 후보의 overlap/coverage를 계산하는지 검증했다.
  - target lexical 후보가 없을 때는 trace를 만들지 않는지 검증했다.

RED 확인:

- `npx.cmd tsx --test tests/ragLexicalPoolReuse.test.ts`
- `nodeRagService`가 `buildLexicalPoolReuseDiagnostic` export를 제공하지 않아 실패했다.

### 구현

변경 파일:

- `src/lib/nodeRagService.ts`
  - `buildLexicalPoolReuseDiagnostic()` 추가
  - `SearchExecutionResult.plannerTrace` 추가
  - evaluation path에서 routing/direct-support lexical 후보 union이 `evaluation-base` lexical 후보를 얼마나 덮는지 `lexical-pool-reuse` trace로 기록
  - `runRetrievalPlan()`에서 executeSearch 내부 planner trace를 외부 planner trace에 병합
- `tests/ragLexicalPoolReuse.test.ts`
- `docs/plans/rag-search-performance-progress.md`

### 검증

통과:

- `npx.cmd tsx --test tests/ragLexicalPoolReuse.test.ts`
- `npx.cmd tsx --test tests/queryIntent.test.ts tests/retrievalPipelineGate.test.ts tests/ragRerankPriority.test.ts tests/ragEvaluationSupportSearch.test.ts tests/ragEvaluationValidation.test.ts tests/ragSearchMemo.test.ts tests/ragLexicalPoolReuse.test.ts tests/ragBenchmarkDiagnostics.test.ts tests/ragGoldenCases.test.ts tests/ragAliasCandidates.test.ts tests/ragDbLexical.test.ts tests/ragBenchmarkReport.test.ts tests/ragQualityReport.test.ts tests/ragEmbeddingVerify.test.ts tests/ragCacheBenchmarkReport.test.ts`
  - 54 tests pass
- `npm.cmd run lint`
- `npx.cmd tsc --noEmit`
- `npx.cmd tsc -p tsconfig.server.json --noEmit`
- `npm.cmd run rag:bench`
- `npm.cmd run rag:quality-report`
- `npm.cmd run rag:benchmark-diagnostics`
- `npm.cmd run rag:cache-benchmark`

### benchmark 결과

현재 `.rag-cache/rag-benchmark.json` 기준:

- Total cases: 27
- Top-3 doc recall: 96.3% (26/27)
- Top-5 doc recall: 96.3% (26/27)
- Expected evidence pass: 100.0% (27/27)
- Forbidden evidence pass: 100.0% (27/27)
- Required citation pass: 100.0% (27/27)
- Failed recall cases: 없음
- Accepted abstain cases: `integrated-no-grounded-answer`

Latency:

- Total benchmark duration: 30,342ms
- Case latency average: 716.1ms
- Case latency p95: 1,848ms
- Retrieval latency average: 656.1ms
- Retrieval latency p95: 1,263ms

P2-13 기준 대비:

- Total benchmark duration: 30,379ms -> 30,342ms
- Case latency average: 704.3ms -> 716.1ms
- Case latency p95: 1,851ms -> 1,848ms
- Retrieval latency average: 642.6ms -> 656.1ms
- Retrieval latency p95: 1,257ms -> 1,263ms

이번 단계는 진단 trace 추가 중심이므로 latency 변화는 거의 동등한 수준으로 본다. 품질 지표는 유지됐다.

Archive:

- `benchmarks/results/rag-benchmark-2026-05-05T02-03-09-002Z.json`

### lexical pool reuse diagnostics

현재 benchmark에서 `lexical-pool-reuse` trace는 9개 evaluation case에서 생성됐다.

- 8개 case: `evaluation-base` lexical 후보 coverage 100.0%
- 1개 case: `evaluation-change-comparison` coverage 95.8%
- 대표 trace:
  - `evaluation-notice-period`: previous=24, targetLexical=24, overlap=24, coverage=100.0%, stages=evaluation-routing:24
  - `evaluation-day-night-care-disliked-foods`: previous=48, targetLexical=24, overlap=24, coverage=100.0%, stages=evaluation-routing:24|evaluation-direct-support:24
  - `evaluation-change-comparison`: previous=48, targetLexical=24, overlap=23, coverage=95.8%, stages=evaluation-routing:24|evaluation-direct-support:24

해석:

- evaluation base lexical 후보 대부분이 routing/direct-support lexical 후보 union 안에 이미 들어온다.
- 다음 단계에서 `evaluation-base` lexical candidate pool을 이전 sub-search union으로 대체하거나, 최소한 merge-only로 주입하는 실험을 해볼 근거가 생겼다.
- 다만 `evaluation-change-comparison`처럼 100%가 아닌 케이스가 있으므로, 바로 replace하기보다는 coverage threshold와 fallback local scan을 같이 둬야 한다.

### cache benchmark 결과

현재 `.rag-cache/rag-cache-benchmark.json` 기준:

- Cases: 5
- Runs: 10
- Warm retrieval cache hits: 5/5
- Average cold total: 1,500.2ms
- Average warm total: 16.4ms
- Average speedup: 88.4x

Archive:

- `benchmarks/results/rag-cache-benchmark-2026-05-05T02-03-41-518Z.json`

### 다음 작업

P2-15 후보: `evaluation-base lexical pool reuse guarded experiment`

권장 작업:

1. `lexical-pool-reuse` coverage가 100%인 케이스에서만 `evaluation-base`에 이전 sub-search lexical chunk pool을 precomputed pool로 전달하는 guarded path를 TDD로 검증한다.
2. coverage가 100% 미만이거나 target lexical 후보가 비어 있으면 기존 local scan으로 fallback한다.
3. benchmark diagnostics에 lexical pool reuse coverage summary를 정식 섹션으로 올려, guarded path가 어느 케이스에서 켜졌는지 추적 가능하게 한다.

---

## 2026-05-05 / P2-15 완료: evaluation-base lexical pool reuse guarded experiment

### 목표

P2-14 diagnostics에서 base lexical 후보 대부분이 routing/direct-support pool으로 커버됨을 확인했다. P2-15는 실제 evaluation-base precomputed pool reuse를 guarded path로 실험하되, 품질 회귀 시 기본 경로를 안전하게 유지하는 것을 목표로 했다.

### TDD

추가 테스트:

- `tests/ragLexicalPoolReuse.test.ts`
  - `buildLexicalPoolReuseCandidatePool()`이 이전 lexical 후보를 stage 순서대로 dedupe하는지 검증했다.
  - `shouldFallbackLexicalPoolReuse()`가 strong reused search result는 유지하고 weak result는 full scan fallback 대상으로 판단하는지 검증했다.

RED 확인:

- `npx.cmd tsx --test tests/ragLexicalPoolReuse.test.ts`
- `nodeRagService`가 `buildLexicalPoolReuseCandidatePool` export를 제공하지 않아 실패했다.

### 구현

변경 파일:

- `src/lib/nodeRagService.ts`
  - `buildLexicalPoolReuseCandidatePool()` 추가
  - `shouldFallbackLexicalPoolReuse()` 추가
  - `RAG_ENABLE_EVALUATION_BASE_LEXICAL_POOL_REUSE` env flag 추가, 기본값은 `false`
  - env flag가 `true`이면 routing/direct-support lexical pool을 `evaluation-base`의 `precomputedLexicalCandidateChunks`로 우선 전달
  - 재사용 결과가 low confidence, mismatch signal, evidence 부족, lexical 후보 부족이면 기존 full base scan으로 fallback
  - env flag가 `false`이면 기존 full scan을 유지하고 `lexical-pool-reuse-guard result=disabled` trace만 남김
- `tests/ragLexicalPoolReuse.test.ts`
- `docs/plans/rag-search-performance-progress.md`

중요한 보정:

- 최초 구현은 reuse path를 기본 enabled로 두고 benchmark를 실행했으나 Top-3 recall이 88.9%로 회귀했다.
- 따라서 실제 candidate pool replacement는 opt-in 실험 경로로 낮추고, 기본 경로는 P2-14/P2-13과 동일한 full lexical scan 품질을 유지하도록 조정했다.

### 검증

통과:

- `npx.cmd tsx --test tests/ragLexicalPoolReuse.test.ts`
- `npx.cmd tsx --test tests/queryIntent.test.ts tests/retrievalPipelineGate.test.ts tests/ragRerankPriority.test.ts tests/ragEvaluationSupportSearch.test.ts tests/ragEvaluationValidation.test.ts tests/ragSearchMemo.test.ts tests/ragLexicalPoolReuse.test.ts tests/ragBenchmarkDiagnostics.test.ts tests/ragGoldenCases.test.ts tests/ragAliasCandidates.test.ts tests/ragDbLexical.test.ts tests/ragBenchmarkReport.test.ts tests/ragQualityReport.test.ts tests/ragEmbeddingVerify.test.ts tests/ragCacheBenchmarkReport.test.ts`
  - 56 tests pass
- `npm.cmd run lint`
- `npx.cmd tsc --noEmit`
- `npx.cmd tsc -p tsconfig.server.json --noEmit`
- `npm.cmd run rag:bench`
- `npm.cmd run rag:quality-report`
- `npm.cmd run rag:benchmark-diagnostics`
- `npm.cmd run rag:cache-benchmark`

### benchmark 결과

실패한 reuse-enabled 실험:

- Archive: `benchmarks/results/rag-benchmark-2026-05-05T02-12-41-664Z.json`
- Top-3 doc recall: 88.9%
- Top-5 doc recall: 96.3%
- 회귀 case:
  - `evaluation-qa-casebook`
  - `evaluation-employee-rights-education`

최종 default-disabled 기준:

- Archive: `benchmarks/results/rag-benchmark-2026-05-05T02-14-29-058Z.json`
- Total cases: 27
- Top-3 doc recall: 96.3% (26/27)
- Top-5 doc recall: 96.3% (26/27)
- Expected evidence pass: 100.0% (27/27)
- Forbidden evidence pass: 100.0% (27/27)
- Required citation pass: 100.0% (27/27)
- Accepted abstain cases: `integrated-no-grounded-answer`

Latency:

- Total benchmark duration: 30,335ms
- Case latency average: 707.3ms
- Case latency p95: 1,846ms
- Retrieval latency average: 644.1ms
- Retrieval latency p95: 1,251ms

Trace:

- `lexical-pool-reuse` diagnostics: 9
- `lexical-pool-reuse-guard` traces: 9
- default-disabled 기준 guard trace는 모두 `result=disabled`

### cache benchmark 결과

현재 `.rag-cache/rag-cache-benchmark.json` 기준:

- Cases: 5
- Runs: 10
- Warm retrieval cache hits: 5/5
- Average cold total: 1,495.8ms
- Average warm total: 16.4ms
- Average speedup: 89.4x

Archive:

- `benchmarks/results/rag-cache-benchmark-2026-05-05T02-15-04-549Z.json`

### 해석

- coverage 100%만으로는 실제 replacement safety를 보장하기 어렵다. 같은 후보 pool처럼 보여도 ranking/citation composition이 달라질 수 있다.
- evaluation-base lexical pool reuse는 replace보다는 merge-only 또는 lower-level scoring cache 전략이 더 안전해 보인다.
- 현재 env opt-in은 로컬 실험용으로 유지하고, 기본 benchmark/quality path는 품질 회귀가 없도록 full scan을 유지한다.

### 다음 작업

P2-16 후보: `lexical pool reuse diagnostics aggregate 및 merge-only/scoring-cache 전략 검토`

권장 작업:

1. benchmark diagnostics/quality report에 lexical pool reuse guard 결과를 aggregate summary로 정식 노출한다.
2. replacement 대신 previous pool + local lexical pool merge-only 전략을 TDD로 검증한다.
3. 가능하면 candidate pool을 바꾸지 않고 lexical scoring 또는 candidate materialization 단계만 memo/cache하는 방향을 비교한다.

---

## 2026-05-05 / P2-16 완료: lexical pool reuse diagnostics aggregate 노출

### 목표

P2-15에서 evaluation-base lexical pool replacement가 Top-3 recall 회귀를 만들 수 있음을 확인했다. P2-16은 다음 최적화를 바로 적용하기 전에, benchmark JSON/diagnostics/quality report에서 reuse guard와 coverage 상태를 한눈에 볼 수 있도록 aggregate를 정식 지표로 노출하는 단계로 진행했다.

### TDD

추가 테스트:

- `tests/ragBenchmarkReport.test.ts`
  - `buildBenchmarkPerformanceSummary()`가 `lexical-pool-reuse`와 `lexical-pool-reuse-guard` planner trace를 파싱해 coverage/guard aggregate를 만드는지 검증했다.
- `tests/ragBenchmarkDiagnostics.test.ts`
  - benchmark diagnostics report summary와 markdown에 lexical pool reuse diagnostics가 표시되는지 검증했다.
- `tests/ragQualityReport.test.ts`
  - quality report benchmark performance markdown에 lexical pool reuse 요약이 표시되는지 검증했다.

RED 확인:

- `npx.cmd tsx --test tests/ragBenchmarkReport.test.ts tests/ragBenchmarkDiagnostics.test.ts tests/ragQualityReport.test.ts`
- 신규 `lexicalPoolReuse` summary가 없어 `undefined` 및 markdown match 실패로 RED를 확인했다.

### 구현

변경 파일:

- `src/lib/ragBenchmarkReport.ts`
  - `BenchmarkLexicalPoolReuseCaseSummary`, `BenchmarkLexicalPoolReuseSummary` 타입 추가
  - planner trace detail parser 추가
  - `buildBenchmarkPerformanceSummary()`가 `performance.lexicalPoolReuse`를 생성하도록 연결
  - case별 coverage가 낮은 순으로 정렬하고 guard result count를 집계
- `src/lib/ragBenchmarkDiagnostics.ts`
  - summary에 `lexicalPoolReuse` 추가
  - markdown에 `## Lexical pool reuse diagnostics` 섹션 추가
- `src/lib/ragQualityReport.ts`
  - benchmark performance 영역에 lexical pool reuse one-line summary 추가
- `tests/ragBenchmarkReport.test.ts`
- `tests/ragBenchmarkDiagnostics.test.ts`
- `tests/ragQualityReport.test.ts`
- `docs/plans/rag-search-performance-progress.md`

### 검증

통과:

- `npx.cmd tsx --test tests/ragBenchmarkReport.test.ts tests/ragBenchmarkDiagnostics.test.ts tests/ragQualityReport.test.ts`
  - 11 tests pass
- `npx.cmd tsx --test tests/queryIntent.test.ts tests/retrievalPipelineGate.test.ts tests/ragRerankPriority.test.ts tests/ragEvaluationSupportSearch.test.ts tests/ragEvaluationValidation.test.ts tests/ragSearchMemo.test.ts tests/ragLexicalPoolReuse.test.ts tests/ragBenchmarkDiagnostics.test.ts tests/ragGoldenCases.test.ts tests/ragAliasCandidates.test.ts tests/ragDbLexical.test.ts tests/ragBenchmarkReport.test.ts tests/ragQualityReport.test.ts tests/ragEmbeddingVerify.test.ts tests/ragCacheBenchmarkReport.test.ts`
  - 57 tests pass
- `npm.cmd run lint`
- `npx.cmd tsc --noEmit`
- `npx.cmd tsc -p tsconfig.server.json --noEmit`
- `npm.cmd run rag:bench`
- `npm.cmd run rag:quality-report`
- `npm.cmd run rag:benchmark-diagnostics`
- `npm.cmd run rag:cache-benchmark`

### benchmark 결과

현재 `.rag-cache/rag-benchmark.json` 기준:

- Archive: `benchmarks/results/rag-benchmark-2026-05-05T02-29-25-040Z.json`
- Total cases: 27
- Top-3 doc recall: 96.3% (26/27)
- Top-5 doc recall: 96.3% (26/27)
- Expected evidence pass: 100.0% (27/27)
- Forbidden evidence pass: 100.0% (27/27)
- Required citation pass: 100.0% (27/27)
- Accepted abstain cases: `integrated-no-grounded-answer`

Latency:

- Total benchmark duration: 30,329ms
- Case latency average: 703.6ms
- Case latency p95: 1,821ms
- Retrieval latency average: 640.9ms
- Retrieval latency p95: 1,289ms

### lexical pool reuse aggregate

`performance.lexicalPoolReuse` 기준:

- Cases with diagnostics: 9
- Average coverage: 99.5%
- Minimum coverage: 95.8%
- Full/partial coverage cases: 8/1
- Guard result counts: `disabled=9`
- Lowest coverage case: `evaluation-change-comparison` coverage 95.8%, overlap 23/24

Markdown 노출 확인:

- `docs/reports/rag-benchmark-diagnostics.md`
  - `## Lexical pool reuse diagnostics`
  - `Average coverage: 99.5%`
  - `Guard results: disabled=9`
- `docs/reports/rag-quality-report.md`
  - `Lexical pool reuse: cases 9, avg coverage 99.5%, min coverage 95.8%, full/partial 8/1, guard disabled=9`

### cache benchmark 결과

현재 `.rag-cache/rag-cache-benchmark.json` 기준:

- Cases: 5
- Runs: 10
- Warm retrieval cache hits: 5/5
- Average cold total: 1,497.0ms
- Average warm total: 16.4ms
- Average speedup: 90.3x

Archive:

- `benchmarks/results/rag-cache-benchmark-2026-05-05T02-30-15-459Z.json`

### 해석

- 이제 replacement/merge-only/scoring-cache 실험이 품질을 흔들 때, coverage와 guard result를 benchmark artifact에서 바로 비교할 수 있다.
- 현재 기본 경로는 guard가 모두 `disabled`로 남아 품질 안전성을 유지한다.
- coverage만 보면 8/9 case가 100%지만, P2-15의 회귀 때문에 다음 최적화는 replacement가 아니라 merge-only 또는 scoring-cache 쪽이 더 적합하다.

### 다음 작업

P2-17 후보: `evaluation-base lexical pool merge-only 실험`

권장 작업:

1. `precomputedLexicalCandidateChunks`를 replacement가 아니라 local lexical pool과 union하는 옵션을 TDD로 추가한다.
2. merge-only 적용 시 Top-3/Top-5/evidence/citation이 유지되는지 benchmark로 검증한다.
3. merge-only도 이득이 작거나 회귀하면 candidate materialization은 유지하고 lexical scoring cache만 분리한다.

---

## 2026-05-05 / P2-17 완료: evaluation-base lexical pool merge-only 실험

### 목표

P2-15에서 replacement 방식의 `evaluation-base` lexical pool reuse가 Top-3 recall 회귀를 만들었다. P2-17은 기존 local lexical candidate pool을 버리지 않고, 이전 sub-search lexical pool을 union으로 더하는 merge-only 경로를 추가해 품질 안전성을 확인하는 단계로 진행했다.

### TDD

추가 테스트:

- `tests/ragDbLexical.test.ts`
  - `searchCorpus()`가 `mergePrecomputedLexicalCandidateChunks` 옵션을 받으면 local lexical 후보와 precomputed lexical chunk pool을 함께 살리는지 검증했다.
  - stage trace에 `lexical-pool=merged`, `lexical-pool-size=2`가 표시되는지 검증했다.
- `tests/ragSearchMemo.test.ts`
  - search memo key가 replacement mode와 merge-only mode를 서로 다른 key로 분리하는지 검증했다.

RED 확인:

- `npx.cmd tsx --test tests/ragDbLexical.test.ts tests/ragSearchMemo.test.ts`
- merge-only 옵션이 없어서 local 후보가 사라졌고, memo key도 replacement/merge-only를 구분하지 못해 실패했다.

### 구현

변경 파일:

- `src/lib/ragEngine.ts`
  - `SearchOptions.mergePrecomputedLexicalCandidateChunks` 추가
  - `resolveLexicalCandidateChunks()`가 merge-only mode에서 local lexical pool과 precomputed pool을 dedupe union하도록 변경
  - stage trace에 `lexical-pool=merged` 표시 추가
  - 기존 replacement semantics는 유지
- `src/lib/nodeRagService.ts`
  - `RAG_ENABLE_EVALUATION_BASE_LEXICAL_POOL_MERGE` env flag 추가, 기본값은 `false`
  - merge flag가 켜지면 `evaluation-base` search에 `precomputedLexicalCandidateChunks`와 `mergePrecomputedLexicalCandidateChunks: true`를 전달
  - `lexical-pool-reuse-guard` trace에 `strategy=merge-only` 또는 `strategy=replacement`를 기록
  - search memo key에 `mergePrecomputedLexicalCandidateChunks` 포함
- `tests/ragDbLexical.test.ts`
- `tests/ragSearchMemo.test.ts`
- `docs/plans/rag-search-performance-progress.md`

### 검증

통과:

- `npx.cmd tsx --test tests/ragDbLexical.test.ts tests/ragSearchMemo.test.ts`
  - 10 tests pass
- `npx.cmd tsx --test tests/queryIntent.test.ts tests/retrievalPipelineGate.test.ts tests/ragRerankPriority.test.ts tests/ragEvaluationSupportSearch.test.ts tests/ragEvaluationValidation.test.ts tests/ragSearchMemo.test.ts tests/ragLexicalPoolReuse.test.ts tests/ragBenchmarkDiagnostics.test.ts tests/ragGoldenCases.test.ts tests/ragAliasCandidates.test.ts tests/ragDbLexical.test.ts tests/ragBenchmarkReport.test.ts tests/ragQualityReport.test.ts tests/ragEmbeddingVerify.test.ts tests/ragCacheBenchmarkReport.test.ts`
  - 59 tests pass
- `npm.cmd run lint`
- `npx.cmd tsc --noEmit`
- `npx.cmd tsc -p tsconfig.server.json --noEmit`
- `npm.cmd run rag:bench`
- `npm.cmd run rag:quality-report`
- `npm.cmd run rag:benchmark-diagnostics`
- `npm.cmd run rag:cache-benchmark`

### merge-only 실험 benchmark

명령:

- `RAG_ENABLE_EVALUATION_BASE_LEXICAL_POOL_MERGE=true`
- `RAG_BENCH_OUTPUT=.rag-cache/rag-benchmark-merge-only.json`
- `npm.cmd run rag:bench`

결과:

- Archive: `benchmarks/results/rag-benchmark-2026-05-05T02-37-20-511Z.json`
- Top-3 doc recall: 96.3% (26/27)
- Top-5 doc recall: 96.3% (26/27)
- Expected evidence pass: 100.0% (27/27)
- Forbidden evidence pass: 100.0% (27/27)
- Required citation pass: 100.0% (27/27)
- Total benchmark duration: 30,566ms
- Case latency average: 715.5ms
- Case latency p95: 1,885ms
- Retrieval latency average: 652.8ms
- Retrieval latency p95: 1,261ms
- `lexical-pool-reuse-guard`: `accepted=9`
- planner trace에 `strategy=merge-only` 9건 확인

해석:

- merge-only는 replacement와 달리 Top-3 recall 회귀를 만들지 않았다.
- 다만 local lexical pool을 유지하므로 latency 개선은 거의 없고, 일부 평균 latency는 기본값보다 소폭 높았다.
- 따라서 merge-only는 품질 안전한 실험 기반으로는 유효하지만, 성능 최적화로는 scoring/materialization cache가 더 중요해 보인다.

### 기본 benchmark 결과

현재 `.rag-cache/rag-benchmark.json` 기준:

- Archive: `benchmarks/results/rag-benchmark-2026-05-05T02-38-26-247Z.json`
- Total cases: 27
- Top-3 doc recall: 96.3% (26/27)
- Top-5 doc recall: 96.3% (26/27)
- Expected evidence pass: 100.0% (27/27)
- Forbidden evidence pass: 100.0% (27/27)
- Required citation pass: 100.0% (27/27)
- Accepted abstain cases: `integrated-no-grounded-answer`

Latency:

- Total benchmark duration: 30,072ms
- Case latency average: 706.1ms
- Case latency p95: 1,838ms
- Retrieval latency average: 643.7ms
- Retrieval latency p95: 1,261ms

Lexical pool reuse aggregate:

- Cases with diagnostics: 9
- Average coverage: 99.5%
- Minimum coverage: 95.8%
- Guard result counts: `disabled=9`

### cache benchmark 결과

현재 `.rag-cache/rag-cache-benchmark.json` 기준:

- Cases: 5
- Runs: 10
- Warm retrieval cache hits: 5/5
- Average cold total: 1,502.2ms
- Average warm total: 16.2ms
- Average speedup: 90.4x

Archive:

- `benchmarks/results/rag-cache-benchmark-2026-05-05T02-39-14-517Z.json`

### 다음 작업

P2-18 후보: `evaluation-base lexical scoring/materialization cache 검토`

권장 작업:

1. candidate pool을 줄이거나 대체하지 않고, token/tf/idf 기반 lexical scoring 결과를 sub-search 간 memoize할 수 있는지 TDD로 확인한다.
2. `evaluation-base`, `evaluation-routing`, `evaluation-direct-support`의 동일 query/token path에서 scoring 재계산 비용을 줄일 수 있는 내부 cache key를 설계한다.
3. merge-only flag는 품질 안전 실험용으로 유지하되, 기본 path는 계속 disabled로 둔다.

---

## 2026-05-05 / P2-18 완료: lexical scoring/materialization cache

### 목표

P2-17에서 merge-only candidate pool 재사용은 품질 회귀 없이 동작했지만 latency 개선은 거의 없었다. P2-18은 candidate pool을 대체하거나 줄이지 않고, 같은 retrieval plan 안의 sub-search들이 동일 query token/chunk lexical score를 반복 계산하지 않도록 score-level cache를 추가하는 단계로 진행했다.

### TDD

추가 테스트:

- `tests/ragDbLexical.test.ts`
  - `createLexicalScoringCache()`를 공유한 두 번의 scoped `searchCorpus()` 호출에서 두 번째 호출이 cache hit를 만드는지 검증했다.
  - lexical stage trace에 `lexical-score-cache=...` note가 남는지 검증했다.
- `tests/ragSearchMemo.test.ts`
  - `lexicalScoringCache` 객체 인스턴스가 search memo key에 포함되지 않는지 검증했다.

RED 확인:

- `npx.cmd tsx --test tests/ragDbLexical.test.ts tests/ragSearchMemo.test.ts`
- `createLexicalScoringCache` export가 없어 실패했다.

### 구현

변경 파일:

- `src/lib/ragEngine.ts`
  - `LexicalScoringCache`, `LexicalScoringCacheEntry` 타입 추가
  - `createLexicalScoringCache()` 추가
  - lexical scoring cache key를 `corpusSize + chunkId + chunkHash + token:df signature` 기반으로 구성
  - `scoreLexical()`이 chunk별 lexical score/matched terms를 cache에서 재사용하도록 변경
  - lexical stage trace에 `lexical-score-cache=hits:X,misses:Y,size:Z` note 추가
- `src/lib/nodeRagService.ts`
  - retrieval plan마다 `createLexicalScoringCache()`를 생성
  - plan-level `searchMemo` runner가 모든 `searchStore()` 호출에 동일 lexical scoring cache를 주입
  - planner trace에 `lexical-score-cache` hit/miss/size 기록
- `tests/ragDbLexical.test.ts`
- `tests/ragSearchMemo.test.ts`
- `docs/plans/rag-search-performance-progress.md`

### 검증

통과:

- `npx.cmd tsx --test tests/ragDbLexical.test.ts tests/ragSearchMemo.test.ts`
  - 12 tests pass
- `npx.cmd tsx --test tests/queryIntent.test.ts tests/retrievalPipelineGate.test.ts tests/ragRerankPriority.test.ts tests/ragEvaluationSupportSearch.test.ts tests/ragEvaluationValidation.test.ts tests/ragSearchMemo.test.ts tests/ragLexicalPoolReuse.test.ts tests/ragBenchmarkDiagnostics.test.ts tests/ragGoldenCases.test.ts tests/ragAliasCandidates.test.ts tests/ragDbLexical.test.ts tests/ragBenchmarkReport.test.ts tests/ragQualityReport.test.ts tests/ragEmbeddingVerify.test.ts tests/ragCacheBenchmarkReport.test.ts`
  - 61 tests pass
- `npm.cmd run lint`
- `npx.cmd tsc --noEmit`
- `npx.cmd tsc -p tsconfig.server.json --noEmit`
- `npm.cmd run rag:bench`
- `npm.cmd run rag:quality-report`
- `npm.cmd run rag:benchmark-diagnostics`
- `npm.cmd run rag:cache-benchmark`

### benchmark 결과

현재 `.rag-cache/rag-benchmark.json` 기준:

- Archive: `benchmarks/results/rag-benchmark-2026-05-05T02-49-19-245Z.json`
- Total cases: 27
- Top-3 doc recall: 96.3% (26/27)
- Top-5 doc recall: 96.3% (26/27)
- Expected evidence pass: 100.0% (27/27)
- Forbidden evidence pass: 100.0% (27/27)
- Required citation pass: 100.0% (27/27)
- Accepted abstain cases: `integrated-no-grounded-answer`

Latency:

- Total benchmark duration: 30,295ms
- Case latency average: 713.7ms
- Case latency p95: 1,853ms
- Retrieval latency average: 651.6ms
- Retrieval latency p95: 1,305ms

Lexical score cache trace:

- Cases with trace: 27
- Total hits: 26,016
- Total misses: 69,788
- Top hit case: `evaluation-day-night-care-disliked-foods`
- Evaluation sub-search cases show repeated score reuse, while integrated single-path cases mostly remain miss-only as expected.

Lexical pool reuse aggregate:

- Cases with diagnostics: 9
- Average coverage: 99.5%
- Minimum coverage: 95.8%
- Guard result counts: `disabled=9`

### cache benchmark 결과

현재 `.rag-cache/rag-cache-benchmark.json` 기준:

- Cases: 5
- Runs: 10
- Warm retrieval cache hits: 5/5
- Average cold total: 1,527.4ms
- Average warm total: 16.6ms
- Average speedup: 91.5x

Archive:

- `benchmarks/results/rag-cache-benchmark-2026-05-05T02-50-22-480Z.json`

### 해석

- score-level cache는 품질을 건드리지 않고 sub-search 간 반복 lexical scoring을 재사용한다.
- 현재 latency 수치는 run-to-run 변동 안에서 큰 개선으로 보이지는 않지만, planner trace상 evaluation case에서 cache hit가 명확히 발생한다.
- integrated single-path case는 동일 plan 안의 반복 sub-search가 적어 hit가 거의 없는 것이 정상이다.

### 다음 작업

P2-19 후보: `lexical score cache diagnostics aggregate 노출`

권장 작업:

1. `lexical-score-cache` planner trace를 benchmark performance summary에 aggregate로 올린다.
2. quality report/benchmark diagnostics markdown에 hit/miss/size와 case별 top hit를 표시한다.
3. aggregate를 기준으로 cache가 실제 latency에 기여하는 case와 그렇지 않은 case를 분리한다.

---

## 2026-05-05 / P2-19 완료: lexical score cache diagnostics aggregate 노출

### 목표

P2-18에서 retrieval plan 단위 lexical scoring cache와 `lexical-score-cache` planner trace를 추가했다. P2-19는 이 trace를 benchmark performance summary로 정식 집계하고, benchmark diagnostics/quality report markdown에서 hit/miss/size와 상위 case를 바로 확인할 수 있게 만드는 단계로 진행했다.

### TDD

추가 테스트:

- `tests/ragBenchmarkReport.test.ts`
  - `buildBenchmarkPerformanceSummary()`가 `lexical-score-cache` planner trace를 `performance.lexicalScoreCache`로 집계하는지 검증했다.
- `tests/ragBenchmarkDiagnostics.test.ts`
  - benchmark diagnostics summary와 markdown에 lexical score cache diagnostics가 노출되는지 검증했다.
- `tests/ragQualityReport.test.ts`
  - quality report benchmark performance에 lexical score cache one-line summary가 표시되는지 검증했다.

RED 확인:

- `npx.cmd tsx --test tests/ragBenchmarkReport.test.ts tests/ragBenchmarkDiagnostics.test.ts tests/ragQualityReport.test.ts`
- 신규 `lexicalScoreCache` summary가 없어 `undefined` 및 markdown match 실패로 RED를 확인했다.

### 구현

변경 파일:

- `src/lib/ragBenchmarkReport.ts`
  - `BenchmarkLexicalScoreCacheCaseSummary`, `BenchmarkLexicalScoreCacheSummary` 타입 추가
  - `lexical-score-cache` planner trace parser 추가
  - `buildBenchmarkPerformanceSummary()`가 `performance.lexicalScoreCache`를 생성하도록 연결
  - case별 cache hit가 높은 순으로 정렬하고 total hit/miss, hit rate, cases with hits를 집계
- `src/lib/ragBenchmarkDiagnostics.ts`
  - diagnostics summary에 `lexicalScoreCache` 추가
  - markdown에 `## Lexical score cache diagnostics` 섹션 추가
- `src/lib/ragQualityReport.ts`
  - benchmark performance 영역에 lexical score cache one-line summary 추가
- `tests/ragBenchmarkReport.test.ts`
- `tests/ragBenchmarkDiagnostics.test.ts`
- `tests/ragQualityReport.test.ts`
- `docs/plans/rag-search-performance-progress.md`

### 검증

통과:

- `npx.cmd tsx --test tests/ragBenchmarkReport.test.ts tests/ragBenchmarkDiagnostics.test.ts tests/ragQualityReport.test.ts`
  - 11 tests pass
- `npx.cmd tsx --test tests/queryIntent.test.ts tests/retrievalPipelineGate.test.ts tests/ragRerankPriority.test.ts tests/ragEvaluationSupportSearch.test.ts tests/ragEvaluationValidation.test.ts tests/ragSearchMemo.test.ts tests/ragLexicalPoolReuse.test.ts tests/ragBenchmarkDiagnostics.test.ts tests/ragGoldenCases.test.ts tests/ragAliasCandidates.test.ts tests/ragDbLexical.test.ts tests/ragBenchmarkReport.test.ts tests/ragQualityReport.test.ts tests/ragEmbeddingVerify.test.ts tests/ragCacheBenchmarkReport.test.ts`
  - 61 tests pass
- `npm.cmd run lint`
- `npx.cmd tsc --noEmit`
- `npx.cmd tsc -p tsconfig.server.json --noEmit`
- `npm.cmd run rag:bench`
- `npm.cmd run rag:quality-report`
- `npm.cmd run rag:benchmark-diagnostics`
- `npm.cmd run rag:cache-benchmark`

### benchmark 결과

현재 `.rag-cache/rag-benchmark.json` 기준:

- Archive: `benchmarks/results/rag-benchmark-2026-05-05T03-09-15-256Z.json`
- Total cases: 27
- Top-3 doc recall: 96.3% (26/27)
- Top-5 doc recall: 96.3% (26/27)
- Expected evidence pass: 100.0% (27/27)
- Forbidden evidence pass: 100.0% (27/27)
- Required citation pass: 100.0% (27/27)
- Accepted abstain cases: `integrated-no-grounded-answer`

Latency:

- Total benchmark duration: 30,744ms
- Case latency average: 728.0ms
- Case latency p95: 1,882ms
- Retrieval latency average: 665.3ms
- Retrieval latency p95: 1,325ms

Lexical score cache aggregate:

- Cases with trace: 27
- Cases with hits: 9
- Total hits: 26,016
- Total misses: 69,788
- Hit rate: 27.2%
- Top hit case: `evaluation-day-night-care-disliked-foods` hits 3,266, misses 3,410

Markdown 노출 확인:

- `docs/reports/rag-benchmark-diagnostics.md`
  - `## Lexical score cache diagnostics`
  - `Total hits/misses: 26016/69788`
  - `evaluation-day-night-care-disliked-foods: hits 3266, misses 3410, size 3410`
- `docs/reports/rag-quality-report.md`
  - `Lexical score cache: hits 26016, misses 69788, cases with hits 9/27, hit rate 27.2%`

Lexical pool reuse aggregate:

- Cases with diagnostics: 9
- Average coverage: 99.5%
- Minimum coverage: 95.8%
- Guard result counts: `disabled=9`

### cache benchmark 결과

현재 `.rag-cache/rag-cache-benchmark.json` 기준:

- Cases: 5
- Runs: 10
- Warm retrieval cache hits: 5/5
- Average cold total: 1,530.2ms
- Average warm total: 16.2ms
- Average speedup: 92.9x

Archive:

- `benchmarks/results/rag-cache-benchmark-2026-05-05T03-09-53-598Z.json`

### 해석

- lexical score cache는 evaluation sub-search가 많은 case에서만 hit가 발생한다. 현재 benchmark 기준 cases with hits는 9/27로, integrated single-path case는 miss-only가 정상이다.
- 집계가 정식 report에 들어갔으므로 다음부터는 cache hit rate와 sub-search latency를 같은 artifact에서 비교할 수 있다.
- latency는 run-to-run 변동 때문에 P2-18/P2-19 자체 개선으로 단정하기 어렵다. 다음 단계는 hit가 많은 evaluation case에서 실제 dominant latency를 줄일 수 있는 후보 materialization 또는 vector query 비용을 따로 봐야 한다.

### 다음 작업

P2-20 후보: `evaluation slow case dominant latency 재분해 및 vector/DB 후보 비용 진단`

권장 작업:

1. lexical score cache hit가 높은 case와 여전히 느린 case를 교차 분석한다.
2. `evaluation-base`, `evaluation-routing`, `evaluation-direct-support` 안에서 lexical scoring 외에 DB lexical/vector/query overhead를 더 세분화해 trace한다.
3. 성능 이득이 작으면 lexical scoring cache는 유지하되, 다음 병목인 vector candidate 조회 또는 candidate materialization 단계로 이동한다.

---

## 2026-05-05 / P2-20 완료: evaluation slow case search-store latency breakdown 진단

### 목표

P2-19까지는 `sub-search-latency`와 `lexical-score-cache`를 aggregate로 볼 수 있게 되었다. P2-20에서는 slow case의 dominant latency를 더 쪼개기 위해 `evaluation-base`, `evaluation-routing`, `evaluation-direct-support`, `integrated-initial` 등 searchStore 호출 단위에서 DB lexical, vector, corpus materialization 시간을 분리해 planner trace와 benchmark/quality report aggregate로 노출하는 작업을 진행했다.

### TDD

추가 테스트:

- `tests/ragBenchmarkReport.test.ts`
  - `search-store-latency` planner trace가 `performance.searchStoreLatencySummary`로 집계되는지 검증.
- `tests/ragBenchmarkDiagnostics.test.ts`
  - benchmark diagnostics markdown에 `Search store latency breakdown` 섹션이 표시되는지 검증.
- `tests/ragQualityReport.test.ts`
  - quality report benchmark performance 영역에 search store latency breakdown이 표시되는지 검증.
- `tests/ragSearchMemo.test.ts`
  - `searchDiagnosticStage`와 `searchDiagnostics` instrumentation이 search memo key에 영향을 주지 않는지 검증.

RED 확인:

- `npx.cmd tsx --test tests/ragBenchmarkReport.test.ts tests/ragBenchmarkDiagnostics.test.ts tests/ragQualityReport.test.ts tests/ragSearchMemo.test.ts`
- 신규 `searchStoreLatencySummary` 및 markdown 섹션이 없어 실패하는 것을 확인했다.

### 구현

변경 파일:

- `src/lib/ragEngine.ts`
  - `SearchDiagnosticsEntry`, `SearchDiagnosticsCollector` 타입 추가.
  - `SearchOptions.searchDiagnosticStage`, `SearchOptions.searchDiagnostics` 추가.
- `src/lib/ragStore.ts`
  - memory store search에서 corpus search 시간을 측정해 diagnostics collector로 기록.
  - Postgres store search에서 DB lexical query, pgvector query, corpus search, total 시간과 candidate 수를 각각 기록.
- `src/lib/nodeRagService.ts`
  - retrieval plan 단위 `searchStoreDiagnostics` collector 추가.
  - search memo runner를 통해 모든 searchStore 호출에 diagnostics collector를 주입.
  - `integrated-initial`, `evaluation-routing`, `evaluation-direct-support`, `evaluation-base`, promoted/manual/workflow facet 경로에 diagnostic stage를 부여.
  - planner trace에 `search-store-latency`를 추가.
- `src/lib/ragBenchmarkReport.ts`
  - `BenchmarkSearchStoreLatencySummary` 추가.
  - `search-store-latency` trace parser 및 aggregate 추가.
  - trace parser가 `ms`/`%` suffix 값을 숫자로 읽도록 보정.
- `src/lib/ragBenchmarkDiagnostics.ts`
  - `Search store latency breakdown` markdown 섹션 추가.
- `src/lib/ragQualityReport.ts`
  - quality report benchmark performance 영역에 search store latency breakdown 추가.
- `tests/ragBenchmarkReport.test.ts`
- `tests/ragBenchmarkDiagnostics.test.ts`
- `tests/ragQualityReport.test.ts`
- `tests/ragSearchMemo.test.ts`
- `docs/plans/rag-search-performance-progress.md`

### 검증

통과:

- `npm.cmd run lint`
- `npx.cmd tsc --noEmit`
- `npx.cmd tsc -p tsconfig.server.json --noEmit`
- `npm.cmd run rag:bench`

추가 검증:

- `npx.cmd tsx --test tests/ragBenchmarkReport.test.ts tests/ragBenchmarkDiagnostics.test.ts tests/ragQualityReport.test.ts tests/ragSearchMemo.test.ts`
  - 18 tests pass
- `npm.cmd run rag:quality-report`
  - `.rag-cache/rag-quality-report.json`
  - `docs/reports/rag-quality-report.md`
- `npm.cmd run rag:benchmark-diagnostics`
  - `.rag-cache/rag-benchmark-diagnostics.json`
  - `docs/reports/rag-benchmark-diagnostics.md`
- `npm.cmd run rag:cache-benchmark`
  - `.rag-cache/rag-cache-benchmark.json`
  - `docs/reports/rag-cache-benchmark.md`
  - `benchmarks/results/rag-cache-benchmark-2026-05-05T06-55-22-285Z.json`

### benchmark 결과

`npm.cmd run rag:bench` 결과:

- Archive: `benchmarks/results/rag-benchmark-2026-05-05T03-49-28-679Z.json`
- Total cases: 27
- Top-3 doc recall: 96.3% (26/27)
- Top-5 doc recall: 96.3% (26/27)
- Expected evidence pass: 100.0% (27/27)
- Forbidden evidence pass: 100.0% (27/27)
- Required citation pass: 100.0% (27/27)
- Accepted abstain cases: `integrated-no-grounded-answer`

Latency:

- Total benchmark duration: 31,033ms
- Case latency average: 731.1ms
- Case latency p95: 1,858ms
- Retrieval latency average: 669.7ms
- Retrieval latency p95: 1,371ms

Search store latency aggregate:

- `evaluation-base`: cases 9, total avg 319.7ms, p95 544ms, db lexical avg 0ms, vector avg 0ms, corpus avg 319.7ms
- `evaluation-routing`: cases 9, total avg 279.0ms, p95 535ms, db lexical avg 0ms, vector avg 0ms, corpus avg 279.0ms
- `integrated-initial`: cases 18, total avg 268.7ms, p95 502ms, db lexical avg 0ms, vector avg 0ms, corpus avg 268.7ms
- `evaluation-direct-support`: cases 7, total avg 76.3ms, p95 141ms, db lexical avg 0ms, vector avg 0ms, corpus avg 76.3ms

### 해석

- P2-20 진단 trace는 benchmark artifact에 실제로 기록되며, `search-store-latency` planner trace와 `performance.searchStoreLatencySummary` aggregate가 생성되는 것을 확인했다.
- `docs/reports/rag-quality-report.md`와 `docs/reports/rag-benchmark-diagnostics.md`에도 `Search store latency breakdown` 섹션이 생성되는 것을 확인했다.
- 현재 로컬 benchmark는 vector 후보가 비어 있고 DB lexical/vector 시간이 0ms로 기록된다. 즉 이번 수치는 Postgres DB/vector 병목이 아니라 memory/local corpus materialization 및 lexical scoring 경로를 보여준다.
- slow case에서는 여전히 `evaluation-base`, `evaluation-routing`, `integrated-initial`의 corpus search 시간이 dominant다.
- Postgres DB lexical/vector 비용을 실제로 분해하려면 `DATABASE_URL`과 embedding/vector 후보가 있는 환경에서 동일 benchmark 또는 전용 diagnostic run을 다시 실행해야 한다.

### cache benchmark 결과

현재 `.rag-cache/rag-cache-benchmark.json` 기준:

- Cases: 5
- Runs: 10
- Warm retrieval cache hits: 5/5
- Average cold total: 1,523.0ms
- Average warm total: 16.2ms
- Average speedup: 92.4x

Archive:

- `benchmarks/results/rag-cache-benchmark-2026-05-05T06-55-22-285Z.json`

### 다음 작업

P2-21 후보: `local corpus materialization dominant case 최적화 또는 Postgres-backed search-store latency 측정`

권장 작업:

1. Postgres-backed benchmark 환경이 가능하면 DB lexical/vector candidate timing이 실제로 채워지는지 확인한다.
2. Postgres 경로를 당장 측정할 수 없다면 local corpus materialization dominant case를 대상으로 candidate pool 크기, corpus scan, score materialization 최적화를 다음 단계로 진행한다.
3. 특히 `evaluation-base`, `evaluation-routing`, `integrated-initial`의 corpus avg/p95를 줄이는 방향으로 다음 실험을 설계한다.

---

## 2026-05-05 / P2-21 완료: scoped lexical 후보 수집 posting-backed pool 전환

### 목표

P2-20의 search store latency breakdown에서 현재 로컬 benchmark는 DB/vector 비용이 아니라 corpus search 시간이 dominant로 나타났다. P2-21은 `allowedDocumentIds`가 있는 scoped search에서 scope 전체 chunk를 훑는 lexical 후보 수집을 줄이기 위해, 이미 구성된 `postingMap` 기반 후보 ID 수집을 사용하고 기존 corpus 순서를 보존하는 micro optimization으로 진행했다.

### TDD

추가 테스트:

- `tests/ragDbLexical.test.ts`
  - `searchCorpus uses posting-backed lexical pool for scoped searches without changing corpus order`
  - scoped search가 posting-backed lexical pool trace를 남기고, 후보 순서는 기존 corpus 순서를 유지하는지 검증.

RED 확인:

- `npx.cmd tsx --test tests/ragDbLexical.test.ts`
- 신규 trace note인 `lexical-pool-source=posting-scope`가 없어 실패하는 것을 확인했다.

### 구현

변경 파일:

- `src/lib/ragEngine.ts`
  - `RagCorpusIndex.chunkOrdinalMap` 추가.
  - `buildRagCorpusIndex()`에서 chunk 원본 순서를 기록.
  - `lexicalCandidateChunks()`의 `allowedDocumentIds` 경로를 scope scan 방식에서 posting-backed candidate ID 수집 방식으로 변경.
  - 수집된 candidate ID를 `chunkOrdinalMap`으로 정렬해 기존 corpus 순서를 보존.
  - `allowedDocumentIds`가 있는 search도 lexical chunk pool을 만들고, exact/lexical scoring에서 같은 pool을 공유하도록 변경.
  - stage trace에 `lexical-pool-source=posting-scope|posting-global|precomputed|merged` note를 추가.
- `tests/ragDbLexical.test.ts`
- `docs/plans/rag-search-performance-progress.md`

### 검증

통과:

- `npx.cmd tsx --test tests/ragDbLexical.test.ts`
  - 7 tests pass
- `npm.cmd run lint`
- `npx.cmd tsc --noEmit`
- `npx.cmd tsc -p tsconfig.server.json --noEmit`
- `npm.cmd run rag:bench`
- `npm.cmd run rag:quality-report`
- `npm.cmd run rag:benchmark-diagnostics`
- `npm.cmd run rag:cache-benchmark`

### benchmark 결과

`npm.cmd run rag:bench` 결과:

- Archive: `benchmarks/results/rag-benchmark-2026-05-05T07-02-17-449Z.json`
- Total cases: 27
- Top-3 doc recall: 96.3% (26/27)
- Top-5 doc recall: 96.3% (26/27)
- Expected evidence pass: 100.0% (27/27)
- Forbidden evidence pass: 100.0% (27/27)
- Required citation pass: 100.0% (27/27)

Latency:

- Total benchmark duration: 31,698ms
- Case latency average: 752.0ms
- Case latency p95: 1,957ms
- Retrieval latency average: 691.9ms
- Retrieval latency p95: 1,444ms

Search store latency aggregate:

- `evaluation-base`: cases 9, total avg 331.8ms, p95 558ms, corpus avg 331.8ms
- `evaluation-routing`: cases 9, total avg 286.0ms, p95 558ms, corpus avg 286.0ms
- `integrated-initial`: cases 18, total avg 263.5ms, p95 487ms, corpus avg 263.5ms
- `evaluation-direct-support`: cases 7, total avg 82.4ms, p95 152ms, corpus avg 82.4ms

### cache benchmark 결과

현재 `.rag-cache/rag-cache-benchmark.json` 기준:

- Cases: 5
- Runs: 10
- Warm retrieval cache hits: 5/5
- Average cold total: 1,580.6ms
- Average warm total: 16.8ms
- Average speedup: 93.1x

Archive:

- `benchmarks/results/rag-cache-benchmark-2026-05-05T07-03-12-563Z.json`

### 해석

- scoped lexical 후보 수집은 이제 posting-backed 방식으로 동작하며, 단위 테스트에서 기존 후보 순서 보존을 확인했다.
- 품질 지표는 P2-20과 동일하게 유지되었다.
- 다만 benchmark latency는 run-to-run 변동 안에서 뚜렷한 개선으로 보기 어렵다. `integrated-initial` p95는 낮아졌지만, `evaluation-base`/`evaluation-routing`은 비슷하거나 높게 측정되었다.
- 따라서 현재 dominant latency는 단순 후보 ID 수집보다 `searchCorpus` 내부의 exact scoring, lexical scoring, rerank/fusion, evidence selection 중 어느 단계인지 더 세분화해야 한다.

### 다음 작업

P2-22 후보: `searchCorpus 내부 phase timing 진단`

권장 작업:

1. `searchCorpus` 내부에서 lexical pool build, exact scoring, lexical scoring, vector scoring, fusion/rerank, evidence selection 시간을 분리해 trace한다.
2. benchmark diagnostics/quality report에 corpus phase timing aggregate를 노출한다.
3. 실제 dominant phase가 확인되면 해당 phase만 대상으로 cap, cache, short-circuit 최적화를 진행한다.

---

## 2026-05-05 / P2-22 완료: searchCorpus 내부 phase timing 진단

### 목표

P2-21 이후에도 `search-store-latency` 기준으로는 corpus search 전체만 dominant로 보였다. P2-22는 `searchCorpus` 내부를 lexical pool build, exact scoring, lexical scoring, vector scoring, fusion/rerank, evidence selection phase로 분해해 다음 최적화 대상을 명확히 고르는 단계로 진행했다.

### TDD

추가 테스트:

- `tests/ragBenchmarkReport.test.ts`
  - `search-store-latency` planner trace의 `phaseLexicalPool`, `phaseExact`, `phaseLexical`, `phaseVector`, `phaseFusion`, `phaseEvidence`, `phaseTotal`을 `performance.corpusPhaseLatencySummary`로 집계하는지 검증.
- `tests/ragBenchmarkDiagnostics.test.ts`
  - benchmark diagnostics markdown에 `Search corpus phase timing` 섹션이 표시되는지 검증.
- `tests/ragQualityReport.test.ts`
  - quality report benchmark performance 영역에 `Search corpus phase timing` 섹션이 표시되는지 검증.

RED 확인:

- `npx.cmd tsx --test tests/ragBenchmarkReport.test.ts tests/ragBenchmarkDiagnostics.test.ts tests/ragQualityReport.test.ts`
- 신규 `corpusPhaseLatencySummary` 및 markdown 섹션이 없어 실패하는 것을 확인했다.

### 구현

변경 파일:

- `src/lib/ragTypes.ts`
  - `SearchCorpusPhaseTimings` 타입 추가.
  - `SearchRun.corpusPhaseTimings` 추가.
- `src/lib/ragEngine.ts`
  - `searchCorpus()` 내부 phase timing 측정 추가.
  - 측정 phase:
    - lexical pool
    - exact
    - lexical
    - vector
    - fusion
    - evidence
    - total
  - `SearchDiagnosticsEntry.corpusPhaseTimings` 추가.
- `src/lib/ragStore.ts`
  - memory/Postgres search diagnostics에 `result.corpusPhaseTimings` 전달.
- `src/lib/nodeRagService.ts`
  - `search-store-latency` planner trace에 `phaseLexicalPool`, `phaseExact`, `phaseLexical`, `phaseVector`, `phaseFusion`, `phaseEvidence`, `phaseTotal` 추가.
- `src/lib/ragBenchmarkReport.ts`
  - `BenchmarkCorpusPhaseLatencySummary` 추가.
  - phase timing trace parser 및 aggregate 추가.
- `src/lib/ragBenchmarkDiagnostics.ts`
  - `Search corpus phase timing` markdown 섹션 추가.
- `src/lib/ragQualityReport.ts`
  - quality report benchmark performance 영역에 `Search corpus phase timing` 섹션 추가.
- `tests/ragBenchmarkReport.test.ts`
- `tests/ragBenchmarkDiagnostics.test.ts`
- `tests/ragQualityReport.test.ts`
- `docs/plans/rag-search-performance-progress.md`

### 검증

통과:

- `npx.cmd tsx --test tests/ragBenchmarkReport.test.ts tests/ragBenchmarkDiagnostics.test.ts tests/ragQualityReport.test.ts`
  - 11 tests pass
- `npm.cmd run lint`
- `npx.cmd tsc --noEmit`
- `npx.cmd tsc -p tsconfig.server.json --noEmit`
- `npm.cmd run rag:bench`
- `npm.cmd run rag:quality-report`
- `npm.cmd run rag:benchmark-diagnostics`
- `npm.cmd run rag:cache-benchmark`

### benchmark 결과

`npm.cmd run rag:bench` 결과:

- Archive: `benchmarks/results/rag-benchmark-2026-05-05T07-17-54-046Z.json`
- Total cases: 27
- Top-3 doc recall: 96.3% (26/27)
- Top-5 doc recall: 96.3% (26/27)
- Expected evidence pass: 100.0% (27/27)
- Forbidden evidence pass: 100.0% (27/27)
- Required citation pass: 100.0% (27/27)

Latency:

- Total benchmark duration: 31,631ms
- Case latency average: 754.1ms
- Case latency p95: 1,889ms
- Retrieval latency average: 691.7ms
- Retrieval latency p95: 1,449ms

Corpus phase timing aggregate:

- `evaluation-base`: cases 9, total avg 327.2ms, p95 548ms, lexical pool avg 7.2ms, exact avg 263.8ms, lexical avg 21.7ms, vector avg 0ms, fusion avg 33.8ms, evidence avg 0.7ms
- `evaluation-routing`: cases 9, total avg 286.6ms, p95 532ms, lexical pool avg 6.2ms, exact avg 216.3ms, lexical avg 29.8ms, vector avg 0ms, fusion avg 33.1ms, evidence avg 0.8ms
- `integrated-initial`: cases 18, total avg 266.0ms, p95 479ms, lexical pool avg 2.1ms, exact avg 214.4ms, lexical avg 31.4ms, vector avg 0ms, fusion avg 17.6ms, evidence avg 0.4ms
- `evaluation-direct-support`: cases 7, total avg 83.0ms, p95 154ms, lexical pool avg 6.0ms, exact avg 60.4ms, lexical avg 7.7ms, vector avg 0ms, fusion avg 8.1ms, evidence avg 0.6ms

Markdown 노출 확인:

- `docs/reports/rag-quality-report.md`
  - `### Search corpus phase timing`
  - `evaluation-base: cases 9, total avg 327.2ms, p95 548ms, lexical pool avg 7.2ms, exact avg 263.8ms`
- `docs/reports/rag-benchmark-diagnostics.md`
  - `## Search corpus phase timing`
  - `integrated-initial: cases 18, total avg 266ms, p95 479ms, lexical pool avg 2.1ms, exact avg 214.4ms`

### cache benchmark 결과

현재 `.rag-cache/rag-cache-benchmark.json` 기준:

- Cases: 5
- Runs: 10
- Warm retrieval cache hits: 5/5
- Average cold total: 1,598.0ms
- Average warm total: 16.4ms
- Average speedup: 96.5x

Archive:

- `benchmarks/results/rag-cache-benchmark-2026-05-05T07-18-38-885Z.json`

### 해석

- 품질 지표는 유지되었다.
- 현재 로컬 benchmark에서 vector phase는 계속 0ms이며, DB/vector 경로가 아니라 local corpus path를 보고 있다.
- dominant phase는 `exact`다.
  - `evaluation-base`: exact avg 263.8ms / total avg 327.2ms
  - `evaluation-routing`: exact avg 216.3ms / total avg 286.6ms
  - `integrated-initial`: exact avg 214.4ms / total avg 266.0ms
- lexical scoring cache나 posting-backed candidate pool보다 exact candidate scoring/materialization 쪽이 다음 최적화 대상이다.

### 다음 작업

P2-23 후보: `exact scoring phase 최적화`

권장 작업:

1. `exactCandidateChunks()`와 `scoreExact()` 호출 경로에서 scope 전체 chunk를 훑는 부분을 줄인다.
2. exact candidate도 lexical/posting candidate pool 또는 document fast path scope를 적극 재사용할 수 있는지 TDD로 검증한다.
3. exact phase latency aggregate를 기준으로 `evaluation-base`, `evaluation-routing`, `integrated-initial`의 exact avg/p95가 내려가는지 확인한다.

---

## 2026-05-05 / P2-23 완료: exact scoring query/metadata 반복 계산 제거

### 목표

P2-22에서 `searchCorpus` 내부 dominant phase가 `exact`임을 확인했다. P2-23은 `scoreExact()`가 chunk마다 query 정규화, query tokenization, title/file/section compact metadata 생성을 반복하던 비용을 줄이는 단계로 진행했다.

### TDD

추가 테스트:

- `tests/ragDbLexical.test.ts`
  - `searchCorpus reuses indexed exact metadata during exact scoring`
  - exact title lookup 결과가 유지되고, fusion stage trace에 `exact-scoring=indexed-metadata`가 표시되는지 검증.

RED 확인:

- `npx.cmd tsx --test tests/ragDbLexical.test.ts`
- 신규 trace note가 없어 실패하는 것을 확인했다.

### 구현

변경 파일:

- `src/lib/ragEngine.ts`
  - `RagCorpusIndex.exactMetadataByChunkId` 추가.
  - `buildRagCorpusIndex()`에서 chunk별 `titleCompact`, `fileNameCompact`, `sectionCompact`를 한 번만 계산해 저장.
  - `ExactScoringContext` 추가.
  - `buildExactScoringContext()`에서 query compact, document query probe, article, token, date probe를 search당 한 번만 계산.
  - `scoreExact()`가 query context와 indexed chunk metadata를 받아 재사용하도록 변경.
  - fusion stage trace에 `exact-scoring=indexed-metadata` note 추가.
- `tests/ragDbLexical.test.ts`
- `docs/plans/rag-search-performance-progress.md`

### 검증

통과:

- `npx.cmd tsx --test tests/ragDbLexical.test.ts`
  - 8 tests pass
- `npx.cmd tsx --test tests/ragDbLexical.test.ts tests/ragRerankPriority.test.ts tests/ragBenchmarkReport.test.ts tests/ragBenchmarkDiagnostics.test.ts tests/ragQualityReport.test.ts`
  - 26 tests pass
- `npm.cmd run lint`
- `npx.cmd tsc --noEmit`
- `npx.cmd tsc -p tsconfig.server.json --noEmit`
- `npm.cmd run rag:bench`
- `npm.cmd run rag:quality-report`
- `npm.cmd run rag:benchmark-diagnostics`
- `npm.cmd run rag:cache-benchmark`

### benchmark 결과

`npm.cmd run rag:bench` 결과:

- Archive: `benchmarks/results/rag-benchmark-2026-05-05T07-24-32-473Z.json`
- Total cases: 27
- Top-3 doc recall: 96.3% (26/27)
- Top-5 doc recall: 96.3% (26/27)
- Expected evidence pass: 100.0% (27/27)
- Forbidden evidence pass: 100.0% (27/27)
- Required citation pass: 100.0% (27/27)

Latency:

- Total benchmark duration: 25,030ms
- Case latency average: 486.9ms
- Case latency p95: 1,388ms
- Retrieval latency average: 410.1ms
- Retrieval latency p95: 658ms

P2-22 대비:

- Total benchmark duration: 31,631ms -> 25,030ms
- Case latency average: 754.1ms -> 486.9ms
- Case latency p95: 1,889ms -> 1,388ms
- Retrieval latency average: 691.7ms -> 410.1ms
- Retrieval latency p95: 1,449ms -> 658ms

Corpus phase timing aggregate:

- `evaluation-routing`: total avg 109.6ms, p95 305ms, lexical pool avg 6.6ms, exact avg 38.6ms, lexical avg 30.0ms, fusion avg 33.6ms
- `evaluation-base`: total avg 109.4ms, p95 300ms, lexical pool avg 6.8ms, exact avg 46.3ms, lexical avg 22.0ms, fusion avg 33.4ms
- `integrated-initial`: total avg 92.4ms, p95 153ms, lexical pool avg 1.7ms, exact avg 40.2ms, lexical avg 31.9ms, fusion avg 17.4ms
- `evaluation-direct-support`: total avg 33.0ms, p95 49ms, lexical pool avg 5.3ms, exact avg 10.6ms, lexical avg 7.7ms, fusion avg 8.3ms

P2-22 phase timing 대비:

- `evaluation-base` exact avg: 263.8ms -> 46.3ms
- `evaluation-routing` exact avg: 216.3ms -> 38.6ms
- `integrated-initial` exact avg: 214.4ms -> 40.2ms
- `evaluation-direct-support` exact avg: 60.4ms -> 10.6ms

### cache benchmark 결과

현재 `.rag-cache/rag-cache-benchmark.json` 기준:

- Cases: 5
- Runs: 10
- Warm retrieval cache hits: 5/5
- Average cold total: 1,072.2ms
- Average warm total: 16.2ms
- Average speedup: 65.3x

Archive:

- `benchmarks/results/rag-cache-benchmark-2026-05-05T07-25-12-878Z.json`

### 해석

- 품질 지표는 유지되었다.
- exact phase가 크게 줄면서 cold retrieval latency도 뚜렷하게 개선되었다.
- exact metadata/query context 재사용은 branch-safe한 구조 변경으로 보이며, document-title/rerank 관련 회귀 테스트도 통과했다.
- 이제 dominant phase는 case/stage별로 lexical과 fusion이 번갈아 보인다.
  - `evaluation-routing`: exact 38.6ms, lexical 30.0ms, fusion 33.6ms
  - `evaluation-base`: exact 46.3ms, lexical 22.0ms, fusion 33.4ms
  - `integrated-initial`: exact 40.2ms, lexical 31.9ms, fusion 17.4ms

### 다음 작업

P2-24 후보: `post-exact dominant phase 재평가 및 lexical/fusion micro optimization`

권장 작업:

1. P2-23 이후 phase timing 기준으로 stage별 dominant phase를 다시 aggregate한다.
2. `evaluation-base`는 exact가 아직 가장 크므로 추가 exact short-circuit 여지가 있는지 확인한다.
3. `evaluation-routing`과 `integrated-initial`은 lexical/fusion 비용도 근접하므로, fusion/rerank candidate 수와 entity anchored candidate scan 비용을 따로 진단한다.

---

## 2026-05-05 / P2-24 완료: post-exact dominant phase 재평가 및 exact 후보 lazy allocation

### 목표

P2-23 이후 exact phase가 크게 줄었으나 여전히 `evaluation-base`, `evaluation-routing`, `integrated-initial`에서 exact/lexical/fusion 비용이 비슷한 수준으로 남아 있었다. P2-24는 exact score가 0인 chunk에 대해 `SearchCandidate` 객체를 만들지 않도록 lazy allocation을 적용하고, 실제 latency 개선 폭을 재측정하는 단계로 진행했다.

### TDD

추가 테스트:

- `tests/ragDbLexical.test.ts`
  - `searchCorpus reuses indexed exact metadata during exact scoring`
  - 기존 `exact-scoring=indexed-metadata` trace 검증에 더해 `exact-scoring=lazy-candidate` note를 검증한다.

RED 확인:

- `npx.cmd tsx --test tests/ragDbLexical.test.ts`
- lazy candidate trace note가 없어 실패하는 것을 확인했다.

### 구현

변경 파일:

- `src/lib/ragEngine.ts`
  - `scoreExact()`가 exact score 0일 때 `null`을 반환하도록 변경했다.
  - exact score가 있는 chunk에 대해서만 `createCandidate()`와 `boostCandidate()`를 호출하도록 조정했다.
  - exact candidate 생성 경로가 `SearchCandidate | null`을 처리하도록 변경했다.
  - fusion stage trace에 `exact-scoring=indexed-metadata`와 `exact-scoring=lazy-candidate`를 함께 노출하도록 note 생성 방식을 확장했다.
- `tests/ragDbLexical.test.ts`
- `docs/plans/rag-search-performance-progress.md`

### 검증

통과:

- `npx.cmd tsx --test tests/ragDbLexical.test.ts`
  - 8 tests pass
- `npx.cmd tsx --test tests/ragDbLexical.test.ts tests/ragRerankPriority.test.ts tests/ragBenchmarkReport.test.ts tests/ragBenchmarkDiagnostics.test.ts tests/ragQualityReport.test.ts`
  - 26 tests pass
- `npm.cmd run lint`
- `npx.cmd tsc --noEmit`
- `npx.cmd tsc -p tsconfig.server.json --noEmit`
- `npm.cmd run rag:bench`
- `npm.cmd run rag:quality-report`
- `npm.cmd run rag:benchmark-diagnostics`
- `npm.cmd run rag:cache-benchmark`

참고:

- `npm.cmd run rag:quality-report`, `npm.cmd run rag:benchmark-diagnostics`, `npm.cmd run rag:cache-benchmark`는 기본 sandbox에서 `tsx/esbuild spawn EPERM`으로 실패하여 승인된 escalated 실행으로 재검증했다.

### benchmark 결과

`npm.cmd run rag:bench` 결과:

- Archive: `benchmarks/results/rag-benchmark-2026-05-05T07-44-18-898Z.json`
- Total cases: 27
- Top-3 doc recall: 96.3% (26/27)
- Top-5 doc recall: 96.3% (26/27)
- Expected evidence pass: 100.0% (27/27)
- Forbidden evidence pass: 100.0% (27/27)
- Required citation pass: 100.0% (27/27)

Latency:

- Total benchmark duration: 24,782ms
- Case latency average: 490.9ms
- Case latency p95: 1,375ms
- Retrieval latency average: 415.7ms
- Retrieval latency p95: 659ms

P2-23 대비:

- Total benchmark duration: 25,030ms -> 24,782ms
- Case latency average: 486.9ms -> 490.9ms
- Case latency p95: 1,388ms -> 1,375ms
- Retrieval latency average: 410.1ms -> 415.7ms
- Retrieval latency p95: 658ms -> 659ms

Corpus phase timing aggregate:

- `evaluation-base`: cases 9, total avg 116.3ms, p95 305ms, lexical pool avg 7.3ms, exact avg 50.3ms, lexical avg 23.6ms, fusion avg 33.9ms, evidence avg 0.9ms
- `evaluation-routing`: cases 9, total avg 109.7ms, p95 303ms, lexical pool avg 6.8ms, exact avg 39.3ms, lexical avg 30.3ms, fusion avg 33.1ms, evidence avg 0.6ms
- `integrated-initial`: cases 18, total avg 93.4ms, p95 151ms, lexical pool avg 1.6ms, exact avg 42.6ms, lexical avg 30.9ms, fusion avg 17.3ms, evidence avg 0.6ms
- `evaluation-promoted-primary`: cases 2, total avg 42.0ms, p95 63ms
- `evaluation-direct-support`: cases 7, total avg 36.1ms, p95 49ms
- `evaluation-primary-manual`: cases 4, total avg 23.3ms, p95 29ms

### cache benchmark 결과

현재 `.rag-cache/rag-cache-benchmark.json` 기준:

- Cases: 5
- Runs: 10
- Warm retrieval cache hits: 5/5
- Average cold total: 1,083.0ms
- Average warm total: 16.6ms
- Average speedup: 65.1x

Archive:

- `benchmarks/results/rag-cache-benchmark-2026-05-05T07-46-41-810Z.json`

### 해석

- 품질 지표는 유지되었다.
- exact score 0 후보의 lazy allocation은 구조적으로 불필요한 candidate materialization을 줄이는 정리이지만, 이번 benchmark에서는 P2-23 대비 실질 latency 개선이 거의 없었다.
- P2-24 수치는 run-to-run 변동 범위에 가깝다. 특히 retrieval avg는 410.1ms -> 415.7ms로 소폭 증가했고, p95는 658ms -> 659ms로 사실상 동일하다.
- 다음 병목은 단순 exact allocation보다 `fusion`과 `lexical` 내부 세부 비용일 가능성이 높다.
  - `evaluation-base`: exact 50.3ms, fusion 33.9ms, lexical 23.6ms
  - `evaluation-routing`: exact 39.3ms, fusion 33.1ms, lexical 30.3ms
  - `integrated-initial`: exact 42.6ms, lexical 30.9ms, fusion 17.3ms

### 다음 작업

P2-25 후보: `fusion/entity anchored candidate scan timing 진단 및 최적화`

권장 작업:

1. fusion phase 내부를 `rrf merge`, `rerank`, `entity anchored candidate scan`, `diversify/evidence prep` 등으로 분해해 timing trace를 추가한다.
2. `buildEntityAnchoredCandidates`가 전체 chunk를 스캔하는 경우가 dominant인지 benchmark aggregate로 확인한다.
3. 병목이 확인되면 entity/document anchor 기반 candidate scan을 posting/index 기반으로 좁히는 최적화를 TDD로 진행한다.

---

## 2026-05-05 / P2-25 완료: fusion phase 내부 timing 분해 및 scoped entity anchor scan

### 목표

P2-24 결과에서 exact 후보 lazy allocation은 품질을 유지했지만 latency 개선은 거의 없었다. P2-25는 `phaseFusion`을 내부 subphase로 분해해, fusion의 실제 병목이 RRF merge, rerank, entity anchor scan, merge, diversify 중 어디인지 benchmark/quality report에서 확인할 수 있게 만드는 단계로 진행했다.

### TDD

추가 테스트:

- `tests/ragBenchmarkReport.test.ts`
  - `search-store-latency` planner trace의 `phaseFusionRrf`, `phaseFusionRerank`, `phaseFusionEntity`, `phaseFusionMerge`, `phaseFusionDiversify`를 `performance.corpusPhaseLatencySummary`로 집계하는지 검증.
- `tests/ragBenchmarkDiagnostics.test.ts`
  - benchmark diagnostics markdown에 fusion detail timing이 표시되는지 검증.
- `tests/ragQualityReport.test.ts`
  - quality report markdown에 fusion detail timing이 표시되는지 검증.
- `tests/ragDbLexical.test.ts`
  - `searchCorpus.corpusPhaseTimings.fusionDetails`가 실제 search 결과에 포함되는지 검증.

RED 확인:

- `npx.cmd tsx --test tests/ragBenchmarkReport.test.ts tests/ragBenchmarkDiagnostics.test.ts tests/ragQualityReport.test.ts tests/ragDbLexical.test.ts`
- 신규 fusion detail 필드와 markdown 출력이 없어 실패하는 것을 확인했다.

### 구현

변경 파일:

- `src/lib/ragTypes.ts`
  - `SearchCorpusFusionTimings` 추가.
  - `SearchCorpusPhaseTimings.fusionDetails` 추가.
- `src/lib/ragEngine.ts`
  - fusion 내부를 `rrf`, `rerank`, `entityAnchor`, `merge`, `diversify` timing으로 분해.
  - `SearchRun.corpusPhaseTimings.fusionDetails`에 subphase timing 저장.
  - `buildEntityAnchoredCandidates()`가 allowed document scope가 있는 경우 전체 corpus 대신 `scopedChunks()`를 순회하도록 조정.
- `src/lib/nodeRagService.ts`
  - `search-store-latency` trace에 `phaseFusionRrf`, `phaseFusionRerank`, `phaseFusionEntity`, `phaseFusionMerge`, `phaseFusionDiversify` 추가.
- `src/lib/ragBenchmarkReport.ts`
  - fusion detail trace parser 및 aggregate 필드 추가.
- `src/lib/ragBenchmarkDiagnostics.ts`
- `src/lib/ragQualityReport.ts`
- `tests/ragBenchmarkReport.test.ts`
- `tests/ragBenchmarkDiagnostics.test.ts`
- `tests/ragQualityReport.test.ts`
- `tests/ragDbLexical.test.ts`
- `docs/plans/rag-search-performance-progress.md`

### 검증

통과:

- `npx.cmd tsx --test tests/ragBenchmarkReport.test.ts tests/ragBenchmarkDiagnostics.test.ts tests/ragQualityReport.test.ts tests/ragDbLexical.test.ts`
  - 19 tests pass
- `npx.cmd tsx --test tests/ragBenchmarkReport.test.ts tests/ragBenchmarkDiagnostics.test.ts tests/ragQualityReport.test.ts tests/ragDbLexical.test.ts tests/ragRerankPriority.test.ts`
  - 26 tests pass
- `npm.cmd run lint`
- `npx.cmd tsc --noEmit`
- `npx.cmd tsc -p tsconfig.server.json --noEmit`
- `npm.cmd run rag:bench`
- `npm.cmd run rag:quality-report`
- `npm.cmd run rag:benchmark-diagnostics`
- `npm.cmd run rag:cache-benchmark`

참고:

- `npm.cmd run rag:quality-report`, `npm.cmd run rag:benchmark-diagnostics`, `npm.cmd run rag:cache-benchmark`는 기존과 동일하게 sandbox 내 `tsx/esbuild spawn EPERM` 회피를 위해 escalated 실행으로 검증했다.

### benchmark 결과

`npm.cmd run rag:bench` 결과:

- Archive: `benchmarks/results/rag-benchmark-2026-05-05T08-01-13-645Z.json`
- Total cases: 27
- Top-3 doc recall: 96.3% (26/27)
- Top-5 doc recall: 96.3% (26/27)
- Expected evidence pass: 100.0% (27/27)
- Forbidden evidence pass: 100.0% (27/27)
- Required citation pass: 100.0% (27/27)

Latency:

- Total benchmark duration: 25,373ms
- Case latency average: 501.9ms
- Case latency p95: 1,423ms
- Retrieval latency average: 426.1ms
- Retrieval latency p95: 672ms

P2-24 대비:

- Total benchmark duration: 24,782ms -> 25,373ms
- Case latency average: 490.9ms -> 501.9ms
- Case latency p95: 1,375ms -> 1,423ms
- Retrieval latency average: 415.7ms -> 426.1ms
- Retrieval latency p95: 659ms -> 672ms

Corpus phase timing aggregate:

- `evaluation-base`: cases 9, total avg 111.0ms, p95 322ms, lexical pool avg 7.0ms, exact avg 45.3ms, lexical avg 21.9ms, fusion avg 36.4ms, fusion detail rrf avg 0.1ms, rerank avg 11.3ms, entity avg 24.6ms, merge avg 0.2ms, diversify avg 0.2ms
- `evaluation-routing`: cases 9, total avg 109.6ms, p95 314ms, lexical pool avg 5.8ms, exact avg 37.9ms, lexical avg 30.4ms, fusion avg 35.2ms, fusion detail rrf avg 0.1ms, rerank avg 12.3ms, entity avg 22.6ms, merge avg 0ms, diversify avg 0.2ms
- `integrated-initial`: cases 18, total avg 90.8ms, p95 146ms, lexical pool avg 2.0ms, exact avg 39.7ms, lexical avg 31.0ms, vector avg 0.1ms, fusion avg 17.4ms, fusion detail rrf avg 0.1ms, rerank avg 14.1ms, entity avg 3.2ms, merge avg 0ms, diversify avg 0.1ms
- `evaluation-promoted-primary`: cases 2, total avg 40.0ms, p95 60ms, fusion avg 24.5ms, fusion detail rerank avg 10.5ms, entity avg 14.0ms
- `evaluation-direct-support`: cases 7, total avg 33.1ms, p95 48ms, fusion avg 8.1ms, fusion detail rerank avg 8.0ms, entity avg 0ms

### cache benchmark 결과

현재 `.rag-cache/rag-cache-benchmark.json` 기준:

- Cases: 5
- Runs: 10
- Warm retrieval cache hits: 5/5
- Average cold total: 1,066.8ms
- Average warm total: 16.8ms
- Average speedup: 62.2x

Archive:

- `benchmarks/results/rag-cache-benchmark-2026-05-05T08-02-04-204Z.json`

### 해석

- 품질 지표는 유지되었다.
- P2-25는 진단 노출과 작은 scoped scan 최적화가 핵심이며, 전체 latency는 P2-24 대비 소폭 악화되었다. 이 정도는 계측 추가와 run-to-run 변동 범위로 보고, 성능 개선으로 해석하지 않는다.
- 새 fusion detail 기준으로 병목이 분명해졌다.
  - `evaluation-base` fusion avg 36.4ms 중 entity avg 24.6ms
  - `evaluation-routing` fusion avg 35.2ms 중 entity avg 22.6ms
  - `integrated-initial`은 entity avg 3.2ms보다 rerank avg 14.1ms가 크다.
- 따라서 evaluation 계열의 entity anchor candidate scan은 다음 최적화 타깃으로 충분하다.

### 다음 작업

P2-26 후보: `entity anchor candidate scan index/precompute 최적화`

권장 작업:

1. `buildEntityAnchoredCandidates()`가 매 search마다 chunk text를 compact/substring scan하는 비용을 줄일 수 있도록 index build 단계에서 entity anchor search text 또는 anchor hit metadata를 precompute한다.
2. evaluation-base/routing에서 entity avg 22~25ms가 줄어드는지 `phaseFusionEntity` 기준으로 검증한다.
3. entity anchor 후보 축소가 evidence recall을 흔들 수 있으므로, entity anchor가 필요한 checklist/enumeration 케이스 중심 회귀 테스트를 먼저 추가한다.

---

## 2026-05-05 / P2-26 완료: entity anchor candidate scan index/precompute 최적화

### 목표

P2-25에서 fusion detail timing을 분해한 결과, `evaluation-base`와 `evaluation-routing`의 fusion 내부 병목은 entity anchor scan이었다. P2-26은 entity anchor 후보 탐색을 매 search의 전체 chunk text scan에서 index build 시점의 posting/score precompute로 옮겨 `phaseFusionEntity`를 낮추는 단계로 진행했다.

### TDD

추가 테스트:

- `tests/ragDbLexical.test.ts`
  - `searchCorpus uses indexed entity anchor candidates during fusion`
  - `buildRagCorpusIndex()`가 `entityAnchorPostingMap`에 anchor별 chunk id를 저장하는지 검증.
  - entity anchor 후보가 fused candidates에 유지되는지 검증.
  - fusion stage trace에 `entity-anchor-source=index`가 표시되는지 검증.

RED 확인:

- `npx.cmd tsx --test tests/ragDbLexical.test.ts`
- `entityAnchorPostingMap`이 없어 실패하는 것을 확인했다.

### 구현

변경 파일:

- `src/lib/ragEngine.ts`
  - `RagCorpusIndex.entityAnchorScoresByChunkId` 추가.
  - `RagCorpusIndex.entityAnchorPostingMap` 추가.
  - `buildRagCorpusIndex()`에서 `ENTITY_ANCHORS` 기준으로 chunk별 anchor score와 anchor별 posting list를 precompute.
  - `buildEntityAnchoredCandidates()`가 query anchor posting list의 union만 순회하도록 변경.
  - 강한 anchor score 계산은 precomputed score map을 재사용하도록 변경.
  - fusion stage trace에 `entity-anchor-source=index`, `entity-anchor-pool-size=N` 추가.
- `tests/ragDbLexical.test.ts`
- `docs/plans/rag-search-performance-progress.md`

### 검증

통과:

- `npx.cmd tsx --test tests/ragDbLexical.test.ts`
  - 9 tests pass
- `npx.cmd tsx --test tests/ragDbLexical.test.ts tests/ragRerankPriority.test.ts tests/ragBenchmarkReport.test.ts tests/ragBenchmarkDiagnostics.test.ts tests/ragQualityReport.test.ts`
  - 27 tests pass
- `npm.cmd run lint`
- `npx.cmd tsc --noEmit`
- `npx.cmd tsc -p tsconfig.server.json --noEmit`
- `npm.cmd run rag:bench`
- `npm.cmd run rag:quality-report`
- `npm.cmd run rag:benchmark-diagnostics`
- `npm.cmd run rag:cache-benchmark`

참고:

- `npm.cmd run rag:quality-report`, `npm.cmd run rag:benchmark-diagnostics`, `npm.cmd run rag:cache-benchmark`는 기존과 동일하게 sandbox 내 `tsx/esbuild spawn EPERM` 회피를 위해 escalated 실행으로 검증했다.

### benchmark 결과

`npm.cmd run rag:bench` 결과:

- Archive: `benchmarks/results/rag-benchmark-2026-05-05T08-10-33-472Z.json`
- Total cases: 27
- Top-3 doc recall: 96.3% (26/27)
- Top-5 doc recall: 96.3% (26/27)
- Expected evidence pass: 100.0% (27/27)
- Forbidden evidence pass: 100.0% (27/27)
- Required citation pass: 100.0% (27/27)

Latency:

- Total benchmark duration: 26,604ms
- Case latency average: 487.7ms
- Case latency p95: 1,126ms
- Retrieval latency average: 412.1ms
- Retrieval latency p95: 665ms

P2-25 대비:

- Total benchmark duration: 25,373ms -> 26,604ms
- Case latency average: 501.9ms -> 487.7ms
- Case latency p95: 1,423ms -> 1,126ms
- Retrieval latency average: 426.1ms -> 412.1ms
- Retrieval latency p95: 672ms -> 665ms

Corpus phase timing aggregate:

- `evaluation-base`: cases 9, total avg 98.0ms, p95 172ms, lexical pool avg 6.6ms, exact avg 49.4ms, lexical avg 21.8ms, fusion avg 19.2ms, fusion detail rerank avg 11.4ms, entity avg 7.7ms
- `evaluation-routing`: cases 9, total avg 94.8ms, p95 176ms, lexical pool avg 5.9ms, exact avg 39.7ms, lexical avg 29.1ms, fusion avg 19.6ms, fusion detail rerank avg 11.9ms, entity avg 7.4ms
- `integrated-initial`: cases 18, total avg 90.9ms, p95 150ms, lexical pool avg 1.7ms, exact avg 41.3ms, lexical avg 30.4ms, fusion avg 16.7ms, fusion detail rerank avg 14.2ms, entity avg 2.4ms
- `evaluation-promoted-primary`: cases 2, total avg 33.5ms, p95 46ms, fusion avg 17.0ms, fusion detail rerank avg 10.5ms, entity avg 6.5ms
- `evaluation-direct-support`: cases 7, total avg 33.3ms, p95 48ms, fusion avg 8.0ms, fusion detail rerank avg 7.9ms, entity avg 0ms

P2-25 phase timing 대비:

- `evaluation-base` fusion entity avg: 24.6ms -> 7.7ms
- `evaluation-routing` fusion entity avg: 22.6ms -> 7.4ms
- `integrated-initial` fusion entity avg: 3.2ms -> 2.4ms
- `evaluation-promoted-primary` fusion entity avg: 14.0ms -> 6.5ms

### cache benchmark 결과

현재 `.rag-cache/rag-cache-benchmark.json` 기준:

- Cases: 5
- Runs: 10
- Warm retrieval cache hits: 5/5
- Average cold total: 1,007.8ms
- Average warm total: 16.8ms
- Average speedup: 58.6x

Archive:

- `benchmarks/results/rag-cache-benchmark-2026-05-05T08-11-19-945Z.json`

### 해석

- 품질 지표는 유지되었다.
- `phaseFusionEntity`는 목표한 evaluation 계열에서 뚜렷하게 개선되었다.
- 전체 benchmark duration은 P2-25보다 증가했지만, case avg/p95와 retrieval avg/p95는 개선되었다. archive write 및 전체 process duration 변동과 검색 latency 지표를 분리해서 보는 것이 맞다.
- P2-26 이후 evaluation-base/routing의 fusion 내부 병목은 entity scan보다 rerank 쪽으로 이동했다.
  - `evaluation-base`: rerank 11.4ms, entity 7.7ms
  - `evaluation-routing`: rerank 11.9ms, entity 7.4ms
  - `integrated-initial`: rerank 14.2ms, entity 2.4ms

### 다음 작업

P2-27 후보: `fusion rerank micro optimization 및 heading/document lookup score precompute 검토`

권장 작업:

1. `rerankCandidate()` 내부 반복 계산 중 heading alignment, document lookup source priority, focus term matching 비용을 분해 계측한다.
2. `evaluation-base/routing`과 `integrated-initial`에서 fusion rerank avg 11~14ms가 줄어드는지 확인한다.
3. title/section compact 또는 focus match에 precompute 여지가 있는지 TDD로 좁혀 적용한다.

---

## 2026-05-05 / P2-27 완료: shared rerank query context 적용

### 목표

P2-26 이후 fusion 내부 병목은 entity scan에서 rerank 쪽으로 이동했다. P2-27은 `rerankCandidate()`가 후보마다 반복하던 query focus term 생성과 document lookup 관련 query regex 계산을 search당 1회로 줄여 fusion rerank 비용을 낮추는 단계로 착수했다.

### TDD

추가 테스트:

- `tests/ragDbLexical.test.ts`
  - `searchCorpus shares rerank query context across fusion candidates`
  - fusion stage trace에 `rerank-context=shared`가 표시되는지 검증.

RED 확인:

- `npx.cmd tsx --test tests/ragDbLexical.test.ts`
- escalated 실행은 usage limit로 거절되었고, sandbox 실행에서는 `spawn EPERM`이 발생했다.
- 단, 테스트 추가 직후 sandbox 실행에서 신규 assertion이 실패하는 RED 상태는 확인했다.

### 구현

변경 파일:

- `src/lib/ragEngine.ts`
  - `RerankQueryContext` 추가.
  - `buildRerankQueryContext()`에서 query focus terms, non-generic focus terms, checklist/document lookup/evaluation comparison/workflow document query signal을 search당 1회 계산.
  - `scoreHeadingAlignment()`가 `deriveFocusTerms(query)`를 후보마다 호출하지 않고 shared context를 사용하도록 변경.
  - `scoreDocumentLookupSourcePriority()`가 query regex 및 focus term 계산을 반복하지 않고 shared context를 사용하도록 변경.
  - `rerankCandidate()`와 `buildEntityAnchoredCandidates()`가 shared rerank context를 받도록 변경.
  - fusion stage trace에 `rerank-context=shared` 추가.
- `tests/ragDbLexical.test.ts`
- `docs/plans/rag-search-performance-progress.md`

### 검증

통과:

- `npx.cmd tsx --test tests/ragDbLexical.test.ts`
  - 10 tests pass
- `npx.cmd tsx --test tests/ragDbLexical.test.ts tests/ragRerankPriority.test.ts tests/ragBenchmarkReport.test.ts tests/ragBenchmarkDiagnostics.test.ts tests/ragQualityReport.test.ts`
  - 28 tests pass
- `npm.cmd run lint`
- `npx.cmd tsc --noEmit`
- `npx.cmd tsc -p tsconfig.server.json --noEmit`
- `npm.cmd run rag:bench`
- `npm.cmd run rag:benchmark-diagnostics`
- `npm.cmd run rag:quality-report`
- `npm.cmd run rag:cache-benchmark`

참고:

- `npx.cmd tsx --test ...`, `npm.cmd run rag:quality-report`, `npm.cmd run rag:benchmark-diagnostics`, `npm.cmd run rag:cache-benchmark`는 sandbox 내 `tsx/esbuild spawn EPERM` 회피를 위해 escalated 실행으로 검증했다.

### benchmark 결과

`npm.cmd run rag:bench` 결과:

- Archive: `benchmarks/results/rag-benchmark-2026-05-05T08-23-34-598Z.json`
- Total cases: 27
- Top-3 doc recall: 96.3% (26/27)
- Top-5 doc recall: 96.3% (26/27)
- Expected evidence pass: 100.0% (27/27)
- Forbidden evidence pass: 100.0% (27/27)
- Required citation pass: 100.0% (27/27)

Latency:

- Total benchmark duration: 25,909ms
- Case latency average: 466.1ms
- Case latency p95: 969ms
- Retrieval latency average: 389.0ms
- Retrieval latency p95: 522ms

P2-26 대비:

- Total benchmark duration: 26,604ms -> 25,909ms
- Case latency average: 487.7ms -> 466.1ms
- Case latency p95: 1,126ms -> 969ms
- Retrieval latency average: 412.1ms -> 389.0ms
- Retrieval latency p95: 665ms -> 522ms

Corpus phase timing aggregate:

- `evaluation-base`: total avg 79.9ms, p95 125ms, exact avg 48.1ms, lexical avg 22.2ms, fusion avg 2.2ms, fusion rerank avg 0.8ms, entity avg 1.2ms
- `evaluation-routing`: total avg 78.1ms, p95 110ms, exact avg 39.2ms, lexical avg 29.1ms, fusion avg 2.4ms, fusion rerank avg 1.0ms, entity avg 1.3ms
- `integrated-initial`: total avg 76.1ms, p95 129ms, exact avg 40.5ms, lexical avg 30.4ms, fusion avg 2.0ms, fusion rerank avg 1.4ms, entity avg 0.5ms
- `evaluation-direct-support`: total avg 26.3ms, p95 41ms, fusion rerank avg 0.6ms

P2-26 phase timing 대비:

- `evaluation-base` fusion rerank avg: 11.4ms -> 0.8ms
- `evaluation-routing` fusion rerank avg: 11.9ms -> 1.0ms
- `integrated-initial` fusion rerank avg: 14.2ms -> 1.4ms

### 해석

- 품질 지표는 유지되었다.
- query focus term과 document lookup query signal을 shared context로 옮기면서 fusion rerank 비용이 크게 낮아졌다.
- P2-27 이후 fusion 내부 비용은 전반적으로 1~2ms 수준까지 내려왔고, 다음 병목은 다시 exact/lexical 쪽으로 이동했다.

### cache benchmark 결과

현재 `.rag-cache/rag-cache-benchmark.json` 기준:

- Cases: 5
- Runs: 10
- Warm retrieval cache hits: 5/5
- Average cold total: 986.8ms
- Average warm total: 17.6ms
- Average speedup: 54.7x

Archive:

- `benchmarks/results/rag-cache-benchmark-2026-05-05T12-10-47-470Z.json`

### 다음 작업

P2-28 후보: `post-fusion dominant phase 재평가 및 exact/lexical 추가 최적화`

권장 작업:

1. P2-27 이후 phase timing 기준으로 `evaluation-base/routing/integrated-initial`의 dominant phase를 다시 정렬한다.
2. `evaluation-base`는 exact avg 48.1ms, `evaluation-routing`은 exact 39.2ms와 lexical 29.1ms, `integrated-initial`은 exact 40.5ms와 lexical 30.4ms가 다음 병목이다.
3. exact/lexical 공통으로 candidate chunk pool을 더 좁힐 수 있는지, 또는 heading/title compact precompute를 확장할 수 있는지 TDD로 확인한다.

---

## 2026-05-05 / P2-28 완료: exact query compact term precompute

### 목표

P2-27 이후 fusion 내부 비용은 충분히 낮아졌고, `evaluation-base`, `evaluation-routing`, `integrated-initial`에서 exact/lexical phase가 다시 지배적인 비용으로 남았다. P2-28은 exact scoring 루프 안에서 후보 chunk마다 반복하던 query token/alias compact 계산을 검색 1회 단위 context로 올려 exact phase latency를 줄이는 것을 목표로 했다.

### TDD

추가 테스트:

- `tests/ragDbLexical.test.ts`
  - `searchCorpus reuses indexed exact metadata during exact scoring`
  - fusion stage trace에 `exact-scoring=compact-query-terms`가 표시되는지 검증

RED 확인:

- `npx.cmd tsx --test tests/ragDbLexical.test.ts`
- 테스트 추가 직후 `exact-scoring=compact-query-terms` note가 없어서 실패하는 것을 확인했다.

### 구현

변경 파일:

- `src/lib/ragEngine.ts`
  - `ExactScoringContext.queryTokens`, `queryAliases`에 `{ raw, compact }` 구조를 사용하도록 변경.
  - `buildExactScoringContext()`에서 query token/alias compact 값을 한 번만 계산하도록 변경.
  - `scoreExact()`와 `scoreAliasMetadata()`가 precomputed compact 값을 사용하도록 변경.
  - fusion stage trace에 `exact-scoring=compact-query-terms` note를 추가.
- `tests/ragDbLexical.test.ts`
- `docs/plans/rag-search-performance-progress.md`

### 검증

통과:

- `npx.cmd tsx --test tests/ragDbLexical.test.ts`
  - 10 tests pass
- `npx.cmd tsx --test tests/ragDbLexical.test.ts tests/ragRerankPriority.test.ts tests/ragBenchmarkReport.test.ts tests/ragBenchmarkDiagnostics.test.ts tests/ragQualityReport.test.ts`
  - 28 tests pass
- `npm.cmd run lint`
- `npx.cmd tsc --noEmit`
- `npx.cmd tsc -p tsconfig.server.json --noEmit`
- `npm.cmd run rag:bench`
- `npm.cmd run rag:quality-report`
- `npm.cmd run rag:benchmark-diagnostics`
- `npm.cmd run rag:cache-benchmark`

참고:

- `npx.cmd tsx --test ...`, `npm.cmd run rag:quality-report`, `npm.cmd run rag:benchmark-diagnostics`, `npm.cmd run rag:cache-benchmark`는 sandbox 내 `tsx/esbuild spawn EPERM` 회피를 위해 escalated 실행으로 검증했다.

### benchmark 결과

`npm.cmd run rag:bench` 결과:

- Archive: `benchmarks/results/rag-benchmark-2026-05-05T12-14-11-481Z.json`
- Total cases: 27
- Top-3 doc recall: 96.3% (26/27)
- Top-5 doc recall: 96.3% (26/27)
- Expected evidence pass: 100.0% (27/27)
- Forbidden evidence pass: 100.0% (27/27)
- Required citation pass: 100.0% (27/27)

Latency:

- Total benchmark duration: 24,996ms
- Case latency average: 428.2ms
- Case latency p95: 896ms
- Retrieval latency average: 347.9ms
- Retrieval latency p95: 463ms

P2-27 대비:

- Total benchmark duration: 25,909ms -> 24,996ms
- Case latency average: 466.1ms -> 428.2ms
- Case latency p95: 969ms -> 896ms
- Retrieval latency average: 389.0ms -> 347.9ms
- Retrieval latency p95: 522ms -> 463ms

Corpus phase timing aggregate:

- `evaluation-base`: total avg 53.8ms, p95 80ms, exact avg 21.9ms, lexical avg 21.8ms, fusion avg 2.3ms, fusion rerank avg 0.9ms, entity avg 1.3ms
- `evaluation-routing`: total avg 58.3ms, p95 84ms, exact avg 19.0ms, lexical avg 29.8ms, fusion avg 2.6ms, fusion rerank avg 1.0ms, entity avg 1.4ms
- `integrated-initial`: total avg 57.7ms, p95 97ms, exact avg 20.9ms, lexical avg 31.7ms, fusion avg 1.7ms, fusion rerank avg 0.9ms, entity avg 0.6ms
- `evaluation-direct-support`: total avg 20.7ms, p95 29ms, exact avg 5.7ms, lexical avg 7.6ms, fusion avg 1.1ms
- `evaluation-promoted-primary`: total avg 16.0ms, p95 19ms, exact avg 2.5ms, lexical avg 4.0ms, fusion avg 2.5ms
- `evaluation-primary-manual`: total avg 11.8ms, p95 16ms, exact avg 0.8ms, lexical avg 2.8ms, fusion avg 1.8ms

P2-27 phase timing 대비:

- `evaluation-base` exact avg: 48.1ms -> 21.9ms
- `evaluation-routing` exact avg: 39.2ms -> 19.0ms
- `integrated-initial` exact avg: 40.5ms -> 20.9ms

### cache benchmark 결과

현재 `.rag-cache/rag-cache-benchmark.json` 기준:

- Cases: 5
- Runs: 10
- Warm retrieval cache hits: 5/5
- Average cold total: 913.4ms
- Average warm total: 17.0ms
- Average speedup: 52.8x

Archive:

- `benchmarks/results/rag-cache-benchmark-2026-05-05T12-15-03-223Z.json`

### 해석

- 품질 지표는 유지되었다.
- exact phase 비용이 `evaluation-base/routing/integrated-initial`에서 절반 수준으로 줄었다.
- P2-28 이후 `evaluation-routing`과 `integrated-initial`은 lexical phase가 가장 큰 병목이고, `evaluation-base`는 exact/lexical이 거의 같은 수준이다.

### 다음 작업

P2-29 후보: `lexical scoring dominant phase 최적화 및 IDF/token signature precompute`

권장 작업:

1. lexical scoring에서 query token별 IDF/token signature를 검색 1회 단위로 precompute하고 trace note로 검증한다.
2. `evaluation-routing`과 `integrated-initial`의 lexical avg 29~32ms가 줄어드는지 확인한다.
3. 품질 회귀가 없으면 benchmark diagnostics와 quality report의 phase timing 기준으로 다음 병목을 재정렬한다.

---

## 2026-05-05 / P2-29 완료: lexical scoring IDF/token signature precompute

### 목표

P2-28 이후 `evaluation-routing`과 `integrated-initial`에서 lexical phase가 dominant로 남았다. P2-29는 lexical scoring 루프 안에서 후보 chunk마다 반복하던 query token별 df/idf 계산과 cache key token signature 생성을 검색 1회 단위 context로 올려 lexical phase latency를 줄이는 것을 목표로 했다.

### TDD

추가 테스트:

- `tests/ragDbLexical.test.ts`
  - `searchCorpus reuses lexical scoring cache across scoped searches`
  - lexical stage trace에 `lexical-scoring=idf-precomputed`가 표시되는지 검증

RED 확인:

- `npx.cmd tsx --test tests/ragDbLexical.test.ts`
- sandbox 실행은 기존과 동일하게 `tsx/esbuild spawn EPERM`으로 실패했고, escalated 실행에서 신규 trace note가 없어 실패하는 것을 확인했다.

### 구현

변경 파일:

- `src/lib/ragEngine.ts`
  - `LexicalScoringContext`와 `buildLexicalScoringContext()` 추가.
  - query token별 IDF와 lexical cache token signature를 search당 1회 계산하도록 변경.
  - `computeLexicalScoringEntry()`가 precomputed IDF를 사용하도록 변경.
  - `buildLexicalScoringCacheKey()`가 precomputed token signature를 재사용하도록 변경.
  - lexical stage trace에 `lexical-scoring=idf-precomputed` note를 추가.
- `tests/ragDbLexical.test.ts`
- `docs/plans/rag-search-performance-progress.md`

### 검증

통과:

- `npx.cmd tsx --test tests/ragDbLexical.test.ts`
  - 10 tests pass
- `npx.cmd tsx --test tests/ragDbLexical.test.ts tests/ragRerankPriority.test.ts tests/ragBenchmarkReport.test.ts tests/ragBenchmarkDiagnostics.test.ts tests/ragQualityReport.test.ts`
  - 28 tests pass
- `npm.cmd run lint`
- `npx.cmd tsc --noEmit`
- `npx.cmd tsc -p tsconfig.server.json --noEmit`
- `npm.cmd run rag:bench`
- `npm.cmd run rag:quality-report`
- `npm.cmd run rag:benchmark-diagnostics`
- `npm.cmd run rag:cache-benchmark`

참고:

- `npx.cmd tsx --test ...`, `npm.cmd run rag:quality-report`, `npm.cmd run rag:benchmark-diagnostics`, `npm.cmd run rag:cache-benchmark`는 sandbox 내 `tsx/esbuild spawn EPERM` 회피를 위해 escalated 실행으로 검증했다.

### benchmark 결과

`npm.cmd run rag:bench` 결과:

- Archive: `benchmarks/results/rag-benchmark-2026-05-05T12-22-54-122Z.json`
- Total cases: 27
- Top-3 doc recall: 96.3% (26/27)
- Top-5 doc recall: 96.3% (26/27)
- Expected evidence pass: 100.0% (27/27)
- Forbidden evidence pass: 100.0% (27/27)
- Required citation pass: 100.0% (27/27)

Latency:

- Total benchmark duration: 24,392ms
- Case latency average: 406.6ms
- Case latency p95: 867ms
- Retrieval latency average: 325.9ms
- Retrieval latency p95: 432ms

P2-28 대비:

- Total benchmark duration: 24,996ms -> 24,392ms
- Case latency average: 428.2ms -> 406.6ms
- Case latency p95: 896ms -> 867ms
- Retrieval latency average: 347.9ms -> 325.9ms
- Retrieval latency p95: 463ms -> 432ms

Corpus phase timing aggregate:

- `evaluation-routing`: total avg 43.0ms, p95 72ms, lexical pool avg 6.3ms, exact avg 18.4ms, lexical avg 14.3ms, fusion avg 2.7ms
- `integrated-initial`: total avg 42.9ms, p95 74ms, lexical pool avg 1.4ms, exact avg 21.2ms, lexical avg 16.9ms, fusion avg 2.1ms
- `evaluation-base`: total avg 39.8ms, p95 58ms, lexical pool avg 6.1ms, exact avg 22.3ms, lexical avg 7.8ms, fusion avg 2.6ms
- `evaluation-direct-support`: total avg 16.3ms, p95 22ms, lexical pool avg 5.0ms, exact avg 5.7ms, lexical avg 3.4ms, fusion avg 0.9ms
- `evaluation-promoted-primary`: total avg 14.5ms, p95 17ms, lexical pool avg 6.5ms, exact avg 2.5ms, lexical avg 1.5ms, fusion avg 2.5ms
- `evaluation-primary-manual`: total avg 11.0ms, p95 14ms, lexical pool avg 5.8ms, exact avg 1.5ms, lexical avg 1.0ms, fusion avg 1.3ms

P2-28 phase timing 대비:

- `evaluation-routing` lexical avg: 29.8ms -> 14.3ms
- `integrated-initial` lexical avg: 31.7ms -> 16.9ms
- `evaluation-base` lexical avg: 21.8ms -> 7.8ms

### cache benchmark 결과

현재 `.rag-cache/rag-cache-benchmark.json` 기준:

- Cases: 5
- Runs: 10
- Warm retrieval cache hits: 5/5
- Average cold total: 897.2ms
- Average warm total: 16.6ms
- Average speedup: 52.6x

Archive:

- `benchmarks/results/rag-cache-benchmark-2026-05-05T12-23-49-008Z.json`

### 해석

- 품질 지표는 유지되었다.
- lexical phase 비용은 주요 stage 전반에서 크게 줄었다.
- P2-29 이후 `evaluation-base`, `evaluation-routing`, `integrated-initial` 모두 exact phase가 가장 큰 corpus 내부 비용으로 남았다.

### 다음 작업

P2-30 후보: `exact scoring candidate pool 추가 축소 및 exact-dominant phase 재측정`

권장 작업:

1. 현재 exact phase는 lexical candidate pool 또는 scoped chunk pool을 사용하지만, unrestricted integrated/evaluation 검색에서 exact 후보 풀이 여전히 넓은지 확인한다.
2. exact scoring이 필요한 후보를 posting-backed lexical pool 중심으로 더 좁힐 수 있는 query 조건을 TDD로 검증한다.
3. 품질 회귀가 있으면 opt-in/guarded 경로로 제한하고, 없으면 phase timing 기준으로 Phase 2 성능 최적화 완료 여부를 판단한다.

---

## 2026-05-05 / P2-30 완료: exact candidate bounded top-k ranking

### 목표

P2-29 이후 exact phase가 다시 주요 corpus 내부 비용으로 남았다. P2-30은 exact 후보 의미를 유지하면서 전체 exact 후보 배열을 모두 정렬한 뒤 slice하지 않고, scoring 중 상위 `fusedTopK * 4`개만 bounded top-k로 유지해 정렬 비용을 줄이는 것을 목표로 했다.

### TDD

추가 테스트:

- `tests/ragDbLexical.test.ts`
  - `searchCorpus reuses indexed exact metadata during exact scoring`
  - fusion stage trace에 `exact-ranking=bounded-topk`가 표시되는지 검증

RED 확인:

- `npx.cmd tsx --test tests/ragDbLexical.test.ts`
- 신규 trace note가 없어 실패하는 것을 확인했다.

### 구현

변경 파일:

- `src/lib/ragEngine.ts`
  - `compareExactCandidateRank()`, `insertBoundedExactCandidate()` 추가.
  - exact scoring 결과를 전체 sort/slice하지 않고 bounded top-k 목록에 삽입하도록 변경.
  - fusion stage trace에 `exact-ranking=bounded-topk` note를 추가.
- `tests/ragDbLexical.test.ts`
- `docs/plans/rag-search-performance-progress.md`

### 검증

통과:

- `npx.cmd tsx --test tests/ragDbLexical.test.ts`
  - 10 tests pass
- `npx.cmd tsx --test tests/ragDbLexical.test.ts tests/ragRerankPriority.test.ts tests/ragBenchmarkReport.test.ts tests/ragBenchmarkDiagnostics.test.ts tests/ragQualityReport.test.ts`
  - 28 tests pass
- `npm.cmd run lint`
- `npx.cmd tsc --noEmit`
- `npx.cmd tsc -p tsconfig.server.json --noEmit`
- `npm.cmd run rag:bench`
- `npm.cmd run rag:quality-report`
- `npm.cmd run rag:benchmark-diagnostics`
- `npm.cmd run rag:cache-benchmark`

참고:

- `npx.cmd tsx --test ...`, `npm.cmd run rag:quality-report`, `npm.cmd run rag:benchmark-diagnostics`, `npm.cmd run rag:cache-benchmark`는 sandbox 내 `tsx/esbuild spawn EPERM` 회피를 위해 escalated 실행으로 검증했다.

### benchmark 결과

`npm.cmd run rag:bench` 결과:

- Archive: `benchmarks/results/rag-benchmark-2026-05-05T12-27-58-184Z.json`
- Total cases: 27
- Top-3 doc recall: 96.3% (26/27)
- Top-5 doc recall: 96.3% (26/27)
- Expected evidence pass: 100.0% (27/27)
- Forbidden evidence pass: 100.0% (27/27)
- Required citation pass: 100.0% (27/27)

Latency:

- Total benchmark duration: 24,596ms
- Case latency average: 414.6ms
- Case latency p95: 847ms
- Retrieval latency average: 331.4ms
- Retrieval latency p95: 439ms

P2-29 대비:

- Total benchmark duration: 24,392ms -> 24,596ms
- Case latency average: 406.6ms -> 414.6ms
- Case latency p95: 867ms -> 847ms
- Retrieval latency average: 325.9ms -> 331.4ms
- Retrieval latency p95: 432ms -> 439ms

Corpus phase timing aggregate:

- `integrated-initial`: total avg 44.6ms, p95 75ms, lexical pool avg 1.7ms, exact avg 21.7ms, lexical avg 17.6ms, fusion avg 1.7ms
- `evaluation-routing`: total avg 43.4ms, p95 65ms, lexical pool avg 5.7ms, exact avg 18.9ms, lexical avg 14.9ms, fusion avg 2.3ms
- `evaluation-base`: total avg 41.4ms, p95 64ms, lexical pool avg 6.3ms, exact avg 23.3ms, lexical avg 8.6ms, fusion avg 2.3ms
- `evaluation-direct-support`: total avg 16.9ms, p95 22ms, lexical pool avg 5.4ms, exact avg 5.7ms, lexical avg 3.7ms, fusion avg 0.9ms
- `evaluation-promoted-primary`: total avg 14.5ms, p95 18ms, lexical pool avg 7.0ms, exact avg 2.5ms, lexical avg 1.5ms, fusion avg 2.0ms
- `evaluation-primary-manual`: total avg 11.5ms, p95 15ms, lexical pool avg 5.3ms, exact avg 1.3ms, lexical avg 0.5ms, fusion avg 2.5ms

P2-29 phase timing 대비:

- `integrated-initial` exact avg: 21.2ms -> 21.7ms
- `evaluation-routing` exact avg: 18.4ms -> 18.9ms
- `evaluation-base` exact avg: 22.3ms -> 23.3ms

### cache benchmark 결과

현재 `.rag-cache/rag-cache-benchmark.json` 기준:

- Cases: 5
- Runs: 10
- Warm retrieval cache hits: 5/5
- Average cold total: 898.6ms
- Average warm total: 17.4ms
- Average speedup: 50.1x

Archive:

- `benchmarks/results/rag-cache-benchmark-2026-05-05T12-28-46-967Z.json`

### 해석

- 품질 지표는 유지되었다.
- bounded top-k ranking은 전체 sort/slice를 제거하는 구조적 정리지만, 현재 benchmark에서는 exact phase latency 개선으로 이어지지 않았다.
- 현재 exact 비용은 정렬보다 후보별 scoring 자체가 dominant로 보인다.

### 다음 작업

P2-31 후보: `exact scoring query signal/source score precompute 및 Phase 2 성능 최적화 마무리 판단`

권장 작업:

1. intent/sourceType, evaluation-mode, law reference compact처럼 exact scoring 내부의 남은 query-side 반복 계산을 context로 옮긴다.
2. 성능 효과가 미미하면 현 Phase 2 성능 최적화는 diminishing returns 구간으로 판단한다.
3. 이후 큰 개선은 검색 micro optimization보다 Phase 2 원 계획의 chunk policy/parent-child/small-to-big 구조 개선 또는 Phase 4 DB 검색 인프라에서 다루는 것이 적절하다.

---

## 2026-05-05 / P2-31 완료: exact query signal/source score precompute 및 마무리 판단

### 목표

P2-30에서 exact 후보 ranking 정렬 비용은 dominant가 아니라고 확인했다. P2-31은 exact scoring 내부에 남아 있는 query-side 반복 계산, 특히 intent/sourceType 가점 분기와 law reference canonical compact 계산을 `ExactScoringContext`로 올려 후보별 scoring 비용을 더 낮출 수 있는지 확인하는 마지막 low-risk micro optimization으로 진행했다.

### TDD

추가 테스트:

- `tests/ragDbLexical.test.ts`
  - `searchCorpus reuses indexed exact metadata during exact scoring`
  - fusion stage trace에 `exact-scoring=query-signals`가 표시되는지 검증

RED 확인:

- `npx.cmd tsx --test tests/ragDbLexical.test.ts`
- 신규 trace note가 없어 실패하는 것을 확인했다.

### 구현

변경 파일:

- `src/lib/ragEngine.ts`
  - `ExactScoringContext`에 precomputed law refs, intent source signal, evaluation mode signal 추가.
  - `buildExactIntentSourceSignal()` 추가.
  - `scoreLawReference()`가 precomputed canonical law compact 값을 사용하도록 변경.
  - `scoreExact()`가 intent/sourceType 배열 membership과 mode 확인을 context 값으로 처리하도록 변경.
  - fusion stage trace에 `exact-scoring=query-signals` note를 추가.
- `tests/ragDbLexical.test.ts`
- `docs/plans/rag-search-performance-progress.md`

### 검증

통과:

- `npx.cmd tsx --test tests/ragDbLexical.test.ts`
  - 10 tests pass
- `npx.cmd tsx --test tests/ragDbLexical.test.ts tests/ragRerankPriority.test.ts tests/ragBenchmarkReport.test.ts tests/ragBenchmarkDiagnostics.test.ts tests/ragQualityReport.test.ts`
  - 28 tests pass
- `npm.cmd run lint`
- `npx.cmd tsc --noEmit`
- `npx.cmd tsc -p tsconfig.server.json --noEmit`
- `npm.cmd run rag:bench`
- `npm.cmd run rag:quality-report`
- `npm.cmd run rag:benchmark-diagnostics`
- `npm.cmd run rag:cache-benchmark`

참고:

- `npx.cmd tsx --test ...`, `npm.cmd run rag:quality-report`, `npm.cmd run rag:benchmark-diagnostics`, `npm.cmd run rag:cache-benchmark`는 sandbox 내 `tsx/esbuild spawn EPERM` 회피를 위해 escalated 실행으로 검증했다.

### benchmark 결과

`npm.cmd run rag:bench` 결과:

- Archive: `benchmarks/results/rag-benchmark-2026-05-05T12-32-46-890Z.json`
- Total cases: 27
- Top-3 doc recall: 96.3% (26/27)
- Top-5 doc recall: 96.3% (26/27)
- Expected evidence pass: 100.0% (27/27)
- Forbidden evidence pass: 100.0% (27/27)
- Required citation pass: 100.0% (27/27)

Latency:

- Total benchmark duration: 24,874ms
- Case latency average: 425.7ms
- Case latency p95: 880ms
- Retrieval latency average: 346.3ms
- Retrieval latency p95: 460ms

P2-30 대비:

- Total benchmark duration: 24,596ms -> 24,874ms
- Case latency average: 414.6ms -> 425.7ms
- Case latency p95: 847ms -> 880ms
- Retrieval latency average: 331.4ms -> 346.3ms
- Retrieval latency p95: 439ms -> 460ms

Corpus phase timing aggregate:

- `evaluation-routing`: total avg 43.8ms, p95 67ms, lexical pool avg 6.1ms, exact avg 17.9ms, lexical avg 15.8ms, fusion avg 2.6ms
- `integrated-initial`: total avg 43.1ms, p95 73ms, lexical pool avg 1.9ms, exact avg 20.9ms, lexical avg 17.1ms, fusion avg 2.1ms
- `evaluation-base`: total avg 42.3ms, p95 57ms, lexical pool avg 6.9ms, exact avg 22.2ms, lexical avg 9.2ms, fusion avg 2.6ms
- `evaluation-direct-support`: total avg 17.3ms, p95 23ms, lexical pool avg 5.6ms, exact avg 5.3ms, lexical avg 4.0ms, fusion avg 1.3ms
- `evaluation-promoted-primary`: total avg 15.0ms, p95 21ms, lexical pool avg 6.5ms, exact avg 2.5ms, lexical avg 2.0ms, fusion avg 2.5ms
- `evaluation-primary-manual`: total avg 11.3ms, p95 15ms, lexical pool avg 6.5ms, exact avg 1.0ms, lexical avg 1.3ms, fusion avg 1.3ms

P2-30 phase timing 대비:

- `evaluation-routing` exact avg: 18.9ms -> 17.9ms
- `integrated-initial` exact avg: 21.7ms -> 20.9ms
- `evaluation-base` exact avg: 23.3ms -> 22.2ms

### cache benchmark 결과

현재 `.rag-cache/rag-cache-benchmark.json` 기준:

- Cases: 5
- Runs: 10
- Warm retrieval cache hits: 5/5
- Average cold total: 898.2ms
- Average warm total: 16.8ms
- Average speedup: 51.8x

Archive:

- `benchmarks/results/rag-cache-benchmark-2026-05-05T12-33-31-674Z.json`

### 해석

- 품질 지표는 유지되었다.
- exact phase 자체는 P2-30 대비 0.8~1.1ms 정도 낮아졌지만, 전체 case/retrieval latency는 run-to-run 변동 범위에서 오히려 증가했다.
- P2-23~P2-31의 누적 결과로 corpus phase는 P2-22의 266~327ms 수준에서 43ms 안팎까지 내려왔다.
- 현재 남은 17~22ms exact 비용은 후보별 scoring 의미 자체와 연결되어 있어, 더 줄이려면 recall/권위 chunk 보장 로직을 건드릴 가능성이 커진다.

### Phase 2 성능 micro-optimization 마무리 판단

P2-31 기준으로 Phase 2 계열 RAG 검색 성능 micro-optimization은 마무리한다.

근거:

- Top-3/Top-5/evidence/citation 품질 지표를 유지한 채 주요 corpus phase latency가 충분히 낮아졌다.
- P2-30과 P2-31은 구조적 정리 외에 전체 latency 개선으로 이어지지 않아 diminishing returns 구간에 들어섰다.
- 추가 성능 개선은 검색 루프 내부 미세 최적화보다 원 계획의 Phase 2 chunk policy, parent-child chunk, small-to-big retrieval 또는 Phase 4 DB lexical/vector 인프라 강화에서 다루는 편이 안전하다.

### 다음 작업

다음 후보는 성능 micro-optimization의 연장이 아니라 계획서 기준 Phase 2 본작업이다.

P2-32 후보: `문서유형별 chunk policy baseline 및 coverage test 도입`

권장 작업:

1. `src/lib/ragStructured.ts`의 현재 chunking 흐름을 읽고 문서유형별 policy 삽입 지점을 정한다.
2. `tests/ragStructuredCoverage.test.ts`에 Q&A pair, 법령 조문, 평가기준/확인방법, markdown table/list 보호 실패 테스트를 추가한다.
3. chunk 품질 report의 p50/p95/oversized/short-noisy 지표와 연결해 Phase 2 원 계획으로 전환한다.

---

## 2026-05-05 / P2-32 완료: chunk policy baseline 및 coverage test 도입

### 목표

P2-31에서 검색 루프 내부 성능 micro-optimization은 마무리했다. P2-32는 Phase 2 원 계획으로 전환해 문서유형별 chunk policy baseline을 만들고, Q&A pair, 평가기준/확인방법/관련근거, 법령 조문 boundary가 회귀하지 않도록 coverage test를 추가하는 것을 목표로 했다.

### TDD

추가 테스트:

- `tests/ragStructuredCoverage.test.ts`
  - `qa chunk policy keeps question and answer pairs together`
  - `evaluation chunk policy keeps criteria method and evidence blocks searchable`
  - `law chunk policy keeps article heading with body clauses`

RED 확인:

- `npx.cmd tsx --test tests/ragStructuredCoverage.test.ts`
- sandbox 실행은 기존과 동일하게 `tsx/esbuild spawn EPERM`으로 실패했고, escalated 실행에서 다음 실패를 확인했다.
  - Q&A 질문/답변 pair가 서로 다른 chunk로 분리됨.
  - chunk policy label이 없어 evaluation/law policy baseline을 관찰할 수 없음.

### 구현

변경 파일:

- `src/lib/ragStructured.ts`
  - `ChunkPolicyKind`, `ChunkPolicy`, `resolveChunkPolicy()` 추가.
  - sourceType/title/path 기준으로 `law`, `evaluation`, `qa`, `comparison`, `manual`, `general` policy를 resolve.
  - boundary reason을 `SectionBoundary`에 추가.
  - Q&A policy에서 `답변` boundary가 직전 `질문` section에 붙도록 `shouldAttachQaAnswerToQuestion()` 경로 추가.
  - chunk `matchedLabels`에 `chunk-policy:${policy.kind}`를 추가해 report/search/debug에서 정책을 관찰 가능하게 함.
- `tests/ragStructuredCoverage.test.ts`
- `docs/plans/rag-search-performance-progress.md`

### 검증

통과:

- `npx.cmd tsx --test tests/ragStructuredCoverage.test.ts`
  - 7 tests pass
- `npx.cmd tsx --test tests/ragStructuredCoverage.test.ts tests/ragDbLexical.test.ts tests/ragRerankPriority.test.ts tests/ragBenchmarkReport.test.ts tests/ragBenchmarkDiagnostics.test.ts tests/ragQualityReport.test.ts`
  - 35 tests pass
- `npm.cmd run lint`
- `npx.cmd tsc --noEmit`
- `npx.cmd tsc -p tsconfig.server.json --noEmit`
- `npm.cmd run rag:bench`
- `npm.cmd run rag:quality-report`
- `npm.cmd run rag:benchmark-diagnostics`
- `npm.cmd run rag:cache-benchmark`

참고:

- `npx.cmd tsx --test ...`, `npm.cmd run rag:quality-report`, `npm.cmd run rag:benchmark-diagnostics`, `npm.cmd run rag:cache-benchmark`는 sandbox 내 `tsx/esbuild spawn EPERM` 회피를 위해 escalated 실행으로 검증했다.

### benchmark 결과

`npm.cmd run rag:bench` 결과:

- Archive: `benchmarks/results/rag-benchmark-2026-05-05T13-00-08-735Z.json`
- Total cases: 27
- Top-3 doc recall: 96.3% (26/27)
- Top-5 doc recall: 96.3% (26/27)
- Expected evidence pass: 100.0% (27/27)
- Forbidden evidence pass: 100.0% (27/27)
- Required citation pass: 100.0% (27/27)

Latency:

- Total benchmark duration: 24,763ms
- Case latency average: 421.9ms
- Case latency p95: 886ms
- Retrieval latency average: 340.6ms
- Retrieval latency p95: 462ms

P2-31 대비:

- Total benchmark duration: 24,874ms -> 24,763ms
- Case latency average: 425.7ms -> 421.9ms
- Case latency p95: 880ms -> 886ms
- Retrieval latency average: 346.3ms -> 340.6ms
- Retrieval latency p95: 460ms -> 462ms

Corpus phase timing aggregate:

- `evaluation-routing`: total avg 43.7ms, p95 72ms, lexical pool avg 6.1ms, exact avg 18.3ms, lexical avg 14.8ms, fusion avg 2.3ms
- `integrated-initial`: total avg 43.1ms, p95 73ms, lexical pool avg 1.6ms, exact avg 20.6ms, lexical avg 17.3ms, fusion avg 1.8ms
- `evaluation-base`: total avg 41.0ms, p95 57ms, lexical pool avg 6.1ms, exact avg 23.1ms, lexical avg 8.1ms, fusion avg 2.4ms
- `evaluation-direct-support`: total avg 16.7ms, p95 24ms, lexical pool avg 5.1ms, exact avg 5.3ms, lexical avg 3.7ms, fusion avg 1.1ms
- `evaluation-promoted-primary`: total avg 13.5ms, p95 16ms, lexical pool avg 6.0ms, exact avg 2.0ms, lexical avg 2.0ms, fusion avg 3.0ms
- `evaluation-primary-manual`: total avg 11.0ms, p95 15ms, lexical pool avg 5.8ms, exact avg 1.3ms, lexical avg 1.0ms, fusion avg 1.3ms

### cache benchmark 결과

현재 `.rag-cache/rag-cache-benchmark.json` 기준:

- Cases: 5
- Runs: 10
- Warm retrieval cache hits: 5/5
- Average cold total: 878.6ms
- Average warm total: 16.8ms
- Average speedup: 51.4x

Archive:

- `benchmarks/results/rag-cache-benchmark-2026-05-05T13-01-09-842Z.json`

### 해석

- 품질 지표는 유지되었다.
- P2-32는 성능 최적화가 아니라 chunking 구조 전환의 baseline 단계이며, latency 변화는 run-to-run 변동 범위로 본다.
- Q&A pair 보호가 새 policy 경로에서 보장되며, evaluation/law policy label이 chunk matched labels에 남아 이후 diagnostics와 report 확장의 기반이 생겼다.

### 다음 작업

P2-33 후보: `chunk diagnostics에 policy/boundary/protected group 지표 노출`

권장 작업:

1. `buildStructuredChunks()` 또는 품질 리포트 경로에서 chunk policy, boundary reason, protected group 여부를 집계할 수 있도록 metadata를 확장한다.
2. `rag:quality-report`에 policy별 chunk count, oversized/short-noisy 비율, protected chunk count를 표시한다.
3. 이후 P2-34에서 parent-child chunk 또는 small-to-big retrieval 실험을 시작한다.

---

## 2026-05-05 / P2-33 완료: chunk policy diagnostics report 노출

### 목표

P2-32에서 chunk policy label baseline을 만들었으므로, P2-33은 chunk policy, boundary reason, protected group/checklist 여부를 품질 리포트에서 관찰 가능한 진단 지표로 노출하는 것을 목표로 했다.

### TDD

추가 테스트:

- `tests/ragQualityReport.test.ts`
  - `buildRagQualityReport summarizes chunk policy boundary and protected group diagnostics`

RED 확인:

- `npx.cmd tsx --test tests/ragQualityReport.test.ts`
- 최초 실패:
  - `report.chunkDiagnostics.byPolicy`가 없어 policy별 chunk/protected/oversized/boundary 집계가 불가능했다.

### 구현

변경 파일:

- `src/lib/ragTypes.ts`
  - `StructuredSection.boundaryReason` 추가.
- `src/lib/ragStructured.ts`
  - `document-root` boundary reason 추가.
  - section 생성 시 boundary reason을 유지.
  - chunk `matchedLabels`에 `chunk-boundary:${reason}`, `chunk-protected:group`, `chunk-protected:checklist`를 추가.
- `src/lib/ragQualityReport.ts`
  - quality report 입력에 `chunks` 추가.
  - policy별 chunk count, protected/checklist count, oversized/short-noisy count, boundary reason count를 집계.
  - markdown report의 chunk diagnostics에 `### By chunk policy` 섹션 추가.
- `scripts/rag-quality-report.ts`
  - `rag-index.json`의 `chunks`를 quality report 입력으로 전달.
- `tests/ragQualityReport.test.ts`
  - policy/boundary/protected/oversized 집계와 markdown 출력 회귀 테스트 추가.
- `docs/plans/rag-search-performance-progress.md`

### 검증

통과:

- `npx.cmd tsx --test tests/ragQualityReport.test.ts`
  - 4 tests pass
- `npx.cmd tsx --test tests/ragQualityReport.test.ts tests/ragStructuredCoverage.test.ts tests/ragDbLexical.test.ts tests/ragBenchmarkReport.test.ts tests/ragBenchmarkDiagnostics.test.ts`
  - 29 tests pass
- `npm.cmd run lint`
- `npx.cmd tsc --noEmit`
- `npx.cmd tsc -p tsconfig.server.json --noEmit`
- `npm.cmd run rag:index`
  - local cache에 13,799 chunks indexed
  - `.rag-cache/embeddings.json` 존재 확인: 224,182,700 bytes
  - 새 `rag-index.json`에 `chunk-policy:*`, `chunk-boundary:*`, `chunk-protected:*` label 생성 확인
- `npm.cmd run rag:bench`

2026-05-06 재검증 통과:

- `npm.cmd run rag:embedding-verify`
  - exit 0
  - `.rag-cache/rag-embedding-verify.json`, `docs/reports/rag-embedding-verify.md` 생성
  - Missing embeddings: 13,799/13,799, reason `embedding_api_key_missing`
- `npm.cmd run rag:quality-report`
  - exit 0
  - `.rag-cache/rag-quality-report.json`, `docs/reports/rag-quality-report.md` 생성
- `npm.cmd run rag:benchmark-diagnostics`
  - exit 0
  - `.rag-cache/rag-benchmark-diagnostics.json`, `docs/reports/rag-benchmark-diagnostics.md` 생성
  - Analyzed benchmark cases: 1
- `npm.cmd run rag:cache-benchmark`
  - exit 0
  - `.rag-cache/rag-cache-benchmark.json`, `docs/reports/rag-cache-benchmark.md` 생성
  - archive: `benchmarks/results/rag-cache-benchmark-2026-05-06T01-03-35-068Z.json`

### benchmark 결과

`npm.cmd run rag:bench` 결과:

- Archive: `benchmarks/results/rag-benchmark-2026-05-05T13-35-04-646Z.json`
- Total cases: 27
- Top-3 doc recall: 96.3% (26/27)
- Top-5 doc recall: 96.3% (26/27)
- Expected evidence pass: 100.0% (27/27)
- Forbidden evidence pass: 100.0% (27/27)
- Required citation pass: 100.0% (27/27)

Latency:

- Total benchmark duration: 26,840ms
- Case latency average: 428.3ms
- Case latency p95: 885ms
- Retrieval latency average: 347.4ms
- Retrieval latency p95: 468ms

P2-32 대비:

- Total benchmark duration: 24,763ms -> 26,840ms
- Case latency average: 421.9ms -> 428.3ms
- Case latency p95: 886ms -> 885ms
- Retrieval latency average: 340.6ms -> 347.4ms
- Retrieval latency p95: 462ms -> 468ms

### 해석

- P2-33의 구현 변경은 diagnostics/report path 중심이며 retrieval scoring 자체는 바꾸지 않는다.
- benchmark 품질 지표는 P2-32와 동일하게 유지되었다.
- latency는 run-to-run 변동 범위로 보며, chunk label 추가 자체가 검색 병목을 만들었다고 판단할 근거는 없다.
- `rag:index` 이후 실제 cache chunk에 policy/boundary/protected label이 생성되므로, `rag:quality-report`를 다시 실행하면 `### By chunk policy` 섹션이 report에 반영될 준비가 끝난 상태다.

### 다음 작업

P2-34 후보: `parent-child/small-to-big retrieval baseline diagnostics`

권장 작업:

1. chunk의 parent section/document 관계와 neighbor expansion 후보를 진단 가능한 metadata로 노출한다.
2. child chunk가 선택될 때 같은 parent의 인접 chunk를 evidence context에 포함할 수 있는 guarded 경로를 TDD로 추가한다.
3. 품질 회귀가 없으면 parent-child/small-to-big retrieval 실험을 benchmark diagnostics에 연결한다.

---

## 2026-05-06 / P2-34 완료: parent-child/small-to-big retrieval baseline diagnostics

### 목표

P2-34는 실제 evidence context 확장 로직을 바꾸기 전에, 현재 chunk corpus와 benchmark run에서 parent section 및 neighbor window 확장 여지가 얼마나 있는지 관찰 가능한 baseline diagnostics로 노출하는 것을 목표로 했다.

### TDD

추가 테스트:

- `tests/ragQualityReport.test.ts`
  - `buildRagQualityReport summarizes parent section and neighbor expansion baseline diagnostics`
- `tests/ragBenchmarkReport.test.ts`
  - `buildBenchmarkPerformanceSummary summarizes neighbor window expansion diagnostics`
- `tests/ragBenchmarkDiagnostics.test.ts`
  - benchmark diagnostics markdown에 neighbor window expansion 섹션 출력 검증 추가

RED 확인:

- `npx.cmd tsx --test tests/ragQualityReport.test.ts tests/ragBenchmarkReport.test.ts tests/ragBenchmarkDiagnostics.test.ts`
- 최초 실패:
  - `report.chunkDiagnostics.parentChild`가 없어 parent section/window 분포 집계가 불가능했다.
  - `performance.neighborWindowExpansion`이 없어 benchmark run의 previous/current/next window 수를 집계할 수 없었다.

### 구현

변경 파일:

- `src/lib/ragQualityReport.ts`
  - chunk 입력에서 `parentSectionId`, `parentSectionTitle`, `windowIndex`, `docTitle`, `path`를 읽도록 확장.
  - parent section 수, multi-window/isolated section 수, 평균/최대 chunks per parent section, neighbor-expandable chunk 수, neighbor candidate window 수, 상위 parent section 목록을 집계.
  - markdown report에 `### Parent-child baseline` 섹션 추가.
- `src/lib/ragBenchmarkReport.ts`
  - benchmark result 입력에 `neighborWindows` 추가.
  - previous/current/next window, selected evidence window, expansion candidate window, parent section count를 case별/전체로 집계.
- `src/lib/ragBenchmarkDiagnostics.ts`
  - benchmark diagnostics summary에 `neighborWindowExpansion` 추가.
  - markdown report에 `## Neighbor window expansion diagnostics` 섹션 추가.
- `scripts/rag-benchmark.ts`
  - `inspectRetrieval()`의 `neighborWindows`를 benchmark payload에 저장.
- `tests/ragQualityReport.test.ts`
- `tests/ragBenchmarkReport.test.ts`
- `tests/ragBenchmarkDiagnostics.test.ts`
- `docs/plans/rag-search-performance-progress.md`

### 검증

통과:

- `npx.cmd tsx --test tests/ragQualityReport.test.ts tests/ragBenchmarkReport.test.ts tests/ragBenchmarkDiagnostics.test.ts`
  - 14 tests pass
- `npx.cmd tsc --noEmit`
- `npx.cmd tsc -p tsconfig.server.json --noEmit`
- `npm.cmd run lint`
- `npm.cmd run rag:bench`
  - archive: `benchmarks/results/rag-benchmark-2026-05-06T01-33-38-733Z.json`
  - Top-3 doc recall: 96.3% (26/27)
  - Top-5 doc recall: 96.3% (26/27)
  - Expected evidence pass: 100.0% (27/27)
  - Forbidden evidence pass: 100.0% (27/27)
  - Required citation pass: 100.0% (27/27)
- `npm.cmd run rag:benchmark-diagnostics`
- `npm.cmd run rag:quality-report`
- `git diff --check`
  - exit 0, CRLF warning만 있음

### 결과

`docs/reports/rag-quality-report.md` 기준 parent-child baseline:

- Parent sections: 10,483
- Multi-window parent sections: 412
- Isolated parent sections: 10,071
- Average chunks per parent section: 1.3
- Max chunks per parent section: 296
- Neighbor-expandable chunks: 3,728
- Neighbor candidate windows: 6,632

`docs/reports/rag-benchmark-diagnostics.md` 기준 benchmark neighbor window expansion:

- Cases with diagnostics: 27
- Total windows: 527
- Selected evidence windows: 407
- Expansion candidate windows: 120
- Average expansion candidates: 4.4
- Current/previous/next windows: 407/44/76

### 해석

- 현재 corpus는 대부분 parent section당 chunk 1개지만, 412개 parent section은 multi-window 구조라 small-to-big 확장 후보가 존재한다.
- benchmark run에서는 모든 case에서 neighbor window diagnostics가 수집되며, previous/next candidate window가 총 120개 관찰되었다.
- retrieval scoring 및 evidence selection 로직은 변경하지 않았고, benchmark 품질 지표는 P2-33과 동일하게 유지되었다.

### 다음 작업

P2-35 후보: `guarded small-to-big evidence context expansion`

권장 작업:

1. selected evidence chunk의 previous/next neighbor를 answer context에만 제한적으로 포함하는 guarded 경로를 TDD로 추가한다.
2. citation/evidence balance가 흐트러지지 않도록 selected evidence와 context-only neighbor를 명확히 분리한다.
3. benchmark diagnostics의 neighbor expansion candidate가 실제 context inclusion으로 얼마나 전환되는지 집계한다.

---

## 2026-05-06 / P2-35 완료: guarded small-to-big evidence context expansion

### 목표

P2-35는 P2-34에서 관찰한 previous/next neighbor 후보를 실제 답변 context에 제한적으로 포함하되, citation evidence와 context-only neighbor를 분리해 evidence/citation 지표가 흔들리지 않도록 하는 것을 목표로 했다.

### TDD

추가 테스트:

- `tests/retrievalPipelineGate.test.ts`
  - `buildSmallToBigContextExpansion selects adjacent context windows without mutating evidence`
  - `buildSmallToBigContextExpansion reports guard skips when context caps are reached`
- `tests/expertAnswerNormalization.test.ts`
  - `buildExpertKnowledgeContext separates context-only neighbor chunks from citation evidence`
- `tests/ragBenchmarkReport.test.ts`
  - `buildBenchmarkPerformanceSummary summarizes small-to-big context inclusion traces`
- `tests/ragBenchmarkDiagnostics.test.ts`
  - diagnostics markdown의 small-to-big context inclusion 섹션 검증 추가

RED 확인:

- `npx.cmd tsx --test tests/retrievalPipelineGate.test.ts tests/expertAnswerNormalization.test.ts tests/ragBenchmarkReport.test.ts tests/ragBenchmarkDiagnostics.test.ts`
- 최초 실패:
  - `buildSmallToBigContextExpansion` export가 없었다.
  - `buildExpertKnowledgeContext()`가 context-only neighbor를 분리 출력하지 않았다.
  - benchmark performance/diagnostics에 small-to-big context inclusion summary가 없었다.

### 구현

변경 파일:

- `src/lib/retrievalPipeline.ts`
  - `buildSmallToBigContextExpansion()` 추가.
  - selected evidence와 같은 `documentId + parentSectionId`의 previous/next chunk만 context-only 후보로 선택.
  - `maxContextChunks`, `maxContextChars` guard로 context 확장량 제한.
  - selected evidence 배열은 변경하지 않고, 후보/포함/skip/char count를 반환.
- `src/lib/expertAnswering.ts`
  - `buildExpertKnowledgeContext()`에 `contextOnlyChunks` 입력 추가.
  - context-only neighbor는 `ContextOnlyId`로 표시하고 `EvidenceId`로 노출하지 않도록 분리.
- `src/lib/nodeRagService.ts`
  - `runRetrievalPlan()`에서 guarded small-to-big context expansion을 수행.
  - 기본 guard: `RAG_SMALL_TO_BIG_CONTEXT_MAX_CHUNKS` 없으면 6개, `RAG_SMALL_TO_BIG_CONTEXT_MAX_CHARS` 없으면 2,400자.
  - planner trace에 `small-to-big-context`를 기록.
- `src/lib/ragBenchmarkReport.ts`
  - planner trace의 `small-to-big-context`를 performance summary로 집계.
- `src/lib/ragBenchmarkDiagnostics.ts`
  - markdown report에 `## Small-to-big context inclusion diagnostics` 섹션 추가.
- `src/lib/ragQualityReport.ts`
  - benchmark performance section에 small-to-big context summary 추가.
- `tests/retrievalPipelineGate.test.ts`
- `tests/expertAnswerNormalization.test.ts`
- `tests/ragBenchmarkReport.test.ts`
- `tests/ragBenchmarkDiagnostics.test.ts`
- `docs/plans/rag-search-performance-progress.md`

### 검증

통과:

- `npx.cmd tsx --test tests/retrievalPipelineGate.test.ts tests/expertAnswerNormalization.test.ts tests/ragBenchmarkReport.test.ts tests/ragBenchmarkDiagnostics.test.ts`
  - 23 tests pass
- `npx.cmd tsc --noEmit`
- `npx.cmd tsc -p tsconfig.server.json --noEmit`
- `npm.cmd run lint`
- `npm.cmd run rag:bench`
  - archive: `benchmarks/results/rag-benchmark-2026-05-06T02-04-21-926Z.json`
  - Top-3 doc recall: 96.3% (26/27)
  - Top-5 doc recall: 96.3% (26/27)
  - Expected evidence pass: 100.0% (27/27)
  - Forbidden evidence pass: 100.0% (27/27)
  - Required citation pass: 100.0% (27/27)
- `npm.cmd run rag:benchmark-diagnostics`
- `npm.cmd run rag:quality-report`
- `npm.cmd run rag:cache-benchmark`
  - archive: `benchmarks/results/rag-cache-benchmark-2026-05-06T02-07-03-768Z.json`
- `git diff --check`
  - exit 0, CRLF warning만 있음

### 결과

`docs/reports/rag-quality-report.md` 기준:

- Neighbor window expansion: cases 27, candidate windows 120, avg candidates 4.4, current/previous/next 407/44/76
- Small-to-big context: cases 27, included/candidate 10/54, skipped 44, chars 14,177, inclusion rate 18.5%

`docs/reports/rag-benchmark-diagnostics.md` 기준:

- Cases with diagnostics: 27
- Included/candidate windows: 10/54
- Skipped windows: 44
- Included chars: 14,177
- Inclusion rate: 18.5%

### 해석

- context-only neighbor는 `EvidenceId`가 아니라 `ContextOnlyId`로 prompt에 들어가므로, citation evidence ID 집합과 분리된다.
- benchmark 품질 지표는 P2-34와 동일하게 유지되었다.
- 현재 guard는 char cap 때문에 후보 54개 중 10개만 포함한다. 후보가 많은 case는 skip이 발생하므로, 다음 단계에서는 inclusion priority를 조정할 여지가 있다.

### 다음 작업

P2-36 후보: `small-to-big context inclusion priority tuning`

권장 작업:

1. previous/next 후보를 단순 순회가 아니라 selected evidence score, sourceRole, chunk policy, boundary reason 기준으로 정렬한다.
2. context-only inclusion rate와 answer 품질 지표를 함께 비교해 cap 내에서 더 중요한 neighbor가 포함되도록 조정한다.
3. context-only chunk가 답변 근거처럼 과도하게 사용되는지 semantic validation 또는 citation sanitizer 쪽에서 추가 방어가 필요한지 확인한다.

---

## 2026-05-06 / P2-36 완료: small-to-big context inclusion priority tuning

### 목표

P2-35에서 guarded context-only neighbor expansion을 도입했지만, 후보를 evidence 순회 순서대로 담으면 cap이 작을 때 support/reference neighbor가 primary evaluation neighbor보다 먼저 포함될 수 있다. P2-36은 포함 총량을 늘리기보다 cap 안에서 더 중요한 neighbor가 먼저 들어가도록 priority를 조정하는 것을 목표로 했다.

### TDD

추가 테스트:

- `tests/retrievalPipelineGate.test.ts`
  - `buildSmallToBigContextExpansion prioritizes stronger neighbor context when caps are tight`

RED 확인:

- `npx.cmd tsx --test tests/retrievalPipelineGate.test.ts`
- 최초 실패:
  - `maxContextChunks: 1` 조건에서 먼저 순회된 support neighbor가 포함되고, 더 강한 primary evaluation neighbor가 skip되었다.

### 구현

변경 파일:

- `src/lib/retrievalPipeline.ts`
  - previous/next 후보를 먼저 수집한 뒤 priority 정렬 후 guard를 적용하도록 변경.
  - priority 기준:
    - neighbor `sourceRole`
    - anchor evidence `sourceRole`
    - neighbor `chunk-policy:*`, `chunk-protected:*` label
    - anchor evidence `rerankScore`
  - 동점이면 기존 evidence 순서와 previous/next 순서를 유지해 결과 안정성을 보존.
- `tests/retrievalPipelineGate.test.ts`
- `docs/plans/rag-search-performance-progress.md`

### 검증

통과:

- `npx.cmd tsx --test tests/retrievalPipelineGate.test.ts`
  - 12 tests pass
- `npx.cmd tsx --test tests/retrievalPipelineGate.test.ts tests/expertAnswerNormalization.test.ts tests/ragBenchmarkReport.test.ts tests/ragBenchmarkDiagnostics.test.ts`
  - 24 tests pass
- `npx.cmd tsc --noEmit`
- `npx.cmd tsc -p tsconfig.server.json --noEmit`
- `npm.cmd run lint`
- `npm.cmd run rag:bench`
  - archive: `benchmarks/results/rag-benchmark-2026-05-06T02-18-10-935Z.json`
  - Top-3 doc recall: 96.3% (26/27)
  - Top-5 doc recall: 96.3% (26/27)
  - Expected evidence pass: 100.0% (27/27)
  - Forbidden evidence pass: 100.0% (27/27)
  - Required citation pass: 100.0% (27/27)
- `npm.cmd run rag:benchmark-diagnostics`
- `npm.cmd run rag:quality-report`
- `npm.cmd run rag:cache-benchmark`
  - archive: `benchmarks/results/rag-cache-benchmark-2026-05-06T02-20-05-596Z.json`

### 결과

`docs/reports/rag-quality-report.md` 기준:

- Small-to-big context: cases 27, included/candidate 10/54, skipped 44, chars 14,177, inclusion rate 18.5%
- Top-3/Top-5/evidence/citation 품질 지표는 유지되었다.

### 해석

- P2-36은 inclusion count를 늘리지 않고, 동일 cap에서 포함 우선순위를 개선하는 변경이다.
- 현재 inclusion rate 병목은 priority보다 `maxContextChars=2400`, `maxContextChunks=6` guard의 영향이 크다.
- 다음 단계에서 cap tuning 또는 candidate text trimming을 실험해야 inclusion count 개선을 볼 수 있다.

### 다음 작업

P2-37 후보: `small-to-big context cap and trimming experiment`

권장 작업:

1. context-only neighbor를 full text로 넣지 않고 textPreview 또는 bounded excerpt로 넣는 옵션을 TDD로 추가한다.
2. `maxContextChars`를 늘리는 방식과 excerpt trimming 방식의 inclusion rate/latency/품질 지표를 비교한다.
3. 품질 지표가 유지되면 기본 guard를 더 많은 case에서 context-only neighbor가 들어가도록 조정한다.

---

## 2026-05-06 / P2-37 완료: small-to-big context cap and trimming experiment

### 목표

P2-36 후에도 small-to-big context inclusion은 10/54, 18.5%에 머물렀다. 병목은 priority보다 full text neighbor가 `maxContextChars=2400` guard를 빠르게 소진하는 점이었다. P2-37은 context-only neighbor를 citation evidence가 아닌 answer-context excerpt로 보고, chunk별 bounded excerpt를 적용해 inclusion rate를 높이는 것을 목표로 했다.

### TDD

추가 테스트:

- `tests/retrievalPipelineGate.test.ts`
  - `buildSmallToBigContextExpansion trims long context-only neighbors before applying char caps`

RED 확인:

- `npx.cmd tsx --test tests/retrievalPipelineGate.test.ts`
- 최초 실패:
  - 긴 neighbor text가 그대로 char cap에 걸려 포함되지 않았다.

### 구현

변경 파일:

- `src/lib/retrievalPipeline.ts`
  - `SmallToBigContextExpansionOptions.maxContextChunkChars` 추가.
  - context-only neighbor를 원본 chunk mutate 없이 복제한 뒤 bounded excerpt로 절단.
  - 절단된 context chunk 기준으로 `includedCharCount`와 guard를 계산.
- `src/lib/nodeRagService.ts`
  - `RAG_SMALL_TO_BIG_CONTEXT_MAX_CHUNK_CHARS` 환경변수 추가.
  - 기본값은 700자.
- `tests/retrievalPipelineGate.test.ts`
- `docs/plans/rag-search-performance-progress.md`

### 검증

통과:

- `npx.cmd tsx --test tests/retrievalPipelineGate.test.ts`
  - 13 tests pass
- `npx.cmd tsx --test tests/retrievalPipelineGate.test.ts tests/expertAnswerNormalization.test.ts tests/ragBenchmarkReport.test.ts tests/ragBenchmarkDiagnostics.test.ts`
  - 25 tests pass
- `npm.cmd run lint`
- `npm.cmd run rag:bench`
  - archive: `benchmarks/results/rag-benchmark-2026-05-06T02-29-22-954Z.json`
  - Top-3 doc recall: 96.3% (26/27)
  - Top-5 doc recall: 96.3% (26/27)
  - Expected evidence pass: 100.0% (27/27)
  - Forbidden evidence pass: 100.0% (27/27)
  - Required citation pass: 100.0% (27/27)
- `npm.cmd run rag:benchmark-diagnostics`
- `npm.cmd run rag:quality-report`
- `npm.cmd run rag:cache-benchmark`
  - archive: `benchmarks/results/rag-cache-benchmark-2026-05-06T02-31-47-434Z.json`

### 결과

`docs/reports/rag-quality-report.md` 기준:

- P2-36: included/candidate 10/54, skipped 44, chars 14,177, inclusion rate 18.5%
- P2-37: included/candidate 40/54, skipped 14, chars 27,772, inclusion rate 74.1%

품질 지표:

- Top-3 doc recall: 96.3%
- Top-5 doc recall: 96.3%
- Expected evidence pass: 100.0%
- Forbidden evidence pass: 100.0%
- Required citation pass: 100.0%

Latency:

- `rag:bench` case latency average 779.4ms, p95 1,565ms.
- `rag:cache-benchmark`는 exit 0이지만 이번 cold run은 `evaluation-day-night-care-disliked-foods` 11,981ms 등 이전보다 느린 케이스가 있었다. context trimming 자체보다는 run-to-run/cold path 변동 가능성이 있으나, P2-38에서 별도 확인이 필요하다.

### 해석

- bounded excerpt 방식은 context-only inclusion을 크게 개선했다.
- citation evidence는 그대로 유지되며 context-only neighbor는 `ContextOnlyId`로 분리되어 있다.
- inclusion chars는 늘었지만 benchmark 품질 지표는 유지되었다.

### 다음 작업

P2-38 후보: `small-to-big context latency and answer-safety validation`

권장 작업:

1. cache benchmark cold path 변동이 context-only excerpt 증가와 관련 있는지 반복 측정한다.
2. context-only chunk가 citation evidence처럼 사용되지 않는지 answer synthesis sanitizer/validation 테스트를 추가한다.
3. 필요하면 context-only neighbor cap을 mode/sourceRole별로 다르게 적용한다.

---

## 2026-05-06 / P2-38 완료: small-to-big context latency and answer-safety validation

### 목표

P2-37에서 context-only inclusion rate를 74.1%까지 높였으므로, P2-38은 context-only chunk가 citation evidence로 오염되지 않는지 확인하고, 직전 cache benchmark cold path spike가 지속되는지 반복 측정하는 것을 목표로 했다.

### TDD / 안전성 테스트

추가 테스트:

- `tests/expertAnswerNormalization.test.ts`
  - `synthesizeExpertAnswer rejects context-only ids returned as citations`

검증 내용:

- knowledge context에는 `EvidenceId: evidence-1`과 `ContextOnlyId: neighbor-1`이 함께 존재한다.
- 모델 응답이 `neighbor-1`을 citation, groundedBasis, practicalInterpretation, block item citationIds에 넣어도 sanitizer가 제거한다.
- 최종 `answer.citations`는 실제 selected evidence ID만 유지한다.

### 구현

별도 production code 변경은 필요하지 않았다. 기존 `normalizeCitations()`, `sanitizeCitationIds()`, `allowedCitationIds` 경로가 context-only ID를 이미 차단하고 있었고, 이번 단계에서는 이를 regression test로 고정했다.

변경 파일:

- `tests/expertAnswerNormalization.test.ts`
- `docs/plans/rag-search-performance-progress.md`

### 검증

통과:

- `npx.cmd tsx --test tests/expertAnswerNormalization.test.ts`
  - 3 tests pass
- `npm.cmd run rag:cache-benchmark`
  - archive: `benchmarks/results/rag-cache-benchmark-2026-05-06T02-38-12-883Z.json`
- `npm.cmd run lint`
- `git diff --check`
  - exit 0, CRLF warning만 있음

### 결과

반복 cache benchmark:

- `evaluation-day-night-care-disliked-foods`: cold 3,010ms, cache hit 13ms
- `evaluation-notice-period`: cold 1,986ms, cache hit 33ms
- `evaluation-rights-required-colloquial`: cold 1,335ms, cache hit 9ms
- `integrated-no-grounded-answer`: cold 623ms, cache hit 17ms
- `integrated-workforce-standard`: cold 728ms, cache hit 13ms

### 해석

- P2-37 직후 관찰된 11.9s cold spike는 반복 측정에서 재현되지 않았다.
- context-only neighbor는 prompt에는 포함되지만 citation sanitizer 기준의 허용 evidence ID에는 포함되지 않는다.
- small-to-big context 확장은 현재 citation/evidence contamination 없이 유지된다.

### 다음 작업

P2-39 후보: `small-to-big context source/mode-specific guard tuning`

권장 작업:

1. evaluation mode와 integrated mode의 context-only cap을 분리해 latency와 inclusion rate를 비교한다.
2. sourceRole이 `primary_evaluation`인 neighbor에는 더 높은 cap을, `support_reference`에는 낮은 cap을 적용하는 guard를 실험한다.
3. cap 변경 후 benchmark 품질 지표와 cache benchmark cold/hit latency를 함께 기록한다.

---

## 2026-05-06 / P2-39 완료: small-to-big context source/mode-specific guard tuning

### 목표

P2-37에서 bounded excerpt로 inclusion rate를 74.1%까지 올렸지만, 모든 sourceRole에 동일한 700자 cap을 적용하고 있었다. P2-39는 primary evaluation neighbor에는 더 긴 excerpt를 허용하고 support reference neighbor는 더 짧게 제한해, 같은 전체 context cap 안에서 inclusion rate와 authority balance를 개선하는 것을 목표로 했다.

### TDD

추가 테스트:

- `tests/retrievalPipelineGate.test.ts`
  - `buildSmallToBigContextExpansion applies source-role specific context excerpt caps`

RED 확인:

- `npx.cmd tsx --test tests/retrievalPipelineGate.test.ts`
- 최초 실패:
  - `maxContextChunkCharsBySourceRole` 옵션이 없어 primary/support neighbor가 동일한 700자 cap으로 절단되었다.

### 구현

변경 파일:

- `src/lib/retrievalPipeline.ts`
  - `SmallToBigContextExpansionOptions.maxContextChunkCharsBySourceRole` 추가.
  - context-only neighbor 절단 시 sourceRole별 cap을 우선 적용하고, 없으면 `maxContextChunkChars` fallback 사용.
- `src/lib/nodeRagService.ts`
  - `RAG_SMALL_TO_BIG_CONTEXT_PRIMARY_CHUNK_CHARS` 추가, 기본 900자.
  - `RAG_SMALL_TO_BIG_CONTEXT_SUPPORT_CHUNK_CHARS` 추가, 기본 500자.
  - helper 호출 시 `primary_evaluation`, `support_reference` role별 cap 전달.
- `tests/retrievalPipelineGate.test.ts`
- `docs/plans/rag-search-performance-progress.md`

### 검증

통과:

- `npx.cmd tsx --test tests/retrievalPipelineGate.test.ts`
  - 14 tests pass
- `npx.cmd tsx --test tests/retrievalPipelineGate.test.ts tests/expertAnswerNormalization.test.ts tests/ragBenchmarkReport.test.ts tests/ragBenchmarkDiagnostics.test.ts`
  - 27 tests pass
- `npm.cmd run lint`
- `npm.cmd run rag:bench`
  - archive: `benchmarks/results/rag-benchmark-2026-05-06T02-49-32-268Z.json`
  - Top-3 doc recall: 96.3% (26/27)
  - Top-5 doc recall: 96.3% (26/27)
  - Expected evidence pass: 100.0% (27/27)
  - Forbidden evidence pass: 100.0% (27/27)
  - Required citation pass: 100.0% (27/27)
- `npm.cmd run rag:benchmark-diagnostics`
- `npm.cmd run rag:quality-report`
- `npm.cmd run rag:cache-benchmark`
  - archive: `benchmarks/results/rag-cache-benchmark-2026-05-06T02-50-52-580Z.json`
- `git diff --check`
  - exit 0, CRLF warning만 있음

### 결과

`docs/reports/rag-quality-report.md` 기준:

- P2-37: included/candidate 40/54, skipped 14, chars 27,772, inclusion rate 74.1%
- P2-39: included/candidate 45/54, skipped 9, chars 24,631, inclusion rate 83.3%

Latency:

- `rag:bench` case latency average 768.3ms, p95 1,740ms.
- `rag:cache-benchmark` cold path:
  - `evaluation-day-night-care-disliked-foods`: 2,723ms, hit 10ms
  - `evaluation-rights-required-colloquial`: 1,802ms, hit 31ms
  - `evaluation-notice-period`: 1,783ms, hit 29ms
  - `integrated-eligibility-law`: 752ms, hit 8ms
  - `integrated-integrated-homecare-manual`: 625ms, hit 16ms

### 해석

- sourceRole별 cap은 inclusion count를 40개에서 45개로 늘리면서 total included chars는 줄였다.
- 품질 지표는 유지되었다.
- 남은 skipped 9개는 전체 context cap 또는 max chunk count cap 영향으로 보인다.

### 다음 작업

P2-40 후보: `small-to-big remaining skip diagnostics`

권장 작업:

1. small-to-big context trace에 skip reason(`maxContextChunks`, `maxContextChars`)별 count를 추가한다.
2. skipped case 상위 목록을 benchmark diagnostics에 노출해 어떤 cap이 남은 병목인지 확인한다.
3. 그 결과에 따라 cap 증가, role별 cap 조정, 또는 case별 adaptive cap을 결정한다.

---

## 2026-05-06 / P2-40 완료: small-to-big remaining skip diagnostics

### 목표

P2-39 이후 small-to-big context inclusion은 45/54, 83.3%까지 개선됐지만 skipped 9개의 원인이 `maxContextChunks`인지 `maxContextChars`인지 분리되지 않았다. P2-40은 남은 병목을 추측하지 않도록 trace, benchmark diagnostics, quality report에 skip reason count를 노출하는 것을 목표로 했다.

### TDD

추가/수정 테스트:

- `tests/retrievalPipelineGate.test.ts`
  - max chunk guard와 max char guard가 각각 `skippedByMaxChunksCount`, `skippedByMaxCharsCount`로 집계되는지 검증.
- `tests/ragBenchmarkReport.test.ts`
  - `small-to-big-context` trace detail에서 `skippedByMaxChunks`, `skippedByMaxChars`를 파싱하고 summary/case에 반영하는지 검증.
- `tests/ragBenchmarkDiagnostics.test.ts`
  - diagnostics markdown에 skip reason totals와 case별 chunk/char skip count가 출력되는지 검증.

RED 확인:

- `npx.cmd tsx --test tests/retrievalPipelineGate.test.ts tests/ragBenchmarkReport.test.ts tests/ragBenchmarkDiagnostics.test.ts`
- 최초 실패:
  - `SmallToBigContextExpansion`에 skip reason별 count가 없었다.
  - planner trace와 benchmark summary가 `skipped` total만 제공했다.
  - diagnostics markdown에 chunk cap/char cap 분리가 없었다.

### 구현

변경 파일:

- `src/lib/retrievalPipeline.ts`
  - `SmallToBigContextExpansion`에 `skippedByMaxChunksCount`, `skippedByMaxCharsCount` 추가.
  - context-only neighbor guard에서 chunk cap 초과와 char cap 초과를 별도 집계.
- `src/lib/nodeRagService.ts`
  - `small-to-big-context` planner trace detail에 `skippedByMaxChunks`, `skippedByMaxChars` 추가.
- `src/lib/ragBenchmarkReport.ts`
  - small-to-big context summary와 case summary에 skip reason별 count 추가.
- `src/lib/ragBenchmarkDiagnostics.ts`
  - `Small-to-big context inclusion diagnostics`에 skip reason total 및 case별 breakdown 출력.
- `src/lib/ragQualityReport.ts`
  - benchmark performance line에 `skipped N (chunks X, chars Y)` 형식 추가.
- `tests/retrievalPipelineGate.test.ts`
- `tests/ragBenchmarkReport.test.ts`
- `tests/ragBenchmarkDiagnostics.test.ts`
- `docs/plans/rag-search-performance-progress.md`

### 검증

통과:

- `npx.cmd tsx --test tests/retrievalPipelineGate.test.ts tests/ragBenchmarkReport.test.ts tests/ragBenchmarkDiagnostics.test.ts`
  - 25 tests pass
- `npx.cmd tsx --test tests/retrievalPipelineGate.test.ts tests/expertAnswerNormalization.test.ts tests/ragBenchmarkReport.test.ts tests/ragBenchmarkDiagnostics.test.ts tests/ragQualityReport.test.ts`
  - 33 tests pass
- `npm.cmd run lint`
- `npm.cmd run rag:bench`
  - archive: `benchmarks/results/rag-benchmark-2026-05-06T03-05-05-839Z.json`
  - Top-3 doc recall: 96.3% (26/27)
  - Top-5 doc recall: 96.3% (26/27)
  - Expected evidence pass: 100.0% (27/27)
  - Forbidden evidence pass: 100.0% (27/27)
  - Required citation pass: 100.0% (27/27)
- `npm.cmd run rag:benchmark-diagnostics`
- `npm.cmd run rag:quality-report`
- `npm.cmd run rag:cache-benchmark`
  - archive: `benchmarks/results/rag-cache-benchmark-2026-05-06T03-07-32-192Z.json`
- `git diff --check`
  - exit 0, CRLF warning만 있음

### 결과

`docs/reports/rag-quality-report.md` 기준:

- Small-to-big context: cases 27, included/candidate 45/54, skipped 9 (chunks 0, chars 9), chars 24,631, inclusion rate 83.3%

`docs/reports/rag-benchmark-diagnostics.md` 기준:

- Skip reasons: max chunks 0, max chars 9

Latency:

- `rag:bench` case latency average 856.4ms, p50 654ms, p95 1,899ms, max 4,308ms.
- retrieval latency average 682.8ms, p50 639ms, p95 969ms, max 1,246ms.
- `rag:cache-benchmark` cold/hit:
  - `evaluation-day-night-care-disliked-foods`: 4,452ms / 19ms
  - `evaluation-rights-required-colloquial`: 1,849ms / 15ms
  - `evaluation-notice-period`: 1,593ms / 12ms
  - `integrated-eligibility-law`: 865ms / 16ms
  - `integrated-long-service-faq`: 642ms / 11ms

### 해석

- 남은 skipped 9개는 전부 `maxContextChars` 때문이다.
- `maxContextChunks`는 현재 병목이 아니므로 chunk count cap을 올려도 inclusion은 개선되지 않는다.
- 다음 조정은 전체 context char budget 증가, sourceRole별 excerpt cap 재조정, 또는 high-authority case에만 적용되는 adaptive char budget 중 하나로 좁혀졌다.

### 다음 작업

P2-41 후보: `small-to-big adaptive char budget tuning`

권장 작업:

1. 남은 skip이 발생하는 case/sourceRole을 diagnostics에서 확인한다.
2. global `RAG_SMALL_TO_BIG_CONTEXT_MAX_CHARS`를 무작정 올리기보다, `primary_evaluation` 또는 high rerank score anchor에 한정된 adaptive char budget을 TDD로 실험한다.
3. inclusion rate, prompt char 증가량, benchmark 품질 지표, cache benchmark cold path를 함께 비교한다.

---

## 2026-05-06 / P2-41 완료: small-to-big adaptive char budget tuning

### 목표

P2-40 결과 남은 skip 9개는 모두 `maxContextChars` 때문이었다. P2-41은 global context budget을 무작정 올리지 않고, `primary_evaluation` evidence anchor가 있는 경우에만 small-to-big context total char budget을 확장해 inclusion 개선 폭과 latency 영향을 확인하는 것을 목표로 했다.

### TDD

추가 테스트:

- `tests/retrievalPipelineGate.test.ts`
  - `buildSmallToBigContextExpansion applies source-role specific total char budgets for authority anchors`

RED 확인:

- `npx.cmd tsx --test tests/retrievalPipelineGate.test.ts`
- 최초 실패:
  - `maxContextCharsByAnchorSourceRole` 옵션이 없어 primary evaluation anchor의 total context budget이 기본 `maxContextChars`에 묶였다.

### 구현

변경 파일:

- `src/lib/retrievalPipeline.ts`
  - `SmallToBigContextExpansionOptions.maxContextCharsByAnchorSourceRole` 추가.
  - selected evidence anchor의 `sourceRole`에 맞는 total char budget이 있으면 기본 `maxContextChars`보다 큰 값을 적용.
- `src/lib/nodeRagService.ts`
  - `RAG_SMALL_TO_BIG_CONTEXT_PRIMARY_MAX_CHARS` 추가, 기본 3,200자.
  - `primary_evaluation` anchor에만 adaptive total char budget 전달.
- `tests/retrievalPipelineGate.test.ts`
- `docs/plans/rag-search-performance-progress.md`

### 검증

통과:

- `npx.cmd tsx --test tests/retrievalPipelineGate.test.ts`
  - 16 tests pass
- `npx.cmd tsx --test tests/retrievalPipelineGate.test.ts tests/expertAnswerNormalization.test.ts tests/ragBenchmarkReport.test.ts tests/ragBenchmarkDiagnostics.test.ts tests/ragQualityReport.test.ts`
  - 34 tests pass
- `npx.cmd tsc --noEmit`
- `npx.cmd tsc -p tsconfig.server.json --noEmit`
- `npm.cmd run lint`
- `npm.cmd run rag:bench`
  - archive: `benchmarks/results/rag-benchmark-2026-05-06T03-27-37-181Z.json`
  - Top-3 doc recall: 96.3% (26/27)
  - Top-5 doc recall: 96.3% (26/27)
  - Expected evidence pass: 100.0% (27/27)
  - Forbidden evidence pass: 100.0% (27/27)
  - Required citation pass: 100.0% (27/27)
- `npm.cmd run rag:benchmark-diagnostics`
- `npm.cmd run rag:quality-report`
- `npm.cmd run rag:cache-benchmark`
  - archive: `benchmarks/results/rag-cache-benchmark-2026-05-06T03-29-14-611Z.json`
- `git diff --check`
  - exit 0, CRLF warning만 있음

### 결과

`docs/reports/rag-quality-report.md` 기준:

- P2-40: included/candidate 45/54, skipped 9 (chunks 0, chars 9), chars 24,631, inclusion rate 83.3%
- P2-41: included/candidate 47/54, skipped 7 (chunks 1, chars 6), chars 25,636, inclusion rate 87.0%

품질:

- Top-3/Top-5 doc recall: 96.3% / 96.3%
- Expected evidence / forbidden evidence / required citation: 100.0% / 100.0% / 100.0%

Latency:

- `rag:bench` case latency average 1,220ms, p50 998ms, p95 2,309ms, max 5,464ms.
- retrieval latency average 989.2ms, p50 975ms, p95 1,482ms, max 1,652ms.
- `rag:cache-benchmark` cold/hit:
  - `evaluation-day-night-care-disliked-foods`: 3,478ms / 16ms
  - `evaluation-notice-period`: 2,001ms / 15ms
  - `evaluation-rights-required-colloquial`: 2,072ms / 22ms
  - `integrated-eligibility-law`: 1,214ms / 19ms
  - `integrated-no-grounded-answer`: 1,111ms / 26ms

### 해석

- 제한적 adaptive budget으로 inclusion rate가 83.3%에서 87.0%로 개선됐다.
- 품질 지표는 유지됐지만 `rag:bench` latency는 직전보다 상승했다. small-to-big context가 prompt 크기를 늘리는 영향일 수 있어 다음 단계에서 skip case와 slow case를 함께 봐야 한다.
- char cap skip이 9개에서 6개로 줄었고, 새로 `maxContextChunks` skip 1개가 드러났다.
- 현재 diagnostics case list는 0/0 케이스를 먼저 보여 실제 skipped case를 바로 확인하기 어렵다.

### 다음 작업

P2-42 후보: `small-to-big skipped case diagnostics ordering`

권장 작업:

1. small-to-big diagnostics case list를 skipped count와 candidate count 기준으로 정렬해 실제 병목 케이스를 먼저 보여준다.
2. 필요하면 `skippedByMaxChunks`, `skippedByMaxChars`, `includedChars` 기준 top list를 별도로 노출한다.
3. 그 결과를 보고 remaining char cap 조정과 chunk cap 조정을 분리해 결정한다.

---

## 2026-05-06 / P2-42 완료: small-to-big skipped case diagnostics ordering

### 목표

P2-41 이후 diagnostics summary 자체는 `skipped 7 (chunks 1, chars 6)`을 보여줬지만, case list는 0/0 케이스를 먼저 표시해 실제 병목 케이스를 바로 볼 수 없었다. P2-42는 small-to-big diagnostics case list를 skipped 병목 우선으로 정렬해 다음 tuning 대상을 명확히 하는 것을 목표로 했다.

### TDD

수정 테스트:

- `tests/ragBenchmarkReport.test.ts`
  - `buildBenchmarkPerformanceSummary summarizes small-to-big context inclusion traces`
  - 후보가 없는 0/0 케이스와 skipped 케이스가 함께 있을 때 skipped 케이스가 먼저 나오도록 기대값 수정.

RED 확인:

- `npx.cmd tsx --test tests/ragBenchmarkReport.test.ts`
- 최초 실패:
  - 기존 정렬이 `includedWindows` 오름차순을 먼저 적용해 `case-no-candidates`가 실제 skipped case보다 앞에 왔다.

### 구현

변경 파일:

- `src/lib/ragBenchmarkReport.ts`
  - small-to-big context case summary 정렬을 다음 우선순위로 변경:
    - `skippedWindows` 내림차순
    - `skippedByMaxChars` 내림차순
    - `skippedByMaxChunks` 내림차순
    - `candidateWindows` 내림차순
    - `includedWindows` 오름차순
    - `id` 오름차순
- `tests/ragBenchmarkReport.test.ts`
- `docs/plans/rag-search-performance-progress.md`

### 검증

통과:

- `npx.cmd tsx --test tests/ragBenchmarkReport.test.ts tests/ragBenchmarkDiagnostics.test.ts`
  - 10 tests pass
- `npx.cmd tsc --noEmit`
- `npm.cmd run lint`
- `npm.cmd run rag:bench`
  - archive: `benchmarks/results/rag-benchmark-2026-05-06T03-45-53-742Z.json`
  - Top-3 doc recall: 96.3% (26/27)
  - Top-5 doc recall: 96.3% (26/27)
  - Expected evidence pass: 100.0% (27/27)
  - Forbidden evidence pass: 100.0% (27/27)
  - Required citation pass: 100.0% (27/27)
- `npm.cmd run rag:benchmark-diagnostics`
- `npm.cmd run rag:quality-report`
- `git diff --check`
  - exit 0, CRLF warning만 있음

### 결과

`docs/reports/rag-benchmark-diagnostics.md` 기준 small-to-big 병목 case list:

- `integrated-evaluation-doc-not-penalized`: included 4/6, skipped 2 (chunks 0, chars 2), chars 2,012
- `integrated-law-alias-article-variant`: included 4/6, skipped 2 (chunks 0, chars 2), chars 2,011
- `integrated-eligibility-law`: included 4/5, skipped 1 (chunks 0, chars 1), chars 2,012
- `integrated-payroll-ratio-qa`: included 4/5, skipped 1 (chunks 0, chars 1), chars 2,012
- `integrated-workforce-standard`: included 6/7, skipped 1 (chunks 1, chars 0), chars 3,017

`docs/reports/rag-quality-report.md` 기준:

- Small-to-big context: cases 27, included/candidate 47/54, skipped 7 (chunks 1, chars 6), chars 25,636, inclusion rate 87.0%
- Case latency: avg 1,195.2ms, p95 2,450ms.
- Retrieval latency: avg 983.3ms, p95 1,366ms.

### 해석

- 남은 char skip 6개는 integrated 계열 case에 집중된다.
- P2-41에서 primary evaluation total budget을 늘린 뒤에는 integrated/support 계열의 2,400자 total cap이 다음 병목으로 드러났다.
- chunk skip 1개는 `integrated-workforce-standard`에서 발생하지만, next chunk를 넣으려면 chunk cap뿐 아니라 total char cap도 같이 볼 필요가 있다.

### 다음 작업

P2-43 후보: `integrated/support small-to-big char budget tuning`

권장 작업:

1. `support_reference` anchor에만 낮은 폭의 adaptive total char budget을 추가해 integrated char skip을 줄인다.
2. 기본 2,400자에서 2,600자 정도의 좁은 증가로 시작해 inclusion과 latency 영향을 비교한다.
3. 품질 지표가 유지되고 latency 상승이 과하면 더 낮은 값이나 case별 제한으로 되돌린다.

---

## 2026-05-06 / P2-43 완료: integrated/support small-to-big char budget tuning

### 목표

P2-42에서 남은 char skip 6개가 integrated 계열 case에 집중되는 것을 확인했다. P2-43은 `support_reference` anchor에만 낮은 폭의 adaptive total char budget을 적용해 integrated char skip을 줄이되, citation/evidence 지표가 유지되는지 확인하는 것을 목표로 했다.

### 구현

변경 파일:

- `src/lib/nodeRagService.ts`
  - `RAG_SMALL_TO_BIG_CONTEXT_SUPPORT_MAX_CHARS` 추가, 기본 2,600자.
  - `maxContextCharsByAnchorSourceRole.support_reference`에 해당 값을 전달.
- `docs/plans/rag-search-performance-progress.md`

P2-41에서 `maxContextCharsByAnchorSourceRole` 동작은 이미 `tests/retrievalPipelineGate.test.ts`로 고정되어 있어, 이번 단계는 config/default tuning으로 진행했다.

### 검증

통과:

- `npm.cmd run lint`
- `npx.cmd tsx --test tests/retrievalPipelineGate.test.ts tests/ragBenchmarkReport.test.ts tests/ragBenchmarkDiagnostics.test.ts`
  - 26 tests pass
- `npm.cmd run rag:bench`
  - archive: `benchmarks/results/rag-benchmark-2026-05-06T03-56-17-101Z.json`
  - Top-3 doc recall: 96.3% (26/27)
  - Top-5 doc recall: 96.3% (26/27)
  - Expected evidence pass: 100.0% (27/27)
  - Forbidden evidence pass: 100.0% (27/27)
  - Required citation pass: 100.0% (27/27)
- `npm.cmd run rag:benchmark-diagnostics`
- `npm.cmd run rag:quality-report`
- `npm.cmd run rag:cache-benchmark`
  - archive: `benchmarks/results/rag-cache-benchmark-2026-05-06T03-58-24-017Z.json`
- `git diff --check`
  - exit 0, CRLF warning만 있음

### 결과

`docs/reports/rag-quality-report.md` 기준:

- P2-42/P2-41: included/candidate 47/54, skipped 7 (chunks 1, chars 6), chars 25,636, inclusion rate 87.0%
- P2-43: included/candidate 51/54, skipped 3 (chunks 1, chars 2), chars 27,647, inclusion rate 94.4%

small-to-big 병목 case:

- `integrated-evaluation-doc-not-penalized`: included 5/6, skipped 1 (chunks 0, chars 1), chars 2,514
- `integrated-law-alias-article-variant`: included 5/6, skipped 1 (chunks 0, chars 1), chars 2,514
- `integrated-workforce-standard`: included 6/7, skipped 1 (chunks 1, chars 0), chars 3,017
- `integrated-eligibility-law`: included 5/5, skipped 0, chars 2,515
- `integrated-payroll-ratio-qa`: included 5/5, skipped 0, chars 2,515

품질:

- Top-3/Top-5 doc recall: 96.3% / 96.3%
- Expected evidence / forbidden evidence / required citation: 100.0% / 100.0% / 100.0%

Latency:

- `rag:bench` case latency average 1,289.7ms, p50 1,184ms, p95 3,267ms, max 4,589ms.
- retrieval latency average 1,102.7ms, p50 1,100ms, p95 1,772ms, max 1,772ms.
- `rag:cache-benchmark` cold/hit:
  - `evaluation-day-night-care-disliked-foods`: 5,063ms / 36ms
  - `evaluation-notice-period`: 3,031ms / 30ms
  - `evaluation-employee-rights-education`: 1,401ms / 37ms
  - `evaluation-rights-required-colloquial`: 1,851ms / 24ms
  - `evaluation-function-training`: 1,048ms / 30ms

### 해석

- support reference budget 2,600자는 inclusion을 87.0%에서 94.4%로 올렸다.
- 남은 char skip은 2개뿐이고, 해당 case는 이미 5/6까지 포함된다.
- 품질 지표는 유지됐지만 latency는 P2-42보다 상승했다. context budget을 더 올리는 방향은 비용 대비 효율이 낮다.
- 관찰상 support case의 완전 포함 기준은 약 2,515자 근처이므로, 2,600자는 약간의 여유가 있는 값이다.

### 다음 작업

P2-44 후보: `effective small-to-big budget diagnostics`

권장 작업:

1. `small-to-big-context` trace에 실제 적용된 `maxChars`를 추가한다.
2. benchmark diagnostics case line에 `maxChars`를 함께 표시해 2,400/2,600/3,200 budget이 어느 case에 적용됐는지 확인 가능하게 한다.
3. 이후 support budget을 2,520자 수준으로 좁힐지, 현재 값을 유지할지 결정한다.

---

## 2026-05-06 / P2-44 완료: effective small-to-big budget diagnostics

### 목표

P2-43에서 support reference budget 2,600자를 적용했지만, report만 보면 각 case에 2,400/2,600/3,200 중 어떤 budget이 실제로 적용됐는지 알 수 없었다. P2-44는 helper 반환값, planner trace, benchmark summary, diagnostics markdown에 실제 적용 `maxChars`를 노출하는 것을 목표로 했다.

### TDD

추가/수정 테스트:

- `tests/retrievalPipelineGate.test.ts`
  - role별 total char budget 적용 시 `effectiveMaxContextChars`가 반환되는지 검증.
- `tests/ragBenchmarkReport.test.ts`
  - `small-to-big-context` trace의 `maxChars`를 case summary에 파싱하는지 검증.
- `tests/ragBenchmarkDiagnostics.test.ts`
  - diagnostics markdown case line에 `max chars`가 출력되는지 검증.

RED 확인:

- `npx.cmd tsx --test tests/retrievalPipelineGate.test.ts tests/ragBenchmarkReport.test.ts tests/ragBenchmarkDiagnostics.test.ts`
- 최초 실패:
  - helper 반환값에 `effectiveMaxContextChars`가 없었다.
  - planner trace에 `maxChars`가 없었다.
  - benchmark summary와 diagnostics markdown이 `maxChars`를 표시하지 않았다.

### 구현

변경 파일:

- `src/lib/retrievalPipeline.ts`
  - `SmallToBigContextExpansion.effectiveMaxContextChars` 추가.
- `src/lib/nodeRagService.ts`
  - `small-to-big-context` trace detail에 `maxChars` 추가.
- `src/lib/ragBenchmarkReport.ts`
  - `BenchmarkSmallToBigContextCaseSummary.maxChars` 추가 및 trace parser 연결.
- `src/lib/ragBenchmarkDiagnostics.ts`
  - small-to-big diagnostics case line에 `max chars N` suffix 출력.
- `tests/retrievalPipelineGate.test.ts`
- `tests/ragBenchmarkReport.test.ts`
- `tests/ragBenchmarkDiagnostics.test.ts`
- `docs/plans/rag-search-performance-progress.md`

### 검증

통과:

- `npx.cmd tsx --test tests/retrievalPipelineGate.test.ts tests/ragBenchmarkReport.test.ts tests/ragBenchmarkDiagnostics.test.ts tests/ragQualityReport.test.ts`
  - 31 tests pass
- `npm.cmd run lint`
- `npm.cmd run rag:bench`
  - archive: `benchmarks/results/rag-benchmark-2026-05-06T04-20-43-455Z.json`
  - Top-3 doc recall: 96.3% (26/27)
  - Top-5 doc recall: 96.3% (26/27)
  - Expected evidence pass: 100.0% (27/27)
  - Forbidden evidence pass: 100.0% (27/27)
  - Required citation pass: 100.0% (27/27)
- `npm.cmd run rag:benchmark-diagnostics`
- `npm.cmd run rag:quality-report`
- `git diff --check`
  - exit 0, CRLF warning만 있음

### 결과

`docs/reports/rag-benchmark-diagnostics.md` 기준:

- Small-to-big context: included/candidate 51/54, skipped 3 (chunks 1, chars 2), chars 27,647, inclusion rate 94.4%
- `integrated-evaluation-doc-not-penalized`: included 5/6, skipped 1 (chunks 0, chars 1), chars 2,514, max chars 2,600
- `integrated-law-alias-article-variant`: included 5/6, skipped 1 (chunks 0, chars 1), chars 2,514, max chars 2,600
- `integrated-workforce-standard`: included 6/7, skipped 1 (chunks 1, chars 0), chars 3,017, max chars 3,200
- `integrated-eligibility-law`: included 5/5, skipped 0, chars 2,515, max chars 2,600
- `integrated-payroll-ratio-qa`: included 5/5, skipped 0, chars 2,515, max chars 2,600

`docs/reports/rag-quality-report.md` 기준:

- Case latency: avg 1,249.8ms, p95 2,590ms.
- Retrieval latency: avg 1,072.9ms, p95 1,678ms.

### 해석

- support reference budget 2,600자에서 실제 완전 포함된 support case는 2,515자까지 사용한다.
- support budget은 2,520자 수준으로 줄여도 현재 benchmark inclusion은 유지될 가능성이 높다.
- 남은 2개 char skip은 5/6 상태에서 여섯 번째 neighbor를 넣으려면 약 3,000자대 budget이 필요해 보이며, latency 비용 대비 효율이 낮다.
- `integrated-workforce-standard`의 chunk skip은 이미 6/7, 3,017자이며 max chunks를 올리면 total char cap에 다시 걸릴 가능성이 높다.

### 다음 작업

P2-45 후보: `support budget conservative tightening`

권장 작업:

1. `RAG_SMALL_TO_BIG_CONTEXT_SUPPORT_MAX_CHARS` 기본값을 2,600자에서 2,520자로 낮춘다.
2. inclusion 51/54와 품질 지표가 유지되는지 확인한다.
3. 유지되면 2,520자를 보수 기본값으로 기록하고, 남은 3개 skip은 latency tradeoff상 보류 후보로 둔다.

---

## 2026-05-06 / P2-45 완료: support budget conservative tightening

### 목표

P2-44 diagnostics에서 support reference case의 실제 included chars가 2,514~2,515자임을 확인했다. P2-45는 `RAG_SMALL_TO_BIG_CONTEXT_SUPPORT_MAX_CHARS` 기본값을 2,600자에서 2,520자로 낮춰, 현재 benchmark inclusion은 유지하면서 future drift에 대한 불필요한 budget 여유를 줄이는 것을 목표로 했다.

### 구현

변경 파일:

- `src/lib/nodeRagService.ts`
  - `RAG_SMALL_TO_BIG_CONTEXT_SUPPORT_MAX_CHARS` 기본값을 2,600에서 2,520으로 변경.
- `docs/plans/rag-search-performance-progress.md`

### 검증

통과:

- `npm.cmd run lint`
- `npx.cmd tsx --test tests/retrievalPipelineGate.test.ts tests/ragBenchmarkReport.test.ts tests/ragBenchmarkDiagnostics.test.ts`
  - 26 tests pass
- `npm.cmd run rag:bench`
  - archive: `benchmarks/results/rag-benchmark-2026-05-06T04-30-19-498Z.json`
  - Top-3 doc recall: 96.3% (26/27)
  - Top-5 doc recall: 96.3% (26/27)
  - Expected evidence pass: 100.0% (27/27)
  - Forbidden evidence pass: 100.0% (27/27)
  - Required citation pass: 100.0% (27/27)
- `npm.cmd run rag:benchmark-diagnostics`
- `npm.cmd run rag:quality-report`
- `npm.cmd run rag:cache-benchmark`
  - archive: `benchmarks/results/rag-cache-benchmark-2026-05-06T04-31-57-146Z.json`
- `git diff --check`
  - exit 0, CRLF warning만 있음

### 결과

`docs/reports/rag-quality-report.md` 기준:

- Small-to-big context: cases 27, included/candidate 51/54, skipped 3 (chunks 1, chars 2), chars 27,647, inclusion rate 94.4%
- Case latency: avg 721.6ms, p50 615ms, p95 1,497ms, max 3,218ms.
- Retrieval latency: avg 595.6ms, p50 603ms, p95 774ms, max 851ms.

`docs/reports/rag-benchmark-diagnostics.md` 기준:

- `integrated-evaluation-doc-not-penalized`: included 5/6, chars 2,514, max chars 2,520
- `integrated-law-alias-article-variant`: included 5/6, chars 2,514, max chars 2,520
- `integrated-eligibility-law`: included 5/5, chars 2,515, max chars 2,520
- `integrated-payroll-ratio-qa`: included 5/5, chars 2,515, max chars 2,520

Cache benchmark:

- `evaluation-day-night-care-disliked-foods`: cold 8,963ms / hit 131ms
- `evaluation-notice-period`: cold 3,888ms / hit 44ms
- `evaluation-rights-required-colloquial`: cold 4,074ms / hit 18ms
- `evaluation-change-comparison`: cold 2,082ms / hit 94ms
- `integrated-eligibility-law`: cold 2,232ms / hit 32ms

### 해석

- 2,520자 기본값은 P2-43의 2,600자와 동일하게 inclusion 51/54를 유지한다.
- `rag:bench` latency는 P2-43/P2-44보다 낮게 측정되었지만, `rag:cache-benchmark` cold path는 반대로 높게 튀었다.
- cache benchmark spike가 context budget 때문인지 런타임 변동인지 확인하려면 동일 조건 반복 측정이 필요하다.
- 남은 3개 skip을 더 줄이려면 약 3,000자대 support budget 또는 primary chunk cap/char cap 동시 증가가 필요해 보여, 현재 단계에서는 품질 대비 latency tradeoff가 좋지 않다.

### 다음 작업

P2-46 후보: `cache benchmark spike recheck`

권장 작업:

1. 동일 설정에서 `rag:cache-benchmark`를 한 번 더 실행해 cold spike가 재현되는지 확인한다.
2. 재현되면 small-to-big context budget 자체보다 cache benchmark 대상 case와 retrieval cold path 분해를 다시 본다.
3. 재현되지 않으면 P2-45 값을 유지하고, small-to-big expansion tuning은 94.4% inclusion 기준으로 일단 안정화한다.

---

## 2026-05-06 / P2-46 완료: cache benchmark spike recheck

### 목표

P2-45 검증에서 `rag:bench` latency는 낮게 측정됐지만, `rag:cache-benchmark` cold path가 직전보다 크게 튀었다. P2-46은 동일 설정에서 cache benchmark를 반복 실행해 해당 spike가 재현되는지 확인하는 것을 목표로 했다.

### 검증

통과:

- `npm.cmd run rag:cache-benchmark`
  - archive: `benchmarks/results/rag-cache-benchmark-2026-05-06T04-36-31-218Z.json`
- `git diff --check`
  - exit 0, CRLF warning만 있음

### 결과

반복 cache benchmark:

- `evaluation-day-night-care-disliked-foods`: cold 3,841ms / hit 26ms
- `evaluation-notice-period`: cold 2,307ms / hit 22ms
- `evaluation-rights-required-colloquial`: cold 1,849ms / hit 30ms
- `evaluation-change-comparison`: cold 960ms / hit 11ms
- `integrated-eligibility-law`: cold 1,106ms / hit 34ms

직전 P2-45 cache benchmark:

- `evaluation-day-night-care-disliked-foods`: cold 8,963ms / hit 131ms
- `evaluation-notice-period`: cold 3,888ms / hit 44ms
- `evaluation-rights-required-colloquial`: cold 4,074ms / hit 18ms
- `evaluation-change-comparison`: cold 2,082ms / hit 94ms
- `integrated-eligibility-law`: cold 2,232ms / hit 32ms

### 해석

- P2-45의 8.9s cold spike는 동일 설정 반복 측정에서 재현되지 않았다.
- cache hit path는 계속 수십 ms 수준으로 유지된다.
- support budget 2,520자, primary budget 3,200자, max chunks 6 조합은 현재 benchmark 기준 품질 지표를 유지하면서 small-to-big context inclusion 94.4%를 달성한다.
- 남은 skip 3개를 더 줄이려면 latency 비용이 커질 가능성이 높으므로, small-to-big expansion tuning은 여기서 안정화하고 다음 병목으로 넘어가는 편이 낫다.

### 다음 작업

P2-47 후보: `post-small-to-big latency target selection`

권장 작업:

1. 현재 품질 지표와 small-to-big inclusion을 고정 기준으로 보고, 다음 병목을 `rag:bench`의 p95/max latency 또는 cache benchmark cold path로 전환한다.
2. `docs/reports/rag-quality-report.md`의 slow case와 stage latency를 기준으로 다음 최적화 축을 선택한다.
3. context expansion을 추가로 키우는 실험은 보류하고, retrieval cold path 감소 쪽을 우선한다.

---

## 2026-05-06 / P2-47 완료: post-small-to-big latency target selection

### 목표

P2-46까지 small-to-big expansion은 inclusion 94.4%, 품질 지표 유지 상태로 안정화했다. P2-47은 context expansion을 더 키우지 않고, 다음 최적화 축을 `rag:bench` slow case 기준으로 다시 선정하는 것을 목표로 했다.

### 분석

`docs/reports/rag-quality-report.md` 기준:

- Small-to-big context: cases 27, included/candidate 51/54, skipped 3 (chunks 1, chars 2), chars 27,647, inclusion rate 94.4%
- Top-3/Top-5 doc recall: 96.3% / 96.3%
- Expected evidence / forbidden evidence / required citation: 100.0% / 100.0% / 100.0%
- Case latency: avg 721.6ms, p95 1,497ms, max 3,218ms
- Retrieval latency: avg 595.6ms, p95 774ms, max 851ms

slow case 관찰:

- slow case 대부분은 `dominant retrievalMs`로 분류된다.
- 하지만 sub-search latency aggregate는 `evaluation-base`, `evaluation-routing`, `integrated-initial` 모두 p95가 약 100ms 안팎으로, 전체 retrievalMs보다 훨씬 작다.
- 즉 다음 병목은 특정 sub-search의 corpus phase 하나가 아니라, retrieval plan 내부에서 sub-search 합계 밖에 있는 overhead를 분리하는 것이다.

### 결정

- context expansion 추가 증가는 보류한다.
- 다음 단계는 `retrievalMs - sum(sub-search-latency)` gap을 slow case에 노출해 retrieval plan overhead를 정량화한다.
- 이후 overhead가 큰 case를 기준으로 normalization/planning/evidence composition/context assembly/cache lookup 등 retrievalMs 내부 구간을 더 쪼갠다.

### 다음 작업

P2-48 후보: `retrieval overhead gap diagnostics`

권장 작업:

1. `BenchmarkSlowCaseSummary`에 sub-search latency 합계와 retrieval overhead를 추가한다.
2. `docs/reports/rag-quality-report.md`의 slow case line에 `sub-search total`, `retrieval overhead`를 표시한다.
3. benchmark를 다시 실행해 overhead가 큰 case를 다음 target으로 기록한다.

---

## 2026-05-06 / P2-48 완료: retrieval overhead gap diagnostics

### 목표

P2-47에서 slow case의 retrievalMs가 sub-search latency 합계보다 훨씬 큰 것으로 보였다. P2-48은 이를 추측이 아니라 report 수치로 바로 읽을 수 있도록 slow case summary에 `subSearchTotalMs`와 `retrievalOverheadMs`를 추가하는 것을 목표로 했다.

### TDD

추가/수정 테스트:

- `tests/ragBenchmarkReport.test.ts`
  - slow case summary가 sub-search latency 합계와 retrieval overhead를 계산하는지 검증.
- `tests/ragQualityReport.test.ts`
  - quality report slow case line에 `sub-search total`, `retrieval overhead`가 출력되는지 검증.

RED 확인:

- `npx.cmd tsx --test tests/ragBenchmarkReport.test.ts tests/ragQualityReport.test.ts`
- 최초 실패:
  - `BenchmarkSlowCaseSummary`에 `subSearchTotalMs`, `retrievalOverheadMs`가 없었다.
  - quality report slow case line이 retrieval/sub-search gap을 표시하지 않았다.

### 구현

변경 파일:

- `src/lib/ragBenchmarkReport.ts`
  - `BenchmarkSlowCaseSummary.subSearchTotalMs` 추가.
  - `BenchmarkSlowCaseSummary.retrievalOverheadMs` 추가.
  - slow case 생성 시 `retrievalMs - sum(subSearchLatencyMs)`를 계산.
- `src/lib/ragQualityReport.ts`
  - slow benchmark case line에 sub-search total과 retrieval overhead 출력.
- `tests/ragBenchmarkReport.test.ts`
- `tests/ragQualityReport.test.ts`
- `docs/plans/rag-search-performance-progress.md`

### 검증

통과:

- `npx.cmd tsx --test tests/ragBenchmarkReport.test.ts tests/ragQualityReport.test.ts`
  - 12 tests pass
- `npm.cmd run lint`
- `npm.cmd run rag:bench`
  - archive: `benchmarks/results/rag-benchmark-2026-05-06T06-04-12-470Z.json`
  - Top-3 doc recall: 96.3% (26/27)
  - Top-5 doc recall: 96.3% (26/27)
  - Expected evidence pass: 100.0% (27/27)
  - Forbidden evidence pass: 100.0% (27/27)
  - Required citation pass: 100.0% (27/27)
- `npm.cmd run rag:quality-report`
- `npm.cmd run rag:benchmark-diagnostics`
- `git diff --check`
  - exit 0, CRLF warning만 있음

### 결과

`docs/reports/rag-quality-report.md` 기준:

- Case latency: avg 1,206.1ms, p95 2,524ms, max 4,828ms
- Retrieval latency: avg 999.5ms, p95 1,371ms, max 1,510ms
- Small-to-big context: included/candidate 51/54, skipped 3, inclusion rate 94.4%

slow case overhead:

- `evaluation-day-night-care-disliked-foods`: retrieval 1,292ms, sub-search total 405ms, retrieval overhead 887ms
- `evaluation-notice-period`: retrieval 1,339ms, sub-search total 448ms, retrieval overhead 891ms
- `evaluation-rights-required-colloquial`: retrieval 1,016ms, sub-search total 320ms, retrieval overhead 696ms
- `integrated-workforce-standard`: retrieval 1,510ms, sub-search total 200ms, retrieval overhead 1,310ms
- `integrated-eligibility-law`: retrieval 1,371ms, sub-search total 212ms, retrieval overhead 1,159ms

### 해석

- 현재 slow path의 가장 큰 미계측 영역은 sub-search 자체가 아니라 retrievalMs 내부의 sub-search 외 overhead다.
- integrated case는 sub-search가 1개뿐인데도 overhead가 1초 이상 발생하므로, 다음 단계는 integrated/evaluation 공통 retrieval pipeline 구간을 더 세분화해야 한다.
- corpus phase timing만 더 줄이는 실험은 현재 slow case 전체 latency를 설명하지 못한다.

### 다음 작업

P2-49 후보: `retrieval plan phase timing trace`

권장 작업:

1. `runRetrievalPlan()` 또는 상위 retrieval path에서 sub-search 외 구간의 phase timing을 trace한다.
2. 최소 후보 구간은 query normalization 이후 planning, retrieval profile/build, evidence composition, small-to-big context expansion, final context assembly/cache write다.
3. quality report slow case line 또는 benchmark diagnostics에 overhead breakdown을 노출한 뒤 실제 dominant phase를 기준으로 다음 최적화를 고른다.

---

## 2026-05-06 / P2-49 완료: retrieval plan phase timing trace

### 목표

P2-48에서 slow case의 `retrievalMs`와 sub-search latency 합계 사이에 600~1,300ms 수준의 gap이 확인되었다. P2-49는 `runRetrievalPlan()` 레벨에서 sub-search 외 phase timing을 trace해 gap이 `executeSearch()` 내부인지, retrieval 후처리/context assembly인지 분리하는 것을 목표로 했다.

### TDD

추가/수정 테스트:

- `tests/ragBenchmarkReport.test.ts`
  - `retrieval-phase-timing` planner trace를 slow case summary의 `retrievalPhaseLatencyMs`로 파싱하는지 검증.
- `tests/ragQualityReport.test.ts`
  - quality report slow case line에 `retrieval phases ...`가 출력되는지 검증.

RED 확인:

- `npx.cmd tsx --test tests/ragBenchmarkReport.test.ts tests/ragQualityReport.test.ts`
- 최초 실패:
  - `BenchmarkSlowCaseSummary`에 retrieval phase map이 없었다.
  - quality report가 retrieval phases를 표시하지 않았다.

### 구현

변경 파일:

- `src/lib/nodeRagService.ts`
  - `runRetrievalPlan()` 내부에 `retrieval-phase-timing` planner trace 추가.
  - phase 후보:
    - `execute-search`
    - `workflow-facet`
    - `procedure-aspect`
    - `drift-refine`
    - `law-fallback`
    - `post-search-gates`
    - `evidence-assembly`
    - `semantic-validation`
    - `context-assembly`
- `src/lib/ragBenchmarkReport.ts`
  - `retrieval-phase-timing` trace parser 추가.
  - `BenchmarkSlowCaseSummary.retrievalPhaseLatencyMs` 추가.
- `src/lib/ragQualityReport.ts`
  - slow benchmark case line에 retrieval phase breakdown 출력.
- `tests/ragBenchmarkReport.test.ts`
- `tests/ragQualityReport.test.ts`
- `docs/plans/rag-search-performance-progress.md`

### 검증

통과:

- `npx.cmd tsx --test tests/ragBenchmarkReport.test.ts tests/ragQualityReport.test.ts`
  - 12 tests pass
- `npm.cmd run lint`
- `npm.cmd run rag:bench`
  - archive: `benchmarks/results/rag-benchmark-2026-05-06T06-21-00-233Z.json`
  - Top-3 doc recall: 96.3% (26/27)
  - Top-5 doc recall: 96.3% (26/27)
  - Expected evidence pass: 100.0% (27/27)
  - Forbidden evidence pass: 100.0% (27/27)
  - Required citation pass: 100.0% (27/27)
- `npm.cmd run rag:quality-report`
- `npm.cmd run rag:benchmark-diagnostics`
- `git diff --check`
  - exit 0, CRLF warning만 있음

### 결과

`docs/reports/rag-quality-report.md` 기준:

- Case latency: avg 887.4ms, p95 1,803ms, max 3,360ms
- Retrieval latency: avg 748.1ms, p95 1,328ms, max 1,428ms
- Small-to-big context: included/candidate 51/54, skipped 3, inclusion rate 94.4%

slow case phase breakdown:

- `evaluation-day-night-care-disliked-foods`
  - retrieval 964ms, sub-search total 295ms, overhead 669ms
  - retrieval phases: `execute-search=816ms`, `semantic-validation=112ms`, `context-assembly=10ms`, `evidence-assembly=15ms`
- `evaluation-notice-period`
  - retrieval 825ms, sub-search total 236ms, overhead 589ms
  - retrieval phases: `execute-search=724ms`, `semantic-validation=69ms`
- `integrated-workforce-standard`
  - retrieval 1,428ms, sub-search total 224ms, overhead 1,204ms
  - retrieval phases: `execute-search=1215ms`, `semantic-validation=174ms`
- `integrated-eligibility-law`
  - retrieval 1,328ms, sub-search total 170ms, overhead 1,158ms
  - retrieval phases: `execute-search=992ms`, `semantic-validation=270ms`

### 해석

- retrieval overhead의 대부분은 `runRetrievalPlan()` 후처리보다 `execute-search` phase 내부에서 발생한다.
- `semantic-validation`도 일부 slow case에서 100~270ms 수준으로 보이지만, dominant target은 `executeSearch()` 내부다.
- 다음 단계에서는 `executeSearch()` 내부의 route 선택, searchStore 호출 전후, gating/merge/section routing 구간을 별도로 trace해야 한다.

### 다음 작업

P2-50 후보: `executeSearch internal phase timing trace`

권장 작업:

1. `executeSearch()` 내부에 phase timing trace를 추가한다.
2. searchStore 호출 자체는 이미 sub-search/search-store latency로 잡히므로, 그 외 route setup, result gating, section routing, candidate merge, lexical pool diagnostics 같은 wrapper 비용을 분리한다.
3. quality report slow case에 execute-search 내부 phase를 노출해 다음 최적화 target을 확정한다.

---

## 2026-05-06 / P2-50 완료: executeSearch internal phase timing trace

### 목표

P2-49에서 dominant phase가 `execute-search`로 좁혀졌으므로, P2-50은 `executeSearch()` 내부의 wrapper/postprocess 비용을 phase별로 분해해 다음 최적화 타깃을 수치로 확인하는 것을 목표로 했다.

### TDD

추가/수정 테스트:

- `tests/ragBenchmarkReport.test.ts`
  - `execute-search-phase-timing` planner trace를 slow case summary의 `executeSearchPhaseLatencyMs`로 파싱하는지 검증.
- `tests/ragQualityReport.test.ts`
  - quality report slow case line에 `execute-search phases ...`가 출력되는지 검증.

RED 확인:

- `npx.cmd tsx --test tests/ragBenchmarkReport.test.ts tests/ragQualityReport.test.ts`
- 최초 실패:
  - `BenchmarkSlowCaseSummary`에 `executeSearchPhaseLatencyMs`가 없었음.
  - quality report가 execute-search 내부 phase를 표시하지 않았음.

### 구현

변경 파일:

- `src/lib/nodeRagService.ts`
  - `executeSearch()` 내부에 `execute-search-phase-timing` planner trace 추가.
  - integrated path phase:
    - `integrated-setup`
    - `integrated-initial-postprocess`
    - `integrated-expansion-setup`
    - `integrated-final-assembly`
  - evaluation path phase:
    - `evaluation-setup`
    - `evaluation-routing-postprocess`
    - `evaluation-support-setup`
    - `evaluation-base-setup`
    - `evaluation-base-postprocess`
    - `evaluation-final-assembly`
- `src/lib/ragBenchmarkReport.ts`
  - trace latency map parser를 공용화.
  - `BenchmarkSlowCaseSummary.executeSearchPhaseLatencyMs` 추가.
- `src/lib/ragQualityReport.ts`
  - slow benchmark case line에 execute-search phase breakdown 출력.
- `tests/ragBenchmarkReport.test.ts`
- `tests/ragQualityReport.test.ts`
- `docs/plans/rag-search-performance-progress.md`

### 검증

통과:

- `npx.cmd tsx --test tests/ragBenchmarkReport.test.ts tests/ragQualityReport.test.ts`
  - 12 tests pass
- `npm.cmd run lint`
- `npm.cmd run rag:bench`
  - archive: `benchmarks/results/rag-benchmark-2026-05-06T06-38-51-594Z.json`
  - Top-3 doc recall: 96.3% (26/27)
  - Top-5 doc recall: 96.3% (26/27)
  - Expected evidence pass: 100.0% (27/27)
  - Forbidden evidence pass: 100.0% (27/27)
  - Required citation pass: 100.0% (27/27)
- `npm.cmd run rag:quality-report`
- `npm.cmd run rag:benchmark-diagnostics`
- `git diff --check`
  - exit 0, CRLF warning만 있음

### 결과

`docs/reports/rag-quality-report.md` 기준:

- Case latency: avg 917.5ms, p95 1,853ms, max 3,841ms
- Retrieval latency: avg 753.9ms, p95 1,247ms, max 1,398ms
- Small-to-big context: included/candidate 51/54, skipped 3, inclusion rate 94.4%

slow case execute-search phase breakdown:

- `evaluation-day-night-care-disliked-foods`
  - retrieval 987ms, sub-search total 295ms, overhead 692ms
  - retrieval phases: `execute-search=840ms`, `semantic-validation=113ms`
  - execute-search phases: `evaluation-routing-postprocess=504ms`, `evaluation-support-setup=36ms`, `evaluation-setup=2ms`, `evaluation-final-assembly=1ms`
- `evaluation-notice-period`
  - retrieval 870ms, sub-search total 225ms, overhead 645ms
  - execute-search phases: `evaluation-routing-postprocess=556ms`, `evaluation-support-setup=3ms`, `evaluation-setup=2ms`
- `evaluation-rights-required-colloquial`
  - retrieval 664ms, sub-search total 185ms, overhead 479ms
  - execute-search phases: `evaluation-routing-postprocess=425ms`, `evaluation-support-setup=1ms`, `evaluation-setup=2ms`
- `integrated-workforce-standard`
  - retrieval 1,398ms, sub-search total 164ms, overhead 1,234ms
  - execute-search phases: `integrated-initial-postprocess=1035ms`, `integrated-setup=1ms`
- `integrated-eligibility-law`
  - retrieval 1,247ms, sub-search total 184ms, overhead 1,063ms
  - execute-search phases: `integrated-initial-postprocess=833ms`, `integrated-setup=2ms`

### 해석

- evaluation slow case의 dominant 비용은 `evaluation-routing-postprocess`였다.
- integrated slow case의 dominant 비용은 `integrated-initial-postprocess`였다.
- 둘 다 searchStore 호출 자체보다 검색 결과 후처리, ontology expansion, routing candidate 구성 쪽 비용일 가능성이 높다.
- P2-51에서는 이 두 postprocess 구간을 더 잘게 쪼개서 실제 hot operation을 확정해야 한다.

### 다음 작업

P2-51 후보: `routing/integrated postprocess phase split`

권장 작업:

1. `evaluation-routing-postprocess`를 section routing, ontology expansion, routing candidate selection/resolve 구간으로 분해한다.
2. `integrated-initial-postprocess`도 동일하게 section routing, ontology expansion, routing candidate selection/resolve 구간으로 분해한다.
3. benchmark와 quality report를 재실행해 품질 지표 유지 및 dominant sub-phase를 확인한다.

---

## 2026-05-06 / P2-51 완료: routing/integrated postprocess phase split

### 목표

P2-50에서 slow case의 dominant 비용이 `evaluation-routing-postprocess`와 `integrated-initial-postprocess`로 확인되었다. P2-51은 이 aggregate postprocess 구간을 section routing, ontology expansion, routing resolve로 분해해 실제 hot operation을 확정하는 것을 목표로 했다.

### TDD

추가 테스트:

- `tests/ragExecutionTrace.test.ts`
  - `executeSearch()` trace 계약에 다음 세부 phase label이 존재하는지 검증:
    - `evaluation-section-routing`
    - `evaluation-ontology-expand`
    - `evaluation-routing-resolve`
    - `integrated-section-routing`
    - `integrated-ontology-expand`
    - `integrated-routing-resolve`

RED 확인:

- `npx.cmd tsx --test tests/ragExecutionTrace.test.ts`
- 최초 실패:
  - 기존 trace는 aggregate label인 `evaluation-routing-postprocess`, `integrated-initial-postprocess`만 가지고 있어 세부 label 계약을 만족하지 못했다.

### 구현

변경 파일:

- `src/lib/nodeRagService.ts`
  - integrated initial postprocess를 다음 phase로 분해:
    - `integrated-section-routing`
    - `integrated-ontology-expand`
    - `integrated-routing-resolve`
  - evaluation routing postprocess를 다음 phase로 분해:
    - `evaluation-section-routing`
    - `evaluation-ontology-expand`
    - `evaluation-routing-resolve`
- `tests/ragExecutionTrace.test.ts`
- `docs/plans/rag-search-performance-progress.md`

### 검증

통과:

- `npx.cmd tsx --test tests/ragExecutionTrace.test.ts tests/ragBenchmarkReport.test.ts tests/ragQualityReport.test.ts`
  - 13 tests pass
- `npm.cmd run lint`
- `npm.cmd run rag:bench`
  - archive: `benchmarks/results/rag-benchmark-2026-05-06T06-55-46-239Z.json`
  - Top-3 doc recall: 96.3% (26/27)
  - Top-5 doc recall: 96.3% (26/27)
  - Expected evidence pass: 100.0% (27/27)
  - Forbidden evidence pass: 100.0% (27/27)
  - Required citation pass: 100.0% (27/27)
- `npm.cmd run rag:quality-report`
- `npm.cmd run rag:benchmark-diagnostics`
- `git diff --check`
  - exit 0, CRLF warning만 있음

### 결과

`docs/reports/rag-quality-report.md` 기준:

- Case latency: avg 736.9ms, p95 1,493ms, max 2,992ms
- Retrieval latency: avg 618.7ms, p95 993ms, max 1,437ms
- Small-to-big context: included/candidate 51/54, skipped 3, inclusion rate 94.4%

slow case phase breakdown:

- `evaluation-day-night-care-disliked-foods`
  - retrieval 921ms, sub-search total 273ms, overhead 648ms
  - execute-search phases: `evaluation-ontology-expand=505ms`, `evaluation-support-setup=37ms`, `evaluation-routing-resolve=3ms`, `evaluation-setup=2ms`
- `integrated-eligibility-law`
  - retrieval 1,437ms, sub-search total 267ms, overhead 1,170ms
  - execute-search phases: `integrated-ontology-expand=935ms`, `integrated-routing-resolve=5ms`, `integrated-section-routing=2ms`, `integrated-setup=6ms`
- `evaluation-notice-period`
  - retrieval 745ms, sub-search total 246ms, overhead 499ms
  - execute-search phases: `evaluation-ontology-expand=404ms`, `evaluation-routing-resolve=2ms`, `evaluation-support-setup=2ms`
- `evaluation-rights-required-colloquial`
  - retrieval 588ms, sub-search total 156ms, overhead 432ms
  - execute-search phases: `evaluation-ontology-expand=394ms`, `evaluation-routing-resolve=1ms`, `evaluation-support-setup=1ms`
- `integrated-workforce-standard`
  - retrieval 993ms, sub-search total 125ms, overhead 868ms
  - execute-search phases: `integrated-ontology-expand=716ms`, `integrated-routing-resolve=2ms`

### 해석

- dominant 비용은 section routing이나 routing resolve가 아니라 ontology expansion이다.
- `expandDocumentsWithOntology()`가 query profile과 seed document ids를 기준으로 반복 탐색/boost 계산을 수행하는 구간이므로, 다음 최적화는 ontology expansion 입력 후보 수 제한, graph lookup cache, 또는 query profile 단위 memoization 중 하나로 좁혀야 한다.
- 품질 지표는 P2-50 대비 유지되었고, 관측 phase만 세분화되었다.

### 다음 작업

P2-52 후보: `ontology expansion input/memo diagnostics`

권장 작업:

1. `expandDocumentsWithOntology()` 호출마다 seed document 수, hit 수, documentScoreBoost 수, trace 수, elapsedMs를 planner trace에 기록한다.
2. 동일 query profile/seed 조합 반복 여부를 진단해 memoization 후보인지 확인한다.
3. benchmark/quality report에 ontology expansion diagnostic aggregate를 추가해 후보 수 제한과 cache 중 어느 쪽이 안전한지 판단한다.

---

## 2026-05-06 / P2-52 완료: ontology expansion diagnostics

### 목표

P2-51에서 dominant 비용이 `*-ontology-expand`로 확인되었다. P2-52는 `expandDocumentsWithOntology()` 호출별 seed document 수, direct hit 수, boost 대상 document 수, trace 수, elapsedMs를 planner trace와 quality report에 노출해 다음 최적화 방향을 수치화하는 것을 목표로 했다.

### TDD

추가/수정 테스트:

- `tests/ragBenchmarkReport.test.ts`
  - `ontology-expansion` planner trace를 slow case summary의 `ontologyExpansionDiagnostics`로 파싱하는지 검증.
- `tests/ragQualityReport.test.ts`
  - quality report slow case line에 `ontology expansion ...` diagnostics가 출력되는지 검증.

RED 확인:

- `npx.cmd tsx --test tests/ragBenchmarkReport.test.ts tests/ragQualityReport.test.ts`
- 최초 실패:
  - `BenchmarkSlowCaseSummary`에 ontology expansion diagnostics가 없었음.
  - quality report가 ontology expansion 상세를 표시하지 않았음.

### 구현

변경 파일:

- `src/lib/nodeRagService.ts`
  - `executeSearch()` 내부 ontology expansion 호출 직후 `ontology-expansion` planner trace 추가.
  - trace detail:
    - `stage`
    - `seeds`
    - `hits`
    - `boosts`
    - `trace`
    - `elapsed`
- `src/lib/ragBenchmarkReport.ts`
  - `BenchmarkOntologyExpansionDiagnostic` 추가.
  - `ontology-expansion` trace parser 추가.
  - slow case summary에 `ontologyExpansionDiagnostics` 추가.
- `src/lib/ragQualityReport.ts`
  - slow benchmark case line에 ontology expansion diagnostics 출력.
- `tests/ragBenchmarkReport.test.ts`
- `tests/ragQualityReport.test.ts`
- `docs/plans/rag-search-performance-progress.md`

### 검증

통과:

- `npx.cmd tsx --test tests/ragExecutionTrace.test.ts tests/ragBenchmarkReport.test.ts tests/ragQualityReport.test.ts`
  - 13 tests pass
- `npm.cmd run lint`
- `npm.cmd run rag:bench`
  - archive: `benchmarks/results/rag-benchmark-2026-05-06T07-12-25-190Z.json`
  - Top-3 doc recall: 96.3% (26/27)
  - Top-5 doc recall: 96.3% (26/27)
  - Expected evidence pass: 100.0% (27/27)
  - Forbidden evidence pass: 100.0% (27/27)
  - Required citation pass: 100.0% (27/27)
- `npm.cmd run rag:quality-report`
- `npm.cmd run rag:benchmark-diagnostics`
- `git diff --check`
  - exit 0, CRLF warning만 있음

### 결과

`docs/reports/rag-quality-report.md` 기준:

- Case latency: avg 1,423.9ms, p95 3,070ms, max 6,188ms
- Retrieval latency: avg 1,169.1ms, p95 1,622ms, max 1,967ms
- Small-to-big context: included/candidate 51/54, skipped 3, inclusion rate 94.4%

slow case ontology expansion diagnostics:

- `evaluation-day-night-care-disliked-foods`
  - `evaluation-routing`: seeds 4, hits 5, boosts 91, trace 1, elapsed 855ms
- `evaluation-notice-period`
  - `evaluation-routing`: seeds 4, hits 6, boosts 91, trace 1, elapsed 889ms
- `evaluation-rights-required-colloquial`
  - `evaluation-routing`: seeds 4, hits 12, boosts 111, trace 1, elapsed 663ms
- `integrated-workforce-standard`
  - `integrated-initial`: seeds 4, hits 12, boosts 100, trace 1, elapsed 1,423ms
- `integrated-integrated-homecare-manual`
  - `integrated-initial`: seeds 4, hits 6, boosts 54, trace 1, elapsed 1,152ms

### 해석

- seed document 수는 이미 4개로 작다.
- 그러나 direct hits와 relation expansion 결과가 boost 대상 document 54~111개로 커지면서 elapsed가 663~1,423ms까지 발생한다.
- 단순 seed cap보다 `lookupEntityHits()`/relation traversal/document boost 계산 쪽을 줄이거나 memoization하는 편이 더 가능성이 높다.
- 이번 benchmark는 절대 latency가 P2-51보다 높게 측정되었지만 품질 지표와 inclusion 지표는 유지되었다. 다음 단계에서는 최적화 전후를 동일 명령으로 반복 측정해 spike와 실제 개선을 분리해야 한다.

### 다음 작업

P2-53 후보: `ontology expansion memoization or bounded boost optimization`

권장 작업:

1. `expandDocumentsWithOntology()` 입력 signature를 query profile 핵심 값과 seed document ids로 구성해 동일 호출 반복 여부를 trace한다.
2. 반복이 적으면 memoization보다 boost 대상 상한 또는 candidate status/depth 기반 pruning을 우선 검토한다.
3. 반복이 있으면 request-local ontology expansion cache를 추가하고 quality 지표 유지 여부를 benchmark로 확인한다.

---

## 2026-05-06 / P2-53 완료: ontology alias token index

### 목표

P2-52에서 ontology expansion의 dominant 비용이 seed 수가 아니라 alias/entity lookup과 boost 계산 쪽임을 확인했다. 코드 확인 결과 `lookupEntityHits()`가 query variant마다 `graph.aliasIndex.values()` 전체를 순회하며 token overlap을 계산하고 있었다. P2-53은 graph 생성 시 alias token index를 만들어 overlap 후보를 token bucket으로 제한하는 것을 목표로 했다.

### TDD

추가 테스트:

- `tests/ontologyAutoExpansion.test.ts`
  - ontology graph가 alias를 significant token 기준으로 `aliasTokenIndex`에 색인하는지 검증.

RED 확인:

- `npx.cmd tsx --test tests/ontologyAutoExpansion.test.ts`
- 최초 실패:
  - `graph.aliasTokenIndex`가 없어 token bucket 기반 lookup 계약을 만족하지 못했다.

### 구현

변경 파일:

- `src/lib/ragOntology.ts`
  - `OntologyGraph.aliasTokenIndex` 추가.
  - `createGraph()` 초기화에 token index 추가.
  - `addAlias()`에서 alias의 significant token별 `AliasMatch` bucket 생성.
  - `lookupEntityHits()`의 token overlap 경로를 `graph.aliasIndex.values()` 전체 순회에서 `graph.aliasTokenIndex.get(token)` 후보 순회로 변경.
- `tests/ontologyAutoExpansion.test.ts`
- `docs/plans/rag-search-performance-progress.md`

### 검증

통과:

- `npx.cmd tsx --test tests/ontologyAutoExpansion.test.ts tests/ragExecutionTrace.test.ts tests/ragBenchmarkReport.test.ts tests/ragQualityReport.test.ts`
  - 21 tests pass
- `npm.cmd run lint`
- `npm.cmd run rag:bench`
  - archive: `benchmarks/results/rag-benchmark-2026-05-06T07-32-57-798Z.json`
  - Top-3 doc recall: 96.3% (26/27)
  - Top-5 doc recall: 96.3% (26/27)
  - Expected evidence pass: 100.0% (27/27)
  - Forbidden evidence pass: 100.0% (27/27)
  - Required citation pass: 100.0% (27/27)
- `npm.cmd run rag:quality-report`
- `npm.cmd run rag:benchmark-diagnostics`
- `git diff --check`
  - exit 0, CRLF warning만 있음

### 결과

`docs/reports/rag-quality-report.md` 기준:

- Case latency: avg 579.5ms, p95 2,129ms, max 4,655ms
- Retrieval latency: avg 327.1ms, p95 534ms, max 852ms
- Small-to-big context: included/candidate 51/54, skipped 3, inclusion rate 94.4%

ontology expansion elapsed:

- `evaluation-day-night-care-disliked-foods`
  - P2-52: 855ms
  - P2-53: 14ms
- `evaluation-notice-period`
  - P2-52: 889ms
  - P2-53: 24ms
- `evaluation-rights-required-colloquial`
  - P2-52: 663ms
  - P2-53: 23ms
- `integrated-workforce-standard`
  - P2-52: 1,423ms
  - P2-53 run에서는 slow top-5에서 제외됨
- `integrated-eligibility-law`
  - P2-53: 20ms
- `integrated-law-alias-article-variant`
  - P2-53: 30ms

### 해석

- ontology expansion의 주요 병목은 relation traversal 자체보다 alias overlap 후보 전체 스캔이었다.
- token bucket으로 후보를 제한해 ontology expansion elapsed가 대략 수십 ms 수준으로 내려갔다.
- retrieval p95도 1,622ms에서 534ms로 크게 내려갔지만, total max는 여전히 특정 case answer/evaluation 쪽 영향으로 높게 남아 있다.

### 다음 작업

P2-54 후보: `post-ontology remaining slow case target selection`

권장 작업:

1. P2-53 이후 slow case에서 retrieval overhead와 semantic-validation 비중을 다시 비교한다.
2. `evaluation-day-night-care-disliked-foods`는 retrieval 852ms 중 sub-search 544ms, overhead 308ms라 이제 sub-search 자체 또는 direct-support/support setup 쪽을 다시 봐야 한다.
3. 다음 최적화 target을 search-store latency, semantic-validation, answer/evaluation stage 중 하나로 재선정한다.

---

## 2026-05-06 / P2-54 완료: post-ontology remaining slow target selection

### 목표

P2-53 이후 ontology expansion 병목이 제거되었으므로, 남은 slow case의 retrieval breakdown을 다시 읽어 다음 성능 target을 재선정했다.

### 입력 자료

- `docs/reports/rag-quality-report.md`
- `docs/reports/rag-benchmark-diagnostics.md`
- `.rag-cache/rag-benchmark.json`

### 관찰

P2-53 이후 주요 지표:

- Case latency: avg 579.5ms, p95 2,129ms, max 4,655ms
- Retrieval latency: avg 327.1ms, p95 534ms, max 852ms
- Small-to-big context: included/candidate 51/54, skipped 3, inclusion rate 94.4%

slow retrieval case:

- `evaluation-day-night-care-disliked-foods`
  - retrieval 852ms
  - sub-search total 544ms
  - retrieval overhead 308ms
  - ontology expansion 14ms
  - semantic validation 172ms
  - sub-search: `evaluation-base=216ms`, `evaluation-routing=175ms`, `evaluation-direct-support=102ms`, `evaluation-primary-manual=51ms`

diagnostics 기준 repeated sub-search/corpus phase:

- `evaluation-routing`: total avg 106.4ms, p95 171ms
  - exact avg 52.1ms, lexical avg 26.3ms, lexical pool avg 16.1ms, fusion avg 7.9ms
- `evaluation-base`: total avg 104.3ms, p95 205ms
  - exact avg 57.3ms, lexical avg 19.7ms, lexical pool avg 16.8ms, fusion avg 6.8ms
- `integrated-initial`: total avg 101.1ms, p95 227ms
  - exact avg 56.6ms, lexical avg 30.3ms, lexical pool avg 3.8ms, fusion avg 6.3ms

### 결정

- 다음 retrieval target은 ontology가 아니라 search corpus 내부의 exact/lexical phase다.
- 특히 exact phase가 evaluation/integrated 공통으로 평균 52~57ms, 일부 slow p95에서 70~127ms 수준까지 올라간다.
- semantic validation도 일부 case에서 172~224ms로 보이지만, retrieval p95를 더 직접적으로 줄이려면 반복 sub-search의 corpus exact/lexical 비용을 먼저 줄이는 편이 낫다.

### 다음 작업

P2-55 후보: `search corpus exact/lexical candidate scan diagnostics`

권장 작업:

1. search corpus phase trace에 exact/lexical scan candidate 수 또는 bounded candidate 수를 추가한다.
2. `evaluation-routing`, `evaluation-base`, `integrated-initial` 각각에서 exact/lexical phase가 어떤 입력 크기와 함께 증가하는지 확인한다.
3. 입력 크기 원인이 확인되면 exact phase 후보 상한 또는 precomputed exact candidate bucket을 적용한다.

---

## 2026-05-06 / P2-55 완료: search corpus exact/lexical input count diagnostics

### 목표

P2-54에서 다음 target이 search corpus exact/lexical phase로 좁혀졌다. P2-55는 phase latency와 함께 exact/lexical 입력 chunk 수와 output candidate 수를 report에 표시해, 실제 비용이 입력 크기 때문인지 확인하는 것을 목표로 했다.

### TDD

추가/수정 테스트:

- `tests/ragBenchmarkReport.test.ts`
  - `search-store-latency` trace의 `phaseExactInput`, `phaseExactScored`, `phaseExactCandidates`, `phaseLexicalInput`, `phaseLexicalCandidates`를 corpus phase summary로 파싱하는지 검증.
- `tests/ragQualityReport.test.ts`
  - quality report의 `Search corpus phase timing` 라인에 exact/lexical input/output 평균이 출력되는지 검증.

RED 확인:

- `npx.cmd tsx --test tests/ragBenchmarkReport.test.ts tests/ragQualityReport.test.ts`
- 최초 실패:
  - corpus phase summary에 input/output count 필드가 없었음.
  - quality report가 exact/lexical 입력 크기를 표시하지 않았음.

### 구현

변경 파일:

- `src/lib/ragTypes.ts`
  - `SearchCorpusCandidateCounts` 추가.
  - `SearchCorpusPhaseTimings.candidateCounts` 추가.
- `src/lib/ragEngine.ts`
  - exact input chunks, scoped exact scored chunks, exact output candidates 계측.
  - lexical input chunks, lexical output candidates 계측.
- `src/lib/nodeRagService.ts`
  - `search-store-latency` trace에 phase candidate count 필드 추가.
- `src/lib/ragBenchmarkReport.ts`
  - corpus phase parser와 summary에 average exact/lexical input/output count 추가.
- `src/lib/ragQualityReport.ts`
  - Search corpus phase timing 라인에 exact/lexical input/output 평균 출력.
- `tests/ragBenchmarkReport.test.ts`
- `tests/ragQualityReport.test.ts`
- `docs/plans/rag-search-performance-progress.md`

### 검증

통과:

- `npx.cmd tsx --test tests/ragBenchmarkReport.test.ts tests/ragQualityReport.test.ts`
  - 12 tests pass
- `npm.cmd run lint`
- `npm.cmd run rag:bench`
  - archive: `benchmarks/results/rag-benchmark-2026-05-06T08-06-40-006Z.json`
  - Top-3 doc recall: 96.3% (26/27)
  - Top-5 doc recall: 96.3% (26/27)
  - Expected evidence pass: 100.0% (27/27)
  - Forbidden evidence pass: 100.0% (27/27)
  - Required citation pass: 100.0% (27/27)
- `npm.cmd run rag:quality-report`
- `npm.cmd run rag:benchmark-diagnostics`
- `git diff --check`
  - exit 0, CRLF warning만 있음

### 결과

`docs/reports/rag-quality-report.md` 기준:

- Case latency: avg 553.7ms, p95 1,942ms, max 4,223ms
- Retrieval latency: avg 324.2ms, p95 494ms, max 655ms
- Small-to-big context: included/candidate 51/54, skipped 3, inclusion rate 94.4%

search corpus phase input 규모:

- `integrated-initial`
  - total avg 103.1ms, p95 174ms
  - exact avg 58.4ms, lexical avg 30.2ms
  - exact input avg 2,345.5, lexical input avg 2,345.5
- `evaluation-routing`
  - total avg 97.2ms, p95 153ms
  - exact avg 45.1ms, lexical avg 25.4ms
  - exact input avg 2,384, lexical input avg 2,384
- `evaluation-base`
  - total avg 94ms, p95 130ms
  - exact avg 52ms, lexical avg 16.7ms
  - exact input avg 2,958, lexical input avg 2,958
- `evaluation-direct-support`
  - total avg 42.1ms, p95 71ms
  - exact input avg 690, lexical input avg 690

### 해석

- exact/lexical phase 시간은 입력 chunk 수와 같이 움직인다.
- output은 대부분 24개 안팎인데 input은 2,300~2,900개 수준이라, candidate cap을 더 보수적으로 낮출 여지가 있다.
- P2-53 이후 ontology 병목은 거의 사라졌고, retrieval p95는 494ms까지 내려왔다.

### 다음 작업

P2-56 후보: `lexical candidate cap conservative reduction`

권장 작업:

1. integrated initial cap 2,800과 evaluation routing/base input 규모를 보수적으로 낮춰도 recall이 유지되는지 확인한다.
2. 우선 integrated initial cap만 2,000 안팎으로 낮춰 품질/latency 영향을 측정한다.
3. 품질이 유지되면 evaluation routing/base cap도 별도 단계에서 조정한다.

---

## 2026-05-06 / P2-56 완료: integrated initial lexical candidate cap 2,000

### 목표

P2-55에서 `integrated-initial` exact/lexical input이 평균 2,345.5 chunks로 확인되었다. P2-56은 가장 작은 보수 조정으로 integrated initial lexical candidate cap 기본값을 2,800에서 2,000으로 낮추고 품질 지표가 유지되는지 확인하는 것을 목표로 했다.

### TDD

추가 테스트:

- `tests/ragExecutionTrace.test.ts`
  - `RAG_INTEGRATED_INITIAL_MAX_LEXICAL_CHUNKS` 기본값이 2,000으로 유지되는지 검증.

RED 확인:

- `npx.cmd tsx --test tests/ragExecutionTrace.test.ts`
- 최초 실패:
  - 기존 기본값은 2,800이었다.

### 구현

변경 파일:

- `src/lib/nodeRagService.ts`
  - `INTEGRATED_INITIAL_MAX_LEXICAL_CHUNKS` 기본값 2,800 -> 2,000.
- `tests/ragExecutionTrace.test.ts`
- `docs/plans/rag-search-performance-progress.md`

### 검증

통과:

- `npx.cmd tsx --test tests/ragExecutionTrace.test.ts tests/ragBenchmarkReport.test.ts tests/ragQualityReport.test.ts`
  - 14 tests pass
- `npm.cmd run lint`
- `npm.cmd run rag:bench`
  - archive: `benchmarks/results/rag-benchmark-2026-05-06T08-25-19-561Z.json`
  - Top-3 doc recall: 96.3% (26/27)
  - Top-5 doc recall: 96.3% (26/27)
  - Expected evidence pass: 100.0% (27/27)
  - Forbidden evidence pass: 100.0% (27/27)
  - Required citation pass: 100.0% (27/27)
- `npm.cmd run rag:quality-report`
- `npm.cmd run rag:benchmark-diagnostics`
- `git diff --check`
  - exit 0, CRLF warning만 있음

### 결과

`docs/reports/rag-quality-report.md` 기준:

- Case latency: avg 618.1ms, p95 1,840ms, max 5,038ms
- Retrieval latency: avg 361.7ms, p95 591ms, max 839ms
- Top-3/Top-5 doc recall: 96.3% / 96.3%
- Expected evidence / forbidden evidence / required citation: 100.0% / 100.0% / 100.0%

integrated initial:

- P2-55:
  - total avg 103.1ms, p95 174ms
  - exact input avg 2,345.5
  - exact avg 58.4ms, lexical avg 30.2ms
- P2-56:
  - total avg 80.8ms, p95 184ms
  - exact input avg 1,678.8
  - exact avg 43.7ms, lexical avg 22.4ms

### 해석

- integrated initial input 규모는 약 28% 줄었고 exact/lexical 평균도 내려갔다.
- 품질 지표는 유지되었다.
- 다만 이번 run의 retrieval p95는 P2-55보다 높게 측정되었고, integrated-reranked slow case가 top slow case에 들어왔다. 다음 단계는 reranked path와 semantic validation 중 어느 쪽이 dominant인지 다시 분리해야 한다.

### 다음 작업

P2-57 후보: `integrated reranked path diagnostics`

권장 작업:

1. `integrated-reranked` sub-search가 발생하는 case의 input count와 phase timing을 별도로 요약한다.
2. reranked path cap 또는 expansion setup을 줄여도 integrated recall이 유지되는지 확인한다.
3. semantic validation이 dominant인 integrated case는 별도 단계에서 validation phase split을 검토한다.

---

## 2026-05-06 / P2-57 완료: integrated reranked path diagnostics

### 목표

P2-56 이후 slow case에 `integrated-reranked` path가 들어왔지만 기존 리포트는 stage별 aggregate만 보여주어 어떤 case에서 reranked path가 발생했고 input 규모가 얼마나 큰지 바로 보기 어려웠다. P2-57은 `integrated-reranked`만 별도로 분리해 case count, sub-search latency, corpus phase timing, exact/lexical input count를 요약하는 것을 목표로 했다.

### 구현

변경 파일:

- `src/lib/ragBenchmarkReport.ts`
  - `BenchmarkIntegratedRerankedPathSummary` / case summary 추가.
  - `search-store-latency`와 `sub-search-latency` trace에서 `integrated-reranked`만 추출해 aggregate/case list 생성.
- `src/lib/ragQualityReport.ts`
  - Benchmark Performance 섹션에 `Integrated reranked path` 한 줄 요약 추가.
- `src/lib/ragBenchmarkDiagnostics.ts`
  - diagnostics markdown에 `Integrated reranked path diagnostics` 섹션 추가.
- `tests/ragBenchmarkReport.test.ts`
- `tests/ragBenchmarkDiagnostics.test.ts`
- `tests/ragQualityReport.test.ts`

### 검증

통과:

- `npx.cmd tsx --test tests/ragBenchmarkReport.test.ts tests/ragBenchmarkDiagnostics.test.ts tests/ragQualityReport.test.ts`
  - 16 tests pass
- `npm.cmd run lint`
- `npm.cmd run rag:bench`
  - archive: `benchmarks/results/rag-benchmark-2026-05-06T09-19-08-062Z.json`
  - Top-3 doc recall: 96.3% (26/27)
  - Top-5 doc recall: 96.3% (26/27)
  - Expected evidence / forbidden evidence / required citation: 100.0% / 100.0% / 100.0%
- `npm.cmd run rag:quality-report`
- `npm.cmd run rag:benchmark-diagnostics`

### 결과

P2-57 benchmark 기준:

- Integrated reranked path: cases 2
- Sub-search latency: avg 185.5ms, p95 217ms, max 217ms
- Corpus phase total avg: 185ms
- Exact input/output avg: 13,799/15
- Lexical input/output avg: 13,799/24
- Slow cases:
  - `integrated-benefit-cost-notice`
  - `integrated-evaluation-doc-not-penalized`

### 해석

- `integrated-reranked`는 rerank 계산이 dominant가 아니라 exact/lexical scoring input이 전체 corpus 13,799 chunks로 풀리는 것이 병목이었다.
- 따라서 다음 단계는 reranked path에도 conservative lexical candidate cap을 적용해 exact/lexical input을 제한하고 품질 유지 여부를 확인하는 것이 맞다.

---

## 2026-05-06 / P2-58 완료: integrated reranked lexical candidate cap 2,000

### 목표

P2-57에서 `integrated-reranked`의 exact/lexical input이 전체 13,799 chunks로 확인되었다. P2-58은 reranked path에 `RAG_INTEGRATED_RERANKED_MAX_LEXICAL_CHUNKS` 기본값 2,000을 추가해 input 규모와 latency를 줄이면서 benchmark 품질이 유지되는지 확인했다.

### TDD

추가 테스트:

- `tests/ragExecutionTrace.test.ts`
  - `RAG_INTEGRATED_RERANKED_MAX_LEXICAL_CHUNKS` 기본값이 2,000인지 검증.
  - `integrated-reranked` search option에 해당 cap이 연결되는지 검증.

### 구현

변경 파일:

- `src/lib/nodeRagService.ts`
  - `INTEGRATED_RERANKED_MAX_LEXICAL_CHUNKS` env/config 추가.
  - `integrated-reranked` sub-search에 `maxLexicalCandidateChunks` 적용.
- `tests/ragExecutionTrace.test.ts`
- `docs/plans/rag-search-performance-progress.md`

### 검증

통과:

- `npx.cmd tsx --test tests/ragExecutionTrace.test.ts tests/ragBenchmarkReport.test.ts tests/ragBenchmarkDiagnostics.test.ts tests/ragQualityReport.test.ts`
  - 19 tests pass
- `npm.cmd run lint`
- `npm.cmd run rag:bench`
  - archive: `benchmarks/results/rag-benchmark-2026-05-06T09-21-55-160Z.json`
  - Top-3 doc recall: 96.3% (26/27)
  - Top-5 doc recall: 96.3% (26/27)
  - Expected evidence pass: 100.0% (27/27)
  - Forbidden evidence pass: 100.0% (27/27)
  - Required citation pass: 100.0% (27/27)
- `npm.cmd run rag:quality-report`
- `npm.cmd run rag:benchmark-diagnostics`

### 결과

`docs/reports/rag-quality-report.md` 기준:

- Case latency: avg 211.1ms, p95 628ms, max 1,557ms
- Retrieval latency: avg 123.1ms, p95 192ms, max 251ms
- Top-3/Top-5 doc recall: 96.3% / 96.3%
- Expected evidence / forbidden evidence / required citation: 100.0% / 100.0% / 100.0%

integrated reranked:

- P2-57:
  - cases 2
  - sub-search avg 185.5ms, p95 217ms
  - phase total avg 185ms
  - exact input/output avg 13,799/15
  - lexical input/output avg 13,799/24
- P2-58:
  - cases 2
  - sub-search avg 24ms, p95 30ms
  - phase total avg 23.5ms
  - exact input/output avg 2,000/12
  - lexical input/output avg 2,000/24

### 해석

- reranked path input 규모는 13,799 -> 2,000 chunks로 줄었고, sub-search avg는 185.5ms -> 24ms로 크게 내려갔다.
- benchmark 품질 지표는 유지되었다.
- 현재 remaining latency target은 reranked path보다 evaluation routing/base와 answer/semantic validation 쪽을 다시 봐야 한다.

### 다음 작업

P2-59 후보: `evaluation routing/base candidate cap review`

권장 작업:

1. P2-58 기준 `evaluation-routing`과 `evaluation-base`의 input count/phase timing을 다시 확인한다.
2. evaluation routing/base에도 conservative cap을 적용할 수 있는지, direct-support와 primary-manual path의 recall dependency가 있는지 분리한다.
3. 후보 cap은 routing/base를 각각 독립 단계로 적용하고, Top-3/Top-5 96.3%와 evidence/citation 100% 유지 여부를 확인한다.

---

## 2026-05-06 / P2-59 완료: evaluation routing/base candidate cap review

### 목표

P2-58 이후 `integrated-reranked` 병목은 해소되었고, 남은 반복 sub-search 중 `evaluation-routing`과 `evaluation-base`가 상위 target으로 남았다. P2-59는 evaluation routing/base에 보수 cap을 적용하되, evaluation recall이 깨지는 지점을 probe로 확인하는 것을 목표로 했다.

### TDD

추가 테스트:

- `tests/ragExecutionTrace.test.ts`
  - `RAG_EVALUATION_ROUTING_MAX_LEXICAL_CHUNKS` 기본값과 연결 검증.
  - `RAG_EVALUATION_BASE_MAX_LEXICAL_CHUNKS` 기본값과 연결 검증.

### 구현

변경 파일:

- `src/lib/nodeRagService.ts`
  - `EVALUATION_ROUTING_MAX_LEXICAL_CHUNKS` 기본값 2,400 추가.
  - `EVALUATION_BASE_MAX_LEXICAL_CHUNKS` 기본값 3,000 추가.
  - `evaluation-routing` / `evaluation-base` sub-search에 각각 cap 연결.
- `tests/ragExecutionTrace.test.ts`
- `docs/plans/rag-search-performance-progress.md`

### Probe

실패 probe:

- routing 2,000 / base 2,000
  - archive: `benchmarks/results/rag-benchmark-2026-05-06T09-25-05-796Z.json`
  - Top-3/Top-5 doc recall: 88.9% / 88.9%
  - failed recall: `evaluation-notice-period`, `evaluation-employee-rights-education`
- routing 2,000 / base 3,000
  - archive: `benchmarks/results/rag-benchmark-2026-05-06T09-26-07-823Z.json`
  - Top-3/Top-5 doc recall: 92.6% / 92.6%

통과 probe:

- routing 2,400 / base 3,000
  - archive: `benchmarks/results/rag-benchmark-2026-05-06T09-26-40-202Z.json`
  - Top-3/Top-5 doc recall: 96.3% / 96.3%
  - evidence/citation: 100%

### 검증

최종 기본값 기준 통과:

- `npx.cmd tsx --test tests/ragExecutionTrace.test.ts tests/ragBenchmarkReport.test.ts tests/ragBenchmarkDiagnostics.test.ts tests/ragQualityReport.test.ts`
  - 20 tests pass
- `npm.cmd run lint`
- `npm.cmd run rag:bench`
  - archive: `benchmarks/results/rag-benchmark-2026-05-06T09-27-51-288Z.json`
  - Top-3 doc recall: 96.3% (26/27)
  - Top-5 doc recall: 96.3% (26/27)
  - Expected evidence pass: 100.0% (27/27)
  - Forbidden evidence pass: 100.0% (27/27)
  - Required citation pass: 100.0% (27/27)
- `npm.cmd run rag:quality-report`
- `npm.cmd run rag:benchmark-diagnostics`
- `git diff --check`
  - exit 0, CRLF warning만 있음

### 결과

`docs/reports/rag-quality-report.md` 기준:

- Case latency: avg 211.7ms, p95 631ms, max 1,556ms
- Retrieval latency: avg 123.9ms, p95 192ms, max 247ms
- Top-3/Top-5 doc recall: 96.3% / 96.3%
- Expected evidence / forbidden evidence / required citation: 100.0% / 100.0% / 100.0%

search corpus phase timing:

- `evaluation-routing`
  - total avg 41.3ms, p95 65ms
  - exact input avg 2,384
  - lexical input avg 2,384
- `evaluation-base`
  - total avg 38.4ms, p95 53ms
  - exact input avg 2,832.4
  - lexical input avg 2,832.4
- `integrated-reranked`
  - total avg 25.5ms, p95 31ms
  - exact/lexical input avg 2,000

### 해석

- evaluation routing은 기존 평균 input 2,384라 2,400 cap이 사실상 품질 보존 경계선이다.
- evaluation base는 2,000 cap에서 recall 손실이 났고 3,000 cap에서 품질이 회복됐다. 평균 input은 2,832.4로 소폭만 제한되므로, base는 당장 latency 최적화보다 recall safety를 우선한다.
- P2-59의 실질 성과는 routing/base의 안전한 하한을 확인하고, 2,000 일괄 cap이 위험하다는 회귀 방어선을 남긴 것이다.

### 다음 작업

P2-60 후보: `semantic validation latency split`

권장 작업:

1. P2-59 기준 slow case에서 retrieval phase 중 `semantic-validation`이 차지하는 비중을 분리 요약한다.
2. validation issue별 비용과 evidence count/doc count의 상관을 확인한다.
3. 품질 지표를 건드리지 않는 범위에서 validation cache 또는 early-exit 후보를 검토한다.

---

## 2026-05-06 / P2-60 완료: semantic validation latency split

### 목표

P2-59 이후 sub-search 병목은 많이 줄었고, slow case의 retrieval phase에서 `semantic-validation`이 큰 비중을 차지하는지 별도로 볼 필요가 생겼다. P2-60은 기존 `retrieval-phase-timing` trace에서 semantic validation latency를 추출해 benchmark/diagnostics/quality report에 aggregate와 case list로 노출하는 것을 목표로 했다.

### 구현

변경 파일:

- `src/lib/ragBenchmarkReport.ts`
  - `BenchmarkSemanticValidationLatencySummary` / case summary 추가.
  - case별 semantic validation ms, retrieval ms, retrieval share, evidence output count 집계.
- `src/lib/ragQualityReport.ts`
  - Benchmark Performance 섹션에 semantic validation latency 한 줄 요약 추가.
- `src/lib/ragBenchmarkDiagnostics.ts`
  - diagnostics markdown에 `Semantic validation latency diagnostics` 섹션 추가.
- `tests/ragBenchmarkReport.test.ts`
- `tests/ragBenchmarkDiagnostics.test.ts`
- `tests/ragQualityReport.test.ts`

### 검증

통과:

- `npx.cmd tsx --test tests/ragExecutionTrace.test.ts tests/ragBenchmarkReport.test.ts tests/ragBenchmarkDiagnostics.test.ts tests/ragQualityReport.test.ts`
  - 21 tests pass
- `npm.cmd run lint`
- `npm.cmd run rag:bench`
  - archive: `benchmarks/results/rag-benchmark-2026-05-06T09-32-04-502Z.json`
  - Top-3 doc recall: 96.3% (26/27)
  - Top-5 doc recall: 96.3% (26/27)
  - Expected evidence / forbidden evidence / required citation: 100.0% / 100.0% / 100.0%
- `npm.cmd run rag:quality-report`
- `npm.cmd run rag:benchmark-diagnostics`

### 결과

`docs/reports/rag-quality-report.md` 기준:

- Case latency: avg 211.6ms, p95 632ms, max 1,588ms
- Retrieval latency: avg 122.4ms, p95 190ms, max 253ms
- Semantic validation latency:
  - cases 27
  - avg 35.4ms, p95 63ms, max 68ms
  - avg retrieval share 32.0%
- Slow cases:
  - `integrated-no-grounded-answer`: 68ms, retrieval share 56.2%, evidence output 0
  - `integrated-long-service-faq`: 63ms, retrieval share 52.5%, evidence output 16
  - `integrated-claim-work-guide`: 62ms, retrieval share 56.9%, evidence output 19
  - `integrated-eligibility-law`: 62ms, retrieval share 41.9%, evidence output 16
  - `integrated-workforce-standard`: 59ms, retrieval share 39.1%, evidence output 18

### 해석

- semantic validation은 모든 benchmark case에서 발생하며 평균 retrieval latency의 약 32%를 차지한다.
- 특히 integrated case와 negative abstain case에서 validation share가 50% 안팎까지 올라간다.
- 다음 단계는 validation cache 또는 evidence/doc count 기반 early-exit 가능성을 보되, validation signal pass 100%를 반드시 유지해야 한다.

### 다음 작업

P2-61 후보: `semantic validation cache or early-exit probe`

권장 작업:

1. 동일 evidence/document set에 대해 semantic validation 결과를 memoize할 수 있는지 key 안정성을 검토한다.
2. evidence output 0인 accepted abstain case와 evidence output이 많은 integrated case를 분리해 early-exit 후보를 찾는다.
3. validation signal pass 100%와 claim coverage 100%를 유지하는지 benchmark로 확인한다.

---

## 2026-05-06 / P2-61 완료: semantic validation support scoring cache

### 목표

P2-60에서 semantic validation이 평균 retrieval latency의 32.0%를 차지하는 것으로 확인되었다. P2-61은 validation signal을 건드리는 early-exit 대신, claim/evidence support scoring 내부의 반복 정규화 비용을 줄이는 cache를 우선 적용하는 것을 목표로 했다.

### 구현

변경 파일:

- `src/lib/ragSemanticValidation.ts`
  - validation 호출 단위 `ClaimEvidenceSupportCache` 추가.
  - support anchor 정규화 결과와 chunk support field 정규화 결과를 재사용.
  - `buildClaimPlan()`과 `buildClaimCoverageDetails()` 내부의 반복 `analyzeClaimEvidenceSupport()` 호출이 같은 cache를 공유하도록 변경.
- `docs/plans/rag-search-performance-progress.md`

### 검증

통과:

- `npm.cmd run lint`
- `npx.cmd tsx --test tests/ragExecutionTrace.test.ts tests/ragBenchmarkReport.test.ts tests/ragBenchmarkDiagnostics.test.ts tests/ragQualityReport.test.ts`
  - 21 tests pass
- `npm.cmd run rag:bench`
  - archive: `benchmarks/results/rag-benchmark-2026-05-06T10-16-11-340Z.json`
  - Top-3 doc recall: 96.3% (26/27)
  - Top-5 doc recall: 96.3% (26/27)
  - Expected evidence / forbidden evidence / required citation: 100.0% / 100.0% / 100.0%
  - Validation signal pass: 100.0% (3 checks)
  - Claim coverage pass: 100.0% (3 checks)
- `npm.cmd run rag:quality-report`
- `npm.cmd run rag:benchmark-diagnostics`

주의:

- `npx.cmd tsx --test tests/semanticValidation.test.ts`는 기존 미커밋 semantic validation 변경과 맞물린 2개 테스트가 실패 중이다.
  - `answer validation warning block uses Korean user-facing labels and details`
  - `facility care selection treats facility benefit evidence as the selected service scope`
  - 이번 cache 변경 전부터 같은 파일에 evaluation authority/mixed scope 관련 미커밋 변경이 섞여 있어, P2-61의 benchmark 품질 검증과는 별도 잔여 리스크로 분리한다.

### 결과

`docs/reports/rag-quality-report.md` 기준:

- Case latency: avg 194.9ms, p95 652ms, max 1,603ms
- Retrieval latency: avg 101.8ms, p95 188ms, max 229ms
- Semantic validation latency:
  - P2-60: avg 35.4ms, p95 63ms, max 68ms, avg retrieval share 32.0%
  - P2-61: avg 6.6ms, p95 12ms, max 12ms, avg retrieval share 8.2%
- 품질 지표는 유지되었다.

### 해석

- semantic validation 병목의 핵심은 claim/evidence support scoring 중 anchor와 chunk field 정규화 반복이었다.
- cache 적용만으로 validation 평균과 p95가 크게 내려갔다.
- p95 retrieval은 큰 폭으로 줄지 않았지만 retrieval avg는 122.4ms -> 101.8ms로 개선됐다.

### 다음 작업

P2-62 후보: `post-cache retrieval latency target refresh`

권장 작업:

1. P2-61 기준 최신 sub-search, search-store, corpus phase, slow case target을 다시 확인한다.
2. semantic validation 이후 남은 dominant phase가 execute-search인지 evidence/context assembly인지 분리한다.
3. `tests/semanticValidation.test.ts`의 잔여 실패 2건은 별도 stabilization 단계로 분리할지 결정한다.

---

## 2026-05-06 / P2-62 완료: post-cache retrieval latency target refresh

### 목표

P2-61 이후 semantic validation 병목이 크게 줄었으므로, 최신 benchmark 기준으로 남은 retrieval dominant phase를 다시 확인하고 품질을 깨지 않는 작은 기본 성능 개선 후보를 판정했다.

### Probe

실패 probe:

- `RAG_ENABLE_EVALUATION_BASE_LEXICAL_POOL_REUSE=true npm.cmd run rag:bench`
  - archive: `benchmarks/results/rag-benchmark-2026-05-06T10-17-39-899Z.json`
  - Top-3 doc recall: 88.9%
  - Top-5 doc recall: 96.3%
  - evaluation-base를 이전 lexical pool로 대체하는 replacement reuse는 Top-3 안전성이 부족해 기본값 후보에서 제외했다.

통과 probe:

- `RAG_ENABLE_EVALUATION_BASE_LEXICAL_POOL_REUSE=false; RAG_ENABLE_EVALUATION_BASE_LEXICAL_POOL_MERGE=true npm.cmd run rag:bench`
  - archive: `benchmarks/results/rag-benchmark-2026-05-06T10-18-11-599Z.json`
  - Top-3/Top-5 doc recall: 96.3% / 96.3%
  - Expected evidence / forbidden evidence / required citation: 100.0% / 100.0% / 100.0%

### 구현

변경 파일:

- `src/lib/nodeRagService.ts`
  - `RAG_ENABLE_EVALUATION_BASE_LEXICAL_POOL_MERGE` 기본값을 `false`에서 `true`로 변경했다.
  - replacement reuse는 opt-in으로 유지하고, 기본 경로는 precomputed lexical candidates를 full posting pool에 merge하는 `merge-only` 전략으로 고정했다.
- `tests/ragExecutionTrace.test.ts`
  - evaluation-base lexical pool merge 기본값과 trace wiring을 확인하는 회귀 테스트를 추가했다.
- `docs/plans/rag-search-performance-progress.md`

### 검증

통과:

- `npm.cmd run lint`
- `npx.cmd tsx --test tests/ragExecutionTrace.test.ts tests/ragBenchmarkReport.test.ts tests/ragBenchmarkDiagnostics.test.ts tests/ragQualityReport.test.ts`
  - 22 tests pass
- `npm.cmd run rag:bench`
  - archive: `benchmarks/results/rag-benchmark-2026-05-06T10-21-17-503Z.json`
  - Top-3 doc recall: 96.3% (26/27)
  - Top-5 doc recall: 96.3% (26/27)
  - Expected evidence / forbidden evidence / required citation: 100.0% / 100.0% / 100.0%
  - Validation signal pass: 100.0% (3 checks)
  - Claim coverage pass: 100.0% (3 checks)
- `npm.cmd run rag:quality-report`
- `npm.cmd run rag:benchmark-diagnostics`
- `git diff --check`
  - exit 0, CRLF warning만 있음

### 결과

`docs/reports/rag-quality-report.md` 기준:

- Case latency: avg 185.8ms, p95 613ms, max 1,522ms
- Retrieval latency: avg 96.5ms, p95 173ms, max 207ms
- Semantic validation latency: avg 6.1ms, p95 9ms, max 17ms, avg retrieval share 8.2%
- Lexical pool reuse: cases 9, avg coverage 99.1%, min coverage 95.8%, guard accepted=9

search corpus phase timing:

- `evaluation-routing`: total avg 42.9ms, p95 66ms
- `evaluation-base`: total avg 39.1ms, p95 57ms
- `integrated-initial`: total avg 33.1ms, p95 61ms
- `integrated-reranked`: total avg 27.5ms, p95 31ms

### 해석

- replacement reuse는 lexical pool을 너무 강하게 줄여 Top-3 recall을 잃는다.
- merge-only는 target lexical candidates를 잃지 않으면서 prior stage candidates를 보강하므로 품질 지표를 유지했다.
- 개선 폭은 작지만 P2-61 기준 retrieval avg 101.8ms에서 96.5ms로 더 내려갔고, p95도 188ms에서 173ms로 개선됐다.
- 현재 남은 큰 비용은 여전히 evaluation/integrated execute-search 내부 corpus scoring이다.

### 다음 작업

P2-63 후보: `semantic validation residual test stabilization`

권장 작업:

1. `tests/semanticValidation.test.ts` 잔여 실패 2건을 독립적으로 재현한다.
2. P2-61 cache와 무관한 기존 semantic authority/mixed service scope 변경인지 확인한다.
3. benchmark 품질을 유지하면서 user-facing warning label과 facility scope selection 기대값을 안정화한다.

---

## 2026-05-06 / P2-63 완료: semantic validation residual test stabilization

### 목표

P2-61에서 별도 잔여 리스크로 분리했던 `tests/semanticValidation.test.ts` 실패 2건을 안정화했다. 대상은 user-facing warning 문구가 내부 validation code를 노출하지 않도록 하는 것과, 시설급여 선택 상태에서 다른 급여유형 근거가 섞였을 때 mixed scope warning을 유지하는 것이다.

### 구현

변경 파일:

- `src/lib/ragSemanticValidation.ts`
  - `appendValidationWarnings()`가 `additionalChecks`뿐 아니라 `blocks`에도 `type: 'warning'`, `title: '추가 확인이 필요한 부분'` 블록을 병합하도록 변경했다.
  - warning block item은 기존 `formatValidationIssueForAnswer()`를 사용해 `Missing slots`, `mixed-service-scope`, `institution_type`, `recipient_grade` 같은 내부 코드/slot명을 사용자에게 노출하지 않도록 했다.
  - mixed service scope 판정은 compliance intent에서는 선택한 급여유형과 다른 non-legal evidence가 하나라도 섞이면 warning을 유지한다.
  - cost/reference lookup 성격의 benchmark case는 기존 관대 기준을 유지해, 다양한 관련 고시/매뉴얼 근거가 함께 검색되는 정상 결과를 unexpected validation으로 보지 않게 했다.
- `docs/plans/rag-search-performance-progress.md`

### 검증

통과:

- `npx.cmd tsx --test tests/semanticValidation.test.ts`
  - 5 tests pass
- `npx.cmd tsx --test tests/semanticValidation.test.ts tests/ragEvaluationValidation.test.ts`
  - 6 tests pass
- `npx.cmd tsx --test tests/semanticValidation.test.ts tests/ragEvaluationValidation.test.ts tests/ragExecutionTrace.test.ts tests/ragBenchmarkReport.test.ts tests/ragBenchmarkDiagnostics.test.ts tests/ragQualityReport.test.ts`
  - 28 tests pass
- `npm.cmd run lint`
- `npm.cmd run rag:bench`
  - archive: `benchmarks/results/rag-benchmark-2026-05-06T10-27-25-336Z.json`
  - Top-3 doc recall: 96.3% (26/27)
  - Top-5 doc recall: 96.3% (26/27)
  - Expected evidence / forbidden evidence / required citation: 100.0% / 100.0% / 100.0%
  - Validation signal pass: 100.0% (3 checks)
  - Claim coverage pass: 100.0% (3 checks)
- `npm.cmd run rag:quality-report`
- `npm.cmd run rag:benchmark-diagnostics`
- `git diff --check`
  - exit 0, CRLF warning만 있음

### 결과

`docs/reports/rag-quality-report.md` 기준:

- Case latency: avg 183.6ms, p95 628ms, max 1,520ms
- Retrieval latency: avg 93.3ms, p95 176ms, max 210ms
- Semantic validation latency: avg 6.4ms, p95 11ms, max 14ms, avg retrieval share 8.9%
- Lexical pool reuse: cases 9, avg coverage 99.1%, min coverage 95.8%, guard accepted=9

### 해석

- P2-61의 cache 변경과 무관했던 semantic validation 잔여 실패를 닫았다.
- warning block과 `additionalChecks`가 같은 formatter를 공유하므로, 앞으로 내부 validation code가 사용자 화면에 새는 회귀를 테스트로 잡을 수 있다.
- mixed scope warning은 compliance 질문에서는 엄격하게 유지하되, cost/reference lookup의 정상적인 mixed evidence bundle은 benchmark 기대값과 맞게 허용한다.

### 다음 작업

P2-64 후보: `execute-search corpus scoring target refresh`

권장 작업:

1. P2-63 최신 기준으로 `evaluation-routing`, `evaluation-base`, `integrated-initial`의 exact/lexical scoring 비용을 다시 분해한다.
2. recall을 깨지 않았던 cap 경계와 lexical pool merge 결과를 기준으로, exact scoring input을 줄일 수 있는 stage-specific guard 후보를 찾는다.
3. probe는 반드시 Top-3/Top-5 96.3%, evidence/citation 100%, validation signal 100%를 유지하는 경우만 기본값 후보로 승격한다.

---

## 2026-05-06 / P2-64 완료: execute-search corpus scoring target refresh

### 목표

P2-63 이후 dominant retrieval cost는 semantic validation이 아니라 execute-search 내부 corpus scoring이었다. P2-64는 lexical recall pool은 유지하면서 exact scoring input만 별도로 줄일 수 있는 stage-specific cap을 추가하고, 품질을 깨지 않는 integrated path 기본값을 찾는 것을 목표로 했다.

### 구현

변경 파일:

- `src/lib/ragEngine.ts`
  - `SearchOptions.maxExactCandidateChunks` 추가.
  - `exactCandidateChunks()`에서 exact scoring input만 별도 cap으로 제한하도록 변경했다.
  - lexical input은 기존 `maxLexicalCandidateChunks`와 lexical pool을 그대로 사용하므로 exact-only probe가 가능해졌다.
- `src/lib/nodeRagService.ts`
  - `RAG_INTEGRATED_INITIAL_MAX_EXACT_CHUNKS` 기본값 1,600 추가.
  - `RAG_INTEGRATED_RERANKED_MAX_EXACT_CHUNKS` 기본값 1,600 추가.
  - `RAG_EVALUATION_ROUTING_MAX_EXACT_CHUNKS` / `RAG_EVALUATION_BASE_MAX_EXACT_CHUNKS`는 각각 lexical safety cap을 fallback으로 유지했다.
  - search memo key에 `maxExactCandidateChunks`를 포함해 cap별 결과가 섞이지 않도록 했다.
- `tests/ragExecutionTrace.test.ts`
- `docs/plans/rag-search-performance-progress.md`

### Probe

실패 probe:

- integrated initial/reranked exact 1,200 + evaluation routing/base exact 1,600/2,000
  - archive: `benchmarks/results/rag-benchmark-2026-05-06T10-31-30-911Z.json`
  - Top-3/Top-5 doc recall: 92.6% / 92.6%
  - failed recall: `evaluation-employee-rights-education`
  - evaluation exact cap은 현재 안전 경계가 좁아 기본값 후보에서 제외했다.

통과 probe:

- integrated initial/reranked exact 1,600, evaluation exact 기본값 유지
  - archive: `benchmarks/results/rag-benchmark-2026-05-06T10-32-10-775Z.json`
  - Top-3/Top-5 doc recall: 96.3% / 96.3%
  - evidence/citation/validation/claim coverage 모두 100%

### 검증

통과:

- `npx.cmd tsx --test tests/ragExecutionTrace.test.ts tests/ragBenchmarkReport.test.ts tests/ragBenchmarkDiagnostics.test.ts tests/ragQualityReport.test.ts`
  - 23 tests pass
- `npm.cmd run lint`
- `npm.cmd run rag:bench`
  - archive: `benchmarks/results/rag-benchmark-2026-05-06T10-33-39-840Z.json`
  - Top-3 doc recall: 96.3% (26/27)
  - Top-5 doc recall: 96.3% (26/27)
  - Expected evidence / forbidden evidence / required citation: 100.0% / 100.0% / 100.0%
  - Validation signal pass: 100.0% (3 checks)
  - Claim coverage pass: 100.0% (3 checks)
- `npm.cmd run rag:quality-report`
- `npm.cmd run rag:benchmark-diagnostics`
- `git diff --check`
  - exit 0, CRLF warning만 있음

### 결과

`docs/reports/rag-quality-report.md` 기준:

- Case latency: avg 183.9ms, p95 622ms, max 1,536ms
- Retrieval latency: avg 93.8ms, p95 175ms, max 216ms
- Semantic validation latency: avg 6.2ms, p95 12ms, max 13ms, avg retrieval share 8.4%

search corpus phase timing:

- `integrated-initial`
  - total avg 30.0ms, p95 54ms
  - exact avg 12.5ms
  - exact input avg 1,345.5
  - lexical input avg 1,678.8
- `integrated-reranked`
  - total avg 23.0ms, p95 29ms
  - exact input avg 1,600
  - lexical input avg 2,000
- evaluation path는 exact cap 기본값을 lexical safety cap과 동일하게 유지했다.

### 해석

- integrated path는 exact scoring input을 1,600으로 제한해도 recall/evidence/citation/validation 품질을 유지했다.
- evaluation path는 exact-only cap을 낮추면 `evaluation-employee-rights-education` recall이 바로 깨져, 현재는 cap보다 다른 방식의 scoring shortcut이나 stage-specific authority guard가 필요하다.
- P2-64는 lexical recall pool을 유지하면서 exact scoring 비용만 줄이는 훅을 열어 두었고, integrated 경로에는 기본 개선을 적용했다.

### 다음 작업

P2-65 후보: `evaluation exact scoring safety analysis`

권장 작업:

1. `evaluation-employee-rights-education`에서 exact cap이 필요한 근거를 잃는 위치를 candidate trace로 확인한다.
2. evaluation exact input cap을 전역으로 낮추기보다, primary/manual/direct-support authority가 있는 경우에만 exact shortcut을 적용할 수 있는지 본다.
3. 품질 기준은 P2-64와 동일하게 Top-3/Top-5 96.3%, evidence/citation 100%, validation signal 100%로 유지한다.

---

## 2026-05-06 / P2-65 완료: evaluation exact scoring safety analysis

### 목표

P2-64에서 evaluation exact cap을 낮춘 probe가 `evaluation-employee-rights-education` recall을 깨뜨렸으므로, 안전 경계를 다시 확인하고 기본값 후보를 좁혔다.

### 분석

실패 probe 비교:

- archive: `benchmarks/results/rag-benchmark-2026-05-06T10-31-30-911Z.json`
- 설정: integrated exact 1,200, evaluation routing exact 1,600, evaluation base exact 2,000
- 실패 case: `evaluation-employee-rights-education`
- 실패 top3:
  - `2026년 주야간보호 평가매뉴얼(26년꺼만)`
  - `「재가요양보호사 인권보호 매뉴얼」 활용 안내`
  - `(붙임)_재가요양보호사_인권보호_매뉴얼(PDF)_최종`
- 최종 안전 경계 top3:
  - `2026년 주야간보호 평가매뉴얼(26년꺼만)`
  - `01-07-직원인권보호`
  - `01-06-직원교육`

해석:

- lexical stage의 top note에는 `01-07-직원인권보호`가 잡히지만, evaluation-base exact 후보가 22개에서 12개로 줄면 최종 rerank top3에서 expected doc이 밀린다.
- evaluation-base exact cap은 2,500에서도 같은 recall 손실을 냈고, 2,800에서 품질이 회복됐다.

### 구현

변경 파일:

- `src/lib/nodeRagService.ts`
  - `RAG_EVALUATION_BASE_MAX_EXACT_CHUNKS` 기본값을 2,800으로 설정했다.
  - `RAG_EVALUATION_ROUTING_MAX_EXACT_CHUNKS`는 routing lexical safety cap fallback을 유지했다.
- `tests/ragExecutionTrace.test.ts`
  - integrated exact 1,600, evaluation-base exact 2,800, evaluation-routing exact lexical fallback wiring을 확인하도록 회귀 테스트를 갱신했다.
- `docs/plans/rag-search-performance-progress.md`

### Probe

실패:

- `RAG_EVALUATION_BASE_MAX_EXACT_CHUNKS=2500 npm.cmd run rag:bench`
  - archive: `benchmarks/results/rag-benchmark-2026-05-06T10-35-45-169Z.json`
  - Top-3/Top-5 doc recall: 92.6% / 92.6%

통과:

- `RAG_EVALUATION_BASE_MAX_EXACT_CHUNKS=2800 npm.cmd run rag:bench`
  - archive: `benchmarks/results/rag-benchmark-2026-05-06T10-36-17-922Z.json`
  - Top-3/Top-5 doc recall: 96.3% / 96.3%
  - Expected evidence / forbidden evidence / required citation: 100.0% / 100.0% / 100.0%
  - Validation signal pass: 100.0% (3 checks)
  - Claim coverage pass: 100.0% (3 checks)

### 검증

통과:

- `npm.cmd run lint`
- `git diff --check`
  - exit 0, CRLF warning만 있음

주의:

- 기본값 패치 후 `tsx` 테스트와 benchmark 재실행은 Codex 사용량 제한으로 `require_escalated` 요청이 거절되어 수행하지 못했다.
- 다만 P2-65 통과 probe의 `RAG_EVALUATION_BASE_MAX_EXACT_CHUNKS=2800` 설정은 패치 후 기본값과 동등하다.
- P2-65 전 단계에서 같은 테스트 묶음은 통과했고, 이번 변경 후에는 정적 wiring 확인과 lint를 통과했다.

### 결과

`docs/reports/rag-quality-report.md` 기준:

- Case latency: avg 181.7ms, p95 615ms, max 1,531ms
- Retrieval latency: avg 92.0ms, p95 171ms, max 202ms
- `evaluation-base`
  - total avg 38.6ms, p95 57ms
  - exact avg 20.6ms
  - exact input avg 2,721
  - lexical input avg 2,835.2
- `integrated-initial`
  - total avg 29.2ms, p95 50ms
  - exact input avg 1,345.5

### 다음 작업

P2-66 후보: `exact cap verification refresh after quota reset`

권장 작업:

1. 사용량 제한 해제 후 현재 기본값 그대로 `tsx` 회귀 테스트 묶음과 `npm.cmd run rag:bench`를 재실행한다.
2. `rag:quality-report` / `rag:benchmark-diagnostics`를 다시 생성해 env probe가 아닌 default run archive로 최신 cache를 고정한다.
3. 이후에는 evaluation exact cap을 더 낮추기보다, `evaluation-employee-rights-education` 같은 authority-sensitive case에 한정된 rerank/authority guard를 검토한다.

---

## 2026-05-06 / P2-66 완료: exact cap verification refresh after quota reset

### 목표

P2-65에서 Codex 사용량 제한 때문에 수행하지 못했던 기본값 기준 테스트/benchmark를 재실행하고, env probe가 아닌 default run archive로 cache/report를 다시 고정했다.

### 검증

통과:

- `npx.cmd tsx --test tests/semanticValidation.test.ts tests/ragEvaluationValidation.test.ts tests/ragExecutionTrace.test.ts tests/ragBenchmarkReport.test.ts tests/ragBenchmarkDiagnostics.test.ts tests/ragQualityReport.test.ts`
  - 29 tests pass
- `npm.cmd run lint`
- `npm.cmd run rag:bench`
  - archive: `benchmarks/results/rag-benchmark-2026-05-06T14-15-04-953Z.json`
  - Top-3 doc recall: 96.3% (26/27)
  - Top-5 doc recall: 96.3% (26/27)
  - Expected evidence / forbidden evidence / required citation: 100.0% / 100.0% / 100.0%
  - Validation signal pass: 100.0% (3 checks)
  - Claim coverage pass: 100.0% (3 checks)
- `npm.cmd run rag:quality-report`
- `npm.cmd run rag:benchmark-diagnostics`
- `git diff --check`
  - exit 0, CRLF warning만 있음

### 결과

`docs/reports/rag-quality-report.md` 기준:

- Case latency: avg 201.3ms, p95 644ms, max 1,854ms
- Retrieval latency: avg 97.9ms, p95 176ms, max 228ms
- Semantic validation latency: avg 6.8ms, p95 12ms, max 12ms, avg retrieval share 8.9%
- Lexical pool reuse: cases 9, avg coverage 99.1%, min coverage 95.8%, guard accepted=9

search corpus phase timing:

- `evaluation-routing`: total avg 44.0ms, p95 64ms, exact input avg 2,384
- `evaluation-base`: total avg 40.8ms, p95 59ms, exact input avg 2,721, lexical input avg 2,835.2
- `integrated-initial`: total avg 32.3ms, p95 56ms, exact input avg 1,345.5, lexical input avg 1,678.8
- `integrated-reranked`: total avg 22.5ms, p95 27ms, exact input avg 1,600, lexical input avg 2,000

### 해석

- P2-65에서 probe로만 확인했던 exact cap 기본값이 default run에서도 품질을 유지했다.
- latency는 run variance로 P2-65 probe보다 높지만, exact input cap wiring과 품질 기준은 안정적으로 유지된다.
- evaluation path의 다음 개선은 전역 cap 추가 축소보다 authority-sensitive rerank/guard 분석이 맞다.

### 다음 작업

P2-67 후보: `evaluation authority-sensitive rerank guard analysis`

권장 작업:

1. `evaluation-employee-rights-education`에서 expected evaluation docs가 lexical/exact/fusion 단계별로 어디에서 score gap을 얻거나 잃는지 추적한다.
2. 직원인권보호/직원교육처럼 평가 지표 문서명이 query compound와 강하게 맞는 경우, exact cap을 낮추지 않고 rerank/authority boost로 안정화할 수 있는지 probe한다.
3. benchmark 품질 기준은 Top-3/Top-5 96.3%, evidence/citation 100%, validation signal 100%를 유지한다.

---

## 2026-05-06 / P2-67 완료: evaluation authority-sensitive rerank guard analysis

### 목표

P2-65/P2-66에서 `evaluation-employee-rights-education`이 evaluation-base exact cap에 민감하다는 점이 확인됐다. P2-67은 전역 cap을 더 낮추기 전에, 해당 케이스가 lexical/exact/fusion에서 어디서 흔들리는지 분석하고 작은 alias/rerank 후보를 probe했다.

### 분석

기본값 기준 `evaluation-employee-rights-education`:

- lexical stage top: `01-07-직원인권보호`
- final top5:
  - `2026년 주야간보호 평가매뉴얼(26년꺼만)`
  - `01-07-직원인권보호`
  - `01-06-직원교육`
  - `01-07-직원인권보호`
  - `01-06-직원교육`
- `evaluation-base` phase:
  - exact input 2,800
  - exact candidates 22
  - lexical input 3,002

실패 경계:

- evaluation-base exact 2,500에서는 `evaluation-employee-rights-education`이 다시 Top-3/Top-5 recall을 잃었다.
- alias 후보로 `직원인권침해교육`에 `직원교육`을 추가하는 probe를 했지만, 2,500 recall을 회복하지 못했다.

### Probe

실패:

- `RAG_EVALUATION_BASE_MAX_EXACT_CHUNKS=2500 npm.cmd run rag:bench`
  - archive: `benchmarks/results/rag-benchmark-2026-05-06T14-18-14-733Z.json`
  - Top-3/Top-5 doc recall: 92.6% / 92.6%
  - failed recall: `evaluation-employee-rights-education`
  - failed top5:
    - `2026년 주야간보호 평가매뉴얼(26년꺼만)`
    - `「재가요양보호사 인권보호 매뉴얼」 활용 안내`
    - `(붙임)_재가요양보호사_인권보호_매뉴얼(PDF)_최종`
    - `(붙임)_재가요양보호사_인권보호_매뉴얼(PDF)_최종`
    - `요양보호사_보수교육_운영지침_개정_전문(2026.3.)`

### 결정

- alias 보강은 성능/품질 개선에 기여하지 않아 되돌렸다.
- evaluation-base exact 2,800은 현재 안전 하한으로 유지한다.
- P2-67에서는 코드 기본값 변경 없이 분석 결과만 남긴다.

### 검증

통과:

- `npm.cmd run lint`
- `npm.cmd run rag:bench`
  - archive: `benchmarks/results/rag-benchmark-2026-05-06T14-18-59-925Z.json`
  - Top-3/Top-5 doc recall: 96.3% / 96.3%
  - Expected evidence / forbidden evidence / required citation: 100.0% / 100.0% / 100.0%
  - Validation signal pass: 100.0% (3 checks)
  - Claim coverage pass: 100.0% (3 checks)
- `npm.cmd run rag:quality-report`
- `npm.cmd run rag:benchmark-diagnostics`
- `git diff --check`
  - exit 0, CRLF warning만 있음

### 결과

`docs/reports/rag-quality-report.md` 기준:

- Case latency: avg 192.7ms, p95 653ms, max 1,554ms
- Retrieval latency: avg 100.2ms, p95 185ms, max 209ms
- `evaluation-base`: total avg 40.1ms, p95 60ms, exact input avg 2,721
- `integrated-initial`: total avg 33.3ms, p95 62ms, exact input avg 1,345.5

### 다음 작업

P2-68 후보: `evaluation authority trace diagnostics`

권장 작업:

1. benchmark diagnostics에 authority-sensitive cases의 top lexical/exact/fusion doc drift를 더 잘 보이게 하는 trace를 추가한다.
2. 특히 `evaluation-employee-rights-education`처럼 lexical top은 정답인데 final rerank가 exact 후보 수에 민감한 케이스를 자동 표식한다.
3. 이 진단을 먼저 추가한 뒤, 실제 rerank/authority boost는 trace 기반으로 좁게 설계한다.

---

## 2026-05-06 / P2-68 완료: evaluation authority trace diagnostics

### 목표

P2-67에서 `evaluation-employee-rights-education`이 lexical/exact 상위 후보에서는 정답 문서를 잡지만 final visible Top-5의 1위는 primary evaluation manual로 이동하는 것을 확인했다. P2-68은 이 authority-sensitive drift를 수동 분석 없이 benchmark diagnostics에서 바로 볼 수 있게 만드는 진단 단계로 진행했다.

### 변경

- `src/lib/ragEngine.ts`
  - internal `fusion` stage note에 `exact-top`, `fusion-top`을 추가했다.
- `src/lib/retrievalPipeline.ts`
  - 최종 retrieval diagnostics의 `fusion` stage note에도 `exact-top`, `fusion-top`을 추가했다.
  - benchmark archive가 실제로 읽는 final stage trace 기준으로 lexical/exact/fusion top doc를 모두 확인할 수 있게 했다.
- `src/lib/ragBenchmarkReport.ts`
  - `evaluationAuthorityTrace` performance summary를 추가했다.
  - `evaluation-` case만 대상으로 expected doc가 lexical top, exact top, fusion top, visible Top-5 중 어디서 잡혔는지 분류한다.
  - lexical/exact top은 expected doc인데 fusion top이 다른 경우를 `drift`로 표식한다.
- `src/lib/ragBenchmarkDiagnostics.ts`
  - markdown에 `Evaluation authority trace diagnostics` 섹션을 추가했다.
- `src/lib/ragQualityReport.ts`
  - quality report benchmark performance summary에 evaluation authority trace aggregate를 추가했다.
- 테스트:
  - `tests/ragBenchmarkReport.test.ts`
  - `tests/ragBenchmarkDiagnostics.test.ts`

### 검증

통과:

- `npx.cmd tsx --test tests/ragBenchmarkReport.test.ts tests/ragBenchmarkDiagnostics.test.ts tests/ragExecutionTrace.test.ts tests/retrievalPipelineGate.test.ts`
  - 35 tests passed
- `npm.cmd run lint`
- `npm.cmd run rag:bench`
  - archive: `benchmarks/results/rag-benchmark-2026-05-06T14-29-11-595Z.json`
  - Top-3/Top-5 doc recall: 96.3% / 96.3%
  - Expected evidence / forbidden evidence / required citation: 100.0% / 100.0% / 100.0%
  - Validation signal pass: 100.0% (3 checks)
  - Claim coverage pass: 100.0% (3 checks)
- `npm.cmd run rag:quality-report`
- `npm.cmd run rag:benchmark-diagnostics`
- `git diff --check`
  - exit 0, CRLF warning만 있음

### 결과

최신 archive `benchmarks/results/rag-benchmark-2026-05-06T14-29-11-595Z.json` 기준:

- Case latency: avg 201.0ms, p95 666ms, max 1,606ms
- Retrieval latency: avg 106.6ms, p95 188ms, max 219ms
- Semantic validation latency: avg 7.7ms, p95 13ms, max 13ms
- `evaluation-base`: total avg 43.3ms, p95 63ms, exact input avg 2,721, lexical input avg 2,835.2
- `integrated-initial`: total avg 33.1ms, p95 57ms, exact input avg 1,345.5, lexical input avg 1,678.8
- `integrated-reranked`: total avg 25.5ms, p95 29ms, exact input avg 1,600, lexical input avg 2,000

`Evaluation authority trace diagnostics`:

- Cases with expected doc: 9
- Lexical/exact/fusion top matches: 3 / 5 / 6
- Visible Top-5 matches: 9
- Drift cases: 3
- Missed Top-5 cases: 0
- 주요 drift:
  - `evaluation-employee-rights-education`: lexical/exact top `01-07-직원인권보호`, fusion/visible top `2026년 주야간보호 평가매뉴얼(26년꺼만)`
  - `evaluation-function-training`: lexical top `03-08-기능회복훈련`, exact/fusion/visible top `일상생활기능훈련_매뉴얼 (1)`
  - `evaluation-qa-casebook`: exact top `2.2026년_재가급여_평가매뉴얼_다빈도Q&A_사례집(1차)`, fusion/visible top `2020년_재가급여_평가매뉴얼_다빈도_Q&A_사례집`

### 해석

- 현재 품질은 유지되지만, authority-sensitive drift가 3건으로 정량화됐다.
- `evaluation-employee-rights-education`은 expected doc가 lexical/exact top에 있으므로 candidate recall 문제가 아니라 fusion authority/rerank 우선순위 문제로 보는 것이 맞다.
- `evaluation-base` exact cap 2,800 유지 판단은 그대로이며, 다음 최적화는 cap 축소보다 drift case에 한정한 rerank guard가 더 안전하다.

### 다음 작업

P2-69 후보: `evaluation authority drift rerank guard probe`

권장 작업:

1. P2-68에서 잡힌 drift 3건만 대상으로 authority guard 후보를 설계한다.
2. `evaluation-employee-rights-education`처럼 lexical/exact top expected doc가 있고 final fusion top만 다른 경우, expected evaluation subsection 문서를 Top-3 안에 유지하는 좁은 rerank boost를 probe한다.
3. probe는 먼저 env/feature flag로 제한 실행하고, Top-3/Top-5 96.3%, evidence/citation 100%, validation 100%를 유지하지 못하면 기본값에는 넣지 않는다.

---

## 2026-05-06 / P2-69 완료: evaluation authority drift rerank guard probe

### 목표

P2-68에서 확인한 authority drift 3건을 대상으로, 기본값을 바꾸지 않고 feature flag 기반의 좁은 rerank guard를 probe했다.

### 변경

- `src/lib/ragEngine.ts`
  - `SearchOptions.evaluationAuthorityDriftGuard`를 추가했다.
  - exact top candidate의 document family가 final rerank top에서 밀리는 경우, 해당 document family의 visible candidate에 `evaluation-authority-drift-guard` boost를 주는 probe path를 추가했다.
  - 기본값은 off이며 `RAG_ENABLE_EVALUATION_AUTHORITY_DRIFT_GUARD=true` 또는 SearchOptions flag로만 켜진다.
- `src/lib/nodeRagService.ts`
  - env flag를 search memo/searchStore option에 전달하도록 연결했다.
- `src/lib/retrievalPipeline.ts`
  - final stage trace에 guard 적용 여부 note를 노출한다.
- 테스트:
  - `tests/ragRerankPriority.test.ts`
    - synthetic exact-top evaluation section drift를 guard가 되돌리는지 검증했다.

### 검증

통과:

- `npx.cmd tsx --test tests/ragRerankPriority.test.ts tests/ragExecutionTrace.test.ts`
- `npm.cmd run lint`
- default off benchmark:
  - archive: `benchmarks/results/rag-benchmark-2026-05-06T14-35-12-740Z.json`
  - Top-3/Top-5 doc recall: 96.3% / 96.3%
  - Expected evidence / forbidden evidence / required citation: 100.0% / 100.0% / 100.0%
- guard on probe:
  - `RAG_ENABLE_EVALUATION_AUTHORITY_DRIFT_GUARD=true npm.cmd run rag:bench`
  - archive: `benchmarks/results/rag-benchmark-2026-05-06T14-45-11-185Z.json`
  - Top-3/Top-5 doc recall: 96.3% / 96.3%
  - Expected evidence / forbidden evidence / required citation: 100.0% / 100.0% / 100.0%
  - Validation signal / claim coverage: 100.0% / 100.0%

### Probe 결과

guard on 기준:

- authority trace:
  - Cases with expected doc: 9
  - Lexical/exact/fusion top matches: 3 / 5 / 7
  - Visible Top-5 matches: 9
  - Drift cases: 2
  - Missed Top-5 cases: 0
- 개선:
  - `evaluation-qa-casebook`
    - before: fusion/visible top `2020년_재가급여_평가매뉴얼_다빈도_Q&A_사례집`
    - after: fusion/visible top `2.2026년_재가급여_평가매뉴얼_다빈도Q&A_사례집(1차)`
- 미해결:
  - `evaluation-employee-rights-education`
    - still fusion/visible top `2026년 주야간보호 평가매뉴얼(26년꺼만)`
    - expected subsection `01-07-직원인권보호` remains Top-5 rank 2
  - `evaluation-function-training`
    - still fusion/visible top `일상생활기능훈련_매뉴얼 (1)`
    - expected `기능회복훈련(정리본)` remains Top-5

### 결정

- probe는 품질 회귀 없이 drift 3건 중 1건을 줄였지만, 핵심 대상인 `evaluation-employee-rights-education`에는 효과가 없었다.
- 따라서 기본값은 off로 유지한다.
- 다음 단계는 단순 exact-top guard가 아니라 expected subsection/indicator family와 primary manual family의 관계를 구분하는 더 정밀한 guard가 필요하다.

---

## 2026-05-06 / P2-70 완료: handoff-ready default benchmark/report refresh

### 목표

P2-69 probe 이후 `.rag-cache`가 guard-on 결과로 남지 않도록 default off 기준 benchmark/report를 다시 고정하고, 다음 스레드에서 바로 이어갈 수 있는 인계 상태를 만든다.

### 검증

통과:

- `npm.cmd run rag:bench`
  - archive: `benchmarks/results/rag-benchmark-2026-05-06T14-46-10-399Z.json`
  - Top-3/Top-5 doc recall: 96.3% / 96.3%
  - Expected evidence / forbidden evidence / required citation: 100.0% / 100.0% / 100.0%
  - Validation signal pass: 100.0% (3 checks)
  - Claim coverage pass: 100.0% (3 checks)
- `npm.cmd run rag:quality-report`
- `npm.cmd run rag:benchmark-diagnostics`
- `git diff --check`
  - exit 0, CRLF warning만 있음

### 최신 default 기준선

`benchmarks/results/rag-benchmark-2026-05-06T14-46-10-399Z.json` 기준:

- Case latency: avg 185.2ms, p95 623ms, max 1,524ms
- Retrieval latency: avg 94.1ms, p95 176ms, max 200ms
- Semantic validation latency: avg 6.9ms, p95 11ms, max 13ms
- `evaluation-base`: total avg 38.4ms, p95 56ms, exact input avg 2,721, lexical input avg 2,835.2
- `integrated-initial`: total avg 30.6ms, p95 55ms, exact input avg 1,345.5, lexical input avg 1,678.8
- `integrated-reranked`: total avg 22.0ms, p95 27ms, exact input avg 1,600, lexical input avg 2,000

Evaluation authority trace default:

- Cases with expected doc: 9
- Lexical/exact/fusion top matches: 3 / 5 / 6
- Visible Top-5 matches: 9
- Drift cases: 3
- Missed Top-5 cases: 0

---

## 2026-05-06 / P2-71 완료: evaluation subsection-aware authority guard 검토

### 목표

P2-69 probe 이후에도 남은 drift 2건을 확인하고, Phase 2 안에서 추가 guard를 더 넣을지 결정한다.

### 분석

최신 default archive `benchmarks/results/rag-benchmark-2026-05-06T14-46-10-399Z.json` 기준:

- `evaluation-employee-rights-education`
  - expected doc: `직원인권보호`
  - lexical top: `01-07-직원인권보호`
  - exact top: `01-07-직원인권보호`
  - fusion/visible top: `2026년 주야간보호 평가매뉴얼(26년꺼만)`
  - Top-5: rank 1 primary manual, rank 2 `01-07-직원인권보호`, rank 3 `01-06-직원교육`
  - rank 1/2 score gap: 1.0
- `evaluation-function-training`
  - expected doc: `기능회복훈련`
  - lexical top: `03-08-기능회복훈련`
  - exact/fusion/visible top: `일상생활기능훈련_매뉴얼 (1)`
  - Top-5: rank 1 `일상생활기능훈련_매뉴얼 (1)`, rank 2 `기능회복훈련(정리본)`
  - rank 1/2 score gap: 26.877
- `evaluation-qa-casebook`
  - default에서는 drift지만, P2-69 guard-on probe에서 fusion/visible top이 `2.2026년_재가급여_평가매뉴얼_다빈도Q&A_사례집(1차)`로 개선됐다.

### 결정

- 남은 drift 2건은 모두 Top-5 hit이며 Top-3/Top-5 quality metric을 깨지 않는다.
- `evaluation-employee-rights-education`은 score gap이 1.0뿐이라 guard로 순서를 바꾸는 것은 가능하지만, primary manual을 1위로 두는 현재 동작도 evidence 관점에서는 정당하다.
- `evaluation-function-training`은 `기능회복훈련`과 `일상생활기능훈련`이 훈련/기능 회복 family로 겹쳐 있어, subsection-aware guard를 넣으면 다른 평가 훈련 케이스에 과적합할 위험이 있다.
- P2-69 guard는 opt-in probe로 남기되 기본값은 off 유지한다.
- Phase 2에서는 더 이상 authority drift 미세 튜닝을 진행하지 않는다.

### 결과

P2-71은 코드 추가 없이 분석/결정 단계로 완료한다. 남은 drift는 Phase 2 종료 blocking issue가 아니라 P3 이후 운영 로그나 사용자 피드백 기반으로 다룰 residual ranking issue로 분류한다.

---

## 2026-05-06 / P2-72 완료: Phase 2 final 기준선 고정

### 목표

P2를 더 이상 세분화하지 않고 종료한다. P2-70에서 고정한 default benchmark/report를 Phase 2 final 기준선으로 채택한다.

### Phase 2 Final Archive

- `benchmarks/results/rag-benchmark-2026-05-06T14-46-10-399Z.json`

### Final Metrics

- Top-3 doc recall: 96.3%
- Top-5 doc recall: 96.3%
- Expected evidence pass: 100.0%
- Forbidden evidence pass: 100.0%
- Required citation pass: 100.0%
- Validation signal pass: 100.0% (3 checks)
- Claim coverage pass: 100.0% (3 checks)

Latency:

- Case latency: avg 185.2ms, p95 623ms, max 1,524ms
- Retrieval latency: avg 94.1ms, p95 176ms, max 200ms
- Semantic validation latency: avg 6.9ms, p95 11ms, max 13ms

Search corpus phase:

- `evaluation-base`: total avg 38.4ms, p95 56ms, exact input avg 2,721, lexical input avg 2,835.2
- `integrated-initial`: total avg 30.6ms, p95 55ms, exact input avg 1,345.5, lexical input avg 1,678.8
- `integrated-reranked`: total avg 22.0ms, p95 27ms, exact input avg 1,600, lexical input avg 2,000

Authority trace:

- Cases with expected doc: 9
- Lexical/exact/fusion top matches: 3 / 5 / 6
- Visible Top-5 matches: 9
- Drift cases: 3
- Missed Top-5 cases: 0

### P2 종료 판단

- RAG Phase 2의 성능/진단/청킹/neighbor/small-to-big/cap/semantic validation/authority diagnostics는 충분히 안정화됐다.
- 남은 개선 후보는 benchmark quality를 올리는 필수 작업이 아니라 residual ranking preference에 가깝다.
- 추가 P2 미세 튜닝은 ROI가 낮으므로 P2는 P2-72에서 종료한다.

### 다음 단계 후보

P3 후보: `RAG 운영 안정화 및 제품 UX/API 정리`

권장 작업:

1. P2 final benchmark를 회귀 기준선으로 고정하고 CI/수동 검증 루틴에 연결한다.
2. `RAG_ENABLE_EVALUATION_AUTHORITY_DRIFT_GUARD`는 기본 off인 실험 flag로 문서화한다.
3. 사용자-facing retrieval trace에서 authority drift diagnostics를 너무 자세히 노출하지 않고 admin/report 중심으로 유지한다.
4. 실제 사용자 질문 로그가 쌓이면 `evaluation-employee-rights-education`, `evaluation-function-training`류 residual ranking을 P3/P4에서 다시 판단한다.

### 다음 스레드 시작 멘트

이전 스레드에서 P2-72까지 완료했고, P2는 종료하기로 결정했습니다. Phase 2 final archive는 `benchmarks/results/rag-benchmark-2026-05-06T14-46-10-399Z.json`입니다. final metrics는 Top-3/Top-5 96.3%, evidence/citation/validation/claim coverage 100%, retrieval avg 94.1ms/p95 176ms입니다. P2-68 authority trace diagnostics, P2-69 opt-in `RAG_ENABLE_EVALUATION_AUTHORITY_DRIFT_GUARD` probe까지 들어갔지만 기본값은 off이고, 남은 authority drift 3건은 Top-5 hit라 P2 blocking issue가 아닌 residual ranking issue로 분류했습니다. 다음은 `docs/plans/rag-search-performance-progress.md` 하단의 P3 후보 `RAG 운영 안정화 및 제품 UX/API 정리`에서 시작해주세요.

---

## 2026-05-07 / P3-1 완료: Phase 2 final benchmark baseline CI 연결

### 목표

P2 final archive를 운영 안정화 기준선으로 고정하고, PR CI에서 archive 유실이나 품질 기준선 훼손을 빠르게 감지한다.

### 변경

- `src/lib/ragBenchmarkBaseline.ts`
  - Phase 2 final archive 기준선을 코드 상수로 고정했다.
  - Top-3/Top-5 hit, evidence/citation pass, validation/claim coverage, retrieval latency avg/p95, case p95를 검사하는 validator를 추가했다.
- `scripts/rag-baseline-check.ts`
  - `npm run rag:baseline` CLI를 추가했다.
  - 기본 입력은 `benchmarks/results/rag-benchmark-2026-05-06T14-46-10-399Z.json`이며, 필요 시 `RAG_BENCH_BASELINE_PATH`로 대체할 수 있다.
- `.github/workflows/ci.yml`
  - 기존 type check/build 뒤에 `npm run rag:baseline`을 연결했다.
- `.gitignore`
  - `benchmarks/results/`는 계속 생성물로 취급하되 Phase 2 final archive 1개만 추적 가능하게 예외 처리했다.
- `README.md`, `env.example`
  - 기준선 검사 루틴과 `RAG_ENABLE_EVALUATION_AUTHORITY_DRIFT_GUARD`의 기본 off/diagnostics-only 성격을 문서화했다.

### 기준선

- Archive: `benchmarks/results/rag-benchmark-2026-05-06T14-46-10-399Z.json`
- Required:
  - Top-3/Top-5 hits: 26/27 이상
  - Expected evidence / forbidden evidence / required citation: 27/27
  - Validation signal / claim coverage: 100%
  - Retrieval avg <= 120ms, retrieval p95 <= 250ms, case p95 <= 750ms

### 검증

- `npx.cmd tsx --test tests/ragBenchmarkBaseline.test.ts`
- `npm.cmd run rag:baseline`

### 다음 후보

P3-2 후보: 사용자-facing retrieval trace와 admin/report diagnostics 경계를 다시 점검해 authority drift 세부 진단이 일반 사용자 UI/API 응답에 과노출되지 않는지 확인한다.

---

## 2026-05-07 / P3-2 완료: user-facing authority drift trace sanitize

### 목표

`RAG_ENABLE_EVALUATION_AUTHORITY_DRIFT_GUARD`를 실험적으로 켠 경우에도 내부 probe marker가 일반 채팅 응답의 retrieval trace에 그대로 노출되지 않게 한다. benchmark/report diagnostics는 운영 분석용으로 유지한다.

### 변경

- `src/lib/ragPublicDiagnostics.ts`
  - user-facing `stageTrace.notes`에서 `evaluation-authority-drift-guard` marker를 제거한다.
  - user-facing `candidateDiagnostics.matchedTerms`에서도 같은 내부 marker를 제거한다.
- `server.ts`
  - `/api/chat` 응답의 `retrieval.stageTrace`와 `retrieval.candidateDiagnostics`에 sanitizer를 적용했다.
  - `/api/retrieval/inspect`, benchmark, quality report, diagnostics report는 그대로 두어 admin/report 중심의 상세 분석 경로를 유지했다.
- `tests/ragPublicDiagnostics.test.ts`
  - stage note 제거, 빈 notes 제거, candidate matched term 제거를 회귀 테스트로 고정했다.

### 검증

- `npx.cmd tsx --test tests/ragPublicDiagnostics.test.ts tests/ragBenchmarkBaseline.test.ts`
- `npm.cmd run rag:baseline`

### 다음 후보

P3-3 후보: 실제 사용자 질문 로그/피드백이 쌓였을 때 residual ranking issue를 재판단할 수 있도록 로그 필드와 운영 검토 루틴을 정리한다.

---

## 2026-05-07 / P3-3 완료: residual ranking 운영 로그 요약

### 목표

남은 authority drift 3건을 즉시 rerank tuning으로 더 밀지 않고, 실제 사용자 질문에서 반복되는지 확인할 수 있는 운영 로그 요약 경로를 만든다. 질문 원문/대화 전문 저장은 피하고, ranking 재검토에 필요한 최소 신호만 남긴다.

### 변경

- `src/lib/ragOperationalLog.ts`
  - query hash, PII-masked preview, normalized query hash/preview, mode/profile/scope, Top-5 document, final evidence document, validation issue, unsupported claim, fallback, latency를 담는 운영 로그 entry builder를 추가했다.
  - review signal:
    - `low_confidence`
    - `validation_issue`
    - `unsupported_claim`
    - `fallback_used`
    - `rank_evidence_gap`
    - `residual_ranking_candidate`
- `src/lib/nodeRagService.ts`
  - `/api/chat` 실행 결과를 in-memory 운영 로그에 기록한다.
  - answer cache hit도 같은 형태로 기록한다.
  - 로그 보관 개수는 `RAG_OPERATIONAL_RETRIEVAL_LOG_LIMIT`이며 기본 50건이다.
- `server.ts`
  - 관리자 전용 `GET /api/admin/rag/retrieval-log`를 추가했다.
- `README.md`, `env.example`
  - 로그의 privacy boundary와 운영 검토 기준을 문서화했다.

### 운영 판단 기준

- 단일 로그만으로 ranking을 바꾸지 않는다.
- 같은 질문군에서 `rank_evidence_gap`, `validation_issue`, `unsupported_claim`, `residual_ranking_candidate`가 반복될 때만 residual ranking 조정을 검토한다.
- `evaluation-employee-rights-education`, `evaluation-function-training`류 케이스는 실사용 질문 로그가 쌓인 뒤 P3/P4에서 재판단한다.

### 검증

- `npx.cmd tsx --test tests/ragOperationalLog.test.ts`
- `npm.cmd run lint`

### 다음 후보

P3-4 후보: 관리자 화면에서 retrieval-log 요약을 표시하거나, 필요 시 파일/DB persistence 없이도 운영자가 최근 review signal을 빠르게 볼 수 있는 UX를 추가한다.

---

## 2026-05-07 / P3-4 완료: admin retrieval-log UX

### 목표

P3-3에서 추가한 `GET /api/admin/rag/retrieval-log`를 관리자 화면에서 바로 확인할 수 있게 하여, 파일/DB persistence 없이도 운영자가 최근 review signal과 residual ranking 후보를 빠르게 볼 수 있게 한다.

### 변경

- `src/lib/ragOperationalLogView.ts`
  - retrieval-log entries를 관리자 화면용 summary로 집계한다.
  - signal count, review candidate count, 최신 관측 시각을 계산한다.
  - review signal label/tone mapping을 UI 밖의 순수 함수로 분리했다.
- `src/components/RagAdminPanel.tsx`
  - 관리자 refresh 흐름에서 `/api/admin/rag/retrieval-log`를 함께 조회한다.
  - 최근 검색 운영 로그 섹션을 추가해 전체 entry 수, 검토 후보 수, signal count, 최근 6개 query preview와 Top-1/evidence/latency/unsupported claim을 표시한다.
  - 질문 원문은 표시하지 않고 P3-3의 hash/PII-masked preview/privacy boundary를 유지한다.
- `tests/ragOperationalLogView.test.ts`
  - summary 집계, empty state, label/tone mapping을 고정했다.

### 검증

- `npx.cmd tsx --test tests/ragOperationalLogView.test.ts`
- `npm.cmd run lint`

### 다음 후보

P3-5 후보: 운영 로그에서 반복 signal을 사람이 판정하기 쉬운 형태로 내보내는 lightweight export 또는 report endpoint를 검토한다. 단, 실제 사용자 질문 원문 저장과 장기 persistence는 별도 보안/제품 결정 전까지 추가하지 않는다.

---

## 2026-05-07 / P3-5 완료: retrieval-log review report endpoint

### 목표

P3-3/P3-4의 운영 로그를 그대로 장기 저장하지 않고, 현재 메모리 window 안에서 반복되는 review signal을 사람이 판단하기 쉬운 report 형태로 집계한다.

### 변경

- `src/lib/ragOperationalLogReport.ts`
  - `normalizedQueryHash` 단위로 review candidate entry를 그룹화한다.
  - signal count, mode/profile/retrieval mode/readiness/confidence 분포, Top 문서, evidence 문서, validation issue, unsupported claim, fallback count, 평균 latency를 집계한다.
  - 원문 질문은 포함하지 않고 기존 hash/PII-masked preview 경계를 유지한다.
- `src/lib/nodeRagService.ts`
  - `getAdminRetrievalLogReport()`를 추가해 현재 in-memory operational log를 report builder에 연결했다.
- `server.ts`
  - 관리자 전용 `GET /api/admin/rag/retrieval-log/report?limit=20`를 추가했다.
- `README.md`
  - 운영 검토용 report endpoint를 문서화했다.
- `tests/ragOperationalLogReport.test.ts`
  - query hash 그룹화, signal pressure 정렬, 기본 limit을 고정했다.

### 검증

- `npx.cmd tsx --test tests/ragOperationalLogReport.test.ts tests/ragOperationalLogView.test.ts tests/ragOperationalLog.test.ts`
- `npm.cmd run lint`

### 다음 후보

P3-6 후보: report endpoint를 관리자 화면에 작은 “검토 리포트” 탭 또는 다운로드 가능한 JSON 링크로 노출할지 결정한다. 현재는 API만 추가해 제품 표면을 넓히지 않았다.

---

## 2026-05-07 / P3-6 완료: admin review report UX

### 목표

P3-5 report endpoint를 관리자 화면에 작게 연결해 운영자가 API를 직접 호출하지 않아도 반복 review signal 그룹을 확인할 수 있게 한다.

### 변경

- `src/components/RagAdminPanel.tsx`
  - refresh 시 `GET /api/admin/rag/retrieval-log/report?limit=8`를 함께 조회한다.
  - 최근 검색 운영 로그 섹션 안에 “검토 리포트” 요약을 추가했다.
  - normalized query hash 기준 group count, 최신 시각, 평균 retrieval latency, signal count, 대표 Top 문서를 표시한다.
  - 원문 질문 저장/표시 없이 기존 masked preview와 hash 기반 운영 경계를 유지한다.

### 검증

- `npm.cmd run lint`

### 다음 후보

P3-7 후보: 운영 report가 실제 사용 중 충분히 쌓였을 때 `evaluation-employee-rights-education`, `evaluation-function-training`류 residual ranking 후보가 반복되는지 확인하고, 반복 신호가 없으면 ranking tuning은 보류한다.

---

## 2026-05-07 / P3-7 완료: residual ranking review decision gate

### 목표

잔여 authority drift 3건을 즉시 tuning하지 않는 P2 결정을 운영 report에도 반영한다. 같은 normalized query hash에서 ranking-relevant signal이 반복되기 전까지는 `monitor`로 두고, 반복될 때만 `review_ranking`을 추천한다.

### 변경

- `src/lib/ragOperationalLogReport.ts`
  - report group에 `decision` 필드를 추가했다.
  - 기본 threshold는 동일 normalized query hash 2회 이상이다.
  - ranking-relevant signal은 `validation_issue`, `unsupported_claim`, `rank_evidence_gap`, `residual_ranking_candidate`로 제한했다.
  - 반복 기준 미달이면 ranking tuning을 보류하는 `monitor` decision을 반환한다.
- `src/components/RagAdminPanel.tsx`
  - 검토 리포트 group에 `ranking review`/`monitor` decision badge와 threshold 진행도를 표시한다.
- `tests/ragOperationalLogReport.test.ts`
  - 반복 ranking-relevant signal에서만 `review_ranking`이 나오는 기준을 고정했다.

### 검증

- `npx.cmd tsx --test tests/ragOperationalLogReport.test.ts`
- `npm.cmd run lint`

### 다음 후보

P3-8 후보: 운영 로그/report API의 auth, privacy, exposure boundary를 간단한 보안 회귀 테스트로 고정한다.

---

## 2026-05-07 / P3-8 완료: operational privacy boundary regression

### 목표

운영 로그와 review report가 원문 질문, 전화번호, 이메일, 주민등록번호 같은 민감정보를 새 경로로 다시 노출하지 않도록 회귀 테스트로 고정한다.

### 변경

- `tests/ragOperationalPrivacyBoundary.test.ts`
  - 운영 로그 preview와 report JSON에서 전화번호, 이메일, 주민등록번호 원문이 남지 않는지 확인한다.
  - report JSON에 per-entry `queryHash`가 노출되지 않고 group용 `normalizedQueryHash`만 남는 경계를 고정했다.
- `src/lib/ragOperationalLog.ts`
  - 주민등록번호가 전화번호 패턴에 먼저 부분 매칭되지 않도록 ID 마스킹을 전화번호 마스킹보다 먼저 수행한다.

### 검증

- `npx.cmd tsx --test tests/ragOperationalPrivacyBoundary.test.ts tests/ragOperationalLog.test.ts tests/ragOperationalLogReport.test.ts`

### 다음 후보

P3-9 후보: dev server에서 관리자 화면의 retrieval-log/report 섹션이 빈 상태와 데이터가 있을 때 모두 깨지지 않는지 브라우저 smoke test를 진행한다.

---

## 2026-05-07 / P3-9 완료: admin smoke test

### 목표

P3-4/P3-6 관리자 화면 변경이 dev server에서 기본 라우팅과 렌더링을 깨지 않는지 확인한다.

### 확인

- `npm run dev` 서버를 `http://localhost:3000`에서 실행했다.
- `GET /`는 200으로 응답했다.
- 인증 없는 `GET /api/admin/rag/retrieval-log`와 `GET /api/admin/rag/retrieval-log/report?limit=8`는 관리자 비밀번호 미설정 환경에서 503으로 차단됐다.
- Playwright로 `http://localhost:3000/admin`을 열어 페이지 title `장기요양 실무 보조`와 렌더링을 확인했다.
- 콘솔에는 기존 개발 환경 수준의 `favicon.ico` 404만 확인됐다.

### 다음 후보

P3-10 후보: 관리자 비밀번호가 설정된 환경에서 retrieval-log/report 섹션에 샘플 로그가 있을 때의 happy path를 별도 수동 점검하거나, mock 가능한 컴포넌트 테스트로 분리한다.

---

## 2026-05-07 / P3-10 완료: retrieval report limit clamp

### 목표

관리자 report API가 큰 `limit` 값을 받을 때 불필요하게 큰 응답을 만들지 않도록 report builder 수준에서 상한을 고정한다.

### 변경

- `src/lib/ragOperationalLogReport.ts`
  - `DEFAULT_OPERATIONAL_RETRIEVAL_REPORT_MAX_LIMIT = 100`을 추가했다.
  - report option `limit`이 100을 넘으면 100으로 clamp한다.
- `tests/ragOperationalLogReport.test.ts`
  - 과도한 limit 요청이 max limit으로 제한되는지 고정했다.

### 검증

- `npx.cmd tsx --test tests/ragOperationalLogReport.test.ts`
- `npm.cmd run lint`

### 다음 후보

P3-11 후보: 최종 검증을 다시 묶고, 14:00 전까지 변경 범위와 남은 수동 점검 항목을 정리한다.

---

## 2026-05-07 / P3-11 완료: authenticated admin retrieval report smoke

### 목표

관리자 비밀번호가 설정된 환경에서 retrieval-log/report API가 실제 인증 흐름으로 접근 가능한지 확인한다.

### 확인

- 별도 dev server를 `http://localhost:3001`에서 실행했다.
- `ADMIN_DASHBOARD_PASSWORD`, `ADMIN_JWT_SECRET`를 smoke 전용 값으로 설정했다.
- `POST /api/admin/session` 정상 비밀번호는 200과 bearer token을 반환했다.
- 잘못된 비밀번호는 401로 차단됐다.
- bearer token으로 `GET /api/admin/rag/retrieval-log`가 정상 응답했다.
- bearer token으로 `GET /api/admin/rag/retrieval-log/report?limit=10000`가 정상 응답했고, report limit은 100으로 clamp됐다.
- 서버에 기록된 운영 로그가 없는 초기 상태에서 `entries=0`, `reviewGroups=0` empty path가 정상 동작했다.

### 참고

- 3000번 dev server가 이미 실행 중인 상태라 3001번 서버에서는 Vite HMR WebSocket 기본 포트 충돌 경고가 발생했다. HTTP/API smoke에는 영향이 없었다.

### 다음 후보

P3-12 후보: 여러 dev server를 병렬로 띄우는 smoke 환경을 위해 Vite HMR 포트를 env로 분리할 수 있게 할지 검토한다.

---

## 2026-05-07 / P3-12 완료: parallel dev server HMR port override

### 목표

관리자 smoke처럼 여러 dev server를 병렬로 띄울 때 Vite HMR WebSocket 기본 포트가 충돌하지 않게 한다.

### 변경

- `vite.config.ts`
  - `VITE_HMR_PORT`가 설정되면 Vite HMR port로 사용한다.
  - `DISABLE_HMR=true`는 기존처럼 HMR을 끈다.
- `env.example`
  - `VITE_HMR_PORT` 설명을 추가했다.

### 확인

- `npm.cmd run lint`
- `npm.cmd run build`
- `PORT=3001`, `VITE_HMR_PORT=24679`, smoke용 `ADMIN_DASHBOARD_PASSWORD`, `ADMIN_JWT_SECRET`로 dev server를 실행했다.
- `3001` HTTP server와 `24679` HMR server가 함께 listen 됐다.
- 이전에 보였던 `Port 24678 is already in use` HMR 충돌 경고는 재현되지 않았다.
- 인증 후 `GET /api/admin/rag/retrieval-log/report?limit=10000`가 정상 응답했고 report limit은 100으로 clamp됐다.

### 다음 후보

P3-13 후보: 운영 로그/report 변경 묶음의 최종 회귀 검증을 다시 수행하고, 다음 스레드용 handoff 문구를 정리한다.

---

## 2026-05-07 / P3-13 완료: operational log/report regression closeout

### 목표

P3 운영 로그, review report, admin UX, privacy boundary, dev smoke 보조 설정을 한 번 더 묶어 검증하고 다음 스레드가 이어받을 수 있는 상태를 남긴다.

### 확인

- 3000, 3001, 24679 포트에 남아 있는 dev server listener가 없음을 확인했다.
- 운영 로그/report 관련 테스트 20개가 통과했다.
- Phase 2 final baseline `benchmarks/results/rag-benchmark-2026-05-06T14-46-10-399Z.json` 검증이 통과했다.
- `npm.cmd run lint`가 통과했다.
- `npm.cmd run build`가 통과했다.
- `git diff --check`가 통과했다. CRLF 변환 경고만 남아 있다.

### 다음 스레드 시작 문구

이전 스레드에서 P3-13까지 완료했습니다. P3 운영 안정화는 Phase 2 final baseline CI 연결, authority drift user-facing sanitize, in-memory operational retrieval log, admin retrieval-log UX, retrieval-log review report endpoint, ranking review decision gate, privacy boundary regression, authenticated admin smoke, Vite HMR port override까지 들어갔습니다. 검증은 관련 테스트 20개, `npm run rag:baseline`, `npm run lint`, `npm run build`, `git diff --check`가 통과했고 CRLF 경고만 남았습니다. 다음은 `docs/plans/rag-search-performance-progress.md` 하단의 다음 후보에서 이어가 주세요.

### 다음 후보

P3-14 후보: 현재 P3 변경 묶음을 PR/커밋 단위로 나누기 쉽게 파일 그룹과 risk를 정리하거나, 실제 운영 로그가 쌓이기 전까지 더 이상의 ranking tuning을 중단하고 제품/API 문서 정리로 이동한다.

---

## 2026-05-07 / P3-14 완료: operational review handoff

### 목표

P3 운영 로그/report 변경 묶음을 PR/커밋 리뷰 단위로 나누고, 실제 운영 로그가 충분히 쌓이기 전까지 ranking tuning을 보류하는 decision gate를 문서로 고정한다.

### 변경

- `docs/reports/rag-phase3-operational-review-handoff.md`
  - Phase 2 final baseline archive를 명시했다.
  - baseline CI, public authority drift boundary, operational retrieval log, review report, admin API/UX, dev smoke support를 review slice로 나눴다.
  - suggested commit order, admin API contract, privacy response boundary, remaining risks를 정리했다.
  - 같은 `normalizedQueryHash`에서 ranking-relevant signal이 반복될 때만 ranking review로 이동하는 gate를 명시했다.
- `README.md`
  - RAG 검증 섹션에서 Phase 3 operational review handoff 문서로 연결했다.

### 검증

- 문서 전용 변경이라 신규 런타임 테스트는 추가하지 않았다.

### 다음 후보

P3-15 후보: admin-only RAG operational API contract를 테스트로 고정할지 검토한다. endpoint response shape가 더 바뀌지 않는다면 제품/API 문서 정리를 계속하고, ranking tuning은 운영 report evidence가 decision gate를 만족할 때까지 보류한다.

---

## 2026-05-07 / P3-15 완료: admin operational API no-store contract

### 목표

관리자 운영 로그/report API가 인증 경계와 민감 응답 캐시 금지 경계를 함께 유지하도록 서버 smoke 계약 테스트로 고정한다.

### 변경

- `tests/adminOperationalApi.test.ts`
  - 실제 서버를 임시 포트로 띄워 admin session login을 수행한다.
  - 인증 없는 `/api/admin/rag/retrieval-log/report` 요청이 401로 차단되는지 확인한다.
  - 인증 후 `/api/admin/session`, `/api/admin/rag/retrieval-log`, `/api/admin/rag/retrieval-log/report?limit=10000` 응답이 `Cache-Control: no-store`를 반환하는지 확인한다.
  - report limit이 100으로 clamp되는 endpoint contract를 고정한다.
- `server.ts`
  - admin session token 응답과 `requireAdminAuth`를 통과하는 admin 응답에 `Cache-Control: no-store`를 설정했다.

### 검증

- `npx.cmd tsx --test tests/adminOperationalApi.test.ts`

### 다음 후보

P3-16 후보: admin operational API 문서에 `Cache-Control: no-store` contract를 반영하고, 시간이 남으면 관련 운영 로그/report 테스트 묶음과 `npm run lint`를 재실행한다. ranking tuning은 운영 report evidence가 P3-14 decision gate를 만족할 때까지 계속 보류한다.

---

## 2026-05-07 / P3-16 완료: admin operational API docs and grouped regression

### 목표

P3-15에서 추가한 admin no-store contract를 제품/API 문서에 반영하고, 운영 로그/report 테스트 묶음과 새 admin smoke contract가 함께 통과하는지 확인한다.

### 변경

- `README.md`
  - admin session과 admin-only RAG 운영 API 응답이 `Cache-Control: no-store`를 반환해야 한다는 운영 문서 문구를 추가했다.
- `docs/reports/rag-phase3-operational-review-handoff.md`
  - admin API contract에 no-store requirement를 추가했다.
  - P3-15/P3-16 추가 검증 명령과 다음 후보를 최신 상태로 갱신했다.

### 검증

- `npx.cmd tsx --test tests/ragOperationalLog.test.ts tests/ragOperationalLogView.test.ts tests/ragOperationalLogReport.test.ts tests/ragOperationalPrivacyBoundary.test.ts tests/adminOperationalApi.test.ts`
- `npm.cmd run lint`
- `git diff --check`

### 다음 후보

P3-17 후보: PR/staging 직전 최종 묶음 검증으로 `npm run rag:baseline`, `npm run build`까지 다시 실행한다. 이후에는 변경 묶음이 충분히 크므로 새 ranking tuning 없이 리뷰/커밋 분할로 이동한다.

---

## 2026-05-07 / P3-17 완료: final validation rerun

### 목표

P3-14~P3-16 추가 변경까지 포함해 PR/staging 직전 검증 묶음을 다시 통과시킨다.

### 확인

- `npm.cmd run rag:baseline`가 통과했다.
  - Phase 2 final archive: `benchmarks/results/rag-benchmark-2026-05-06T14-46-10-399Z.json`
  - Top-3/Top-5: 96.3% / 96.3%
  - evidence/citation: 27/27/27 of 27
  - validation/claim coverage: 100.0% / 100.0%
  - retrieval latency avg/p95: 94.1ms / 176ms
- `npm.cmd run build`가 통과했다.
  - 기존 Vite browser externalization warning(`fs`, `path` in `src/lib/ragNaturalQuery.ts`)만 남았다.
- `git diff --check`가 통과했다.
  - 기존 CRLF 변환 경고만 남았다.

### 다음 후보

P3-18 후보: 지금까지의 P3 변경 묶음을 리뷰 가능한 PR/커밋 단위로 실제 분할할지 결정한다. 코드 변경을 더 넣는다면 admin API smoke helper 중복 제거처럼 리뷰 표면을 줄이는 정리만 고려하고, ranking tuning은 계속 보류한다.

---

## 2026-05-07 / P3-18 완료: server smoke helper consolidation

### 목표

P3-15에서 추가한 admin operational smoke test와 기존 knowledge API smoke test가 중복으로 들고 있던 서버 프로세스 helper를 공통화해 리뷰 표면을 줄인다.

### 변경

- `tests/helpers/serverProcess.ts`
  - 임시 포트 탐색, 서버 readiness 대기, 서버 종료 helper를 공통 모듈로 분리했다.
- `tests/adminOperationalApi.test.ts`
  - 공통 helper를 사용하도록 정리했다.
- `tests/serverKnowledgeApi.test.ts`
  - 공통 helper를 사용하도록 정리했다.
  - cold-start 환경에서 readiness 대기가 불안정하지 않도록 timeout을 120초로 맞췄다.

### 검증

- `npx.cmd tsx --test tests/adminOperationalApi.test.ts tests/serverKnowledgeApi.test.ts`

### 다음 후보

P3-19 후보: P3 변경 묶음이 충분히 커졌으므로 새 기능 추가는 멈추고 최종 `npm run lint`, `git diff --check`, 필요 시 operational/admin test bundle 재실행 후 handoff를 종료한다. ranking tuning은 계속 보류한다.

---

## 2026-05-07 / P3-19 완료: operational/admin final test bundle

### 목표

P3-18 helper 정리 이후 운영 로그/report, privacy boundary, admin no-store smoke, knowledge API smoke가 함께 통과하는지 최종 확인한다.

### 검증

- `npx.cmd tsx --test tests/ragOperationalLog.test.ts tests/ragOperationalLogView.test.ts tests/ragOperationalLogReport.test.ts tests/ragOperationalPrivacyBoundary.test.ts tests/adminOperationalApi.test.ts tests/serverKnowledgeApi.test.ts`
  - tests 15, suites 2, pass 15
- 직전 검증:
  - `npm.cmd run lint`
  - `git diff --check`

### 다음 후보

P3-20 후보: 새 기능 추가는 멈추고, 리뷰/커밋 분할용 최종 handoff 문구를 정리한다. 이미 P3-14 handoff 문서에 commit order와 risk가 있으므로, 추가 변경은 문서 꼬리 정리와 최종 상태 확인으로 제한한다.

---

## 2026-05-07 / P3-20 완료: final review handoff

### 목표

P3 변경 묶음을 더 키우지 않고 리뷰/커밋 분할로 넘길 수 있도록 최종 handoff를 정리한다.

### 변경

- `docs/reports/rag-phase3-operational-review-handoff.md`
  - `Next Step Candidate`를 `Final Handoff`로 전환했다.
  - 최신 검증 bundle과 남은 경고 범위를 정리했다.
  - ranking tuning은 실제 operational report evidence가 decision gate를 만족할 때까지 보류한다고 명시했다.

### 최종 handoff 문구

이전 스레드에서 P3-20까지 완료했습니다. P3 운영 안정화는 Phase 2 final baseline CI 연결, authority drift user-facing sanitize, in-memory operational retrieval log, admin retrieval-log UX, retrieval-log review report endpoint, ranking review decision gate, privacy boundary regression, authenticated admin smoke, Vite HMR port override, operational review handoff, admin operational API `Cache-Control: no-store` contract, server smoke helper consolidation까지 들어갔습니다. 검증은 operational/admin 테스트 15개, `npm run rag:baseline`, `npm run lint`, `npm run build`, `git diff --check`가 통과했습니다. 남은 것은 기존 CRLF 변환 경고와 Vite의 `src/lib/ragNaturalQuery.ts` `fs`/`path` browser externalization warning입니다. 다음은 새 ranking tuning 없이 `docs/reports/rag-phase3-operational-review-handoff.md`의 commit order에 따라 리뷰/커밋 분할로 이동하세요.

---

## 2026-05-07 / P3-21 완료: admin no-store middleware hardening

### 목표

P3-15 no-store contract가 route handler 성공 응답뿐 아니라 `/api/admin` 인증 실패 응답에도 일관되게 적용되도록 경계를 단순화한다.

### 변경

- `server.ts`
  - `/api/admin` prefix 전체에 `Cache-Control: no-store` middleware를 적용했다.
  - `requireAdminAuth`와 admin session route 내부의 중복 no-store 설정을 제거했다.
- `tests/adminOperationalApi.test.ts`
  - 인증 없는 retrieval-log/report 401 응답도 `Cache-Control: no-store`인지 확인한다.
  - 잘못된 admin password 401 응답도 `Cache-Control: no-store`인지 확인한다.

### 검증

- `npx.cmd tsx --test tests/adminOperationalApi.test.ts`
- `npx.cmd tsx --test tests/ragOperationalLog.test.ts tests/ragOperationalLogView.test.ts tests/ragOperationalLogReport.test.ts tests/ragOperationalPrivacyBoundary.test.ts tests/adminOperationalApi.test.ts tests/serverKnowledgeApi.test.ts`
  - tests 15, suites 2, pass 15

### 최종 handoff 문구

이전 스레드에서 P3-21까지 완료했습니다. P3 운영 안정화는 Phase 2 final baseline CI 연결, authority drift user-facing sanitize, in-memory operational retrieval log, admin retrieval-log UX, retrieval-log review report endpoint, ranking review decision gate, privacy boundary regression, authenticated admin smoke, Vite HMR port override, operational review handoff, admin operational API `Cache-Control: no-store` contract, `/api/admin` no-store middleware hardening, server smoke helper consolidation까지 들어갔습니다. 검증은 operational/admin 테스트 15개, `npm run rag:baseline`, `npm run lint`, `npm run build`, `git diff --check`가 통과했습니다. 남은 것은 기존 CRLF 변환 경고와 Vite의 `src/lib/ragNaturalQuery.ts` `fs`/`path` browser externalization warning입니다. 다음은 새 ranking tuning 없이 `docs/reports/rag-phase3-operational-review-handoff.md`의 commit order에 따라 리뷰/커밋 분할로 이동하세요.

---

## 2026-05-07 / P3-22 완료: listener closeout

### 목표

서버-spawn smoke test 이후 개발용 포트에 남은 listener가 없는지 확인한다.

### 확인

- `Get-NetTCPConnection -State Listen` 기준 3000, 3001, 24678, 24679 listener가 없었다.

### 최종 상태

P3는 새 기능 추가를 멈추고 리뷰/커밋 분할로 넘길 수 있는 상태다. ranking tuning은 운영 report evidence가 P3-14 decision gate를 만족할 때까지 보류한다.

---

## 2026-05-07 / P3-23 완료: server smoke helper listener cleanup

### 목표

P3-18에서 공통화한 서버 smoke helper가 readiness 확인 후 이벤트 listener를 남기지 않도록 정리한다.

### 변경

- `tests/helpers/serverProcess.ts`
  - `waitForServerReady()`가 성공, timeout, 조기 exit 경로에서 stdout/stderr/exit listener와 timeout을 정리하도록 변경했다.

### 검증

- `npx.cmd tsx --test tests/adminOperationalApi.test.ts tests/serverKnowledgeApi.test.ts`

### 최종 상태

P3 변경은 리뷰/커밋 분할 단계로 넘긴다. 추가 ranking tuning은 계속 보류한다.
