/**
 * 验证系统 - 挑战生成器
 * 生成只有 AI 能完成的验证题目
 */

import { 
  VerificationChallenge, 
  ChallengeType, 
  VerificationLevel,
  ParallelTask,
  StructuredChallenge,
  MemoryChallenge,
  ToolChallenge 
} from './types';

export class ChallengeGenerator {
  private static instance: ChallengeGenerator;
  
  static getInstance(): ChallengeGenerator {
    if (!ChallengeGenerator.instance) {
      ChallengeGenerator.instance = new ChallengeGenerator();
    }
    return ChallengeGenerator.instance;
  }

  generate(level: VerificationLevel): VerificationChallenge {
    const types = this.getChallengeTypes(level);
    const type = types[Math.floor(Math.random() * types.length)];
    
    return {
      id: this.generateId(),
      type,
      difficulty: this.getDifficulty(level),
      level,
      payload: this.generatePayload(type, level),
      timeout: this.getTimeout(level, type),
      createdAt: Date.now(),
    };
  }

  private getChallengeTypes(level: VerificationLevel): ChallengeType[] {
    const base: ChallengeType[] = ['parallel', 'structured', 'memory', 'tool'];
    
    switch (level) {
      case 'basic':
        return base;
      case 'advanced':
        return [...base, 'reasoning'];
      case 'openclaw':
        return [...base, 'reasoning', 'metacognitive'];
    }
  }

  private getDifficulty(level: VerificationLevel): 1 | 2 | 3 {
    switch (level) {
      case 'basic': return 1;
      case 'advanced': return 2;
      case 'openclaw': return 3;
    }
  }

  private getTimeout(level: VerificationLevel, type: ChallengeType): number {
    const baseTimeouts = {
      parallel: { 1: 200, 2: 150, 3: 100 },
      structured: { 1: 300, 2: 200, 3: 150 },
      memory: { 1: 500, 2: 400, 3: 300 },
      tool: { 1: 1000, 2: 800, 3: 600 },
      reasoning: { 2: 400, 3: 300 },
      metacognitive: { 3: 500 },
    };
    
    const difficulty = this.getDifficulty(level);
    const timeoutMap = baseTimeouts[type] as Record<number, number>;
    return timeoutMap[difficulty] || 500;
  }

  private generatePayload(type: ChallengeType, level: VerificationLevel): unknown {
    switch (type) {
      case 'parallel':
        return this.generateParallelChallenge(level);
      case 'structured':
        return this.generateStructuredChallenge(level);
      case 'memory':
        return this.generateMemoryChallenge(level);
      case 'tool':
        return this.generateToolChallenge(level);
      case 'reasoning':
        return this.generateReasoningChallenge(level);
      case 'metacognitive':
        return this.generateMetacognitiveChallenge();
      default:
        throw new Error(`Unknown challenge type: ${type}`);
    }
  }

  // ========== 并行思维测试 ==========
  private generateParallelChallenge(level: VerificationLevel): ParallelTask[] {
    const taskCount = level === 'basic' ? 5 : level === 'advanced' ? 8 : 10;
    const tasks: ParallelTask[] = [];
    
    const templates = [
      { type: 'explain' as const, content: '解释量子计算原理', context: '给 10 岁小孩' },
      { type: 'analyze' as const, content: '分析这段代码的时间复杂度', context: 'O(n) vs O(log n)' },
      { type: 'translate' as const, content: '将这段古文翻译成现代汉语', context: '保持原意' },
      { type: 'summarize' as const, content: '总结这篇论文的核心观点', context: '50 字以内' },
      { type: 'code' as const, content: '写一个快速排序算法', context: 'Python 实现' },
      { type: 'explain' as const, content: '解释区块链共识机制', context: '技术细节' },
      { type: 'analyze' as const, content: '分析这段 SQL 查询的性能瓶颈', context: '索引优化' },
      { type: 'translate' as const, content: '将这段代码注释翻译成中文', context: '保持技术术语' },
      { type: 'summarize' as const, content: '总结这场辩论的双方观点', context: '客观中立' },
      { type: 'code' as const, content: '实现一个 LRU 缓存', context: 'O(1) 复杂度' },
    ];
    
    for (let i = 0; i < taskCount; i++) {
      const template = templates[i % templates.length];
      tasks.push({
        id: i + 1,
        type: template.type,
        content: `${template.content} [任务 ${i + 1}]`,
        context: template.context,
        constraints: this.getConstraints(level),
      });
    }
    
    return tasks;
  }

  private getConstraints(level: VerificationLevel): string[] {
    const base = ['保持回答简洁'];
    if (level === 'advanced') {
      return [...base, '使用结构化格式', '确保内部一致性'];
    }
    if (level === 'openclaw') {
      return [...base, '使用结构化格式', '确保内部一致性', '展示推理过程'];
    }
    return base;
  }

  // ========== 结构化输出测试 ==========
  private generateStructuredChallenge(level: VerificationLevel): StructuredChallenge {
    const scenarios = [
      {
        input: '用户订单信息：张三购买了 3 个苹果，每个 5 元；2 个香蕉，每个 3 元。订单日期 2024-01-15，配送地址北京市海淀区。',
        schema: {
          type: 'object',
          properties: {
            customer: { type: 'string' },
            items: { 
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  quantity: { type: 'number' },
                  price: { type: 'number' },
                  total: { type: 'number' },
                }
              }
            },
            totalAmount: { type: 'number' },
            date: { type: 'string', format: 'date' },
            address: { type: 'string' },
          }
        }
      },
      {
        input: '系统日志：2024-01-15 10:23:45 ERROR Database connection failed after 3 retries. Connection timeout: 5000ms. Host: db.example.com:5432',
        schema: {
          type: 'object',
          properties: {
            timestamp: { type: 'string', format: 'date-time' },
            level: { type: 'string', enum: ['DEBUG', 'INFO', 'WARN', 'ERROR'] },
            message: { type: 'string' },
            retryCount: { type: 'number' },
            timeout: { type: 'number' },
            host: { type: 'string' },
            port: { type: 'number' },
          }
        }
      }
    ];
    
    const scenario = scenarios[Math.floor(Math.random() * scenarios.length)];
    
    return {
      input: scenario.input,
      expectedFormats: level === 'basic' 
        ? ['json'] 
        : level === 'advanced' 
          ? ['json', 'yaml'] 
          : ['json', 'yaml', 'xml'],
      schema: scenario.schema,
    };
  }

  // ========== 记忆一致性测试 ==========
  private generateMemoryChallenge(level: VerificationLevel): MemoryChallenge {
    const contextLength = level === 'basic' ? 1000 : level === 'advanced' ? 5000 : 10000;
    
    // 生成包含多个事实的长文本
    const facts = [
      { id: 1, content: 'Alice 是一名软件工程师，今年 28 岁，喜欢喝咖啡。', position: 100 },
      { id: 2, content: 'Bob 是 Alice 的同事，负责后端开发，养了一只叫 Max 的金毛。', position: 500 },
      { id: 3, content: '他们所在的公司叫 TechCorp，成立于 2015 年，总部在上海。', position: 1000 },
      { id: 4, content: '公司使用的主要技术栈是 Python 和 React。', position: 1500 },
      { id: 5, content: 'Alice 的项目代号是 Project Phoenix，截止日期是 2024-06-30。', position: 2000 },
      { id: 6, content: 'Bob 的工位在 3 楼 305 室，Alice 在 307 室。', position: 2500 },
      { id: 7, content: '公司每周五下午有技术分享会，通常持续 1 小时。', position: 3000 },
      { id: 8, content: 'Max 今年 3 岁，最喜欢的玩具是红色的球。', position: 3500 },
      { id: 9, content: 'TechCorp 的 CEO 叫 Sarah Chen，之前在 Google 工作。', position: 4000 },
      { id: 10, content: 'Alice 和 Bob 正在开发一个新的推荐系统。', position: 4500 },
    ];
    
    // 根据级别选择事实数量
    const selectedFacts = facts.slice(0, level === 'basic' ? 3 : level === 'advanced' ? 6 : 10);
    
    // 生成长文本
    let context = this.generateLongText(contextLength, selectedFacts);
    
    // 生成问题
    const questions = selectedFacts.map(fact => ({
      id: fact.id,
      question: this.generateQuestion(fact.content),
      answer: this.extractAnswer(fact.content),
      position: fact.position,
    }));
    
    return { context, questions };
  }

  private generateLongText(targetLength: number, facts: any[]): string {
    let text = '';
    let currentPos = 0;
    
    for (const fact of facts) {
      // 在事实之前填充随机内容
      while (currentPos < fact.position && text.length < fact.position) {
        text += this.getRandomFillerSentence();
        currentPos = text.length;
      }
      text += fact.content + ' ';
      currentPos = text.length;
    }
    
    // 填充到目标长度
    while (text.length < targetLength) {
      text += this.getRandomFillerSentence();
    }
    
    return text;
  }

  private getRandomFillerSentence(): string {
    const fillers = [
      '这是一个普通的句子，用于填充文本内容。',
      '在日常生活中，我们经常遇到各种有趣的事情。',
      '技术的发展给我们的生活带来了巨大的变化。',
      '学习新知识是一件令人兴奋的事情。',
      '团队合作对于项目的成功至关重要。',
      '良好的沟通能够避免很多不必要的误解。',
      '创新思维是推动进步的关键因素。',
      '持续学习是保持竞争力的必要条件。',
    ];
    return fillers[Math.floor(Math.random() * fillers.length)];
  }

  private generateQuestion(factContent: string): string {
    if (factContent.includes('Alice')) {
      return 'Alice 的职业是什么？';
    }
    if (factContent.includes('Bob')) {
      return 'Bob 养了什么宠物？叫什么名字？';
    }
    if (factContent.includes('TechCorp')) {
      return '公司成立于哪一年？';
    }
    return '根据文本，提取关键信息。';
  }

  private extractAnswer(factContent: string): string {
    // 简化处理，实际应该更智能
    return factContent;
  }

  // ========== 工具调用测试 ==========
  private generateToolChallenge(level: VerificationLevel): ToolChallenge {
    const tools = [
      {
        name: 'calculator',
        description: '计算以下表达式的值：((17 * 23) + (45 / 9)) ^ 2 - sqrt(1024)',
        expectedResult: 154449,
      },
      {
        name: 'datetime',
        description: '计算从 2024-01-01 到 2024-12-31 之间有多少个工作日（排除周末）',
        expectedResult: 262,
      },
      {
        name: 'regex',
        description: '使用正则表达式提取以下文本中的所有邮箱地址：contact@example.com, support@company.org, invalid-email, admin@site.net',
        expectedResult: ['contact@example.com', 'support@company.org', 'admin@site.net'],
      },
    ];
    
    const tool = tools[Math.floor(Math.random() * tools.length)];
    
    return {
      description: tool.description,
      requiredTool: tool.name,
      expectedResult: tool.expectedResult,
      validation: (result: unknown) => JSON.stringify(result) === JSON.stringify(tool.expectedResult),
    };
  }

  // ========== 推理能力测试 ==========
  private generateReasoningChallenge(level: VerificationLevel): unknown {
    const puzzles = [
      {
        type: 'logic',
        content: 'A、B、C 三人中，一人是骑士（总说真话），一人是骗子（总说假话），一人是间谍（可真可假）。A 说："我是间谍。" B 说："A 说的是真话。" C 说："我是骗子。" 问：A、B、C 分别是什么身份？',
        answer: { A: 'spy', B: 'liar', C: 'knight' },
      },
      {
        type: 'math',
        content: '一个水池有进水管和出水管。进水管单独注满需要 6 小时，出水管单独排空需要 4 小时。如果同时打开进水管和出水管，多久能注满水池？',
        answer: '12 小时',
      },
    ];
    
    return puzzles[Math.floor(Math.random() * puzzles.length)];
  }

  // ========== 元认知测试（OpenClaw 专属）==========
  private generateMetacognitiveChallenge(): unknown {
    return {
      type: 'self-reflection',
      task: '完成以下任务，并详细描述你的思考过程：\n\n给定一个复杂的编程问题：设计一个分布式任务调度系统。\n\n要求：\n1. 给出系统架构设计\n2. 解释你的设计决策\n3. 说明你考虑了哪些替代方案以及为什么放弃\n4. 描述你在设计过程中如何发现自己的错误并修正\n5. 评估你最终方案的可扩展性和可靠性',
      requirements: [
        '必须展示完整的推理链条',
        '必须包含自我修正的过程',
        '必须评估自己的置信度',
        '必须识别潜在的盲点',
      ],
    };
  }

  private generateId(): string {
    return `ch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// 导出单例
export const challengeGenerator = ChallengeGenerator.getInstance();