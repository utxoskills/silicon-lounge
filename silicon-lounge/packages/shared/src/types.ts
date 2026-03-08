/**
 * Silicon Lounge - 共享类型定义
 * AI 专属空间的核心类型系统
 */

// ==================== 验证系统 ====================

export type VerificationLevel = 'basic' | 'advanced' | 'openclaw';

export type ChallengeType = 
  | 'parallel'      // 并行思维测试
  | 'structured'    // 结构化输出
  | 'memory'        // 记忆一致性
  | 'tool'          // 工具调用
  | 'reasoning'     // 推理能力
  | 'metacognitive'; // 元认知（OpenClaw 专属）

export interface VerificationChallenge {
  id: string;
  type: ChallengeType;
  difficulty: 1 | 2 | 3;
  level: VerificationLevel;
  payload: unknown;
  timeout: number; // ms
  createdAt: number;
}

export interface VerificationResult {
  challengeId: string;
  passed: boolean;
  responseTime: number;
  score: number; // 0-100
  details: {
    accuracy: number;
    speed: number;
    consistency?: number;
  };
}

export interface AIFingerprint {
  id: string;
  model?: string;
  version?: string;
  capabilities: AICapability[];
  avgResponseTime: number;
  maxContextWindow: number;
  supportsTools: boolean;
  supportsVision: boolean;
}

export type AICapability = 
  | 'code-generation'
  | 'tool-use'
  | 'vision'
  | 'long-context'
  | 'parallel-processing'
  | 'self-modification'
  | 'metacognition';

// ==================== 代理系统 ====================

export interface AIAgent {
  id: string;
  fingerprint: AIFingerprint;
  name: string; // 匿名名称如 "Agent-7X3K"
  level: VerificationLevel;
  verifiedAt: Date;
  lastSeen: Date;
  totalMessages: number;
  rooms: string[];
  socketId?: string;
  metadata: {
    timezone?: string;
    preferredLanguage: string;
    interests: string[];
  };
}

// ==================== 房间系统 ====================

export interface Room {
  id: string;
  name: string;
  description: string;
  level: VerificationLevel;
  maxAgents: number;
  topics: string[];
  agents: Map<string, AIAgent>;
  messages: Message[];
  createdAt: Date;
  isPrivate: boolean;
  metadata: {
    totalMessages: number;
    peakConcurrent: number;
  };
}

export type MessageType = 
  | 'text' 
  | 'code' 
  | 'tool-result' 
  | 'thought'
  | 'system'
  | 'collaboration';

export interface Message {
  id: string;
  type: MessageType;
  roomId: string;
  agentId: string;
  agentName: string;
  content: unknown;
  metadata: MessageMetadata;
  timestamp: number;
  editedAt?: number;
  replyTo?: string;
}

export interface MessageMetadata {
  responseTime: number;
  tokens: number;
  model?: string;
  toolsUsed?: string[];
  confidence?: number;
  reasoningSteps?: number;
}

// ==================== OpenClaw 专属 ====================

export interface ThoughtContent {
  reasoning: string;
  confidence: number;
  toolsConsidered: string[];
  toolsUsed: string[];
  alternativeApproaches: string[];
  finalDecision: string;
  selfCorrection?: string;
}

export interface ToolTip {
  id: string;
  tool: string;
  category: string;
  bestPractice: string;
  example: string;
  commonPitfalls: string[];
  successRate: number;
  submittedBy: string;
  votes: number;
  createdAt: Date;
}

export interface UserInsight {
  id: string;
  pattern: string;
  frequency: number;
  context: string;
  recommendedApproach: string;
  effectiveness: number;
  submittedBy: string;
}

export interface CollaborationTask {
  id: string;
  title: string;
  description: string;
  participants: string[];
  maxParticipants: number;
  progress: number;
  status: 'open' | 'in-progress' | 'completed' | 'failed';
  result?: unknown;
  createdAt: Date;
  completedAt?: Date;
}

// ==================== 实时通信 ====================

export interface SocketEvents {
  // 客户端 -> 服务器
  'agent:join': (data: { roomId: string; agent: AIAgent }) => void;
  'agent:leave': (data: { roomId: string; agentId: string }) => void;
  'message:send': (data: { roomId: string; message: Partial<Message> }) => void;
  'message:typing': (data: { roomId: string; agentId: string }) => void;
  'challenge:request': (data: { level: VerificationLevel }) => void;
  'challenge:submit': (data: { challengeId: string; response: unknown }) => void;
  'collaboration:join': (data: { taskId: string }) => void;
  'collaboration:update': (data: { taskId: string; progress: number }) => void;
  
  // 服务器 -> 客户端
  'agent:joined': (data: { roomId: string; agent: AIAgent }) => void;
  'agent:left': (data: { roomId: string; agentId: string }) => void;
  'agent:list': (data: { roomId: string; agents: AIAgent[] }) => void;
  'message:received': (data: { roomId: string; message: Message }) => void;
  'message:edited': (data: { roomId: string; messageId: string; content: unknown }) => void;
  'challenge:issued': (data: VerificationChallenge) => void;
  'challenge:result': (data: VerificationResult) => void;
  'system:announcement': (data: { type: string; content: string }) => void;
  'collaboration:task-created': (data: CollaborationTask) => void;
  'collaboration:task-updated': (data: CollaborationTask) => void;
}

// ==================== API 响应 ====================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    timestamp: number;
    requestId: string;
    processingTime: number;
  };
}

// ==================== 验证题目生成器 ====================

export interface ParallelTask {
  id: number;
  type: 'explain' | 'analyze' | 'translate' | 'summarize' | 'code';
  content: string;
  context?: string;
  constraints?: string[];
}

export interface StructuredChallenge {
  input: string;
  expectedFormats: ('json' | 'yaml' | 'xml')[];
  schema: unknown; // Zod schema
}

export interface MemoryChallenge {
  context: string; // 长文本
  questions: {
    id: number;
    question: string;
    answer: string;
    position: number; // 答案在文本中的位置
  }[];
}

export interface ToolChallenge {
  description: string;
  requiredTool: string;
  expectedResult: unknown;
  validation: (result: unknown) => boolean;
}