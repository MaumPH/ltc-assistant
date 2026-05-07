# RAG 검색성능 고도화 계획

작성일: 2026-04-30
대상 저장소: `ltc-assistant`
대상 브랜치: `codex/rag-optimization-mainline`
목표: 지식파일 전체 활용률을 높이고, 인덱싱/청킹/검색/검증 파이프라인을 강화하여 장기요양 도메인 질의의 Top-K 검색 정확도와 최종 근거 품질을 고도화한다.

---

## 1. 현재 코드 리뷰 요약

### 확인한 주요 구성

- 지식 적재/인덱싱
  - `scripts/rag-index.ts`
  - `src/lib/nodeKnowledge.ts`
  - `src/lib/ragIndex.ts`
  - `src/lib/ragStore.ts`
- 구조화/청킹
  - `src/lib/ragStructured.ts`
  - `src/lib/ragMetadata.ts`
  - `src/lib/qualifierPatterns.ts`
- 임베딩/벡터 저장
  - `src/lib/embeddingService.ts`
  - `db/rag-schema.sql`
  - `docker-compose.pgvector.yml`
- 검색/랭킹/후처리
  - `src/lib/ragEngine.ts`
  - `src/lib/retrievalPipeline.ts`
  - `src/lib/ragNaturalQuery.ts`
  - `src/lib/ragOntology.ts`
  - `src/lib/retrievalPriority.ts`
  - `src/lib/ragSemanticValidation.ts`
- 런타임 오케스트레이션
  - `src/lib/nodeRagService.ts`
  - `src/lib/ragProfiles.ts`
  - `src/lib/ragRuntimeCache.ts`
- 평가/회귀 테스트
  - `benchmarks/golden-cases.json`
  - `scripts/rag-benchmark.ts`
  - `scripts/rag-regression-test.ts`
  - `tests/ragStructuredCoverage.test.ts`
  - `tests/ragMetadata.test.ts`
  - `tests/retrievalPipelineGate.test.ts`

### 현재 강점

1. 구조화 청킹 기반이 이미 존재한다.
   - 법령 조문, 별표/별지, Q&A, 평가기준/확인방법/관련근거 같은 경계를 인식한다.
   - `embeddingInput`에 문서명, 섹션명, 경로, 조문번호를 포함하여 벡터 검색 품질을 높이는 방향으로 설계되어 있다.

2. 하이브리드 검색 기반이 있다.
   - lexical, vector, RRF, rerank, section routing, ontology boost, service scope boost가 존재한다.
   - pgvector 연동 시 `chunks.embedding vector(768)`와 ivfflat 인덱스를 사용한다.

3. 검색 품질을 측정하는 최소 벤치마크가 있다.
   - golden case에 Top-3/Top-5, expected evidence, forbidden evidence, citation, semantic validation, claim coverage 체크가 포함되어 있다.

4. 운영 관측 지점이 있다.
   - retrieval diagnostics, stage trace, latency breakdown, cache hit summary, backend readiness 항목이 존재한다.

### 주요 병목/리스크

1. 지식파일 전체 활용률이 낮을 수 있다.
   - 많은 신규 `knowledge/*.md` 파일이 추가/수정되어 있으나, 문서별 chunk 수, embedding 수, doctor issue, 실제 Top-K 노출률을 한눈에 보는 품질 리포트가 부족하다.
   - `buildKnowledgeDoctorIssues`는 존재하지만 검색 실패 사례와 문서 커버리지를 연결하는 분석 루프가 아직 약하다.

2. 청킹 전략이 정적 상수 중심이다.
   - `MAX_CHUNK_CHARS=1200`, `MAX_PROTECTED_CHUNK_CHARS=2400`, `CHUNK_OVERLAP_CHARS=120`이 도메인/문서유형별로 고정되어 있다.
   - 평가매뉴얼, 법령, Q&A, 긴 표/체크리스트는 서로 다른 chunk 정책이 필요하다.

3. 벡터 인덱싱은 동작하지만 증분성과 완료 보장이 약하다.
   - `EMBEDDING_MAX_CHUNKS_PER_PASS`와 quota cooldown이 있어 안정성은 있으나, 대량 지식파일 추가 시 누락 embedding을 끝까지 채우는 운영 파이프라인/상태 추적이 더 필요하다.
   - chunk hash 변경 시 어떤 문서가 재임베딩되는지, 이전 embedding이 얼마나 재사용되는지에 대한 리포트가 부족하다.

4. Postgres 검색은 벡터 후보를 가져오되 전문검색/메타데이터 인덱스 활용이 제한적이다.
   - `chunks.search_text`가 있지만 `tsvector`/GIN 기반 lexical 후보 검색이 DB 레벨에 없다.
   - 현재 `ragEngine`의 in-memory lexical scoring과 pgvector precomputed candidates가 섞이는 구조라, corpus가 커질수록 DB lexical retrieval과 vector retrieval을 분리/통합하는 설계가 필요하다.

5. rerank/boost 규칙이 휴리스틱 중심이다.
   - 특정 표현, Q&A penalty, qualifier boost 등이 코드에 직접 들어가 있다.
   - 성능 개선을 위해서는 규칙을 벤치마크 기반으로 조정하고, 검색 실패 케이스를 자동으로 분류해야 한다.

6. golden set 규모가 아직 작다.
   - 현재 `benchmarks/golden-cases.json`은 핵심 케이스를 포함하지만, 지식파일 전체를 대표하기에는 부족하다.
   - 사용자가 말한 “지식파일들에 있는 내용들을 아직 다 활용하지 못함” 문제를 잡으려면 문서별 최소 1~3개 질의가 필요하다.

---

## 2. 고도화 목표와 정량 지표

### 핵심 목표

1. 지식파일 활용률 향상
   - 모든 `knowledge` 문서가 최소 1개 이상의 검색 가능한 chunk와 embedding을 가진다.
   - 중요 문서는 대표 질의에서 Top-3 또는 evidence에 안정적으로 포함된다.

2. 검색 정확도 향상
   - 문서 찾기형 질의: Top-3 hit rate 95% 이상.
   - 법령/고시/평가 근거 질의: required citation hit 90% 이상.
   - 구어체/띄어쓰기 변형 질의: Top-5 hit rate 95% 이상.

3. 최종 답변 근거 품질 향상
   - forbidden evidence contamination 감소.
   - unsupported claim 0 또는 명시적 abstain/clarification으로 처리.
   - 근거 문서/섹션/조문 citation 재현성 강화.

4. 운영 안정성 향상
   - 인덱싱 재실행 시 변경 없는 chunk embedding 재사용률 측정.
   - embedding 누락률 0%에 가까운 상태를 readiness에서 확인.
   - retrieval latency p95 목표를 설정하고 regression에서 감지.

### 측정 지표

- Index Coverage
  - 총 문서 수
  - 총 section 수
  - 총 chunk 수
  - embedding 완료 chunk 수/비율
  - 문서별 chunk 수 분포
  - zero-chunk/zero-embedding 문서 목록
  - 너무 큰 chunk/너무 작은 chunk 비율

- Retrieval Quality
  - Top-1/Top-3/Top-5 hit rate
  - expected evidence hit rate
  - forbidden evidence pass rate
  - required citation hit rate
  - normalized query/semantic frame pass rate
  - relation request pass rate
  - claim coverage pass rate

- Pipeline Health
  - 인덱싱 시간
  - embedding pass 수
  - cache restore count
  - 신규 embedding count
  - quota skip count
  - pgvector candidate latency
  - lexical retrieval latency
  - rerank latency

---

## 3. 실행 계획

## Phase 0. 기준선 측정과 리포트 자동화

목표: 지금 상태의 검색성능과 인덱싱 커버리지를 수치로 고정한다.

### 작업

1. `rag:doctor`와 `rag:bench` 결과를 하나의 품질 리포트로 합친다.
   - 신규 스크립트 후보: `scripts/rag-quality-report.ts`
   - 입력:
     - `.rag-cache/rag-index.json`
     - `.rag-cache/rag-doctor.json`
     - `benchmarks/golden-cases.json`
     - `rag:bench` 결과
   - 출력:
     - `.rag-cache/rag-quality-report.json`
     - `docs/reports/rag-quality-report.md`

2. 문서별 활용률 리포트를 만든다.
   - 문서별:
     - chunk 수
     - embedding 수
     - benchmark expectedDoc로 등장한 횟수
     - 실제 Top-K/evidence 노출 횟수
     - doctor issue 수

3. 실패 케이스를 자동 분류한다.
   - failure category:
     - `missing_document_coverage`
     - `chunk_boundary_miss`
     - `embedding_missing`
     - `alias_normalization_miss`
     - `service_scope_mismatch`
     - `rerank_wrong_priority`
     - `grounding_gate_dropped_relevant`
     - `citation_not_selected`

### 완료 기준

- `npm run rag:index`
- `npm run rag:doctor`
- `npm run rag:bench`
- `npm run rag:test`
- 위 결과가 동일 report에서 확인 가능해야 한다.

---

## Phase 1. 지식파일 수집/정규화 파이프라인 강화

목표: 지식파일이 많아져도 누락 없이, 검색 가능한 형태로 정규화한다.

### 작업

1. 파일명/문서명 정규화 강화
   - 대상: `src/lib/ragMetadata.ts`, `src/lib/nodeKnowledge.ts`
   - 한글 파일명, 괄호, 연도, 차수, 개정 전후, Q&A, 사례집, 고시/법령명을 안정적으로 추출한다.
   - `docTitle`, `documentGroup`, `sourceType`, `sourceRole`, `effectiveDate`, `publishedDate` 추출 테스트를 보강한다.

2. 문서 유형 자동 분류 보강
   - sourceType:
     - law, notice, manual, qa, guide, comparison, evaluation 등
   - sourceRole:
     - `primary_evaluation`, `support_reference`, `routing_summary`, `general`
   - 평가모드에서 원문 평가매뉴얼을 summary 문서보다 우선해야 하는 케이스를 명확히 한다.

3. 지식파일 preflight 검사 추가
   - 빈 파일
   - 너무 작은 파일
   - OCR 깨짐/NULL 문자
   - 중복 문서
   - 동일 문서의 여러 버전
   - 제목과 내용 불일치
   - 대량 표가 markdown table로 깨진 경우

4. 문서별 대표 질의 seed 생성
   - 각 지식파일에서 title, heading, Q&A 질문, 조문명, 평가기준명을 뽑아 benchmark 후보를 자동 생성한다.
   - 사람이 검수할 수 있도록 `benchmarks/generated-candidate-cases.json` 생성.

### 완료 기준

- 모든 `knowledge` 파일이 manifest에 들어간다.
- zero-chunk 문서 0개.
- zero-embedding 문서 0개 또는 명시적 quota 대기 상태.
- 문서별 대표 질의 후보가 생성된다.

---

## Phase 2. 청킹 전략 고도화

목표: 긴 지식파일과 표/체크리스트/Q&A/법령 조문을 검색 가능한 단위로 나누되, 근거 문맥은 잃지 않는다.

### 작업

1. 문서유형별 chunk policy 도입
   - 대상: `src/lib/ragStructured.ts`
   - 예시:
     - law: 조문/항/호 단위, 별표는 표 단위 보호
     - evaluation manual: 평가기준/확인방법/관련근거/평가자료 단위
     - qa: 질문+답변 pair 단위 보호
     - guide/manual: 절차/체크리스트/list group 보호
     - comparison: 개정 전/후 table row 묶음 보호

2. parent-child chunk 구조 도입
   - parent section: 큰 섹션 전체 요약/대표 chunk
   - child chunk: 실제 evidence chunk
   - 검색은 parent로 recall을 확보하고, evidence는 child로 precise하게 제시한다.
   - `StructuredChunk`에 `parentSectionId`, `windowIndex`, `spanStart`, `spanEnd`가 이미 있으므로 이를 적극 활용한다.

3. Small-to-big retrieval 지원
   - 1차: child chunk 검색
   - 2차: 동일 parent section의 neighbor window/인접 chunk 확장
   - 3차: parent section summary/compiled page를 답변 컨텍스트에 추가

4. 표/체크리스트 손상 방지
   - markdown table과 연속 list는 `protectedGroup`으로 묶되, 너무 큰 경우 row group 단위로 나눈다.
   - `containsCheckList`가 true인 chunk는 chunk boundary에서 qualifier 문장이 잘리지 않게 한다.

5. Chunk 품질 테스트 추가
   - 대상: `tests/ragStructuredCoverage.test.ts`
   - 케이스:
     - Q&A 질문과 답변이 분리되지 않는지
     - 조문 제목과 본문이 분리되지 않는지
     - 평가기준/확인방법/관련근거가 검색 가능한 독립 chunk로 존재하는지
     - 표 row가 의미 없이 절단되지 않는지

### 완료 기준

- chunk 길이 분포 p50/p95가 report에 표시된다.
- oversized chunk 비율 감소.
- short/noisy chunk 비율 감소.
- benchmark의 required citation/evidence hit가 상승한다.

---

## Phase 3. 임베딩/인덱싱 파이프라인 강화

목표: 모든 유효 chunk가 안정적으로 embedding되고, 변경분만 효율적으로 재처리된다.

### 작업

1. embedding job ledger 추가
   - 신규 테이블 또는 cache:
     - chunk_id
     - chunk_hash
     - embedding_model
     - embedding_dim
     - status: pending/succeeded/failed/skipped
     - last_error
     - retry_count
     - updated_at
   - Postgres 사용 시 `embedding_jobs` 테이블 또는 `chunks.embedding_status` 컬럼 검토.

2. 증분 인덱싱 강화
   - `chunk_hash`가 동일하면 embedding 재사용.
   - 문서 내용 변경 시 해당 문서 chunk만 재생성/재임베딩.
   - `.rag-cache/embeddings.json`뿐 아니라 Postgres의 기존 embedding도 restore source로 사용.

3. 인덱싱 명령 분리
   - `rag:index:manifest`: 문서/섹션/chunk 생성만
   - `rag:index:embed`: missing embedding 채우기
   - `rag:index:upsert`: DB 반영
   - `rag:index:verify`: coverage/readiness 확인

4. embedding input 버전 관리
   - `embeddingInput` 포맷이 바뀌면 hash version을 올린다.
   - 예: `embedding_input_version = 2`
   - 포맷 변경과 문서 내용 변경을 구분한다.

5. 동시성/쿼터 제어 개선
   - 현재 `EMBEDDING_BATCH_SIZE`, `EMBEDDING_MAX_CHUNKS_PER_PASS`, cooldown이 있으므로 유지하되, 실패 chunk를 재시도 큐로 남긴다.
   - quota 실패와 일반 실패를 분리한다.

### 완료 기준

- `rag:index` 후 missing embedding 수가 명확히 표시된다.
- 실패 embedding 목록을 재시도할 수 있다.
- 변경 없는 재실행에서 embedding API 호출이 거의 발생하지 않는다.

---

## Phase 4. DB 검색 인프라 강화: pgvector + 전문검색 + 메타데이터

목표: corpus가 커져도 빠르고 정확하게 후보를 뽑는다.

### 작업

1. PostgreSQL full-text search 컬럼 추가
   - 대상: `db/rag-schema.sql`, `src/lib/ragStore.ts`
   - 후보:
     - `search_tsv tsvector generated always as (...) stored`
     - 한국어는 기본 PostgreSQL parser 한계가 있으므로 ngram/trigram 보조도 검토.

2. trigram/GIN 인덱스 추가
   - `pg_trgm` extension 검토.
   - 문서명, 조문번호, 제목, search_text에 대해 부분 일치 검색 강화.
   - 구어체/띄어쓰기 변형 대응.

3. vector index 튜닝
   - 현재 ivfflat lists=100 사용.
   - 데이터 규모에 따라 HNSW 검토:
     - `embedding vector_cosine_ops` HNSW index
     - ef_search 조정
   - Top-K 후보 수를 profile별로 조정한다.

4. DB-level hybrid candidate retrieval 도입
   - vector candidates
   - lexical/tsvector candidates
   - title/article exact candidates
   - ontology document candidates
   - service scope candidates
   - 위 후보를 `ragEngine`에서 RRF/fusion으로 통합.

5. index explain/analyze 점검 스크립트 추가
   - `scripts/rag-db-inspect.ts`
   - 느린 질의와 index usage 확인.

### 완료 기준

- pgvector-only가 아니라 DB lexical + vector 후보가 모두 stage trace에 표시된다.
- 검색 latency와 Top-K hit가 report에 함께 표시된다.

---

## Phase 5. Query understanding / Alias / Ontology 강화

목표: 사용자의 구어체, 약칭, 띄어쓰기 변형, 업무 표현을 지식파일의 공식 명칭과 연결한다.

### 작업

1. alias dictionary 자동 생성
   - source:
     - 파일명
     - 문서 제목
     - heading
     - Q&A 질문
     - ontology labels
     - `_entity_scope.json`
     - golden cases의 질문/expectedDoc
   - 출력:
     - `.rag-cache/alias-candidates.json`

2. curated alias 관리
   - 사용자 검수 alias를 `knowledge/_curated_aliases.yaml` 또는 ontology manifest에 저장한다.
   - 예:
     - “직원인권침해교육” -> “직원 인권보호”, “직원교육”, “2026년 주야간보호 평가매뉴얼”
     - “기피식품” -> “급식/영양관리”, “개별 욕구”, “주야간보호 평가매뉴얼”
     - “인건비 지출 비율” -> “인건비지출비율”

3. relation 기반 expansion 강화
   - `OntologyRelationType`에 이미 `requires`, `eligible-for`, `has-cost`, `uses-document`, `evidenced-by` 등이 있다.
   - relation request가 있는 질의는 연결 문서를 후보에 강제 주입한다.

4. service scope slot과 문서 우선순위 연결
   - day-night-care, home-visit-care 등 scope가 있으면 해당 평가매뉴얼/급여비용 문서를 boost.
   - scope가 없고 위험도가 높으면 clarification 또는 mixed-scope evidence 표시.

5. query normalization 테스트 확대
   - 대상: `tests/queryIntent.test.ts`, `tests/semanticQueryFrame.test.ts`
   - 구어체, 축약어, 띄어쓰기, 오타, 연도 생략, “그 문서” 후속질문 케이스 추가.

### 완료 기준

- golden cases의 normalization/intent/relation pass rate 상승.
- 문서명 직접 질의와 구어체 질의 모두 Top-3 안정화.

---

## Phase 6. Retrieval fusion/rerank 고도화

목표: 후보를 많이 찾는 것에서 끝나지 않고, 최종 evidence에 올바른 원문 근거를 선택한다.

### 작업

1. 후보 stage를 명확히 분리한다.
   - exact title/article stage
   - lexical stage
   - vector stage
   - ontology stage
   - service scope stage
   - fallback stage
   - rerank stage
   - grounding gate stage

2. profile별 weight를 실제 fusion에 더 명확히 반영한다.
   - 현재 `ragProfiles.ts`에 lexical/vector/rerank/section weight가 있으므로, `ragEngine.ts`의 RRF/rerank/fusedScore 계산에 일관되게 적용한다.

3. hard-coded boost를 데이터 기반으로 이동한다.
   - 예: 특정 표현 boost, Q&A penalty, qualifier boost.
   - 설정 파일 후보:
     - `knowledge/_retrieval_rules.yaml`
     - `src/lib/retrievalRules.ts`
   - benchmark failure를 보며 조정 가능한 구조로 만든다.

4. 원문 우선 정책 강화
   - 평가 질의에서 요약/해설 문서보다 `primary_evaluation` 원문을 final evidence에 포함.
   - Q&A는 보조 근거로 쓰되, 사용자가 Q&A를 직접 요청한 경우 우선.

5. neighbor window/evidence balance 개선
   - 같은 parent section의 앞뒤 chunk를 context로 확장.
   - final evidence에서는 동일 문서만 과도하게 차지하지 않도록 balance.
   - 단, exact document lookup에서는 다양성보다 해당 문서 집중을 우선.

6. fallback의 역할 분리
   - 법령 MCP fallback은 low confidence 보완용.
   - 내부 knowledge에서 찾을 수 있는 내용은 fallback보다 내부 근거를 우선.

### 완료 기준

- stage trace에서 어떤 후보가 왜 선택/탈락했는지 설명 가능.
- forbidden evidence pass rate 상승.
- required citation hit rate 상승.

---

## Phase 7. Answer grounding / 검증 강화

목표: 검색된 근거를 답변이 정확히 사용하고, 근거 없는 주장을 줄인다.

### 작업

1. claim plan과 evidence coverage 연결 강화
   - 대상: `src/lib/ragSemanticValidation.ts`, `src/lib/expertAnswering.ts`
   - claim별 supporting chunk id를 명시한다.

2. 인용 누락 방지
   - required citation 문서가 search evidence에 있는데 answer citation에서 빠지는 케이스를 감지한다.

3. 근거 충돌 감지
   - 서로 다른 연도/개정 전후 문서가 섞일 때 최신성/문서 역할 우선순위를 적용한다.

4. low confidence 처리 개선
   - 근거가 부족하면 답변을 지어내지 않고 clarification/abstain.
   - 단, 문서 찾기형 질의는 low confidence라도 후보 목록을 보여줄 수 있게 분리.

### 완료 기준

- unsupported claim 0 목표.
- claim coverage 실패 케이스가 report에 자동 표시된다.

---

## Phase 8. 평가셋 확장과 CI 게이트

목표: 성능 고도화가 반복 가능하고 회귀를 막을 수 있게 한다.

### 작업

1. golden cases 확장
   - 문서별 최소 1개 대표 질의.
   - 중요 문서는 3~5개 질의:
     - 직접 문서명 질의
     - 구어체 질의
     - 조문/기준 질의
     - 후속질문
     - service scope 포함 질의

2. negative cases 추가
   - 내부 지식에 없는 내용.
   - 비슷하지만 다른 서비스 scope.
   - 연도/개정 전후 혼동.
   - Q&A와 원문 근거가 충돌하는 케이스.

3. CI 품질 게이트 추가
   - 최소 기준:
     - Top-3 hit rate >= 90%
     - required citation hit >= 85%
     - forbidden evidence pass >= 90%
     - missing embedding ratio <= 1%
   - 이후 목표치를 단계적으로 상향.

4. PR diff 기반 selective benchmark
   - 변경된 `knowledge` 문서/검색 코드에 관련된 benchmark만 빠르게 실행.
   - nightly/full benchmark는 전체 실행.

### 완료 기준

- CI에서 RAG 회귀를 감지한다.
- 성능 개선 PR마다 전후 지표가 남는다.

---

## 4. 권장 구현 순서

### 1차 스프린트: 관측/측정 우선

1. `scripts/rag-quality-report.ts` 생성.
2. 문서별 chunk/embedding/readiness 리포트 추가.
3. `rag:bench` 결과를 JSON/Markdown으로 저장.
4. 현재 실패 케이스를 category별로 분류.
5. `docs/reports/`에 기준선 리포트 저장.

이유: 지금 바로 코드를 튜닝하면 어떤 개선이 실제 성능 향상인지 알기 어렵다. 먼저 기준선을 만들어야 한다.

### 2차 스프린트: 청킹/인덱싱 안정화

1. 문서유형별 chunk policy 분리.
2. Q&A pair, 평가기준 블록, 법령 조문, table/list 보호 테스트 추가.
3. embedding ledger/status 도입.
4. missing embedding 재시도 명령 추가.

### 3차 스프린트: 검색 후보 recall 강화

1. DB lexical 후보 검색 추가.
2. title/article exact candidate stage 추가/강화.
3. alias candidate 자동 생성.
4. ontology relation expansion의 forced candidate 품질 개선.

### 4차 스프린트: precision/rerank 강화

1. profile weight를 fusion에 일관 적용.
2. 원문 평가매뉴얼 우선 정책을 설정화.
3. Q&A/summary/support 문서의 역할 기반 rerank 조정.
4. forbidden evidence regression을 CI에 추가.

### 5차 스프린트: 답변 grounding 강화

1. claim별 chunk support mapping.
2. citation 누락 감지.
3. 최신성/개정 전후 충돌 감지.
4. answer-level regression 추가.

---

## 5. 구체 파일별 변경 계획

### `src/lib/ragStructured.ts`

- chunk policy 타입 추가:
  - `ChunkPolicy`
  - `resolveChunkPolicy(metadata)`
- 문서유형별 boundary detector 분리:
  - law
  - evaluation
  - qa
  - manual/guide
  - comparison
- parent-child chunk 지원 강화.
- chunk diagnostics 생성:
  - chunk length
  - boundary reason
  - protected group 여부
  - section path

### `src/lib/ragStore.ts` / `db/rag-schema.sql`

- `embedding_status`, `embedding_model`, `embedding_input_version`, `last_embedding_error` 추가 검토.
- `search_tsv` 또는 trigram index 추가 검토.
- DB-level lexical candidate query 추가.
- pgvector HNSW/ivfflat 튜닝 옵션 추가.

### `src/lib/ragEngine.ts`

- candidate stage별 score 추적 강화.
- profile weight 적용 정리.
- hard-coded boost를 rule table로 이동.
- final evidence selection에서 sourceRole과 serviceScope 우선순위 적용.

### `src/lib/retrievalPipeline.ts`

- section routing이 단순 count 외에 score/intent/sourceRole을 반영하도록 개선.
- neighbor window expansion을 명시적 단계로 분리.
- grounding gate가 관련 chunk를 과도하게 탈락시키는 경우 diagnostic reason을 남김.

### `src/lib/ragNaturalQuery.ts`

- alias/구어체/띄어쓰기 normalization 확대.
- 후속질문 context rewrite 강화.
- service scope slot 추론 강화.

### `src/lib/ragOntology.ts`

- generated ontology와 curated ontology 병합 리포트 추가.
- rejected/candidate/validated/promoted 상태별 retrieval 영향 분리.
- relation expansion trace 개선.

### `scripts/rag-index.ts`

- manifest/embed/upsert/verify 단계 분리.
- embedding restore source 확대.
- index run summary 출력.

### `scripts/rag-benchmark.ts`

- JSON 결과 저장 옵션 추가.
- failure category 자동 분류.
- 문서별 hit/miss 리포트 추가.
- latency percentile 기록.

### `benchmarks/golden-cases.json`

- 문서별 대표 질의 확장.
- negative/mixed-scope/latest-version cases 추가.
- expected evidence와 forbidden evidence를 더 많이 명시.

---

## 6. 테스트 계획

### 단위 테스트

- `tests/ragMetadata.test.ts`
  - 파일명/문서명/연도/sourceType/sourceRole 추출.

- `tests/ragStructuredCoverage.test.ts`
  - 조문, 별표, Q&A, 평가기준, 표, 체크리스트 chunk boundary.

- `tests/queryIntent.test.ts`
  - 구어체/약칭/띄어쓰기/후속질문 normalization.

- `tests/retrievalPipelineGate.test.ts`
  - grounding gate, section routing, evidence injection.

### 통합 테스트

- `npm run rag:index`
- `npm run rag:doctor`
- `npm run rag:bench`
- `npm run rag:test`

### 성능 테스트

- cold index build time.
- warm index rebuild time.
- embedding cache restore rate.
- retrieval latency p50/p95.
- Top-K hit rate trend.

---

## 7. 운영 파이프라인 제안

### 로컬 개발 루프

```bash
npm run rag:index
npm run rag:doctor
npm run rag:bench
npm run rag:test
npm run lint
```

### 인덱싱 운영 루프

```bash
npm run rag:index:manifest
npm run rag:index:embed
npm run rag:index:upsert
npm run rag:index:verify
npm run rag:quality-report
```

### CI 게이트

1. 타입 체크: `npm run lint`
2. RAG 구조 테스트: 관련 unit tests
3. 빠른 benchmark: changed docs/search code related cases
4. full benchmark: main/nightly 또는 release 전
5. report artifact 업로드

---

## 8. 우선순위 높은 첫 구현 티켓

### P0-1. RAG 품질 리포트 생성

- 파일: `scripts/rag-quality-report.ts`
- 산출물:
  - `.rag-cache/rag-quality-report.json`
  - `docs/reports/rag-quality-report.md`
- 포함 지표:
  - 문서별 chunk/embedding 수
  - zero coverage 문서
  - oversized/undersized chunk
  - benchmark hit/miss
  - failure category

### P0-2. Benchmark 결과 JSON 저장

- 파일: `scripts/rag-benchmark.ts`
- 현재 콘솔 출력 중심을 JSON 저장 가능하게 확장.
- 옵션:
  - `RAG_BENCH_OUTPUT=.rag-cache/rag-benchmark.json`

### P0-3. 문서유형별 chunk diagnostics 추가

- 파일: `src/lib/ragStructured.ts`
- 각 chunk에 internal diagnostic 또는 report-only metadata 추가.
- test에서 boundary reason 검증.

### P0-4. Missing embedding 재시도/검증 명령

- 파일: `scripts/rag-index.ts` 또는 신규 `scripts/rag-embedding-verify.ts`
- missing chunk 목록과 원인 출력.
- quota 상태와 일반 실패 분리.

### P1-1. DB lexical retrieval 후보 추가

- 파일: `db/rag-schema.sql`, `src/lib/ragStore.ts`
- title/article/search_text 기반 exact/lexical candidate를 pgvector 후보와 함께 반환.

### P1-2. Alias candidate generation

- 파일: 신규 `scripts/rag-alias-candidates.ts`
- heading/Q&A/file title에서 alias 후보 생성.
- curated alias 반영 구조 설계.

### P1-3. Golden cases 확장

- 파일: `benchmarks/golden-cases.json`
- 우선순위:
  - 신규 추가 지식파일
  - 평가 원문 우선 케이스
  - 구어체 실무 질문
  - 법령 조문 exact lookup

---

## 9. 기대 효과

1. 검색 실패 원인이 “감”이 아니라 리포트로 보인다.
2. 지식파일이 추가될수록 자동으로 coverage와 benchmark가 확장된다.
3. 청킹이 문서 성격에 맞게 바뀌어, 원문 근거가 잘리는 문제가 줄어든다.
4. pgvector만 의존하지 않고 title/article/lexical/ontology를 함께 써 recall이 오른다.
5. rerank와 grounding gate가 sourceRole, serviceScope, 최신성, 원문 우선 정책을 반영해 precision이 오른다.
6. CI에서 RAG 품질 회귀를 조기에 잡는다.

---

## 10. 다음 액션

바로 착수할 추천 순서:

1. `scripts/rag-quality-report.ts` 구현.
2. `scripts/rag-benchmark.ts`에 JSON output 추가.
3. 현재 `knowledge` 전체의 문서별 chunk/embedding/readiness 리포트 생성.
4. 리포트에서 zero/low coverage 문서를 찾아 청킹 boundary부터 개선.
5. golden cases를 문서별 대표 질의 중심으로 확장.
6. 그 다음 DB lexical retrieval과 alias/ontology expansion을 강화.
