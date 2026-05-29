import {
  AppData,
  WeekData,
  Goals,
  DayData,
  HourlyCheckin,
  KnowledgeCard,
  AISettings,
  DEFAULT_AI_SETTINGS,
  STORAGE_KEY,
  DAY_NAMES,
} from '../types';
import {
  startOfWeek,
  getISOWeek,
  getISOWeekYear,
  format,
} from 'date-fns';
import { supabase } from '../lib/supabase';

/** Load the full app data from localStorage. */
export function loadData(): AppData {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return { weeks: {} };
  try {
    return JSON.parse(raw) as AppData;
  } catch {
    return { weeks: {} };
  }
}

/** Save the full app data to localStorage + trigger cloud sync. */
export function saveData(data: AppData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  syncToCloud();
}

/**
 * Compute a week key from any date within that week.
 * Uses ISO week numbering. The key looks like "2026-W21".
 */
export function getWeekKey(date: Date): string {
  const monday = startOfWeek(date, { weekStartsOn: 1 });
  const year = getISOWeekYear(monday);
  const week = getISOWeek(monday);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

/**
 * Get (or create) the WeekData for a given week key.
 * If the week doesn't exist yet, initialise it with empty goals and days.
 */
export function getOrCreateWeekData(weekKey: string): WeekData {
  const data = loadData();
  if (!data.weeks[weekKey]) {
    const goals: Goals = {};
    for (const day of DAY_NAMES) {
      goals[day] = '';
    }
    data.weeks[weekKey] = {
      goals,
      days: {},
      knowledgeCards: [],
    };
    saveData(data);
  }
  return data.weeks[weekKey];
}

/** Save goals for a given week. */
export function saveGoals(weekKey: string, goals: Goals): void {
  const data = loadData();
  if (!data.weeks[weekKey]) {
    data.weeks[weekKey] = {
      goals,
      days: {},
      knowledgeCards: [],
    };
  } else {
    data.weeks[weekKey].goals = goals;
  }
  saveData(data);
}

/** Save (or overwrite) the day blocks for a specific date. */
export function saveDayBlocks(
  weekKey: string,
  dateStr: string,
  dayData: DayData
): void {
  const data = loadData();
  if (!data.weeks[weekKey]) {
    data.weeks[weekKey] = {
      goals: {},
      days: {},
      knowledgeCards: [],
    };
  }
  data.weeks[weekKey].days[dateStr] = dayData;
  saveData(data);
}

/** Get day blocks for a specific date, or undefined. */
export function getDayBlocks(
  weekKey: string,
  dateStr: string
): DayData | undefined {
  const data = loadData();
  return data.weeks[weekKey]?.days[dateStr];
}

/** Get goals for a week. */
export function getGoals(weekKey: string): Goals {
  const data = loadData();
  const defaultGoals: Goals = {};
  for (const day of DAY_NAMES) {
    defaultGoals[day] = '';
  }
  return data.weeks[weekKey]?.goals ?? defaultGoals;
}

/** Add a knowledge card to a week. */
export function addKnowledgeCard(
  weekKey: string,
  card: KnowledgeCard
): void {
  const data = loadData();
  if (!data.weeks[weekKey]) {
    data.weeks[weekKey] = {
      goals: {},
      days: {},
      knowledgeCards: [],
    };
  }
  data.weeks[weekKey].knowledgeCards.push(card);
  saveData(data);
}

/** Update a knowledge card (e.g. mastery score). */
export function updateKnowledgeCard(
  weekKey: string,
  cardId: string,
  updates: Partial<KnowledgeCard>
): void {
  const data = loadData();
  const cards = data.weeks[weekKey]?.knowledgeCards;
  if (!cards) return;
  const idx = cards.findIndex((c) => c.id === cardId);
  if (idx >= 0) {
    cards[idx] = { ...cards[idx], ...updates };
    saveData(data);
  }
}

/** Get all knowledge cards across all weeks, optionally filtered. */
export function getAllKnowledgeCards(
  filters?: {
    dateFrom?: string;
    dateTo?: string;
    tags?: string[];
    search?: string;
  }
): KnowledgeCard[] {
  const data = loadData();
  const allCards: KnowledgeCard[] = [];
  for (const week of Object.values(data.weeks)) {
    allCards.push(...week.knowledgeCards);
  }

  if (!filters) return allCards;

  return allCards.filter((card) => {
    if (filters.dateFrom && card.date < filters.dateFrom) return false;
    if (filters.dateTo && card.date > filters.dateTo) return false;
    if (
      filters.tags &&
      filters.tags.length > 0 &&
      !card.tags.some((t) => filters.tags!.includes(t))
    )
      return false;
    if (filters.search) {
      const q = filters.search.toLowerCase();
      if (
        !card.question.toLowerCase().includes(q) &&
        !card.answer.toLowerCase().includes(q) &&
        !card.tags.some((t) => t.toLowerCase().includes(q))
      )
        return false;
    }
    return true;
  });
}

/** Load AI settings, returning defaults if not yet configured. */
export function loadSettings(): AISettings {
  const data = loadData();
  return { ...DEFAULT_AI_SETTINGS, ...data.settings };
}

/** Save AI settings. */
export function saveSettings(settings: AISettings): void {
  const data = loadData();
  data.settings = settings;
  saveData(data);
}

/** Save a single hourly checkin for a given day. */
export function saveCheckin(
  weekKey: string,
  dateStr: string,
  checkin: HourlyCheckin
): void {
  const data = loadData();
  if (!data.weeks[weekKey]) {
    data.weeks[weekKey] = { goals: {}, days: {}, knowledgeCards: [] };
  }
  if (!data.weeks[weekKey].days[dateStr]) {
    data.weeks[weekKey].days[dateStr] = { blocks: [] };
  }
  const day = data.weeks[weekKey].days[dateStr];
  if (!day.checkins) day.checkins = [];
  const idx = day.checkins.findIndex((c) => c.hour === checkin.hour);
  if (idx >= 0) {
    day.checkins[idx] = checkin;
  } else {
    day.checkins.push(checkin);
  }
  saveData(data);
}

/** Get checkins for a given day. */
export function getCheckins(
  weekKey: string,
  dateStr: string
): HourlyCheckin[] {
  const data = loadData();
  return data.weeks[weekKey]?.days[dateStr]?.checkins ?? [];
}

/* ===== Cloud Sync (Supabase) ===== */

let currentUserId: string | null = null;
let syncTimer: ReturnType<typeof setTimeout> | null = null;

/** Set the current user for cloud sync. Call this after login. */
export function setCurrentUser(userId: string | null): void {
  currentUserId = userId;
}

/** Pull data from Supabase into localStorage. */
export async function syncFromCloud(): Promise<void> {
  const client = supabase;
  const uid = currentUserId;
  if (!client || !uid) return;
  try {
    const { data, error } = await client
      .from('user_data')
      .select('value')
      .eq('user_id', uid)
      .eq('key', 'app_data')
      .single();

    if (error || !data) return;

    const cloudData = data.value as AppData;
    // Merge: cloud wins for overlapping weeks, keep local-only weeks
    const localData = loadData();
    const merged: AppData = {
      settings: cloudData.settings || localData.settings,
      weeks: { ...localData.weeks, ...cloudData.weeks },
    };
    saveDataLocal(merged);
  } catch (err) {
    console.error('[Sync] Failed to pull from cloud:', err);
  }
}

/** Push localStorage data to Supabase (debounced). */
export function syncToCloud(): void {
  const client = supabase;
  const uid = currentUserId;
  if (!client || !uid) return;
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(async () => {
    try {
      const data = loadData();
      const { error } = await client
        .from('user_data')
        .upsert(
          { user_id: uid, key: 'app_data', value: data },
          { onConflict: 'user_id,key' }
        );
      if (error) console.error('[Sync] Failed to push to cloud:', error);
    } catch (err) {
      console.error('[Sync] Failed to push to cloud:', err);
    }
  }, 1000); // debounce 1s
}

/** Save to localStorage only (no cloud sync). */
function saveDataLocal(data: AppData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

/** Check if user is authenticated. */
export async function getAuthUser(): Promise<{ id: string; email: string } | null> {
  const client = supabase;
  if (!client) return null;
  const { data: { user } } = await client.auth.getUser();
  if (!user) return null;
  return { id: user.id, email: user.email || '' };
}

/** Sign in with email + password. */
export async function signIn(email: string, password: string): Promise<{ error?: string }> {
  const client = supabase;
  if (!client) return { error: '未配置 Supabase' };
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };
  const { data: { user } } = await client.auth.getUser();
  if (user) {
    setCurrentUser(user.id);
    await syncFromCloud();
  }
  return {};
}

/** Sign up with email + password. */
export async function signUp(email: string, password: string): Promise<{ error?: string }> {
  const client = supabase;
  if (!client) return { error: '未配置 Supabase' };
  const { error } = await client.auth.signUp({ email, password });
  if (error) return { error: error.message };
  const { data: { user } } = await client.auth.getUser();
  if (user) {
    setCurrentUser(user.id);
    syncToCloud();
  }
  return {};
}

/** Sign out. */
export async function signOut(): Promise<void> {
  const client = supabase;
  if (!client) return;
  await client.auth.signOut();
  setCurrentUser(null);
}
