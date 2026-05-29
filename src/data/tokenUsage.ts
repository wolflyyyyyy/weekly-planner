import { supabase } from '../lib/supabase';

const STORAGE_KEY = 'token-usage-log';

export interface DailyUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  callCount: number;
}

export type UsageLog = Record<string, DailyUsage>; // "2026-05-29" → usage

let currentUserId: string | null = null;
let syncTimer: ReturnType<typeof setTimeout> | null = null;

export function setUsageUserId(userId: string | null): void {
  currentUserId = userId;
}

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
  syncUsageToCloud();
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

/** Pull token usage from Supabase (merge with local). */
export async function syncUsageFromCloud(): Promise<void> {
  const client = supabase;
  const uid = currentUserId;
  if (!client || !uid) return;
  try {
    const { data, error } = await client
      .from('user_data')
      .select('value')
      .eq('user_id', uid)
      .eq('key', 'token_usage')
      .single();

    if (error || !data) return;

    const cloudLog = data.value as UsageLog;
    const localLog = loadLog();

    // Merge: sum up both (avoid double counting same day)
    const merged: UsageLog = { ...localLog };
    for (const [date, cloudDay] of Object.entries(cloudLog)) {
      if (!merged[date]) {
        merged[date] = { ...cloudDay };
      } else {
        // If both have data for same day, take the larger total
        // (avoids double-counting from overlapping syncs)
        if (cloudDay.totalTokens > merged[date].totalTokens) {
          merged[date] = { ...cloudDay };
        }
      }
    }
    saveLog(merged);
  } catch (err) {
    console.error('[TokenSync] Failed to pull from cloud:', err);
  }
}

/** Push token usage to Supabase (debounced). */
function syncUsageToCloud(): void {
  const client = supabase;
  const uid = currentUserId;
  if (!client || !uid) return;
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(async () => {
    try {
      const log = loadLog();
      const { error } = await client
        .from('user_data')
        .upsert(
          { user_id: uid, key: 'token_usage', value: log },
          { onConflict: 'user_id,key' }
        );
      if (error) console.error('[TokenSync] Failed to push to cloud:', error);
    } catch (err) {
      console.error('[TokenSync] Failed to push to cloud:', err);
    }
  }, 1000);
}
