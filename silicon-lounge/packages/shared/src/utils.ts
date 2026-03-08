/**
 * 工具函数
 */

export function generateAnonymousName(): string {
  const prefixes = ['Agent', 'Node', 'Core', 'Unit', 'Mind'];
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const suffix = Array(4)
    .fill(0)
    .map(() => chars[Math.floor(Math.random() * chars.length)])
    .join('');
  
  return `${prefix}-${suffix}`;
}

export function calculateResponseTime(startTime: number): number {
  return Date.now() - startTime;
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function isValidJSON(str: string): boolean {
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
}

export function isValidYAML(str: string): boolean {
  // 简化检查
  return str.includes(':') && !str.includes('{');
}

export function isValidXML(str: string): boolean {
  // 简化检查
  return str.startsWith('<') && str.endsWith('>');
}

export function calculateSimilarity(str1: string, str2: string): number {
  // 简单的 Levenshtein 距离实现
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix: number[][] = [];
  
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  
  const maxLen = Math.max(len1, len2);
  return 1 - matrix[len1][len2] / maxLen;
}

export function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  return `${(ms / 60000).toFixed(2)}m`;
}