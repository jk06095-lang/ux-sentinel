import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

export async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
}

export function timestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

export function safeSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "ux-sentinel";
}

export async function writeJson(filePath: string, value: unknown): Promise<void> {
  await ensureDir(path.dirname(filePath));
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function readText(filePath: string): Promise<string> {
  return readFile(filePath, "utf8");
}

export async function writeText(filePath: string, value: string): Promise<void> {
  await ensureDir(path.dirname(filePath));
  await writeFile(filePath, value, "utf8");
}

export async function writeFileIfMissing(filePath: string, value: string): Promise<"created" | "skipped"> {
  if (existsSync(filePath)) {
    return "skipped";
  }

  await writeText(filePath, value);
  return "created";
}

export function displayPath(filePath: string, cwd = process.cwd()): string {
  const relative = path.relative(cwd, filePath);
  return relative && !relative.startsWith("..") ? relative.replace(/\\/g, "/") : filePath.replace(/\\/g, "/");
}
