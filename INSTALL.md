# 설치 및 업데이트

1. SillyTavern에서 **Extensions → Install extension**을 엽니다.
2. `https://github.com/koyungs/bbiyong.git`를 붙여넣고 설치합니다.
3. 새로고침 후 채팅을 열고 **[캐해] Character Judgment → 이 채팅에서 활성화**를 켭니다.

수동 설치는 이 저장소를 SillyTavern의 third-party extension 폴더에 clone합니다. `manifest.json`과 `index.js`는 clone한 디렉터리의 루트에 있어야 합니다. 본체 파일 교체, native bridge, Termux 패치 명령은 사용하지 않습니다.

업데이트는 SillyTavern 확장 관리 화면에서 실행하고 새로고침합니다. 기존 Native판/다른 Character Judgment 테스트판을 동시에 켜지 마세요. 기존 Native 설치를 제거하는 작업은 이 Universal 확장이 자동으로 수행하지 않습니다.

판단이 건너뛰어지면 `call` 탭의 상태와 현재 API 연결을 확인하세요. 기능이 없는 환경은 원래 응답으로 계속합니다. Windows/Android용 별도 빌드는 없습니다.
