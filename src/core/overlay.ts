import path from "node:path";
import type { ScreenMap } from "./types.js";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildScreenMapOverlay(screenMap: ScreenMap, screenshotPath: string): string {
  const screenshotName = path.basename(screenshotPath);
  const boxes = screenMap.elements
    .filter((element) => element.visible && (element.clickable || element.visibleText))
    .slice(0, 200)
    .map((element) => {
      const color = element.clickable ? "#e11d48" : "#2563eb";
      const label = `${element.id} ${element.role ?? element.tag} ${element.visibleText || element.ariaLabel || ""}`.trim();
      return `<div class="box" title="${escapeHtml(label)}" style="left:${element.bbox.x}px;top:${element.bbox.y}px;width:${element.bbox.width}px;height:${element.bbox.height}px;border-color:${color};"><span>${escapeHtml(element.id)}</span></div>`;
    })
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>ux-sentinel screen map</title>
  <style>
    body { margin: 0; font-family: system-ui, sans-serif; background: #111827; color: #f9fafb; }
    header { padding: 12px 16px; border-bottom: 1px solid #374151; }
    main { position: relative; width: ${screenMap.viewport.width}px; min-height: ${screenMap.viewport.height}px; }
    img { display: block; width: ${screenMap.viewport.width}px; height: auto; }
    .box { position: absolute; border: 2px solid; background: rgba(255,255,255,0.04); box-sizing: border-box; }
    .box span { position: absolute; top: -18px; left: -2px; padding: 1px 4px; font-size: 11px; background: #111827; color: #f9fafb; border-radius: 3px; }
    .meta { font-size: 13px; color: #d1d5db; }
  </style>
</head>
<body>
  <header>
    <strong>ux-sentinel screen map</strong>
    <div class="meta">${escapeHtml(screenMap.url)} - ${screenMap.elements.length} elements</div>
  </header>
  <main>
    <img src="./${escapeHtml(screenshotName)}" alt="Captured page screenshot" />
    ${boxes}
  </main>
</body>
</html>
`;
}
