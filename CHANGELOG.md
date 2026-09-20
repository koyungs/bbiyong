# 0.5.2-rc.2-structure

- rc.1 프롬프트 7개, 판단 지침, parser, pipeline 및 호출 구조를 그대로 유지.
- 동일 API 내 연결 설정 변경, Final marker 오류 및 예약 실패 시 실행 정리 보강.
- 초기화 재시도·부분 event API에서 listener 누락/중복 방지.
- 겹친 실행의 늦은 종료·메시지 이벤트가 새 실행과 진단 상태에 영향을 주는 경로 차단.
- 명시적으로 다른 generation type의 요청에서 Final 소비 차단.
- 텍스트 completion 취소 시 원래 내용과 같은 문자열이 있어도 자신이 삽입한 Final 위치만 복원.
- Protected 공개 배포에 Terser 5.43.1 적용. stable 승격, WI 연결, 지원 type 확장 없음.

# 변경 기록

## 0.5.2-rc.1 — 부분 수정 검수 후보 (2026-09-20)

- TARGET 이름 echo와 Stage 4 긴 subject echo를 제거하고 코드 소유 identity/원문을 사용합니다. C#와 분기/난수 기준은 유지합니다.
- 채팅별 판단 지침을 동결하여 Stage 1B/행동 방향/Final에 분리 전달합니다. 실행 중 변경은 stale 처리합니다.
- 공식 이름 매크로 API로 `{{char}}`/`{{user}}`를 치환합니다. 전체 매크로 해석이 아니며 상태 변경 매크로를 다시 실행하지 않습니다.
- 빈 장면 명시적 skip, 이름 macro 실패 fail-open, 사용자 이름 변경 stale 검사, reference 미연결 표시, 정상 종료 한국어 표시를 추가했습니다.
- **미완료:** 실제 활성 WI snapshot, 자동 preset 수집, 전체 카드 macro/override 정렬, 실모델 검증. dry-run 재스캔은 부작용과 확률 재추첨 위험 때문에 연결하지 않았습니다.
- P2 cache/영어 내부 출력/수동 재사용/모델별 모드는 추가하지 않았습니다.

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
