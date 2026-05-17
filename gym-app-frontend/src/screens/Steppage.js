import React, { useEffect, useMemo, useRef, useState } from "react";
import Svg, { Circle } from "react-native-svg";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Dimensions,
  Platform,
  AppState,
  ScrollView,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Pedometer } from "expo-sensors";
import {
  aggregateRecord,
  getGrantedPermissions,
  getSdkStatus,
  initialize,
  readRecords,
  requestPermission,
  SdkAvailabilityStatus,
} from "react-native-health-connect";
import AnimatedCounter from "../components/AnimatedCounter";
import Layout from "../components/Layout";
import { useTheme } from "../theme/ThemeContext";
import { useTranslation } from "react-i18next";

const { width } = Dimensions.get("window");

const getCommonStyles = (COLORS) =>
  StyleSheet.create({
    shadowLight: {
      ...Platform.select({
        ios: {
          shadowColor: COLORS.shadow,
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.06,
          shadowRadius: 15,
        },
        android: {
          elevation: 3,
        },
      }),
    },
    shadowPremium: {
      ...Platform.select({
        ios: {
          shadowColor: COLORS.purple,
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.25,
          shadowRadius: 15,
        },
        android: {
          elevation: 6,
        },
      }),
    },
  });

const createStyles = (COLORS, resolvedMode) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: COLORS.bg,
    },
    container: {
      flex: 1,
      backgroundColor: COLORS.bg,
    },
    backgroundDecorPrimary: {
      position: "absolute",
      top: -110,
      left: -70,
      width: 260,
      height: 260,
      borderRadius: 130,
      backgroundColor: COLORS.primaryLight,
      opacity: resolvedMode === "dark" ? 0.4 : 0.9,
    },
    backgroundDecorSecondary: {
      position: "absolute",
      top: 140,
      right: -90,
      width: 220,
      height: 220,
      borderRadius: 110,
      backgroundColor: COLORS.secondaryLight,
      opacity: resolvedMode === "dark" ? 0.28 : 0.85,
    },
    scrollContent: {
      paddingHorizontal: 20,
      paddingTop: 10,
      paddingBottom: Platform.OS === "ios" ? 140 : 150,
    },

    topBar: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 14,
    },
    dateText: {
      color: COLORS.textLight,
      fontSize: 12,
      fontWeight: "700",
      letterSpacing: 0.5,
      marginBottom: 4,
    },
    pageTitle: {
      fontSize: 28,
      fontWeight: "800",
      color: COLORS.textDark,
      letterSpacing: -0.5,
    },
    iconButton: {
      width: 44,
      height: 44,
      borderRadius: 16,
      backgroundColor: COLORS.white,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: COLORS.border,
    },

    statusCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: COLORS.white,
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 12,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    statusDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      marginRight: 10,
    },
    statusText: {
      flex: 1,
      color: COLORS.textMain,
      fontSize: 13,
      fontWeight: "600",
    },
    healthConnectButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: COLORS.primary,
      borderRadius: 16,
      paddingHorizontal: 16,
      paddingVertical: 14,
      marginBottom: 16,
    },
    healthConnectButtonText: {
      color: COLORS.white,
      fontSize: 14,
      fontWeight: "700",
    },

    heroCard: {
      backgroundColor: COLORS.white,
      borderRadius: 32,
      padding: 25,
      alignItems: "center",
      marginBottom: 20,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    heroTitle: {
      color: COLORS.textDark,
      fontSize: 16,
      fontWeight: "700",
      marginBottom: 20,
    },
    ringContainer: {
      width: 180,
      height: 180,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 20,
    },
    ringBackground: {
      width: 180,
      height: 180,
      borderRadius: 90,
      backgroundColor: COLORS.primaryLight,
      alignItems: "center",
      justifyContent: "center",
      position: "relative",
    },
    ringSvg: {
      position: "absolute",
      top: 0,
      left: 0,
    },
    ringInner: {
      width: 150,
      height: 150,
      borderRadius: 75,
      backgroundColor: COLORS.white,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: resolvedMode === "dark" ? "#000" : "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: resolvedMode === "dark" ? 0.18 : 0.05,
      shadowRadius: 10,
      elevation: 2,
    },
    stepValue: {
      fontSize: 36,
      fontWeight: "900",
      color: COLORS.textDark,
      letterSpacing: -1,
    },
    stepLabel: {
      fontSize: 12,
      color: COLORS.textLight,
      fontWeight: "700",
      letterSpacing: 1,
    },
    heroSubtitle: {
      color: COLORS.textMain,
      fontSize: 14,
      fontWeight: "500",
      textAlign: "center",
    },

    dashboardBottom: {
      justifyContent: "space-between",
    },
    gridRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: 15,
    },
    gridCard: {
      flex: 1,
      backgroundColor: COLORS.white,
      borderRadius: 24,
      padding: 18,
      borderWidth: 1,
      borderColor: COLORS.border,
      minHeight: 140,
      justifyContent: "space-between",
    },
    gridHeader: {
      flexDirection: "row",
      justifyContent: "flex-start",
    },
    iconBox: {
      width: 44,
      height: 44,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    gridContent: {
      flexDirection: "row",
      alignItems: "baseline",
      marginTop: 15,
      marginBottom: 5,
      flexWrap: "wrap",
    },
    gridValue: {
      fontSize: 24,
      fontWeight: "800",
      color: COLORS.textDark,
      letterSpacing: -0.5,
    },
    gridUnit: {
      fontSize: 12,
      fontWeight: "700",
      color: COLORS.textLight,
      marginLeft: 4,
    },
    gridLabel: {
      fontSize: 13,
      color: COLORS.textMain,
      fontWeight: "600",
    },

    infoCard: {
      backgroundColor: COLORS.white,
      borderRadius: 24,
      padding: 18,
      borderWidth: 1,
      borderColor: COLORS.border,
      marginTop: 15,
    },
    infoRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
    },
    infoLabel: {
      fontSize: 15,
      fontWeight: "700",
      color: COLORS.textDark,
    },
    infoValue: {
      fontSize: 15,
      fontWeight: "800",
      color: COLORS.primary,
    },
    progressTrack: {
      width: "100%",
      height: 10,
      borderRadius: 999,
      backgroundColor: COLORS.primaryLight,
      overflow: "hidden",
      marginBottom: 10,
    },
    progressFill: {
      height: "100%",
      borderRadius: 999,
      backgroundColor: COLORS.primary,
    },
    infoSub: {
      fontSize: 13,
      color: COLORS.textMain,
      fontWeight: "600",
    },

    rewardCard: {
      width: "100%",
      borderRadius: 24,
      overflow: "hidden",
      marginTop: 15,
    },
    rewardGradient: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      padding: 20,
    },
    rewardLeft: {
      flexDirection: "row",
      alignItems: "center",
    },
    rewardIconBox: {
      width: 46,
      height: 46,
      borderRadius: 16,
      backgroundColor: COLORS.white,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 15,
    },
    rewardTitle: {
      color: COLORS.white,
      fontSize: 16,
      fontWeight: "800",
      marginBottom: 2,
    },
    rewardSub: {
      color: "rgba(255,255,255,0.8)",
      fontSize: 12,
      fontWeight: "500",
    },
    rewardBadge: {
      backgroundColor: "rgba(255,255,255,0.2)",
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 12,
    },
    rewardBadgeText: {
      color: COLORS.white,
      fontSize: 10,
      fontWeight: "800",
      letterSpacing: 0.5,
    },
  });

const STEP_GOAL = 10000;
const KM_PER_STEP = 0.0008; // yaklaşık 0.8 m / adım
const KCAL_PER_STEP = 0.04; // yaklaşık tahmini değer
const HEALTH_CONNECT_PERMISSIONS = [{ accessType: "read", recordType: "Steps" }];
const HEALTH_CONNECT_PACKAGE = "com.google.android.apps.healthdata";
const HEALTH_CONNECT_PLAY_STORE_URL = `market://details?id=${HEALTH_CONNECT_PACKAGE}`;
const HEALTH_CONNECT_WEB_URL = `https://play.google.com/store/apps/details?id=${HEALTH_CONNECT_PACKAGE}`;

const Steppage = () => {
  const { colors: COLORS, resolvedMode } = useTheme();
  const { t, i18n } = useTranslation();
  const styles = useMemo(() => createStyles(COLORS, resolvedMode), [COLORS, resolvedMode]);
  const COMMON_STYLES = useMemo(() => getCommonStyles(COLORS), [COLORS]);

  const [stepCount, setStepCount] = useState(0);
  const [isAvailable, setIsAvailable] = useState(null);
  const [permissionGranted, setPermissionGranted] = useState(null);
  const [statusText, setStatusText] = useState("Adım verisi hazırlanıyor...");
  const [showHealthConnectInstall, setShowHealthConnectInstall] = useState(false);

  const subscriptionRef = useRef(null);
  const baseStepCountRef = useRef(0);

  const todayLabel = useMemo(() => {
    return new Date().toLocaleDateString(i18n.language === "en" ? "en-US" : "tr-TR", {
      day: "2-digit",
      month: "long",
      weekday: "long",
    }).toUpperCase();
  }, [i18n.language]);

  const activityPercent = useMemo(() => {
    return Math.min((stepCount / STEP_GOAL) * 100, 100);
  }, [stepCount]);

  const distanceKm = useMemo(() => {
    return (stepCount * KM_PER_STEP).toFixed(2);
  }, [stepCount]);

  const burnedCalories = useMemo(() => {
    return Math.round(stepCount * KCAL_PER_STEP).toString();
  }, [stepCount]);

  const ringSize = 180;
  const strokeWidth = 15;
  const radius = (ringSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const progressOffset = useMemo(() => {
    return circumference - (activityPercent / 100) * circumference;
  }, [activityPercent, circumference]);

  const stopWatching = () => {
    if (subscriptionRef.current) {
      subscriptionRef.current.remove();
      subscriptionRef.current = null;
    }
  };

  const getStartOfToday = () => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return start;
  };

  const loadTodayStepsFromHealthConnect = async () => {
    const sdkStatus = await getSdkStatus();

    if (sdkStatus !== SdkAvailabilityStatus.SDK_AVAILABLE) {
      throw new Error("HEALTH_CONNECT_UNAVAILABLE");
    }

    const initialized = await initialize();
    if (!initialized) {
      throw new Error("HEALTH_CONNECT_INIT_FAILED");
    }

    let grantedPermissions = await getGrantedPermissions();

    const hasExistingStepsPermission = grantedPermissions.some(
      (permission) =>
        permission.accessType === "read" && permission.recordType === "Steps"
    );

    if (!hasExistingStepsPermission) {
      grantedPermissions = await requestPermission(HEALTH_CONNECT_PERMISSIONS);
    }

    const hasStepsPermission = grantedPermissions.some(
      (permission) =>
        permission.accessType === "read" && permission.recordType === "Steps"
    );

    if (!hasStepsPermission) {
      throw new Error("HEALTH_CONNECT_PERMISSION_DENIED");
    }

    const start = getStartOfToday();
    const end = new Date();

    const result = await aggregateRecord({
      recordType: "Steps",
      timeRangeFilter: {
        operator: "between",
        startTime: start.toISOString(),
        endTime: end.toISOString(),
      },
    });

    const aggregatedSteps = Number(result?.COUNT_TOTAL ?? 0);
    let fallbackSteps = 0;
    let totalRecordCount = 0;
    let pageToken;

    do {
      const recordsResponse = await readRecords("Steps", {
        timeRangeFilter: {
          operator: "between",
          startTime: start.toISOString(),
          endTime: end.toISOString(),
        },
        pageSize: 1000,
        pageToken,
      });

      const records = recordsResponse?.records ?? [];
      fallbackSteps += records.reduce(
        (total, record) => total + Number(record?.count ?? 0),
        0
      );
      totalRecordCount += records.length;
      pageToken = recordsResponse?.pageToken;
    } while (pageToken);

    const resolvedSteps = Math.max(aggregatedSteps, fallbackSteps);

    console.log("Health Connect aggregate sonucu:", result);
    console.log("Health Connect çözümlenen step sonucu:", {
      aggregatedSteps,
      fallbackSteps,
      resolvedSteps,
      totalRecordCount,
    });

    return resolvedSteps;
  };

  const loadTodaySteps = async () => {
    try {
      setShowHealthConnectInstall(false);

      if (Platform.OS === "ios") {
        const start = getStartOfToday();
        const end = new Date();
        const result = await Pedometer.getStepCountAsync(start, end);
        const todaySteps = result?.steps ?? 0;

        baseStepCountRef.current = todaySteps;
        setStepCount(todaySteps);
        setStatusText("Bugünkü adımlar iPhone sensörlerinden alındı.");
      } else {
        const todaySteps = await loadTodayStepsFromHealthConnect();

        baseStepCountRef.current = todaySteps;
        setStepCount(todaySteps);
        setStatusText("Bugünkü adımlar Health Connect üzerinden alındı.");
        setIsAvailable(true);
        setPermissionGranted(true);
      }
    } catch (error) {
      console.log("Bugünkü adımlar alınamadı:", error);

      if (Platform.OS === "android") {
        const errorMessage = error?.message;

        setPermissionGranted(false);
        setIsAvailable(false);

        if (errorMessage === "HEALTH_CONNECT_UNAVAILABLE") {
          setStatusText("Health Connect bulunamadı veya kullanılamıyor.");
          setShowHealthConnectInstall(true);
        } else if (errorMessage === "HEALTH_CONNECT_PERMISSION_DENIED") {
          setStatusText("Health Connect adım okuma izni verilmedi.");
        } else {
          setStatusText(
            "Health Connect verisi alınırken hata oluştu."
          );
        }
      }
    }
  };

  const openHealthConnectInstallPage = async () => {
    try {
      const canOpenStore = await Linking.canOpenURL(HEALTH_CONNECT_PLAY_STORE_URL);

      if (canOpenStore) {
        await Linking.openURL(HEALTH_CONNECT_PLAY_STORE_URL);
        return;
      }

      await Linking.openURL(HEALTH_CONNECT_WEB_URL);
    } catch (error) {
      console.log("Health Connect mağaza yönlendirmesi başarısız:", error);
      setStatusText("Play Store açılamadı. Lütfen Health Connect'i manuel yükleyin.");
    }
  };

  const startWatching = async () => {
    try {
      stopWatching();

      if (Platform.OS === "android") {
        await loadTodaySteps();
        return;
      }

      const available = await Pedometer.isAvailableAsync();
      setIsAvailable(available);

      if (!available) {
        setStatusText("Bu cihazda adım sensörü kullanılamıyor.");
        return;
      }

      const permission = await Pedometer.requestPermissionsAsync();
      const granted = permission?.granted ?? false;
      setPermissionGranted(granted);

      if (!granted) {
        setStatusText("Adım izni verilmedi.");
        return;
      }

      await loadTodaySteps();

      if (Platform.OS === "android") {
        setIsAvailable(true);
        setPermissionGranted(true);
        return;
      }

      setStatusText("Bugünkü adımlar canlı olarak takip ediliyor.");

      subscriptionRef.current = Pedometer.watchStepCount((result) => {
        const liveSteps = result?.steps ?? 0;
        setStepCount(baseStepCountRef.current + liveSteps);
      });
    } catch (error) {
      console.log("Pedometer başlatma hatası:", error);
      setStatusText("Adım verisi alınırken hata oluştu.");
    }
  };

  useEffect(() => {
    startWatching();

    const appStateSub = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        startWatching();
      } else {
        stopWatching();
      }
    });

    return () => {
      stopWatching();
      appStateSub.remove();
    };
  }, []);

  const dailyStats = {
    steps: stepCount,
    distance: distanceKm,
    calories: burnedCalories,
    caloriesTarget: "400",
    activity: activityPercent,
  };

  const translatedStatusText =
    {
      "Adım verisi hazırlanıyor...": t("stepsPage.preparing"),
      "Bugünkü adımlar iPhone sensörlerinden alındı.": t("stepsPage.iphoneStatus"),
      "Bugünkü adımlar Health Connect üzerinden alındı.": t("stepsPage.healthStatus"),
      "Health Connect bulunamadı veya kullanılamıyor.": t("stepsPage.healthUnavailable"),
      "Health Connect adım okuma izni verilmedi.": t("stepsPage.healthPermissionDenied"),
      "Health Connect verisi alınırken hata oluştu.": t("stepsPage.healthError"),
      "Play Store açılamadı. Lütfen Health Connect'i manuel yükleyin.": t("stepsPage.playStoreError"),
      "Bu cihazda adım sensörü kullanılamıyor.": t("stepsPage.unavailableStatus"),
      "Adım izni verilmedi.": t("stepsPage.permissionDenied"),
      "Bugünkü adımlar canlı olarak takip ediliyor.": t("stepsPage.liveStatus"),
      "Adım verisi alınırken hata oluştu.": t("stepsPage.loadError"),
    }[statusText] || statusText;

  return (
    <Layout>
      <SafeAreaView style={styles.safeArea}>
        <View pointerEvents="none" style={styles.backgroundDecorPrimary} />
        <View pointerEvents="none" style={styles.backgroundDecorSecondary} />
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.topBar}>
            <View>
              <Text style={styles.dateText}>{todayLabel}</Text>
              <Text style={styles.pageTitle}>{t("stepsPage.title")}</Text>
            </View>
            <View style={[styles.iconButton, COMMON_STYLES.shadowLight]}>
              <Ionicons name="calendar-outline" size={22} color={COLORS.primary} />
            </View>
          </View>

          <View style={[styles.statusCard, COMMON_STYLES.shadowLight]}>
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor:
                    isAvailable && permissionGranted
                      ? COLORS.success
                      : permissionGranted === false
                      ? COLORS.danger
                      : COLORS.accent,
                },
              ]}
            />
            <Text style={styles.statusText}>{translatedStatusText}</Text>
          </View>

          {showHealthConnectInstall && (
            <Pressable
              style={[styles.healthConnectButton, COMMON_STYLES.shadowLight]}
              onPress={openHealthConnectInstallPage}
            >
              <MaterialCommunityIcons
                name="google-play"
                size={20}
                color={COLORS.white}
              />
              <Text style={styles.healthConnectButtonText}>
                {t("stepsPage.installHealthConnect")}
              </Text>
            </Pressable>
          )}

          <View style={[styles.heroCard, COMMON_STYLES.shadowLight]}>
            <Text style={styles.heroTitle}>{t("stepsPage.dailyGoal")}</Text>

            <View style={styles.ringContainer}>
              <View style={styles.ringBackground}>
                <Svg width={ringSize} height={ringSize} style={styles.ringSvg}>
                  <Circle
                    stroke={COLORS.primaryLight}
                    fill="none"
                    cx={ringSize / 2}
                    cy={ringSize / 2}
                    r={radius}
                    strokeWidth={strokeWidth}
                  />
                  <Circle
                    stroke={COLORS.primary}
                    fill="none"
                    cx={ringSize / 2}
                    cy={ringSize / 2}
                    r={radius}
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={progressOffset}
                    transform={`rotate(-90 ${ringSize / 2} ${ringSize / 2})`}
                  />
                </Svg>

                <View style={styles.ringInner}>
                  <MaterialCommunityIcons
                    name="shoe-print"
                    size={32}
                    color={COLORS.primary}
                    style={{ marginBottom: 5 }}
                  />
                  <AnimatedCounter
                    targetValue={dailyStats.steps}
                    style={styles.stepValue}
                  />
                  <Text style={styles.stepLabel}>{t("stepsPage.stepUnit")}</Text>
                </View>
              </View>
            </View>

            <Text style={styles.heroSubtitle}>
              {dailyStats.steps >= STEP_GOAL
                ? t("stepsPage.completed")
                : t("stepsPage.remaining", { count: STEP_GOAL - dailyStats.steps })}
            </Text>
          </View>

          <View style={styles.dashboardBottom}>
            <View style={styles.gridRow}>
              <View style={[styles.gridCard, COMMON_STYLES.shadowLight]}>
                <View style={styles.gridHeader}>
                  <View style={[styles.iconBox, { backgroundColor: COLORS.secondaryLight }]}>
                    <MaterialCommunityIcons
                      name="map-marker-distance"
                      size={22}
                      color={COLORS.secondary}
                    />
                  </View>
                </View>
                <View style={styles.gridContent}>
                  <Text style={styles.gridValue}>{dailyStats.distance}</Text>
                  <Text style={styles.gridUnit}>KM</Text>
                </View>
                <Text style={styles.gridLabel}>{t("stepsPage.distance")}</Text>
              </View>

              <View style={[styles.gridCard, COMMON_STYLES.shadowLight]}>
                <View style={styles.gridHeader}>
                  <View style={[styles.iconBox, { backgroundColor: COLORS.accentLight }]}>
                    <Ionicons name="flame" size={22} color={COLORS.accent} />
                  </View>
                </View>
                <View style={styles.gridContent}>
                  <Text style={styles.gridValue}>{dailyStats.calories}</Text>
                  <Text style={styles.gridUnit}>/ {dailyStats.caloriesTarget} KCAL</Text>
                </View>
                <Text style={styles.gridLabel}>{t("stepsPage.burn")}</Text>
              </View>
            </View>

            <View style={[styles.infoCard, COMMON_STYLES.shadowLight]}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>{t("stepsPage.progress")}</Text>
                <Text style={styles.infoValue}>%{Math.round(dailyStats.activity)}</Text>
              </View>

              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${Math.min(dailyStats.activity, 100)}%` },
                  ]}
                />
              </View>

              <Text style={styles.infoSub}>
                {t("stepsPage.target", { count: STEP_GOAL.toLocaleString(i18n.language === "en" ? "en-US" : "tr-TR") })}
              </Text>
            </View>

            
          </View>
        </ScrollView>
      </SafeAreaView>
    </Layout>
  );
};

export default Steppage;
