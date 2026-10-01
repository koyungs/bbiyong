# 설치 및 rc.6 → rc.7 전환

Install Extension 주소: https://github.com/koyungs/bbiyong.git

배포 루트에 manifest.json, index.js, style.css 및 런타임 모듈을 둡니다. ST-Character-Judgment 같은 상위 폴더를 추가하지 않습니다. native patch/installer는 포함하지 않습니다. 현재 GitHub main은 난독화 없는 rc.7 일반판입니다.

일반판과 Protected를 동시에 설치하지 마세요. 같은 macro/interceptor 이름을 사용합니다. 기존 bbiyong을 업데이트하면 같은 확장 경로의 Protected 파일이 일반판으로 교체됩니다. 전체 Review Package와 개인 검증 자료는 설치 파일이 아닙니다.

1. 기존 채팅·사용자 설정·RP preset을 백업하고 확장 파일을 교체합니다.
2. 사용할 채팅과 Chat Completion 연결(n=1)을 엽니다. 기존 활성화 설정과 registry는 보존하며 새 채팅은 기본 비활성화입니다.
3. **7개 CJ entry 가져오기**를 실행합니다. 기존 stable IDs를 재사용하므로 기존 CJ entry를 이름만 보고 새로 복제하지 마세요. Engine 본문은 보존됩니다.
4. 기존 `CJ · Run` ID의 entry가 **CJ · Engine** 역할입니다. 구형 slot/macro-only 본문이면 직접 Engine을 붙여 넣거나 **Engine 기본값으로 교체 (현재 본문 덮어쓰기)**를 실행합니다. 이 버튼은 현재 Engine 본문을 바꾸므로 보관할 문안이 있으면 먼저 별도로 저장하세요. 이행 기본값은 최종 QR Engine이 아닙니다.
5. rc.7은 Engine이나 prompt 문안을 변경하지 않습니다. rc.6에서 사용하던 사용자 Engine을 그대로 사용합니다. 더 이전 Engine으로 전환하는 경우에는 Normal/Regenerate의 `cj_runtime.firstSelection.subjectSlot`과 `actionSlot`을 읽고 `selectedSubjectId = subjectSlot`, `selectedActionId = subjectSlot + "-" + actionSlot`으로 반환하는 rc.6 호환 계약이 필요합니다.
6. **검사**를 실행해 Engine을 포함한 7개 entry의 순서·role·Relative 위치·trigger를 확인합니다. 표시 이름 변경은 가능합니다. Engine 외의 infrastructure 본문은 runtime slot입니다.
7. 새 Normal을 성공시킨 후 Swipe를 사용합니다. rc.6 Snapshot이나 Engine 수정 이전 Snapshot은 재사용하지 않습니다. C/W/M/L 재인덱싱은 버전 전환만으로 필요하지 않습니다. 그룹에서는 생성 완료 뒤에도 같은 native avatar의 카드와 Snapshot을 확인합니다.

M/L 유지보수는 선택한 연결로 독립 모델 요청 1회, W AUTO도 task별 독립 요청 1회입니다. C와 W MANUAL은 0 calls입니다. Stop/취소/채팅 변경은 늦은 결과 commit을 막습니다. 일부 과거 raw API는 이미 전송된 HTTP 요청 자체의 취소를 지원하지 않을 수 있습니다. 자동 retry는 추가하지 않았습니다.

성공 완료 후에는 cj_final만 저장됩니다. native streaming 중에는 원시 envelope/internal이 잠시 표시될 수 있습니다. 완전한 streaming 표시 제어와 실제 provider/최종 Engine 의미 검증은 별도입니다.
