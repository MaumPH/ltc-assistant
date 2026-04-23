# LTC Assistant

장기요양기관 실무와 평가 준비를 위한 근거 기반 AI 어시스턴트입니다.

법령, 시행령, 시행규칙, 고시, 평가매뉴얼, Q&A, 업무 매뉴얼을 한곳에 묶고, 질문 의도에 맞는 근거를 찾아 답변합니다. 통합채팅, 평가채팅, 평가 지침 정리, 지식기반 탐색, 운영 대시보드, RAG 관리 기능을 함께 제공합니다.

[![React 19](https://img.shields.io/badge/React-19-61dafb)](https://react.dev/)
[![Vite 6](https://img.shields.io/badge/Vite-6-646cff)](https://vite.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178c6)](https://www.typescriptlang.org/)
[![Gemini](https://img.shields.io/badge/Gemini-RAG-4285f4)](https://ai.google.dev/)

배포 주소: [https://maumph.github.io/ltc-assistant/](https://maumph.github.io/ltc-assistant/)

---

## 이런 걸 할 수 있습니다

### 통합채팅

장기요양기관 운영 질문을 자연어로 묻습니다. 예를 들어 "주야간보호 급여비용은 어떤 고시를 기준으로 봐야 하나요?", "요양보호사 승급제는 어떤 근거를 봐야 하나요?"처럼 질문하면 법령·고시·평가·실무 문서를 함께 검색해 답변합니다.

답변은 단순 텍스트가 아니라 다음 정보를 분리해서 보여줍니다.

- 결론
- 법적 근거
- 평가 근거
- 실무 근거
- 출처 문서와 섹션
- 추가 확인이 필요한 조건
- 검색/검증 진단 정보

### 평가채팅

평가 준비 질문에 맞춰 평가매뉴얼과 평가 Q&A를 우선 검색합니다. 평가 관련 질문은 일반 법령 문서만으로 답하지 않고, 평가 지표·확인 방법·기록·증빙 관점의 근거를 함께 확인하도록 설계되어 있습니다.

### 평가 지침 정리

`knowledge/evaluation/` 아래의 구조화된 평가 문서를 위키처럼 탐색합니다. 평가영역, 판단기준, 확인사항, 실무 해석을 한 화면에서 읽을 수 있게 정리합니다.

### 지식기반

`knowledge/` 폴더의 문서 목록을 카테고리별로 확인하고 검색합니다. 법령, 시행령, 시행규칙, 고시, 별표·별지, 평가매뉴얼, 참고자료를 분류해 문서 카탈로그처럼 사용할 수 있습니다.

### 대시보드

일일·주간·월간·분기·반기·연간·수시·평가직전 업무를 점검하는 운영 대시보드입니다. 평가 전 준비해야 할 기록과 증빙 흐름을 확인하는 용도입니다.

### 관리자 화면

RAG 상태, 인덱스 상태, 검색 프로필, 재색인 요청, 평가 실험, 온톨로지 검토를 관리자 화면에서 확인합니다. 관리자 인증이 설정되어 있어야 접근할 수 있습니다.

---

## 현재 지식기반

저장소에 포함된 문서는 모두 로컬 파일 기반입니다.

| 위치 | 용도 |
|---|---|
| `knowledge/` | 법령, 시행령, 시행규칙, 고시, 별표, 업무 매뉴얼, 민원상담 사례, 부당청구 사례 등 일반 실무 문서 |
| `knowledge/eval/` | 평가매뉴얼, 평가 Q&A, 평가 대응 참고자료 |
| `knowledge/evaluation/` | 평가 지침 정리 화면에서 직접 사용하는 구조화 문서 |
| `knowledge/brain/` | 업무 이벤트, 행위자, 산출물, 시간 조건 같은 도메인 브레인 데이터 |
| `knowledge/ontology/` | 검색 확장과 개념 연결에 쓰는 온톨로지 데이터 |

현재 저장소 기준으로 `knowledge/` 아래에는 `.md`/`.txt` 문서 140개 이상이 포함되어 있습니다. 문서를 추가하면 메모리 모드에서는 서버 시작 시 읽고, Postgres 모드에서는 `npm run rag:index`로 인덱싱합니다.

---

## 지원하는 질문 흐름

| 질문 유형 | 예시 | 내부 처리 |
|---|---|---|
| 비용·산정 기준 | "주야간보호 급여비용은 어떤 고시를 봐야 하나요?" | 고시, 급여비용, 서비스 범위 근거 우선 |
| 평가 준비 | "기피식품은 평가에서 어떻게 기록해야 하나요?" | 평가매뉴얼과 확인 절차 근거 우선 |
| 인력·시설 기준 | "주야간보호 인력배치 기준이 뭐야?" | 선택 급여유형과 시설/인력 기준 매칭 |
| 문서·서식 | "급여제공계획서 관련 근거 알려줘" | 문서명, 서식, 작성·보관 조건 검색 |
| 예외·단서 | "이 경우 예외가 있나요?" | 예외, 단서, 제한, 면제 문구 검증 |
| 법령 정확 조회 | "노인장기요양보험법 시행규칙 별표 기준" | 법령/시행규칙/별표 문서 중심 검색 |

고위험 질문은 답변보다 검증을 우선합니다. 직접 근거가 부족하거나 급여유형이 섞이면 경고 또는 보류 신호를 표시합니다.

---

## 빠른 시작

### 요구사항

- Node.js 20 이상 권장
- npm
- Gemini API 키
- 선택: Docker 또는 로컬 Postgres + pgvector

### 설치

```bash
npm ci
```

### 개발 서버 실행

```bash
npm run dev
```

기본 주소:

- 앱: [http://localhost:3000](http://localhost:3000)
- 지식 목록 API: [http://localhost:3000/api/knowledge](http://localhost:3000/api/knowledge)
- 헬스 체크: [http://localhost:3000/api/health](http://localhost:3000/api/health)

개발 모드에서는 Express 서버 위에 Vite middleware가 붙습니다. 프론트엔드와 API가 같은 origin에서 동작하므로 별도 CORS 설정 없이 실행됩니다.

### 프로덕션 빌드

```bash
npm run build
npm run start
```

`npm run build`는 `dist/`를 생성하고, `NODE_ENV=production` 환경에서는 Express가 `dist/` 정적 파일을 서빙합니다.

---

## Gemini API 키

기본 운영 방식은 사용자 키 기반입니다.

| 모드 | 설명 |
|---|---|
| `RAG_GENERATION_MODE=user` | 최종 답변 생성은 브라우저에서 입력한 사용자 Gemini 키로 수행 |
| `RAG_GENERATION_MODE=server` | 서버의 `GEMINI_API_KEY`로 최종 답변까지 생성 |

사용자 키 모드에서는 브라우저 상단의 개인 키 버튼으로 Gemini API 키를 입력합니다. 키는 브라우저 로컬 저장소에 저장되며, 답변 생성 요청에만 사용됩니다.

서버가 문서 임베딩을 만들 때는 `RAG_EMBEDDING_API_KEY`를 우선 사용합니다. 없으면 `GEMINI_API_KEY`로 fallback합니다.

---

## 환경변수

`env.example`을 기준으로 `.env`를 만듭니다.

```bash
cp env.example .env
```

Windows PowerShell에서는 직접 파일을 복사하세요.

| 변수 | 기본값 | 설명 |
|---|---|---|
| `PORT` | `3000` | Express 서버 포트 |
| `GEMINI_API_KEY` | 없음 | 서버 측 Gemini 생성 또는 임베딩 fallback 키 |
| `RAG_EMBEDDING_API_KEY` | 없음 | 문서/질의 임베딩 전용 Gemini 키 |
| `RAG_GENERATION_MODE` | `user` | `user` 또는 `server` |
| `RAG_STORAGE_MODE` | `memory` | `memory` 또는 `postgres` |
| `DATABASE_URL` | 없음 | Postgres/pgvector 연결 문자열 |
| `VITE_RAG_API_BASE_URL` | 없음 | 분리 배포 시 프론트엔드가 호출할 백엔드 origin |
| `RAG_FRONTEND_ORIGIN` | 없음 | 분리 배포 시 CORS 허용 origin |
| `RAG_CSP_CONNECT_SRC` | 없음 | 프로덕션 CSP `connect-src` 추가 origin |
| `RAG_CHAT_RATE_LIMIT_MAX` | `20` | 분당 채팅 요청 제한 |
| `RAG_INSPECT_RATE_LIMIT_MAX` | `20` | 분당 검색 inspect 요청 제한 |

운영에 쓰는 실제 API 키, DB 비밀번호, 관리자 인증값은 README에 기록하지 말고 `.env` 또는 배포 환경의 secret manager에만 둡니다.

분리 배포 예시:

```env
VITE_RAG_API_BASE_URL=https://rag.example.com
RAG_FRONTEND_ORIGIN=https://example.github.io
RAG_CSP_CONNECT_SRC=https://rag.example.com
```

---

## 실행 모드

### 1. 메모리 모드

가장 단순한 로컬 실행 방식입니다.

```env
RAG_STORAGE_MODE=memory
```

서버 시작 시 `knowledge/` 문서를 읽고 구조화 청크를 만듭니다. 별도 데이터베이스 없이 실행할 수 있으므로 개발과 소규모 배포에 적합합니다.

### 2. Postgres + pgvector 모드

항상 켜져 있는 미니 PC나 서버 배포에 적합합니다.

```bash
docker compose -f docker-compose.pgvector.yml up -d
npm run rag:index
npm run dev
```

`.env` 예시:

```env
RAG_STORAGE_MODE=postgres
DATABASE_URL=postgres://<user>:<password>@<host>:5432/<database>
RAG_EMBEDDING_API_KEY=replace-with-a-fresh-key
RAG_GENERATION_MODE=user
```

운영 배포 절차와 실제 접속 정보는 공개 README가 아닌 별도 운영 문서에서 관리하세요.

---

## 주요 명령어

| 명령 | 설명 |
|---|---|
| `npm run dev` | Express + Vite 개발 서버 실행 |
| `npm run start` | 빌드된 서버 실행 |
| `npm run build` | Vite 프로덕션 빌드 |
| `npm run preview` | Vite preview |
| `npm run lint` | 프론트엔드/서버 TypeScript 타입 체크 |
| `npm run rag:index` | `knowledge/` 문서를 구조화하고 인덱스/임베딩 저장 |
| `npm run rag:doctor` | 지식 문서 진단 |
| `npm run rag:compiled` | 구조화 문서 페이지 생성 점검 |
| `npm run rag:test` | RAG 회귀 테스트 |
| `npm run rag:bench` | golden benchmark 실행 |
| `npm run rag:eval` | 평가 trial 실행 |
| `npm run ontology:generate` | 온톨로지 후보 생성 |

---

## API 개요

| 메서드 | 경로 | 설명 |
|---|---|---|
| `GET` | `/api/health` | 서버, 저장소, 인덱스 준비 상태 |
| `GET` | `/api/home/overview` | 홈 화면 문서/청크/준비 상태 요약 |
| `GET` | `/api/knowledge` | 지식 문서 목록 |
| `GET` | `/api/knowledge/file?path=...` | 지식 문서 원문 |
| `GET` | `/api/knowledge/diagnostics?path=...` | 문서별 진단 정보 |
| `GET` | `/api/index/status` | 인덱스와 임베딩 readiness |
| `GET` | `/api/chat/capabilities` | 채팅 모델, 키 요구 여부, 준비 상태 |
| `POST` | `/api/chat` | 근거 기반 답변 생성 |
| `POST` | `/api/retrieval/inspect` | 검색 결과와 semantic validation 진단 |

관리자용 내부 경로는 공개 README에서 생략합니다.

---

## 아키텍처

```text
┌──────────────────────────────────────────────────────────┐
│ React 19 + TypeScript + Tailwind CSS                     │
│ Home / Chat / Evaluation Wiki / Knowledge / Admin        │
└──────────────────────────────┬───────────────────────────┘
                               │ fetch
┌──────────────────────────────▼───────────────────────────┐
│ Express server.ts                                         │
│ API routing · rate limit · CORS · CSP · admin session     │
└──────────────────────────────┬───────────────────────────┘
                               │
┌──────────────────────────────▼───────────────────────────┐
│ NodeRagService                                            │
│ query normalization · retrieval · rerank · validation     │
│ claim coverage · answer planning · Gemini generation      │
└──────────────┬─────────────────────────────┬─────────────┘
               │                             │
┌──────────────▼──────────────┐   ┌──────────▼─────────────┐
│ Local knowledge/ corpus      │   │ Postgres + pgvector     │
│ md/txt structured chunks     │   │ optional persistent RAG  │
└─────────────────────────────┘   └────────────────────────┘
```

| 영역 | 기술 |
|---|---|
| Frontend | React 19, TypeScript, Tailwind CSS 4, Vite 6 |
| Backend | Express 4, Node.js, tsx |
| AI | `@google/genai`, Gemini generation/embedding |
| Retrieval | local structured chunks, lexical/vector hybrid, rerank diagnostics |
| Storage | memory mode, optional Postgres + pgvector |
| Security | helmet CSP, CORS allowlist, express-rate-limit |
| Evaluation | golden benchmark, regression tests, claim coverage, validation issues |

---

## RAG 품질 검증

이 프로젝트는 "문서를 찾았다"에서 끝내지 않고, 답변에 필요한 주장 단위가 실제 evidence와 연결되는지 검사합니다.

주요 진단:

- `unsupported-claim`: 주요 주장에 직접 근거가 부족함
- `mixed-service-scope`: 선택 급여유형과 다른 근거가 섞임
- `basis-confusion`: 고위험 판단에 필요한 법적 근거가 부족함
- `missing-exception`: 예외/단서 질문에서 예외 문구가 충분히 드러나지 않음
- `ungrounded-cost-number`: 금액·비율 수치가 인용 근거와 직접 연결되지 않음

검증 명령:

```bash
npm run rag:test
npm run rag:bench
```

`benchmarks/golden-cases.json`에는 기대 문서, 금지 validation code, 최소 supported claim 수 같은 게이트가 들어갑니다.

---

## 배포

### GitHub Pages 프론트엔드

`.github/workflows/deploy.yml`은 `main` push 시 GitHub Pages 빌드를 수행합니다.

정적 프론트엔드는 GitHub Pages에서 제공하고, API는 배포 환경에서 지정한 백엔드 origin으로 호출하는 구조입니다. 실제 백엔드 도메인은 공개 README에 기록하지 않습니다.

### 백엔드

미니 PC 또는 서버에서는 Express 백엔드를 계속 실행해야 합니다.

권장 구성:

- Postgres + pgvector
- `npm run rag:index`로 사전 인덱싱
- `deploy/ltc-rag.service`로 systemd 서비스 운영
- HTTPS reverse proxy 또는 이에 준하는 보안 경계 구성

---

## 보안과 데이터 흐름

| 기능 | 데이터 위치 | 외부 전송 |
|---|---|---|
| 지식 문서 목록/검색 | 로컬 파일 또는 Postgres | 없음 |
| 임베딩 생성 | Gemini API | 문서 청크 또는 질의 텍스트 |
| 사용자 키 기반 답변 생성 | Gemini API | 질문 + 검색된 근거 청크 |
| 서버 키 기반 답변 생성 | Gemini API | 질문 + 검색된 근거 청크 |
| 관리자 세션 | 서버 메모리 | 없음 |

주의:

- 이 앱은 법률 자문을 대체하지 않습니다.
- 답변 적용 전에는 인용된 원문과 최신 고시·법령을 확인해야 합니다.
- Gemini API 키는 노출되면 즉시 폐기하고 재발급하세요.
- 분리 배포 시 `RAG_FRONTEND_ORIGIN`과 `RAG_CSP_CONNECT_SRC`를 정확히 제한하세요.

---

## 자주 생기는 문제

### 평가 지침 정리 또는 지식기반에서 `knowledge list request failed: 404`가 뜹니다.

프론트엔드가 백엔드 API가 아닌 정적 호스팅 origin으로 `/api/knowledge`를 호출할 때 발생합니다.

확인할 것:

- 같은 origin 실행이면 `npm run dev`로 Express 서버를 통해 접속했는지 확인
- 분리 배포면 `VITE_RAG_API_BASE_URL`이 실제 백엔드 주소인지 확인
- 백엔드에서 `GET /api/knowledge`가 200을 반환하는지 확인

```bash
curl http://localhost:3000/api/knowledge
```

### 채팅 답변 후 화면이 하얗게 변합니다.

브라우저 렌더링 중 예외가 발생한 상태입니다. 최신 코드에서는 일부 답변 필드가 누락되어도 답변 카드가 기본값으로 렌더링되도록 방어되어 있습니다.

확인할 것:

- 브라우저 개발자 도구 Console 에러
- `/api/chat` 응답 상태와 JSON payload
- `npm run build` 성공 여부

### 채팅 버튼이 비활성화됩니다.

`RAG_GENERATION_MODE=user`에서는 사용자 Gemini API 키가 필요합니다. 상단 개인 키 버튼에서 키를 입력하세요.

### Postgres 모드에서 검색 품질이 낮습니다.

임베딩이 아직 충분히 채워지지 않았을 수 있습니다.

```bash
npm run rag:index
curl http://localhost:3000/api/index/status
```

`pendingEmbeddingChunks`, `retrievalReadiness`, `nextEmbeddingRetryAt` 값을 확인하세요.

---

## 개발 메모

- `rg`가 Windows/OneDrive 환경에서 접근 거부될 수 있습니다. 이 경우 PowerShell `Select-String`으로 검색하세요.
- OneDrive placeholder 상태의 `node_modules` 파일은 Node가 `UNKNOWN: unknown error, read`를 낼 수 있습니다. 해당 패키지 폴더를 지우고 `npm install`을 다시 실행하면 로컬 파일로 복구됩니다.
- GitHub Actions는 PR에서 `npm run lint`, `npm run build`를 수행합니다.

---

## 프로젝트 구조

```text
.
├─ src/
│  ├─ components/        # React 화면과 카드 컴포넌트
│  ├─ data/              # 대시보드 업무 데이터
│  └─ lib/               # RAG, 검색, 검증, 지식 문서, API helper
├─ knowledge/            # 로컬 지식 문서
├─ benchmarks/           # golden cases와 benchmark 결과
├─ scripts/              # RAG 인덱싱, 벤치, 온톨로지 실행
├─ tests/                # Node test 기반 회귀 테스트
├─ docs/                 # 배포와 운영 문서
├─ db/                   # Postgres/pgvector schema
├─ deploy/               # systemd 서비스 예시
├─ server.ts             # Express API 서버
└─ vite.config.ts        # Vite 설정
```

---

## 참고 문서

- [env.example](env.example)
- [benchmarks/golden-cases.json](benchmarks/golden-cases.json)

---

## 라이선스

현재 저장소에는 별도 `LICENSE` 파일이 포함되어 있지 않습니다. 공개 배포나 외부 재사용 전에 라이선스 정책을 명확히 정하는 것이 좋습니다.
