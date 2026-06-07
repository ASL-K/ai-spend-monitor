// tests/utils/format.test.ts
import { describe, it, expect } from 'vitest';
import {
  formatBytes,
  formatNumber,
  formatCNY,
  formatPercent,
  truncate,
  computeWidth,
  formatDuration,
  formatTimestamp,
  formatDate,
  currentMonth,
  monthStartTs,
  monthEndTs,
} from '../../src/utils/format.js';

describe('formatBytes', () => {
  it('formats bytes', () => {
    expect(formatBytes(500)).toBe('500 B');
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(1024 * 1024)).toBe('1.0 MB');
    expect(formatBytes(1024 * 1024 * 1024)).toBe('1.00 GB');
  });

  it('handles sub-kilobyte', () => {
    expect(formatBytes(100)).toBe('100 B');
    expect(formatBytes(1023)).toBe('1023 B');
  });

  it('handles decimal MB', () => {
    expect(formatBytes(1024 * 1024 * 1.5)).toBe('1.5 MB');
  });
});

describe('formatNumber', () => {
  it('adds thousands separator', () => {
    expect(formatNumber(1234)).toBe('1,234');
    expect(formatNumber(1234567)).toBe('1,234,567');
    expect(formatNumber(0)).toBe('0');
  });
});

describe('formatCNY', () => {
  it('formats RMB with 2 decimals', () => {
    expect(formatCNY(49)).toBe('¥49.00');
    expect(formatCNY(0)).toBe('¥0.00');
    expect(formatCNY(42.3)).toBe('¥42.30');
    expect(formatCNY(1234.567)).toBe('¥1234.57');
  });
});

describe('formatPercent', () => {
  it('formats as percentage', () => {
    expect(formatPercent(0.5)).toBe('50.0%');
    expect(formatPercent(0.866, 0)).toBe('87%');
    expect(formatPercent(0.123, 2)).toBe('12.30%');
  });
});

describe('truncate + computeWidth', () => {
  it('returns original if fits', () => {
    expect(truncate('hello', 10)).toBe('hello');
  });

  it('truncates ASCII with ellipsis', () => {
    expect(truncate('hello world', 5)).toBe('hell…');
  });

  it('treats Chinese as width 2', () => {
    // '你好世界' = 8 width
    expect(computeWidth('你好世界')).toBe(8);
    expect(computeWidth('hello')).toBe(5);
  });

  it('handles mixed Chinese + ASCII', () => {
    // 'hi 你好' = 2 + 1(space) + 4 = 7
    expect(computeWidth('hi 你好')).toBe(7);
  });
});

describe('formatDuration', () => {
  it('formats sub-second as ms', () => {
    expect(formatDuration(100)).toBe('100ms');
    expect(formatDuration(999)).toBe('999ms');
  });

  it('formats seconds', () => {
    expect(formatDuration(1000)).toBe('1.0s');
    expect(formatDuration(1500)).toBe('1.5s');
  });

  it('formats minutes', () => {
    expect(formatDuration(60_000)).toBe('1m 0s');
    expect(formatDuration(125_000)).toBe('2m 5s');
  });
});

describe('formatTimestamp / formatDate / currentMonth', () => {
  it('formats Unix ms to readable', () => {
    // 2026-06-07 12:34:56 (本地时区，测试时只检查格式)
    const ts = new Date(2026, 5, 7, 12, 34, 56).getTime();
    const s = formatTimestamp(ts);
    expect(s).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });

  it('formats Date to YYYY-MM-DD', () => {
    expect(formatDate(new Date(2026, 5, 7))).toBe('2026-06-07');
  });

  it('current month returns YYYY-MM', () => {
    const m = currentMonth(new Date(2026, 5, 7));
    expect(m).toBe('2026-06');
  });
});

describe('monthStartTs / monthEndTs', () => {
  it('returns first millisecond of month', () => {
    const ts = monthStartTs('2026-06');
    const d = new Date(ts);
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(5); // 0-indexed
    expect(d.getDate()).toBe(1);
    expect(d.getHours()).toBe(0);
  });

  it('returns last millisecond of month', () => {
    const ts = monthEndTs('2026-06');
    const d = new Date(ts);
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(5);
    expect(d.getDate()).toBe(30); // June has 30 days
    expect(d.getHours()).toBe(23);
  });

  it('handles February correctly', () => {
    const ts = monthEndTs('2026-02');
    const d = new Date(ts);
    expect(d.getDate()).toBe(28); // 2026 not leap
  });
});
