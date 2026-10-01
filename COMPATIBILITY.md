# 확인 범위와 제한

rc.8은 동결 rc.7 일반판을 기준으로 Snapshot 보존과 원인 관찰을 수정합니다. source와 난독화 없는 일반판을 검증하며 공개 파일은 루트 28개입니다. 새로운 `snapshot-trace.js`를 포함합니다. native patch나 installer는 포함하지 않습니다.

수정의 직접 근거는 재현 가능한 no-op 이벤트 결함입니다. rc.7은 입력·Final·카드가 바뀌지 않아도 `MESSAGE_UPDATED`, `MESSAGE_EDITED`, `CHARACTER_EDITED`를 받으면 Snapshot을 지웠습니다. 같은 입력의 알림에서는 binding을 검사해 Snapshot을 보존하고, 실제 변경·삭제·Continue·기존 Swipe 선택·대상 변경은 계속 무효화합니다. 오래된 비동기 reconciliation이 새 Snapshot을 지우지 않도록 현재 객체도 확인합니다. 성공 문구와 Snapshot 유무는 구조 debug에서 함께 확인할 수 있습니다.

실제 사용자 환경에서 발생한 최초 clear 이벤트는 아직 확인되지 않았습니다. 동결 native `updateMessageBlock()`은 변경 이벤트를 emit하지 않습니다. 일반 Normal 저장 경로는 `MESSAGE_RECEIVED` 다음에 렌더링과 `CHARACTER_MESSAGE_RENDERED`, Swipe metadata 복사를 수행합니다. 그룹 저장은 metadata를 요청 header에 복사하며 이 경로에서 현재 metadata 객체를 교체하지 않습니다. 메시지 편집 취소는 원문을 바꾸지 않고도 `MESSAGE_UPDATED`를 emit할 수 있습니다. 이 차이를 고정 native 함수와 로컬 fixture로 확인했으며 실제 관찰된 원인을 특정한 것으로 해석하지 않습니다.

Snapshot 구조 진단은 `lastCommit`, `lastInvalidation`, `lastCheckpoint`, 현재 chat/metadata/state 참조와 boolean 검사 결과로 제한됩니다. 최근 한 건의 `requestTrace`는 nonce·mode·firstSelection·요구된/반환된 M ID와 개수·검증 단계·실패 이유를 추가로 표시합니다. 응답 후보·원문·response body는 구조 trace에 넣지 않습니다. module의 WeakMap과 메모리에만 유지하고 reload 시 초기화합니다. Snapshot은 기존처럼 채팅별 하나만 유지합니다. metadata 객체가 바뀌거나 외부 경로에서 Snapshot이 사라진 경우에도 다음 구조 checkpoint에서 참조 변화를 관찰할 수 있습니다.

`stage1AFailure`는 `source-bindings` 단계의 실제 `validateBindings` 실패 때만 갱신하는 최근 실패 한 건입니다. `nonce`, `mode`, `expectedRequiredMIds`, `returnedMIds`, `returnedSchemaVersion`, `returnedSchemaVersionType`, `messagesIsArray`, `validationFailure`를 기록합니다. expected ID는 전체 index의 M 목록이 아니라 해당 요청의 실제 `run.bindingSources`에서 가져옵니다. schemaVersion은 scalar와 타입을 관찰하며 문자열은 최대 64자와 `schemaVersionTruncated` 표시로 제한합니다. 구조 값이 배열/객체라면 본문 대신 타입만 기록합니다. 이후 성공해도 해당 실패 nonce를 유지하고 다음 source binding 실패로 교체합니다. reload/dispose 시 초기화하며 과거 실패 history나 raw 응답 cache는 만들지 않습니다.

별도의 `requestMessages()`는 annotation 및 slot 제거가 완료된 최신 CJ 요청 한 건의 프런트엔드 messages 사본을 메모리에 유지합니다. role/name/content의 텍스트만 복사하며 임의 추가 필드·이미지·API 키·헤더·연결 설정·응답 body를 수집하지 않습니다. **최근 요청 보기** 버튼을 눌러 읽기 전용 텍스트로 표시합니다. 새 요청이 준비되면 교체하고 reload/dispose 시 폐기합니다. 사본에는 준비된 Engine/runtime/source annotation이 포함될 수 있으며 파일·chat metadata·과거 요청 history에는 저장하지 않습니다. 이 capture는 `CHAT_COMPLETION_PROMPT_READY`의 annotation 완료 시점입니다. 이후 settings 처리나 provider 변환을 포함한 실제 HTTP 요청을 증명하지 않습니다.

native Itemization의 `rawPrompt`는 준비된 배열을 참조하므로 rc.7의 응답 실패 후 cleanup이 공유 메시지 객체에서 Engine/runtime/annotation을 제거할 수 있습니다. 이미 직렬화된 요청 문자열에는 같은 변경이 적용되지 않습니다. 따라서 실패 후 Itemization에서 CJ가 보이지 않는다는 사실만으로 전송 누락을 확정할 수 없습니다. rc.8의 `cancel()`은 현재 요청 nonce가 맞는 응답의 parser/completion-envelope·firstSelection·Stage 1A M binding·sourceRefs 내용 검증 실패에서는 payload 객체를 정리하지 않습니다. 응답 전 취소 및 `response-ownership` / `source-state` 단계 실패는 기존 cleanup을 유지합니다. 원문·Card·World·Engine의 ownership/stale 검사 실패가 이 예외이며, 후반 WI fingerprint 또는 world-role 변경도 포함합니다. 독립된 최근 요청 사본은 모든 cleanup 경로에서 보존하므로 이후 검사할 수 있습니다. 실제 사용자 실패턴이 어느 경로였는지는 미확인입니다.

유지하는 계약은 C의 avatar 공유 registry, M/L과 currentSnapshot의 채팅별 수명, W의 `(world, uid)` 공유 registry, source stale 방어, nonce/chat/card/source/world/Prompt Manager/connection ownership입니다. Normal/Regenerate는 S1 고정과 action draw 1회 후 native completion 1회이며 CJ 추가 Normal 호출은 없습니다. Swipe는 frozen 후보의 YES 우선 pool과 기존 두 RNG draw를 사용합니다. 분류·parser·형식 허용 범위·default Engine·의미 prompt 문안은 rc.7과 같습니다. 사용자 Engine은 계속 Prompt Manager에서 평문으로 편집합니다.

PM Engine bridge는 고정 공식 release `06bde939fb1e9c4c8d8641d810f0a916b5bce127`의 준비 API를 기준으로 합니다. 그룹 대상 fixture는 고정 staging `bc81b9f7e33f39afe3f919a66faaf93079276a1c` 및 보관된 ST 1.19.0 staging `7c3994196` native 소스를 사용합니다. native 함수는 실제 소스에서 추출하여 제어된 VM에서 실행합니다. 모든 역사적 ST 버전이나 다른 확장의 동시 wire/준비 API 변조를 보장하지 않습니다.

최종 테스트 수·기존 회귀 테스트 보존·source/일반판 동등성·baseline 변경 patch와 SHA-256은 Review Package의 `reports/VERIFICATION_SUMMARY.json`, `reports/CHANGES.json`, `evidence/snapshot-release-verification.json`에 기록합니다. fixture 성공은 실제 모델 응답 성공을 뜻하지 않습니다. **rc.8의 실제 provider 호출, 서버 설치 상태에서의 생성, 전체 ST E2E는 실행하지 않았습니다.** 이전 rc.7의 제한된 라이브 결과를 rc.8 통과 근거로 대체하지 않습니다.

응답 필터는 완료된 `MESSAGE_RECEIVED`에서 적용합니다. 성공 완료 후에는 Final prose만 저장합니다. native streaming 중에는 검증 전 envelope/internal 텍스트가 잠시 표시될 수 있으며 malformed 응답은 native 원문으로 남을 수 있습니다. rc.8은 streaming 표시 제어를 바꾸지 않습니다. 최종 사용자 Engine의 Stage 의미와 RP 품질, 모든 provider·Android/Termux·장기 batch·다중 탭 동시 저장도 별도 검증 대상입니다. 전체 SAFE 또는 전 환경 호환성 판정은 하지 않습니다.
