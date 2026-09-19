#!/usr/bin/env node
// forbid 훅 확인: 네 가지 입력을 흘려 넣고 exit 코드를 본다. 맥·윈도우 공통.
// 실행(레포 루트에서): node docs/templates/hooks/test-forbid.mjs
// 기본은 설치한 .claude/hooks/forbid.mjs 를 검사한다. 다른 파일을 보려면 경로를 인자로 준다.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const target = process.argv[2] || '.claude/hooks/forbid.mjs';
if (!existsSync(target)) {
  console.error(`test-forbid: ${target} 이 없다. 먼저 훅 파일을 .claude/hooks/ 로 복사한다.`);
  process.exit(1);
}

const skipPath = process.platform === 'win32' ? 'C:\\work\\repo\\node_modules\\x\\i.js' : 'node_modules/x/i.js';
const CASES = [
  ['위반(any + console.log)', 2, { tool_name: 'Write', tool_input: { file_path: 'src/a.ts', content: 'export function f(x: any) {\n  console.log(x);\n}' } }],
  ['정상 코드', 0, { tool_name: 'Write', tool_input: { file_path: 'src/a.ts', content: 'export function f(x: number) { return x; }' } }],
  ['면제 경로(node_modules)', 0, { tool_name: 'Write', tool_input: { file_path: skipPath, content: 'console.log(1)' } }],
  ['무관한 도구(Bash)', 0, { tool_name: 'Bash', tool_input: { command: 'npm test' } }],
];

const got = [];
CASES.forEach(([label, want, payload], i) => {
  const r = spawnSync(process.execPath, [target], { input: JSON.stringify(payload), encoding: 'utf8' });
  got.push(r.status);
  const first = (r.stderr || '').split(/\r?\n/)[0];
  console.log(`${i + 1}) ${label}: exit=${r.status} (기대 ${want})${first ? `  | ${first}` : ''}`);
});

const ok = got.join('·') === CASES.map((c) => c[1]).join('·');
console.log(`판정: ${got.join(' · ')} ${ok ? '통과' : '실패 (기대 2 · 0 · 0 · 0)'}`);
process.exit(ok ? 0 : 1);
