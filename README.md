# Character Judgment Universal 0.5.1

SillyTavern의 현재 장면과 대상 캐릭터 카드를 읽고, 선택된 판단 결과를 해당 응답 생성에 한 번 전달하는 확장입니다. v0.5.0의 판단 기준, 분기, 난수 선택, Final 의미와 Universal lifecycle을 유지하며, priority 단계의 연결 참조 방식을 안정화했습니다.

## 설치

**Extensions → Install extension**에 다음 주소를 입력하세요.

```text
https://github.com/koyungs/bbiyong.git
```

설치 후 새로고침하고 확장 설정의 **[캐해] Character Judgment**에서 **이 채팅에서 활성화**를 켭니다. 기본값은 꺼짐입니다. 기존 Native판 또는 테스트판 Character Judgment가 설치되어 있다면 중복 실행되지 않도록 기존 확장을 끄거나 제거하고 하나만 사용하세요.

별도 본체 패치나 설치 스크립트가 필요하지 않습니다. PC, Launcher, Android/Termux에서 같은 확장 파일을 사용합니다. 현재 SillyTavern 연결과 모델을 사용하므로 판단 과정에서도 모델 호출 비용이 발생합니다.

## 동작

- 일반 Send, regenerate, swipe와 그룹의 현재 화자를 처리합니다. quiet, impersonate, Continue는 판단을 실행하지 않습니다.
- PRIORITY YES이면 모든 YES를 유지하고 Stage 4를 건너뜁니다. 모두 NONE이면 현재 상황 전체에서 주제를 뽑은 뒤 Stage 4의 행동 방향을 뽑습니다. 카드 연결이 없으면 priority 단계를 건너뜁니다.
- 판단에는 3회 또는 4회의 내부 모델 호출이 필요합니다. 원래 응답은 SillyTavern이 이어서 생성합니다.
- 오류, timeout, 파싱 실패, 장면·화자 변경, 필요한 API 부재는 판단을 버리고 원래 응답으로 계속합니다. Stop은 현재 판단과 아직 전송 전인 Final을 무효화합니다.
- `call` 탭에서 실행 결과를 확인합니다. 최근 16회 기록은 현재 페이지의 진단용이며 다음 판단에 재사용하지 않습니다.
- 긴 연결 문장을 priority 출력에 다시 복사하지 않습니다. 코드가 연결 ID를 검증하고 원문을 복원하며, UI `stage 3`에서 모델 원문과 코드가 복원한 parsed 값을 구분합니다.

## Universal의 범위

Character Judgment는 SillyTavern의 공식 extension lifecycle 안에서 동작합니다. 사용자가 Stop을 누른 직후 다른 generation을 즉시 시작하는 극단적인 overlap에서는 **vanilla SillyTavern upstream cancellation race**로 이전 foreground 요청이 core 내부에서 재개될 수 있습니다. Character Judgment는 중단된 판단 결과와 Final을 이후 generation에 재사용하지 않으며, 원래 Generate를 다시 호출하지 않습니다. 이미 서버에 전송된 요청을 소급해서 취소할 수는 없습니다.

이 공개판은 Protected runtime입니다. 보호 목적은 **casual prompt extraction resistance**이며, 암호화나 DRM이 아닙니다. 실행 중 요청 관찰이나 의도적인 역공학을 차단한다고 주장하지 않습니다.

검증은 실제 upstream 함수와 모의 provider를 결합한 자동 테스트 및 브라우저 컴포넌트 테스트 범위입니다. 실제 모델/Gemini, Android/Termux 실기기, 전체 SillyTavern browser E2E까지 검증했다는 뜻은 아닙니다. 자세한 API 호환성과 제약은 [COMPATIBILITY.md](COMPATIBILITY.md), 설치 방법은 [INSTALL.md](INSTALL.md)를 보세요.
