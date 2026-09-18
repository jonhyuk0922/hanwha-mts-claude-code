<!-- 교육용 가상 모듈. 실제 증권사 시스템과 무관하다. -->
# mts-bridge (가상 사내 시세 통신 브리지)

교육용으로 지어낸 가상 모듈이다. 실제 증권사(한화투자증권 포함)의 코드, TR 번호, API 와 무관하며 이름과 코드 체계(`QX`, `OR`, `AC`, `MS` 접두어 등)는 모두 가상이다.

**신규 화면 코드에서 직접 쓰지 않는다. 레거시 유지보수 대상.**

- 앱(`src/screens`, `src/hooks`, `src/lib`, `src/components`)은 이 폴더를 import 하지 않는다. 빌드 번들에도 들어가지 않는다.
- 새 화면이 시세·주문을 다룰 때는 이 모듈로 서버 연동을 시도하지 않는다. 앱의 기존 흐름(`src/hooks/useQuoteFeed.ts`, `src/lib/`)을 쓴다.
- 실제 네트워크 연결은 없다. 전송 계층(`BridgeTransport`)은 밖에서 넣게 되어 있고, 들어 있는 것은 아무 데도 보내지 않는 `NullTransport` 뿐이다.
- `tr/*.generated.ts`, `common/errorCodes.generated.ts` 는 생성 파일이라 손으로 고치지 않는다.
- ESLint 대상에서 빠져 있다(`eslint.config.js` 의 `ignores`). 타입 검사(`npm run typecheck`)는 받는다.

## 구성

```
common/    상수 · 바이트 처리 · 오류 코드 · 로그 링버퍼
packet/    고정길이 전문 헤더 · 필드 인코더/디코더 · 타입
tr/        TR 정의(생성 파일 4개) · 레지스트리
quote/     QuoteBridge (콜백 방식 실시간·조회, 재연결, 하트비트)
order/     주문 전문 조립 · 주문 사전 점검
session/   세션 · 순번 · 하트비트 타이머
```
