import { Goals, TimeBlock, TimeBudget, AISettings, KnowledgeCard, ChatMessage, DAY_NAMES } from '../types';
import { generateSchedule } from './aiSimulation';
import { recordUsage } from './tokenUsage';

/**
 * Extract JSON from LLM response, handling markdown code blocks.
 */
function extractJSON(text: string): string {
  // Try to extract from ```json ... ``` code block
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }
  // Try to find raw JSON object
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return jsonMatch[0];
  }
  return text.trim();
}

/**
 * Attempt to repair truncated JSON from LLM responses.
 * When the model hits max_tokens mid-output, the JSON is cut off.
 * This tries to close any open strings, objects, and arrays.
 */
function repairTruncatedJSON(json: string): string {
  let s = json.trim();

  // If it ends with a comma, remove it (trailing comma before truncation)
  s = s.replace(/,\s*$/, '');

  // If inside an unclosed string, close it
  let inString = false;
  let escapeNext = false;
  for (let i = 0; i < s.length; i++) {
    if (escapeNext) { escapeNext = false; continue; }
    if (s[i] === '\\') { escapeNext = true; continue; }
    if (s[i] === '"') inString = !inString;
  }
  if (inString) s += '"';

  // Count open brackets/braces and close them
  let braces = 0;
  let brackets = 0;
  inString = false;
  escapeNext = false;
  for (let i = 0; i < s.length; i++) {
    if (escapeNext) { escapeNext = false; continue; }
    if (s[i] === '\\') { escapeNext = true; continue; }
    if (s[i] === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (s[i] === '{') braces++;
    if (s[i] === '}') braces--;
    if (s[i] === '[') brackets++;
    if (s[i] === ']') brackets--;
  }
  for (let i = 0; i < braces; i++) s += '}';
  for (let i = 0; i < brackets; i++) s += ']';

  return s;
}

/**
 * Parse JSON with automatic repair for truncated LLM responses.
 */
function safeParseJSON(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    console.warn('[AI] JSON 解析失败，尝试修复截断的 JSON...');
    const repaired = repairTruncatedJSON(text);
    return JSON.parse(repaired);
  }
}

/**
 * Validate and normalize parsed blocks for a single day.
 * Fills in missing fields and ensures correct structure.
 */
function normalizeBlocks(raw: unknown[], dayName: string): TimeBlock[] {
  if (!Array.isArray(raw)) return [];

  return raw.map((value: unknown, idx: number) => {
    const item = value as Record<string, unknown>;
    return {
      id: typeof item.id === 'string' ? item.id : `${dayName}-${String(idx + 1).padStart(2, '0')}`,
      time: typeof item.time === 'string' ? item.time : '',
      type: item.type === 'deep' || item.type === 'buffer' || item.type === 'break' ? item.type : 'deep',
      task: typeof item.task === 'string' ? item.task : '待办任务',
      completed: false,
      note: '',
      modifications: [],
    };
  });
}

/**
 * Normalize API endpoint URL.
 * Handles common input patterns:
 *   "https://api.deepseek.com"                    → .../chat/completions
 *   "https://api.deepseek.com/v1"                 → .../v1/chat/completions
 *   "https://api.openai.com"                      → .../chat/completions
 *   "https://api.openai.com/v1/chat/completions"  → unchanged
 *   "https://dashscope.aliyuncs.com/compatible-mode/v1" → .../v1/chat/completions
 */
function normalizeEndpoint(endpoint: string): string {
  const url = endpoint.trim().replace(/\/+$/, '');
  if (url.endsWith('/chat/completions')) return url;
  if (url.endsWith('/v1')) return url + '/chat/completions';
  return url + '/chat/completions';
}

/**
 * Send a request through a proxy to avoid CORS.
 * Dev mode: Vite dev proxy (/llm-api)
 * Production: Vercel serverless function (/api/llm)
 */
async function proxyFetch(url: string, options: RequestInit): Promise<Response> {
  const proxyHeaders = new Headers(options.headers);
  proxyHeaders.set('X-Target-Url', url);

  if (import.meta.env.DEV) {
    // Dev: use Vite proxy
    return fetch('/llm-api', { ...options, headers: proxyHeaders });
  }
  // Production: use Vercel serverless function
  return fetch('/api/llm', { ...options, headers: proxyHeaders });
}

/**
 * Send a chat message to the LLM API and return the response text.
 * Used by both schedule generation and the settings chat test.
 */
export async function sendChatMessage(
  messages: Array<{ role: string; content: string }>,
  settings: AISettings
): Promise<string> {
  const url = normalizeEndpoint(settings.apiEndpoint);
  const response = await proxyFetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify({
      model: settings.model,
      messages,
      temperature: 0.7,
      max_tokens: 8192,
      stream: false,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  const message = data.choices?.[0]?.message;
  let content = message?.content || '';

  // Some reasoning models (mimo, deepseek-r1, etc.) put output in reasoning_content
  // when max_tokens is exhausted before the actual content is generated.
  if (!content && message?.reasoning_content) {
    console.warn('[AI] content 为空，尝试从 reasoning_content 提取 JSON');
    content = message.reasoning_content;
  }

  if (!content) {
    console.error('[AI] Empty response. Full API response:', JSON.stringify(data, null, 2));
    throw new Error(`API 返回为空，请检查模型名是否正确（当前：${settings.model}）。响应：${JSON.stringify(data).slice(0, 200)}`);
  }

  // Record token usage
  const usage = data.usage;
  if (usage) {
    recordUsage(
      usage.prompt_tokens || 0,
      usage.completion_tokens || 0,
      usage.total_tokens || 0
    );
  }

  return content;
}

/**
 * Build a focused system prompt for generating ONE day's schedule.
 * Much shorter than the weekly prompt — fits within reasoning model token limits.
 */
function buildDaySystemPrompt(settings: AISettings, budget: TimeBudget): string {
  return `你是日计划助手。生成一天的任务计划。

严格输出 JSON，无额外文字：
{"blocks":[{"id":"day-01","time":"10:00-11:00","type":"deep","task":"任务描述"},...]}

规则：
- 所有时间必须对齐到 :00 或 :30（半小时刻度），不允许出现 :10、:40、:50 等
- type: "deep"(60min) / "buffer"(30min) / "break"(30min)
- 时间 10:00→19:00 连续无间隙
- 午休 30min break 约 12:00-12:30
- deep 约${budget.deep}h, buffer 约${budget.buffer}h, break 约${budget.break}h
- task 用动词开头，具体可执行

${settings.systemPrompt}`;
}

/**
 * Build user prompt for a single day.
 */
function buildDayUserPrompt(dayLabel: string, dayGoal: string, budget: TimeBudget): string {
  return `今日目标（${dayLabel}）：${dayGoal || '待安排'}
时间预算：深度 ${budget.deep}h / 缓冲 ${budget.buffer}h / 休息 ${budget.break}h
生成今天的任务计划。`;
}

export interface ScheduleResult {
  schedule: Record<string, TimeBlock[]>;
  source: 'ai' | 'template';
  error?: string;
}

/**
 * Call a real LLM API (OpenAI-compatible) to generate the schedule.
 * Uses per-day API calls to stay within reasoning model token limits.
 * Falls back to local simulation if the API is not configured or fails.
 */
export async function generateScheduleWithAI(
  goals: Goals,
  budget: TimeBudget,
  settings: AISettings
): Promise<ScheduleResult> {
  // If no API key configured, fall back to simulation
  if (!settings.apiKey || !settings.apiEndpoint) {
    console.log('%c[AI] ⚠️ 未配置 API，使用本地模板生成', 'color: #F59E0B; font-weight: bold; font-size: 14px');
    return { schedule: await generateSchedule(goals, budget), source: 'template', error: '未配置 API Key 或 Endpoint' };
  }

  console.log('%c[AI] 🚀 逐天调用 API 生成计划...', 'color: #7C3AED; font-weight: bold; font-size: 14px');
  console.log('[AI] Endpoint:', normalizeEndpoint(settings.apiEndpoint));
  console.log('[AI] Model:', settings.model);

  const result: Record<string, TimeBlock[]> = {};
  const dayLabels: Record<string, string> = {
    Monday: '周一', Tuesday: '周二', Wednesday: '周三', Thursday: '周四', Friday: '周五',
  };
  const systemPrompt = buildDaySystemPrompt(settings, budget);

  // Skip days with empty goals — don't generate, don't touch existing data
  const daysToGenerate = DAY_NAMES.filter(day => goals[day]?.trim());
  const skippedDays = DAY_NAMES.filter(day => !goals[day]?.trim());
  if (skippedDays.length > 0) {
    console.log(`[AI] 跳过无目标的天: ${skippedDays.map(d => dayLabels[d]).join('、')}`);
  }

  for (const day of daysToGenerate) {
    const dayGoal = goals[day]!;
    const userPrompt = buildDayUserPrompt(dayLabels[day], dayGoal, budget);

    try {
      console.log(`[AI]   生成 ${dayLabels[day]}（${day}）...`);
      const content = await sendChatMessage(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        settings
      );

      const jsonStr = extractJSON(content);
      const parsed = safeParseJSON(jsonStr) as Record<string, unknown>;
      result[day] = normalizeBlocks((parsed.blocks || parsed[day] || []) as unknown[], day);

      const firstTask = result[day].find(b => b.type === 'deep')?.task || '(无)';
      console.log(`[AI]   ✅ ${day}: ${result[day].length} 段, 首任务: ${firstTask}`);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`[AI]   ❌ ${day} 生成失败:`, err);
      console.error('%c[AI] 回退到本地模板生成全部计划', 'color: #EF4444; font-weight: bold; font-size: 14px');
      return {
        schedule: await generateSchedule(goals, budget),
        source: 'template',
        error: `${dayLabels[day]}生成失败: ${errMsg}`,
      };
    }
  }

  console.log('%c[AI] ✅ 全部 5 天生成完成', 'color: #10B981; font-weight: bold; font-size: 14px');
  return { schedule: result, source: 'ai' };
}

/**
 * Call LLM API to generate a single day's schedule.
 * Used by the "每日安排" feature.
 */
export async function generateDayScheduleWithAI(
  dayGoal: string,
  dayLabel: string,
  budget: TimeBudget,
  settings: AISettings
): Promise<TimeBlock[]> {
  if (!settings.apiKey || !settings.apiEndpoint) {
    throw new Error('请先在设置中配置 API');
  }

  const systemPrompt = `你是一个专业的日计划助手。用户给出今天的目标和时间预算，请生成今天的小时级任务计划。

请严格按照以下 JSON 格式输出，不要添加任何额外文字：

{
  "blocks": [
    {"id": "day-01", "time": "10:00-10:50", "type": "deep", "task": "具体任务描述"},
    {"id": "day-02", "time": "10:50-11:00", "type": "break", "task": "休息"},
    {"id": "day-03", "time": "11:00-11:50", "type": "deep", "task": "具体任务描述"}
  ]
}

规则：
- type 可选值："deep"（深度工作）、"buffer"（缓冲/杂务）、"break"（休息）
- 时间从 10:00 开始，到 19:00 结束
- deep 任务每个 50 分钟，buffer 任务每个 40 分钟，break 休息 10-40 分钟
- 午休安排 40 分钟 break（时间大约在 12:00-12:40）
- deep 总时长约为 ${budget.deep} 小时
- buffer 总时长约为 ${budget.buffer} 小时
- break 总时长约为 ${budget.break} 小时
- task 描述要具体可执行，使用动词开头
- id 格式为 "day-序号"
- 确保时间从 10:00 连续排列到 19:00，不能有间隙或重叠

【风格要求】
${settings.systemPrompt}`;

  const userPrompt = `今日目标：${dayGoal}

时间预算：深度工作 ${budget.deep}h / 缓冲 ${budget.buffer}h / 休息 ${budget.break}h

请生成今天的任务计划，严格按 JSON 格式输出。`;

  try {
    const content = await sendChatMessage(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      settings
    );

    const jsonStr = extractJSON(content);
    const parsed = safeParseJSON(jsonStr) as Record<string, unknown>;
    return normalizeBlocks((parsed.blocks || []) as unknown[], 'day');
  } catch (err) {
    console.error('[AI] Day schedule generation failed:', err);
    throw err;
  }
}

/**
 * Test the API connection by sending a minimal request.
 * Returns { ok: true } or { ok: false, error: string }.
 */
export async function testApiConnection(
  settings: AISettings
): Promise<{ ok: boolean; error?: string }> {
  if (!settings.apiKey || !settings.apiEndpoint) {
    return { ok: false, error: '请先填写 API 地址和 Key' };
  }

  try {
    const content = await sendChatMessage(
      [{ role: 'user', content: 'Hello' }],
      settings
    );
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

/**
 * Use LLM to generate a knowledge card from a user's question.
 * Returns a concise Q&A card (question on front, reviewable answer on back).
 */
export async function generateKnowledgeCardWithAI(
  userQuestion: string,
  settings: AISettings
): Promise<KnowledgeCard> {
  if (!settings.apiKey || !settings.apiEndpoint) {
    throw new Error('请先在设置中配置 API');
  }

  const systemPrompt = `你是一个知识卡片生成助手。用户会提出一个问题，你需要生成一张用于复习的闪卡。

请严格按照以下 JSON 格式输出，不要添加任何额外文字：

{
  "question": "精炼后的问题（保持原意，可微调措辞使其更清晰）",
  "answer": "简洁、结构化的答案，适合快速复习，不超过200字",
  "tags": ["标签1", "标签2"]
}

答案要求：
- 用简短的要点或关键词组织，不要写长篇大论
- 重点突出，适合快速回忆和复述
- 如果涉及步骤，用编号列出关键步骤即可
- 如果涉及概念，给出一句话定义 + 核心要点`;

  try {
    const content = await sendChatMessage(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userQuestion },
      ],
      settings
    );

    const jsonStr = extractJSON(content);
    const parsed = safeParseJSON(jsonStr) as Record<string, unknown>;

    return {
      id: `kc-ai-${Date.now()}`,
      date: new Date().toISOString().slice(0, 10),
      question: typeof parsed.question === 'string' ? parsed.question : userQuestion,
      answer: typeof parsed.answer === 'string' ? parsed.answer : content,
      tags: Array.isArray(parsed.tags) ? parsed.tags : ['AI'],
      mastery: 0,
      source: 'AI 生成',
    };
  } catch (err) {
    console.error('[AI] Card generation failed:', err);
    throw err;
  }
}

/**
 * Send a follow-up chat message about a knowledge card.
 * Uses the card's Q&A as context and maintains conversation history.
 */
export async function sendCardChatMessage(
  card: KnowledgeCard,
  history: ChatMessage[],
  userMessage: string,
  settings: AISettings
): Promise<string> {
  if (!settings.apiKey || !settings.apiEndpoint) {
    throw new Error('请先在设置中配置 API');
  }

  const systemPrompt = `你是一个知识学习助手。用户正在复习以下知识卡片：

【问题】${card.question}
【答案】${card.answer}

基于这张卡片的内容，和用户进行深入讨论。要求：
- 回答简洁有深度，不超过150字
- 可以举例、类比、补充细节，但不要偏离主题
- 如果用户的问题超出卡片范围，简要回答并引导回来`;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: userMessage },
  ];

  return sendChatMessage(messages, settings);
}

/**
 * Generate a one-sentence summary of the chat discussion.
 */
export async function generateChatSummary(
  card: KnowledgeCard,
  history: ChatMessage[],
  settings: AISettings
): Promise<string> {
  if (!settings.apiKey || !settings.apiEndpoint) {
    return '';
  }

  const chatText = history
    .map((m) => `${m.role === 'user' ? '用户' : 'AI'}：${m.content}`)
    .join('\n');

  const summaryPrompt = `知识卡片「${card.question}」的讨论记录：
${chatText}

请用一句话总结这次讨论的核心收获（不超过50字）。只输出总结文字，不要任何前缀。`;

  try {
    return await sendChatMessage(
      [{ role: 'user', content: summaryPrompt }],
      settings
    );
  } catch {
    return '';
  }
}
