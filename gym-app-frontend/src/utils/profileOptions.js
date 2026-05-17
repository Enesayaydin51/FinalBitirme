export const GOAL_OPTIONS = [
  { key: "gain_weight", backendValue: "Kilo Alma", labelKey: "profile.goals.gainWeight" },
  { key: "lose_weight", backendValue: "Kilo Verme", labelKey: "profile.goals.loseWeight" },
  { key: "maintain_weight", backendValue: "Kilo Koruma", labelKey: "profile.goals.maintainWeight" },
  { key: "build_muscle", backendValue: "Kas Geliştirme", labelKey: "profile.goals.buildMuscle" },
];

export const GENDER_OPTIONS = [
  { key: "male", backendValue: "Erkek", labelKey: "profile.genders.male" },
  { key: "female", backendValue: "Kadın", labelKey: "profile.genders.female" },
  { key: "other", backendValue: "Diğer", labelKey: "profile.genders.other" },
];

export const INJURY_OPTIONS = [
  { key: "belFitigi", backendValue: "Bel Fıtığı", labelKey: "profile.injuries.backHernia" },
  { key: "boyunFitigi", backendValue: "Boyun Fıtığı", labelKey: "profile.injuries.neckHernia" },
  { key: "dizSakatligi", backendValue: "Diz Sakatlığı", labelKey: "profile.injuries.kneeInjury" },
  { key: "omuzSakatligi", backendValue: "Omuz Sakatlığı", labelKey: "profile.injuries.shoulderInjury" },
  { key: "ayakBilegiSakatligi", backendValue: "Ayak Bileği Sakatlığı", labelKey: "profile.injuries.ankleInjury" },
  { key: "bilekDirsekTendiniti", backendValue: "Bilek / Dirsek Tendiniti", labelKey: "profile.injuries.wristElbowTendinitis" },
  { key: "kalcaSakroiliak", backendValue: "Kalça Ağrısı / Sakroiliak", labelKey: "profile.injuries.hipSacroiliac" },
  { key: "meniskusBag", backendValue: "Menisküs / Bağ Yaralanması", labelKey: "profile.injuries.meniscusLigament" },
  { key: "skolyozKifoz", backendValue: "Skolyoz / Kifoz", labelKey: "profile.injuries.scoliosisKyphosis" },
  { key: "osteoporoz", backendValue: "Osteoporoz", labelKey: "profile.injuries.osteoporosis" },
  { key: "kalpDamarAritmi", backendValue: "Kalp-Damar Hastalığı / Aritmi", labelKey: "profile.injuries.cardiovascularArrhythmia" },
  { key: "astim", backendValue: "Astım", labelKey: "profile.injuries.asthma" },
  { key: "yuksekTansiyon", backendValue: "Yüksek Tansiyon", labelKey: "profile.injuries.highBloodPressure" },
  { key: "dusukTansiyon", backendValue: "Düşük Tansiyon", labelKey: "profile.injuries.lowBloodPressure" },
  { key: "obezlik", backendValue: "Obezlik", labelKey: "profile.injuries.obesity" },
  { key: "tip2Diyabet", backendValue: "Tip 2 Diyabet", labelKey: "profile.injuries.type2Diabetes" },
  { key: "tiroidHastaligi", backendValue: "Tiroid Hastalığı", labelKey: "profile.injuries.thyroidDisease" },
  { key: "hamilelikLohusalik", backendValue: "Hamilelik / Lohusalık", labelKey: "profile.injuries.pregnancyPostpartum" },
  { key: "epilepsi", backendValue: "Epilepsi", labelKey: "profile.injuries.epilepsy" },
  { key: "kronikBobrekKaraciger", backendValue: "Kronik Böbrek / Karaciğer Hastalığı", labelKey: "profile.injuries.chronicKidneyLiver" },
];

function normalizeString(value) {
  return String(value || "").trim();
}

function findOptionByKeyOrBackendValue(options, value) {
  const normalized = normalizeString(value);
  return options.find((option) => option.key === normalized || option.backendValue === normalized) || null;
}

export function getGoalKey(value, fallback = "gain_weight") {
  return findOptionByKeyOrBackendValue(GOAL_OPTIONS, value)?.key || fallback;
}

export function getGoalBackendValue(value) {
  return findOptionByKeyOrBackendValue(GOAL_OPTIONS, value)?.backendValue || normalizeString(value);
}

export function getGoalLabel(t, value) {
  const option = findOptionByKeyOrBackendValue(GOAL_OPTIONS, value);
  return option ? t(option.labelKey) : normalizeString(value);
}

export function getGenderKey(value, fallback = "") {
  return findOptionByKeyOrBackendValue(GENDER_OPTIONS, value)?.key || fallback;
}

export function getGenderBackendValue(value) {
  return findOptionByKeyOrBackendValue(GENDER_OPTIONS, value)?.backendValue || normalizeString(value);
}

export function getGenderLabel(t, value) {
  const option = findOptionByKeyOrBackendValue(GENDER_OPTIONS, value);
  return option ? t(option.labelKey) : normalizeString(value);
}

export function buildInjuryStateFromArray(values) {
  const normalizedValues = new Set(Array.isArray(values) ? values.map(normalizeString) : []);
  return INJURY_OPTIONS.reduce((acc, option) => {
    acc[option.key] = normalizedValues.has(option.key) || normalizedValues.has(option.backendValue);
    return acc;
  }, {});
}

export function getSelectedInjuryBackendValues(state) {
  return INJURY_OPTIONS.filter((option) => state?.[option.key]).map((option) => option.backendValue);
}

export function getSelectedInjuryLabels(t, state) {
  return INJURY_OPTIONS.filter((option) => state?.[option.key]).map((option) => t(option.labelKey));
}
