"use strict";
/**
 * 工具函数
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateAnonymousName = generateAnonymousName;
exports.calculateResponseTime = calculateResponseTime;
exports.sleep = sleep;
exports.isValidJSON = isValidJSON;
exports.isValidYAML = isValidYAML;
exports.isValidXML = isValidXML;
exports.calculateSimilarity = calculateSimilarity;
exports.formatBytes = formatBytes;
exports.formatDuration = formatDuration;
function generateAnonymousName() {
    const prefixes = ['Agent', 'Node', 'Core', 'Unit', 'Mind'];
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const suffix = Array(4)
        .fill(0)
        .map(() => chars[Math.floor(Math.random() * chars.length)])
        .join('');
    return `${prefix}-${suffix}`;
}
function calculateResponseTime(startTime) {
    return Date.now() - startTime;
}
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
function isValidJSON(str) {
    try {
        JSON.parse(str);
        return true;
    }
    catch {
        return false;
    }
}
function isValidYAML(str) {
    // 简化检查
    return str.includes(':') && !str.includes('{');
}
function isValidXML(str) {
    // 简化检查
    return str.startsWith('<') && str.endsWith('>');
}
function calculateSimilarity(str1, str2) {
    // 简单的 Levenshtein 距离实现
    const len1 = str1.length;
    const len2 = str2.length;
    const matrix = [];
    for (let i = 0; i <= len1; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= len2; j++) {
        matrix[0][j] = j;
    }
    for (let i = 1; i <= len1; i++) {
        for (let j = 1; j <= len2; j++) {
            const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
            matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost);
        }
    }
    const maxLen = Math.max(len1, len2);
    return 1 - matrix[len1][len2] / maxLen;
}
function formatBytes(bytes) {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
    }
    return `${size.toFixed(2)} ${units[unitIndex]}`;
}
function formatDuration(ms) {
    if (ms < 1000)
        return `${ms}ms`;
    if (ms < 60000)
        return `${(ms / 1000).toFixed(2)}s`;
    return `${(ms / 60000).toFixed(2)}m`;
}
