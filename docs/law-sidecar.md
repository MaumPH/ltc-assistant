# Korean Law Sidecar

이 프로젝트는 `knowledge/`와 내부 인덱스를 우선 사용하고, 근거가 약할 때만 `korean-law-mcp`를 선택적으로 fallback 호출합니다.

## 기본 원칙

- 앱 서버는 법제처 API 키를 직접 사용하지 않습니다.
- 법제처 API 키(`LAW_OC`)는 sidecar 프로세스에만 주입합니다.
- fallback은 `LAW_FALLBACK_CONFIDENCE_THRESHOLD`, 법령 참조 미매치, 로컬 evidence 부족 조건에서만 발동합니다.
- sidecar가 꺼져 있어도 앱 서버는 로컬 검색만으로 계속 응답합니다.

## 앱 서버 환경 변수

앱 서버 `.env`에는 아래 값만 둡니다.

```dotenv
LAW_MCP_ENABLED=true
LAW_MCP_BASE_URL=http://127.0.0.1:3100
LAW_FALLBACK_CONFIDENCE_THRESHOLD=low
ONTOLOGY_GRAPH_DEPTH=1
```

## Sidecar 실행

`korean-law-mcp`는 공개 문서 기준 `--mode http --port <port>` 실행을 지원합니다.

### 빠른 개발 실행

PowerShell:

```powershell
$env:LAW_OC="your-law-api-key"
npm run dev:law-sidecar
```

기본값:

- sidecar command: `npx -y korean-law-mcp --mode http --port 3100`
- app fallback URL: `http://127.0.0.1:3100`

### 커스텀 sidecar command

별도 checkout 또는 래퍼를 쓰고 싶으면 `LAW_SIDECAR_COMMAND`로 덮어쓸 수 있습니다.

```powershell
$env:LAW_OC="your-law-api-key"
$env:LAW_SIDECAR_COMMAND="npx tsx C:\path\to\korean-law-mcp\src\index.ts --mode http --port 3200"
$env:LAW_MCP_BASE_URL="http://127.0.0.1:3200"
npm run dev:law-sidecar
```

## 운영 예시

리눅스 서버에서는 앱 서버와 sidecar를 별도 프로세스로 관리합니다. `systemd`, Docker Compose, 혹은 동등한 프로세스 매니저 구성이면 충분합니다.

예시 개념:

- `ltc-app.service`: 현재 Express/Vite 서버
- `ltc-law-mcp.service`: `korean-law-mcp --mode http --port 3100`
- sidecar 서비스에만 `LAW_OC` 주입
- 앱 서비스에는 `LAW_MCP_BASE_URL=http://127.0.0.1:3100`만 주입

## 참고

- [korean-law-mcp README](https://github.com/chrisryugj/korean-law-mcp)
- [korean-law-mcp API 문서](https://github.com/chrisryugj/korean-law-mcp/blob/main/docs/API.md)
- [OpenCrab](https://github.com/AlexAI-MCP/OpenCrab)
