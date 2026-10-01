# 확인 범위

기준은 동결 rc.6 Plain-Test입니다. rc.7은 그룹 생성 대상과 완료 생명주기를 수정합니다. C/M/L/W 저장 수명과 maintenance 분리·현재 Snapshot·외부 Swipe RNG를 유지합니다. native patch와 installer는 없습니다.

PM Engine bridge는 고정 공식 release `06bde939fb1e9c4c8d8641d810f0a916b5bce127`의 `getPromptCollection`/`preparePrompt` 함수로 검증했습니다. C identity는 rc.4가 확인한 staging `bc81b9f7e33f39afe3f919a66faaf93079276a1c`의 avatar 파일명/그룹 참조/native rename API를 유지합니다. 모든 역사적 ST 버전을 보장하지 않습니다.

Engine bridge는 요청 준비 함수 호출 중에만 preparePrompt를 감싸고 finally로 복원합니다. persistent prompt body는 수정하지 않습니다. 지원 API가 없으면 오류를 안내하며 native 버전별 추측 fallback은 넣지 않습니다. 다른 확장이 같은 준비 메서드나 최종 wire를 변조하는 모든 조합을 검증하지는 않았습니다.

로컬 검증은 source/Plain/Protected 및 ST API/provider fixture, 고정 upstream 함수, 360/390/430 CSS px 컴포넌트 UI를 사용합니다. Gemini/DeepSeek/GLM fixture는 format tolerance 시험이며 실제 서비스 호출 성공을 뜻하지 않습니다. 동결 시점에는 실제 모델을 호출하지 않았고 이후 Protected 설치에서 아래의 제한된 라이브 검증을 진행했습니다. 이번 일반판 게시에서는 런타임·프롬프트를 동결 Plain-Test와 동일하게 유지하며 별도의 라이브 실행은 하지 않았습니다.

그룹 생성 대상은 고정 staging `bc81b9f7e33f39afe3f919a66faaf93079276a1c`의 native 이벤트와 저장 함수로 확인했습니다. 생성 당시 실제 avatar를 캡처하며 현재 선택이 초기화되어도 같은 avatar의 카드를 다시 확인합니다. 완료 응답의 `original_avatar`가 없거나 다른 대상이면 C/L/Snapshot의 성공으로 처리하지 않습니다. 그룹 배열 순서와 표시 이름으로 대상을 추정하지 않습니다. 그룹 완료 전 streaming 종료 이벤트가 오면 응답을 기다리고, 그룹 wrapper가 끝나면 미완료 요청을 정리합니다.

동결 로컬 검증은 native 함수와 fixture를 실행한 결과입니다. 이후 실제 ST 1.19.0 staging 7c3994196 서버에 rc.7 Protected를 설치하여 Vertex Gemini 3.1의 Group Normal 및 새 Swipe 완료·avatar 일치·Snapshot 저장과 기존 Swipe 선택 시 Snapshot 폐기를 확인했습니다. LAN HTTP에서는 Web Crypto digest가 없어 CJ가 bypass됐으므로 성공 실행은 같은 서버를 임시 localhost 경로로 전달해 진행했습니다. Regenerate는 Gemini 3.1 응답 정체 및 Gemini 2.5 Flash Stage 1A 출력 계약 거부로 통과하지 못했습니다. Stop 뒤 UI pending 정리는 확인했지만 실제 provider abort·늦은 결과 폐기를 입증하지 않았습니다. 전체 서버 E2E 또는 모든 provider·환경의 호환성 PASS를 뜻하지 않습니다.

Normal/Regenerate: 요청 직전 S1 고정 + action slot draw 1회, native 1 completion, CJ 추가 호출 0. 기존 Swipe의 `crypto.getRandomValues` + rejection sampling helper를 그대로 재사용하며 subject draw는 없습니다. slot은 pending run에서 불변이고 기존 nonce/chat/card/source/world/PM 경계를 따릅니다. Continue/Impersonate/quiet/background에는 첫 action draw가 없습니다. Swipe: frozen 재선택 + Final only transport. Continue/append, Impersonate, quiet/background: full CJ bypass. malformed 응답에 자동 semantic retry는 없습니다. 기존 response nonce, chat/card/source/world/PM/connection ownership 검사를 유지합니다.

출력 필터는 MESSAGE_RECEIVED 완료 시점에 적용됩니다. native streaming 중에는 아직 검증되지 않은 envelope/internal 텍스트가 UI에 잠시 보일 수 있으며, malformed 응답은 CJ가 성공으로 저장하지 않고 native 원문으로 남깁니다. 이번 후보는 streaming renderer나 hidden-reasoning 표시 제어를 바꾸지 않습니다. 완성된 Stage 결과를 항상 숨기는 streaming UI가 필요하면 별도 검증이 필요합니다. 성공한 완료 응답에서는 internal/result를 제거하고 Final prose만 저장합니다. internal history/debug cache는 생성하지 않습니다.

원문 annotation은 정확히 일치하는 native 위치와 예산을 확인한 뒤 적용합니다. native 변환 source의 M/L은 request-local이며 raw M offsets로 저장하지 않습니다. Card macro/format 또는 WI regex로 원문 위치를 확인할 수 없으면 CJ를 생략합니다. 번역 확장 adapter, assistant prefill, tool calling, provider structured-output 의존성을 추가하지 않습니다.

Engine 기본값은 rc.4 의미 문안에 firstSelection 주소 호환만 추가한 이행본입니다. Normal 모델은 미리 선택된 주소를 보며 같은 completion에서 후보를 생성합니다. 후보 생성 이후 외부 RNG라는 보장은 Swipe에만 해당합니다. 최신 QR 최종 의미 문안, Stage materialization 품질, 실제 provider 동작, 전체 설치 ST E2E, Android/Termux, 장기 RP batch, 다중 탭 settings 동시 저장은 별도 검증 대상입니다. 이 공개 일반판은 난독화 없이 런타임·기본 프롬프트를 제공합니다. 사용자 소유 Engine은 PM에서 평문 편집 가능합니다.
