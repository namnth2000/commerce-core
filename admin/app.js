const STORAGE_KEY = "commerce-core-admin-v0.1";

const defaults = [
  {
    schemaVersion: "0.1",
    id: "pixel-clock-mini",
    slug: "pixel-clock-mini",
    name: "Pixel Clock Mini",
    description: "Đồng hồ pixel nhỏ gọn để bàn, hiển thị giờ và tạo điểm nhấn cho góc làm việc.",
    price: 489000,
    compareAtPrice: null,
    images: ["/products/pixel-clock-mini.webp"],
    tags: ["desk", "decor"],
    active: true
  },
  {
    schemaVersion: "0.1",
    id: "magnetic-cable-dock",
    slug: "magnetic-cable-dock",
    name: "Magnetic Cable Dock",
    description: "Bộ giữ dây sạc nam châm giúp mặt bàn gọn hơn nhưng vẫn lấy dây bằng một tay.",
    price: 179000,
    compareAtPrice: null,
    images: ["/products/magnetic-cable-dock.webp"],
    tags: ["desk", "utility"],
    active: true
  }
];

const state = {
  products: loadProducts(),
  selectedId: null,
  optimizedImage: null
};

const el = {
  list: document.querySelector("#productList"),
  form: document.querySelector("#productForm"),
  editorTitle: document.querySelector("#editorTitle"),
  saveState: document.querySelector("#saveState"),
  notice: document.querySelector("#notice"),
  name: document.querySelector("#nameInput"),
  slug: document.querySelector("#slugInput"),
  price: document.querySelector("#priceInput"),
  description: document.querySelector("#descriptionInput"),
  active: document.querySelector("#activeInput"),
  imageInput: document.querySelector("#imageInput"),
  imageResult: document.querySelector("#imageResult"),
  imagePreview: document.querySelector("#imagePreview"),
  originalSize: document.querySelector("#originalSize"),
  optimizedSize: document.querySelector("#optimizedSize"),
  optimizedDimensions: document.querySelector("#optimizedDimensions"),
  newProduct: document.querySelector("#newProductButton"),
  exportButton: document.querySelector("#exportButton"),
  publishButton: document.querySelector("#publishButton"),
  downloadImageButton: document.querySelector("#downloadImageButton")
};

function loadProducts() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : structuredClone(defaults);
  } catch {
    return structuredClone(defaults);
  }
}

function money(value) {
  return new Intl.NumberFormat("vi-VN").format(value) + "đ";
}

function slugify(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function currentProduct() {
  return state.products.find((product) => product.id === state.selectedId);
}

function renderList() {
  el.list.innerHTML = "";

  state.products.forEach((product) => {
    const button = document.createElement("button");
    button.className = "product-item";
    button.type = "button";
    button.setAttribute("aria-current", String(product.id === state.selectedId));
    button.innerHTML = `<strong>${escapeHtml(product.name)}</strong><span>${money(product.price)} · ${product.active ? "Đang bán" : "Ẩn"}</span>`;
    button.addEventListener("click", () => selectProduct(product.id));
    el.list.appendChild(button);
  });
}

function selectProduct(id) {
  state.selectedId = id;
  state.optimizedImage = null;
  el.imageResult.hidden = true;

  const product = currentProduct();
  if (!product) return;

  el.name.value = product.name;
  el.slug.value = product.slug;
  el.price.value = product.price;
  el.description.value = product.description;
  el.active.checked = product.active;
  el.editorTitle.textContent = product.name;
  setSaveState("Chưa thay đổi");
  renderList();
}

function newProduct() {
  const id = "san-pham-moi-" + Date.now();
  state.products.unshift({
    schemaVersion: "0.1",
    id,
    slug: id,
    name: "Sản phẩm mới",
    description: "",
    price: 0,
    compareAtPrice: null,
    images: [],
    tags: [],
    active: false
  });
  selectProduct(id);
  el.name.focus();
}

function readForm() {
  const product = currentProduct();
  if (!product) return null;

  const nextSlug = el.slug.value.trim();
  return {
    ...product,
    id: product.id.startsWith("san-pham-moi-") ? nextSlug : product.id,
    slug: nextSlug,
    name: el.name.value.trim(),
    description: el.description.value.trim(),
    price: Math.max(0, Number(el.price.value) || 0),
    active: el.active.checked,
    images: state.optimizedImage
      ? [`/products/${nextSlug}-01.webp`]
      : product.images
  };
}

function saveDraft(event) {
  event.preventDefault();

  const next = readForm();
  if (!next || !next.name || !next.slug) return;

  if (state.products.some((product) => product.id !== state.selectedId && product.slug === next.slug)) {
    showNotice("Slug đã được dùng bởi sản phẩm khác.");
    return;
  }

  const index = state.products.findIndex((product) => product.id === state.selectedId);
  state.products[index] = next;
  state.selectedId = next.id;

  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.products));
  el.editorTitle.textContent = next.name;
  setSaveState("Đã lưu local");
  renderList();

  showNotice(`Đã lưu bản nháp local. Khi Git adapter được kết nối, hành động này có thể map sang draft/${next.slug}.`);
}

function exportCurrent() {
  const product = readForm();
  if (!product) return;
  downloadJson(product, `${product.slug || "product"}.json`);
}

function publishCurrent() {
  const product = readForm();
  if (!product) return;
  downloadJson(product, `${product.slug || "product"}.json`);
  showNotice("v0.1 chưa kết nối GitHub. File JSON đã được xuất thay cho thao tác Publish để bạn kiểm tra contract.");
}

async function optimizeImage(file) {
  const bitmap = await createImageBitmap(file);
  const maxDimension = 1600;
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d", { alpha: false });
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(bitmap, 0, 0, width, height);

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", 0.82));
  if (!blob) throw new Error("Không thể tạo ảnh WebP.");

  const url = URL.createObjectURL(blob);
  state.optimizedImage = { blob, url, width, height };

  el.imagePreview.src = url;
  el.originalSize.textContent = formatBytes(file.size);
  el.optimizedSize.textContent = formatBytes(blob.size);
  el.optimizedDimensions.textContent = `${width} × ${height}`;
  el.imageResult.hidden = false;

  showNotice(blob.size < file.size
    ? "Ảnh đã được resize và nén trước khi chuẩn bị publish."
    : "Ảnh đã được chuẩn hoá sang WebP. File gốc vốn đã khá nhỏ nên dung lượng không giảm nhiều.");
}

function downloadOptimizedImage() {
  if (!state.optimizedImage) return;
  const slug = el.slug.value.trim() || "product";
  const link = document.createElement("a");
  link.href = state.optimizedImage.url;
  link.download = `${slug}-01.webp`;
  link.click();
}

function downloadJson(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2) + "\n"], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function setSaveState(text) {
  el.saveState.textContent = text;
}

function showNotice(message) {
  el.notice.textContent = message;
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(2) + " MB";
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}

el.newProduct.addEventListener("click", newProduct);
el.exportButton.addEventListener("click", exportCurrent);
el.publishButton.addEventListener("click", publishCurrent);
el.downloadImageButton.addEventListener("click", downloadOptimizedImage);
el.form.addEventListener("submit", saveDraft);

el.name.addEventListener("input", () => {
  const product = currentProduct();
  if (product && product.id.startsWith("san-pham-moi-")) {
    el.slug.value = slugify(el.name.value);
  }
  setSaveState("Chưa lưu");
});

[el.slug, el.price, el.description, el.active].forEach((input) => {
  input.addEventListener("input", () => setSaveState("Chưa lưu"));
});

el.imageInput.addEventListener("change", async () => {
  const file = el.imageInput.files?.[0];
  if (!file) return;

  try {
    await optimizeImage(file);
    setSaveState("Chưa lưu");
  } catch (error) {
    showNotice(error instanceof Error ? error.message : "Không thể xử lý ảnh.");
  }
});

if (state.products.length) {
  selectProduct(state.products[0].id);
} else {
  newProduct();
}
