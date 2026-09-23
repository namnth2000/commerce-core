import type { Catalog, Env, Product, StoreConfig } from "./types";
import { HttpError } from "./http";

function ensureBase(url: string): string {
  return url.replace(/\/$/, "");
}

export async function loadPublicCatalog(env: Env): Promise<Catalog> {
  const base = ensureBase(env.CATALOG_BASE_URL);
  const [storeResponse, productsResponse] = await Promise.all([
    fetch(base + "/store.json", { headers: { accept: "application/json" } }),
    fetch(base + "/products.json", { headers: { accept: "application/json" } })
  ]);

  if (!storeResponse.ok || !productsResponse.ok) {
    throw new HttpError(503, "CATALOG_UNAVAILABLE", "Published catalog is unavailable.");
  }

  const store = await storeResponse.json<StoreConfig>();
  const products = await productsResponse.json<Product[]>();

  if (store.schemaVersion !== "1" || !Array.isArray(products)) {
    throw new HttpError(503, "CATALOG_INVALID", "Published catalog is not compatible with contract v1.");
  }

  return { store, products };
}
