import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  StyleSheet,
  Text,
  View,
  Image,
  ScrollView,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
  Dimensions,
  Platform,
  KeyboardAvoidingView,
  Animated // Animated API eklendi
} from "react-native";
import { LinearGradient } from "expo-linear-gradient"; 
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import * as FileSystemLegacy from "expo-file-system/legacy";

import Layout from "../components/Layout";
import apiService from "../services/api";
import { normalizeNutritionPlan, updateMealLineQuantity } from "../utils/nutritionPlanUtils";
import { showNotificationsIfNewlyUnlocked } from "../utils/achievementNotifications";
import { useSelector, useDispatch } from "react-redux";
import { useNavigation } from "@react-navigation/native";
import { setUserDetails } from "../redux/userSlice";
import { useTheme } from "../theme/ThemeContext";
import { useTranslation } from "react-i18next";
import { getGoalLabel } from "../utils/profileOptions";
import { displayDay, displayDayShort, displayText } from "../utils/displayTranslations";
import { getContentLocale, needsContentTranslation, normalizeLocale } from "../utils/aiLocale";
import { useFocusEffect } from "@react-navigation/native";

import WaterWeeklyCard from "../components/WaterWeeklyCard";

import {
  addWaterMl,
  getGoalMl,
  getTodayMl,
  getWeekStatus,
  getStreak,
  resetToday,
  setGoalMl as setGoalMlStorage,
} from "../storage/waterStorage";

const { width } = Dimensions.get("window");

// --- ANIMASYON HESAPLAMALARI ---
const TAB_CONTAINER_WIDTH = width - 40;
const TAB_WIDTH = TAB_CONTAINER_WIDTH / 3;

const MAX_PLATE_IMAGE_SIZE_MB = 8;
const MAX_PLATE_IMAGE_SIZE_BYTES = MAX_PLATE_IMAGE_SIZE_MB * 1024 * 1024;

function getDietCommonStyles(COLORS) {
  return StyleSheet.create({
    shadowLight: {
      ...Platform.select({
        ios: {
          shadowColor: COLORS.shadow,
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.05,
          shadowRadius: 12,
        },
        android: {
          elevation: 3,
        },
      }),
    },
    shadowPremium: {
      ...Platform.select({
        ios: {
          shadowColor: COLORS.primary,
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.25,
          shadowRadius: 12,
        },
        android: {
          elevation: 6,
        },
      }),
    },
  });
}

function MealLineEditor({ item, dayKey, mealIndex, itemIndex, setPlan, bulletColor, styles }) {
  const { t, i18n } = useTranslation();
  const isStr = typeof item === "string";
  const name = isStr ? item : item?.name ?? "";
  const unit = !isStr && item?.unit ? String(item.unit) : "";
  const calories =
    !isStr && item?.calories != null ? Math.max(0, Math.round(Number(item.calories))) : null;
  const qty = !isStr && item?.quantity != null ? item.quantity : 1;

  const [qtyText, setQtyText] = useState(() => String(qty));
  useEffect(() => {
    setQtyText(String(qty));
  }, [qty, name]);

  if (isStr) {
    return (
      <View style={styles.aiMealBulletRow}>
        <Ionicons name="ellipse" size={5} color={bulletColor} style={{ marginRight: 8, marginTop: 6 }} />
        <Text style={styles.planMealFood}>{displayText(item, i18n.language)}</Text>
      </View>
    );
  }

  return (
    <View style={styles.aiMealBulletRow}>
      <Ionicons name="ellipse" size={5} color={bulletColor} style={{ marginRight: 8, marginTop: 6 }} />
      <View style={{ flex: 1 }}>
        <Text style={styles.planMealFood}>{displayText(name, i18n.language)}</Text>
        <View style={styles.mealItemEditRow}>
          <Text style={styles.mealItemMiniLabel}>{t("diet.amount", { defaultValue: "Miktar" })}</Text>
          <TextInput
            style={styles.mealQtyInput}
            value={qtyText}
            keyboardType="decimal-pad"
            onChangeText={(t) => {
              const cleaned = t.replace(/[^0-9.,]/g, "");
              setQtyText(cleaned);
              const q = parseFloat(String(cleaned).replace(",", "."));
              if (Number.isFinite(q) && q >= 0) {
                setPlan((prev) => {
                  if (!prev) return prev;
                  return updateMealLineQuantity(prev, dayKey, mealIndex, itemIndex, cleaned);
                });
              }
            }}
            onBlur={() => {
              const q = parseFloat(String(qtyText).replace(",", "."));
              if (!Number.isFinite(q) || q < 0) {
                setQtyText(String(qty));
              }
            }}
          />
          {unit ? <Text style={styles.mealItemUnit}>{displayText(unit, i18n.language)}</Text> : null}
          <Text style={styles.mealItemKcal}>{calories != null ? `${calories} kcal` : "—"}</Text>
        </View>
      </View>
    </View>
  );
}

const DietPage = () => {
  const { colors: themeColors } = useTheme();
  const { t, i18n } = useTranslation();
  const COLORS = useMemo(
    () => ({
      bg: themeColors.dietBg,
      white: themeColors.white,
      textDark: themeColors.dietTextDark,
      textMain: themeColors.dietTextMain,
      textLight: themeColors.dietTextLight,
      border: themeColors.dietBorder,
      primary: themeColors.dietPrimary,
      primaryDark: themeColors.dietPrimaryDark,
      primaryLight: themeColors.dietPrimaryLight,
      secondary: themeColors.dietSecondary,
      secondaryLight: themeColors.dietSecondaryLight,
      accent: themeColors.dietAccent,
      accentLight: themeColors.dietAccentLight,
      purple: themeColors.dietPurple,
      purpleLight: themeColors.dietPurpleLight,
      redish: themeColors.dietRedish,
      shadow: themeColors.dietShadow,
    }),
    [themeColors]
  );
  const styles = useMemo(() => createDietPageStyles(COLORS), [COLORS]);
  const COMMON_STYLES = useMemo(() => getDietCommonStyles(COLORS), [COLORS]);

  const dispatch = useDispatch();
  const navigation = useNavigation();
  const { userDetails, user } = useSelector((state) => state.user);
  const isPro = !!(user?.isPro ?? userDetails?.isPro);
  const userId = user?.id ?? user?.email ?? null;
  
  const [activeTab, setActiveTab] = useState("Önerilen"); // "Önerilen", "Kendi", "AI"
  const [aiMode, setAiMode] = useState("chat"); 
  
  // 🎬 KAYMA ANİMASYONU STATE'İ
  const slideAnim = useRef(new Animated.Value(0)).current;

  // --- SU TAKİBİ STATE & MANTIĞI ---
  const [showWaterTracker, setShowWaterTracker] = useState(false); // Açılır/kapanır durumu için
  const [waterLoading, setWaterLoading] = useState(true);
  const [waterGoal, setWaterGoalState] = useState(2500);
  const [todayMl, setTodayMl] = useState(0);
  const [week, setWeek] = useState(null);
  const [streak, setStreakState] = useState(0);

  const refreshWater = useCallback(async () => {
    if (!userId) {
      setWaterLoading(false);
      return;
    }
    setWaterLoading(true);
    try {
      const [g, t, w, s] = await Promise.all([
        getGoalMl(userId),
        getTodayMl(userId),
        getWeekStatus(userId),
        getStreak(userId),
      ]);
      setWaterGoalState(g);
      setTodayMl(t);
      setWeek(w);
      setStreakState(s);
    } finally {
      setWaterLoading(false);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      refreshWater();
    }, [refreshWater])
  );

  const addWater = async (ml) => {
    if (!userId) return;
    const next = await addWaterMl(ml, userId);
    setTodayMl(next);
    const [w, s] = await Promise.all([getWeekStatus(userId), getStreak(userId)]);
    setWeek(w);
    setStreakState(s);
  };

  const resetWater = async () => {
    if (!userId) return;
    await resetToday(userId);
    setTodayMl(0);
    const [w, s] = await Promise.all([getWeekStatus(userId), getStreak(userId)]);
    setWeek(w);
    setStreakState(s);
  };

  const saveWaterGoal = async (ml) => {
    if (!userId) return 2500;
    const g = await setGoalMlStorage(ml, userId);
    setWaterGoalState(g);
    const [w, s] = await Promise.all([getWeekStatus(userId), getStreak(userId)]);
    setWeek(w);
    setStreakState(s);
  };

  const progress = waterGoal > 0 ? Math.min(1, todayMl / waterGoal) : 0;
  const goalMl = waterGoal;
  const add = addWater;
  const reset = resetWater;
  const setGoalMl = saveWaterGoal;
  // --- SU TAKİBİ SONU ---

  useEffect(() => {
    let toValue = 0;
    if (activeTab === "Kendi") toValue = TAB_WIDTH;
    if (activeTab === "AI") toValue = TAB_WIDTH * 2;

    Animated.spring(slideAnim, {
      toValue,
      tension: 60,
      friction: 10,
      useNativeDriver: true,
    }).start();
  }, [activeTab]);

  const getIndicatorColor = () => {
    if (activeTab === "Önerilen") return COLORS.primary;
    if (activeTab === "Kendi") return COLORS.secondary;
    if (activeTab === "AI") return COLORS.purple;
    return COLORS.primary;
  };

  const goal = userDetails?.goal || "Kilo Verme";
  const goalDisplayLabel = getGoalLabel(t, goal);

  useEffect(() => {
    const loadUserDetails = async () => {
      if (!userDetails) {
        try {
          const response = await apiService.getUserDetails();
          if (response.success && response.data) {
            dispatch(setUserDetails(response.data));
          }
        } catch (error) {
          console.warn("User details yüklenemedi:", error);
        }
      }
    };
    loadUserDetails();
  }, []);
    
  const [platePortion, setPlatePortion] = useState("orta"); 
  const [plateLoading, setPlateLoading] = useState(false);
  const [platePreviewUri, setPlatePreviewUri] = useState(null);
  const [plateResult, setPlateResult] = useState(null);
  const [plateError, setPlateError] = useState(null);

  const [aiQuestion, setAiQuestion] = useState("");
  const [aiAnswer, setAiAnswer] = useState("");
  const [aiAnswerLocale, setAiAnswerLocale] = useState(null);
  const [aiError, setAiError] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiPlan, setAiPlan] = useState(null);
  const [aiPlanLoading, setAiPlanLoading] = useState(false);
  const [aiSelectedDay, setAiSelectedDay] = useState('Pazartesi');

  const [menuDetailPlanData, setMenuDetailPlanData] = useState(null);
  const skipNextMenuLoadRef = useRef(false);

  const aiPlanSummary = aiPlan?.summary;
  const aiPlanWeek = aiPlan?.week;
  const AI_WEEK_DAYS = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];

  const [savedNutritionPlans, setSavedNutritionPlans] = useState([]);
  const [savedNutritionPlansLoading, setSavedNutritionPlansLoading] = useState(false);
  const [aiSavePlanLoading, setAiSavePlanLoading] = useState(false);
  const [selectedSavedPlanId, setSelectedSavedPlanId] = useState(null);
  const nutritionTranslationRef = useRef(new Set());
  const [mealSaveLoadingKey, setMealSaveLoadingKey] = useState(null);
  const [dietNewPlanName, setDietNewPlanName] = useState("");
  const [dietMenuPlanNameEdit, setDietMenuPlanNameEdit] = useState("");
  const [dietPlanNameSaving, setDietPlanNameSaving] = useState(false);

  const getDefaultNutritionPlanTitle = () => {
    const locale = normalizeLocale(i18n.language);
    const dateLocale = locale === "en" ? "en-US" : "tr-TR";
    return `${getGoalLabel(t, goal)} - ${t("diet.weeklyPlan")} (${new Date().toLocaleDateString(dateLocale)})`;
  };

  useEffect(() => {
    if (!selectedSavedPlanId) {
      setDietMenuPlanNameEdit("");
      return;
    }
    const p = savedNutritionPlans.find((x) => x?.id === selectedSavedPlanId);
    if (p) setDietMenuPlanNameEdit(p.planName || "");
  }, [selectedSavedPlanId, savedNutritionPlans]);

  const formatDateTimeTR = (value) => {
    try {
      if (!value) return '-';
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return '-';
      return d.toLocaleString('tr-TR');
    } catch {
      return '-';
    }
  };

  const normalizePlanData = (planData) => {
    if (!planData) return null;
    if (typeof planData === 'string') {
      try {
        return JSON.parse(planData);
      } catch {
        return null;
      }
    }
    return planData;
  };

  const normalizeFullNutritionPlan = (raw) => {
    const p = normalizePlanData(raw) ?? (raw && typeof raw === 'object' ? raw : null);
    if (!p?.week) return p;
    return normalizeNutritionPlan(p);
  };

  const selectedSavedPlan = savedNutritionPlans.find((p) => p?.id === selectedSavedPlanId);
  const selectedSavedPlanData =
    normalizePlanData(selectedSavedPlan?.planData) || selectedSavedPlan?.planData || null;
  const selectedSavedPlanSummary = selectedSavedPlanData?.summary;
  const selectedSavedPlanWeek = selectedSavedPlanData?.week;
  const selectedSavedPlanMealsForDay =
    selectedSavedPlanWeek?.[aiSelectedDay]?.meals || [];

  const menuDetailPlanSummary = menuDetailPlanData?.summary;
  const menuDetailPlanWeek = menuDetailPlanData?.week;
  const menuDetailMealsForDay =
    menuDetailPlanWeek?.[aiSelectedDay]?.meals || [];

  const translateNutritionPlanIfNeeded = async (planData, sourceHint) => {
    const targetLocale = normalizeLocale(i18n.language);
    if (!needsContentTranslation(planData, targetLocale)) return planData;
    const sourceLocale = getContentLocale(planData);
    const cacheKey = `${sourceHint || "nutrition"}-${sourceLocale}-${targetLocale}-${JSON.stringify(planData).length}`;
    if (nutritionTranslationRef.current.has(cacheKey)) return planData;
    nutritionTranslationRef.current.add(cacheKey);
    try {
      const resp = await apiService.translateAIContent(planData, "nutrition-plan", targetLocale, sourceLocale);
      if (resp?.success && resp.data) return normalizeFullNutritionPlan(resp.data) || resp.data;
    } catch (error) {
      console.warn("Nutrition plan translation failed:", error?.message || error);
    } finally {
      nutritionTranslationRef.current.delete(cacheKey);
    }
    return planData;
  };

  useEffect(() => {
    let cancelled = false;
    const translateVisiblePlans = async () => {
      const targetLocale = normalizeLocale(i18n.language);
      if (menuDetailPlanData && needsContentTranslation(menuDetailPlanData, targetLocale)) {
        const translated = await translateNutritionPlanIfNeeded(menuDetailPlanData, `menu-${selectedSavedPlanId || "draft"}`);
        if (!cancelled && translated !== menuDetailPlanData) setMenuDetailPlanData(translated);
      }
      if (aiPlan && needsContentTranslation(aiPlan, targetLocale)) {
        const translated = await translateNutritionPlanIfNeeded(aiPlan, "ai-draft");
        if (!cancelled && translated !== aiPlan) setAiPlan(translated);
      }
    };
    translateVisiblePlans();
    return () => {
      cancelled = true;
    };
  }, [i18n.language, selectedSavedPlanId, menuDetailPlanData?.locale, aiPlan?.locale]);

  useEffect(() => {
    let cancelled = false;
    const translatePlateResult = async () => {
      const targetLocale = normalizeLocale(i18n.language);
      if (!plateResult || !needsContentTranslation(plateResult, targetLocale)) return;
      try {
        const resp = await apiService.translateAIContent(
          plateResult,
          "plate-analysis",
          targetLocale,
          getContentLocale(plateResult)
        );
        if (!cancelled && resp?.success && resp.data) setPlateResult(resp.data);
      } catch (error) {
        console.warn("Plate result translation failed:", error?.message || error);
      }
    };
    translatePlateResult();
    return () => {
      cancelled = true;
    };
  }, [i18n.language, plateResult?.locale]);

  const dietPlans = {
    "Kilo Verme": {
      calories: 1800, protein: "150g", carb: "150g", fat: "50g",
      meals: [
        { title: "Kahvaltı", items: ["2 yumurta", "1 dilim tam buğday ekmeği"] },
        { title: "Öğle", items: ["150g tavuk göğsü", "Bol salata"] },
        { title: "Akşam", items: ["200g balık", "Sebze çorbası"] },
      ],
    },
    "Kilo Alma": {
      calories: 2800, protein: "160g", carb: "350g", fat: "90g",
      meals: [
        { title: "Kahvaltı", items: ["3 yumurta", "100g yulaf", "1 muz"] },
        { title: "Öğle", items: ["200g kırmızı et", "1 tabak pilav"] },
        { title: "Akşam", items: ["200g tavuk", "1 porsiyon makarna"] },
      ],
    },
    "Kilo Koruma": {
      calories: 2200, protein: "140g", carb: "200g", fat: "70g",
      meals: [
        { title: "Kahvaltı", items: ["2 yumurta", "1 bardak süt"] },
        { title: "Öğle", items: ["150g tavuk", "1 tabak bulgur"] },
        { title: "Akşam", items: ["150g balık", "Sebze çorbası"] },
      ],
    },
  };

  const plan = dietPlans[goal] || dietPlans["Kilo Koruma"];

  const pickPlatePhotoAndAnalyze = async () => {
    if (!isPro) {
      Alert.alert(
        t("diet.proFeature"),
        t("diet.platePaywall"),
        [
          { text: t("common.cancel"), style: "cancel" },
          { text: t("tabs.profile"), onPress: () => navigation.navigate("Profile") },
        ]
      );
      return;
    }

    setPlateError(null);
    setPlateResult(null);
    setPlatePreviewUri(null);
    setPlateLoading(true);

    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(t("common.permissionRequired"), t("diet.cameraPermission"));
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.75,
      });

      if (result.canceled || !result.assets?.[0]?.uri) return;

      const uri = result.assets[0].uri;
      setPlatePreviewUri(uri);

      let fileSize = 0;
      try {
        const info = await FileSystemLegacy.getInfoAsync(uri, { size: true });
        fileSize = info?.size ?? 0;
      } catch (_) {}

      if (fileSize > MAX_PLATE_IMAGE_SIZE_BYTES) {
        Alert.alert(
          t("common.tooLargeImage"),
          t("common.chooseSmallerImage", { size: MAX_PLATE_IMAGE_SIZE_MB })
        );
        return;
      }

      let imageBase64;
      try {
        const file = new File(uri);
        imageBase64 = await file.base64();
      } catch (_) {
        imageBase64 = await FileSystemLegacy.readAsStringAsync(uri, {
          encoding: FileSystemLegacy.EncodingType?.Base64 ?? "base64",
        });
      }

      const lower = uri.toLowerCase();
      const mimeType = lower.endsWith(".png") ? "image/png" : "image/jpeg";

      const res = await apiService.analyzePlatePhoto(imageBase64, mimeType, platePortion, normalizeLocale(i18n.language));
      if (res?.success && res?.data) {
        setPlateResult(res.data);
      } else {
        setPlateError(displayText(res?.message || t("diet.couldNotAnalyzePlate"), i18n.language));
      }
    } catch (e) {
      setPlateError(displayText(e?.message || t("diet.plateAnalyzeFailed"), i18n.language));
    } finally {
      setPlateLoading(false);
    }
  };

  const askAI = async () => {
    if (!aiQuestion.trim()) {
      Alert.alert(t("common.error"), t("diet.questionRequired"));
      return;
    }
    setAiError("");
    setAiLoading(true);
    try {
      const response = await apiService.askNutritionQuestion(aiQuestion, normalizeLocale(i18n.language));
      if (response.success) {
        const answerText = String(response?.data?.answer || "").trim();
        setAiAnswer(answerText);
        setAiAnswerLocale(normalizeLocale(response?.data?.locale || i18n.language));
        setAiQuestion("");
        setAiError("");
        if (!answerText) {
          setAiError(t("diet.assistantEmpty"));
        }
      } else {
        const message = displayText(response.message || t("common.operationFailed"), i18n.language);
        setAiError(message);
        Alert.alert(t("common.error"), message);
      }
    } catch (error) {
      console.error("AI Error:", error);
      const message = displayText(error?.message || t("diet.assistantFailed"), i18n.language);
      setAiError(message);
      Alert.alert(t("common.error"), message);
    } finally {
      setAiLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const translateAnswer = async () => {
      const targetLocale = normalizeLocale(i18n.language);
      const sourceLocale = normalizeLocale(aiAnswerLocale || "tr");
      if (!aiAnswer || sourceLocale === targetLocale) return;
      try {
        const resp = await apiService.translateAIContent({ answer: aiAnswer }, "nutrition-answer", targetLocale, sourceLocale);
        const translated = resp?.data?.answer;
        if (!cancelled && typeof translated === "string") {
          setAiAnswer(translated);
          setAiAnswerLocale(targetLocale);
        }
      } catch (error) {
        console.warn("Nutrition answer translation failed:", error?.message || error);
      }
    };
    translateAnswer();
    return () => {
      cancelled = true;
    };
  }, [i18n.language, aiAnswerLocale, aiAnswer]);

  const generateAIPlan = async () => {
    setAiPlanLoading(true);
    try {
      let currentUserDetails = userDetails;
      if (!currentUserDetails) {
         try {
             const resp = await apiService.getUserDetails();
             if(resp.success) currentUserDetails = resp.data;
         } catch(e) {}
      }

      const hasRequiredInfo = currentUserDetails && (currentUserDetails.goal || currentUserDetails.height || currentUserDetails.weight);
      if (!hasRequiredInfo) {
        Alert.alert(t("common.missingInfo"), t("diet.updateProfileFirst"));
        setAiPlanLoading(false);
        return;
      }

      const response = await apiService.generateAIPlan(normalizeLocale(i18n.language));
      if (response.success) {
        const planData = response.data?.data ?? response.data;
        const shapedPlan = normalizeFullNutritionPlan(planData);
        setAiPlan(shapedPlan);
        setAiSelectedDay('Pazartesi');

        const planName = dietNewPlanName.trim() || getDefaultNutritionPlanTitle();
        const saveResp = await apiService.saveNutritionPlan(shapedPlan ?? planData, planName);

        if (saveResp?.success) {
          const savedId = saveResp.data?.id ?? saveResp.id ?? null;
          setDietNewPlanName("");
          const savedTitle = saveResp.data?.planName || planName;
          setDietMenuPlanNameEdit(savedTitle);
          setSelectedSavedPlanId(savedId);
          setMenuDetailPlanData(
            normalizeFullNutritionPlan(saveResp.data?.planData) || shapedPlan || planData
          );
          showNotificationsIfNewlyUnlocked(saveResp);

          await loadSavedNutritionPlans(savedId);
          skipNextMenuLoadRef.current = true;
          setActiveTab('Önerilen');
        } else {
          Alert.alert(t("common.error"), displayText(saveResp?.message || t("common.planSaveFailed"), i18n.language));
        }
      } else {
        Alert.alert(t("common.error"), displayText(response.message || t("diet.planCreateFailed"), i18n.language));
      }
    } catch (error) {
      if (error.code === 'PRO_REQUIRED') {
        Alert.alert(
          "Pro üyelik gerekli",
          error.userMessage || "Bu özelliği daha fazla kullanmak için Pro plana geçmelisiniz.",
          [
            { text: "İptal", style: "cancel" },
            { text: "Profil", onPress: () => navigation.navigate("Profile") }
          ]
        );
      } else {
        const msg =
          error?.message ||
          "Bağlantı hatası. Aynı Wi‑Fi’de olduğunuzdan ve backend’in çalıştığından emin olun.";
        Alert.alert("Plan oluşturulamadı", msg);
      }
    } finally {
      setAiPlanLoading(false);
    }
  };

  const loadSavedNutritionPlans = async (preferredPlanId) => {
    setSavedNutritionPlansLoading(true);
    try {
      const resp = await apiService.getNutritionPlans(20, 0);
      if (resp?.success && Array.isArray(resp.data)) {
        const plans = resp.data;
        setSavedNutritionPlans(plans);

        const matchPlanId = (a, b) =>
          a != null && b != null && String(a) === String(b);

        if (plans.length > 0) {
          const targetId =
            preferredPlanId !== undefined ? preferredPlanId : selectedSavedPlanId;

          const pickedPlan =
            targetId != null
              ? plans.find((p) => matchPlanId(p.id, targetId)) ?? plans[0]
              : plans[0];

          setSelectedSavedPlanId(pickedPlan.id);
          setAiSelectedDay('Pazartesi');
          const pickedPlanData = normalizeFullNutritionPlan(pickedPlan?.planData);
          setMenuDetailPlanData(pickedPlanData);
        } else {
          setSelectedSavedPlanId(null);
          setMenuDetailPlanData(null);
        }
      } else {
        setSavedNutritionPlans([]);
        setSelectedSavedPlanId(null);
        setMenuDetailPlanData(null);
      }
    } catch (e) {
      console.warn('Kayıtlı beslenme planları yüklenemedi:', e?.message || e);
      setSavedNutritionPlans([]);
      setSelectedSavedPlanId(null);
      setMenuDetailPlanData(null);
    } finally {
      setSavedNutritionPlansLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'Önerilen') {
      if (skipNextMenuLoadRef.current) {
        skipNextMenuLoadRef.current = false;
        return;
      }
      loadSavedNutritionPlans();
    }
  }, [activeTab]);

  const saveDietMenuPlanNameOnly = async () => {
    if (!selectedSavedPlanId || !menuDetailPlanData) return;
    const name = dietMenuPlanNameEdit.trim();
    if (!name) {
      Alert.alert(t("common.planName"), t("common.nameRequired"));
      return;
    }
    setDietPlanNameSaving(true);
    try {
      const resp = await apiService.updateNutritionPlan(selectedSavedPlanId, menuDetailPlanData, name);
      if (resp?.success) {
        await loadSavedNutritionPlans(selectedSavedPlanId);
        Alert.alert(t("common.saved"), t("common.nameUpdated"));
      } else {
        Alert.alert(t("common.error"), displayText(resp?.message || t("common.nameUpdateFailed"), i18n.language));
      }
    } catch (e) {
      Alert.alert(t("common.error"), displayText(e?.message || t("common.nameUpdateFailed"), i18n.language));
    } finally {
      setDietPlanNameSaving(false);
    }
  };

  const handleSaveWeeklyPlan = async () => {
    if (!aiPlan) return;
    setAiSavePlanLoading(true);
    try {
      const planName = dietNewPlanName.trim() || getDefaultNutritionPlanTitle();
      const resp = await apiService.saveNutritionPlan(aiPlan, planName);
      if (resp?.success) {
        setDietNewPlanName("");
        showNotificationsIfNewlyUnlocked(resp);
        Alert.alert(t("common.saved"), t("diet.weeklyPlanSaved"));
        await loadSavedNutritionPlans(resp.data?.id ?? null);
      } else {
        Alert.alert(t("common.error"), displayText(resp?.message || t("common.planSaveFailed"), i18n.language));
      }
    } catch (e) {
      Alert.alert(t("common.error"), displayText(e?.message || t("common.planSaveFailed"), i18n.language));
    } finally {
      setAiSavePlanLoading(false);
    }
  };

  const handleSaveMealDraft = async (source, dayKey, mealIndex) => {
    const plan = source === "menu" ? menuDetailPlanData : aiPlan;
    const mealTitle = plan?.week?.[dayKey]?.meals?.[mealIndex]?.title || "Öğün";
    if (!plan?.week?.[dayKey]?.meals?.[mealIndex]) {
      Alert.alert(t("common.error"), t("common.mealNotFound"));
      return;
    }
    const loadingKey = `${source}-${dayKey}-${mealIndex}`;
    setMealSaveLoadingKey(loadingKey);
    try {
      const planName =
        (source === "menu" && dietMenuPlanNameEdit?.trim()) ||
        selectedSavedPlan?.planName ||
        getDefaultNutritionPlanTitle();
      const planId = selectedSavedPlanId;

      const applyNormalized = (rawPlan) => {
        const normalized = normalizeFullNutritionPlan(rawPlan) ?? plan;
        setMenuDetailPlanData(normalized);
        setAiPlan(normalized);
      };

      if (planId) {
        const resp = await apiService.updateNutritionPlan(planId, plan, planName);
        if (resp?.success) {
          showNotificationsIfNewlyUnlocked(resp);
          const fromServer = normalizePlanData(resp.data?.planData) ?? resp.data?.planData;
          applyNormalized(fromServer || plan);
          await loadSavedNutritionPlans(planId);
          Alert.alert(t("common.saved"), t("diet.mealUpdated", { meal: displayText(mealTitle, i18n.language) }));
        } else {
          Alert.alert(t("common.error"), displayText(resp?.message || t("common.couldNotSave"), i18n.language));
        }
      } else {
        const resp = await apiService.saveNutritionPlan(plan, planName);
        if (resp?.success) {
          showNotificationsIfNewlyUnlocked(resp);
          const newId = resp.data?.id;
          const fromServer = normalizePlanData(resp.data?.planData) ?? resp.data?.planData;
          if (newId) setSelectedSavedPlanId(newId);
          applyNormalized(fromServer || plan);
          await loadSavedNutritionPlans(newId);
          Alert.alert(t("common.saved"), t("diet.mealSavedCreated", { meal: displayText(mealTitle, i18n.language) }));
        } else {
          Alert.alert(t("common.error"), displayText(resp?.message || t("common.couldNotSave"), i18n.language));
        }
      }
    } catch (e) {
      Alert.alert(t("common.error"), displayText(e?.message || t("common.connectionError"), i18n.language));
    } finally {
      setMealSaveLoadingKey(null);
    }
  };

  const handleDeleteWeeklyPlan = async (planId) => {
    if (!planId) return;
    Alert.alert(
      t("common.deleteConfirm"),
      t("common.deletePlanMessage"),
      [
        { text: t("common.cancel"), style: 'cancel' },
        {
          text: t("common.delete"),
          style: 'destructive',
          onPress: async () => {
            try {
              const resp = await apiService.deleteNutritionPlan(planId);
              if (resp?.success) {
                Alert.alert(t("common.deleted"), t("common.planDeleted"));
              }
              await loadSavedNutritionPlans();
            } catch (e) {
              Alert.alert(t("common.error"), displayText(e?.message || t("common.planDeleteFailed"), i18n.language));
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  const TAB_ITEMS = [
      { id: "Önerilen", icon: "restaurant", title: t("diet.tabs.menu") },
      { id: "Kendi", icon: "create", title: t("diet.tabs.input") },
      { id: "AI", icon: "hardware-chip", title: t("diet.tabs.ai") },
  ];

  return (
    <Layout>
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          
          <View style={styles.topBar}>
              <View style={styles.topBarTextWrap}>
                  <Text style={styles.pageTitle}>{t("diet.title")}</Text>
                  <Text style={styles.subTitle}>{t("diet.subtitle")}</Text>
              </View>
              <View style={[styles.topBarIcon, COMMON_STYLES.shadowLight]}>
                  <Ionicons name="nutrition" size={26} color={COLORS.primary} />
              </View>
          </View>

          <View style={styles.tabWrap}>
            <View style={[styles.tabContainer, COMMON_STYLES.shadowLight]}>
              <Animated.View style={[
                  styles.slidingIndicator, 
                  { 
                    width: TAB_WIDTH - 12,
                    transform: [{ translateX: slideAnim }],
                    backgroundColor: getIndicatorColor()
                  }
              ]} />

              {TAB_ITEMS.map((t) => {
                 const isActive = activeTab === t.id;
                 return (
                  <Pressable key={t.id} style={styles.tabButton} onPress={() => setActiveTab(t.id)}>
                      <View style={styles.tabPill}>
                          <Ionicons name={t.icon} size={16} color={isActive ? COLORS.white : COLORS.textLight} style={{marginBottom: 2}} />
                          <Text style={[styles.tabText, isActive && styles.activeTabText]}>
                              {t.title}
                          </Text>
                      </View>
                  </Pressable>
                 )
              })}
            </View>
          </View>

          <View style={styles.contentArea}>

            {/* 🥗 1. TAB: ÖNERİLEN PLANLAR */}
            {activeTab === "Önerilen" && (
              <View style={styles.tabContentFlex}>
                {menuDetailPlanData ? (
                  <ScrollView
                    style={{ flex: 1 }}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 24 }}
                  >
                    {/* --- SU TAKİBİ (AKORDİYON) --- */}
                    <Pressable
                      style={[styles.waterToggleBtn, COMMON_STYLES.shadowLight]}
                      onPress={() => setShowWaterTracker(!showWaterTracker)}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center" }}>
                        <View style={[styles.waterToggleIconWrap, { backgroundColor: COLORS.secondaryLight }]}>
                          <Ionicons name="water" size={20} color={COLORS.secondary} />
                        </View>
                        <Text style={styles.waterToggleText}>{t("home.water", { defaultValue: "Su Takibi" })}</Text>
                      </View>
                      <View style={{ flexDirection: "row", alignItems: "center" }}>
                        <Text style={styles.waterToggleProgress}>{Math.round(progress * 100)}%</Text>
                        <Ionicons name={showWaterTracker ? "chevron-up" : "chevron-down"} size={20} color={COLORS.textLight} style={{ marginLeft: 8 }} />
                      </View>
                    </Pressable>

                    {showWaterTracker && (
                      <View style={[styles.waterCardWrapper, COMMON_STYLES.shadowLight, { marginBottom: 20 }]}>
                        <WaterWeeklyCard
                          goalMl={goalMl}
                          todayMl={todayMl}
                          progress={progress}
                          week={week}
                          streak={streak}
                          onAdd={add}
                          onReset={reset}
                          onSetGoal={setGoalMl}
                          loading={waterLoading}
                        />
                      </View>
                    )}

                    <View style={[styles.summaryCard, COMMON_STYLES.shadowLight]}>
                      <View style={styles.summaryHeader}>
                        <View style={styles.summaryTitleWrap}>
                          <Text style={styles.summaryTitle}>{t("diet.dailyNeed")}</Text>
                          <Text style={styles.summaryGoal}>{goalDisplayLabel}</Text>
                        </View>
                        <View style={[styles.iconBox, { backgroundColor: COLORS.accentLight }]}>
                          <Ionicons name="flame" size={24} color={COLORS.accent} />
                        </View>
                      </View>

                      <View style={styles.macroGrid}>
                        <View style={[styles.macroItem, { backgroundColor: COLORS.bg }]}>
                          <Text style={[styles.macroValue, { color: COLORS.accent }]}>{menuDetailPlanSummary?.dailyCalories ?? "-"}</Text>
                          <Text style={styles.macroLabel}>{t("diet.calories")}</Text>
                        </View>
                        <View style={[styles.macroItem, { backgroundColor: COLORS.bg }]}>
                          <Text style={[styles.macroValue, { color: COLORS.primary }]}>{menuDetailPlanSummary?.protein ?? "-"}</Text>
                          <Text style={styles.macroLabel}>{t("diet.protein")}</Text>
                        </View>
                        <View style={[styles.macroItem, { backgroundColor: COLORS.bg }]}>
                          <Text style={[styles.macroValue, { color: COLORS.purple }]}>{menuDetailPlanSummary?.carb ?? "-"}</Text>
                          <Text style={styles.macroLabel}>{t("diet.carbs")}</Text>
                        </View>
                        <View style={[styles.macroItem, { backgroundColor: COLORS.bg }]}>
                          <Text style={[styles.macroValue, { color: COLORS.secondary }]}>{menuDetailPlanSummary?.fat ?? "-"}</Text>
                          <Text style={styles.macroLabel}>{t("diet.fat")}</Text>
                        </View>
                      </View>
                    </View>

                    {selectedSavedPlanId ? (
                      <View style={[styles.dietPlanNameCard, COMMON_STYLES.shadowLight]}>
                        <Text style={styles.aiInputLabel}>{t("diet.planName")}</Text>
                        <View style={styles.dietPlanNameRow}>
                          <TextInput
                            style={styles.dietPlanNameInput}
                            value={displayText(dietMenuPlanNameEdit, i18n.language)}
                            onChangeText={setDietMenuPlanNameEdit}
                            placeholder={t("diet.planNamePlaceholder")}
                            placeholderTextColor={COLORS.textLight}
                            maxLength={120}
                          />
                          <Pressable
                            style={[styles.dietPlanNameSaveBtn, dietPlanNameSaving && { opacity: 0.75 }]}
                            onPress={saveDietMenuPlanNameOnly}
                            disabled={dietPlanNameSaving}
                          >
                            {dietPlanNameSaving ? (
                              <ActivityIndicator size="small" color={COLORS.white} />
                            ) : (
                              <Text style={styles.dietPlanNameSaveBtnText}>{t("common.save")}</Text>
                            )}
                          </Pressable>
                        </View>
                      </View>
                    ) : null}

                    {savedNutritionPlans.length > 1 ? (
                      <View style={{ marginBottom: 14 }}>
                        <View style={styles.sectionHeader}>
                          <Text style={styles.sectionTitle}>{t("diet.savedMenus")}</Text>
                        </View>

                        {savedNutritionPlans.map((p) => {
                          const isActive = p.id === selectedSavedPlanId;
                          return (
                            <View
                              key={p.id}
                              style={[
                                styles.savedPlanCard,
                                isActive && { borderColor: COLORS.purple, backgroundColor: 'rgba(159,122,233,0.06)' },
                              ]}
                            >
                              <View style={{ flex: 1 }}>
                                <Text style={styles.savedPlanName}>{displayText(p.planName || t("diet.weeklyPlan"), i18n.language)}</Text>
                                <Text style={styles.savedPlanDate}>{formatDateTimeTR(p.createdAt)}</Text>
                              </View>

                              <View style={{ flexDirection: 'row', gap: 8 }}>
                                <Pressable
                                  style={styles.savedPlanBtn}
                                  onPress={() => {
                                    setSelectedSavedPlanId(p.id);
                                    setAiSelectedDay('Pazartesi');
                                    setMenuDetailPlanData(normalizeFullNutritionPlan(p.planData));
                                  }}
                                >
                                  <Text style={styles.savedPlanBtnText}>{t("common.review")}</Text>
                                </Pressable>

                                <Pressable
                                  style={[
                                    styles.savedPlanBtn,
                                    { borderColor: COLORS.redish, backgroundColor: 'rgba(252,129,129,0.10)' },
                                  ]}
                                  onPress={() => handleDeleteWeeklyPlan(p.id)}
                                >
                                  <Text style={[styles.savedPlanBtnText, { color: COLORS.redish }]}>{t("common.delete")}</Text>
                                </Pressable>
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    ) : null}

                    {menuDetailPlanSummary?.recommendations ? (
                      <View style={styles.planRecommendationsBox}>
                        <Text style={styles.planRecommendationsTitle}>{t("diet.recommendations")}</Text>
                        <Text style={styles.planRecommendationsText}>{displayText(menuDetailPlanSummary.recommendations, i18n.language)}</Text>
                      </View>
                    ) : null}

                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={{ marginBottom: 10 }}
                      contentContainerStyle={{ gap: 10 }}
                    >
                      {AI_WEEK_DAYS.map((day) => (
                        <Pressable
                          key={day}
                          onPress={() => setAiSelectedDay(day)}
                          style={[
                            styles.aiDayPill,
                            day === aiSelectedDay && styles.aiDayPillActive,
                          ]}
                        >
                          <Text style={[styles.aiDayPillText, day === aiSelectedDay && styles.aiDayPillTextActive]}>
                            {displayDayShort(day, i18n.language)}
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>

                    <View style={styles.weekDaySection}>
                      <Text style={styles.weekDayTitle}>{displayDay(aiSelectedDay, i18n.language)}</Text>
                      {menuDetailMealsForDay.length > 0 ? (
                        menuDetailMealsForDay.map((meal, index) => (
                          <View key={`${aiSelectedDay}-${index}`} style={styles.planMealItem}>
                            <View style={styles.planMealTitleRow}>
                              <Text style={styles.planMealTitle}>{displayText(meal.title, i18n.language)}</Text>
                              {meal.calories != null && meal.calories !== '' ? (
                                <Text style={styles.mealCaloriesBadge}>{Number(meal.calories)} kcal</Text>
                              ) : null}
                            </View>
                            {(meal.items || []).map((it, k) => (
                              <MealLineEditor
                                key={`${aiSelectedDay}-${index}-${k}`}
                                item={it}
                                dayKey={aiSelectedDay}
                                mealIndex={index}
                                itemIndex={k}
                                setPlan={setMenuDetailPlanData}
                                bulletColor={COLORS.purple}
                                styles={styles}
                              />
                            ))}
                            <Pressable
                              style={[
                                styles.mealSaveBtn,
                                mealSaveLoadingKey === `menu-${aiSelectedDay}-${index}` && { opacity: 0.75 },
                              ]}
                              onPress={() => handleSaveMealDraft("menu", aiSelectedDay, index)}
                              disabled={!!mealSaveLoadingKey}
                            >
                              {mealSaveLoadingKey === `menu-${aiSelectedDay}-${index}` ? (
                                <ActivityIndicator size="small" color={COLORS.white} />
                              ) : (
                                <>
                                  <Ionicons name="save-outline" size={18} color={COLORS.white} />
                                  <Text style={styles.mealSaveBtnText}>{t("diet.saveMeal")}</Text>
                                </>
                              )}
                            </Pressable>
                          </View>
                        ))
                      ) : (
                        <Text style={styles.weekDayEmpty}>{t("diet.noMeals")}</Text>
                      )}
                    </View>
                    {selectedSavedPlanId ? (
                      <Pressable
                        style={[
                          styles.savedPlanBtn,
                          {
                            borderColor: COLORS.redish,
                            backgroundColor: 'rgba(252,129,129,0.10)',
                            marginTop: 18,
                          },
                        ]}
                        onPress={() => handleDeleteWeeklyPlan(selectedSavedPlanId)}
                      >
                        <Text style={[styles.savedPlanBtnText, { color: COLORS.redish }]}>{t("common.delete")}</Text>
                      </Pressable>
                    ) : null}
                  </ScrollView>
                ) : (
                  <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
                    
                    {/* --- SU TAKİBİ (AKORDİYON) --- */}
                    <Pressable
                      style={[styles.waterToggleBtn, COMMON_STYLES.shadowLight]}
                      onPress={() => setShowWaterTracker(!showWaterTracker)}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center" }}>
                        <View style={[styles.waterToggleIconWrap, { backgroundColor: COLORS.secondaryLight }]}>
                          <Ionicons name="water" size={20} color={COLORS.secondary} />
                        </View>
                        <Text style={styles.waterToggleText}>{t("home.water", { defaultValue: "Su Takibi" })}</Text>
                      </View>
                      <View style={{ flexDirection: "row", alignItems: "center" }}>
                        <Text style={styles.waterToggleProgress}>{Math.round(progress * 100)}%</Text>
                        <Ionicons name={showWaterTracker ? "chevron-up" : "chevron-down"} size={20} color={COLORS.textLight} style={{ marginLeft: 8 }} />
                      </View>
                    </Pressable>

                    {showWaterTracker && (
                      <View style={[styles.waterCardWrapper, COMMON_STYLES.shadowLight, { marginBottom: 20 }]}>
                        <WaterWeeklyCard
                          goalMl={goalMl}
                          todayMl={todayMl}
                          progress={progress}
                          week={week}
                          streak={streak}
                          onAdd={add}
                          onReset={reset}
                          onSetGoal={setGoalMl}
                          loading={waterLoading}
                        />
                      </View>
                    )}

                    <View style={[styles.summaryCard, COMMON_STYLES.shadowLight]}>
                      <View style={styles.summaryHeader}>
                        <View style={styles.summaryTitleWrap}>
                          <Text style={styles.summaryTitle}>{t("diet.dailyNeed")}</Text>
                          <Text style={styles.summaryGoal}>{goalDisplayLabel}</Text>
                        </View>
                        <View style={[styles.iconBox, { backgroundColor: COLORS.accentLight }]}>
                          <Ionicons name="flame" size={24} color={COLORS.accent} />
                        </View>
                      </View>

                      <View style={styles.macroGrid}>
                        <View style={[styles.macroItem, { backgroundColor: COLORS.bg }]}>
                          <Text style={[styles.macroValue, { color: COLORS.accent }]}>{plan.calories}</Text>
                          <Text style={styles.macroLabel}>{t("diet.calories")}</Text>
                        </View>
                        <View style={[styles.macroItem, { backgroundColor: COLORS.bg }]}>
                          <Text style={[styles.macroValue, { color: COLORS.primary }]}>{plan.protein}</Text>
                          <Text style={styles.macroLabel}>{t("diet.protein")}</Text>
                        </View>
                        <View style={[styles.macroItem, { backgroundColor: COLORS.bg }]}>
                          <Text style={[styles.macroValue, { color: COLORS.purple }]}>{plan.carb}</Text>
                          <Text style={styles.macroLabel}>{t("diet.carbs")}</Text>
                        </View>
                        <View style={[styles.macroItem, { backgroundColor: COLORS.bg }]}>
                          <Text style={[styles.macroValue, { color: COLORS.secondary }]}>{plan.fat}</Text>
                          <Text style={styles.macroLabel}>{t("diet.fat")}</Text>
                        </View>
                      </View>
                    </View>

                    <View style={styles.sectionHeader}>
                      <Text style={styles.sectionTitle}>{t("diet.sampleMenu")}</Text>
                    </View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalMeals}>
                      {plan.meals.map((m, i) => (
                        <View key={i} style={[styles.mealCardHorizontal, COMMON_STYLES.shadowLight]}>
                          <LinearGradient
                            colors={i === 0 ? ["#FFF7F2", COLORS.white] : i === 1 ? ["#F4FAFF", COLORS.white] : ["#F4F1FF", COLORS.white]}
                            style={styles.mealCardGradient}
                          >
                            <View style={styles.mealHeader}>
                              <View style={[styles.mealIconWrap, { backgroundColor: i === 0 ? COLORS.accentLight : i === 1 ? COLORS.primaryLight : COLORS.purpleLight }]}>
                                <Ionicons
                                  name={i === 0 ? "sunny" : i === 1 ? "partly-sunny" : "moon"}
                                  size={20}
                                  color={i === 0 ? COLORS.accent : i === 1 ? COLORS.primary : COLORS.purple}
                                />
                              </View>
                              <Text style={styles.mealTitle}>{displayText(m.title, i18n.language)}</Text>
                            </View>
                            <View style={styles.mealContent}>
                              {m.items.map((it, idx) => (
                                <View key={idx} style={styles.mealItemRow}>
                                  <Ionicons name="checkmark-circle" size={14} color={COLORS.secondary} style={{ marginRight: 8, marginTop: 2 }} />
                                  <Text style={styles.mealItemText}>{displayText(it, i18n.language)}</Text>
                                </View>
                              ))}
                            </View>
                          </LinearGradient>
                        </View>
                      ))}
                    </ScrollView>
                  </ScrollView>
                )}
              </View>
            )}

            {/* 📝 2. TAB: KENDİ — sadece tabak fotoğrafı analizi */}
            {activeTab === "Kendi" && (
              <ScrollView
                style={styles.tabContentFlex}
                contentContainerStyle={{ paddingBottom: 32 }}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                <View style={[styles.inputCard, COMMON_STYLES.shadowLight, { marginBottom: 0 }]}>
                  {!isPro ? (
                    <View style={[styles.platePaywall, COMMON_STYLES.shadowPremium]}>
                      <LinearGradient
                        colors={[COLORS.secondaryLight, COLORS.white]}
                        style={styles.platePaywallInner}
                      >
                        <Ionicons name="lock-closed" size={36} color={COLORS.secondary} />
                        <Text style={styles.platePaywallTitle}>{t("diet.proFeature")}</Text>
                        <Text style={styles.platePaywallText}>
                          {t("diet.platePaywall")}
                        </Text>
                        <Pressable
                          style={styles.platePaywallBtn}
                          onPress={() => navigation.navigate("Profile")}
                        >
                          <Text style={styles.platePaywallBtnText}>{t("diet.goProFromProfile")}</Text>
                          <Ionicons name="arrow-forward" size={16} color={COLORS.white} />
                        </Pressable>
                      </LinearGradient>
                    </View>
                  ) : (
                    <View style={[styles.plateAnalyzerBox, { marginBottom: 0 }]}>
                      <View style={styles.plateAnalyzerHeader}>
                        <Ionicons name="camera" size={18} color={COLORS.secondary} style={{ marginRight: 8 }} />
                        <Text style={styles.sectionTitleSmall}>{t("diet.plateAnalysis")}</Text>
                      </View>

                      <Text style={styles.platePortionLabel}>{t("diet.plateAmount")}</Text>
                      <Text style={styles.platePortionHint}>
                        {displayText("Fotoğrafı çekmeden önce seç. Tahmin edilen kalori ve besin değerleri buna göre ölçeklenir:", i18n.language)}{" "}
                        <Text style={styles.platePortionHintStrong}>{t("diet.small")}</Text> {displayText("küçük veya az dolu porsiyon,", i18n.language)}{" "}
                        <Text style={styles.platePortionHintStrong}>{t("diet.medium")}</Text> {displayText("normal bir tabak,", i18n.language)}{" "}
                        <Text style={styles.platePortionHintStrong}>{t("diet.large")}</Text> {displayText("dolu tabak veya büyük porsiyon.", i18n.language)}
                      </Text>

                      <View style={styles.portionRow}>
                        <Pressable
                          style={[styles.portionPill, platePortion === "az" && styles.portionPillActive]}
                          onPress={() => setPlatePortion("az")}
                        >
                          <Text style={[styles.portionPillText, platePortion === "az" && styles.portionPillTextActive]}>{t("diet.small")}</Text>
                        </Pressable>
                        <Pressable
                          style={[styles.portionPill, platePortion === "orta" && styles.portionPillActive]}
                          onPress={() => setPlatePortion("orta")}
                        >
                          <Text style={[styles.portionPillText, platePortion === "orta" && styles.portionPillTextActive]}>{t("diet.medium")}</Text>
                        </Pressable>
                        <Pressable
                          style={[styles.portionPill, platePortion === "çok" && styles.portionPillActive]}
                          onPress={() => setPlatePortion("çok")}
                        >
                          <Text style={[styles.portionPillText, platePortion === "çok" && styles.portionPillTextActive]}>{t("diet.large")}</Text>
                        </Pressable>
                      </View>

                      <Pressable
                        style={[styles.plateCaptureButton, plateLoading && { opacity: 0.7 }]}
                        onPress={pickPlatePhotoAndAnalyze}
                        disabled={plateLoading}
                      >
                        {plateLoading ? (
                          <ActivityIndicator color={COLORS.white} />
                        ) : (
                          <>
                            <Ionicons name="sparkles" size={16} color={COLORS.white} style={{ marginRight: 8 }} />
                            <Text style={styles.plateCaptureButtonText}>{t("diet.captureAnalyze")}</Text>
                          </>
                        )}
                      </Pressable>

                      {platePreviewUri ? (
                        <Image source={{ uri: platePreviewUri }} style={styles.platePreview} />
                      ) : null}

                      {plateError ? <Text style={styles.plateErrorText}>{plateError}</Text> : null}

                      {plateResult ? (
                        <View style={styles.plateResultBox}>
                          <Text style={styles.plateResultTitle} numberOfLines={2}>
                            {displayText(plateResult.foodLabel || t("diet.plateResult"), i18n.language)}
                          </Text>
                          <Text style={styles.plateCalories}>
                            {plateResult?.nutrition?.calories ?? "-"} kcal
                          </Text>

                          <View style={styles.plateMacrosRow}>
                            <Text style={styles.plateMacroLine}>
                              {t("diet.protein")}: {plateResult?.nutrition?.macros?.protein_g ?? "-"} g
                            </Text>
                            <Text style={styles.plateMacroLine}>
                              {t("diet.carbs")}: {plateResult?.nutrition?.macros?.carbs_g ?? "-"} g
                            </Text>
                            <Text style={styles.plateMacroLine}>
                              {t("diet.fat")}: {plateResult?.nutrition?.macros?.fat_g ?? "-"} g
                            </Text>
                          </View>

                          <View style={styles.plateMicrosRow}>
                            <Text style={styles.plateMicroLine}>
                              {t("diet.fiber")}: {plateResult?.nutrition?.micros?.fiber_g ?? "-"} g
                            </Text>
                            <Text style={styles.plateMicroLine}>
                              {t("diet.sugar")}: {plateResult?.nutrition?.micros?.sugar_g ?? "-"} g
                            </Text>
                            <Text style={styles.plateMicroLine}>
                              {t("diet.sodium")}: {plateResult?.nutrition?.micros?.sodium_mg ?? "-"} mg
                            </Text>
                            <Text style={styles.plateMicroLine}>
                              {t("diet.potassium")}: {plateResult?.nutrition?.micros?.potassium_mg ?? "-"} mg
                            </Text>
                          </View>
                        </View>
                      ) : null}
                    </View>
                  )}
                </View>
              </ScrollView>
            )}

            {/* 🤖 3. TAB: AI ASİSTAN */}
            {activeTab === "AI" && (
              <ScrollView
                style={styles.tabContentFlex}
                contentContainerStyle={styles.aiTabScrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                <View style={[styles.aiHero, COMMON_STYLES.shadowLight]}>
                    <View style={styles.aiHeroIconWrap}>
                        <Ionicons name="hardware-chip" size={32} color={COLORS.purple} />
                    </View>
                    <View style={{flex: 1}}>
                        <Text style={styles.aiHeroTitle}>{t("diet.aiAssistant")}</Text>
                        <Text style={styles.aiHeroSub}>{t("diet.aiSubtitle")}</Text>
                    </View>
                </View>

                <View style={styles.aiSubTabContainer}>
                    <Pressable style={[styles.aiSubTab, aiMode === "chat" && styles.aiSubTabActive]} onPress={() => setAiMode("chat")}>
                        <Ionicons name="chatbubbles" size={18} color={aiMode === "chat" ? COLORS.white : COLORS.purple} style={{marginRight:6}}/>
                        <Text style={[styles.aiSubTabText, aiMode === "chat" && styles.aiSubTabTextActive]}>{t("diet.askQuestion")}</Text>
                    </Pressable>
                    <Pressable style={[styles.aiSubTab, aiMode === "plan" && styles.aiSubTabActive]} onPress={() => setAiMode("plan")}>
                        <Ionicons name="clipboard" size={18} color={aiMode === "plan" ? COLORS.white : COLORS.purple} style={{marginRight:6}}/>
                        <Text style={[styles.aiSubTabText, aiMode === "plan" && styles.aiSubTabTextActive]}>{t("diet.createPlan")}</Text>
                    </Pressable>
                </View>

                {aiMode === "chat" && (
                    <View style={[styles.aiCard, COMMON_STYLES.shadowLight, {flex: 1}]}>
                      <Text style={styles.aiInputLabel}>{t("diet.questionLabel")}</Text>
                      <TextInput
                        placeholder={t("diet.questionPlaceholder")}
                        placeholderTextColor={COLORS.textLight}
                        value={aiQuestion}
                        onChangeText={setAiQuestion}
                        style={styles.aiInput}
                        multiline
                      />
                      <Pressable style={[styles.aiButtonSmall, aiLoading && {opacity: 0.7}]} onPress={askAI} disabled={aiLoading}>
                        {aiLoading ? <ActivityIndicator color={COLORS.white} size="small"/> : <Text style={styles.aiButtonTextSmall}>{t("diet.sendAssistant")}</Text>}
                      </Pressable>
                      
                      <View style={{ marginTop: 20, minHeight: 150 }}>
                          {aiError ? (
                            <View style={styles.aiErrorContainer}>
                              <View style={styles.aiAnswerTop}>
                                  <Ionicons name="alert-circle" size={16} color={COLORS.redish} style={{marginRight: 6}} />
                                  <Text style={styles.aiErrorLabel}>{t("diet.noAnswer")}</Text>
                              </View>
                              <Text style={styles.aiErrorText}>{aiError}</Text>
                            </View>
                          ) : aiAnswer ? (
                            <View style={styles.aiAnswerContainer}>
                              <View style={styles.aiAnswerTop}>
                                  <Ionicons name="sparkles" size={16} color={COLORS.purple} style={{marginRight: 6}} />
                                  <Text style={styles.aiAnswerLabel}>{t("diet.assistantAnswer")}</Text>
                              </View>
                              <Text style={styles.aiAnswerText}>{aiAnswer}</Text>
                            </View>
                          ) : (
                              <View style={styles.aiEmptyState}>
                                  <Ionicons name="chatbox-ellipses-outline" size={50} color={COLORS.border} />
                                  <Text style={styles.aiEmptyText}>{t("diet.waitingQuestions")}</Text>
                              </View>
                          )}
                      </View>
                    </View>
                )}

                {aiMode === "plan" && (
                    <View style={[styles.aiCard, COMMON_STYLES.shadowLight, {flex: 1}]}>
                      <Text style={styles.aiInputLabel}>{t("diet.customMenu")}</Text>
                      {userDetails && (
                          <View style={styles.userInfoBadgeWrap}>
                              <View style={styles.userInfoBadge}>
                                  <Text style={styles.userInfoLabel}>Hedef:</Text>
                                  <Text style={styles.userInfoValue}>{userDetails.goal ? getGoalLabel(t, userDetails.goal) : "-"}</Text>
                              </View>
                              <View style={styles.userInfoBadge}>
                                  <Text style={styles.userInfoLabel}>Kilo:</Text>
                                  <Text style={styles.userInfoValue}>{userDetails.weight}kg</Text>
                              </View>
                          </View>
                      )}

                      <Text style={[styles.aiInputLabel, { marginTop: 4 }]}>{t("diet.optionalPlanName")}</Text>
                      <TextInput
                        style={styles.dietPlanNameInputSingle}
                        value={dietNewPlanName}
                        onChangeText={setDietNewPlanName}
                        placeholder={t("diet.autoPlanNamePlaceholder")}
                        placeholderTextColor={COLORS.textLight}
                        maxLength={120}
                      />
                      
                      <Pressable style={[styles.primaryButton, COMMON_STYLES.shadowPremium, aiPlanLoading && {opacity: 0.7}, {marginTop: 10}]} onPress={generateAIPlan} disabled={aiPlanLoading}>
                        {aiPlanLoading ? <ActivityIndicator color={COLORS.white} style={{paddingVertical: 14}}/> : (
                            <LinearGradient colors={[COLORS.purple, "#7364D2"]} start={{x:0, y:0}} end={{x:1, y:0}} style={styles.primaryButtonGradient}>
                                <Ionicons name="color-wand" size={20} color={COLORS.white} style={{marginRight:8}}/>
                                <Text style={styles.primaryButtonText}>{t("diet.magicPlan")}</Text>
                            </LinearGradient>
                        )}
                      </Pressable>

                      <View style={{ marginTop: 15 }}>
                          {aiPlan ? (
                            <View style={styles.generatedPlanBox}>
                              <View style={styles.planMacroRow}>
                                <View style={styles.planMacroBadge}>
                                  <Text style={styles.planMacroText}>{aiPlanSummary?.dailyCalories ?? "-"} kcal</Text>
                                </View>
                                <View style={styles.planMacroBadge}>
                                  <Text style={styles.planMacroText}>{t("diet.protein")}: {aiPlanSummary?.protein ?? "-"}</Text>
                                </View>
                                <View style={styles.planMacroBadge}>
                                  <Text style={styles.planMacroText}>{t("diet.carbs")}: {aiPlanSummary?.carb ?? "-"}</Text>
                                </View>
                                <View style={styles.planMacroBadge}>
                                  <Text style={styles.planMacroText}>{t("diet.fat")}: {aiPlanSummary?.fat ?? "-"}</Text>
                                </View>
                              </View>

                              {aiPlanSummary?.recommendations ? (
                                <View style={styles.planRecommendationsBox}>
                                  <Text style={styles.planRecommendationsTitle}>{t("diet.recommendations")}</Text>
                                  <Text style={styles.planRecommendationsText}>{displayText(aiPlanSummary.recommendations, i18n.language)}</Text>
                                </View>
                              ) : null}

                              <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                style={{ marginBottom: 14 }}
                                contentContainerStyle={{ gap: 10 }}
                              >
                                {AI_WEEK_DAYS.map((day) => (
                                  <Pressable
                                    key={day}
                                    onPress={() => setAiSelectedDay(day)}
                                    style={[
                                      styles.aiDayPill,
                                      day === aiSelectedDay && styles.aiDayPillActive,
                                    ]}
                                  >
                                    <Text style={[styles.aiDayPillText, day === aiSelectedDay && styles.aiDayPillTextActive]}>
                                      {displayDayShort(day, i18n.language)}
                                    </Text>
                                  </Pressable>
                                ))}
                              </ScrollView>

                              {(() => {
                                const meals = aiPlanWeek?.[aiSelectedDay]?.meals || [];
                                return (
                                  <View style={styles.weekDaySection}>
                                    <Text style={styles.weekDayTitle}>{displayDay(aiSelectedDay, i18n.language)}</Text>
                                    {meals.length > 0 ? (
                                      meals.map((meal, index) => (
                                        <View key={`${aiSelectedDay}-${index}`} style={styles.planMealItem}>
                                          <View style={styles.planMealTitleRow}>
                                            <Text style={styles.planMealTitle}>{displayText(meal.title, i18n.language)}</Text>
                                            {meal.calories != null && meal.calories !== '' ? (
                                              <Text style={styles.mealCaloriesBadge}>{Number(meal.calories)} kcal</Text>
                                            ) : null}
                                          </View>
                                          {(meal.items || []).map((it, k) => (
                                            <MealLineEditor
                                              key={`ai-${aiSelectedDay}-${index}-${k}`}
                                              item={it}
                                              dayKey={aiSelectedDay}
                                              mealIndex={index}
                                              itemIndex={k}
                                              setPlan={setAiPlan}
                                              bulletColor={COLORS.purple}
                                              styles={styles}
                                            />
                                          ))}
                                          <Pressable
                                            style={[
                                              styles.mealSaveBtn,
                                              mealSaveLoadingKey === `ai-${aiSelectedDay}-${index}` && {
                                                opacity: 0.75,
                                              },
                                            ]}
                                            onPress={() => handleSaveMealDraft("ai", aiSelectedDay, index)}
                                            disabled={!!mealSaveLoadingKey}
                                          >
                                            {mealSaveLoadingKey === `ai-${aiSelectedDay}-${index}` ? (
                                              <ActivityIndicator size="small" color={COLORS.white} />
                                            ) : (
                                              <>
                                                <Ionicons name="save-outline" size={18} color={COLORS.white} />
                                                <Text style={styles.mealSaveBtnText}>{t("diet.saveMeal")}</Text>
                                              </>
                                            )}
                                          </Pressable>
                                        </View>
                                      ))
                                    ) : (
                                      <Text style={styles.weekDayEmpty}>{t("diet.noMeals")}</Text>
                                    )}
                                  </View>
                                );
                              })()}
                            </View>
                          ) : (
                              <View style={styles.aiEmptyState}>
                                  <Ionicons name="document-text-outline" size={50} color={COLORS.border} />
                                  <Text style={styles.aiEmptyText}>{t("diet.aiEmptyHint")}</Text>
                              </View>
                          )}

                          <View style={{ marginTop: 22 }}>
                            <Text style={styles.sectionTitleSmall}>{t("diet.savedPlans")}</Text>

                            {savedNutritionPlansLoading ? (
                              <ActivityIndicator color={COLORS.purple} style={{ marginTop: 10 }} />
                            ) : savedNutritionPlans.length === 0 ? (
                              <View style={styles.aiEmptyState}>
                                <Ionicons name="document-text-outline" size={40} color={COLORS.border} />
                                <Text style={styles.aiEmptyText}>{t("diet.noSavedPlans")}</Text>
                              </View>
                            ) : (
                              savedNutritionPlans.map((p) => {
                                const planData = normalizePlanData(p.planData) || p.planData;
                                return (
                                  <View key={p.id} style={styles.savedPlanCard}>
                                    <View style={{ flex: 1 }}>
                                      <Text style={styles.savedPlanName}>{displayText(p.planName || t("diet.weeklyPlan"), i18n.language)}</Text>
                                      <Text style={styles.savedPlanDate}>{formatDateTimeTR(p.createdAt)}</Text>
                                    </View>
                                    <View style={{ flexDirection: 'row', gap: 8 }}>
                                      <Pressable
                                        style={styles.savedPlanBtn}
                                        onPress={() => {
                                          if (!planData) return;
                                          setSelectedSavedPlanId(p.id);
                                          setAiSelectedDay("Pazartesi");
                                          setAiPlan(normalizeFullNutritionPlan(planData));
                                        }}
                                      >
                                        <Text style={styles.savedPlanBtnText}>{t("common.details")}</Text>
                                      </Pressable>
                                      <Pressable
                                        style={[styles.savedPlanBtn, { borderColor: COLORS.redish, backgroundColor: 'rgba(252,129,129,0.10)' }]}
                                        onPress={() => handleDeleteWeeklyPlan(p.id)}
                                      >
                                        <Text style={[styles.savedPlanBtnText, { color: COLORS.redish }]}>Sil</Text>
                                      </Pressable>
                                    </View>
                                  </View>
                                );
                              })
                            )}
                          </View>
                      </View>
                    </View>
                )}
              </ScrollView>
            )}

          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Layout>
  );
};

function createDietPageStyles(COLORS) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', paddingHorizontal: 20, paddingTop: 10, marginBottom: 20 },
  topBarTextWrap: { flex: 1 },
  pageTitle: { fontSize: 28, fontWeight: '800', color: COLORS.textDark, letterSpacing: -0.5 },
  subTitle: { color: COLORS.textMain, fontSize: 14, marginTop: 2 },
  topBarIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border },

  tabWrap: { paddingHorizontal: 20, marginBottom: 15 },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    position: 'relative',
  },
  slidingIndicator: {
    position: 'absolute',
    top: 6,
    left: 6,
    bottom: 6,
    borderRadius: 14,
  },
  tabButton: { flex: 1 },
  tabPill: { paddingVertical: 14, borderRadius: 16, alignItems: "center", justifyContent: 'center', zIndex: 1 },
  tabText: { fontSize: 14, fontWeight: "800", color: COLORS.textLight },
  activeTabText: { color: COLORS.white },

  contentArea: { flex: 1, paddingHorizontal: 20, paddingBottom: Platform.OS === 'ios' ? 90 : 100 },
  tabContentFlex: { flex: 1, display: 'flex', flexDirection: 'column' },
  sectionHeader: { marginBottom: 12, marginTop: 5, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionTitle: { color: COLORS.textDark, fontSize: 18, fontWeight: "800", letterSpacing: -0.3 },
  sectionTitleSmall: { color: COLORS.textDark, fontSize: 15, fontWeight: "800", marginBottom: 10 },
  
  // --- EKLENEN SU TAKİBİ STİLLERİ (AKORDİYON) ---
  waterToggleBtn: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 15,
  },
  waterToggleIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  waterToggleText: {
    color: COLORS.textDark,
    fontSize: 16,
    fontWeight: "800",
  },
  waterToggleProgress: {
    color: COLORS.secondary,
    fontSize: 14,
    fontWeight: "800",
  },
  waterCardWrapper: {
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  summaryCard: { padding: 18, borderRadius: 24, marginBottom: 20, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border },
  summaryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  summaryTitleWrap: { flex: 1 },
  summaryTitle: { color: COLORS.textLight, fontSize: 12, fontWeight: "700", textTransform: 'uppercase' },
  summaryGoal: { color: COLORS.textDark, fontSize: 20, fontWeight: "800", marginTop: 2, letterSpacing: -0.5 },
  iconBox: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  macroGrid: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  macroItem: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border },
  macroValue: { fontSize: 18, fontWeight: "800", letterSpacing: -0.5 },
  macroLabel: { color: COLORS.textMain, fontSize: 12, marginTop: 4, fontWeight: '700' },

  horizontalMeals: { paddingBottom: 10, gap: 15 },
  mealCardHorizontal: { width: Math.max(260, width - 60), borderRadius: 26, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' },
  mealCardGradient: { flex: 1, padding: 16 },
  mealHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, borderBottomWidth: 1, borderBottomColor: "rgba(0,0,0,0.05)", paddingBottom: 12 },
  mealIconWrap: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  mealTitle: { color: COLORS.textDark, fontSize: 18, fontWeight: "900" },
  mealContent: { paddingTop: 2 },
  mealItemRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  mealItemText: { color: COLORS.textMain, fontSize: 15, fontWeight: '600', flex: 1, lineHeight: 22 },

  inputCard: { backgroundColor: COLORS.white, padding: 18, borderRadius: 24, borderWidth: 1, borderColor: COLORS.border, marginBottom: 20 },
  platePaywall: { borderRadius: 22, overflow: "hidden" },
  platePaywallInner: {
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 22,
  },
  platePaywallTitle: { fontSize: 20, fontWeight: "900", color: COLORS.textDark, marginTop: 12, marginBottom: 8 },
  platePaywallText: { fontSize: 14, color: COLORS.textMain, textAlign: "center", lineHeight: 20, marginBottom: 18 },
  platePaywallBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: COLORS.secondary,
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: 16,
  },
  platePaywallBtnText: { color: COLORS.white, fontWeight: "800", fontSize: 15 },
  plateAnalyzerBox: { backgroundColor: COLORS.bg, padding: 14, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border, marginBottom: 16 },
  plateAnalyzerHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  platePortionLabel: {
    color: COLORS.textDark,
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 6,
  },
  platePortionHint: {
    color: COLORS.textMain,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '500',
    marginBottom: 12,
  },
  platePortionHintStrong: { fontWeight: '800', color: COLORS.secondary },
  portionRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  portionPill: { flex: 1, paddingVertical: 10, borderRadius: 16, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  portionPillActive: { backgroundColor: COLORS.secondary, borderColor: COLORS.secondary },
  portionPillText: { color: COLORS.textLight, fontWeight: '900', fontSize: 13 },
  portionPillTextActive: { color: COLORS.white },
  plateCaptureButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.secondary, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 12, marginBottom: 10 },
  plateCaptureButtonText: { color: COLORS.white, fontWeight: '900', fontSize: 14 },
  platePreview: { width: '100%', height: 180, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.white, marginBottom: 10 },
  plateErrorText: { color: COLORS.redish, fontWeight: '800', marginBottom: 10 },
  plateResultBox: { padding: 12, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.white },
  plateResultTitle: { color: COLORS.textDark, fontSize: 14, fontWeight: '900', marginBottom: 4 },
  plateCalories: { color: COLORS.secondary, fontWeight: '900', fontSize: 22, marginBottom: 8 },
  plateMacrosRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 10 },
  plateMacroLine: { color: COLORS.textMain, fontSize: 12, fontWeight: '700' },
  plateMicrosRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  plateMicroLine: { color: COLORS.textLight, fontSize: 12, fontWeight: '700' },
  primaryButton: { borderRadius: 16, overflow: 'hidden' },
  primaryButtonGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14 },
  primaryButtonText: { color: COLORS.white, fontWeight: "800", fontSize: 14 },

  aiHero: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, padding: 16, borderRadius: 20, marginBottom: 15, borderWidth: 1, borderColor: COLORS.border },
  aiHeroIconWrap: { width: 50, height: 50, borderRadius: 16, backgroundColor: COLORS.purpleLight, alignItems: 'center', justifyContent: 'center', marginRight: 15 },
  aiHeroTitle: { color: COLORS.textDark, fontSize: 18, fontWeight: "800", marginBottom: 2 },
  aiHeroSub: { color: COLORS.textMain, fontSize: 12, fontWeight: '500' },
  aiSubTabContainer: { flexDirection: 'row', gap: 10, marginBottom: 15 },
  aiSubTab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, backgroundColor: COLORS.white, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border },
  aiSubTabActive: { backgroundColor: COLORS.purple, borderColor: COLORS.purple },
  aiSubTabText: { color: COLORS.purple, fontSize: 16, fontWeight: '900' },
  aiSubTabTextActive: { color: COLORS.white },
  aiTabScrollContent: { paddingBottom: 120 },
  aiCard: { padding: 20, borderRadius: 24, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border },
  aiInputLabel: { color: COLORS.textDark, fontSize: 15, fontWeight: "800", marginBottom: 12 },
  aiInput: { backgroundColor: COLORS.bg, borderRadius: 16, color: COLORS.textDark, padding: 16, minHeight: 90, textAlignVertical: 'top', marginBottom: 15, borderWidth: 1, borderColor: COLORS.border, fontSize: 14, fontWeight: '500' },
  aiButtonSmall: { backgroundColor: COLORS.purple, paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  aiButtonTextSmall: { color: COLORS.white, fontWeight: "800", fontSize: 14 },
  aiEmptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', opacity: 0.5, marginTop: 20 },
  aiEmptyText: { color: COLORS.textMain, fontSize: 13, fontWeight: '600', marginTop: 10, textAlign: 'center' },
  aiAnswerContainer: { backgroundColor: COLORS.purpleLight, padding: 18, borderRadius: 16 },
  aiAnswerTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  aiAnswerLabel: { color: COLORS.purple, fontSize: 13, fontWeight: "800" },
  aiAnswerText: { color: COLORS.textDark, lineHeight: 22, fontSize: 14, fontWeight: '600' },
  aiErrorContainer: { backgroundColor: 'rgba(255, 91, 91, 0.12)', padding: 18, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255, 91, 91, 0.25)' },
  aiErrorLabel: { color: COLORS.redish, fontSize: 13, fontWeight: '800' },
  aiErrorText: { color: COLORS.textDark, lineHeight: 22, fontSize: 14, fontWeight: '600' },
  userInfoBadgeWrap: { flexDirection: 'row', gap: 10, marginBottom: 15 },
  userInfoBadge: { backgroundColor: COLORS.bg, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  userInfoLabel: { color: COLORS.textLight, fontSize: 12, fontWeight: '700', marginRight: 6 },
  userInfoValue: { color: COLORS.textDark, fontSize: 13, fontWeight: '800' },
  generatedPlanBox: { paddingTop: 10 },
  planMacroRow: { flexDirection: 'row', gap: 10, marginBottom: 15 },
  planMacroBadge: { backgroundColor: COLORS.purpleLight, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12 },
  planMacroText: { color: COLORS.purple, fontWeight: "900", fontSize: 15 },
  planMealItem: { marginBottom: 14, backgroundColor: COLORS.bg, padding: 20, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border },
  planMealTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 10,
    flexWrap: 'wrap',
  },
  planMealTitle: { color: COLORS.textDark, fontWeight: "900", fontSize: 17, flex: 1, minWidth: 120 },
  mealCaloriesBadge: {
    color: COLORS.purple,
    fontWeight: '900',
    fontSize: 13,
    backgroundColor: COLORS.purpleLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    overflow: 'hidden',
  },
  aiMealBulletRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  planMealFood: { color: COLORS.textMain, fontSize: 16, fontWeight: '600', flex: 1, lineHeight: 24 },
  mealItemEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 6,
    gap: 8,
  },
  mealItemMiniLabel: { color: COLORS.textLight, fontSize: 12, fontWeight: '700' },
  mealQtyInput: {
    minWidth: 44,
    maxWidth: 72,
    backgroundColor: COLORS.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 6,
    paddingHorizontal: 10,
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textDark,
    textAlign: 'center',
  },
  mealItemUnit: { color: COLORS.textMain, fontSize: 13, fontWeight: '700' },
  mealItemKcal: { marginLeft: 'auto', color: COLORS.accent, fontSize: 13, fontWeight: '900' },
  mealSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: COLORS.secondary,
    alignSelf: 'flex-start',
  },
  mealSaveBtnText: { color: COLORS.white, fontWeight: '900', fontSize: 13 },

  planRecommendationsBox: { backgroundColor: COLORS.purpleLight, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: COLORS.border, marginBottom: 14 },
  planRecommendationsTitle: { color: COLORS.purple, fontSize: 16, fontWeight: '900', marginBottom: 8 },
  planRecommendationsText: { color: COLORS.textDark, fontSize: 14, fontWeight: '600', lineHeight: 22 },

  weekDaySection: { marginBottom: 22, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)' },
  weekDayTitle: { color: COLORS.textDark, fontWeight: '900', fontSize: 18, marginBottom: 10 },
  weekDayEmpty: { color: COLORS.textMain, fontWeight: '600', marginBottom: 10, opacity: 0.75 },

  dietPlanNameCard: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    marginBottom: 14,
  },
  dietPlanNameRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  dietPlanNameInput: {
    flex: 1,
    backgroundColor: COLORS.bg,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textDark,
  },
  dietPlanNameInputSingle: {
    backgroundColor: COLORS.bg,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textDark,
    marginBottom: 4,
  },
  dietPlanNameSaveBtn: {
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 14,
    backgroundColor: COLORS.purple,
    minWidth: 76,
    alignItems: "center",
    justifyContent: "center",
  },
  dietPlanNameSaveBtnText: { color: COLORS.white, fontWeight: "900", fontSize: 13 },
  savedPlanCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border, padding: 18, marginTop: 12 },
  savedPlanName: { color: COLORS.textDark, fontWeight: '900', fontSize: 14 },
  savedPlanDate: { color: COLORS.textLight, fontWeight: '700', fontSize: 12, marginTop: 4 },
  savedPlanBtn: { borderWidth: 1, borderColor: COLORS.purpleLight, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 16, backgroundColor: COLORS.purpleLight },
  savedPlanBtnText: { fontWeight: '900', color: COLORS.purple, fontSize: 15 },

  aiDayPill: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 18,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  aiDayPillActive: {
    backgroundColor: COLORS.purple,
    borderColor: COLORS.purple,
  },
  aiDayPillText: {
    fontWeight: '900',
    fontSize: 14,
    color: COLORS.textLight,
  },
  aiDayPillTextActive: {
    color: COLORS.white,
  },

  });
}

export default DietPage;