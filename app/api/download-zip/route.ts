import { NextResponse } from "next/server";
import JSZip from "jszip";
import fs from "fs";
import path from "path";

/* ── 제외 대상 ── */
const EXCLUDE_DIRS = new Set(["node_modules", ".next", ".git", ".vercel", ".turbo"]);
const EXCLUDE_FILES = new Set([
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  ".DS_Store",
  "Thumbs.db",
]);
const EXCLUDE_EXTS = new Set([".log", ".pid"]);

function shouldSkip(name: string, isDir: boolean): boolean {
  if (isDir) return EXCLUDE_DIRS.has(name);
  if (EXCLUDE_FILES.has(name)) return true;
  const ext = path.extname(name).toLowerCase();
  return EXCLUDE_EXTS.has(ext);
}

function addDir(zip: JSZip, dirPath: string, baseDir: string) {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (shouldSkip(entry.name, entry.isDirectory())) continue;
    const full = path.join(dirPath, entry.name);
    const rel = path.relative(baseDir, full).replace(/\\/g, "/"); // Windows 경로 통일
    if (entry.isDirectory()) {
      addDir(zip, full, baseDir);
    } else {
      try {
        const buf = fs.readFileSync(full);
        zip.file(rel, buf);
      } catch {
        /* 읽기 실패 파일은 스킵 */
      }
    }
  }
}

export async function GET() {
  const root = process.cwd();
  const zip = new JSZip();

  addDir(zip, root, root);

  const buf = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="hr-workflow-ai.zip"`,
      "Content-Length": String(buf.length),
    },
  });
}
