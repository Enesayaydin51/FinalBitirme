import { Alert } from "react-native";
import i18n from "../i18n";
import { displayText } from "./displayTranslations";

const STAGGER_MS = 480;

/**
 * Yeni kazanılan rozetler için sırayla tebrik Alert'i (API `newlyUnlocked` dizisi).
 * @param {Array<{ code?: string, title?: string, description?: string }>} items
 */
/**
 * API yanıtında `newlyUnlocked` varsa Alert gösterir.
 * GET /auth/achievements: { success, data: { newlyUnlocked } }
 * Kayıt uçları: { success, data: { ..., newlyUnlocked } } veya auth: { success, data, newlyUnlocked }
 */
export function showNotificationsIfNewlyUnlocked(res) {
  const list = res?.data?.newlyUnlocked ?? res?.newlyUnlocked;
  if (res?.success && Array.isArray(list) && list.length > 0) {
    showNewAchievementAlerts(list);
  }
}

export function showNewAchievementAlerts(items) {
  if (!Array.isArray(items) || items.length === 0) return;

  items.forEach((item, index) => {
    const language = i18n.language;
    const title = displayText(item?.title || item?.code || (language === "en" ? "Badge" : "Rozet"), language);
    const extra = item?.description ? `\n\n${displayText(item.description, language)}` : "";
    setTimeout(() => {
      Alert.alert(
        language === "en" ? "Congratulations!" : "Tebrikler!",
        language === "en" ? `You earned the “${title}” badge.${extra}` : `“${title}” rozetini kazandın.${extra}`,
        [{ text: language === "en" ? "Great!" : "Harika!" }],
        { cancelable: true }
      );
    }, index * STAGGER_MS);
  });
}

/**
 * GET /auth/achievements sonrası yeni rozet varsa bildirim gösterir.
 */
export async function fetchAchievementsAndShowNotifications(apiService) {
  try {
    const res = await apiService.getAchievements();
    showNotificationsIfNewlyUnlocked(res);
    return res;
  } catch {
    return null;
  }
}
