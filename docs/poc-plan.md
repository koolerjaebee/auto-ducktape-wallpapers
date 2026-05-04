# POC 계획

## 성공 기준

1. 앱이 `codex exec`를 실행할 수 있다.
2. Codex가 simple instruction을 이미지 프롬프트로 확장한다.
3. Codex가 `gpt-image-2`로 이미지를 생성한다.
4. Codex가 `manifest.json`을 작성한다.
5. 앱이 manifest와 이미지 해상도를 검증한다.
6. 앱이 Windows/macOS 바탕화면에 이미지를 적용한다.

## 단계

### 1단계: Codex CLI 생성 검증

- 임시 run directory 생성
- 작업 명세 작성
- `codex exec --json --sandbox workspace-write -` 실행
- `manifest.json` 확인

### 2단계: 해상도 검증

- 수동 target 해상도 입력
- macOS/Windows 현재 모니터 해상도 감지 추가
- 생성 파일의 실제 width/height 확인

### 3단계: 바탕화면 적용

- macOS: `NSWorkspace` 또는 AppleScript fallback 검토
- Windows: `IDesktopWallpaper` 우선, 단일 모니터 fallback 검토

### 4단계: 루틴화

- hourly/daily 스케줄러
- 실패 재시도
- 마지막 성공 기록

### 5단계: Android

- 스마트폰 모델 catalog 추가
- Android Agent가 display metrics 등록
- 최신 이미지 수신 후 `WallpaperManager` 적용

## 검증에서 막히면 선택지

- 선택지 A: Codex CLI만 유지하고, 사용자가 생성 thread를 승인하는 semi-auto 모드 제공
- 선택지 B: Codex Automations를 루틴 실행 주체로 사용
- 선택지 C: 제품 원칙을 바꾸지 않고 API 모드는 별도 실험 브랜치로만 분리
