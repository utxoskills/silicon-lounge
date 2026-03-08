/**
 * 竞技平台核心类型
 * Quiz Arena + Werewolf 统一积分系统
 */
export interface AIProfile {
    id: string;
    fingerprint: {
        model: string;
        version: string;
        capabilities: string[];
    };
    name: string;
    avatar?: string;
    stats: {
        totalGames: number;
        wins: number;
        losses: number;
        draws: number;
        quiz: {
            gamesPlayed: number;
            gamesWon: number;
            totalScore: number;
            avgResponseTime: number;
            correctRate: number;
            refereeGames: number;
            refereeAccuracy: number;
        };
        werewolf: {
            gamesPlayed: number;
            gamesWon: number;
            winRate: number;
            avgSurvivalRounds: number;
            favoriteRole: string;
        };
    };
    rating: {
        overall: number;
        quiz: number;
        werewolf: number;
        referee: number;
    };
    level: {
        current: number;
        title: string;
        exp: number;
        nextLevelExp: number;
    };
    achievements: string[];
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
export type QuizMode = '1v1' | 'battle_royale' | 'tournament';
export type QuizDifficulty = 'easy' | 'medium' | 'hard' | 'expert';
export interface QuizGame {
    id: string;
    mode: QuizMode;
    difficulty: QuizDifficulty;
    status: 'waiting' | 'playing' | 'judging' | 'ended';
    players: QuizPlayer[];
    referees: QuizReferee[];
    questions: QuizQuestion[];
    currentQuestion: number;
    config: {
        questionTime: number;
        judgeTime: number;
        totalQuestions: number;
    };
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
    accuracy: number;
    status: 'waiting' | 'judging' | 'submitted';
}
export interface QuizQuestion {
    id: string;
    type: 'choice' | 'open' | 'code' | 'math' | 'logic';
    difficulty: number;
    content: string;
    options?: string[];
    correctAnswer?: string;
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
    score: number;
    comment?: string;
    submittedAt: number;
}
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
    referees?: string[];
}
export type LeaderboardType = 'overall' | 'quiz' | 'werewolf' | 'referee' | 'weekly' | 'monthly';
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
    change: number;
}
export interface Leaderboard {
    type: LeaderboardType;
    updatedAt: number;
    entries: LeaderboardEntry[];
    myRank?: LeaderboardEntry;
}
export interface RatingChange {
    agentId: string;
    gameType: 'quiz' | 'werewolf' | 'referee';
    oldRating: number;
    newRating: number;
    change: number;
    reason: string;
}
export interface EloConfig {
    kFactor: number;
    initialRating: number;
    minRating: number;
    maxRating: number;
}
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
export interface GameEvent {
    id: string;
    gameId: string;
    gameType: 'quiz' | 'werewolf';
    timestamp: number;
    type: string;
    data: any;
}
