import { Goals, TimeBlock, TimeBudget, AISettings, KnowledgeCard, DAY_NAMES } from '../types';
import { generateSchedule } from './aiSimulation';

/**
 * Build the system prompt that instructs the LLM to return structured JSON.
 */
function buildSystemPrompt(settings: AISettings, budget: TimeBudget): string {
  return `你是一个专业的周计划助手。用户会给出周一到周五的每日目标和时间预算。

请严格按照以下 JSON 格式输出，不要添加任何额外文字、解释或 markdown 标记：

{
  "Monday": [
    {"id": "Monday-01", "time": "10:00-10:50", "type": "deep", "task": "具体任务描述"},
    {"id": "Monday-02", "time": "10:50-11:00", "type": "break", "task": "休息"},
    {"id": "Monday-03", "time": "11:00-11:50", "type": "deep", "task": "具体任务描述"}
  ],
  "Tuesday": [...],
  "Wednesday": [...],
  "Thursday": [...],
  "Friday": [...]
}

规则：
- type 可选值："deep"（深度工作）、"buffer"（缓冲/杂务）、"break"（休息）
- 时间从 10:00 开始，到 19:00 结束
- deep 任务每个 50 分钟，buffer 任务每个 40 分钟，break 休息 10-40 分钟
- 午休安排 40 分钟 break（时间大约在 12:00-12:40）
- 每天 deep 总时长约为 ${budget.deep} 小时
- 每天 buffer 总时长约为 ${budget.buffer} 小时
- 每天 break 总时长约为 ${budget.break} 小时
- task 描述要具体可执行，使用动词开头
- id 格式为 "星期-序号"，如 Monday-01, Tuesday-03
- 每天的 block 数量根据时间预算动态计算
- 确保每天时间从 10:00 连续排列到 19:00，时间不能有间隙或重叠

【风格要求】
${settings.systemPrompt}`;
}

/**
 * Build the user prompt with goals and budget.
 */
function buildUserPrompt(goals: Goals, budget: TimeBudget): string {
  const lines = DAY_NAMES.map((day) => {
    const label =
      day === 'Monday' ? '周一' :
      day === 'Tuesday' ? '周二' :
      day === 'Wednesday' ? '周三' :
      day === 'Thursday' ? '周四' : '周五';
    return `- ${label}（${day}）：${goals[day] || '待安排'}`;
  });

  return `本周每日目标：
${lines.join('\n')}

时间预算：深度工作 ${budget.deep}h / 缓冲 ${budget.buffer}h / 休息 ${budget.break}h

请生成本周的每日任务计划，严格按 JSON 格式输出。`;
}

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
 *   "https://api.deepseek.com"              → .../v1/chat/completions
 *   "https://api.deepseek.com/v1"           → .../v1/chat/completions
 *   "https://api.deepseek.com/v1/chat/completions" → unchanged
 */
function normalizeEndpoint(endpoint: string): string {
  const url = endpoint.trim().replace(/\/+$/, '');
  if (url.endsWith('/v1/chat/completions')) return url;
  if (url.endsWith('/chat/completions')) return url;
  if (url.endsWith('/v1')) return url + '/chat/completions';
  if (url.endsWith('/completions')) return url;
  return url + '/v1/chat/completions';
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
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('Empty response from API');
  return content;
}

/**
 * Call a real LLM API (OpenAI-compatible) to generate the schedule.
 * Falls back to local simulation if the API is not configured or fails.
 */
export async function generateScheduleWithAI(
  goals: Goals,
  budget: TimeBudget,
  settings: AISettings
): Promise<Record<string, TimeBlock[]>> {
  // If no API key configured, fall back to simulation
  if (!settings.apiKey || !settings.apiEndpoint) {
    console.log('[AI] No API configured, using local simulation');
    return generateSchedule(goals, budget);
  }

  const systemPrompt = buildSystemPrompt(settings, budget);
  const userPrompt = buildUserPrompt(goals, budget);

  try {
    const content = await sendChatMessage(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      settings
    );

    // Parse JSON from response
    const jsonStr = extractJSON(content);
    const parsed = JSON.parse(jsonStr);

    // Normalize each day's blocks
    const result: Record<string, TimeBlock[]> = {};
    for (const day of DAY_NAMES) {
      result[day] = normalizeBlocks(parsed[day] || [], day);
    }

    return result;
  } catch (err) {
    console.error('[AI] API call failed, falling back to simulation:', err);
    return generateSchedule(goals, budget);
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
    const parsed = JSON.parse(jsonStr);

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
