# Codex CLI 계약

## 목적

앱과 Codex CLI 사이의 경계를 고정한다. 앱은 Codex가 처리할 작업을 구조화해 전달하고, Codex는 생성 결과와 manifest를 남긴다.

## 호출 방식

기본 호출:

```bash
codex exec --json --sandbox workspace-write -
```

앱은 stdin으로 전체 작업 프롬프트를 전달한다. stdout의 JSONL은 진행 상태 표시에만 사용하고, 최종 성공 판단은 `manifest.json`으로 한다.

## 작업 명세

```json
{
  "task": "generate_and_prepare_wallpaper",
  "imageModel": "gpt-image-2",
  "fallback": "disabled",
  "promptMode": "simple",
  "userInstruction": "매일 아침 집중 잘 되는 차분한 배경",
  "targets": [
    {
      "id": "main-monitor",
      "platform": "macos",
      "width": 3840,
      "height": 2160,
      "usage": "desktop_wallpaper"
    }
  ],
  "output": {
    "directory": "./out",
    "manifest": "./out/manifest.json"
  }
}
```

## Codex 지시 템플릿

Codex에게 전달하는 자연어 지시는 다음 원칙을 포함한다.

- `gpt-image-2`만 사용한다.
- 다른 이미지 모델로 fallback하지 않는다.
- 사용자의 simple instruction은 이미지 프롬프트로 확장한다.
- advanced prompt는 의미를 보존한다.
- target별 정확한 해상도로 이미지 파일을 만든다.
- 결과 manifest를 반드시 작성한다.
- 실패하면 부분 성공처럼 보이지 않게 `status: "error"`를 쓴다.

## 결과 manifest

```json
{
  "status": "ok",
  "model": "gpt-image-2",
  "finalPrompt": "A calm focused morning wallpaper...",
  "outputs": [
    {
      "targetId": "main-monitor",
      "path": "./out/main-monitor.png",
      "width": 3840,
      "height": 2160,
      "format": "png"
    }
  ],
  "warnings": []
}
```

실패 예시:

```json
{
  "status": "error",
  "model": "gpt-image-2",
  "error": {
    "code": "generation_failed",
    "message": "Codex could not generate the requested image."
  },
  "outputs": []
}
```

## 앱 검증 규칙

- `status`가 `ok`인지 확인
- `model`이 `gpt-image-2`인지 확인
- 모든 target에 output이 있는지 확인
- 파일이 존재하는지 확인
- 이미지 해상도가 target과 일치하는지 확인
- 적용 전 파일 크기와 포맷을 확인

## 보안 규칙

- 앱은 `~/.codex/auth.json`을 읽지 않는다.
- 앱은 Codex token을 저장하지 않는다.
- 로그에는 사용자 프롬프트를 저장할 수 있으나, 사용자가 끌 수 있어야 한다.
- debug 로그에는 Codex CLI 경로와 run id만 남긴다.
