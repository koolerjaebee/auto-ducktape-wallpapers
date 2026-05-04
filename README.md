# Auto Ducktape Desktop

Codex CLI wrapper for scheduled GPT Image 2 wallpaper generation and application.

이 프로젝트는 OpenAI API를 직접 호출하지 않습니다. 데스크톱 앱이 루틴, 기기 해상도, 사용자 지시사항을 모아 `codex exec`에 넘기고, Codex가 프롬프트 작성과 `gpt-image-2` 이미지 생성을 모두 수행하는 구조를 목표로 합니다.

## 초기 범위

- Windows/macOS 데스크톱 앱
- Codex CLI 기반 생성
- `gpt-image-2` 전용 이미지 생성
- 모니터/스마트폰 모델별 해상도 설정
- Android 연동은 2차 범위
- iOS는 후순위 로드맵

## 빠른 확인

```bash
npm run demo:task
```

실제 Codex 실행은 아직 POC 단계입니다.

```bash
npm run codex:dry-run
```

## 문서

- [아키텍처](docs/architecture.md)
- [Codex CLI 계약](docs/codex-cli-contract.md)
- [POC 계획](docs/poc-plan.md)
