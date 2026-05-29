/* ===== Core Data Types ===== */

export type BlockType = 'deep' | 'buffer' | 'break';

export interface Modification {
  time: string; // ISO timestamp
  original: string;
  new: string;
  reason: string;
}

export interface TimeBlock {
  id: string;
  time: string; // e.g. "10:00-10:50"
  type: BlockType;
  task: string;
  completed: boolean;
  note: string;
  modifications: Modification[];
}

export interface HourlyCheckin {
  hour: string;           // "10", "11", "12", ...
  checked: boolean[];     // 3 个勾选项状态
  note: string;
  time: string;           // ISO timestamp of when it was recorded
}

export interface DayData {
  blocks: TimeBlock[];
  checkins?: HourlyCheckin[];
}

export interface Goals {
  [day: string]: string;
}

export interface KnowledgeCard {
  id: string;
  date: string;
  question: string;
  answer: string;
  tags: string[];
  mastery: number; // 0-3
  source: string;
}

export interface WeekData {
  goals: Goals;
  days: {
    [date: string]: DayData;
  };
  knowledgeCards: KnowledgeCard[];
}

export interface AISettings {
  apiEndpoint: string;
  apiKey: string;
  model: string;
  systemPrompt: string;
}

export const DEFAULT_AI_SETTINGS: AISettings = {
  apiEndpoint: 'https://api.openai.com/v1/chat/completions',
  apiKey: '',
  model: 'gpt-4o',
  systemPrompt: '请将每日目标拆解为具体、可执行的任务。任务描述要简洁有力，使用动词开头。风格：务实、高效、有节奏感。',
};

export interface AppData {
  settings?: AISettings;
  weeks: {
    [weekKey: string]: WeekData;
  };
}

/* ===== Constants ===== */

export const STORAGE_KEY = 'weekly-planner-data';

export const DAY_NAMES = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
] as const;

export const DAY_LABELS: Record<string, string> = {
  Monday: '周一',
  Tuesday: '周二',
  Wednesday: '周三',
  Thursday: '周四',
  Friday: '周五',
};

export const DAY_SHORT: Record<string, string> = {
  Monday: '一',
  Tuesday: '二',
  Wednesday: '三',
  Thursday: '四',
  Friday: '五',
};

export const BLOCK_TYPE_LABELS: Record<BlockType, string> = {
  deep: '深度工作',
  buffer: '缓冲',
  break: '休息',
};

export const BLOCK_TYPE_COLORS: Record<BlockType, string> = {
  deep: '#7C3AED',
  buffer: '#F59E0B',
  break: '#10B981',
};

export const BLOCK_TYPE_BG: Record<BlockType, string> = {
  deep: '#EDE9FE',
  buffer: '#FEF3C7',
  break: '#D1FAE5',
};

/* ===== Helper Types ===== */

export interface TimeBudget {
  deep: number; // hours
  buffer: number;
  break: number;
}

export const DEFAULT_BUDGET: TimeBudget = {
  deep: 5,
  buffer: 2,
  break: 2,
};
