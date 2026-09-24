const config = window.COMMERCE_ADMIN_CONFIG || {};
const API_BASE = String(config.apiBase || "http://localhost:8787").replace(/\/$/, "");
const SESSION_KEY = "commerce-core-admin-session-v1";
const STOREFRONT_BASE = new URL(String(config.storefrontBase || "../frontend/"), location.href);

const state = {
  token: sessionStorage.getItem(SESSION_KEY),
  store: null,
  products: [],
  orders: [],
  selectedId: null,
  productImages: [],
  selectionRevision: 0,
  assetBase: STOREFRONT_BASE
};

const el = {
  tabs: [...document.querySelectorAll(".tab")],
  views: {
    products: document.querySelector("#productsView"),
    orders: document.querySelector("#ordersView"),
    settings: document.querySelector("#settingsView")
  },
  logout: document.querySelector("#logoutButton"),
  loginDialog: document.querySelector("#loginDialog"),
  loginForm: document.querySelector("#loginForm"),
  password: document.querySelector("#passwordInput"),
  loginError: document.querySelector("#loginError"),
  productList: document.querySelector("#productList"),
  newProduct: document.querySelector("#newProductButton"),
  editorTitle: document.querySelector("#editorTitle"),
  saveState: document.querySelector("#saveState"),
  name: document.querySelector("#nameInput"),
  slug: document.querySelector("#slugInput"),
  price: document.querySelector("#priceInput"),
  description: document.querySelector("#descriptionInput"),
  active: document.querySelector("#activeInput"),
  imageInput: document.querySelector("#imageInput"),
  imageList: document.querySelector("#imageList"),
  imageCount: document.querySelector("#imageCount"),
  saveDraft: document.querySelector("#saveDraftButton"),
  preview: document.querySelector("#previewButton"),
  publish: document.querySelector("#publishButton"),
  productNotice: document.querySelector("#productNotice"),
  ordersBody: document.querySelector("#ordersBody"),
  refreshOrders: document.querySelector("#refreshOrdersButton"),
  exportOrders: document.querySelector("#exportOrdersButton"),
  ordersMetric: document.querySelector("#ordersMetric"),
  revenueMetric: document.querySelector("#revenueMetric"),
  openOrdersMetric: document.querySelector("#openOrdersMetric"),
  ordersNotice: document.querySelector("#ordersNotice"),
  settingsState: document.querySelector("#settingsState"),
  storeName: document.querySelector("#storeNameInput"),
  storeTagline: document.querySelector("#storeTaglineInput"),
  storePhone: document.querySelector("#storePhoneInput"),
  storeEmail: document.querySelector("#storeEmailInput"),
  storeAddress: document.querySelector("#storeAddressInput"),
  cod: document.querySelector("#paymentCodInput"),
  bank: document.querySelector("#paymentBankInput"),
  payos: document.querySelector("#paymentPayosInput"),
  bankName: document.querySelector("#bankNameInput"),
  bankAccountName: document.querySelector("#bankAccountNameInput"),
  bankAccountNumber: document.querySelector("#bankAccountNumberInput"),
  bankPrefix: document.querySelector("#bankPrefixInput"),
  shippingName: document.querySelector("#shippingNameInput"),
  shippingFee: document.querySelector("#shippingFeeInput"),
  saveSettingsDraft: document.querySelector("#saveSettingsDraftButton"),
  publishSettings: document.querySelector("#publishSettingsButton"),
  settingsNotice: document.querySelector("#settingsNotice")
};

async function api(path, options = {}, authenticated = true) {
  const headers = new Headers(options.headers || {});
  if (options.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  if (authenticated && state.token) headers.set("authorization", "Bearer " + state.token);

  const response = await fetch(API_BASE + path, { ...options, headers });
  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("application/json") ? await response.json() : null;

  if (response.status === 401 && authenticated) {
    state.token = null;
    sessionStorage.removeItem(SESSION_KEY);
    showLogin();
  }

  if (!response.ok) {
    throw new Error(body?.error?.message || "Request failed (" + response.status + ").");
  }

  return body;
}

function showLogin() {
  el.loginError.textContent = "";
  if (!el.loginDialog.open) el.loginDialog.showModal();
  setTimeout(() => el.password.focus(), 0);
}

async function login(event) {
  event.preventDefault();
  el.loginError.textContent = "";

  try {
    const result = await api("/api/v1/admin/session", {
      method: "POST",
      body: JSON.stringify({ password: el.password.value })
    }, false);

    state.token = result.token;
    sessionStorage.setItem(SESSION_KEY, result.token);
    el.password.value = "";
    el.loginDialog.close();
    await loadCatalog();
  } catch (error) {
    el.loginError.textContent = error.message;
  }
}

function logout() {
  state.token = null;
  sessionStorage.removeItem(SESSION_KEY);
  showLogin();
}

async function loadCatalog() {
  const result = await api("/api/v1/admin/catalog");
  state.store = result.store;
  state.products = result.products;
  state.selectedId = state.products[0]?.id || null;
  renderProductList();
  fillProduct();
  fillSettings();
}

function switchView(name) {
  el.tabs.forEach((tab) => tab.classList.toggle("is-active", tab.dataset.view === name));
  Object.entries(el.views).forEach(([key, view]) => view.classList.toggle("is-active", key === name));

  if (name === "orders") loadOrders().catch((error) => showNotice(el.ordersNotice, error.message));
}

function currentProduct() {
  return state.products.find((product) => product.id === state.selectedId);
}

function renderProductList() {
  el.productList.innerHTML = "";

  for (const product of state.products) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "product-item";
    button.setAttribute("aria-current", String(product.id === state.selectedId));
    button.innerHTML = `<strong>${escapeHtml(product.name)}</strong><span>${money(product.price)} · ${product.active ? "Đang bán" : "Ẩn"}</span>`;
    button.addEventListener("click", () => {
      state.selectedId = product.id;
      state.assetBase = STOREFRONT_BASE;
      fillProduct();
      renderProductList();
    });
    el.productList.appendChild(button);
  }
}

function fillProduct() {
  const product = currentProduct();
  if (!product) return;

  el.name.value = product.name;
  el.slug.value = product.slug;
  el.price.value = product.price;
  el.description.value = product.description || "";
  el.active.checked = Boolean(product.active);
  el.editorTitle.textContent = product.name;
  el.saveState.textContent = "Sẵn sàng";
  resetProductImages(product.images || []);
}

function newProduct() {
  const tempId = "new-" + Date.now();
  const product = {
    schemaVersion: "1",
    id: tempId,
    slug: "",
    name: "Sản phẩm mới",
    description: "",
    price: 0,
    compareAtPrice: null,
    images: [],
    tags: [],
    active: false,
    _new: true
  };

  state.products.unshift(product);
  state.selectedId = tempId;
  state.assetBase = STOREFRONT_BASE;
  renderProductList();
  fillProduct();
  el.name.focus();
}

function readProduct() {
  const current = currentProduct();
  if (!current) throw new Error("Chưa chọn sản phẩm.");
  const slug = el.slug.value.trim();
  if (!slug || !/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
    throw new Error("Slug chỉ được dùng chữ thường, số và dấu gạch nối.");
  }
  const id = current._new ? slug : current.id;
  const images = state.productImages.map((image) => image.src);
  const uploads = state.productImages.filter((image) => image.upload).map((image) => image.upload);
  if (images.length > 10) throw new Error("Tối đa 10 ảnh cho một sản phẩm.");
  return {
    product: {
      schemaVersion: "1",
      id,
      slug,
      name: el.name.value.trim(),
      description: el.description.value.trim(),
      price: Math.max(0, Number(el.price.value) || 0),
      compareAtPrice: current.compareAtPrice ?? null,
      images,
      tags: current.tags || [],
      active: el.active.checked
    },
    images: uploads
  };
}

async function saveProduct(mode, openPreview = false) {
  const { product, images } = readProduct();

  if (!product.name) throw new Error("Tên sản phẩm không được để trống.");
  if (state.products.some((item) => item.id !== state.selectedId && item.slug === product.slug)) {
    throw new Error("Slug đã được dùng bởi sản phẩm khác.");
  }

  setProductBusy(true);
  showNotice(el.productNotice, mode === "publish" ? "Đang publish..." : "Đang lưu bản nháp...");

  try {
    const result = await api("/api/v1/admin/products/save", {
      method: "POST",
      body: JSON.stringify({ mode, product, images })
    });

    const index = state.products.findIndex((item) => item.id === state.selectedId);
    state.products[index] = product;
    state.selectedId = product.id;
    state.assetBase = mode === "draft" && result.previewUrl
      ? new URL(result.previewUrl.replace(/\/$/, "") + "/") : STOREFRONT_BASE;
    renderProductList();
    fillProduct();

    if (mode === "draft") {
      const previewPage = result.previewUrl
        ? result.previewUrl.replace(/\/$/, "") + "/product.html?slug=" + encodeURIComponent(product.slug) : null;
      const link = previewPage
        ? ` <a href="${escapeAttribute(previewPage)}" target="_blank" rel="noreferrer">Mở preview</a>`
        : "";
      el.productNotice.innerHTML = "Đã lưu draft." + link;
      if (openPreview && previewPage) window.open(previewPage, "_blank", "noopener");
    } else {
      showNotice(el.productNotice, "Đã publish lên production branch. Cloudflare Pages sẽ deploy commit mới.");
    }
  } finally {
    setProductBusy(false);
  }
}

function setProductBusy(busy) {
  [el.saveDraft, el.preview, el.publish].forEach((button) => button.disabled = busy);
  el.saveState.textContent = busy ? "Đang xử lý" : "Sẵn sàng";
}

function resetProductImages(sources) {
  state.selectionRevision++;
  for (const image of state.productImages) if (image.previewUrl) URL.revokeObjectURL(image.previewUrl);
  state.productImages = sources.map((src) => ({ src, previewUrl: null, upload: null }));
  renderProductImages();
}

function renderProductImages() {
  el.imageList.innerHTML = "";
  el.imageCount.textContent = state.productImages.length + "/10";
  for (const [index, image] of state.productImages.entries()) {
    const row = document.createElement("div");
    row.className = "image-row";
    const preview = document.createElement("img");
    preview.src = image.previewUrl || new URL(image.src.replace(/^\.\//, ""), state.assetBase).href;
    preview.alt = "Ảnh sản phẩm " + (index + 1);
    preview.loading = "lazy";
    row.appendChild(preview);
    const info = document.createElement("div");
    info.className = "image-row-info";
    const name = document.createElement("strong");
    name.textContent = index === 0 ? "Ảnh bìa" : "Ảnh " + (index + 1);
    const meta = document.createElement("span");
    meta.textContent = image.upload
      ? formatBytes(image.originalSize) + " → " + formatBytes(image.optimizedSize) + " · WebP " + image.width + " × " + image.height
      : "Ảnh đã có";
    info.append(name, meta);
    row.appendChild(info);
    const actions = document.createElement("div");
    actions.className = "image-row-actions";
    const action = (label, handler, disabled) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.disabled = disabled;
      button.setAttribute("aria-label", label + " ảnh " + (index + 1));
      button.addEventListener("click", handler);
      actions.appendChild(button);
    };
    action("Lên", () => moveProductImage(index, index - 1), index === 0);
    action("Xuống", () => moveProductImage(index, index + 1), index === state.productImages.length - 1);
    if (index > 0) action("Đặt bìa", () => moveProductImage(index, 0), false);
    action("Xoá", () => {
      const removed = state.productImages.splice(index, 1)[0];
      if (removed.previewUrl) URL.revokeObjectURL(removed.previewUrl);
      renderProductImages();
    }, false);
    row.appendChild(actions);
    el.imageList.appendChild(row);
  }
}

function moveProductImage(from, to) {
  if (to < 0 || to >= state.productImages.length) return;
  state.productImages.splice(to, 0, state.productImages.splice(from, 1)[0]);
  renderProductImages();
}

async function optimizeImage(file) {
  if (!file.type.startsWith("image/")) throw new Error("Chỉ hỗ trợ file ảnh.");
  const bitmap = await createImageBitmap(file);
  try {
    const maxDimension = 1600;
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("Không thể xử lý ảnh trên thiết bị này.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", 0.82));
    if (!blob) throw new Error("Không thể tạo WebP.");
    if (blob.size > 1_500_000) throw new Error("Ảnh sau tối ưu vẫn lớn hơn 1.5 MB.");
    const filename = (slugify(el.slug.value || el.name.value) || "product") + "-" +
      crypto.randomUUID().replace(/-/g, "").slice(0, 12) + ".webp";
    return {
      src: "./assets/products/" + filename,
      upload: { filename, contentBase64: await blobToBase64(blob) },
      previewUrl: URL.createObjectURL(blob),
      originalSize: file.size,
      optimizedSize: blob.size,
      width, height
    };
  } finally {
    bitmap.close();
  }
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function fillSettings() {
  if (!state.store) return;
  const store = state.store;
  const methods = new Set(store.checkout.paymentMethods || []);
  const bank = store.checkout.bankTransfer || {};
  const shipping = store.checkout.shippingMethods?.[0] || { id: "standard", name: "Giao hàng tiêu chuẩn", fee: 0 };

  el.storeName.value = store.name || "";
  el.storeTagline.value = store.tagline || "";
  el.storePhone.value = store.contact?.phone || "";
  el.storeEmail.value = store.contact?.email || "";
  el.storeAddress.value = store.contact?.address || "";
  el.cod.checked = methods.has("cod");
  el.bank.checked = methods.has("bank_transfer");
  el.payos.checked = methods.has("payos");
  el.bankName.value = bank.bankName || "";
  el.bankAccountName.value = bank.accountName || "";
  el.bankAccountNumber.value = bank.accountNumber || "";
  el.bankPrefix.value = bank.transferNotePrefix || "DON";
  el.shippingName.value = shipping.name;
  el.shippingFee.value = shipping.fee;
}

function readStore() {
  const paymentMethods = [];
  if (el.cod.checked) paymentMethods.push("cod");
  if (el.bank.checked) paymentMethods.push("bank_transfer");
  if (el.payos.checked) paymentMethods.push("payos");
  if (!paymentMethods.length) throw new Error("Cần bật ít nhất một phương thức thanh toán.");

  const bankTransfer = el.bank.checked ? {
    bankName: el.bankName.value.trim(),
    accountName: el.bankAccountName.value.trim(),
    accountNumber: el.bankAccountNumber.value.trim(),
    transferNotePrefix: el.bankPrefix.value.trim() || "DON"
  } : null;

  if (el.bank.checked && (!bankTransfer.bankName || !bankTransfer.accountName || !bankTransfer.accountNumber)) {
    throw new Error("Điền đủ thông tin chuyển khoản.");
  }

  return {
    ...state.store,
    schemaVersion: "1",
    name: el.storeName.value.trim(),
    tagline: el.storeTagline.value.trim(),
    contact: {
      phone: el.storePhone.value.trim(),
      email: el.storeEmail.value.trim() || null,
      address: el.storeAddress.value.trim() || null
    },
    checkout: {
      paymentMethods,
      shippingMethods: [{
        id: state.store.checkout.shippingMethods?.[0]?.id || "standard",
        name: el.shippingName.value.trim(),
        fee: Math.max(0, Number(el.shippingFee.value) || 0)
      }],
      bankTransfer
    }
  };
}

async function saveSettings(mode) {
  const store = readStore();
  el.settingsState.textContent = "Đang xử lý";
  [el.saveSettingsDraft, el.publishSettings].forEach((button) => button.disabled = true);

  try {
    const result = await api("/api/v1/admin/store/save", {
      method: "POST",
      body: JSON.stringify({ mode, store })
    });

    state.store = store;
    if (mode === "draft" && result.previewUrl) {
      el.settingsNotice.innerHTML = `Đã lưu draft. <a href="${escapeAttribute(result.previewUrl)}" target="_blank" rel="noreferrer">Mở preview</a>`;
    } else {
      showNotice(el.settingsNotice, "Đã publish cài đặt cửa hàng.");
    }
  } finally {
    [el.saveSettingsDraft, el.publishSettings].forEach((button) => button.disabled = false);
    el.settingsState.textContent = "Sẵn sàng";
  }
}

async function loadOrders() {
  showNotice(el.ordersNotice, "Đang tải...");
  const [ordersResult, summary] = await Promise.all([
    api("/api/v1/admin/orders"),
    api("/api/v1/admin/summary")
  ]);

  state.orders = ordersResult.orders || [];
  el.ordersMetric.textContent = summary.orders;
  el.revenueMetric.textContent = money(summary.paidRevenue);
  el.openOrdersMetric.textContent = summary.openOrders;
  renderOrders();
  showNotice(el.ordersNotice, state.orders.length ? "" : "Chưa có đơn hàng.");
}

function renderOrders() {
  el.ordersBody.innerHTML = "";

  for (const order of state.orders) {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><strong>${escapeHtml(order.id)}</strong><small>${escapeHtml(paymentMethodLabel(order.payment_method))}</small></td>
      <td><strong>${escapeHtml(order.customer_name)}</strong><small>${escapeHtml(order.customer_phone)}</small></td>
      <td>${money(order.total)}</td>
      <td>${paymentSelect(order)}</td>
      <td>${fulfillmentSelect(order)}</td>
      <td>${formatDate(order.created_at)}</td>
    `;

    const payment = row.querySelector('[data-role="payment"]');
    const fulfillment = row.querySelector('[data-role="fulfillment"]');
    payment.addEventListener("change", () => updateOrder(order.id, { paymentStatus: payment.value }));
    fulfillment.addEventListener("change", () => updateOrder(order.id, { fulfillmentStatus: fulfillment.value }));
    el.ordersBody.appendChild(row);
  }
}

async function updateOrder(id, patch) {
  try {
    await api("/api/v1/admin/orders/" + encodeURIComponent(id), {
      method: "PATCH",
      body: JSON.stringify(patch)
    });
    showNotice(el.ordersNotice, "Đã cập nhật " + id + ".");
    await loadOrders();
  } catch (error) {
    showNotice(el.ordersNotice, error.message);
  }
}

function paymentSelect(order) {
  const options = [["unpaid", "Chưa thanh toán"], ["paid", "Đã thanh toán"], ["failed", "Lỗi"], ["refunded", "Đã hoàn tiền"]];
  return `<select data-role="payment">${options.map(([value, label]) =>
    `<option value="${value}" ${order.payment_status === value ? "selected" : ""}>${label}</option>`
  ).join("")}</select>`;
}

function fulfillmentSelect(order) {
  const options = [["new", "Mới"], ["preparing", "Đang chuẩn bị"], ["shipping", "Đang giao"], ["completed", "Hoàn thành"], ["cancelled", "Đã huỷ"]];
  return `<select data-role="fulfillment">${options.map(([value, label]) =>
    `<option value="${value}" ${order.fulfillment_status === value ? "selected" : ""}>${label}</option>`
  ).join("")}</select>`;
}

function exportOrdersCsv() {
  if (!state.orders.length) return;
  const rows = [
    ["order_id", "customer_name", "phone", "total", "currency", "payment_method", "payment_status", "fulfillment_status", "created_at"],
    ...state.orders.map((order) => [order.id, order.customer_name, order.customer_phone, order.total, order.currency, order.payment_method, order.payment_status, order.fulfillment_status, order.created_at])
  ];
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "commerce-orders.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function csvCell(value) {
  const text = String(value ?? "");
  return '"' + text.replace(/"/g, '""') + '"';
}

function paymentMethodLabel(value) {
  return ({ cod: "COD", bank_transfer: "Chuyển khoản", payos: "PayOS" })[value] || value;
}

function money(value) {
  return new Intl.NumberFormat("vi-VN").format(Number(value) || 0) + "đ";
}

function formatDate(value) {
  try {
    return new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
  } catch {
    return value;
  }
}

function slugify(value) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/đ/g, "d").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(2) + " MB";
}

function showNotice(target, message) {
  target.textContent = message;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

el.tabs.forEach((tab) => tab.addEventListener("click", () => switchView(tab.dataset.view)));
el.logout.addEventListener("click", logout);
el.loginForm.addEventListener("submit", login);
el.newProduct.addEventListener("click", newProduct);
el.name.addEventListener("input", () => {
  const product = currentProduct();
  if (product?._new) el.slug.value = slugify(el.name.value);
});
el.imageInput.addEventListener("change", async () => {
  const files = Array.from(el.imageInput.files || []);
  el.imageInput.value = "";
  if (!files.length) return;
  if (files.length + state.productImages.length > 10) {
    showNotice(el.productNotice, "Tối đa 10 ảnh. Hãy xoá ảnh không cần trước khi thêm.");
    return;
  }
  const revision = state.selectionRevision;
  el.imageInput.disabled = true;
  setProductBusy(true);
  showNotice(el.productNotice, "Đang tối ưu " + files.length + " ảnh...");
  try {
    for (const file of files) {
      const image = await optimizeImage(file);
      if (revision !== state.selectionRevision) {
        URL.revokeObjectURL(image.previewUrl);
        return;
      }
      state.productImages.push(image);
      renderProductImages();
    }
    showNotice(el.productNotice, "Đã tối ưu " + files.length + " ảnh. Chọn Lưu bản nháp hoặc Publish để lưu.");
  } catch (error) {
    showNotice(el.productNotice, error.message || "Không thể xử lý ảnh. Các ảnh đã tối ưu vẫn được giữ.");
  } finally {
    el.imageInput.disabled = false;
    setProductBusy(false);
  }
});
el.saveDraft.addEventListener("click", () => saveProduct("draft").catch((error) => showNotice(el.productNotice, error.message)));
el.preview.addEventListener("click", () => saveProduct("draft", true).catch((error) => showNotice(el.productNotice, error.message)));
el.publish.addEventListener("click", () => saveProduct("publish").catch((error) => showNotice(el.productNotice, error.message)));
el.refreshOrders.addEventListener("click", () => loadOrders().catch((error) => showNotice(el.ordersNotice, error.message)));
el.exportOrders.addEventListener("click", exportOrdersCsv);
el.saveSettingsDraft.addEventListener("click", () => saveSettings("draft").catch((error) => showNotice(el.settingsNotice, error.message)));
el.publishSettings.addEventListener("click", () => saveSettings("publish").catch((error) => showNotice(el.settingsNotice, error.message)));

(async function init() {
  if (!state.token) {
    showLogin();
    return;
  }
  try {
    await loadCatalog();
  } catch (error) {
    if (state.token) showNotice(el.productNotice, error.message);
  }
})();
