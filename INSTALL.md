# 설치 — 0.5.2-rc.2-structure

공개배포용 Protected 구조 검수 후보판입니다. stable 릴리스는 아닙니다.

1. SillyTavern의 확장 기능 메뉴에서 Install Extension을 엽니다.
2. 아래 주소를 입력해 설치합니다.

```text
https://github.com/koyungs/bbiyong.git
```

3. SillyTavern 페이지를 새로고침하고 Character Judgment 버전이 `0.5.2-rc.2-structure`인지 확인합니다.
4. 원하는 채팅에서 확장을 활성화합니다. 기존 설치가 있다면 확장 업데이트 기능을 사용하고 중복 설치하지 않습니다.

저장소 루트에 manifest.json과 index.js가 직접 있습니다. 별도 native patch, installer, 본체 수정은 필요하지 않습니다.
수동 ZIP 설치 시에도 압축 내부의 파일을 확장 폴더 바로 아래에 놓습니다.

WI는 미연결입니다. normal/regenerate/swipe만 기존 지원 대상으로 유지하며 Continue/impersonate/quiet/unknown에는 판단을 추가하지 않았습니다.
지원 환경과 검증 한계는 [COMPATIBILITY.md](COMPATIBILITY.md)를 참고하세요.
