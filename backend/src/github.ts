import type { AdminProductSaveRequest, AdminStoreSaveRequest, Env, Product, StoreConfig } from "./types";
import { HttpError } from "./http";

const API = "https://api.github.com";
const PRODUCTS_PATH = "frontend/data/products.json";
const STORE_PATH = "frontend/data/store.json";
const IMAGE_ROOT = "frontend/assets/products";

interface ContentResponse {
  sha: string;
  content: string;
  encoding: string;
}

function repoParts(env: Env): [string, string] {
  const [owner, repo, extra] = env.GITHUB_REPO.split("/");
  if (!owner || !repo || extra) {
    throw new HttpError(500, "GITHUB_CONFIG_INVALID", "GITHUB_REPO must be owner/repo.");
  }
  return [owner, repo];
}

function githubHeaders(env: Env): HeadersInit {
  if (!env.GITHUB_TOKEN) {
    throw new HttpError(503, "GITHUB_NOT_CONFIGURED", "GitHub publishing is not configured.");
  }

  return {
    accept: "application/vnd.github+json",
    authorization: "Bearer " + env.GITHUB_TOKEN,
    "x-github-api-version": "2026-03-10",
    "user-agent": "commerce-core-v1"
  };
}

async function githubFetch(env: Env, path: string, init: RequestInit = {}): Promise<Response> {
  const response = await fetch(API + path, {
    ...init,
    headers: {
      ...githubHeaders(env),
      ...(init.headers || {})
    }
  });

  return response;
}

function decodeBase64Utf8(value: string): string {
  const binary = atob(value.replace(/\s/g, ""));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function encodeBase64Utf8(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function readTextFile(env: Env, path: string, branch: string): Promise<{ text: string; sha: string }> {
  const [owner, repo] = repoParts(env);
  const response = await githubFetch(
    env,
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${path}?ref=${encodeURIComponent(branch)}`
  );

  if (!response.ok) {
    throw new HttpError(response.status, "GITHUB_READ_FAILED", "Could not read " + path + " from GitHub.");
  }

  const body = await response.json<ContentResponse>();
  return { text: decodeBase64Utf8(body.content), sha: body.sha };
}

async function readFile(env: Env, path: string, branch: string): Promise<ContentResponse | null> {
  const [owner, repo] = repoParts(env);
  const response = await githubFetch(
    env,
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${path}?ref=${encodeURIComponent(branch)}`
  );

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new HttpError(response.status, "GITHUB_READ_FAILED", "Could not inspect " + path + " on GitHub.");
  }

  return await response.json<ContentResponse>();
}

async function fileSha(env: Env, path: string, branch: string): Promise<string | null> {
  return (await readFile(env, path, branch))?.sha || null;
}

async function putBase64File(
  env: Env,
  path: string,
  contentBase64: string,
  branch: string,
  message: string
): Promise<void> {
  const [owner, repo] = repoParts(env);
  const sha = await fileSha(env, path, branch);

  const response = await githubFetch(
    env,
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${path}`,
    {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        message,
        content: contentBase64,
        branch,
        ...(sha ? { sha } : {})
      })
    }
  );

  if (!response.ok) {
    const body = await response.text();
    console.error("GitHub write failed", response.status, body);
    throw new HttpError(response.status, "GITHUB_WRITE_FAILED", "Could not write " + path + " to GitHub.");
  }
}

async function putTextFile(env: Env, path: string, text: string, branch: string, message: string): Promise<void> {
  await putBase64File(env, path, encodeBase64Utf8(text), branch, message);
}

async function mainHead(env: Env): Promise<string> {
  const [owner, repo] = repoParts(env);
  const response = await githubFetch(
    env,
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/ref/heads/${encodeURIComponent(env.GITHUB_MAIN_BRANCH)}`
  );

  if (!response.ok) {
    throw new HttpError(response.status, "GITHUB_BRANCH_FAILED", "Could not resolve the production branch.");
  }

  const body = await response.json<{ object: { sha: string } }>();
  return body.object.sha;
}

async function ensureBranch(env: Env, branch: string): Promise<void> {
  const [owner, repo] = repoParts(env);
  const existing = await githubFetch(
    env,
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches/${encodeURIComponent(branch)}`
  );

  if (existing.ok) return;
  if (existing.status !== 404) {
    throw new HttpError(existing.status, "GITHUB_BRANCH_FAILED", "Could not inspect draft branch.");
  }

  const sha = await mainHead(env);
  const created = await githubFetch(
    env,
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/refs`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ref: "refs/heads/" + branch, sha })
    }
  );

  if (!created.ok) {
    throw new HttpError(created.status, "GITHUB_BRANCH_FAILED", "Could not create draft branch.");
  }
}

function safeDraftName(value: string): string {
  const cleaned = value.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
  return "draft/" + (cleaned || "store");
}

function previewUrl(env: Env, branch: string): string | null {
  if (!env.PAGES_PROJECT_NAME) return null;
  const alias = branch.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return `https://${alias}.${env.PAGES_PROJECT_NAME}.pages.dev`;
}

function validateImage(image: AdminProductSaveRequest["image"]): void {
  if (!image) return;
  if (!/^[a-z0-9-]+\.webp$/i.test(image.filename)) {
    throw new HttpError(400, "INVALID_IMAGE", "Product image must be a WebP file with a safe filename.");
  }

  const approximateBytes = Math.floor(image.contentBase64.length * 0.75);
  if (approximateBytes > 1_500_000) {
    throw new HttpError(413, "IMAGE_TOO_LARGE", "Optimized product image must be 1.5 MB or smaller.");
  }
}

function assertProduct(product: Product): void {
  if (
    product.schemaVersion !== "1" ||
    !product.id ||
    !/^[a-z0-9][a-z0-9-]*$/.test(product.id) ||
    !/^[a-z0-9][a-z0-9-]*$/.test(product.slug) ||
    !product.name ||
    !Number.isInteger(product.price) ||
    product.price < 0
  ) {
    throw new HttpError(400, "INVALID_PRODUCT", "Product does not match the v1 contract.");
  }
}

function assertStore(store: StoreConfig): void {
  if (
    store.schemaVersion !== "1" ||
    !store.id ||
    !store.name ||
    !store.currency ||
    !store.locale ||
    !Array.isArray(store.checkout?.paymentMethods) ||
    !Array.isArray(store.checkout?.shippingMethods) ||
    store.checkout.shippingMethods.length === 0
  ) {
    throw new HttpError(400, "INVALID_STORE", "Store settings do not match the v1 contract.");
  }
}

export async function readMainCatalog(env: Env): Promise<{ store: StoreConfig; products: Product[] }> {
  const [storeFile, productsFile] = await Promise.all([
    readTextFile(env, STORE_PATH, env.GITHUB_MAIN_BRANCH),
    readTextFile(env, PRODUCTS_PATH, env.GITHUB_MAIN_BRANCH)
  ]);

  return {
    store: JSON.parse(storeFile.text) as StoreConfig,
    products: JSON.parse(productsFile.text) as Product[]
  };
}

export async function saveProduct(
  env: Env,
  input: AdminProductSaveRequest
): Promise<{ branch: string; previewUrl: string | null }> {
  assertProduct(input.product);
  validateImage(input.image);

  const branch = input.mode === "publish"
    ? env.GITHUB_MAIN_BRANCH
    : safeDraftName(input.product.slug);

  if (input.mode === "draft") await ensureBranch(env, branch);

  const imageFilename = input.product.images?.[0]?.split("/").pop() || null;
  const imagePath = imageFilename ? IMAGE_ROOT + "/" + imageFilename : null;

  if (input.image && imagePath) {
    await putBase64File(
      env,
      imagePath,
      input.image.contentBase64,
      branch,
      `content: update image for ${input.product.slug}`
    );
  } else if (input.mode === "publish" && imagePath) {
    const productionImage = await readFile(env, imagePath, env.GITHUB_MAIN_BRANCH);

    if (!productionImage) {
      const draftBranch = safeDraftName(input.product.slug);
      const draftImage = await readFile(env, imagePath, draftBranch);

      if (!draftImage) {
        throw new HttpError(
          409,
          "PRODUCT_IMAGE_MISSING",
          "Product image is not available on production or the product draft. Upload the image again before publishing."
        );
      }

      await putBase64File(
        env,
        imagePath,
        draftImage.content.replace(/\s/g, ""),
        env.GITHUB_MAIN_BRANCH,
        `content: publish image for ${input.product.slug}`
      );
    }
  }

  const productsFile = await readTextFile(env, PRODUCTS_PATH, branch);
  const products = JSON.parse(productsFile.text) as Product[];
  const index = products.findIndex((product) => product.id === input.product.id);

  if (index >= 0) products[index] = input.product;
  else products.push(input.product);

  await putTextFile(
    env,
    PRODUCTS_PATH,
    JSON.stringify(products, null, 2) + "\n",
    branch,
    `content: ${input.mode === "publish" ? "publish" : "save draft"} ${input.product.slug}`
  );

  return {
    branch,
    previewUrl: input.mode === "draft" ? previewUrl(env, branch) : env.STOREFRONT_ORIGIN
  };
}

export async function saveStore(
  env: Env,
  input: AdminStoreSaveRequest
): Promise<{ branch: string; previewUrl: string | null }> {
  assertStore(input.store);

  const branch = input.mode === "publish"
    ? env.GITHUB_MAIN_BRANCH
    : safeDraftName("store-settings");

  if (input.mode === "draft") await ensureBranch(env, branch);

  await putTextFile(
    env,
    STORE_PATH,
    JSON.stringify(input.store, null, 2) + "\n",
    branch,
    `content: ${input.mode === "publish" ? "publish" : "save draft"} store settings`
  );

  return {
    branch,
    previewUrl: input.mode === "draft" ? previewUrl(env, branch) : env.STOREFRONT_ORIGIN
  };
}
