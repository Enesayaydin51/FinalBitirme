import React, { useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { supportedLanguages } from "../i18n";

export default function LanguageSwitcher({ colors, inline = false }) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);

  const activeLanguage = useMemo(() => {
    const current = i18n.resolvedLanguage || i18n.language || "tr";
    return supportedLanguages.find((language) => current.startsWith(language.code)) || supportedLanguages[0];
  }, [i18n.language, i18n.resolvedLanguage]);

  const styles = useMemo(() => createLanguageSwitcherStyles(colors, inline), [colors, inline]);

  const changeLanguage = async (languageCode) => {
    await i18n.changeLanguage(languageCode);
    setOpen(false);
  };

  return (
    <View style={styles.wrap}>
      <Pressable
        style={({ pressed }) => [styles.button, pressed && { opacity: 0.85 }]}
        onPress={() => setOpen(true)}
      >
        <Text style={styles.flag}>{activeLanguage.flag}</Text>
        <Text style={styles.shortLabel}>{activeLanguage.shortLabel}</Text>
        <Ionicons name="chevron-down" size={13} color={colors.textMain} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setOpen(false)}>
          <View style={styles.menu}>
            {supportedLanguages.map((language) => {
              const selected = activeLanguage.code === language.code;
              return (
                <Pressable
                  key={language.code}
                  style={[styles.option, selected && styles.optionActive]}
                  onPress={() => changeLanguage(language.code)}
                >
                  <Text style={styles.optionFlag}>{language.flag}</Text>
                  <Text style={[styles.optionText, selected && styles.optionTextActive]}>
                    {language.shortLabel} - {t(language.labelKey)}
                  </Text>
                  {selected ? <Ionicons name="checkmark" size={18} color={colors.primary} /> : null}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

function createLanguageSwitcherStyles(colors, inline) {
  return StyleSheet.create({
    wrap: inline
      ? {
          zIndex: 20,
        }
      : {
          position: "absolute",
          top: 52,
          right: 20,
          zIndex: 20,
        },
    button: {
      minWidth: 76,
      height: 40,
      borderRadius: 14,
      backgroundColor: colors.white,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 10,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 4,
    },
    flag: {
      fontSize: 18,
      marginRight: 5,
    },
    shortLabel: {
      color: colors.textDark,
      fontSize: 12,
      fontWeight: "900",
      marginRight: 3,
    },
    overlay: {
      flex: 1,
      backgroundColor: "rgba(15, 23, 42, 0.22)",
      alignItems: "flex-end",
      paddingTop: 96,
      paddingRight: 20,
    },
    menu: {
      width: 190,
      backgroundColor: colors.white,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      padding: 8,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 14 },
      shadowOpacity: 0.12,
      shadowRadius: 20,
      elevation: 8,
    },
    option: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 11,
      paddingHorizontal: 10,
      borderRadius: 12,
    },
    optionActive: {
      backgroundColor: colors.primaryLight,
    },
    optionFlag: {
      fontSize: 20,
      marginRight: 9,
    },
    optionText: {
      flex: 1,
      color: colors.textMain,
      fontSize: 13,
      fontWeight: "800",
    },
    optionTextActive: {
      color: colors.primary,
    },
  });
}
