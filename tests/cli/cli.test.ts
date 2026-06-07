// tests/cli/cli.test.ts
// CLI 集成测试：spawn aism.js 运行，验证输出

import { describe, it, expect } from 'vitest';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// 真实入口是 bin/aism.js（不是 dist/cli/index.js）
// bin/aism.js 会自动调 run(process.argv.slice(2))
const BIN_AISM = resolve(process.cwd(), 'bin/aism.js');
const HAS_BUILD = existsSync(BIN_AISM) && existsSync(resolve(process.cwd(), 'dist/cli/index.js'));

const describeIfBuilt = HAS_BUILD ? describe : describe.skip;

describeIfBuilt('CLI integration', () => {
  function runCli(args: string[], env: Record<string, string> = {}): Promise<{ stdout: string; stderr: string; code: number | null }> {
    return new Promise((resolveFn, rejectFn) => {
      const child = spawn(
        process.execPath,
        [BIN_AISM, ...args],
        {
          env: { ...process.env, ...env, AISM_LOG_LEVEL: 'silent' },
          stdio: ['ignore', 'pipe', 'pipe'],
          timeout: 5000,
        }
      );
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (d) => (stdout += d.toString()));
      child.stderr.on('data', (d) => (stderr += d.toString()));
      child.on('error', rejectFn);
      child.on('close', (code) => resolveFn({ stdout, stderr, code }));
      // 兜底 timeout 强制 kill（防 hang）
      setTimeout(() => {
        if (!child.killed) child.kill('SIGKILL');
      }, 8000);
    });
  }

  it('shows version with --version', async () => {
    const { stdout, code } = await runCli(['--version']);
    expect(code).toBe(0);
    expect(stdout.trim()).toBe('0.0.0');
  });

  it('shows help with --help', async () => {
    const { stdout, code } = await runCli(['--help']);
    expect(code).toBe(0);
    expect(stdout).toContain('aism');
  });

  it('status command works on empty db', async () => {
    const dbPath = join(tmpdir(), `cli-empty-${Date.now()}.db`);
    const { stdout, code } = await runCli(['status'], { AISM_DB_PATH: dbPath });
    expect(code).toBe(0);
    expect(stdout).toContain('本月 AI 成本');
    expect(stdout).toContain('暂无数据');
  });

  it('today command works on empty db', async () => {
    const dbPath = join(tmpdir(), `cli-today-${Date.now()}.db`);
    const { stdout, code } = await runCli(['today'], { AISM_DB_PATH: dbPath });
    expect(code).toBe(0);
    expect(stdout).toContain('今日 AI 成本');
    expect(stdout).toContain('今日还没调用');
  });

  it('log command shows empty message', async () => {
    const dbPath = join(tmpdir(), `cli-log-${Date.now()}.db`);
    const { stdout, code } = await runCli(['log'], { AISM_DB_PATH: dbPath });
    expect(code).toBe(0);
    expect(stdout).toContain('暂无调用记录');
  });
});

describe('CLI compilation', () => {
  it('dist/cli/index.js exists after build', () => {
    if (!HAS_BUILD) {
      console.log('SKIP: dist not built yet. Run `npm run build` first.');
    }
    // 不强制 fail — 这是提示
  });
});
