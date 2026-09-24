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

const MANAGED_IMAGE = /^\.\/assets\/products\/([a-z0-9-]+\.webp)$/;

function validateUploads(input: AdminProductSaveRequest): Array<{ filename: string; contentBase64: string }> {
  const uploads = input.images ?? (input.image ? [input.image] : []);
  if (!Array.isArray(uploads) || uploads.length > 10) {
    throw new HttpError(400, "INVALID_IMAGE", "A product can upload at most 10 images.");
  }
  const seen = new Set<string>();
  for (const image of uploads) {
    if (!image || typeof image.filename !== "string" ||
        !/^[a-z0-9-]+\.webp$/.test(image.filename) ||
        typeof image.contentBase64 !== "string" || !image.contentBase64 ||
        !/^[a-zA-Z0-9+/]+={0,2}$/.test(image.contentBase64) ||
        image.contentBase64.length % 4 !== 0 ||
        seen.has(image.filename)) {
      throw new HttpError(400, "INVALID_IMAGE", "Invalid or duplicate WebP image upload.");
    }
    seen.add(image.filename);
    const approximateBytes = Math.floor(image.contentBase64.length * 0.75);
    if (approximateBytes > 1_500_000) {
      throw new HttpError(413, "IMAGE_TOO_LARGE", "Each optimized image must be 1.5 MB or smaller.");
    }
    if (!input.product.images.includes("./assets/products/" + image.filename)) {
      throw new HttpError(400, "INVALID_IMAGE", "An uploaded image must be referenced by this product.");
    }
  }
  return uploads;
}

function assertProduct(product: Product): void {
  if (
    product.schemaVersion !== "1" ||
    !product.id ||
    !/^[a-z0-9][a-z0-9-]*$/.test(product.id) ||
    !/^[a-z0-9][a-z0-9-]*$/.test(product.slug) ||
    !product.name ||
    !Number.isInteger(product.price) ||
    product.price < 0 ||
    !Array.isArray(product.images) ||
    product.images.length > 10 ||
    product.images.some((src) => typeof src !== "string" || !src.trim()) ||
    new Set(product.images).size !== product.images.length
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

export async function saveProduct(
  env: Env,
  input: AdminProductSaveRequest
): Promise<{ branch: string; previewUrl: string | null }> {
  assertProduct(input.product);
  if (input.mode !== "draft" && input.mode !== "publish") {
    throw new HttpError(400, "INVALID_MODE", "Choose draft or publish.");
  }
  const uploads = validateUploads(input);
  const branch = input.mode === "publish" ? env.GITHUB_MAIN_BRANCH : safeDraftName(input.product.slug);
  if (input.mode === "draft") await ensureBranch(env, branch);

  // Upload first. Write catalog last so it never references an image that is not ready.
  const uploaded = new Set<string>();
  for (const image of uploads) {
    const path = IMAGE_ROOT + "/" + image.filename;
    await putBase64File(env, path, image.contentBase64, branch,
      "content: update image for " + input.product.slug);
    uploaded.add(path);
  }

  // An existing image may live on the product's draft branch (publish),
  // or on main (when the draft branch pre-dates that image).
  for (const src of input.product.images) {
    const match = MANAGED_IMAGE.exec(src);
    if (!match) continue;
    const path = IMAGE_ROOT + "/" + match[1];
    if (uploaded.has(path) || await readFile(env, path, branch)) continue;
    const fallbackBranch = input.mode === "publish"
      ? safeDraftName(input.product.slug)
      : env.GITHUB_MAIN_BRANCH;
    const fallback = await readFile(env, path, fallbackBranch);
    if (!fallback) {
      throw new HttpError(409, "PRODUCT_IMAGE_MISSING",
        "A referenced image is missing. Re-upload it before saving or publishing.");
    }
    await putBase64File(env, path, fallback.content.replace(/\s/g, ""), branch,
      "content: publish image for " + input.product.slug);
  }

  const productsFile = await readTextFile(env, PRODUCTS_PATH, branch);
  const products = JSON.parse(productsFile.text) as Product[];
  const index = products.findIndex((product) => product.id === input.product.id);
  if (index >= 0) products[index] = input.product;
  else products.push(input.product);

  await putTextFile(env, PRODUCTS_PATH,
    JSON.stringify(products, null, 2) + "\n", branch,
    "content: " + (input.mode === "publish" ? "publish" : "save draft") + " " + input.product.slug);
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
