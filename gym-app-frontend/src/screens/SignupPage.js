import React, { useState, useMemo } from "react";
import {
  StyleSheet,
  Text,
  View,
  Image,
  Pressable,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

import Layout from "../components/Layout";
import ApiService from "../services/api";
import { useDispatch } from "react-redux";
import { setAuth, setUser, setToken } from "../redux/userSlice";
import { useTheme } from "../theme/ThemeContext";
import LanguageSwitcher from "../components/LanguageSwitcher";
import { useTranslation } from "react-i18next";
import { displayText } from "../utils/displayTranslations";

const { width, height } = Dimensions.get("window");

function formatTurkishPhoneInput(value) {
  const digits = String(value || "").replace(/\D/g, "");
  let local = digits;

  if (local.startsWith("90")) local = local.slice(2);
  if (local.startsWith("0")) local = local.slice(1);
  local = local.slice(0, 10);

  const parts = [];
  if (local.length > 0) parts.push(local.slice(0, 3));
  if (local.length > 3) parts.push(local.slice(3, 6));
  if (local.length > 6) parts.push(local.slice(6, 8));
  if (local.length > 8) parts.push(local.slice(8, 10));

  return parts.join(" ");
}

function normalizeTurkishPhoneForApi(value) {
  const digits = String(value || "").replace(/\D/g, "");
  let local = digits;

  if (local.startsWith("90")) local = local.slice(2);
  if (local.startsWith("0")) local = local.slice(1);

  if (!local) return null;
  if (!/^5\d{9}$/.test(local)) return undefined;
  return `+90${local}`;
}

function formatBirthDateInput(value) {
  const digits = String(value || "").replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4)}`;
}

function parseBirthDateForApi(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length !== 8) return undefined;

  const day = Number(digits.slice(0, 2));
  const month = Number(digits.slice(2, 4));
  const year = Number(digits.slice(4, 8));
  const date = new Date(Date.UTC(year, month - 1, day));
  const isValid =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;

  if (!isValid || date > new Date()) return undefined;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function createSignupPageStyles(COLORS) {
  return StyleSheet.create({
    mainContainer: { flex: 1, backgroundColor: COLORS.bg },
    decorativeCircle: {
      position: "absolute",
      top: -height * 0.05,
      left: -width * 0.2,
      width: width * 0.7,
      height: width * 0.7,
      borderRadius: width * 0.35,
      backgroundColor: COLORS.primaryLight,
    },
    scrollContent: { paddingHorizontal: 25, paddingVertical: 20 },
    header: {
      alignItems: "center",
      marginBottom: 25,
    },
    logoBox: {
      width: 150,
      height: 150,
      backgroundColor: COLORS.white,
      borderRadius: 20,
      justifyContent: "center",
      alignItems: "center",
      shadowColor: COLORS.primary,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.1,
      shadowRadius: 15,
      elevation: 5,
      marginBottom: 15,
    },
    logo: { width: 250, height: 250, resizeMode: "contain" },
    pageTitle: { fontSize: 26, fontWeight: "900", color: COLORS.textDark, letterSpacing: -0.5 },
    pageSubtitle: { fontSize: 13, color: COLORS.textMain, fontWeight: "600", marginTop: 2 },

    formCard: {
      backgroundColor: COLORS.white,
      borderRadius: 32,
      padding: 22,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 20 },
      shadowOpacity: 0.05,
      shadowRadius: 30,
      elevation: 5,
    },
    row: { flexDirection: "row" },
    inputGroup: { marginBottom: 15 },
    label: { fontSize: 10, fontWeight: "800", color: COLORS.textMain, marginBottom: 6, marginLeft: 5, letterSpacing: 1 },
    inputWrapper: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: COLORS.inputBg,
      borderRadius: 14,
      paddingHorizontal: 15,
      height: 52,
      borderWidth: 1,
      borderColor: COLORS.inputBorder,
    },
    inputIcon: { marginRight: 10 },
    input: { flex: 1, color: COLORS.textDark, fontSize: 14, fontWeight: "600" },

    btnShadow: {
      marginTop: 10,
      shadowColor: COLORS.primary,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.3,
      shadowRadius: 15,
      elevation: 8,
    },
    registerBtn: {
      height: 55,
      borderRadius: 16,
      justifyContent: "center",
      alignItems: "center",
    },
    registerBtnText: { color: "#FFF", fontSize: 16, fontWeight: "800", letterSpacing: 1 },

    footer: { flexDirection: "row", justifyContent: "center", marginTop: 20 },
    footerText: { fontSize: 13, color: COLORS.textMain, fontWeight: "600" },
    loginLink: { fontSize: 13, color: COLORS.primary, fontWeight: "800" },
  });
}

const SignupPage = ({ navigation }) => {
  const dispatch = useDispatch();
  const { colors: C } = useTheme();
  const { t, i18n } = useTranslation();

  const COLORS = useMemo(
    () => ({
      bg: C.loginBg,
      white: C.white,
      textDark: C.loginTextDark,
      textMain: C.loginTextMain,
      primary: C.primary,
      primaryDark: C.primaryDark,
      primaryLight: C.primaryLight,
      inputBg: C.surfaceMuted,
      inputBorder: C.loginBorder,
    }),
    [C]
  );
  const styles = useMemo(() => createSignupPageStyles(COLORS), [COLORS]);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !password.trim()) {
      Alert.alert(t("auth.alerts.missingTitle"), t("auth.alerts.missingSignup"));
      return;
    }

    const normalizedPhoneNumber = normalizeTurkishPhoneForApi(phoneNumber);
    if (normalizedPhoneNumber === undefined) {
      Alert.alert(t("auth.alerts.errorTitle"), t("auth.alerts.invalidPhone"));
      return;
    }

    const normalizedDateOfBirth = parseBirthDateForApi(dateOfBirth);
    if (normalizedDateOfBirth === undefined) {
      Alert.alert(t("auth.alerts.errorTitle"), t("auth.alerts.invalidBirthDate"));
      return;
    }

    setLoading(true);
    const userData = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim(),
      password: password.trim(),
      phoneNumber: normalizedPhoneNumber,
      dateOfBirth: normalizedDateOfBirth,
    };

    try {
      const registerResponse = await ApiService.register(userData);
      if (registerResponse.success) {
        const loginResponse = await ApiService.login({
          email: userData.email,
          password: userData.password,
        });

        if (loginResponse.success) {
          dispatch(setAuth(true));
          dispatch(setUser(loginResponse.data.user));
          dispatch(setToken(loginResponse.data.token));
          Alert.alert(
            t("auth.alerts.welcomeTitle"),
            t("auth.alerts.welcomeSignup", { name: loginResponse.data.user.firstName })
          );
        } else {
          navigation.navigate("Login");
        }
      } else {
        Alert.alert(t("auth.alerts.registerErrorTitle"), displayText(registerResponse.message || t("auth.alerts.registerFailed"), i18n.language));
      }
    } catch (error) {
      Alert.alert(t("auth.alerts.errorTitle"), displayText(error.message || t("auth.alerts.serverFailed"), i18n.language));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <View style={styles.mainContainer}>
        <View style={styles.decorativeCircle} />
        <LanguageSwitcher colors={COLORS} />

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <SafeAreaView style={styles.header}>
              <View style={styles.logoBox}>
                <Image style={styles.logo} source={require("../../assets/images/logo.png")} />
              </View>
              <Text style={styles.pageTitle}>{t("auth.signup.title")}</Text>
              <Text style={styles.pageSubtitle}>{t("auth.signup.subtitle")}</Text>
            </SafeAreaView>

            <View style={styles.formCard}>
              <View style={styles.row}>
                <View style={[styles.inputGroup, { flex: 1, marginRight: 10 }]}>
                  <Text style={styles.label}>{t("auth.signup.firstName")}</Text>
                  <View style={styles.inputWrapper}>
                    <TextInput
                      style={styles.input}
                      placeholder={t("auth.signup.firstNamePlaceholder")}
                      placeholderTextColor={COLORS.textMain}
                      value={firstName}
                      onChangeText={setFirstName}
                    />
                  </View>
                </View>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.label}>{t("auth.signup.lastName")}</Text>
                  <View style={styles.inputWrapper}>
                    <TextInput
                      style={styles.input}
                      placeholder={t("auth.signup.lastNamePlaceholder")}
                      placeholderTextColor={COLORS.textMain}
                      value={lastName}
                      onChangeText={setLastName}
                    />
                  </View>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>{t("auth.email")}</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="mail" size={18} color={COLORS.primary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder={t("auth.emailPlaceholder")}
                    placeholderTextColor={COLORS.textMain}
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>{t("auth.password")}</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="lock-closed" size={18} color={COLORS.primary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="••••••••"
                    placeholderTextColor={COLORS.textMain}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>{t("auth.signup.phone")}</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="call" size={18} color={COLORS.primary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="5XX XXX XX XX"
                    placeholderTextColor={COLORS.textMain}
                    value={phoneNumber}
                    onChangeText={(text) => setPhoneNumber(formatTurkishPhoneInput(text))}
                    keyboardType="phone-pad"
                    textContentType="telephoneNumber"
                    maxLength={13}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>{t("auth.signup.birthDate")}</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="calendar" size={18} color={COLORS.primary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder={t("auth.signup.birthDatePlaceholder")}
                    placeholderTextColor={COLORS.textMain}
                    value={dateOfBirth}
                    onChangeText={(text) => setDateOfBirth(formatBirthDateInput(text))}
                    keyboardType="number-pad"
                    textContentType="birthdate"
                    maxLength={10}
                  />
                </View>
              </View>

              <Pressable
                onPress={handleRegister}
                disabled={loading}
                style={({ pressed }) => [styles.btnShadow, { transform: [{ scale: pressed ? 0.97 : 1 }] }]}
              >
                <LinearGradient
                  colors={[COLORS.primary, COLORS.primaryDark]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.registerBtn}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <Text style={styles.registerBtnText}>{t("auth.signup.button")}</Text>
                  )}
                </LinearGradient>
              </Pressable>

              <View style={styles.footer}>
                <Text style={styles.footerText}>{t("auth.signup.footerText")}</Text>
                <Pressable onPress={() => navigation.navigate("Login")}>
                  <Text style={styles.loginLink}>{t("auth.signup.footerLink")}</Text>
                </Pressable>
              </View>
            </View>

            <View style={{ height: 40 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Layout>
  );
};

export default SignupPage;
