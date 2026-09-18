// 교육용 가상 모듈. 실제 증권사 시스템과 무관하다.
/**
 * 하트비트 타이머.
 * interval 마다 send 를 부르고, ack 가 HEARTBEAT_MAX_MISS 번 연속 안 오면 onTimeout.
 * 2018 최초. 2019.09 백그라운드 탭에서 타이머가 늦게 도는 문제로 경과 시간 비교를 추가했다.
 */
import { HEARTBEAT_INTERVAL_MS, HEARTBEAT_MAX_MISS } from '../common/constants';
import { bridgeLog } from '../common/errors';

export interface Heartbeat {
  start(): void;
  stop(): void;
  /** 서버에서 하트비트 응답이 왔을 때 */
  ack(): void;
  readonly missed: number;
  readonly running: boolean;
}

export function createHeartbeat(
  send: () => void,
  onTimeout: (missed: number) => void,
  intervalMs = HEARTBEAT_INTERVAL_MS,
  maxMiss = HEARTBEAT_MAX_MISS,
): Heartbeat {
  let timer: ReturnType<typeof setInterval> | null = null;
  let missed = 0;
  let lastAck = 0;
  let lastSent = 0;

  const tick = () => {
    const now = Date.now();
    // 백그라운드에서 돌아왔을 때 interval 이 몇 번 밀려 한꺼번에 오는 경우. 한 번으로 친다
    if (lastSent && now - lastSent < intervalMs / 2) return;
    if (lastSent && lastAck < lastSent) {
      missed += 1;
      bridgeLog('W', 'HB', `missed ${missed}/${maxMiss}`);
      if (missed >= maxMiss) {
        stop();
        onTimeout(missed);
        return;
      }
    }
    lastSent = now;
    send();
  };

  const start = () => {
    if (timer) return;
    missed = 0;
    lastAck = Date.now();
    lastSent = 0;
    timer = setInterval(tick, intervalMs);
    bridgeLog('D', 'HB', `start ${intervalMs}ms`);
  };

  const stop = () => {
    if (!timer) return;
    clearInterval(timer);
    timer = null;
    bridgeLog('D', 'HB', 'stop');
  };

  return {
    start,
    stop,
    ack() {
      lastAck = Date.now();
      missed = 0;
    },
    get missed() {
      return missed;
    },
    get running() {
      return timer !== null;
    },
  };
}
