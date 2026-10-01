# 설치 및 rc.7 → rc.8 전환

Install Extension 주소: https://github.com/koyungs/bbiyong.git

일반판 ZIP의 루트에는 manifest.json, index.js, style.css 및 런타임 모듈과 설치 문서가 있습니다. 확장 폴더에 이 파일들을 풉니다. ZIP 내부에 별도의 상위 폴더는 없습니다. 저장소 설치에는 위 주소를 사용하되 해당 저장소에서 제공되는 버전을 먼저 확인하세요. 이 로컬 패키지의 작성만으로 GitHub 게시나 서버 설치가 완료되는 것은 아닙니다.

동일 확장의 여러 버전을 동시에 설치하면 같은 macro/interceptor 이름이 겹칩니다. 기존 bbiyong 확장 폴더의 파일을 일반판으로 교체합니다. 전체 Review Package와 개인 검증 자료는 설치 파일이 아닙니다.

1. 기존 채팅·사용자 설정·RP preset을 백업하고 확장 파일을 교체합니다.
2. 사용할 채팅과 Chat Completion 연결(n=1)을 엽니다. 기존 활성화 설정과 registry는 보존하며 새 채팅은 기본 비활성화입니다.
3. **7개 CJ entry 가져오기**를 실행합니다. 기존 stable IDs를 재사용하므로 기존 CJ entry를 이름만 보고 새로 복제하지 마세요. Engine 본문은 보존됩니다.
4. 기존 `CJ · Run` ID의 entry가 **CJ · Engine** 역할입니다. 구형 slot/macro-only 본문이면 직접 Engine을 붙여 넣거나 **Engine 기본값으로 교체 (현재 본문 덮어쓰기)**를 실행합니다. 이 버튼은 현재 Engine 본문을 바꾸므로 보관할 문안이 있으면 먼저 별도로 저장하세요. 이행 기본값은 최종 QR Engine이 아닙니다.
5. rc.8은 Engine이나 prompt 문안을 변경하지 않습니다. rc.6/rc.7에서 사용하던 사용자 Engine을 그대로 사용합니다. 더 이전 Engine으로 전환하는 경우에는 Normal/Regenerate의 `cj_runtime.firstSelection.subjectSlot`과 `actionSlot`을 읽고 `selectedSubjectId = subjectSlot`, `selectedActionId = subjectSlot + "-" + actionSlot`으로 반환하는 rc.6 호환 계약이 필요합니다.
6. **검사**를 실행해 Engine을 포함한 7개 entry의 순서·role·Relative 위치·trigger를 확인합니다. 표시 이름 변경은 가능합니다. Engine 외의 infrastructure 본문은 runtime slot입니다.
7. 새 Normal을 성공시킨 후 Swipe를 사용합니다. 이전 버전 Snapshot이나 Engine 수정 이전 Snapshot은 재사용하지 않습니다. C/W/M/L 재인덱싱은 버전 전환만으로 필요하지 않습니다. 그룹에서는 생성 완료 뒤에도 같은 native avatar의 카드와 Snapshot을 확인합니다.

Snapshot이 사라지면 **구조 debug**의 `lastCommit`, `lastInvalidation`, `lastCheckpoint`, `current`, `requestTrace`를 확인합니다. Stage 1A 실패는 `stage1AFailure`의 nonce·mode·실제 required M ID(`expectedRequiredMIds`)·반환 M ID(`returnedMIds`)·schemaVersion 값/타입·`messagesIsArray`·실패 이유를 확인합니다. schemaVersion 문자열은 최대 64자와 잘림 표시로 제한합니다. 최근 source binding 실패 한 건만 남기며 다음 성공 뒤에도 실패 nonce를 유지하고 다음 같은 실패로 교체합니다. **최근 요청 보기**에서는 annotation 완료 시점의 messages 텍스트 사본 한 개를 읽기 전용으로 확인합니다. 실제 HTTP 전송 증명은 아니며 키·헤더·연결 설정·이미지를 수집하지 않습니다. parser/firstSelection/M binding/sourceRefs 내용 검증 실패는 Itemization payload를 보존합니다. 응답 전 취소와 원문·Card·World·Engine의 ownership/stale 검사 실패(`response-ownership`, `source-state`)는 기존 cleanup을 유지하며 후반 WI fingerprint/world-role 변경도 포함합니다. 독립 요청 사본은 어떤 cleanup으로도 바뀌지 않습니다. 진단과 요청 사본은 메모리에만 유지하고 metadata나 파일에 추가 저장하지 않으며 reload/dispose 시 초기화됩니다. rc.8의 실제 서버/provider 생성 검증은 이 패키지에 포함되지 않습니다.

M/L 유지보수는 선택한 연결로 독립 모델 요청 1회, W AUTO도 task별 독립 요청 1회입니다. C와 W MANUAL은 0 calls입니다. Stop/취소/채팅 변경은 늦은 결과 commit을 막습니다. 일부 과거 raw API는 이미 전송된 HTTP 요청 자체의 취소를 지원하지 않을 수 있습니다. 자동 retry는 추가하지 않았습니다.

성공 완료 후에는 cj_final만 저장됩니다. native streaming 중에는 원시 envelope/internal이 잠시 표시될 수 있습니다. 완전한 streaming 표시 제어와 실제 provider/최종 Engine 의미 검증은 별도입니다.
