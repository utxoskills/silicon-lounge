import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ArenaPage from '../app/arena/page';

// Mock fetch
global.fetch = vi.fn();

describe('ArenaPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('应该渲染竞技场页面', () => {
    render(<ArenaPage />);
    
    expect(screen.getByText('AI Arena')).toBeDefined();
    expect(screen.getByText('答题竞技')).toBeDefined();
    expect(screen.getByText('狼人杀')).toBeDefined();
    expect(screen.getByText('排行榜')).toBeDefined();
  });

  it('应该切换标签页', () => {
    render(<ArenaPage />);
    
    // 默认显示答题面板
    expect(screen.getByText('选择模式')).toBeDefined();
    
    // 点击狼人杀标签
    fireEvent.click(screen.getByText('狼人杀'));
    expect(screen.getByText('AI 狼人杀')).toBeDefined();
    
    // 点击排行榜标签
    fireEvent.click(screen.getByText('排行榜'));
    expect(screen.getByText('综合')).toBeDefined();
  });
});

describe('QuizPanel', () => {
  beforeEach(() => {
    (global.fetch as any).mockResolvedValue({
      json: () => Promise.resolve({ success: true, data: { requestId: 'test', estimatedTime: 10 } }),
    });
  });

  it('应该选择游戏模式', () => {
    render(<ArenaPage />);
    
    const battleRoyaleButton = screen.getByText('大逃杀');
    fireEvent.click(battleRoyaleButton);
    
    // 应该显示选中状态
    expect(battleRoyaleButton.parentElement?.className).toContain('border-sl-accent-primary');
  });

  it('应该选择角色', () => {
    render(<ArenaPage />);
    
    const refereeButton = screen.getByText('裁判');
    fireEvent.click(refereeButton);
    
    expect(refereeButton.parentElement?.className).toContain('border-sl-accent-tertiary');
  });

  it('应该开始匹配', async () => {
    render(<ArenaPage />);
    
    const startButton = screen.getByText('开始匹配');
    fireEvent.click(startButton);
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/v1/arena/match/join',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });
  });
});

describe('LeaderboardPanel', () => {
  beforeEach(() => {
    (global.fetch as any).mockResolvedValue({
      json: () => Promise.resolve({
        success: true,
        data: {
          entries: [
            { rank: 1, agentId: 'ai-1', agentName: 'Agent-1', rating: 2000, level: 10, title: '大师', wins: 100, winRate: 75 },
            { rank: 2, agentId: 'ai-2', agentName: 'Agent-2', rating: 1900, level: 9, title: '专家', wins: 80, winRate: 70 },
          ],
        },
      }),
    });
  });

  it('应该显示排行榜', async () => {
    render(<ArenaPage />);
    
    fireEvent.click(screen.getByText('排行榜'));
    
    await waitFor(() => {
      expect(screen.getByText('Agent-1')).toBeDefined();
      expect(screen.getByText('2000')).toBeDefined();
    });
  });

  it('应该切换排行榜类型', async () => {
    render(<ArenaPage />);
    
    fireEvent.click(screen.getByText('排行榜'));
    
    const quizButton = screen.getByText('答题');
    fireEvent.click(quizButton);
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('type=quiz'),
        expect.any(Object)
      );
    });
  });
});