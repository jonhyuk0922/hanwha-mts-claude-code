#!/usr/bin/env node
// .claude/hooks/check.mjs: PostToolUse(matcher: Edit|Write) 훅. 맥·윈도우 공통(node 로 실행, 셸 문법 없음).
//
// 검사 실패 시 exit 2 로 끝낸다. exit 2 여야 stderr 가 Claude 에게 되돌아가 스스로 고친다.
// exit 1 은 조용히 지나가므로 쓰지 않는다.
//
// 검사 내용: npm run lint -- --max-warnings 0, 통과하면 npm run typecheck
// lint 단독 실행은 경고를 지나치지만(권고), 훅은 경고 하나도 허용하지 않는다(강제).
import { spawnSync } from 'node:child_process';

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const CHECKS = ['npm run lint -- --max-warnings 0', 'npm run typecheck'];

for (const cmd of CHECKS) {
  const r = spawnSync(cmd, { cwd: root, shell: true, encoding: 'utf8' });
  if (r.status !== 0) {
    const out = `${r.stdout ?? ''}${r.stderr ?? ''}`.trim();
    process.stderr.write(`check: ${cmd} 실패. 아래 출력을 보고 고친 뒤 다시 저장한다.\n${out}\n`);
    process.exit(2);
  }
}
console.log('check: lint + typecheck OK');
