# Prompt Harness

`prompt_harness`는 장기요양 RAG 프롬프트를 수동 감이 아니라 고정 케이스로 비교하기 위한 최소 회귀 하네스다.

## 목적

- 기존 `system_prompt.md`와 `prompts/v2/*`를 같은 검색 결과 위에서 비교한다.
- 검색 알고리즘을 바꾸지 않고, 프롬프트 변경만으로 얼마나 나아졌는지 본다.
- 최소 평가축은 상태 라벨, 출처 구조, 확인 불가/질문 중단, 위계 처리, 날짜 표기, 과잉 단정 방지다.

## 파일

- `cases.json`: 평가 케이스 정의
- `results/`: 실행 결과 저장 위치. git에는 포함하지 않는다.

## 실행

```bash
npm run prompt:harness -- --dry-run
```

드라이런은 모델 호출 없이 아래만 검증한다.

- 케이스 파싱
- 프롬프트 조립
- 검색 결과 생성
- 출력 파일 작성

실제 모델 비교:

```bash
npm run prompt:harness -- --variant both --model gemini-3-flash-preview
```

옵션:

- `--dry-run`: 모델 호출 없이 프롬프트/검색만 검증
- `--variant baseline|v2|both`: 비교 대상 선택
- `--model <model-id>`: Gemini 모델 지정
- `--case <id>`: 특정 케이스만 실행
- `--limit <n>`: 앞에서 n개 케이스만 실행
- `--output <path>`: 결과 JSON 경로 지정

## 환경변수

- `GEMINI_API_KEY`: Gemini 호출용 API 키
- `PROMPT_HARNESS_MODEL`: 기본 모델 오버라이드

## 결과 해석

각 케이스는 다음을 확인한다.

- 상태 라벨 일치
- 필수 섹션 존재
- `must_include` / `must_not_include`
- 필요한 경우 확인 질문 유도

점수는 정답 보장이 아니라 회귀 비교용 지표다. 케이스 본문과 실제 응답을 함께 확인해야 한다.
