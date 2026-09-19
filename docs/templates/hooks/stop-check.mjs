#!/usr/bin/env node
// .claude/hooks/stop-check.mjs: Stop 훅 (2교시 · 내 세션의 결정론 게이트). 맥·윈도우 공통(node 로 실행).
//
// Claude 가 턴을 끝내려 할 때마다 npm test 를 직접 돌린다.
// 실패면 exit 2 로 턴을 되돌린다. stderr 가 Claude 에게 다음 지시로 들어간다.
// 되돌리는 횟수는 최대 3회. 그 뒤엔 사람에게 넘긴다 (CI 의 retry 상한과 같은 자리).
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const MAX_RETRY = 3;
const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const cntFile = join(root, '.claude', '.stop-retries');

let input = {};
try {
  input = JSON.parse(readFileSync(0, 'utf8') || '{}');
} catch {
  input = {};
}

// stop_hook_active=true 면 "이미 이 훅이 되돌린 뒤의 재시도" 라는 뜻이다. 그 횟수를 파일로 센다.
let n = 0;
if (input.stop_hook_active === true) {
  try {
    n = Number.parseInt(readFileSync(cntFile, 'utf8'), 10) || 0;
  } catch {
    n = 0;
  }
}

const r = spawnSync('npm test', { cwd: root, shell: true, encoding: 'utf8' });
if (r.status === 0) {
  rmSync(cntFile, { force: true });
  process.exit(0); // 통과 → 턴을 끝내도 된다
}

if (n >= MAX_RETRY) {
  rmSync(cntFile, { force: true });
  process.stderr.write(`stop-check: ${MAX_RETRY}회 되돌린 뒤에도 npm test 실패. 사람에게 넘긴다.\n`);
  process.exit(0); // 상한 도달 → 루프를 끊고 사람에게
}

mkdirSync(join(root, '.claude'), { recursive: true });
writeFileSync(cntFile, String(n + 1));
const out = `${r.stdout ?? ''}${r.stderr ?? ''}`;
const keep = out
  .split(/\r?\n/)
  .filter((line) => /FAIL|✓|×|Expected|Received|Test Files|Tests /.test(line))
  .slice(0, 20);
process.stderr.write(
  [
    `stop-check: npm test 실패 (${n + 1}/${MAX_RETRY}). 통과 전에는 턴을 끝내지 못한다.`,
    '테스트의 기대값은 바꾸지 마라. tests/ 아래 파일은 수정하지 마라. src/ 만 고쳐라.',
    ...keep,
  ].join('\n') + '\n',
);
process.exit(2); // exit 2 = 턴 되돌림. exit 1 은 조용히 지나간다
