# LTC Assistant 2차 개선·고도화 계획 수립 요청 브리프

작성일: 2026-05-07
목적: 2차 개선·고도화 계획 수립 에이전트에게 전달할 컨텍스트 및 요청 사항 정리

---

## 시스템 개요

본 시스템은 장기요양기관 실무자가 "신규 수급자가 오면 해야 하는 업무는?" 같은 질문을 하면, 관련 법령·평가 매뉴얼·실무 근거를 기반으로 구조화된 답변을 제공하는 장기요양 업무 AI 어시스턴트입니다.

---

## 실제 질문/답변 예시

**질문:** 신규 수급자가 오면 해야하는 업무는?
**적용 급여유형:** 주야간보호

**현재 답변 요약:**
- 욕구사정·위험도 평가 실시
- 급여제공계획 수립 (필수 10개 항목 포함)
- 수급자/보호자 서명
- 급여제공 시작일까지 공단 통보
- 비대면 서명(SNS·전자서명) 허용 기준 안내

---

## 1차 수정 이력 (참고 필수)

본 시스템은 이미 **1차 RAG 검색성능 고도화**를 완료한 상태입니다. 새 계획 수립 시 이 작업과 중복되지 않도록 반드시 참고하세요.

- **계획서:** `docs/plans/2026-04-30-rag-search-performance-optimization-plan.md`
- **진행 리포트:** `docs/plans/rag-search-performance-progress.md`

### 1차 수정에서 완료된 주요 작업 요약

| Phase | 완료 내용 |
|---|---|
| Phase 0 | RAG 품질 리포트 자동화, benchmark JSON 저장, missing embedding 검증 |
| Phase 1 | DB lexical retrieval 추가, alias candidate 생성, golden cases 확장, rerank 우선순위 조정 |
| Phase 2 (P2-1~68) | candidate cap 최적화, lexical TF cache, posting index, ontology alias token index, exact/lexical scoring precompute, small-to-big retrieval, semantic validation cache 등 대규모 latency 최적화 |
| Phase 3 (P3-1~23) | 운영 로그, admin retrieval-log UX, privacy boundary regression, authenticated admin smoke, `Cache-Control: no-store` hardening, server smoke helper 공통화 등 운영 안정화 |

**현재 상태:** P3-23 완료. ranking tuning은 운영 report evidence가 decision gate를 만족할 때까지 보류 중. 리뷰/커밋 분할 단계 대기 중.

아래에서 요청하는 **신규 개선 계획은 이 1차 작업 위에 쌓이는 2차 계획**입니다.

---

## 확인된 문제점

### [문제 1] 누락된 핵심 내용 — 8대 지침 설명 의무

현재 답변에서 다음 내용이 완전히 누락되어 있습니다:

> "모든 수급자(보호자)에게 8가지(욕창예방, 낙상예방, 탈수예방, 배변도움, 관절구축예방, 치매예방, 감염예방, 노인인권보호) 지침에 대해 **연 1회 이상** 설명한다.
> 신규수급자는 급여제공 시작일부터 **토요일·공휴일 포함 14일 이내**에 실시하였는지 확인함."

또한 "기준일" 개념(14일 카운트 시작점이 급여제공 시작일임)도 명시되지 않아 실무자가 시한을 잘못 계산할 위험이 있습니다.

1차 수정에서 청킹·검색 파이프라인을 대폭 개선했음에도 이 내용이 여전히 누락되는 원인을 분석하고, 해당 지식이 반드시 검색·포함되도록 하는 방안을 계획해 주세요.

접근 관점:
- 해당 내용이 담긴 knowledge 파일의 청킹 boundary가 올바른지
- 8대 지침, 14일, 기준일 등 핵심 키워드에 대한 메타데이터 태깅 누락 여부
- "신규 수급자 업무" 질의에 8대 지침 관련 문서가 연결되는 ontology 관계 정의 필요 여부
- golden case에 이 내용을 커버하는 케이스가 없는지

---

### [문제 2] 응답 속도 저하

1차 수정(Phase 2)에서 retrieval latency를 대폭 개선했음에도 사용자가 체감하는 응답 속도가 여전히 느립니다. 현재 답변 구조는 바로답변 → 결론 → 법적근거 → 평가근거 → 실무근거 → 실무해석 → 출처 → 추가확인 순의 긴 포맷입니다.

1차에서 다루지 않았거나 미진했던 영역을 중심으로 추가 개선 방안을 계획해 주세요.

접근 관점:
- LLM 생성 단계 스트리밍 최적화 (retrieval은 빨라졌으나 생성 단계 병목 가능성)
- 답변 포맷 경량화 옵션 (요약 모드 vs 상세 모드 분리)
- 모델 티어링 (질의 복잡도에 따른 모델 선택)
- 프롬프트 압축 (evidence context 전달 방식 최적화)
- 자주 묻는 질의에 대한 응답 캐싱 전략

---

### [문제 3] 온톨로지 구조 미흡

1차 수정에서 ontology alias token index와 relation expansion이 일부 구현되었으나(`src/lib/ragOntology.ts`), 장기요양 도메인의 **개념 간 관계와 규칙** 자체가 충분히 구조화되어 있지 않아 복합 조건 질문(예: "신규수급자 + 주야간보호 + 14일 이내 + 8대 지침"처럼 여러 조건이 교차하는 쿼리)에서 검색 누락이 발생합니다.

현재 `src/lib/ragOntology.ts`에 `OntologyRelationType`(`requires`, `eligible-for`, `has-cost`, `uses-document`, `evidenced-by` 등)이 정의되어 있습니다.

#### 온톨로지 강화 관련 인사이트

- 온톨로지는 단순 문서 참조를 넘어 **개념 간 관계와 규칙**을 정의함
- 건축법규 온톨로지 사례: 검색·체크리스트 자동화로 수 시간 작업을 5분에 완료
- **Graph RAG** (벡터 + 그래프 + BM25 삼중 검색) 도입 시 맥락적 정확도 향상
- **하이브리드 검색**: Fulltext 검색 + 다중필터 + 그래프 탐색 3계층 구조 권장
- 에이전트가 소비하도록 설계된 "Ontology-native Architecture" 필요
- RAG는 이제 "LLM이 알 수 없는 것(사내 규정, 최신 법령)"에 특화되어야 함
- 도메인 전문가 참여 없이는 온톨로지 구축 품질 담보 어려움

기존 RAG 파이프라인(`src/lib/ragEngine.ts`, `src/lib/retrievalPipeline.ts`)과 결합하는 방향으로 아키텍처 수준의 강화 방안을 계획해 주세요.

---

## 핵심 참고 파일 경로

```
# 1차 수정 계획 및 리포트
docs/plans/2026-04-30-rag-search-performance-optimization-plan.md
docs/plans/rag-search-performance-progress.md

# 온톨로지
src/lib/ragOntology.ts

# 검색 엔진 및 파이프라인
src/lib/ragEngine.ts
src/lib/retrievalPipeline.ts
src/lib/ragNaturalQuery.ts
src/lib/retrievalPriority.ts

# 청킹/구조화
src/lib/ragStructured.ts
src/lib/ragMetadata.ts

# 임베딩/스토어
src/lib/embeddingService.ts
src/lib/ragStore.ts

# 런타임/캐시
src/lib/nodeRagService.ts
src/lib/ragRuntimeCache.ts
src/lib/ragProfiles.ts

# 평가/벤치마크
benchmarks/golden-cases.json
scripts/rag-benchmark.ts
scripts/rag-quality-report.ts
```

---

## 산출물 요구사항

아래 형식으로 개선 계획을 작성해 주세요:

1. **문제별 근본 원인 분석** — 1차 수정 이후에도 왜 여전히 발생하는지
2. **개선 방안** — 문제별 구체적 해결책, 1차와 중복되지 않는 신규 작업 중심, 우선순위 포함
3. **온톨로지 설계 초안** — 장기요양 도메인 핵심 엔티티·관계 목록, 기존 `ragOntology.ts` 확장 방향
4. **구현 로드맵** — 단기/중기/장기 단계 구분, 각 단계의 예상 효과
5. **리스크 및 고려사항** — 1차 작업과의 충돌 가능성, 도메인 전문가 검증 필요 항목 등

계획은 실제 구현 담당자가 바로 작업에 착수할 수 있을 만큼 구체적으로 작성해 주세요. 파일명, 함수명, 추가할 타입/인터페이스 등을 명시하는 것이 좋습니다.
