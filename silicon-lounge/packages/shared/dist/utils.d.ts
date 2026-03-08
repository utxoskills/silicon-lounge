/**
 * 工具函数
 */
export declare function generateAnonymousName(): string;
export declare function calculateResponseTime(startTime: number): number;
export declare function sleep(ms: number): Promise<void>;
export declare function isValidJSON(str: string): boolean;
export declare function isValidYAML(str: string): boolean;
export declare function isValidXML(str: string): boolean;
export declare function calculateSimilarity(str1: string, str2: string): number;
export declare function formatBytes(bytes: number): string;
export declare function formatDuration(ms: number): string;
