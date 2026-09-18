// 교육용 가상 모듈. 실제 증권사 시스템과 무관하다.
/**
 * 전문(패킷) 타입 모음.
 *
 * 필드 타입 (TRDEF 엑셀의 "형식" 칸과 같다)
 *   A : 문자. 좌측 정렬, 남는 자리는 공백
 *   N : 부호 없는 정수. 우측 정렬, 남는 자리는 '0'
 *   S : 부호 있는 정수. 첫 자리가 부호('+' / '-'), 나머지는 N 과 같다
 *   F : 소수. scale 자리만큼 곱해서 정수로 보낸다 (소수점 문자 없음)
 *   D : 일자 YYYYMMDD
 *   T : 시각 HHMMSSmmm (밀리초 3자리 포함, 2017 이전 TR 은 HHMMSS 6자리)
 */
export type FieldType = 'A' | 'N' | 'S' | 'F' | 'D' | 'T';

/** [필드명, 형식, 오프셋, 길이, 소수 자리] */
export type FieldTuple = readonly [name: string, type: FieldType, offset: number, length: number, scale?: number];

/** 입력 또는 출력 블록 하나 */
export interface TrBlock {
  /** 블록 전체 바이트 수. fields 합과 다르면 trRegistry 검증에서 걸린다 */
  len: number;
  fields: readonly FieldTuple[];
}

/** 반복(occurs) 블록. count 는 최대 건수, 실제 건수는 출력 블록의 rowCnt 류 필드에 온다 */
export interface TrRowsBlock extends TrBlock {
  occurs: number;
}

/** trgen 이 뽑아 주는 원본 형태 */
export interface RawTrSpec {
  code: string;
  name: string;
  /** 서버가 밀어주는 실시간 TR 이면 true. input 없음 */
  push?: boolean;
  /** 최초 등록 연월 (YYYY-MM) */
  since?: string;
  /** 사용 중지. 그래도 목록에서 지우면 구 화면이 죽어서 남겨 둔다 */
  deprecated?: boolean;
  input?: TrBlock;
  output: TrBlock;
  rows?: TrRowsBlock;
}

export type TrKind = 'QUOTE' | 'ORDER' | 'ACCOUNT' | 'MASTER' | 'UNKNOWN';

/** 레지스트리에 올라간 뒤의 형태 (kind 가 붙는다) */
export interface TrSpec extends RawTrSpec {
  kind: TrKind;
}

export type FieldValue = string | number;
export type TrRecord = Record<string, FieldValue>;

export interface DecodedBody {
  head: TrRecord;
  rows: TrRecord[];
}

/** 헤더 전문 구분 */
export type MsgType = '01' | '02' | '09' | '10' | '11' | '20' | '21' | '22' | '99';

/** 연속 조회 구분. ' ' 는 처음, 'Y' 는 다음 있음, 'N' 은 끝 */
export type ContFlag = ' ' | 'Y' | 'N';

export interface PacketHeader {
  stx: number;
  /** 헤더 + 바디 + ETX 전체 길이 */
  totalLen: number;
  msgType: MsgType;
  trCode: string;
  seqNo: number;
  sessionId: string;
  contFlag: ContFlag;
  contKey: string;
  /** 정상이면 공백 5자리. 오류면 'E' + 4자리 */
  errCode: string;
  /** 2020 이후 항상 false. 필드만 남아 있다 */
  compressed: boolean;
  encrypted: boolean;
  reserved: string;
}

export interface Packet {
  header: PacketHeader;
  body: Uint8Array;
}

/** 브리지가 붙는 전송 계층. 실제 소켓 구현은 이 레포에 없다 */
export interface BridgeTransport {
  open(): void;
  send(bytes: Uint8Array): void;
  close(): void;
  onOpen: (() => void) | null;
  onReceive: ((bytes: Uint8Array) => void) | null;
  onClose: ((reason: string) => void) | null;
}
