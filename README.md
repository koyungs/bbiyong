# Character Judgment · 0.6.0-rc.8 — 일반판

사용자 소유 **CJ · Engine**을 기존 RP preset에 삽입하는 구조 후보입니다. Install Extension 주소: [https://github.com/koyungs/bbiyong.git](https://github.com/koyungs/bbiyong.git).

이 배포 파일은 난독화 없는 rc.8 일반판입니다. 런타임 코드와 기본 프롬프트를 평문으로 제공합니다. manifest.json과 index.js는 배포 루트에 있습니다. 저장소 설치 주소와 ZIP 설치 방법은 [설치 안내](INSTALL.md)를 확인하세요.

rc.8은 원문·카드·출력 binding이 그대로인 `MESSAGE_UPDATED` / `MESSAGE_EDITED` / `CHARACTER_EDITED` 알림만으로 유효한 Snapshot이 사라지는 결함을 수정합니다. 실제 입력·Final·카드 변경, 기존 Swipe 선택, Continue와 삭제의 무효화 검사는 유지합니다. 그룹 대상은 rc.7의 실제 native avatar binding을 따릅니다. Engine 문안·분류·parser·Normal/Swipe RNG 계약은 바꾸지 않습니다.

구조 debug에는 마지막 commit·무효화 이유·확인 phase·현재 채팅/metadata/state 참조와 binding 검사 boolean을 제한된 크기로 표시합니다. 최근 한 건의 `requestTrace`에는 nonce·mode·firstSelection·요구된/반환된 M ID와 개수·검증 단계·실패 이유만 표시합니다. `stage1AFailure`는 Stage 1A source binding 검증이 실패한 최근 한 건의 nonce·mode·실제 required M ID·반환 M ID·반환 schemaVersion 값/타입·messages 배열 여부·실패 이유를 남깁니다. schemaVersion 문자열은 최대 64자와 잘림 표시로 제한합니다. 다음 성공 뒤에도 실패 기록의 nonce를 유지하고 다음 같은 검증 실패로 교체합니다. reload/dispose 시 초기화하며 history는 만들지 않습니다. 구조 진단에 원문·후보 공간·응답 body·internal history를 넣지 않습니다.

**최근 요청 보기**를 누르면 CJ annotation과 slot 제거가 끝난 시점의 프런트엔드 messages 사본 한 개를 읽기 전용으로 확인할 수 있습니다. 사본은 role/name/content의 텍스트만 포함하고 이미지·임의 필드·키·헤더·연결 설정을 수집하지 않습니다. Engine/runtime/source annotation을 확인하는 준비 단계 사본이며 **실제 HTTP 전송 증명이 아닙니다**. 구조 진단과 요청 사본은 메모리에만 유지합니다. 새 CJ 요청이 준비되면 최근 요청 사본이 교체되고, 페이지를 다시 불러오면 초기화됩니다. 파일·chat metadata·internal history에는 추가 저장하지 않습니다.

현재 요청 nonce가 맞는 응답의 parser·firstSelection·Stage 1A M binding·sourceRefs 내용 검증이 실패하면 `cancel()`이 native Itemization의 공유 요청 객체에서 Engine/runtime/annotation을 지우지 않도록 수정했습니다. 응답 도착 전 취소와 `response-ownership` / `source-state` 실패는 기존 cleanup을 유지합니다. 원문·Card·World·Engine의 ownership/stale 검사 실패가 이 예외에 해당하며, 후반 WI fingerprint·world-role 변경도 포함합니다. 독립된 최근 요청 사본은 모든 cleanup 경로에서 바뀌지 않습니다. 실제 사용자 환경에서 Snapshot을 지운 최초 이벤트는 아직 확인되지 않았습니다. native `updateMessageBlock()` 자체는 메시지 변경 이벤트를 emit하지 않습니다. 이번 수정은 로컬 재현과 고정 native 함수 fixture로 확인하며 rc.8의 실제 provider/서버 생성은 별도 검증 대상입니다.

1. Chat Completion 연결에서 사용할 채팅을 엽니다.
2. **7개 CJ entry 가져오기**, **검사**를 실행합니다. 기존 Engine 본문은 그대로 보존됩니다.
3. Prompt Manager에서 **CJ · Engine**을 편집합니다. 기존 `CJ · Run`과 같은 stable identifier입니다. 구형 macro-only Run은 자동 덮어쓰지 않으므로, 본인 Engine을 넣거나 **Engine 기본값으로 교체 (현재 본문 덮어쓰기)**를 명시적으로 실행하세요.
4. **캐릭터 카드 인덱싱**은 0 model calls입니다. **현재 채팅 인덱싱**은 M/L maintenance 요청 1회입니다. **이 채팅에서 활성화**를 켜면 Normal/Regenerate는 native completion 1회로 실행합니다.
5. W 목록의 **캐릭터 정보 / 세계관 정보 / 자동**을 사용합니다. MANUAL은 0 calls, AUTO 분류는 미분류·stale 항목에 maintenance 요청 1회입니다. 자동 retry는 없습니다.

Engine이 없을 때 생성되는 기본값은 rc.4 의미 문안에 firstSelection 주소 호환만 추가한 **이행용 기본값**입니다. 사용자의 최신 QR Stage 1A → 1B-A → 1B-B → 2 → 3 → Selection → resolved_execution → Final 확정본을 대신 설계한 문안이 아닙니다. 최종 문안은 Engine 하나에 넣습니다. Stage별 entry는 만들지 않습니다.

| 구분 | 소유권 |
| --- | --- |
| CJ · Core | 확장: `<cj_runtime>` mode, nonce, Normal firstSelection, Swipe selection, snapshot 주소 |
| Sheet/Story Open·Close | 확장: native source 배치 경계 |
| CJ · Engine (기존 Run ID) | 사용자: Normal/Swipe/Final 판단 의미 전체 |
| CJ · Final Handoff | 확장: nonce, JSON schema, output envelope |

확장은 Engine의 자연어를 읽고 Stage 의미를 검증하지 않습니다. ID·활성·role·Relative 위치·trigger·순서만 검사하며 빈 본문/구형 slot은 안내합니다. 사용자가 수정한 본문은 요청·가져오기·업데이트에서 보존합니다. 명시적인 기본값 교체 버튼만 현재 본문을 바꿉니다. Engine 수정 후에는 이전 Snapshot으로 Swipe하지 않고 새 Normal이 필요합니다.

Native Prompt Manager가 만드는 요청 사본에서만 Engine 경계가 추가됩니다. 비활성·잘못된 배치·Continue·Impersonate·quiet 경로에서는 Engine을 macro 확장 전에 제외합니다. 저장된 Engine 본문이나 다른 preset entry를 고쳐서 처리하지 않습니다. 지원한 native 준비 API를 확인할 수 없으면 실행을 승인하지 않습니다.

**SOURCE ID = ADDRESS / NOT SUMMARY.** C는 avatar 기준 공유 카드 registry, M/L과 currentSnapshot은 채팅별, W는 `(world, uid)` 기준 공유 registry입니다. C/W 원문 수정은 stale 및 새 binding으로 처리하며 기존 immutable ID를 바뀐 원문에 재연결하지 않습니다. 기존 카드 공유/rename/migration 계약은 rc.4와 같습니다.

원문은 별도 block으로 복제하지 않습니다. 원래 Card/WI/Chat 위치에 C/W/M/L 태그를 붙입니다. 위치나 예산을 확정하지 못하면 CJ를 생략하고 native 생성을 계속합니다. Engine 본문은 source annotation 대상에서 제외합니다.

M/L maintenance는 CHARACTER_SUBJECT span, W AUTO는 CHARACTER/WORLD role까지만 판단합니다. 현재 relevance·condition·BARRIER·priority·action·Final 판단은 Normal Engine 소유입니다. Maintenance 요청은 기존 독립 transport로 고정 task + source + schema만 보냅니다. 사용자 RP preset을 판단 기준으로 사용하지 않습니다.

Normal/Regenerate는 요청 전에 확장 JS가 S1을 고정하고 secure RNG로 A1~A4 주소 하나를 미리 선택합니다. `cj_runtime.firstSelection`의 `subjectSlot`/`actionSlot`을 Engine이 읽어 네 후보를 모두 만든 뒤 지정 주소를 resolve해야 합니다. 응답의 선택 ID가 다르면 보정 없이 구조 오류로 처리하며 L/Snapshot을 저장하지 않습니다. Swipe는 frozen Snapshot에서 기존 YES 우선 pool 및 외부 RNG로 재선택하고, 확정된 subject/action과 sourceRefs만 runtime data로 보냅니다. 전체 pipeline 재실행 여부의 의미 지시는 Engine이 소유합니다. Continue는 native continuation을 유지하며 Snapshot을 폐기합니다.

응답은 기존 `cj_result` JSON + `cj_final` prose(또는 Swipe의 final only)를 사용합니다. 같은 nonce의 `cj_internal`을 앞에 하나 둘 수 있으며 내용은 해석·보관하지 않습니다. **완료된 응답이 검증에 성공한 뒤 final만 저장**합니다. 외부의 완결된 think/thinking/reasoning/reflection block과 단일 code fence는 형식 정규화 대상입니다. JSON 문자열·Final 내부 태그는 건드리지 않습니다. 없는 ID나 의미를 보정하지 않습니다.

일반판은 난독화하지 않습니다. 기본 프롬프트와 런타임 코드를 읽고 수정할 수 있으며, 사용자 소유 Engine은 Prompt Manager에서 편집합니다. 공개 배포 파일에는 native patch, installer, 테스트·개인 검증 자료, source map, API key를 포함하지 않습니다.

Normal은 **pre-call RNG**입니다. 모델은 후보를 생성하는 동안 미리 선택된 주소를 볼 수 있습니다. 후보 생성 완료 후 확장이 completion 중간에 개입하는 방식이 아닙니다. Swipe는 이미 저장된 후보를 대상으로 하는 **post-Snapshot RNG**입니다. 첫 Normal의 priority 정렬은 사용자 Engine의 책임이며 확장은 priority를 다시 판단하거나 정렬하지 않습니다.

[설치](INSTALL.md) · [검증 범위와 제한](COMPATIBILITY.md)
