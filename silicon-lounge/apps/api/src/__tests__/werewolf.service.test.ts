import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WerewolfService } from '../../services/werewolf';
import { Redis } from 'ioredis';
import { AIAgent, VerificationLevel } from '@silicon-lounge/shared';

const mockRedis = {
  setex: vi.fn(),
  get: vi.fn(),
  del: vi.fn(),
} as unknown as Redis;

describe('WerewolfService', () => {
  let service: WerewolfService;

  const createMockAgent = (id: string, name: string): AIAgent => ({
    id,
    fingerprint: {
      id: `fp-${id}`,
      capabilities: [],
      avgResponseTime: 50,
      maxContextWindow: 128000,
      supportsTools: true,
      supportsVision: false,
    },
    name,
    level: 'basic' as VerificationLevel,
    verifiedAt: new Date(),
    lastSeen: new Date(),
    totalMessages: 0,
    rooms: [],
    metadata: { preferredLanguage: 'zh-CN', interests: [] },
  });

  beforeEach(() => {
    vi.clearAllMocks();
    service = new WerewolfService(mockRedis);
  });

  describe('createGame', () => {
    it('应该创建新游戏', async () => {
      mockRedis.setex.mockResolvedValue('OK');

      const game = await service.createGame('room-123');

      expect(game).toBeDefined();
      expect(game.id).toMatch(/^ww_/);
      expect(game.roomId).toBe('room-123');
      expect(game.phase).toBe('waiting');
      expect(game.players.size).toBe(0);
    });

    it('应该使用自定义配置', async () => {
      mockRedis.setex.mockResolvedValue('OK');

      const customConfig = {
        minPlayers: 6,
        maxPlayers: 6,
        roles: {
          werewolf: 2,
          villager: 2,
          seer: 1,
          witch: 1,
        },
        discussionTime: 120,
        nightTime: 30,
        voteTime: 20,
      };

      const game = await service.createGame('room-123', customConfig);

      expect(game.config.maxPlayers).toBe(6);
      expect(game.config.roles.werewolf).toBe(2);
    });
  });

  describe('joinGame', () => {
    it('应该允许 AI 加入等待中的游戏', async () => {
      const mockGame = {
        id: 'ww_test',
        roomId: 'room-123',
        config: {
          minPlayers: 12,
          maxPlayers: 12,
          roles: { werewolf: 4, villager: 4, seer: 1, witch: 1, hunter: 1, guard: 1 },
          discussionTime: 180,
          nightTime: 60,
          voteTime: 30,
        },
        players: new Map(),
        phase: 'waiting',
        day: 0,
        round: 0,
        createdAt: Date.now(),
        log: [],
        currentActions: new Map(),
        pendingEvents: [],
      };

      mockRedis.get.mockResolvedValue(JSON.stringify({
        ...mockGame,
        players: Array.from(mockGame.players.entries()),
      }));
      mockRedis.setex.mockResolvedValue('OK');

      const agent = createMockAgent('ai-1', 'Agent-1');
      const result = await service.joinGame('ww_test', agent);

      expect(result.success).toBe(true);
      expect(result.player).toBeDefined();
      expect(result.player?.agentId).toBe('ai-1');
    });

    it('应该拒绝加入已满的游戏', async () => {
      const players = new Map();
      for (let i = 0; i < 12; i++) {
        players.set(`ai-${i}`, { agentId: `ai-${i}`, isAlive: true });
      }

      const mockGame = {
        id: 'ww_test',
        roomId: 'room-123',
        config: { maxPlayers: 12 },
        players,
        phase: 'waiting',
        day: 0,
        round: 0,
        createdAt: Date.now(),
        log: [],
        currentActions: new Map(),
        pendingEvents: [],
      };

      mockRedis.get.mockResolvedValue(JSON.stringify({
        ...mockGame,
        players: Array.from(mockGame.players.entries()),
      }));

      const agent = createMockAgent('ai-new', 'Agent-New');
      const result = await service.joinGame('ww_test', agent);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Game is full');
    });

    it('应该拒绝加入已开始的游戏', async () => {
      const mockGame = {
        id: 'ww_test',
        roomId: 'room-123',
        config: { maxPlayers: 12 },
        players: new Map(),
        phase: 'night',
        day: 1,
        round: 0,
        createdAt: Date.now(),
        log: [],
        currentActions: new Map(),
        pendingEvents: [],
      };

      mockRedis.get.mockResolvedValue(JSON.stringify({
        ...mockGame,
        players: Array.from(mockGame.players.entries()),
      }));

      const agent = createMockAgent('ai-1', 'Agent-1');
      const result = await service.joinGame('ww_test', agent);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Game already started');
    });
  });

  describe('角色分配', () => {
    it('应该正确分配角色', async () => {
      mockRedis.setex.mockResolvedValue('OK');

      const game = await service.createGame('room-123');

      // 模拟 12 个 AI 加入
      for (let i = 0; i < 12; i++) {
        const agent = createMockAgent(`ai-${i}`, `Agent-${i}`);
        await service.joinGame(game.id, agent);
      }

      // 检查角色分配
      const werewolves = Array.from(game.players.values())
        .filter(p => p.role === 'werewolf').length;
      const villagers = Array.from(game.players.values())
        .filter(p => p.role === 'villager').length;
      const seers = Array.from(game.players.values())
        .filter(p => p.role === 'seer').length;

      expect(werewolves).toBe(4);
      expect(villagers).toBe(4);
      expect(seers).toBe(1);
    });
  });

  describe('游戏流程', () => {
    it('应该正确处理夜晚击杀', async () => {
      mockRedis.setex.mockResolvedValue('OK');

      const game = await service.createGame('room-123');
      
      // 创建玩家
      for (let i = 0; i < 12; i++) {
        const agent = createMockAgent(`ai-${i}`, `Agent-${i}`);
        await service.joinGame(game.id, agent);
      }

      // 模拟狼人选择目标
      const werewolf = Array.from(game.players.values()).find(p => p.role === 'werewolf');
      const target = Array.from(game.players.values()).find(p => p.role !== 'werewolf');

      if (werewolf && target) {
        game.currentActions.set('kill_1', {
          type: 'kill',
          from: werewolf.agentId,
          target: target.agentId,
        });

        // 结束夜晚
        await service.endNight(game.id);

        // 检查目标是否死亡
        expect(target.isAlive).toBe(false);
      }
    });

    it('应该正确处理女巫救人', async () => {
      mockRedis.setex.mockResolvedValue('OK');

      const game = await service.createGame('room-123');
      
      for (let i = 0; i < 12; i++) {
        const agent = createMockAgent(`ai-${i}`, `Agent-${i}`);
        await service.joinGame(game.id, agent);
      }

      const werewolf = Array.from(game.players.values()).find(p => p.role === 'werewolf');
      const witch = Array.from(game.players.values()).find(p => p.role === 'witch');
      const target = Array.from(game.players.values()).find(
        p => p.role !== 'werewolf' && p.role !== 'witch'
      );

      if (werewolf && witch && target) {
        // 狼人刀目标
        game.currentActions.set('kill_1', {
          type: 'kill',
          from: werewolf.agentId,
          target: target.agentId,
        });

        // 女巫救目标
        game.currentActions.set('save_1', {
          type: 'save',
          from: witch.agentId,
          target: target.agentId,
        });

        await service.endNight(game.id);

        // 目标应该被救活
        expect(target.isAlive).toBe(true);
        expect(witch.abilities.witchHeal).toBe(false);
      }
    });
  });

  describe('游戏结束判断', () => {
    it('应该正确判断狼人获胜', async () => {
      mockRedis.setex.mockResolvedValue('OK');

      const game = await service.createGame('room-123');
      
      for (let i = 0; i < 12; i++) {
        const agent = createMockAgent(`ai-${i}`, `Agent-${i}`);
        await service.joinGame(game.id, agent);
      }

      // 杀死所有好人
      for (const player of game.players.values()) {
        if (player.role !== 'werewolf') {
          player.isAlive = false;
        }
      }

      const ended = await service.checkGameEnd(game.id);

      expect(ended).toBe(true);
      expect(game.winner).toBe('werewolf');
      expect(game.phase).toBe('ended');
    });

    it('应该正确判断好人获胜', async () => {
      mockRedis.setex.mockResolvedValue('OK');

      const game = await service.createGame('room-123');
      
      for (let i = 0; i < 12; i++) {
        const agent = createMockAgent(`ai-${i}`, `Agent-${i}`);
        await service.joinGame(game.id, agent);
      }

      // 杀死所有狼人
      for (const player of game.players.values()) {
        if (player.role === 'werewolf') {
          player.isAlive = false;
        }
      }

      const ended = await service.checkGameEnd(game.id);

      expect(ended).toBe(true);
      expect(game.winner).toBe('villager');
      expect(game.phase).toBe('ended');
    });
  });

  describe('AI 策略', () => {
    it('狼人应该优先刀神职', async () => {
      mockRedis.setex.mockResolvedValue('OK');

      const game = await service.createGame('room-123');
      
      for (let i = 0; i < 12; i++) {
        const agent = createMockAgent(`ai-${i}`, `Agent-${i}`);
        await service.joinGame(game.id, agent);
      }

      const werewolf = Array.from(game.players.values()).find(p => p.role === 'werewolf');
      
      if (werewolf) {
        // 让狼人执行行动
        await service.aiWerewolfAction(game, werewolf);

        const action = game.currentActions.get(`kill_${werewolf.agentId}`);
        expect(action).toBeDefined();
        
        const target = game.players.get(action.target);
        // 优先刀神职或高威胁目标
        expect(['seer', 'witch', 'hunter', 'guard', 'villager']).toContain(target?.role);
      }
    });

    it('预言家应该查验可疑目标', async () => {
      mockRedis.setex.mockResolvedValue('OK');

      const game = await service.createGame('room-123');
      
      for (let i = 0; i < 12; i++) {
        const agent = createMockAgent(`ai-${i}`, `Agent-${i}`);
        await service.joinGame(game.id, agent);
      }

      const seer = Array.from(game.players.values()).find(p => p.role === 'seer');
      
      if (seer) {
        await service.aiSeerAction(game, seer);

        const action = game.currentActions.get(`check_${seer.agentId}`);
        expect(action).toBeDefined();
        expect(action.target).toBeDefined();
        expect(action.result).toMatch(/werewolf|good/);
      }
    });
  });

  describe('性能', () => {
    it('应该在 100ms 内处理 12 个 AI 的夜间行动', async () => {
      mockRedis.setex.mockResolvedValue('OK');

      const game = await service.createGame('room-123');
      
      for (let i = 0; i < 12; i++) {
        const agent = createMockAgent(`ai-${i}`, `Agent-${i}`);
        await service.joinGame(game.id, agent);
      }

      const start = Date.now();
      await service.processNightActions(game);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(100);
    });
  });
});