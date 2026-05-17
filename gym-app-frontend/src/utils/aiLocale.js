export function normalizeLocale(locale) {
  const code = String(locale || "tr").trim().toLowerCase().replace("_", "-");
  if (code.startsWith("tr")) return "tr";
  if (code.startsWith("en")) return "en";
  return code.split("-")[0] || "tr";
}

export function getContentLocale(content) {
  return normalizeLocale(content?.locale || content?.language || "tr");
}

export function needsContentTranslation(content, targetLocale) {
  if (!content || typeof content !== "object") return false;
  return getContentLocale(content) !== normalizeLocale(targetLocale);
}
