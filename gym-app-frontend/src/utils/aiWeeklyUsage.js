import AsyncStorage from "@react-native-async-storage/async-storage";

export const AI_WEEKLY_FEATURES = {
  NUTRITION_QUESTION: "nutrition_question",
  NUTRITION_PLAN: "nutrition_plan",
  FOOD_SUGGESTIONS: "food_suggestions",
  EXERCISE_PROGRAM: "exercise_program",
  PLATE_ANALYZE: "plate_analyze",
  FORM_SCORE: "form_score",
};

const FREE_WEEKLY_AI_LIMIT = 1;

function getWeekKey(date = new Date()) {
  const start = new Date(date);
  const day = start.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + diff);
  start.setHours(0, 0, 0, 0);
  return start.toISOString().slice(0, 10);
}

function getStorageKey(userKey, featureKey) {
  return `aiWeeklyUsage:${userKey || "anonymous"}:${featureKey}`;
}

export async function getFreeWeeklyAiUsageStatus({ userKey, featureKey, isPro }) {
  if (isPro) return { allowed: true, remaining: Infinity, used: 0 };

  const raw = await AsyncStorage.getItem(getStorageKey(userKey, featureKey));
  const currentWeek = getWeekKey();
  let used = 0;

  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      used = parsed?.weekKey === currentWeek ? Number(parsed.used || 0) : 0;
    } catch {
      used = 0;
    }
  }

  const remaining = Math.max(0, FREE_WEEKLY_AI_LIMIT - used);
  return { allowed: remaining > 0, remaining, used };
}

export async function markFreeWeeklyAiUsage({ userKey, featureKey, isPro }) {
  if (isPro) return;
  const currentWeek = getWeekKey();
  const key = getStorageKey(userKey, featureKey);
  const raw = await AsyncStorage.getItem(key);
  let used = 0;

  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      used = parsed?.weekKey === currentWeek ? Number(parsed.used || 0) : 0;
    } catch {
      used = 0;
    }
  }

  await AsyncStorage.setItem(key, JSON.stringify({ weekKey: currentWeek, used: used + 1 }));
}
