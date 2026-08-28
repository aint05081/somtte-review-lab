import fs from "node:fs";
import path from "node:path";
import type { ProductConfig } from "@/lib/products";

export type DetailReference = {
  file: string;
  dataUrl: string;
};

function detailDir(product: ProductConfig) {
  if (!product.detailDir) return null;
  return path.join(process.cwd(), "data", "details", product.detailDir);
}

export function detailPageCount(product: ProductConfig) {
  const dir = detailDir(product);
  if (!dir || !fs.existsSync(dir)) return 0;
  return fs.readdirSync(dir).filter((x) => /\.(jpg|jpeg|png|webp)$/i.test(x)).length;
}

function evenlyPick<T>(rows: T[], count: number) {
  if (rows.length <= count) return rows;
  const picked: T[] = [];
  const used = new Set<number>();
  for (let i = 0; i < count; i++) {
    const idx = Math.round((i * (rows.length - 1)) / (count - 1));
    if (!used.has(idx)) {
      picked.push(rows[idx]);
      used.add(idx);
    }
  }
  return picked;
}

export function detailReferences(product: ProductConfig, maxImages = 6): DetailReference[] {
  const dir = detailDir(product);
  if (!dir || !fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir)
    .filter((x) => /\.(jpg|jpeg|png|webp)$/i.test(x))
    .sort((a, b) => a.localeCompare(b, "en", { numeric: true }));

  return evenlyPick(files, Math.max(1, maxImages)).map((file) => {
    const ext = path.extname(file).toLowerCase();
    const mime = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
    const bytes = fs.readFileSync(path.join(dir, file));
    return { file, dataUrl: `data:${mime};base64,${bytes.toString("base64")}` };
  });
}
