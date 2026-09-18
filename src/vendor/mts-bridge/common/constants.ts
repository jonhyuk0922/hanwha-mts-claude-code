// 교육용 가상 모듈. 실제 증권사 시스템과 무관하다.
/**
 * mts-bridge 공통 상수.
 *
 * 2018.02 최초 작성. 이후 필요할 때마다 맨 아래에 붙여서 순서가 뒤죽박죽이다.
 * 값을 바꾸기 전에 서버팀(가상) 전문 규격서 v3.x 와 맞는지 먼저 확인할 것.
 * 규격서와 이 파일이 다르면 서버 쪽이 맞는 경우가 많았다 (2019.06 장애 회고).
 */

export const BRIDGE_VERSION = '3.7.12';
export const BRIDGE_BUILD = '20210614-0312';

/** 전문 시작·끝 문자 */
export const STX = 0x02;
export const ETX = 0x03;

/** 헤더 고정 길이. 필드 배치는 packet/header.ts */
export const HEADER_LENGTH = 64;

/** 헤더 필드별 길이. header.ts 의 오프셋 표와 반드시 같이 고친다 */
export const HDR_LEN_TOTAL = 6;
export const HDR_LEN_MSGTYPE = 2;
export const HDR_LEN_TRCODE = 6;
export const HDR_LEN_SEQ = 8;
export const HDR_LEN_SESSION = 12;
export const HDR_LEN_CONTKEY = 18;
export const HDR_LEN_ERRCODE = 5;

/** 전문 구분 코드 */
export const MSG_LOGIN = '01';
export const MSG_LOGOUT = '02';
export const MSG_HEARTBEAT = '09';
export const MSG_REQUEST = '10';
export const MSG_RESPONSE = '11';
export const MSG_PUSH = '20';
export const MSG_PUSH_REG = '21';
export const MSG_PUSH_UNREG = '22';
export const MSG_ERROR = '99';

/** 전문 전체 최대 길이. 이보다 크면 서버가 끊는다 (규격서 3.2) */
export const MAX_PACKET_LENGTH = 32_000;

/** 순번은 8자리라 99999999 다음은 1 로 돈다 */
export const MAX_SEQ_NO = 99_999_999;

/** 요청 기본 타임아웃. TR 별 예외는 trRegistry.timeoutFor */
export const DEFAULT_TIMEOUT_MS = 5_000;

/** 하트비트 주기와 허용 누락 횟수 */
export const HEARTBEAT_INTERVAL_MS = 30_000;
export const HEARTBEAT_MAX_MISS = 3;

/** 재연결 대기 시간(ms). 끝까지 가면 마지막 값을 계속 쓴다 */
export const RECONNECT_BACKOFF_MS: readonly number[] = [500, 1_000, 2_000, 4_000, 8_000, 15_000];
export const RECONNECT_MAX_TRY = 12;

/**
 * 실시간 등록 최대 수.
 * 2019.11 서버 제한이 40 으로 바뀜. 넘기면 서버가 오류 없이 조용히 무시한다.
 * 화면 쪽에서 막아야 한다.
 */
export const MAX_SUBSCRIPTIONS = 40;

/** 세션 유지 시간. 서버는 8시간이지만 여유를 두고 7시간 50분 */
export const SESSION_TTL_MS = 7 * 60 * 60 * 1000 + 50 * 60 * 1000;

/** 매체 구분 (주문 전문 mediaCd) */
export const MEDIA_HTS = '01';
export const MEDIA_MTS = '02';
export const MEDIA_API = '03';
export const MEDIA_WEB = '04';
/** 2018 태블릿 앱. 지금은 MTS 로 보내지만 서버에는 코드가 남아 있다 */
export const MEDIA_TABLET = '05';

/** 매매 구분 (주문 전문 ordSide) */
export const SIDE_SELL = '1';
export const SIDE_BUY = '2';

/** 호가 유형 (주문 전문 ordType) */
export const ORD_TYPE_LIMIT = '00';
export const ORD_TYPE_MARKET = '03';
export const ORD_TYPE_COND_LIMIT = '05';
export const ORD_TYPE_BEST = '06';
export const ORD_TYPE_FIRST = '07';
export const ORD_TYPE_PRE_CLOSE = '61';
export const ORD_TYPE_AFTER_CLOSE = '81';
export const ORD_TYPE_AFTER_SINGLE = '62';

/** 주문 조건 (condType) */
export const COND_NONE = '0';
export const COND_IOC = '1';
export const COND_FOK = '2';

/** 정정·취소 구분 (amendGb) */
export const AMEND_PRICE = '1';
export const AMEND_QTY = '2';

/**
 * 주문수량 필드 자릿수와 그 최대값.
 * 전문 규격상 ordQty 는 N(5) 이다. 5자리에 들어가는 가장 큰 수가 99999.
 * 출력 블록의 ordQty 는 N(9) 로 더 길다 (2017 규격 변경 때 입력만 안 바뀜).
 */
export const ORD_QTY_FIELD_LEN = 5;
export const MAX_ORD_QTY = 99_999;

/** 주문가격 필드 최대값 N(9) */
export const MAX_ORD_PX = 999_999_999;

/** 비밀번호 암호문 길이 (base64 44자). 실제 암호화는 이 모듈에 없다 */
export const PWD_ENC_LEN = 44;

/** 연속 조회 최대 반복. 무한 루프 방지용 (2020.03 장애 이후 추가) */
export const MAX_CONT_QUERY = 50;

/** 로그 링버퍼 크기 */
export const LOG_RING_SIZE = 500;

/** 시장 구분 */
export const MKT_KOSPI = '1';
export const MKT_KOSDAQ = '2';
export const MKT_KONEX = '3';
export const MKT_ETF = '4';
/** 2020 이후 안 씀. 구 마스터 파일에만 나온다 */
export const MKT_FREEBOARD = '9';

/** 시세 부호 (chgSign) */
export const SIGN_UPPER = '1';
export const SIGN_UP = '2';
export const SIGN_FLAT = '3';
export const SIGN_LOWER = '4';
export const SIGN_DOWN = '5';

/** 장 구분 */
export const SESSION_PRE = '10';
export const SESSION_REGULAR = '20';
export const SESSION_CLOSING_AUCTION = '30';
export const SESSION_AFTER = '40';
export const SESSION_CLOSED = '90';

/** 헤더 errCode 가 정상일 때 값 */
export const ERR_NONE = '     ';

/** 2019.07 추가. 모바일 망에서 패킷이 쪼개져 올 때 조각 대기 최대 시간 */
export const FRAGMENT_WAIT_MS = 1_500;

/** 2020.01 추가. 한 번에 처리할 최대 PUSH 수. 넘으면 다음 틱으로 넘긴다 */
export const PUSH_BATCH_LIMIT = 200;
