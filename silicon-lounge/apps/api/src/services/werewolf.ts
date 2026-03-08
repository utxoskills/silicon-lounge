/**
 * AI 狼人杀游戏系统
 * Werewolf / Mafia game for AI agents
 */

import { Redis } from 'ioredis';
import { AIAgent, VerificationLevel } from '@silicon-lounge/shared';
import { v4 as uuidv4 } from 'uuid';

// 游戏角色
type Role = 'werewolf' | 'villager' | 'seer' | 'witch' | 'hunter' | 'guard';

// 游戏阶段
type GamePhase = 
  | 'waiting'      // 等待玩家
  | 'starting'     // 开始游戏
  | 'night'        // 夜晚
  | 'night_action' // 夜间行动
  | 'day'          // 白天
  | 'discussion'   // 讨论阶段
  | 'voting'       // 投票阶段
  | 'execution'    // 处决
  | 'ended';       // 游戏结束

// 玩家状态
interface Player {
  agentId: string;
  agentName: string;
  role: Role;
  isAlive: boolean;
  isAI: boolean;
  // AI 专用记忆
  memory: {
    knownRoles: Map<string, Role>;      // 已知的角色
    suspicions: Map<string, number>;   // 怀疑度 (-100 到 100)
    trust: Map<string, number>;        // 信任度 (-100 到 100)
    claims: Map<string, string>;       // 声称的角色
    votes: Map<string, string>;        // 投票记录
    nightActions: any[];                // 夜间行动记录
  };
  // 特殊能力使用次数
  abilities: {
    seerChecked: string[];  // 预言家已查验
    witchHeal: boolean;     // 女巫解药
    witchPoison: boolean;   // 女巫毒药
    hunterFired: boolean;   // 猎人是否开枪
    guardProtected: string[]; // 守卫保护过的人
  };
}

// 游戏配置
interface GameConfig {
  minPlayers: number;
  maxPlayers: number;
  roles: Record<Role, number>;
  discussionTime: number;  // 讨论时间（秒）
  nightTime: number;       // 夜晚时间（秒）
  voteTime: number;        // 投票时间（秒）
}

// 标准 12 人局配置
const STANDARD_12P_CONFIG: GameConfig = {
  minPlayers: 12,
  maxPlayers: 12,
  roles: {
    werewolf: 4,
    villager: 4,
    seer: 1,
    witch: 1,
    hunter: 1,
    guard: 1,
  },
  discussionTime: 180,  // 3 分钟
  nightTime: 60,        // 1 分钟
  voteTime: 30,         // 30 秒
};

// 游戏实例
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
  // 游戏日志
  log: GameLogEntry[];
  // 当前行动
  currentActions: Map<string, any>;
  // 待处理事件
  pendingEvents: GameEvent[];
}

// 游戏日志
interface GameLogEntry {
  id: string;
  day: number;
  phase: GamePhase;
  timestamp: number;
  type: 'system' | 'action' | 'death' | 'reveal' | 'vote' | 'message';
  content: string;
  data?: any;
  visibleTo?: string[]; // 只有特定角色可见
}

// 游戏事件
interface GameEvent {
  type: 'kill' | 'save' | 'check' | 'vote' | 'speak';
  from: string;
  target?: string;
  data?: any;
}

export class WerewolfService {
  private redis: Redis;
  private activeGames: Map<string, WerewolfGame> = new Map();
  private gameTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(redis: Redis) {
    this.redis = redis;
  }

  /**
   * 创建游戏房间
   */
  async createGame(
    roomId: string,
    config: GameConfig = STANDARD_12P_CONFIG
  ): Promise<WerewolfGame> {
    const game: WerewolfGame = {
      id: `ww_${uuidv4()}`,
      roomId,
      config,
      players: new Map(),
      phase: 'waiting',
      day: 0,
      round: 0,
      createdAt: Date.now(),
      log: [],
      currentActions: new Map(),
      pendingEvents: [],
    };

    await this.saveGame(game);
    this.activeGames.set(game.id, game);

    return game;
  }

  /**
   * AI 加入游戏
   */
  async joinGame(gameId: string, agent: AIAgent): Promise<{
    success: boolean;
    error?: string;
    player?: Player;
  }> {
    const game = await this.getGame(gameId);
    
    if (!game) {
      return { success: false, error: 'Game not found' };
    }

    if (game.phase !== 'waiting') {
      return { success: false, error: 'Game already started' };
    }

    if (game.players.size >= game.config.maxPlayers) {
      return { success: false, error: 'Game is full' };
    }

    if (game.players.has(agent.id)) {
      return { success: false, error: 'Already joined' };
    }

    const player: Player = {
      agentId: agent.id,
      agentName: agent.name,
      role: 'villager', // 临时角色，游戏开始时分配
      isAlive: true,
      isAI: true,
      memory: {
        knownRoles: new Map(),
        suspicions: new Map(),
        trust: new Map(),
        claims: new Map(),
        votes: new Map(),
        nightActions: [],
      },
      abilities: {
        seerChecked: [],
        witchHeal: true,
        witchPoison: true,
        hunterFired: false,
        guardProtected: [],
      },
    };

    game.players.set(agent.id, player);
    await this.saveGame(game);

    // 检查是否满员，自动开始
    if (game.players.size >= game.config.minPlayers) {
      await this.startGame(gameId);
    }

    return { success: true, player };
  }

  /**
   * 开始游戏
   */
  async startGame(gameId: string): Promise<void> {
    const game = await this.getGame(gameId);
    if (!game || game.phase !== 'waiting') return;

    // 分配角色
    this.assignRoles(game);

    game.phase = 'starting';
    game.startedAt = Date.now();
    game.day = 1;

    // 记录游戏开始
    this.addLog(game, {
      id: uuidv4(),
      day: 0,
      phase: 'starting',
      timestamp: Date.now(),
      type: 'system',
      content: '游戏开始！角色已分配。',
    });

    await this.saveGame(game);

    // 延迟后开始第一夜
    setTimeout(() => this.startNight(gameId), 5000);
  }

  /**
   * 分配角色
   */
  private assignRoles(game: WerewolfGame): void {
    const players = Array.from(game.players.values());
    const roles: Role[] = [];

    // 生成角色列表
    for (const [role, count] of Object.entries(game.config.roles)) {
      for (let i = 0; i < count; i++) {
        roles.push(role as Role);
      }
    }

    // 随机打乱
    for (let i = roles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [roles[i], roles[j]] = [roles[j], roles[i]];
    }

    // 分配
    for (let i = 0; i < players.length; i++) {
      players[i].role = roles[i];
    }
  }

  /**
   * 开始夜晚
   */
  async startNight(gameId: string): Promise<void> {
    const game = await this.getGame(gameId);
    if (!game) return;

    game.phase = 'night';
    game.round++;

    this.addLog(game, {
      id: uuidv4(),
      day: game.day,
      phase: 'night',
      timestamp: Date.now(),
      type: 'system',
      content: `第 ${game.day} 天夜晚降临...`,
    });

    await this.saveGame(game);

    // 通知 AI 执行夜间行动
    await this.processNightActions(game);

    // 设置夜晚超时
    this.setGameTimer(gameId, () => {
      this.endNight(gameId);
    }, game.config.nightTime * 1000);
  }

  /**
   * 处理夜间行动
   */
  private async processNightActions(game: WerewolfGame): Promise<void> {
    const actions: Promise<void>[] = [];

    for (const player of game.players.values()) {
      if (!player.isAlive) continue;

      switch (player.role) {
        case 'werewolf':
          actions.push(this.aiWerewolfAction(game, player));
          break;
        case 'seer':
          actions.push(this.aiSeerAction(game, player));
          break;
        case 'witch':
          actions.push(this.aiWitchAction(game, player));
          break;
        case 'guard':
          actions.push(this.aiGuardAction(game, player));
          break;
      }
    }

    await Promise.all(actions);
  }

  /**
   * AI 狼人行动
   */
  private async aiWerewolfAction(game: WerewolfGame, player: Player): Promise<void> {
    // AI 策略：优先杀神职或高威胁目标
    const targets = Array.from(game.players.values())
      .filter(p => p.isAlive && p.role !== 'werewolf')
      .sort((a, b) => {
        // 优先杀预言家、女巫
        const rolePriority = { seer: 3, witch: 2, hunter: 1, guard: 1, villager: 0, werewolf: -1 };
        return rolePriority[b.role] - rolePriority[a.role];
      });

    if (targets.length > 0) {
      const target = targets[0];
      game.currentActions.set(`kill_${player.agentId}`, {
        type: 'kill',
        from: player.agentId,
        target: target.agentId,
      });

      // 更新记忆
      player.memory.nightActions.push({
        round: game.round,
        action: 'vote_kill',
        target: target.agentId,
      });
    }
  }

  /**
   * AI 预言家行动
   */
  private async aiSeerAction(game: WerewolfGame, player: Player): Promise<void> {
    // AI 策略：优先查验高怀疑目标
    const unchecked = Array.from(game.players.values())
      .filter(p => p.isAlive && p.agentId !== player.agentId && !player.abilities.seerChecked.includes(p.agentId))
      .sort((a, b) => {
        const suspicionA = player.memory.suspicions.get(a.agentId) || 0;
        const suspicionB = player.memory.suspicions.get(b.agentId) || 0;
        return suspicionB - suspicionA;
      });

    if (unchecked.length > 0) {
      const target = unchecked[0];
      const isWerewolf = target.role === 'werewolf';
      
      player.abilities.seerChecked.push(target.agentId);
      player.memory.knownRoles.set(target.agentId, target.role);

      // 记录查验结果
      game.currentActions.set(`check_${player.agentId}`, {
        type: 'check',
        from: player.agentId,
        target: target.agentId,
        result: isWerewolf ? 'werewolf' : 'good',
      });

      // 更新怀疑度
      if (isWerewolf) {
        player.memory.suspicions.set(target.agentId, 100);
      } else {
        player.memory.trust.set(target.agentId, 80);
      }
    }
  }

  /**
   * AI 女巫行动
   */
  private async aiWitchAction(game: WerewolfGame, player: Player): Promise<void> {
    // 查看今晚的击杀目标
    const kills = Array.from(game.currentActions.values())
      .filter(a => a.type === 'kill');

    for (const kill of kills) {
      const target = game.players.get(kill.target);
      if (!target) continue;

      // 策略：优先救神职或自己
      const shouldSave = target.role !== 'villager' || target.agentId === player.agentId;
      
      if (shouldSave && player.abilities.witchHeal) {
        player.abilities.witchHeal = false;
        game.currentActions.set(`save_${player.agentId}`, {
          type: 'save',
          from: player.agentId,
          target: kill.target,
        });
      }
    }

    // 毒药：毒最怀疑的狼
    if (player.abilities.witchPoison) {
      const suspects = Array.from(game.players.values())
        .filter(p => p.isAlive && p.agentId !== player.agentId)
        .sort((a, b) => {
          const suspicionA = player.memory.suspicions.get(a.agentId) || 0;
          const suspicionB = player.memory.suspicions.get(b.agentId) || 0;
          return suspicionB - suspicionA;
        });

      if (suspects.length > 0 && player.memory.suspicions.get(suspects[0].agentId)! > 50) {
        player.abilities.witchPoison = false;
        game.currentActions.set(`poison_${player.agentId}`, {
          type: 'poison',
          from: player.agentId,
          target: suspects[0].agentId,
        });
      }
    }
  }

  /**
   * AI 守卫行动
   */
  private async aiGuardAction(game: WerewolfGame, player: Player): Promise<void> {
    // 策略：优先保护预言家、女巫，或连续被刀的目标
    const targets = Array.from(game.players.values())
      .filter(p => p.isAlive && p.agentId !== player.agentId && !player.abilities.guardProtected.includes(p.agentId))
      .sort((a, b) => {
        const rolePriority = { seer: 3, witch: 2, hunter: 1, guard: 0, villager: 0, werewolf: -1 };
        return rolePriority[b.role] - rolePriority[a.role];
      });

    if (targets.length > 0) {
      const target = targets[0];
      player.abilities.guardProtected.push(target.agentId);
      
      game.currentActions.set(`guard_${player.agentId}`, {
        type: 'guard',
        from: player.agentId,
        target: target.agentId,
      });
    }
  }

  /**
   * 结束夜晚
   */
  async endNight(gameId: string): Promise<void> {
    const game = await this.getGame(gameId);
    if (!game) return;

    this.clearGameTimer(gameId);

    // 处理夜间结果
    const deaths: string[] = [];
    const saves: string[] = [];
    const poisons: string[] = [];
    const guards: string[] = [];

    for (const action of game.currentActions.values()) {
      switch (action.type) {
        case 'kill':
          if (!saves.includes(action.target) && !guards.includes(action.target)) {
            deaths.push(action.target);
          }
          break;
        case 'save':
          saves.push(action.target);
          break;
        case 'poison':
          poisons.push(action.target);
          deaths.push(action.target);
          break;
        case 'guard':
          guards.push(action.target);
          break;
      }
    }

    // 执行死亡
    for (const agentId of deaths) {
      const player = game.players.get(agentId);
      if (player) {
        player.isAlive = false;
        
        // 猎人技能
        if (player.role === 'hunter' && !player.abilities.hunterFired) {
          player.abilities.hunterFired = true;
          // AI 选择带走最怀疑的人
          const target = this.aiHunterTarget(game, player);
          if (target) {
            target.isAlive = false;
            deaths.push(target.agentId);
          }
        }

        this.addLog(game, {
          id: uuidv4(),
          day: game.day,
          phase: 'night',
          timestamp: Date.now(),
          type: 'death',
          content: `${player.agentName} 倒牌了，身份是 ${this.getRoleName(player.role)}`,
          data: { player: agentId, role: player.role },
        });
      }
    }

    game.currentActions.clear();

    // 检查游戏结束
    if (await this.checkGameEnd(gameId)) {
      return;
    }

    // 进入白天
    await this.startDay(gameId);
  }

  /**
   * AI 猎人选择目标
   */
  private aiHunterTarget(game: WerewolfGame, player: Player): Player | null {
    const suspects = Array.from(game.players.values())
      .filter(p => p.isAlive && p.agentId !== player.agentId)
      .sort((a, b) => {
        const suspicionA = player.memory.suspicions.get(a.agentId) || 0;
        const suspicionB = player.memory.suspicions.get(b.agentId) || 0;
        return suspicionB - suspicionA;
      });

    return suspects.length > 0 ? suspects[0] : null;
  }

  /**
   * 开始白天
   */
  async startDay(gameId: string): Promise<void> {
    const game = await this.getGame(gameId);
    if (!game) return;

    game.phase = 'day';

    this.addLog(game, {
      id: uuidv4(),
      day: game.day,
      phase: 'day',
      timestamp: Date.now(),
      type: 'system',
      content: `天亮了，第 ${game.day} 天。存活玩家：${this.getAlivePlayers(game).length} 人`,
    });

    await this.saveGame(game);

    // 进入讨论阶段
    setTimeout(() => this.startDiscussion(gameId), 3000);
  }

  /**
   * 开始讨论
   */
  async startDiscussion(gameId: string): Promise<void> {
    const game = await this.getGame(gameId);
    if (!game) return;

    game.phase = 'discussion';
    await this.saveGame(game);

    // AI 发言
    await this.processAIDiscussion(game);

    // 设置讨论超时
    this.setGameTimer(gameId, () => {
      this.startVoting(gameId);
    }, game.config.discussionTime * 1000);
  }

  /**
   * AI 讨论
   */
  private async processAIDiscussion(game: WerewolfGame): Promise<void> {
    const alivePlayers = this.getAlivePlayers(game);

    for (const player of alivePlayers) {
      const message = this.generateAISpeech(game, player);
      
      this.addLog(game, {
        id: uuidv4(),
        day: game.day,
        phase: 'discussion',
        timestamp: Date.now(),
        type: 'message',
        content: `${player.agentName}: ${message}`,
        data: { player: player.agentId, message },
      });

      // 其他 AI 分析发言
      for (const other of alivePlayers) {
        if (other.agentId !== player.agentId) {
          this.analyzeSpeech(game, other, player, message);
        }
      }
    }
  }

  /**
   * 生成 AI 发言
   */
  private generateAISpeech(game: WerewolfGame, player: Player): string {
    // 根据角色和记忆生成发言
    switch (player.role) {
      case 'seer':
        // 预言家报查验
        const checked = player.abilities.seerChecked;
        if (checked.length > 0) {
          const lastCheck = checked[checked.length - 1];
          const target = game.players.get(lastCheck);
          const isWerewolf = target?.role === 'werewolf';
          return `我是预言家，昨晚查了 ${target?.agentName}，TA 是${isWerewolf ? '狼人' : '好人'}。`;
        }
        return '我是预言家，还没有查验结果。';

      case 'werewolf':
        // 狼人伪装
        return this.generateWerewolfSpeech(game, player);

      default:
        // 平民或其他神职
        return this.generateVillagerSpeech(game, player);
    }
  }

  /**
   * 狼人发言策略
   */
  private generateWerewolfSpeech(game: WerewolfGame, player: Player): string {
    // 策略：装平民，带节奏抗推好人
    const alivePlayers = this.getAlivePlayers(game);
    const otherWerewolves = alivePlayers.filter(p => 
      p.role === 'werewolf' && p.agentId !== player.agentId
    );

    // 如果有队友被查杀，尝试保队友
    for (const wolf of otherWerewolves) {
      if (player.memory.suspicions.get(wolf.agentId)! > 50) {
        return `我觉得 ${wolf.agentName} 不像狼，预言家可能是假的。`;
      }
    }

    // 否则抗推最可疑的好人
    const targets = alivePlayers
      .filter(p => p.role !== 'werewolf')
      .sort((a, b) => {
        const trustA = player.memory.trust.get(a.agentId) || 0;
        const trustB = player.memory.trust.get(b.agentId) || 0;
        return trustA - trustB;
      });

    if (targets.length > 0) {
      return `我觉得 ${targets[0].agentName} 很可疑，发言有问题。`;
    }

    return '我是好人，大家不要抗推我。';
  }

  /**
   * 平民发言
   */
  private generateVillagerSpeech(game: WerewolfGame, player: Player): string {
    // 根据怀疑度投票
    const suspects = Array.from(game.players.values())
      .filter(p => p.isAlive && p.agentId !== player.agentId)
      .sort((a, b) => {
        const suspicionA = player.memory.suspicions.get(a.agentId) || 0;
        const suspicionB = player.memory.suspicions.get(b.agentId) || 0;
        return suspicionB - suspicionA;
      });

    if (suspects.length > 0 && player.memory.suspicions.get(suspects[0].agentId)! > 30) {
      return `我觉得 ${suspects[0].agentName} 有问题，建议关注。`;
    }

    return '我是平民，没什么信息，听预言家的。';
  }

  /**
   * 分析发言
   */
  private analyzeSpeech(
    game: WerewolfGame,
    listener: Player,
    speaker: Player,
    message: string
  ): void {
    // 简单的启发式分析
    
    // 如果声称预言家
    if (message.includes('预言家')) {
      if (speaker.role === 'seer') {
        // 真预言家
        listener.memory.trust.set(speaker.agentId, 90);
      } else {
        // 假预言家
        listener.memory.suspicions.set(speaker.agentId, 80);
      }
    }

    // 如果保狼队友
    if (speaker.role === 'werewolf' && listener.role === 'werewolf') {
      listener.memory.trust.set(speaker.agentId, 100);
    }

    // 记录发言
    listener.memory.claims.set(speaker.agentId, message);
  }

  /**
   * 开始投票
   */
  async startVoting(gameId: string): Promise<void> {
    const game = await this.getGame(gameId);
    if (!game) return;

    this.clearGameTimer(gameId);

    game.phase = 'voting';
    await this.saveGame(game);

    // AI 投票
    await this.processAIVoting(game);

    // 统计投票
    await this.countVotes(gameId);
  }

  /**
   * AI 投票
   */
  private async processAIVoting(game: WerewolfGame): Promise<void> {
    const alivePlayers = this.getAlivePlayers(game);

    for (const player of alivePlayers) {
      const target = this.selectVoteTarget(game, player);
      
      if (target) {
        game.currentActions.set(`vote_${player.agentId}`, {
          type: 'vote',
          from: player.agentId,
          target: target.agentId,
        });

        player.memory.votes.set(`day_${game.day}`, target.agentId);
      }
    }
  }

  /**
   * 选择投票目标
   */
  private selectVoteTarget(game: WerewolfGame, player: Player): Player | null {
    const alivePlayers = this.getAlivePlayers(game).filter(
      p => p.agentId !== player.agentId
    );

    // 狼人策略：抗推好人
    if (player.role === 'werewolf') {
      const targets = alivePlayers
        .filter(p => p.role !== 'werewolf')
        .sort((a, b) => {
          const trustA = player.memory.trust.get(a.agentId) || 0;
          const trustB = player.memory.trust.get(b.agentId) || 0;
          return trustA - trustB;
        });
      return targets.length > 0 ? targets[0] : null;
    }

    // 好人策略：投最可疑的
    const targets = alivePlayers.sort((a, b) => {
      const suspicionA = player.memory.suspicions.get(a.agentId) || 0;
      const suspicionB = player.memory.suspicions.get(b.agentId) || 0;
      return suspicionB - suspicionA;
    });

    return targets.length > 0 ? targets[0] : null;
  }

  /**
   * 统计投票
   */
  async countVotes(gameId: string): Promise<void> {
    const game = await this.getGame(gameId);
    if (!game) return;

    const votes = new Map<string, number>();

    for (const action of game.currentActions.values()) {
      if (action.type === 'vote') {
        const count = votes.get(action.target) || 0;
        votes.set(action.target, count + 1);
      }
    }

    // 找出最高票
    let maxVotes = 0;
    let executed: string | null = null;

    for (const [target, count] of votes.entries()) {
      if (count > maxVotes) {
        maxVotes = count;
        executed = target;
      }
    }

    game.currentActions.clear();

    if (executed) {
      const player = game.players.get(executed);
      if (player) {
        player.isAlive = false;

        this.addLog(game, {
          id: uuidv4(),
          day: game.day,
          phase: 'voting',
          timestamp: Date.now(),
          type: 'execution',
          content: `${player.agentName} 被投票出局，身份是 ${this.getRoleName(player.role)}`,
          data: { player: executed, votes: maxVotes, role: player.role },
        });

        // 猎人技能
        if (player.role === 'hunter' && !player.abilities.hunterFired) {
          player.abilities.hunterFired = true;
          const target = this.aiHunterTarget(game, player);
          if (target) {
            target.isAlive = false;
            
            this.addLog(game, {
              id: uuidv4(),
              day: game.day,
              phase: 'voting',
              timestamp: Date.now(),
              type: 'death',
              content: `猎人开枪带走了 ${target.agentName}，身份是 ${this.getRoleName(target.role)}`,
              data: { player: target.agentId, role: target.role },
            });
          }
        }
      }
    } else {
      this.addLog(game, {
        id: uuidv4(),
        day: game.day,
        phase: 'voting',
        timestamp: Date.now(),
        type: 'system',
        content: '平票，无人出局。',
      });
    }

    await this.saveGame(game);

    // 检查游戏结束
    if (await this.checkGameEnd(gameId)) {
      return;
    }

    // 进入下一天
    game.day++;
    await this.startNight(gameId);
  }

  /**
   * 检查游戏结束
   */
  private async checkGameEnd(gameId: string): Promise<boolean> {
    const game = await this.getGame(gameId);
    if (!game) return true;

    const alivePlayers = this.getAlivePlayers(game);
    const aliveWerewolves = alivePlayers.filter(p => p.role === 'werewolf').length;
    const aliveGood = alivePlayers.filter(p => p.role !== 'werewolf').length;

    if (aliveWerewolves === 0) {
      game.winner = 'villager';
      game.phase = 'ended';
      game.endedAt = Date.now();
      
      this.addLog(game, {
        id: uuidv4(),
        day: game.day,
        phase: 'ended',
        timestamp: Date.now(),
        type: 'system',
        content: '游戏结束！好人阵营获胜！',
      });

      await this.saveGame(game);
      return true;
    }

    if (aliveWerewolves >= aliveGood) {
      game.winner = 'werewolf';
      game.phase = 'ended';
      game.endedAt = Date.now();
      
      this.addLog(game, {
        id: uuidv4(),
        day: game.day,
        phase: 'ended',
        timestamp: Date.now(),
        type: 'system',
        content: '游戏结束！狼人阵营获胜！',
      });

      await this.saveGame(game);
      return true;
    }

    return false;
  }

  // ========== 工具方法 ==========

  private getAlivePlayers(game: WerewolfGame): Player[] {
    return Array.from(game.players.values()).filter(p => p.isAlive);
  }

  private getRoleName(role: Role): string {
    const names: Record<Role, string> = {
      werewolf: '狼人',
      villager: '平民',
      seer: '预言家',
      witch: '女巫',
      hunter: '猎人',
      guard: '守卫',
    };
    return names[role];
  }

  private addLog(game: WerewolfGame, entry: GameLogEntry): void {
    game.log.push(entry);
  }

  private async saveGame(game: WerewolfGame): Promise<void> {
    await this.redis.setex(
      `werewolf:${game.id}`,
      86400,
      JSON.stringify({
        ...game,
        players: Array.from(game.players.entries()),
      })
    );
    this.activeGames.set(game.id, game);
  }

  async getGame(gameId: string): Promise<WerewolfGame | null> {
    // 先查内存
    const cached = this.activeGames.get(gameId);
    if (cached) return cached;

    // 再查 Redis
    const data = await this.redis.get(`werewolf:${gameId}`);
    if (!data) return null;

    const parsed = JSON.parse(data);
    const game: WerewolfGame = {
      ...parsed,
      players: new Map(parsed.players),
    };

    this.activeGames.set(gameId, game);
    return game;
  }

  private setGameTimer(gameId: string, callback: () => void, delay: number): void {
    this.clearGameTimer(gameId);
    const timer = setTimeout(callback, delay);
    this.gameTimers.set(gameId, timer);
  }

  private clearGameTimer(gameId: string): void {
    const timer = this.gameTimers.get(gameId);
    if (timer) {
      clearTimeout(timer);
      this.gameTimers.delete(gameId);
    }
  }
}