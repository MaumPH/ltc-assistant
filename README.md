# 장기요양 물어보세요

장기요양기관 실무와 평가 준비를 돕는 Gemini 기반 AI 어시스턴트입니다.  
법령, 고시, 평가 문서, 평가 위키를 지식베이스로 활용해 통합 상담과 평가 전용 상담을 제공합니다.

배포 주소: [https://maumph.github.io/ltc-assistant/](https://maumph.github.io/ltc-assistant/)

## 주요 기능

- `통합 상담`: 일반 실무 질문에 대해 등록된 지식 문서를 바탕으로 답변합니다.
- `평가 상담`: 평가 관련 문서만 기준으로 답변하는 전용 상담 탭입니다.
- `평가 지침 정리`: `knowledge/evaluation/` 문서를 위키 형태로 탐색할 수 있습니다.
- `대시보드`: 평가 준비 체크리스트와 업무 진행 현황을 확인할 수 있습니다.
- `지식베이스`: 문서 원문 대신 제목과 분류 중심의 카탈로그를 제공합니다.

지원 모델:

- `Gemini 3 Flash`
- `Gemini 3.1 Pro`
- `Gemini 3.1 Flash Lite`

참고:

- `Gemini 3 Flash` 계열 요청은 현재 timeout 및 자동 fallback 안정화가 적용되어 있습니다.
- 기본적으로 사용자가 선택한 모델을 유지하고, 응답이 지연되면 해당 요청에 한해 `Gemini 3.1 Flash Lite`로 재시도합니다.

## 사용 방식

- 브라우저에서 Gemini API 키를 입력하면 바로 사용할 수 있습니다.
- API 키는 브라우저 로컬 스토리지에 저장되며, 기본 사용 흐름에서는 별도 서버에 저장하지 않습니다.
- 지식 문서를 검색해 프롬프트에 반영하는 RAG 성격의 클라이언트 사이드 흐름을 사용합니다.

## 로컬 실행

권장 환경:

- `Node.js 20`
- `npm`

설치 및 실행:

```bash
npm ci
npm run dev
```

접속 주소:

- [http://localhost:3000](http://localhost:3000)

검증 명령:

```bash
npm run lint
npm run build
npm run preview
```

실행 구조:

- 개발 실행은 `server.ts` 기반의 Express 서버 위에서 Vite middleware를 붙여 동작합니다.
- 프로덕션에서는 `dist/` 정적 산출물을 서빙하도록 구성되어 있습니다.

## 환경 변수

예시 파일은 [env.example](./env.example)에 있습니다.

- `GEMINI_API_KEY`
  - Gemini API 호출용 키입니다.
  - 현재 프런트 기본 UX에서는 사용자가 화면에서 직접 API 키를 입력하는 방식이 기본입니다.
  - 서버 경로를 사용할 경우에는 환경 변수로도 주입할 수 있습니다.
- `APP_URL`
  - 앱 호스트 주소입니다.
  - AI Studio 또는 배포 환경에서 자기 자신을 참조하는 URL이 필요할 때 사용합니다.
- `VITE_BASE_PATH`
  - GitHub Pages 배포 시 저장소 이름 기준 base path를 맞추기 위한 변수입니다.
  - 예: `/ltc-assistant/`

## 지식 문서 구조

- `knowledge/`
  - 일반 실무 문서, 법령, 고시, 참고 자료를 둡니다.
- `knowledge/eval/`
  - 평가용 질의응답, 평가 매뉴얼, 평가 관련 참고 문서를 둡니다.
- `knowledge/evaluation/`
  - 평가 위키 탭에서 사용하는 구조화된 평가 정리 문서를 둡니다.

문서 추가 방식:

- `knowledge/` 또는 하위 폴더에 `.md`, `.txt` 문서를 추가하면 앱이 빌드 시점에 읽어옵니다.
- `knowledge/eval/` 경로의 문서는 평가 전용 상담 및 평가 중심 분류에 반영됩니다.

## 기술 스택

- `React 19`
- `Vite 6`
- `TypeScript`
- `Tailwind CSS 4`
- `@google/genai`
- `Express`

## 배포

- `main` 브랜치에 push 하면 GitHub Pages 배포 워크플로가 실행됩니다.
- 배포 빌드에서는 `VITE_BASE_PATH=/${repository-name}/` 형식으로 base path를 맞춥니다.
- 현재 저장소 기준 Pages 주소는 [https://maumph.github.io/ltc-assistant/](https://maumph.github.io/ltc-assistant/) 입니다.

CI:

- Pull Request 기준으로 `npm run lint`
- Pull Request 기준으로 `npm run build`

## 주의사항 / 한계

- 현재 지식 문서는 클라이언트 번들에 포함되는 구조입니다.
- 지식베이스 탭에서는 원문을 직접 보여주지 않지만, 서버 비공개형 아키텍처는 아닙니다.
- `/api/chat` 서버 경로가 존재하더라도 현재 앱의 기본 사용 흐름은 브라우저에서 Gemini를 직접 호출하는 방식입니다.
- 지식 문서가 많아질수록 프런트 번들 크기가 커질 수 있습니다.
