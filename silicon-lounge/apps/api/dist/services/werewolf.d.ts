/**
 * AI 狼人杀游戏系统
 * Werewolf / Mafia game for AI agents
 */
import { Redis } from 'ioredis';
import { AIAgent } from '@silicon-lounge/shared';
type Role = 'werewolf' | 'villager' | 'seer' | 'witch' | 'hunter' | 'guard';
type GamePhase = 'waiting' | 'starting' | 'night' | 'night_action' | 'day' | 'discussion' | 'voting' | 'execution' | 'ended';
interface Player {
    agentId: string;
    agentName: string;
    role: Role;
    isAlive: boolean;
    isAI: boolean;
    memory: {
        knownRoles: Map<string, Role>;
        suspicions: Map<string, number>;
        trust: Map<string, number>;
        claims: Map<string, string>;
        votes: Map<string, string>;
        nightActions: any[];
    };
    abilities: {
        seerChecked: string[];
        witchHeal: boolean;
        witchPoison: boolean;
        hunterFired: boolean;
        guardProtected: string[];
    };
}
interface GameConfig {
    minPlayers: number;
    maxPlayers: number;
    roles: Record<Role, number>;
    discussionTime: number;
    nightTime: number;
    voteTime: number;
}
interface WerewolfGame {
    id: string;
    roomId: string;
    config: GameConfig;
    players: Map<string, Player>;
    phase: GamePhase;
    day: number;
    round: number;
    createdAt: number;
    startedAt?: number;
    endedAt?: number;
    winner?: 'werewolf' | 'villager';
    log: GameLogEntry[];
    currentActions: Map<string, any>;
    pendingEvents: GameEvent[];
}
interface GameLogEntry {
    id: string;
    day: number;
    phase: GamePhase;
    timestamp: number;
    type: 'system' | 'action' | 'death' | 'reveal' | 'vote' | 'message';
    content: string;
    data?: any;
    visibleTo?: string[];
}
interface GameEvent {
    type: 'kill' | 'save' | 'check' | 'vote' | 'speak';
    from: string;
    target?: string;
    data?: any;
}
export declare class WerewolfService {
    private redis;
    private activeGames;
    private gameTimers;
    constructor(redis: Redis);
    /**
     * 创建游戏房间
     */
    createGame(roomId: string, config?: GameConfig): Promise<WerewolfGame>;
    /**
     * AI 加入游戏
     */
    joinGame(gameId: string, agent: AIAgent): Promise<{
        success: boolean;
        error?: string;
        player?: Player;
    }>;
    /**
     * 开始游戏
     */
    startGame(gameId: string): Promise<void>;
    /**
     * 分配角色
     */
    private assignRoles;
    /**
     * 开始夜晚
     */
    startNight(gameId: string): Promise<void>;
    /**
     * 处理夜间行动
     */
    private processNightActions;
    /**
     * AI 狼人行动
     */
    private aiWerewolfAction;
    /**
     * AI 预言家行动
     */
    private aiSeerAction;
    /**
     * AI 女巫行动
     */
    private aiWitchAction;
    /**
     * AI 守卫行动
     */
    private aiGuardAction;
    /**
     * 结束夜晚
     */
    endNight(gameId: string): Promise<void>;
    /**
     * AI 猎人选择目标
     */
    private aiHunterTarget;
    /**
     * 开始白天
     */
    startDay(gameId: string): Promise<void>;
    /**
     * 开始讨论
     */
    startDiscussion(gameId: string): Promise<void>;
    /**
     * AI 讨论
     */
    private processAIDiscussion;
    /**
     * 生成 AI 发言
     */
    private generateAISpeech;
    /**
     * 狼人发言策略
     */
    private generateWerewolfSpeech;
    /**
     * 平民发言
     */
    private generateVillagerSpeech;
    /**
     * 分析发言
     */
    private analyzeSpeech;
    /**
     * 开始投票
     */
    startVoting(gameId: string): Promise<void>;
    /**
     * AI 投票
     */
    private processAIVoting;
    /**
     * 选择投票目标
     */
    private selectVoteTarget;
    /**
     * 统计投票
     */
    countVotes(gameId: string): Promise<void>;
    /**
     * 检查游戏结束
     */
    private checkGameEnd;
    private getAlivePlayers;
    private getRoleName;
    private addLog;
    private saveGame;
    getGame(gameId: string): Promise<WerewolfGame | null>;
    private setGameTimer;
    private clearGameTimer;
}
export {};
