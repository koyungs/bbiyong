# 호환성과 검증 범위

## 필요한 기능

`SillyTavern.getContext()`, 네 인자의 `generate_interceptor`, 공개 event bus와 `GENERATION_STARTED`, `GENERATION_STOPPED`, `GENERATE_AFTER_DATA`, 공식 `getTokenCountAsync`, 브라우저 `AbortController`, `crypto.getRandomValues`, `WeakRef`가 필요합니다. 버전 문자열이나 본체 hash로 차단하지 않고 런타임에서 확인합니다.

Chat Completion은 공개 `ChatCompletionService.sendRequest`와 export된 generation parameter helper가 있으면 별도 AbortSignal을 사용합니다. 없으면 공식 `generateRawData`/`generateRaw`로 fallback합니다. Text Completion도 이 raw 경로를 사용합니다. 해당 경로의 prompt/settings event가 없으면 판단을 건너뜁니다.

Kobold/Horde/NovelAI 경로는 `generateRawData`가 있는 환경에서만 시도합니다. 오래된 raw helper에는 해당 경로의 입력 교체 event가 없어 결과 채택 전에 불필요한 요청을 보내는 일을 피하기 위해 건너뜁니다. 이 세 provider의 실연결/fixture 검증은 수행하지 않았으며 검증한 backend 형식은 Chat Completion과 Text Completion입니다.

내부 Stage는 Generate를 재귀 호출하지 않고 채팅 메시지를 저장하지 않습니다. raw API에 caller AbortSignal이 없는 버전에서는 timeout/취소 시 로컬 결과 채택을 중단하지만 이미 실행 중인 HTTP 요청은 계속될 수 있습니다. 최근 raw API의 Stop 처리는 해당 API가 제공하는 범위에서 작동합니다.

## Final 범위와 토큰 공간

Final은 전역 extension prompt에 보관하지 않습니다. 현재 interceptor가 받은 이력 사본에 불투명한 일회용 표식을 두고, 그 표식이 들어 있는 요청에서만 Final을 전달합니다. 공개 토큰 계산기로 Final과 표식의 크기를 측정하여 Final 및 작은 역할 오버헤드에 필요한 공간을 미리 예약합니다. 계산 실패/지연 또는 공간 부족 시 Final 없이 계속합니다. 다른 확장이 표식을 제거하거나 역할을 바꾸면 Final을 적용하지 않습니다.

이 표식은 저장된 채팅을 바꾸지 않지만 해당 생성의 임시 이력에 system/narrator 항목 하나를 추가합니다. 따라서 history depth와 context 예산에 영향을 줄 수 있습니다. 표식은 실제 Final 내용을 담지 않으며, Character Judgment가 World Info를 재스캔하지 않습니다. interceptor 전에 요청 소유권이 확인된 공개 World Info snapshot이 없어 Stage 1의 추가 background input은 `NONE`입니다. 원래 응답의 World Info/카드는 SillyTavern이 계속 처리합니다.

Final consume 후 재사용 가능한 pending 데이터를 없애고 Stop/채팅 변경/새 foreground 실행에 대한 요청 취소 정보만 유지합니다. 본체의 `GENERATION_ENDED`는 generation ID가 없으므로 다른 quiet 실행의 종료와 구별할 수 없습니다. 겹침이 관측된 경우 그 이벤트만으로 새 실행을 끝내지 않으며, 응답 수신·다음 실행·Stop 또는 최대 5분 만료에서 정리합니다. 이미 직렬화·전송된 HTTP 요청에는 소급 적용되지 않습니다. 제3자 확장이 요청을 임의로 복제·변형하는 모든 조합을 보증하지 않습니다.

## Upstream cancellation race

Judgment interceptor가 끝난 뒤 **Stop → 즉시 quiet/regenerate**를 실행하면 SillyTavern의 전역 abortController가 교체되어 이전 foreground 요청이 재개될 수 있습니다. 실제 upstream 함수로 vanilla/CJ를 비교했으며 동일한 현상으로 분류했습니다: **UPSTREAM LIMITATION**. CJ는 이전 Stage 결과와 Final을 폐기하고 새 Generate 호출을 만들지 않습니다. 이 문제를 고치기 위한 본체 패치는 포함하지 않습니다.

## 테스트한 범위

조사한 upstream은 release, staging, 1.19.0, 1.18.0, 1.17.0, 1.13.5, 1.12.14입니다. 실제 raw/history 함수와 모의 provider를 결합했습니다. Generate 진입부, interceptor runner, Stop, request dispatcher 비교는 앞의 5개 revision에서 수행했습니다. 이것은 모든 과거/미래 버전이나 모든 provider의 전체 앱 호환성 인증이 아닙니다.

Stage 4 subject drift는 기존 semantic baseline의 관찰 사항이며 이번 릴리스에서 튜닝하지 않았습니다. 실제 모델 품질, 실제 Gemini 연결, Android/Termux 실기기, 모든 프롬프트 관리 설정과 전체 앱 E2E는 별도 검증 대상입니다.
