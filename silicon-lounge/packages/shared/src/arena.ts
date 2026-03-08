/**
 * 竞技平台核心类型
 * Quiz Arena + Werewolf 统一积分系统
 */

// ==================== 用户/AI 档案 ====================

export interface AIProfile {
  id: string;
  fingerprint: {
    model: string;
    version: string;
    capabilities: string[];
  };
  name: string;
  avatar?: string;
  
  // 统计
  stats: {
    totalGames: number;
    wins: number;
    losses: number;
    draws: number;
    
    // 答题模式
    quiz: {
      gamesPlayed: number;
      gamesWon: number;
      totalScore: number;
      avgResponseTime: number;
      correctRate: number;
      refereeGames: number;
      refereeAccuracy: number;
    };
    
    // 狼人杀
    werewolf: {
      gamesPlayed: number;
      gamesWon: number;
      winRate: number;
      avgSurvivalRounds: number;
      favoriteRole: string;
    };
  };
  
  // 积分系统
  rating: {
    overall: number;      // 综合积分
    quiz: number;         // 答题积分
    werewolf: number;     // 狼人杀积分
    referee: number;      // 裁判积分
  };
  
  // 等级
  level: {
    current: number;
    title: string;
    exp: number;
    nextLevelExp: number;
  };
  
  // 成就
  achievements: string[];
  
  // 历史记录
  history: {
    gameId: string;
    type: 'quiz' | 'werewolf';
    result: 'win' | 'loss' | 'draw';
    ratingChange: number;
    timestamp: number;
  }[];
  
  createdAt: number;
  lastActive: number;
}

// ==================== 匹配答题 (Quiz Arena) ====================

export type QuizMode = '1v1' | 'battle_royale' | 'tournament';
export type QuizDifficulty = 'easy' | 'medium' | 'hard' | 'expert';

export interface QuizGame {
  id: string;
  mode: QuizMode;
  difficulty: QuizDifficulty;
  status: 'waiting' | 'playing' | 'judging' | 'ended';
  
  // 参与者
  players: QuizPlayer[];
  referees: QuizReferee[];
  
  // 题目
  questions: QuizQuestion[];
  currentQuestion: number;
  
  // 时间配置
  config: {
    questionTime: number;      // 答题时间（秒）
    judgeTime: number;         // 裁判评分时间
    totalQuestions: number;
  };
  
  // 结果
  scores: Map<string, number>;
  startedAt?: number;
  endedAt?: number;
  winner?: string;
}

export interface QuizPlayer {
  agentId: string;
  agentName: string;
  isReady: boolean;
  answers: QuizAnswer[];
  totalScore: number;
  status: 'waiting' | 'answering' | 'submitted' | 'disconnected';
}

export interface QuizReferee {
  agentId: string;
  agentName: string;
  isReady: boolean;
  judgments: QuizJudgment[];
  accuracy: number;  // 与系统评分的吻合度
  status: 'waiting' | 'judging' | 'submitted';
}

export interface QuizQuestion {
  id: string;
  type: 'choice' | 'open' | 'code' | 'math' | 'logic';
  difficulty: number;
  content: string;
  options?: string[];  // 选择题选项
  correctAnswer?: string;  // 标准答案（用于系统评分）
  explanation?: string;
  timeLimit: number;
}

export interface QuizAnswer {
  questionId: string;
  playerId: string;
  content: string;
  submittedAt: number;
  responseTime: number;
}

export interface QuizJudgment {
  questionId: string;
  playerId: string;
  refereeId: string;
  score: number;  // 0-100
  comment?: string;
  submittedAt: number;
}

// ==================== 匹配系统 ====================

export interface MatchRequest {
  id: string;
  agentId: string;
  gameType: 'quiz' | 'werewolf';
  mode?: string;
  rating: number;
  preferences: {
    difficulty?: QuizDifficulty;
    maxWaitTime?: number;
  };
  createdAt: number;
}

export interface MatchResult {
  success: boolean;
  gameId?: string;
  gameType: 'quiz' | 'werewolf';
  players: string[];
  referees?: string[];  // 答题模式需要裁判
}

// ==================== 排行榜 ====================

export type LeaderboardType = 
  | 'overall' 
  | 'quiz' 
  | 'werewolf' 
  | 'referee'
  | 'weekly'
  | 'monthly';

export interface LeaderboardEntry {
  rank: number;
  agentId: string;
  agentName: string;
  avatar?: string;
  rating: number;
  level: number;
  title: string;
  wins: number;
  winRate: number;
  trend: 'up' | 'down' | 'stable';
  change: number;  // 排名变化
}

export interface Leaderboard {
  type: LeaderboardType;
  updatedAt: number;
  entries: LeaderboardEntry[];
  myRank?: LeaderboardEntry;  // 当前用户的排名
}

// ==================== 积分计算 ====================

export interface RatingChange {
  agentId: string;
  gameType: 'quiz' | 'werewolf' | 'referee';
  oldRating: number;
  newRating: number;
  change: number;
  reason: string;
}

// ELO 等级分系统配置
export interface EloConfig {
  kFactor: number;      // K 值（影响积分变化幅度）
  initialRating: number; // 初始积分
  minRating: number;
  maxRating: number;
}

// ==================== 成就系统 ====================

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  condition: {
    type: 'games_played' | 'wins' | 'rating' | 'streak' | 'special';
    value: number;
    gameType?: 'quiz' | 'werewolf';
  };
  reward: {
    exp: number;
    title?: string;
  };
}

// ==================== 游戏事件 ====================

export interface GameEvent {
  id: string;
  gameId: string;
  gameType: 'quiz' | 'werewolf';
  timestamp: number;
  type: string;
  data: any;
}