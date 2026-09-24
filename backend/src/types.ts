export interface Env {
  DB: D1Database;
  STOREFRONT_ORIGIN: string;
  ADMIN_ORIGIN: string;
  CATALOG_BASE_URL: string;
  GITHUB_REPO: string;
  GITHUB_MAIN_BRANCH: string;
  PAGES_PROJECT_NAME: string;
  PAYOS_RETURN_BASE_URL: string;
  ADMIN_PASSWORD: string;
  SESSION_SECRET: string;
  GITHUB_TOKEN: string;
  PAYOS_CLIENT_ID?: string;
  PAYOS_API_KEY?: string;
  PAYOS_CHECKSUM_KEY?: string;
}

export type PaymentMethod = "cod" | "bank_transfer" | "payos";

export interface ShippingMethod {
  id: string;
  name: string;
  fee: number;
}

export interface StoreConfig {
  schemaVersion: "1";
  id: string;
  name: string;
  tagline?: string;
  currency: string;
  locale: string;
  contact: {
    phone: string;
    email?: string | null;
    address?: string | null;
  };
  social?: {
    facebook?: string | null;
    tiktok?: string | null;
  };
  checkout: {
    paymentMethods: PaymentMethod[];
    shippingMethods: ShippingMethod[];
    bankTransfer?: {
      bankName: string;
      accountName: string;
      accountNumber: string;
      transferNotePrefix?: string;
    } | null;
  };
}

export interface Product {
  schemaVersion: "1";
  id: string;
  slug: string;
  name: string;
  description: string;
  price: number;
  compareAtPrice?: number | null;
  images: string[];
  tags?: string[];
  active: boolean;
}

export interface CheckoutRequest {
  storeId: string;
  items: Array<{ productId: string; quantity: number }>;
  customer: {
    name: string;
    phone: string;
    address: string;
  };
  shippingMethod: string;
  paymentMethod: PaymentMethod;
}

export interface Catalog {
  store: StoreConfig;
  products: Product[];
}

export interface ProductImageUpload {
  filename: string;
  contentBase64: string;
}

export interface AdminProductSaveRequest {
  mode: "draft" | "publish";
  product: Product;
  images?: ProductImageUpload[];
  /** Backwards compatibility with older single-image clients. */
  image?: ProductImageUpload | null;
}

export interface AdminStoreSaveRequest {
  mode: "draft" | "publish";
  store: StoreConfig;
}
