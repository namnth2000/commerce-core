const state = {
  store: null,
  products: [],
  cart: loadCart()
};

const el = {
  grid: document.querySelector("#productGrid"),
  tagline: document.querySelector("#storeTagline"),
  cartButton: document.querySelector("#cartButton"),
  cartCount: document.querySelector("#cartCount"),
  cartPanel: document.querySelector("#cartPanel"),
  closeCartButton: document.querySelector("#closeCartButton"),
  backdrop: document.querySelector("#backdrop"),
  cartItems: document.querySelector("#cartItems"),
  cartSummary: document.querySelector("#cartSummary"),
  cartTotal: document.querySelector("#cartTotal"),
  checkoutButton: document.querySelector("#checkoutButton"),
  checkoutDialog: document.querySelector("#checkoutDialog"),
  checkoutForm: document.querySelector("#checkoutForm"),
  closeCheckoutButton: document.querySelector("#closeCheckoutButton"),
  paymentSelect: document.querySelector("#paymentSelect"),
  shippingSelect: document.querySelector("#shippingSelect"),
  checkoutTotal: document.querySelector("#checkoutTotal"),
  checkoutResult: document.querySelector("#checkoutResult")
};

async function init() {
  try {
    const [storeResponse, productsResponse] = await Promise.all([
      fetch("./data/store.json"),
      fetch("./data/products.json")
    ]);

    if (!storeResponse.ok || !productsResponse.ok) {
      throw new Error("Không thể tải dữ liệu cửa hàng.");
    }

    state.store = await storeResponse.json();
    state.products = (await productsResponse.json()).filter((product) => product.active);

    document.title = state.store.name;
    el.tagline.textContent = state.store.tagline;

    renderProducts();
    renderCheckoutOptions();
    renderCart();
  } catch (error) {
    el.grid.innerHTML = `<p class="empty-cart">${escapeHtml(error instanceof Error ? error.message : "Không thể tải cửa hàng.")}</p>`;
  }
}

function renderProducts() {
  el.grid.innerHTML = "";

  state.products.forEach((product) => {
    const article = document.createElement("article");
    article.className = "product-card";

    const image = product.images[0] || "./assets/product-placeholder.svg";

    article.innerHTML = `
      <div class="product-visual">
        <img src="${escapeAttribute(image)}" alt="${escapeAttribute(product.name)}" loading="lazy">
      </div>
      <div class="product-info">
        <div class="product-line">
          <h3>${escapeHtml(product.name)}</h3>
          <span class="price">${money(product.price)}</span>
        </div>
        <p>${escapeHtml(product.description)}</p>
        <button class="add-button" type="button" data-product-id="${escapeAttribute(product.id)}">Thêm vào giỏ</button>
      </div>
    `;

    article.querySelector(".add-button").addEventListener("click", () => addToCart(product.id));
    el.grid.appendChild(article);
  });
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
  if (item.quantity <= 0) {
    state.cart = state.cart.filter((entry) => entry.productId !== productId);
  }

  persistCart();
  renderCart();
}

function removeItem(productId) {
  state.cart = state.cart.filter((entry) => entry.productId !== productId);
  persistCart();
  renderCart();
}

function renderCart() {
  const detailed = state.cart
    .map((item) => ({
      ...item,
      product: state.products.find((product) => product.id === item.productId)
    }))
    .filter((item) => item.product);

  const totalQuantity = detailed.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = detailed.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

  el.cartCount.textContent = totalQuantity;
  el.cartSummary.textContent = totalQuantity ? `${totalQuantity} sản phẩm` : "Chưa có sản phẩm";
  el.cartTotal.textContent = money(subtotal);
  el.checkoutButton.disabled = detailed.length === 0;
  el.cartItems.innerHTML = "";

  if (!detailed.length) {
    el.cartItems.innerHTML = '<p class="empty-cart">Giỏ hàng đang trống.</p>';
    return;
  }

  detailed.forEach((item) => {
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
  });
}

function renderCheckoutOptions() {
  el.paymentSelect.innerHTML = "";
  state.store.checkout.paymentMethods.forEach((method) => {
    const option = document.createElement("option");
    option.value = method;
    option.textContent = paymentLabel(method);
    el.paymentSelect.appendChild(option);
  });

  el.shippingSelect.innerHTML = "";
  state.store.checkout.shippingMethods.forEach((method) => {
    const option = document.createElement("option");
    option.value = method.id;
    option.textContent = `${method.name} · ${money(method.fee)}`;
    el.shippingSelect.appendChild(option);
  });
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
  updateCheckoutTotal();
  el.checkoutResult.textContent = "";
  el.checkoutDialog.showModal();
}

function updateCheckoutTotal() {
  const subtotal = state.cart.reduce((sum, item) => {
    const product = state.products.find((candidate) => candidate.id === item.productId);
    return sum + (product ? product.price * item.quantity : 0);
  }, 0);

  const shipping = state.store.checkout.shippingMethods.find((method) => method.id === el.shippingSelect.value)
    || state.store.checkout.shippingMethods[0];

  el.checkoutTotal.textContent = money(subtotal + (shipping?.fee || 0));
}

function submitDemoCheckout(event) {
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

  console.info("Demo checkout payload", payload);
  el.checkoutResult.textContent = "Đã tạo payload checkout theo contract v0.1. Backend thật chưa được kết nối.";
}

function paymentLabel(method) {
  return ({
    cod: "Thanh toán khi nhận hàng",
    bank_transfer: "Chuyển khoản",
    payos: "PayOS"
  })[method] || method;
}

function money(value) {
  return new Intl.NumberFormat("vi-VN").format(value) + "đ";
}

function loadCart() {
  try {
    return JSON.parse(localStorage.getItem("deskbits-cart-v0.1") || "[]");
  } catch {
    return [];
  }
}

function persistCart() {
  localStorage.setItem("deskbits-cart-v0.1", JSON.stringify(state.cart));
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

el.cartButton.addEventListener("click", openCart);
el.closeCartButton.addEventListener("click", closeCart);
el.backdrop.addEventListener("click", closeCart);
el.checkoutButton.addEventListener("click", openCheckout);
el.closeCheckoutButton.addEventListener("click", () => el.checkoutDialog.close());
el.shippingSelect.addEventListener("change", updateCheckoutTotal);
el.checkoutForm.addEventListener("submit", submitDemoCheckout);

init();
