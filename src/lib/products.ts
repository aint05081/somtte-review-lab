import fs from "node:fs";
import path from "node:path";

export type ProductConfig = {
  id: string;
  brand: string;
  name: string;
  label: string;
  file: string;
  detailDir?: string;
};

let cache: ProductConfig[] | null = null;

export function getProducts(): ProductConfig[] {
  if (cache) return cache;
  const file = path.join(process.cwd(), "data", "products.json");
  const rows = JSON.parse(fs.readFileSync(file, "utf8")) as ProductConfig[];
  cache = rows.filter((x) => x?.id && x?.brand && x?.name && x?.file);
  return cache;
}

export function getProduct(id: string): ProductConfig {
  const products = getProducts();
  return products.find((x) => x.id === id) || products[0];
}

export function productDataPath(product: ProductConfig) {
  return path.join(process.cwd(), "data", "products", product.file);
}
