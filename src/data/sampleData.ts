import { WeekData, TimeBlock } from '../types';

/**
 * Generate a TimeBlock with a unique ID.
 */
function block(
  overrides: Partial<TimeBlock> & { time: string; type: TimeBlock['type']; task: string }
): TimeBlock {
  const id =
    overrides.id ??
    `b-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    id,
    completed: false,
    note: '',
    modifications: [],
    ...overrides,
  };
}

/**
 * Generate sample data for week 2026-W21 (May 18-22, 2026).
 * This data is injected into localStorage on first load so the app
 * has content to display out of the box.
 */
export function getSampleWeekData(): WeekData {
  const days: WeekData['days'] = {
    '2026-05-18': {
      blocks: [
        block({
          time: '10:00-10:50',
          type: 'deep',
          task: '编写PRD第1-2节：产品背景与目标',
          completed: true,
          note: '已完成，额外补充了竞品分析段落',
          modifications: [
            {
              time: '2026-05-18T09:30:00',
              original: '编写PRD第1-2节',
              new: '编写PRD第1-2节 + 竞品分析',
              reason: '昨晚想到需要在背景部分加入竞品对比视角',
            },
          ],
        }),
        block({
          time: '10:50-11:00', type: 'break', task: '伸展休息', completed: true,
        }),
        block({
          time: '11:00-11:50',
          type: 'deep',
          task: '编写PRD第3-4节：用户故事与功能列表',
          completed: true,
          note: '完成了6个核心用户故事',
        }),
        block({
          time: '11:50-12:00', type: 'break', task: '喝水走动', completed: true,
        }),
        block({
          time: '12:00-12:50',
          type: 'deep',
          task: '功能优先级排序（P0/P1/P2）',
          completed: true,
          note: '与产品经理确认了优先级',
        }),
        block({
          time: '12:50-13:30', type: 'break', task: '午休用餐', completed: true,
        }),
        block({
          time: '13:30-14:20',
          type: 'deep',
          task: '编写技术方案初稿',
          completed: false,
          note: '只完成了一半，需要和架构师确认',
        }),
        block({
          time: '14:20-14:30', type: 'break', task: '短暂休息', completed: true,
        }),
        block({
          time: '14:30-15:20',
          type: 'buffer',
          task: '回复邮件与Slack消息',
          completed: true,
          note: '处理了3封重要邮件',
        }),
        block({
          time: '15:20-15:50', type: 'buffer', task: '代码审查同事的PR', completed: true,
        }),
        block({
          time: '15:50-16:40',
          type: 'deep',
          task: '修复登录页面Bug #3421',
          completed: true,
          note: '原因是token过期处理逻辑缺失',
        }),
        block({
          time: '16:40-16:50', type: 'break', task: '茶歇', completed: true,
        }),
        block({
          time: '16:50-17:40',
          type: 'buffer',
          task: '整理本周工作进展汇报',
          completed: true,
        }),
        block({
          time: '17:40-17:50', type: 'break', task: '回顾今日完成情况', completed: true,
        }),
        block({
          time: '17:50-18:40',
          type: 'buffer',
          task: '为明日架构设计评审准备材料',
          completed: false,
          note: '还需要整理系统架构图',
        }),
        block({
          time: '18:40-19:00', type: 'break', task: '收尾整理 & 下班', completed: true,
        }),
      ],
    },
  };

  return {
    goals: {
      Monday: '完成PRD文档编写与评审',
      Tuesday: '完成系统架构设计评审',
      Wednesday: '核心模块编码（用户认证+权限）',
      Thursday: '单元测试编写，覆盖率≥80%',
      Friday: '代码审查与生产环境部署',
    },
    days,
    knowledgeCards: [
      {
        id: 'kc-001',
        date: '2026-05-18',
        question: 'PRD文档中如何区分P0/P1/P2需求优先级？',
        answer:
          'P0（Must Have）：没有此功能产品无法上线，是核心价值的最小闭环。\nP1（Should Have）：重要但有临时替代方案(workaround)，可在上线后首个迭代补上。\nP2（Nice to Have）：锦上添花，不影响主流程，可根据资源情况延后或砍掉。',
        tags: ['产品', '需求分析', 'PRD'],
        mastery: 2,
        source: 'PRD撰写实战 - 周一深度工作',
      },
      {
        id: 'kc-002',
        date: '2026-05-18',
        question: '用户故事的标准格式是什么？包含哪些要素？',
        answer:
          '标准格式：「作为<用户角色>，我希望<完成某个目标>，以便<获得某种价值>。」\n核心三要素：\n1. 角色（Who）—— 谁要使用这个功能\n2. 行为（What）—— 希望完成什么操作\n3. 价值（Why）—— 为什么需要这个功能，背后的业务目标',
        tags: ['产品', '用户故事', '敏捷'],
        mastery: 1,
        source: 'PRD撰写实战 - 用户故事章节',
      },
      {
        id: 'kc-003',
        date: '2026-05-18',
        question: 'Token过期后如何处理才能保证用户体验和安全？',
        answer:
          '推荐方案：Access Token + Refresh Token 双令牌机制。\n1. Access Token 短期有效（如15分钟），过期后使用 Refresh Token 静默换取新 Access Token\n2. Refresh Token 长期有效（如7天），过期后跳转登录页\n3. 在前端使用 axios 拦截器，检测401状态码自动刷新Token\n4. 多标签页场景需处理并发刷新问题（加锁/队列）',
        tags: ['技术', '安全', '认证'],
        mastery: 3,
        source: 'Bug修复 - 登录页面Token处理',
      },
    ],
  };
}

/**
 * Copy the sample data into localStorage so the app starts with demo content.
 * Only runs once — if data already exists, does nothing.
 */
export function initSampleData(): void {
  const STORAGE_KEY = 'weekly-planner-data';
  const existing = localStorage.getItem(STORAGE_KEY);
  if (existing) {
    try {
      const parsed = JSON.parse(existing);
      if (parsed.weeks && Object.keys(parsed.weeks).length > 0) {
        return; // Already has data
      }
    } catch {
      // Corrupted data — overwrite with sample
    }
  }

  const sample = {
    weeks: {
      '2026-W21': getSampleWeekData(),
    },
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sample));
}
