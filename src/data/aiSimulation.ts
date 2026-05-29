import { Goals, TimeBlock, TimeBudget, KnowledgeCard } from '../types';

/**
 * Simulate AI schedule generation.
 *
 * Given the daily goals and time budget, produce a realistic
 * set of time blocks for each weekday.
 *
 * Uses setTimeout wrapped in a Promise to mimic an AI API call.
 */
export async function generateSchedule(
  goals: Goals,
  budget: TimeBudget
): Promise<Record<string, TimeBlock[]>> {
  // Simulate network delay
  await delay(1200 + Math.random() * 800);

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const result: Record<string, TimeBlock[]> = {};

  for (const day of days) {
    const goal = goals[day] || '待安排';
    result[day] = generateDayBlocks(day, goal, budget);
  }

  return result;
}

/**
 * Generate time blocks for a single day using the budget.
 */
function generateDayBlocks(
  day: string,
  goal: string,
  budget: TimeBudget
): TimeBlock[] {
  const blocks: TimeBlock[] = [];
  let id = 1;

  const deepHours = budget.deep;
  const bufferHours = budget.buffer;
  const breakHours = budget.break;

  // Template tasks per day based on day of week
  const deepTasks = splitGoalIntoTasks(goal, deepHours, day);
  const bufferTasks = getBufferTasks(day);
  const breakTasks = getBreakTasks(day);

  // Build a timeline from 10:00 to 19:00
  // Pattern: 50min work → 10min break (for deep), or 30-50min blocks for buffer
  let currentMinute = 0; // minutes from 10:00

  let deepIdx = 0;
  let bufferIdx = 0;
  let breakIdx = 0;

  // Allocate deep work blocks (50min each)
  const deepBlockCount = deepHours; // 1 block = ~1 hour (50+10)
  const bufferBlockCount = Math.ceil(bufferHours * 60 / 40); // ~40min each
  const totalBreakSlots = deepBlockCount + bufferBlockCount + 2; // short breaks + lunch + end

  // Simplified scheduler: interleave deep and buffer with breaks
  const schedule: Array<{ duration: number; type: 'deep' | 'buffer' | 'break' }> = [];

  // Morning deep work session (2-3 blocks)
  const morningDeep = Math.min(3, deepBlockCount);
  for (let i = 0; i < morningDeep; i++) {
    schedule.push({ duration: 50, type: 'deep' });
    schedule.push({ duration: 10, type: 'break' });
  }

  // Lunch break
  schedule.push({ duration: 40, type: 'break' });

  // Afternoon deep work
  const afternoonDeep = deepBlockCount - morningDeep;
  for (let i = 0; i < afternoonDeep; i++) {
    schedule.push({ duration: 50, type: 'deep' });
    schedule.push({ duration: 10, type: 'break' });
  }

  // Buffer blocks interspersed
  const bufferSlots: number[] = [];
  // Insert buffers between deep work blocks where possible
  for (let i = 0; i < bufferBlockCount; i++) {
    bufferSlots.push(i * 2 + 1); // after some deep blocks
  }

  // Actually, let me rebuild the schedule more carefully
  // Clear and rebuild
  schedule.length = 0;

  let remainingDeep = deepBlockCount;
  let remainingBuffer = bufferBlockCount;
  let isAfternoon = false;

  // Morning: 3 deep blocks max
  const morningDeepCount = Math.min(3, remainingDeep);
  for (let i = 0; i < morningDeepCount && currentMinute < 540; i++) {
    schedule.push({ duration: 50, type: 'deep' });
    remainingDeep--;
    if (i < morningDeepCount - 1 || remainingDeep > 0 || remainingBuffer > 0) {
      schedule.push({ duration: 10, type: 'break' });
    }
  }

  // Lunch
  schedule.push({ duration: 40, type: 'break' });

  // Afternoon: remaining deep + buffer
  const afternoonItems: Array<{ duration: number; type: 'deep' | 'buffer' | 'break' }> = [];

  // Alternate: deep, buffer, deep, buffer, etc.
  while (remainingDeep > 0 || remainingBuffer > 0) {
    if (remainingDeep > 0) {
      afternoonItems.push({ duration: 50, type: 'deep' });
      remainingDeep--;
      afternoonItems.push({ duration: 10, type: 'break' });
    }
    if (remainingBuffer > 0) {
      afternoonItems.push({ duration: 40, type: 'buffer' });
      remainingBuffer--;
      if (remainingDeep > 0 || remainingBuffer > 0) {
        afternoonItems.push({ duration: 10, type: 'break' });
      }
    }
  }

  schedule.push(...afternoonItems);

  // End-of-day wrap-up
  schedule.push({ duration: 20, type: 'break' });

  // Now convert schedule to TimeBlocks
  for (const item of schedule) {
    const start = minuteToTime(currentMinute);
    const end = minuteToTime(currentMinute + item.duration);

    let task = '';
    if (item.type === 'deep') {
      task = deepTasks[deepIdx] || goal;
      deepIdx++;
    } else if (item.type === 'buffer') {
      task = bufferTasks[bufferIdx] || '处理待办事项';
      bufferIdx++;
    } else {
      task = breakTasks[breakIdx] || '休息';
      breakIdx++;
    }

    blocks.push({
      id: `${day}-${String(id).padStart(2, '0')}`,
      time: `${start}-${end}`,
      type: item.type,
      task,
      completed: false,
      note: '',
      modifications: [],
    });

    currentMinute += item.duration;
  }

  return blocks;
}

/** Convert minutes from 10:00 to a time string like "10:50" */
function minuteToTime(minutes: number): string {
  const totalMinutes = 10 * 60 + minutes;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Split a goal sentence into concrete deep work tasks */
function splitGoalIntoTasks(goal: string, count: number, day: string): string[] {
  const templates: Record<string, string[]> = {
    Monday: [
      `梳理「${goal}」的框架与核心要点`,
      `编写「${goal}」第一版草稿`,
      `深入调研「${goal}」相关背景资料`,
      `完善「${goal}」细节与数据支撑`,
      `自审「${goal}」并标注待确认点`,
    ],
    Tuesday: [
      `准备「${goal}」所需材料与数据`,
      `绘制「${goal}」核心架构/流程图`,
      `编写「${goal}」方案文档`,
      `与相关方对齐「${goal}」方案细节`,
      `修订「${goal}」并根据反馈调整`,
    ],
    Wednesday: [
      `搭建「${goal}」基础代码框架`,
      `实现「${goal}」核心业务逻辑`,
      `处理「${goal}」异常边界情况`,
      `「${goal}」联调与自测`,
      `代码优化与重构「${goal}」`,
    ],
    Thursday: [
      `编写「${goal}」单元测试用例`,
      `补充「${goal}」集成测试`,
      `运行测试并修复失败用例`,
      `检查「${goal}」测试覆盖率`,
      `「${goal}」测试报告整理`,
    ],
    Friday: [
      `审查「${goal}」相关代码变更`,
      `部署「${goal}」至预发布环境验证`,
      `「${goal}」文档更新与发布说明`,
      `「${goal}」生产环境部署`,
      `周度总结与下周规划`,
    ],
  };

  const tasks = templates[day] || [
    `「${goal}」- 任务1`,
    `「${goal}」- 任务2`,
    `「${goal}」- 任务3`,
    `「${goal}」- 任务4`,
    `「${goal}」- 任务5`,
  ];

  return tasks.slice(0, Math.max(count, 1));
}

/** Get buffer tasks appropriate for a given day */
function getBufferTasks(day: string): string[] {
  const base = [
    '回复邮件与Slack消息',
    '代码审查同事的Pull Request',
    '更新Jira任务状态',
    '处理突发Bug或紧急请求',
    '整理工作笔记与文档',
    '参加团队站会/同步会议',
  ];
  return base;
}

/** Get break tasks */
function getBreakTasks(day: string): string[] {
  return [
    '站立伸展 & 远眺放松',
    '喝水 & 简短走动',
    '午休用餐 🍱',
    '茶歇 & 冥想呼吸',
    '咖啡时间 ☕',
    '回顾完成情况 & 调整计划',
  ];
}

/**
 * Simulate AI knowledge card extraction from notes.
 * Returns 2-3 sample cards based on keyword matching.
 */
export async function generateKnowledgeCards(
  noteContent: string
): Promise<KnowledgeCard[]> {
  await delay(800 + Math.random() * 600);

  const today = new Date().toISOString().slice(0, 10);
  const cards: KnowledgeCard[] = [];

  // Simple keyword-based generation
  const patterns: Array<{
    keywords: string[];
    question: string;
    answer: string;
    tags: string[];
    source: string;
  }> = [
    {
      keywords: ['PRD', '需求', '产品', '优先级'],
      question: '撰写PRD时如何确保需求不遗漏？',
      answer:
        '1. 使用用户旅程地图覆盖所有触点\n2. 按角色梳理功能矩阵\n3. 竞品功能对比分析\n4. 与利益相关方逐一确认\n5. 建立需求追溯矩阵（Requirement Traceability Matrix）',
      tags: ['产品', 'PRD'],
      source: 'PRD撰写',
    },
    {
      keywords: ['架构', '设计', '系统', '方案'],
      question: '系统架构设计评审需要准备哪些材料？',
      answer:
        '1. 架构设计文档（含4+1视图）\n2. 技术选型对比分析\n3. 关键流程图/时序图\n4. 非功能性需求方案（性能、安全、容灾）\n5. 风险评估与缓解计划\n6. 部署架构图',
      tags: ['架构', '设计评审'],
      source: '架构设计',
    },
    {
      keywords: ['代码', '编码', '开发', '实现'],
      question: '高质量代码的SOLID原则是什么？',
      answer:
        'S - 单一职责：一个类只负责一件事\nO - 开闭原则：对扩展开放，对修改关闭\nL - 里氏替换：子类可以替换父类\nI - 接口隔离：接口应该小而专\nD - 依赖倒置：依赖抽象而非具体实现',
      tags: ['编码', '设计模式'],
      source: '核心模块编码',
    },
    {
      keywords: ['测试', '单元测试', '覆盖率'],
      question: '单元测试的AAA模式是什么？',
      answer:
        'Arrange（准备）：初始化测试数据和依赖\nAct（执行）：调用被测试的方法\nAssert（断言）：验证结果是否符合预期\n\n好的单元测试特征：快速、独立、可重复、自验证、及时（FIRST原则）',
      tags: ['测试', '质量'],
      source: '单元测试编写',
    },
    {
      keywords: ['部署', '上线', '发布', '审查'],
      question: '生产环境部署前需要做哪些检查？',
      answer:
        '1. 所有测试通过（单元+集成+E2E）\n2. 代码审查已完成\n3. 发布说明已准备\n4. 数据库迁移脚本已测试\n5. 回滚方案已就绪\n6. 监控告警已配置\n7. 性能测试已通过\n8. 安全扫描无高危漏洞',
      tags: ['部署', '运维'],
      source: '代码审查与部署',
    },
    {
      keywords: ['bug', 'Bug', '修复', 'fix'],
      question: 'Bug修复的标准流程是怎样的？',
      answer:
        '1. 复现Bug并确认根因\n2. 编写失败的测试用例复现问题\n3. 修改代码使测试通过\n4. 回归测试确保无新问题\n5. Code Review\n6. 记录修复方案到知识库\n7. 合入主分支并部署',
      tags: ['流程', '质量'],
      source: 'Bug修复',
    },
  ];

  // Match keywords from note content
  const matched = patterns.filter((p) =>
    p.keywords.some((kw) => noteContent.includes(kw))
  );

  // Take up to 3 matches, or random selection if no matches
  const selected = matched.length > 0 ? matched.slice(0, 3) : patterns.slice(0, 3);

  for (let i = 0; i < Math.min(3, selected.length); i++) {
    const p = selected[i];
    cards.push({
      id: `kc-gen-${Date.now()}-${i}`,
      date: today,
      question: p.question,
      answer: p.answer,
      tags: p.tags,
      mastery: 0,
      source: p.source,
    });
  }

  return cards;
}

/** Helper: simulate async delay */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
