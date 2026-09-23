const config = window.COMMERCE_STOREFRONT_CONFIG || {};
const API_BASE = String(config.apiBase || "http://localhost:8787").replace(/\/$/, "");

const state = { store: null, products: [], cart: loadCart() };

const el = {
  grid: document.querySelector("#productGrid"),
  tagline: document.querySelector("#storeTagline"),
  statusBanner: document.querySelector("#statusBanner"),
  cartButton: document.querySelector("#cartButton"),
  cartCount: document.querySelector("#cartCount"),
  cartPanel: document.querySelector("#cartPanel"),
  closeCart: document.querySelector("#closeCartButton"),
  backdrop: document.querySelector("#backdrop"),
  cartItems: document.querySelector("#cartItems"),
  cartSummary: document.querySelector("#cartSummary"),
  cartTotal: document.querySelector("#cartTotal"),
  checkoutButton: document.querySelector("#checkoutButton"),
  checkoutDialog: document.querySelector("#checkoutDialog"),
  checkoutForm: document.querySelector("#checkoutForm"),
  closeCheckout: document.querySelector("#closeCheckoutButton"),
  paymentSelect: document.querySelector("#paymentSelect"),
  shippingSelect: document.querySelector("#shippingSelect"),
  checkoutTotal: document.querySelector("#checkoutTotal"),
  submitCheckout: document.querySelector("#submitCheckoutButton"),
  checkoutResult: document.querySelector("#checkoutResult")
};

async function init() {
  try {
    const [storeResponse, productsResponse] = await Promise.all([
      fetch("./data/store.json", { cache: "no-store" }),
      fetch("./data/products.json", { cache: "no-store" })
    ]);
    if (!storeResponse.ok || !productsResponse.ok) throw new Error("Không thể tải dữ liệu cửa hàng.");

    state.store = await storeResponse.json();
    state.products = (await productsResponse.json()).filter((product) => product.active);
    document.title = state.store.name;
    document.querySelector(".logo").textContent = state.store.name;
    el.tagline.textContent = state.store.tagline || "";
    renderProducts();
    renderCheckoutOptions();
    renderCart();
    await handlePaymentReturn();
  } catch (error) {
    el.grid.innerHTML = `<p class="empty-cart">${escapeHtml(error.message || "Không thể tải cửa hàng.")}</p>`;
  }
}

function renderProducts() {
  el.grid.innerHTML = "";
  for (const product of state.products) {
    const article = document.createElement("article");
    article.className = "product-card";
    const image = product.images?.[0] || "./assets/product-placeholder.svg";
    article.innerHTML = `
      <div class="product-visual"><img src="${escapeAttribute(image)}" alt="${escapeAttribute(product.name)}" loading="lazy"></div>
      <div class="product-info">
        <div class="product-line"><h3>${escapeHtml(product.name)}</h3><span class="price">${money(product.price)}</span></div>
        <p>${escapeHtml(product.description)}</p>
        <button class="add-button" type="button">Thêm vào giỏ</button>
      </div>
    `;
    article.querySelector(".add-button").addEventListener("click", () => addToCart(product.id));
    el.grid.appendChild(article);
  }
}

function addToCart(productId) {
  const item = state.cart.find((entry) => entry.productId === productId);
  if (item) item.quantity += 1;
  else state.cart.push({ productId, quantity: 1 });
  persistCart();
  renderCart();
  openCart();
}

function changeQuantity(productId, delta) {
  const item = state.cart.find((entry) => entry.productId === productId);
  if (!item) return;
  item.quantity += delta;
  if (item.quantity <= 0) state.cart = state.cart.filter((entry) => entry.productId !== productId);
  persistCart();
  renderCart();
}

function removeItem(productId) {
  state.cart = state.cart.filter((entry) => entry.productId !== productId);
  persistCart();
  renderCart();
}

function detailedCart() {
  return state.cart.map((item) => ({ ...item, product: state.products.find((product) => product.id === item.productId) })).filter((item) => item.product);
}

function renderCart() {
  const detailed = detailedCart();
  const totalQuantity = detailed.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = detailed.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  el.cartCount.textContent = totalQuantity;
  el.cartSummary.textContent = totalQuantity ? totalQuantity + " sản phẩm" : "Chưa có sản phẩm";
  el.cartTotal.textContent = money(subtotal);
  el.checkoutButton.disabled = detailed.length === 0;
  el.cartItems.innerHTML = "";

  if (!detailed.length) {
    el.cartItems.innerHTML = '<p class="empty-cart">Giỏ hàng đang trống.</p>';
    return;
  }

  for (const item of detailed) {
    const row = document.createElement("div");
    row.className = "cart-item";
    row.innerHTML = `
      <strong>${escapeHtml(item.product.name)}</strong>
      <span>${money(item.product.price * item.quantity)}</span>
      <div class="quantity">
        <button type="button" aria-label="Giảm số lượng">−</button>
        <span>${item.quantity}</span>
        <button type="button" aria-label="Tăng số lượng">+</button>
        <button class="remove-button" type="button">Xoá</button>
      </div>
    `;
    const buttons = row.querySelectorAll(".quantity button");
    buttons[0].addEventListener("click", () => changeQuantity(item.productId, -1));
    buttons[1].addEventListener("click", () => changeQuantity(item.productId, 1));
    buttons[2].addEventListener("click", () => removeItem(item.productId));
    el.cartItems.appendChild(row);
  }
}

function renderCheckoutOptions() {
  el.paymentSelect.innerHTML = "";
  for (const method of state.store.checkout.paymentMethods) {
    const option = document.createElement("option");
    option.value = method;
    option.textContent = paymentLabel(method);
    el.paymentSelect.appendChild(option);
  }

  el.shippingSelect.innerHTML = "";
  for (const method of state.store.checkout.shippingMethods) {
    const option = document.createElement("option");
    option.value = method.id;
    option.textContent = method.name + " · " + money(method.fee);
    el.shippingSelect.appendChild(option);
  }
}

function openCart() {
  el.cartPanel.classList.add("open");
  el.cartPanel.setAttribute("aria-hidden", "false");
  el.backdrop.hidden = false;
}

function closeCart() {
  el.cartPanel.classList.remove("open");
  el.cartPanel.setAttribute("aria-hidden", "true");
  el.backdrop.hidden = true;
}

function openCheckout() {
  if (!state.cart.length) return;
  closeCart();
  updateCheckoutEstimate();
  el.checkoutResult.innerHTML = "";
  el.checkoutDialog.showModal();
}

function updateCheckoutEstimate() {
  const subtotal = detailedCart().reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const shipping = state.store.checkout.shippingMethods.find((method) => method.id === el.shippingSelect.value) || state.store.checkout.shippingMethods[0];
  el.checkoutTotal.textContent = money(subtotal + (shipping?.fee || 0));
}

async function submitCheckout(event) {
  event.preventDefault();
  const form = new FormData(el.checkoutForm);
  const payload = {
    storeId: state.store.id,
    items: state.cart.map(({ productId, quantity }) => ({ productId, quantity })),
    customer: {
      name: String(form.get("name") || ""),
      phone: String(form.get("phone") || ""),
      address: String(form.get("address") || "")
    },
    shippingMethod: String(form.get("shippingMethod") || ""),
    paymentMethod: String(form.get("paymentMethod") || "")
  };

  el.submitCheckout.disabled = true;
  el.submitCheckout.textContent = "Đang tạo đơn...";
  el.checkoutResult.textContent = "";

  try {
    const response = await fetch(API_BASE + "/api/v1/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result?.error?.message || "Không thể tạo đơn.");
    el.checkoutTotal.textContent = money(result.total);

    if (result.payment?.type === "redirect") {
      window.location.href = result.payment.url;
      return;
    }

    state.cart = [];
    persistCart();
    renderCart();

    if (result.payment?.type === "bank_transfer") {
      el.checkoutResult.innerHTML = `
        <div class="bank-instructions">
          <strong>Đơn ${escapeHtml(result.orderId)} đã được tạo</strong>
          <span>${escapeHtml(result.payment.bankName)} · ${escapeHtml(result.payment.accountNumber)}</span>
          <span>${escapeHtml(result.payment.accountName)}</span>
          <span>Nội dung: <strong>${escapeHtml(result.payment.transferNote)}</strong></span>
          <span>Số tiền: <strong>${money(result.total)}</strong></span>
        </div>
      `;
    } else {
      el.checkoutResult.innerHTML = `Đã tạo đơn <strong>${escapeHtml(result.orderId)}</strong>. Shop sẽ liên hệ để xác nhận.`;
    }
  } catch (error) {
    el.checkoutResult.textContent = error.message || "Không thể tạo đơn.";
  } finally {
    el.submitCheckout.disabled = false;
    el.submitCheckout.textContent = "Đặt hàng";
  }
}

async function handlePaymentReturn() {
  const params = new URLSearchParams(location.search);
  const payment = params.get("payment");
  const orderId = params.get("order");
  const token = params.get("token");
  if (!payment || !orderId || !token) return;

  el.statusBanner.hidden = false;
  el.statusBanner.textContent = payment === "cancel"
    ? "Thanh toán đã bị huỷ. Đơn vẫn được giữ để bạn có thể thử lại hoặc liên hệ shop."
    : "Đang kiểm tra trạng thái thanh toán...";

  try {
    const response = await fetch(API_BASE + "/api/v1/orders/" + encodeURIComponent(orderId) + "?token=" + encodeURIComponent(token));
    const order = await response.json();
    if (!response.ok) throw new Error(order?.error?.message || "Không thể kiểm tra đơn.");

    if (order.paymentStatus === "paid") {
      el.statusBanner.textContent = "Thanh toán thành công cho " + order.orderId + ". Shop đã nhận trạng thái thanh toán.";
      state.cart = [];
      persistCart();
      renderCart();
    } else if (payment === "success") {
      el.statusBanner.textContent = "Đã quay lại từ trang thanh toán. Hệ thống đang chờ webhook xác nhận tiền cho " + order.orderId + ".";
    }
  } catch (error) {
    el.statusBanner.textContent = error.message;
  }
}

function paymentLabel(method) {
  return ({ cod: "Thanh toán khi nhận hàng", bank_transfer: "Chuyển khoản", payos: "PayOS" })[method] || method;
}
function money(value) { return new Intl.NumberFormat("vi-VN").format(Number(value) || 0) + "đ"; }
function loadCart() { try { return JSON.parse(localStorage.getItem("deskbits-cart-v1") || "[]"); } catch { return []; } }
function persistCart() { localStorage.setItem("deskbits-cart-v1", JSON.stringify(state.cart)); }
function escapeHtml(value) { return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char])); }
function escapeAttribute(value) { return escapeHtml(value); }

el.cartButton.addEventListener("click", openCart);
el.closeCart.addEventListener("click", closeCart);
el.backdrop.addEventListener("click", closeCart);
el.checkoutButton.addEventListener("click", openCheckout);
el.closeCheckout.addEventListener("click", () => el.checkoutDialog.close());
el.shippingSelect.addEventListener("change", updateCheckoutEstimate);
el.checkoutForm.addEventListener("submit", submitCheckout);
init();
