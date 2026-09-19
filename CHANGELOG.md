# 변경 기록

## 0.5.1 — Canonical connection reference

- Priority 단계가 코드에서 부여한 SOURCE ID로 연결을 참조하여 긴 문장의 복사·줄바꿈 차이로 발생하던 false failure를 제거합니다.
- ID 존재·유일성·완전성을 검증하고 Stage 1B 연결 원문을 복원합니다. partial overlap/subset, Barrier 제외, branch·Final·random·lifecycle은 유지합니다.
- UI `stage 3` parsed 값의 코드 복원 출처를 표시합니다. 다른 Stage prompt와 UI 구조는 그대로입니다.

## 0.5.0 — Universal Public Extension

- 본체 패치와 native lifecycle 의존성을 제거하고 공식 interceptor/event/raw request API를 사용합니다.
- 실행별 runId와 채팅·화자·장면·카드 검사를 적용하며 중단되거나 오래된 Stage 결과를 버립니다.
- 현재 요청의 표식에 결합한 Final을 한 번 전달하고, 취소된 요청의 표식과 전송 전 Final을 정리합니다.
- Final의 토큰 공간을 먼저 예약하며 지원 API가 없거나 판단이 실패하면 원래 응답으로 계속합니다.
- v0.4.18 Drawer + Stage2Fix의 semantic prompt, parser, Stage2Fix, Stage 4, 난수 선택과 UI 스타일을 유지합니다.
- 루트에 manifest/index가 있는 Protected 공개 저장소 구조를 제공합니다. Stop 직후 overlap은 문서화된 upstream limitation입니다.
