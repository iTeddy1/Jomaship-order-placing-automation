const puppeteer = require("puppeteer");
const xlsx = require("xlsx");
const fs = require("fs");

require("dotenv").config();

// M2_VENIA_BROWSER_PERSISTENCE__signin_token
// Value: {"value":"\"eyJraWQiOiIxIiwiYWxnIjoiSFMyNTYifQ.eyJ1aWQiOjU2Njk5MTEsInV0eXBpZCI6MywiaWF0IjoxNzMxNzM3MzgzLCJleHAiOjE3MzI0Mjg1ODN9.cYtfXfMxJgKQaz80IHc0tcUAuRgXy3oxWcis9qhBJ4w\"","timeStored":1731737384709}

const adjustQuantityByHref = async (page, href, desiredQuantity) => {
  try {
    // Lấy danh sách sản phẩm trong giỏ hàng, đảm bảo đây là một thao tác đồng bộ
    const cartItems = await page.evaluate(() => {
      // Trả về danh sách sản phẩm từ DOM
      return Array.from(document.querySelectorAll(".cart-item")).map((item) => {
        const productLink = item.querySelector(".cart-item-image a")?.getAttribute("href");
        const quantityInputSelector = item.querySelector(".quantity-input") ? ".quantity-input" : null;
        const incrementButtonSelector = item.querySelector(".increment-btn") ? ".increment-btn" : null;

        return {
          href: productLink,
          quantityInputSelector: quantityInputSelector,
          incrementButtonSelector: incrementButtonSelector,
        };
      });
    });

    // Kiểm tra xem `cartItems` có hợp lệ không
    if (!Array.isArray(cartItems) || cartItems.length === 0) {
      throw new Error("Cart items not found or invalid structure.");
    }

    // Tìm sản phẩm theo href
    const cartItem = cartItems.find((item) => item.href === href);

    if (!cartItem) {
      throw new Error(`Product with href ${href} not found in the cart.`);
    }

    console.log(`Found product in cart: ${href}`);

    // Kiểm tra selector tồn tại
    if (!cartItem.quantityInputSelector || !cartItem.incrementButtonSelector) {
      throw new Error(`Selectors for quantity or increment button not found for product ${href}`);
    }

    // Lấy số lượng hiện tại
    let currentQuantity = await page.evaluate((selector) => {
      const input = document.querySelector(selector);
      return input ? parseInt(input.value) : 0;
    }, cartItem.quantityInputSelector);

    if (isNaN(currentQuantity)) {
      throw new Error(`Unable to retrieve current quantity for product ${href}`);
    }

    console.log(`Current quantity for product ${href}: ${currentQuantity}, Desired quantity: ${desiredQuantity}`);

    // Điều chỉnh số lượng
    while (currentQuantity < desiredQuantity) {
      await page.click(cartItem.incrementButtonSelector);
      await new Promise((resolve) => setTimeout(resolve, 5000)); // Đợi nút cập nhật số lượng
      currentQuantity++;
      console.log(`Increased quantity for product ${href} to ${currentQuantity}`);
    }
  } catch (error) {
    console.error(`Error adjusting quantity for product ${href}:`, error.message);
  }
};

(async () => {
  // Đọc dữ liệu từ file Excel
  const workbook = xlsx.readFile("OrderList.xlsx");
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const orders = xlsx.utils.sheet_to_json(sheet); // Chuyển đổi sang mảng object

  const browser = await puppeteer
    .launch({
      headless: false,
    })
    .catch((error) => {
      console.error("Error launching browser:", error);
    });

  const page = await browser.newPage();
  await page.setViewport({ width: 3000, height: 1500 });

  // 1. Login to Jomashop
  await page.goto("https://www.jomashop.com", { waitUntil: "networkidle2" });

  // 2. Thiết lập giá trị trong localStorage
  const tokenKey = "M2_VENIA_BROWSER_PERSISTENCE__signin_token";
  const tokenValue = JSON.stringify({
    value:
      '"eyJraWQiOiIxIiwiYWxnIjoiSFMyNTYifQ.eyJ1aWQiOjU2Njk5MTEsInV0eXBpZCI6MywiaWF0IjoxNzMxNzM3MzgzLCJleHAiOjE3MzI0Mjg1ODN9.cYtfXfMxJgKQaz80IHc0tcUAuRgXy3oxWcis9qhBJ4w"',
    timeStored: 1731737384709,
  });

  await page.evaluate(
    (key, value) => {
      localStorage.setItem(key, value);
    },
    tokenKey,
    tokenValue,
  );

  console.log("Token set in localStorage successfully.");

  // 3. Reload trang để áp dụng token
  await page.reload({ waitUntil: "networkidle2" });

  console.log("Page reloaded with token applied.");

  // Duyệt qua từng Order Number
  for (const [i, order] of orders.entries()) {
    console.log(`Processing order: ${order.SKU}`);
    const { SKU, Quantity } = order;

    // 2. Search product by SKU
    const searchUrl = `https://www.jomashop.com/search?q=${order.SKU}`;
    await page.goto(searchUrl, { waitUntil: "networkidle2" });

    // 3. View product details
    await page.waitForSelector(".productItem", { timeout: 10000 }); // Wait for product links to be available
    const firstProduct = await page.$(".productItem"); // Get the first product link
    const productHref = await page.evaluate((el) => el.querySelector("a")?.getAttribute("href"), firstProduct);
    if (firstProduct) {
      await firstProduct.click(); // Click on the first product to go to the product detail page
    } else {
      console.log(`No products found for SKU: ${SKU}`);
    }

    // 5. Add to cart
    await page.waitForSelector(".add-to-cart-btn", { timeout: 10000 });
    await page.click(".add-to-cart-btn");

    console.log(`Product ${SKU} added to cart.`);

    await page.waitForSelector(".cart-item");
    
    // 6. Adjust quantity in cart sidebar
    await adjustQuantityByHref(page, productHref, Quantity);

    // Quay lại trang chính
    await page.goto("https://www.jomashop.com", { waitUntil: "networkidle2" });

    // Tùy chọn: In thông tin đơn hàng đã xử lý
    console.log(`Order ${SKU} processed successfully.`);
  }

  // Đóng trình duyệt
  await browser.close();
})();