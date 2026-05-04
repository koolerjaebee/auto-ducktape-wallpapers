# POC 계획

## 성공 기준

1. 앱이 `codex exec`를 실행할 수 있다.
2. Codex가 simple instruction을 이미지 프롬프트로 확장한다.
3. Codex가 `gpt-image-2`로 이미지를 생성한다.
4. 기본 자동 루틴에서는 생성 이미지가 target보다 작아도 `gpt-image-2` 고해상도 보강을 재시도하지 않고 best-available 후보를 선택한다.
5. Codex가 `manifest.json`을 작성한다.
6. 앱이 manifest와 이미지 해상도를 검증한다.
7. 고품질/수동 프로필에서 보강을 켠 경우, 설정된 횟수 실패 후 best-available 후보 이미지를 선택한다.
8. 앱이 Windows/macOS 바탕화면에 이미지를 적용한다.

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
- 기본 자동 루틴에서는 target보다 작은 산출물이 나와도 즉시 best-available 후보 선택
- 고품질/수동 프로필에서만 같은 Codex 세션의 `gpt-image-2` 고해상도 보강 요청
- 보강 시도는 `settings.postProcessing.maxGptImage2UpscaleAttempts`로 제한
- 보강 실패 시 aspect ratio, 픽셀 면적, 시각적 적합성 기준으로 best-available 후보 선택
- AI 보강 후에도 canvas가 맞지 않을 때만 로컬 final fit 수행
- local final fit 사용 여부를 manifest warnings에 기록
- output filename에 timestamp 포함 여부 확인

### 3단계: 바탕화면 적용

- macOS: `NSWorkspace` 기본 적용. AppleScript fallback은 macOS Automation 권한 팝업을 피하기 위해 명시적으로 켠 경우에만 사용
- Windows: `IDesktopWallpaper` 우선, 단일 모니터 fallback 검토

### 4단계: 루틴화

- hourly/daily 스케줄러
- 실패 재시도
- 마지막 성공 기록

### 5단계: Android

- 스마트폰 모델 catalog 추가
- Android Agent가 display metrics 등록
- 같은 네트워크에서는 LAN direct로 최신 이미지 수신
- 다른 네트워크에서는 DB 없는 encrypted mobile relay로 최신 이미지 수신
- 최신 이미지 수신 후 `WallpaperManager` 적용

### 5.5단계: Mobile relay

- Cloudflare Workers + R2 기반 POC 검토
- DB 없이 encrypted image object와 encrypted manifest sidecar만 저장
- object lifecycle로 24시간 후 자동 만료
- Android ack 이후 object 삭제
- relay API는 upload, latest poll, image download, ack/delete만 제공
- remote Codex 실행, shell 접근, 임의 파일 읽기 API 금지

### 6단계: Retention cleaner

- 월 1회 실행되는 maintenance trigger 추가
- 생성 후 30일이 지난 이미지 탐색
- 영구 삭제 대신 시스템 휴지통으로 이동
- 현재 적용 중인 wallpaper 파일은 이동 제외
- 이동 실패는 debug 로그와 maintenance result에 기록

## 검증에서 막히면 선택지

- 선택지 A: Codex CLI만 유지하고, 사용자가 생성 thread를 승인하는 semi-auto 모드 제공
- 선택지 B: Codex Automations를 루틴 실행 주체로 사용
- 선택지 C: 제품 원칙을 바꾸지 않고 API 모드는 별도 실험 브랜치로만 분리
