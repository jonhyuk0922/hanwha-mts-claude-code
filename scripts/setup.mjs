#!/usr/bin/env node
// scripts/setup.mjs: 참가자 셋업. 의존성 설치 후 완료 코드를 출력한다. 맥·윈도우 공통(node 로 실행).
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const cmd = existsSync(join(root, 'package-lock.json')) ? 'npm ci' : 'npm install';

const r = spawnSync(cmd, { cwd: root, stdio: 'inherit', shell: true });
if (r.status !== 0) {
  console.error(`setup: ${cmd} 실패 (exit ${r.status ?? 1}). 위 출력을 확인한다.`);
  process.exit(r.status ?? 1);
}
console.log('READY: hanwha-mts-claude-code');
