# 0.5.2-rc.2-structure 검증 범위

rc.1의 자연어 prompt, parser, pipeline, random 선택과 호출 수는 동결했습니다. 공개 Context에 노출되는 chat/text completion 연결 설정이 실행 중 바뀌면 이전 판단을 폐기합니다. Context가 제공하지 않는 다른 provider의 내부 설정 변경까지 식별한다고 주장하지 않습니다.

Vanilla ST의 MESSAGE_RECEIVED / GENERATION_ENDED에는 generation run ID가 없습니다. quiet 또는 foreground 겹침을 관찰한 이후에는 이 이벤트만으로 현재 실행의 소유권을 확정하지 않습니다. 이 경우 Final 소비 뒤에도 Stop 취소를 위한 제한된 상태와 최대 5분 만료 타이머를 유지하고, Stop·새 foreground·dispose·만료 시 정리합니다. 모호하지 않은 정상 완료는 즉시 정리합니다. 임의 확장이 요청 본문을 복제·재작성하거나 provider에 이미 전달된 요청은 완전한 취소를 보장할 수 없습니다.

Protected는 casual analysis 방어입니다. 실행에 필요한 프롬프트는 메모리와 provider 요청에서 복원되므로 암호학적 비밀 보장은 아닙니다.

아래는 기반 버전부터 유지되는 환경 설명입니다. 위 종료 이벤트 규칙이 우선합니다.

# 호환성과 검증 범위

## 이번 RC의 명시적 한계

WI 실제 연결은 미완료입니다. `getWorldInfoPrompt(..., true)`는 이 후보판에서 호출하지 않습니다. native 스캔 이벤트/Author’s Note 변경/확률 추첨을 중복 실행하지 않고, 이전 생성의 WI 결과를 현재 생성에 재사용하지 않습니다. 따라서 Stage 1A의 추가 background는 NONE, UI는 미연결입니다. 정상 RP의 native WI 처리는 기존 ST 경로에 맡깁니다. 실제 활성 WI 0/1/4개 입력은 통합 검증하지 않았습니다.

판단 지침은 채팅별 전용 입력만 지원합니다. Stage 1A 직접 입력에는 없지만 Stage 1B 이후의 모델이 이를 올바르게 의미 구분하는 것은 prompt 지시이며 프로그램으로 증명한 사실이 아닙니다. Priority 기준은 변경하지 않습니다.

`{{char}}`/`{{user}}`는 공식 `context.substituteParams`의 호환 인자 형식으로만 해석합니다. 다른 macro, scenario override, group 카드 합성까지 native Final과 완전히 같다고 주장하지 않습니다. 특히 `setvar`/`incvar`/random 등은 두 번 실행하지 않도록 raw 보존합니다. 지원하지 않는 다른 macro가 있으면 call 진단에 원문 보존 상태가 표시됩니다.


## 필요한 기능

`SillyTavern.getContext()`, 네 인자의 `generate_interceptor`, 공개 event bus와 `GENERATION_STARTED`, `GENERATION_STOPPED`, `GENERATE_AFTER_DATA`, 공식 `getTokenCountAsync`, 브라우저 `AbortController`, `crypto.getRandomValues`, `WeakRef`가 필요합니다. 버전 문자열이나 본체 hash로 차단하지 않고 런타임에서 확인합니다.

Chat Completion은 공개 `ChatCompletionService.sendRequest`와 export된 generation parameter helper가 있으면 별도 AbortSignal을 사용합니다. 없으면 공식 `generateRawData`/`generateRaw`로 fallback합니다. Text Completion도 이 raw 경로를 사용합니다. 해당 경로의 prompt/settings event가 없으면 판단을 건너뜁니다.

Kobold/Horde/NovelAI 경로는 `generateRawData`가 있는 환경에서만 시도합니다. 오래된 raw helper에는 해당 경로의 입력 교체 event가 없어 결과 채택 전에 불필요한 요청을 보내는 일을 피하기 위해 건너뜁니다. 이 세 provider의 실연결/fixture 검증은 수행하지 않았으며 검증한 backend 형식은 Chat Completion과 Text Completion입니다.

내부 Stage는 Generate를 재귀 호출하지 않고 채팅 메시지를 저장하지 않습니다. raw API에 caller AbortSignal이 없는 버전에서는 timeout/취소 시 로컬 결과 채택을 중단하지만 이미 실행 중인 HTTP 요청은 계속될 수 있습니다. 최근 raw API의 Stop 처리는 해당 API가 제공하는 범위에서 작동합니다.

## Final 범위와 토큰 공간

Final은 전역 extension prompt에 보관하지 않습니다. 현재 interceptor가 받은 이력 사본에 불투명한 일회용 표식을 두고, 그 표식이 들어 있는 요청에서만 Final을 전달합니다. 공개 토큰 계산기로 Final과 표식의 크기를 측정하여 Final 및 작은 역할 오버헤드에 필요한 공간을 미리 예약합니다. 계산 실패/지연 또는 공간 부족 시 Final 없이 계속합니다. 다른 확장이 표식을 제거하거나 역할을 바꾸면 Final을 적용하지 않습니다.

이 표식은 저장된 채팅을 바꾸지 않지만 해당 생성의 임시 이력에 system/narrator 항목 하나를 추가합니다. 따라서 history depth와 context 예산에 영향을 줄 수 있습니다. 표식은 실제 Final 내용을 담지 않으며, Character Judgment가 World Info를 재스캔하지 않습니다. interceptor 전에 요청 소유권이 확인된 공개 World Info snapshot이 없어 Stage 1의 추가 background input은 `NONE`입니다. 원래 응답의 World Info/카드는 SillyTavern이 계속 처리합니다.

Final consume 후 재사용 가능한 pending 데이터를 없애고 Stop/채팅 변경/새 foreground 실행에 대한 요청 취소 정보만 유지합니다. 본체의 종료·응답 이벤트는 generation ID가 없어 겹친 실행의 소유권 증명이 되지 않습니다. 겹침이 관측된 경우 새 foreground·Stop·dispose 또는 최대 5분 만료에서 정리합니다. 이미 직렬화·전송된 HTTP 요청에는 소급 적용되지 않습니다. 제3자 확장이 요청을 임의로 복제·변형하는 모든 조합을 보증하지 않습니다.

## Upstream cancellation race

Judgment interceptor가 끝난 뒤 **Stop → 즉시 quiet/regenerate**를 실행하면 SillyTavern의 전역 abortController가 교체되어 이전 foreground 요청이 재개될 수 있습니다. 실제 upstream 함수로 vanilla/CJ를 비교했으며 동일한 현상으로 분류했습니다: **UPSTREAM LIMITATION**. CJ는 이전 Stage 결과와 Final을 폐기하고 새 Generate 호출을 만들지 않습니다. 이 문제를 고치기 위한 본체 패치는 포함하지 않습니다.

## 테스트한 범위

조사한 upstream은 release, staging, 1.19.0, 1.18.0, 1.17.0, 1.13.5, 1.12.14입니다. 실제 raw/history 함수와 모의 provider를 결합했습니다. Generate 진입부, interceptor runner, Stop, request dispatcher 비교는 앞의 5개 revision에서 수행했습니다. 이것은 모든 과거/미래 버전이나 모든 provider의 전체 앱 호환성 인증이 아닙니다.

Stage 4의 subject 문자열 재출력 검사는 이 후보판에서 제거했습니다. 모델이 실제 행동 방향을 선택된 subject와 의미상 연결하는지는 여전히 실모델 검증이 필요합니다. 실제 모델 품질, 실제 Gemini 연결, Android/Termux 실기기, 모든 프롬프트 관리 설정과 전체 앱 E2E는 별도 검증 대상입니다.
