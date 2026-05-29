const STORAGE_KEY = 'token-usage-log';

export interface DailyUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  callCount: number;
}

export type UsageLog = Record<string, DailyUsage>; // "2026-05-29" → usage

function loadLog(): UsageLog {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveLog(log: UsageLog): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(log));
}

/** Record token usage from an API call. */
export function recordUsage(
  promptTokens: number,
  completionTokens: number,
  totalTokens: number
): void {
  const today = new Date().toISOString().slice(0, 10);
  const log = loadLog();
  if (!log[today]) {
    log[today] = { promptTokens: 0, completionTokens: 0, totalTokens: 0, callCount: 0 };
  }
  log[today].promptTokens += promptTokens;
  log[today].completionTokens += completionTokens;
  log[today].totalTokens += totalTokens;
  log[today].callCount += 1;
  saveLog(log);
}

/** Get usage log (all days). */
export function getUsageLog(): UsageLog {
  return loadLog();
}

/** Get usage for a specific date. */
export function getUsageForDate(date: string): DailyUsage {
  const log = loadLog();
  return log[date] || { promptTokens: 0, completionTokens: 0, totalTokens: 0, callCount: 0 };
}

/** Get total usage across all days. */
export function getTotalUsage(): DailyUsage {
  const log = loadLog();
  const total: DailyUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0, callCount: 0 };
  for (const day of Object.values(log)) {
    total.promptTokens += day.promptTokens;
    total.completionTokens += day.completionTokens;
    total.totalTokens += day.totalTokens;
    total.callCount += day.callCount;
  }
  return total;
}

/** Get last N days of usage for charting. */
export function getRecentUsage(days: number): Array<{ date: string } & DailyUsage> {
  const log = loadLog();
  const result: Array<{ date: string } & DailyUsage> = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const usage = log[dateStr] || { promptTokens: 0, completionTokens: 0, totalTokens: 0, callCount: 0 };
    result.push({ date: dateStr, ...usage });
  }
  return result;
}

/** Clear all usage data. */
export function clearUsage(): void {
  localStorage.removeItem(STORAGE_KEY);
}
