import type { ScreenElement, ScreenMap } from "./types.js";

const iconLikeTexts = new Set(["", "+", "-", "×", "x", "...", "…", "⋯", "☰", "≡", "›", "‹", ">", "<"]);

export function normalizeText(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

export function isIconOnlyText(value: string | null | undefined): boolean {
  const text = normalizeText(value);
  if (iconLikeTexts.has(text.toLowerCase())) {
    return true;
  }

  return text.length <= 2 && !/[a-z0-9가-힣]/i.test(text);
}

export function elementLabel(element: ScreenElement): string {
  return normalizeText(element.visibleText || element.ariaLabel || element.title || "");
}

export function labelMatchesPreferred(label: string | null | undefined, preferredLabels: string[]): boolean {
  const normalizedLabel = normalizeText(label).toLowerCase();
  if (!normalizedLabel) {
    return false;
  }

  return preferredLabels.some((preferred) => {
    const normalizedPreferred = normalizeText(preferred).toLowerCase();
    return normalizedLabel === normalizedPreferred || normalizedLabel.includes(normalizedPreferred);
  });
}

export function visiblePrimaryCtas(screenMap: ScreenMap, preferredLabels: string[]): ScreenElement[] {
  return screenMap.elements.filter(
    (element) =>
      element.visible &&
      element.clickable &&
      !element.disabled &&
      element.hasVisibleLabel &&
      element.looksClickable &&
      labelMatchesPreferred(element.visibleText, preferredLabels)
  );
}

export function ariaPrimaryCtas(screenMap: ScreenMap, preferredLabels: string[]): ScreenElement[] {
  return screenMap.elements.filter(
    (element) =>
      element.visible &&
      element.clickable &&
      !element.disabled &&
      (labelMatchesPreferred(element.ariaLabel, preferredLabels) ||
        labelMatchesPreferred(element.title, preferredLabels) ||
        labelMatchesPreferred(element.visibleText, preferredLabels))
  );
}

export function pageText(screenMap: ScreenMap): string {
  return screenMap.visibleText.join(" ");
}
