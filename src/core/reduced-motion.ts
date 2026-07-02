import type { Page } from "playwright";

export async function withReducedMotion<T>(page: Page, callback: () => Promise<T>): Promise<T> {
  await page.emulateMedia({ reducedMotion: "reduce" });
  try {
    return await callback();
  } finally {
    await page.emulateMedia({ reducedMotion: "no-preference" });
  }
}
