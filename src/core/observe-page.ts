import path from "node:path";
import { chromium, type ConsoleMessage, type Page, type Response } from "playwright";
import { buildScreenMapOverlay } from "./overlay.js";
import { ensureDir, timestamp, writeJson, writeText } from "./files.js";
import type { ConsoleIssue, NetworkIssue, ObservationResult, Scenario, ScreenMap } from "./types.js";

export interface ObserveOptions {
  url: string;
  scenario?: Scenario;
  traceRoot?: string;
  writeObserverReport?: boolean;
}

function consoleIssue(message: ConsoleMessage): ConsoleIssue {
  return {
    type: message.type(),
    text: message.text(),
    location: message.location()
  };
}

function networkIssue(response: Response): NetworkIssue {
  return {
    url: response.url(),
    status: response.status(),
    statusText: response.statusText(),
    method: response.request().method()
  };
}

export async function safeAccessibilitySnapshot(page: Page): Promise<unknown> {
  const maybePage = page as Page & {
    accessibility?: {
      snapshot(options?: { interestingOnly?: boolean }): Promise<unknown>;
    };
  };

  if (!maybePage.accessibility?.snapshot) {
    return null;
  }

  try {
    return await maybePage.accessibility.snapshot({ interestingOnly: false });
  } catch {
    return null;
  }
}

export async function collectScreenMap(page: Page, url: string, consoleErrors: ConsoleIssue[], networkErrors: NetworkIssue[]): Promise<ScreenMap> {
  const data = await page.evaluate(() => {
    const iconTexts = new Set(["", "+", "-", "×", "x", "...", "…", "⋯", "☰", "≡", "›", "‹", ">", "<"]);
    const normalize = (value: string | null | undefined) => (value ?? "").replace(/\s+/g, " ").trim();
    const isIconOnly = (value: string | null | undefined) => {
      const text = normalize(value);
      return iconTexts.has(text.toLowerCase()) || (text.length <= 2 && !/[a-z0-9가-힣]/i.test(text));
    };
    const interactiveTags = new Set(["button", "a", "input", "select", "textarea", "summary"]);
    const interactiveRoles = new Set(["button", "link", "menuitem", "switch", "checkbox", "radio", "tab"]);
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const viewportArea = Math.max(1, viewportWidth * viewportHeight);

    const elements = Array.from(document.querySelectorAll<HTMLElement>("body *"))
      .map((element, index) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        const tag = element.tagName.toLowerCase();
        const role = element.getAttribute("role");
        const ariaLabel = element.getAttribute("aria-label");
        const ariaLabelledBy = element.getAttribute("aria-labelledby");
        const ariaLive = element.getAttribute("aria-live");
        const ariaModal = element.getAttribute("aria-modal");
        const title = element.getAttribute("title");
        const dataUxRole = element.getAttribute("data-ux-role");
        const dataUxAction = element.getAttribute("data-ux-action");
        const dataUxClickable = element.getAttribute("data-ux-clickable") === "true";
        const tabIndexAttr = element.getAttribute("tabindex");
        const visibleText = normalize(element.innerText || element.textContent || "");
        const visible =
          rect.width > 0 &&
          rect.height > 0 &&
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          Number(style.opacity || "1") > 0;
        const hasTabIndex = element.hasAttribute("tabindex");
        const focusable = interactiveTags.has(tag) || (role ? interactiveRoles.has(role) : false) || hasTabIndex;
        const explicitDataUxAction = dataUxClickable || Boolean(dataUxAction);
        const clickable =
          interactiveTags.has(tag) ||
          (role ? interactiveRoles.has(role) : false) ||
          typeof element.onclick === "function" ||
          explicitDataUxAction;
        const disabled =
          element.hasAttribute("disabled") ||
          element.getAttribute("aria-disabled") === "true" ||
          (element as HTMLButtonElement).disabled === true;
        const nativeAffordance = interactiveTags.has(tag);
        const hasPointerCursor = style.cursor === "pointer";
        const backgroundVisible = style.backgroundColor !== "rgba(0, 0, 0, 0)" && style.backgroundColor !== "transparent";
        const borderVisible =
          parseFloat(style.borderTopWidth || "0") > 0 &&
          style.borderTopStyle !== "none" &&
          style.borderTopColor !== "rgba(0, 0, 0, 0)";
        const hasVisibleAffordance =
          nativeAffordance ||
          hasPointerCursor ||
          borderVisible ||
          (backgroundVisible && ["button", "link", "menuitem", "tab", "switch", "checkbox", "radio"].includes(role ?? ""));
        const aboveFold = rect.top < viewportHeight && rect.bottom > 0;
        const hasVisibleLabel = Boolean(visibleText) && !isIconOnly(visibleText);
        const looksClickable =
          clickable &&
          !disabled &&
          rect.width >= 24 &&
          rect.height >= 24 &&
          style.visibility !== "hidden" &&
          style.display !== "none" &&
          hasVisibleAffordance;
        const textTruncated =
          Boolean(visibleText) && (element.scrollWidth > element.clientWidth + 2 || element.scrollHeight > element.clientHeight + 2);
        const visualWeight = Math.min(1, Math.round(((rect.width * rect.height) / viewportArea) * 10000) / 10000);

        return {
          id: `e${index + 1}`,
          tag,
          role,
          dataUxRole,
          dataUxAction,
          dataUxClickable,
          visibleText: visibleText.slice(0, 240),
          accessibleName: normalize(ariaLabel || title || visibleText).slice(0, 240),
          ariaLabel,
          ariaLabelledBy,
          ariaLive,
          ariaModal,
          title,
          bbox: {
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.round(rect.width),
            height: Math.round(rect.height)
          },
          clickable,
          focusable,
          disabled,
          tabIndex: tabIndexAttr === null ? null : Number.parseInt(tabIndexAttr, 10),
          aboveFold,
          visible,
          looksClickable,
          hasVisibleLabel,
          isIconOnly: clickable && isIconOnly(visibleText),
          textTruncated,
          visualWeight,
          cursor: style.cursor,
          hasPointerCursor,
          hasVisibleAffordance
        };
      })
      .filter((element) => element.visible && (element.clickable || element.visibleText || element.ariaLabel))
      .slice(0, 500);

    const visibleText = Array.from(
      new Set(
        elements
          .map((element) => element.visibleText)
          .filter(Boolean)
          .map((text) => text.slice(0, 240))
      )
    ).slice(0, 200);

    return {
      title: document.title,
      viewport: {
        width: viewportWidth,
        height: viewportHeight
      },
      document: {
        width: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth, viewportWidth),
        height: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight, viewportHeight),
        hasHorizontalScroll: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) > viewportWidth + 8
      },
      visibleText,
      elements
    };
  });

  return {
    url,
    title: data.title,
    timestamp: new Date().toISOString(),
    viewport: data.viewport,
    document: data.document,
    visibleText: data.visibleText,
    elements: data.elements,
    consoleErrors,
    networkErrors,
    risks: []
  };
}

export async function observePage(options: ObserveOptions): Promise<ObservationResult> {
  const runId = timestamp();
  const traceDir = path.resolve(options.traceRoot ?? path.join(process.cwd(), ".ux-sentinel", "traces"), runId);
  await ensureDir(traceDir);

  const screenshot = path.join(traceDir, "screenshot.png");
  const screenMapPath = path.join(traceDir, "screen-map.json");
  const overlayPath = path.join(traceDir, "screen-map.html");
  const accessibilityPath = path.join(traceDir, "accessibility.json");
  const observerReportPath = path.join(traceDir, "observer-report.md");
  const consoleErrors: ConsoleIssue[] = [];
  const networkErrors: NetworkIssue[] = [];

  const browser = await chromium.launch({ headless: true });
  try {
    const viewport = {
      width: 1280,
      height: 720
    };
    const page = await browser.newPage({ viewport });

    page.on("console", (message) => {
      if (message.type() === "error") {
        consoleErrors.push(consoleIssue(message));
      }
    });

    page.on("response", (response) => {
      if (response.status() >= 400) {
        networkErrors.push(networkIssue(response));
      }
    });

    await page.goto(options.url, { waitUntil: "networkidle", timeout: 20_000 });
    await page.screenshot({ path: screenshot, fullPage: false });

    const accessibilitySnapshot = await safeAccessibilitySnapshot(page);
    await writeJson(accessibilityPath, accessibilitySnapshot);

    const screenMap = await collectScreenMap(page, page.url(), consoleErrors, networkErrors);
    await writeJson(screenMapPath, screenMap);
    await writeText(overlayPath, buildScreenMapOverlay(screenMap, screenshot));

    if (options.writeObserverReport) {
      await writeText(
        observerReportPath,
        `# UX Sentinel Observe Report

- URL: ${screenMap.url}
- Viewport: ${screenMap.viewport.width}x${screenMap.viewport.height}
- Screenshot: ${path.basename(screenshot)}
- Screen map: ${path.basename(screenMapPath)}
- HTML overlay: ${path.basename(overlayPath)}
- Accessibility snapshot: ${path.basename(accessibilityPath)}
- Visible elements: ${screenMap.elements.length}
- Console errors: ${screenMap.consoleErrors.length}
- Network 4xx/5xx: ${screenMap.networkErrors.length}
`
      );
    }

    return {
      screenMap,
      accessibilitySnapshot,
      artifacts: {
        traceDir,
        screenshot,
        screenMap: screenMapPath,
        overlay: overlayPath,
        observerReport: options.writeObserverReport ? observerReportPath : undefined,
        accessibility: accessibilityPath
      }
    };
  } finally {
    await browser.close();
  }
}
