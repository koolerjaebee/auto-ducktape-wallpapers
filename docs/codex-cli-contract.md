# Codex CLI 계약

## 목적

앱과 Codex CLI 사이의 경계를 고정한다. 앱은 Codex가 처리할 작업을 구조화해 전달하고, Codex는 생성 결과와 manifest를 남긴다.

## 호출 방식

기본 호출:

```bash
codex exec --json --sandbox workspace-write -
```

앱은 stdin으로 전체 작업 프롬프트를 전달한다. stdout의 JSONL은 진행 상태 표시에만 사용하고, 최종 성공 판단은 `manifest.json`으로 한다.

앱은 `settings.codex.timeoutSeconds` 이후에도 Codex process가 끝나지 않으면 해당 실행을 실패로 처리한다.

## 작업 명세

작업 명세는 기본적으로 루트 `settings.json`에서 생성된다. 앱은 설정값을 읽어 `codex exec`에 전달할 JSON payload와 자연어 지시를 조립한다.

```json
{
  "task": "generate_and_prepare_wallpaper",
  "imageModel": "gpt-image-2",
  "fallback": "disabled",
  "promptMode": "simple",
  "userInstruction": "매번 새롭고 기분 좋은 데스크톱 월페이퍼를 만들어줘. 너무 복잡하지 않은 깔끔한 구도, 아이콘이 잘 보이는 여백, 부드러운 색감, 텍스트와 로고 없는 이미지를 원해.",
  "randomPromptScript": {
    "enabled": true,
    "seed": "string",
    "mode": "always_for_simple_prompts",
    "selected": {
      "contentTwist": "a tiny story implied by one object in the scene",
      "composition": "wide negative space on one side for desktop icons",
      "mood": "soft and heartwarming",
      "surpriseDetail": "one tiny object that rewards a second look"
    },
    "script": "Intermediate random prompt script..."
  },
  "promptVariation": {
    "enabled": false
  },
  "run": {
    "timestamp": "2026-05-04T06:19:30.000Z",
    "filenameTimestamp": "20260504T061930Z"
  },
  "naming": {
    "imageFilenamePattern": "{routineId}-{targetId}-{timestamp}.png",
    "timestamp": "20260504T061930Z"
  },
  "postProcessing": {
    "resolutionPolicy": "native_then_best_available_then_local_fit",
    "maxGptImage2UpscaleAttempts": 0,
    "onUpscaleFailure": "select_best_available_image_for_target",
    "localFitFallback": "allowed_for_canvas_conformance_only"
  },
  "retention": {
    "schedule": "monthly",
    "olderThanDays": 30,
    "action": "move_to_trash",
    "scope": "generated_runtime_images"
  },
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
- 이미지 파일명은 `{routineId}-{targetId}-{timestamp}.png` 패턴을 따른다.
- 기본 자동 루틴에서는 생성 이미지가 target보다 작아도 `gpt-image-2` 보강 재시도를 하지 않는다.
- `maxGptImage2UpscaleAttempts`가 1 이상이면 같은 Codex 세션에서 해당 이미지를 다시 `gpt-image-2`에 보내 고해상도 보강을 요청한다.
- 설정된 보강 횟수 이후에도 실패하면 가장 나은 후보 이미지를 선택한다.
- 로컬 resize/crop/pad는 canvas가 맞지 않을 때만 사용한다.
- 결과 manifest를 반드시 작성한다.
- 로컬 fit을 사용했다면 `warnings`에 기록한다.
- 실패하면 부분 성공처럼 보이지 않게 `status: "error"`를 쓴다.
- Codex는 mobile relay 업로드를 수행하지 않는다. relay 전달은 앱의 후속 단계다.

## 결과 manifest

```json
{
  "status": "ok",
  "model": "gpt-image-2",
  "finalPrompt": "A calm focused morning wallpaper...",
  "postProcessing": {
    "nativeGeneration": "attempted",
    "gptImage2Upscale": {
      "status": "not_required",
      "attempts": 0,
      "maxAttempts": 3
    },
    "selectedOutputReason": "native_target_size",
    "localFinalFit": "not_required"
  },
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
- 작은 이미지가 나온 경우 설정에 따라 보강 pass 또는 best-available fallback이 실행됐는지 확인
- `gpt-image-2` 보강 시도가 설정된 횟수를 넘지 않았는지 확인
- target 해상도 실패 시 best-available 후보가 선택됐는지 확인
- 로컬 final fit이 실행된 경우 manifest `warnings`에 기록됐는지 확인
- output filename에 timestamp가 포함됐는지 확인
- 적용 전 파일 크기와 포맷을 확인

## 보관 규칙

- 앱은 월 1회 generated runtime image directory를 검사한다.
- 생성 후 30일이 지난 이미지는 영구 삭제하지 않고 시스템 휴지통으로 옮긴다.
- 현재 적용 중인 wallpaper 파일은 삭제/이동 전에 OS별 current reference 여부를 확인한다.
- 휴지통 이동 실패는 debug 로그와 maintenance 결과에 기록한다.

## 모바일 전달 규칙

- Android target output은 먼저 로컬 output directory에 생성한다.
- 앱은 manifest 검증 이후 Android device용으로 image payload를 암호화한다.
- 다른 네트워크의 Android 기기에는 DB 없는 mobile relay를 통해 encrypted object만 전달한다.
- relay에는 계정 DB, job DB, 이미지 메타데이터 DB를 두지 않는다.
- relay object는 ack 이후 삭제하고, ack가 없어도 짧은 lifecycle retention으로 만료한다.
- relay API는 upload, latest poll, image download, ack/delete 범위로 제한한다.
- relay는 Codex 실행, shell 접근, 임의 파일 읽기, OpenAI credential 처리를 노출하지 않는다.

## 보안 규칙

- 앱은 `~/.codex/auth.json`을 읽지 않는다.
- 앱은 Codex token을 저장하지 않는다.
- mobile relay는 end-to-end encrypted payload만 다룬다.
- 로그에는 사용자 프롬프트를 저장할 수 있으나, 사용자가 끌 수 있어야 한다.
- debug 로그에는 Codex CLI 경로와 run id만 남긴다.
