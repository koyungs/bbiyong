# Character Judgment Universal 0.5.2-rc.2-structure

**공개배포용 Protected 구조 검수 후보판이며 stable 버전이 아닙니다.** rc.1의 프롬프트·판단 기준·호출 순서를 유지하고 실행 소유권, 취소, 일회용 Final 전달과 정리 오류를 수정했습니다. WI 실제 연결은 미완료입니다.

현재 장면과 대상 카드에서 판단 재료를 찾아 원래 RP 생성에 실행별 Final 지시를 한 번 전달합니다. 본체 patch와 native bridge를 추가하지 않습니다.

## 유지되는 기능

- Stage 1B와 Priority 출력에서 TARGET CHARACTER 재출력을 제거했습니다. 실제 target ID·avatar·이름·원본 카드 검사는 코드가 유지합니다.
- UI의 stage 4는 `F1 → ACTION DIRECTIONS → A1…`을 받습니다. 선택된 긴 subject는 모델이 다시 쓰지 않으며 코드는 자신의 선택 원문을 보존합니다.
- 메인 탭의 **판단 지침**은 이 채팅에 저장합니다. 실행 시작 시 동결하여 Stage 1B, 행동 방향 단계와 Final에 보냅니다. Stage 1A나 Priority에 별도 직접 주입하지 않습니다. 다른 프리셋/확장 프롬프트를 자동 수집하지 않습니다.
- 카드와 판단 지침의 `{{char}}`, `{{user}}`만 공식 ST API로 치환합니다. 현재 group target 이름을 명시합니다. 다른 매크로는 실행하지 않고 원문을 보존합니다. 이름 API가 없거나 검증에 실패하면 판단 없이 원래 응답으로 진행합니다.
- 빈 이력/공백/참석 표기만 있는 이력은 호출 없이, Stage 1A가 `CURRENT SITUATION: NONE`을 반환한 경우는 1회 호출 후 판단을 건너뜁니다. 장면을 만들어내는 기능은 아닙니다.
- reference의 `미연결`은 활성 WI 0개라는 뜻이 아닙니다. 현재 후보판은 실제 WI snapshot을 받지 못하므로 항상 미연결입니다.
- 종료 상태는 `정상 종료 · 종료표식 확인` / `정상 종료 · 응답 끝 확인`으로 표시하며 raw enum은 진단에 유지합니다.

## 유지하는 범위

일반 Send, regenerate, swipe와 그룹의 현재 화자를 지원합니다. quiet, impersonate, Continue는 기존대로 CJ 판단을 생략합니다. nonempty 장면의 판단에는 3회 또는 4회의 내부 호출이 필요하며 원래 RP 생성 비용은 별도입니다. C# 완전성/중복 검사, subset/partial-overlap 구분, Barrier 제외, YES 전체 유지 및 Stage 4 우회, ALL NONE의 전체 scene fact와 action 코드 난수 선택은 유지합니다.

오류·timeout·화자/장면/카드 변경에는 판단을 버리고 원래 생성으로 계속합니다. 실행 중 판단 지침 또는 사용자 이름이 바뀌어도 이전 결과를 버립니다. Stop·일회용 Final 소유권·토큰 공간 예약 구조는 유지합니다.

## 설치와 배포 주의

[INSTALL.md](INSTALL.md)를 따라 **한 벌만** 설치하세요. SillyTavern의 Install Extension에 다음 주소를 입력합니다.

```text
https://github.com/koyungs/bbiyong.git
```

이 공개 Protected 빌드는 prompt 문자열을 실행 시 복원하며 Terser 5.43.1로 코드를 축약·난독화했습니다. 소스맵과 개발용 원본, 평문 prompt 파일은 포함하지 않습니다. 암호화/DRM/실행 중 요청 은닉을 보장하지 않습니다. Plain-Test와 Private-Source는 평문 prompt가 있으므로 공개 저장소에 올리지 마세요.

자동 테스트는 선언한 모델 응답과 API mock, 보관된 upstream 함수, Chromium 컴포넌트를 사용합니다. 실제 모델 캐해 효과, 실제 provider 연결, ST Plus/Termux 실기기 및 전체 ST E2E를 검증한 것은 아닙니다. [COMPATIBILITY.md](COMPATIBILITY.md)를 확인하세요.
