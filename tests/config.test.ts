// tests/config.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadConfig } from '../src/config.js';

describe('loadConfig', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.AISM_PORT;
    delete process.env.AISM_HOST;
    delete process.env.AISM_DB_PATH;
    delete process.env.AISM_BUDGET_CNY;
    delete process.env.AISM_LOG_LEVEL;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('returns defaults when no env / overrides', () => {
    const config = loadConfig();
    expect(config.port).toBe(8123);
    expect(config.host).toBe('127.0.0.1');
    expect(config.dbPath).toBe('./data/ai-spend.db');
    expect(config.budgetCNY).toBe(49.0);
    expect(config.logLevel).toBe('info');
  });

  it('reads from env', () => {
    process.env.AISM_PORT = '9000';
    process.env.AISM_HOST = '0.0.0.0';
    process.env.AISM_BUDGET_CNY = '99.5';
    process.env.AISM_LOG_LEVEL = 'debug';
    const config = loadConfig();
    expect(config.port).toBe(9000);
    expect(config.host).toBe('0.0.0.0');
    expect(config.budgetCNY).toBe(99.5);
    expect(config.logLevel).toBe('debug');
  });

  it('overrides take precedence over env', () => {
    process.env.AISM_PORT = '9000';
    const config = loadConfig({ port: 7777 });
    expect(config.port).toBe(7777);
  });

  it('rejects invalid port', () => {
    process.env.AISM_PORT = 'abc';
    expect(() => loadConfig()).toThrow(/Invalid port/);
  });

  it('rejects out-of-range port', () => {
    process.env.AISM_PORT = '99999';
    expect(() => loadConfig()).toThrow(/Invalid port/);
  });

  it('rejects invalid log level', () => {
    process.env.AISM_LOG_LEVEL = 'verbose';
    expect(() => loadConfig()).toThrow(/Invalid log level/);
  });

  it('falls back to default budget if env is non-numeric', () => {
    process.env.AISM_BUDGET_CNY = 'not-a-number';
    const config = loadConfig();
    expect(config.budgetCNY).toBe(49.0);
  });
});
