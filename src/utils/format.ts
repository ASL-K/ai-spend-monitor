// src/utils/format.ts
// 数字/字节/人民币/截断工具（跟 local-llm-doctor 风格统一）

/** 字节转人类可读（KB/MB/GB） */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

/** 数字加千分位 */
export function formatNumber(n: number): string {
  return n.toLocaleString('zh-CN');
}

/** 人民币格式化（保留 2 位小数） */
export function formatCNY(amount: number): string {
  return `¥${amount.toFixed(2)}`;
}

/** 百分比格式化 */
export function formatPercent(ratio: number, decimals = 1): string {
  return `${(ratio * 100).toFixed(decimals)}%`;
}

/** 截断字符串（中文按 2 宽度） */
export function truncate(s: string, maxWidth: number): string {
  const width = computeWidth(s);
  if (width <= maxWidth) return s;
  // 逐字截断到能放下 + '…'
  let result = '';
  let usedWidth = 0;
  for (const ch of s) {
    const w = isWideChar(ch) ? 2 : 1;
    if (usedWidth + w + 1 > maxWidth) {
      // +1 给 ellipsis
      result += '…';
      break;
    }
    result += ch;
    usedWidth += w;
  }
  return result;
}

/** 计算字符串显示宽度（中文 = 2，英文 = 1） */
export function computeWidth(s: string): number {
  let width = 0;
  for (const ch of s) {
    width += isWideChar(ch) ? 2 : 1;
  }
  return width;
}

function isWideChar(ch: string): boolean {
  const code = ch.codePointAt(0) ?? 0;
  // CJK Unified Ideographs, Hiragana, Katakana, Fullwidth, Hangul, 表情等
  return (
    (code >= 0x1100 && code <= 0x115f) ||
    (code >= 0x2e80 && code <= 0x303e) ||
    (code >= 0x3041 && code <= 0x33ff) ||
    (code >= 0x3400 && code <= 0x4dbf) ||
    (code >= 0x4e00 && code <= 0x9fff) ||
    (code >= 0xa000 && code <= 0xa4cf) ||
    (code >= 0xac00 && code <= 0xd7a3) ||
    (code >= 0xf900 && code <= 0xfaff) ||
    (code >= 0xfe30 && code <= 0xfe4f) ||
    (code >= 0xff00 && code <= 0xff60) ||
    (code >= 0xffe0 && code <= 0xffe6) ||
    (code >= 0x20000 && code <= 0x2fffd) ||
    (code >= 0x30000 && code <= 0x3fffd) ||
    (code >= 0x1f300 && code <= 0x1f9ff) // emoji
  );
}

/** 持续时间（毫秒）转人类可读 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`;
  return `${Math.floor(ms / 3_600_000)}h ${Math.floor((ms % 3_600_000) / 60_000)}m`;
}

/** Unix timestamp 转 'YYYY-MM-DD HH:mm:ss' */
export function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** 'YYYY-MM-DD' for a Date */
export function formatDate(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 当前月份的 'YYYY-MM' */
export function currentMonth(now = new Date()): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
}

/** 月份第一天 00:00:00 的 Unix timestamp */
export function monthStartTs(month: string): number {
  const [y, m] = month.split('-').map(Number);
  return new Date(y!, m! - 1, 1).getTime();
}

/** 月份最后一天 23:59:59.999 的 Unix timestamp */
export function monthEndTs(month: string): number {
  const [y, m] = month.split('-').map(Number);
  return new Date(y!, m!, 0, 23, 59, 59, 999).getTime();
}
