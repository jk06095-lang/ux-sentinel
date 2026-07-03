import { chromium } from "playwright";
import { describe, expect, it } from "vitest";
import { runDetectors } from "../src/core/detectors.js";
import { collectScreenMap } from "../src/core/observe-page.js";
import type { Scenario } from "../src/core/types.js";

const scenario: Scenario = {
  id: "data-ux-actionability",
  title: "Data UX actionability",
  persona: "tester"
};

describe("observe page screen map", () => {
  it("keeps data-ux-role metadata-only but treats data-ux action opt-ins as clickable evidence", async () => {
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
      await page.setContent(`
        <main>
          <div data-ux-role="dag-node">Metadata node</div>
          <div data-ux-role="dag-node" data-ux-clickable="true" style="cursor: pointer">Clickable node</div>
          <div data-ux-role="dag-node" data-ux-action="open-detail" style="cursor: pointer">Action node</div>
        </main>
      `);

      const screenMap = await collectScreenMap(page, page.url(), [], []);
      const metadataOnly = screenMap.elements.find((element) => element.visibleText === "Metadata node");
      const clickableNode = screenMap.elements.find((element) => element.visibleText === "Clickable node");
      const actionNode = screenMap.elements.find((element) => element.visibleText === "Action node");

      expect(metadataOnly?.clickable).toBe(false);
      expect(clickableNode).toMatchObject({
        clickable: true,
        dataUxClickable: true
      });
      expect(actionNode).toMatchObject({
        clickable: true,
        dataUxAction: "open-detail"
      });

      const findings = runDetectors(screenMap, scenario).map((finding) => finding.detector);
      expect(findings).not.toContain("looks_clickable_but_not_actionable");
    } finally {
      await browser.close();
    }
  });

  it("records tabindex-only elements as focusable without treating them as click targets", async () => {
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
      await page.setContent(`
        <main>
          <div tabindex="0">Focusable review panel</div>
        </main>
      `);

      const screenMap = await collectScreenMap(page, page.url(), [], []);
      const focusablePanel = screenMap.elements.find(
        (element) => element.tag === "div" && element.visibleText === "Focusable review panel"
      );

      expect(focusablePanel).toMatchObject({
        clickable: false,
        focusable: true,
        tabIndex: 0
      });

      const findings = runDetectors(screenMap, scenario).map((finding) => finding.detector);
      expect(findings).not.toContain("clickable_without_visible_affordance");
      expect(findings).not.toContain("click_target_too_small");
      expect(findings).not.toContain("click_target_spacing_too_tight");
    } finally {
      await browser.close();
    }
  });
});
