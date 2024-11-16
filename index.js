const puppeteer = require("puppeteer");
const xlsx = require("xlsx");
const fs = require("fs");

require("dotenv").config();


// M2_VENIA_BROWSER_PERSISTENCE__signin_token
// Value: {"value":"\"{YOUR_TOKEN}\"","timeStored":1731737384709}

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
  await page.setViewport({ width: 1900, height: 1500 });

  // 1. Login to Jomashop
  await page.goto("https://www.jomashop.com", { waitUntil: "networkidle2" });

  console.log("Please set the token manually in the browser's localStorage and then reload the page.");
  await page.evaluate(() => {
    // This is where the page will pause and you can manually set the token
    alert("Manually set the token in localStorage and reload the page.");
  });

  // 2. Xử lý popup nếu xuất hiện
  await handlePopup(page);

  await page.waitForNavigation({ waitUntil: "networkidle2" });
  console.log("Page reloaded and ready to proceed.");

  // Duyệt qua từng Order Number
  for (const order of orders) {
    console.log(`Processing order: ${order.SKU}`);
    handlePopup(page);
    const { SKU, Quantity } = order;

    // 2. Search product by SKU
    const searchUrl = `https://www.jomashop.com/search?q=${order.SKU}`;
    await page.goto(searchUrl, { waitUntil: "networkidle2" });

    // 3. View product details
    await page.waitForSelector(".productItem", { timeout: 10000 }); // Wait for product links to be available
    const firstProduct = await page.$(".productItem"); // Get the first product link
    if (firstProduct) {
      await firstProduct.click(); // Click on the first product to go to the product detail page
    } else {
      console.log(`No products found for SKU: ${SKU}`);
    }

    // 5. Add to cart
    await page.waitForSelector(".add-to-cart-btn", { timeout: 10000 }); // Wait for product links to be available
    await page.click(".add-to-cart-btn");

    // 6. Increment the quantity in the cart sidebar using the "increment" button
    const incrementButton = await page.$(".qty-btn.increment-btn"); // The button to increase quantity
    if (incrementButton) {
      // Click the increment button the required number of times to match the desired quantity
      const currentQuantityText = await page.$eval(".quantity-input", (el) => el.innerText); // Get current quantity
      let currentQuantity = parseInt(currentQuantityText.trim());
      const desiredQuantity = order.Quantity;

      // Click the increment button the necessary number of times
      while (currentQuantity < desiredQuantity) {
        await incrementButton.click();
        currentQuantity++; // Increment the current quantity
        console.log(`Increased quantity to ${currentQuantity}`);
      }
    } else {
      console.log("No increment button found in the cart sidebar");
    }

    console.log(`Added ${Quantity} of ${SKU} to the cart`);

    // Quay lại trang chính
    await page.goto("https://www.jomashop.com", { waitUntil: "networkidle2" });

    // Tùy chọn: In thông tin đơn hàng đã xử lý
    console.log(`Order ${SKU} processed successfully.`);
  }

  // Đóng trình duyệt
  await browser.close();
})();

const handlePopup = async (page) => {
  try {
    await page.waitForSelector(".ltkpopup-close-button", { timeout: 5000 });
    await page.click(".ltkpopup-close-button"); // Nhấn nút đóng popup
    console.log("Popup đã được đóng.");
  } catch (error) {
    console.log("Không có popup xuất hiện, tiếp tục quy trình.");
  }
};

//! QUÁ TRÌNH ĐĂNG NHẬP BỊ CHẶN BỞI CAPTCHA
// await page.click(".rhs-account .rhs-text");
// await page.waitForSelector("#email_address"); // Đợi input email xuất hiện
// await page.type("#email_address", process.env.USER_NAME);

// // Đợi người dùng nhập CAPTCHA và mật khẩu nếu cần
// console.log("Vui lòng giải CAPTCHA và hoàn tất đăng nhập.");
// await new Promise((resolve) => {
//   process.stdin.once("data", () => resolve());
// });

// await page.click('.actions-toolbar .btn.primary[type="submit"]'); // Nhấn "Continue"

// // Nhập mật khẩu và nhấn "Login"
// await page.waitForSelector("#password"); // Đợi input mật khẩu xuất hiện
// await page.type("#password", process.env.PASS_WORD); // Nhập mật khẩu
// await page.click('.actions-toolbar .btn.primary[type="submit"]'); // Nhấn nút "Login"

// // Đợi người dùng nhập CAPTCHA và mật khẩu nếu cần
// console.log("Vui lòng giải CAPTCHA và hoàn tất đăng nhập.");
// await new Promise((resolve) => {
//   process.stdin.once("data", () => resolve());
// });
// await page.waitForNavigation({ waitUntil: "networkidle2" });
// console.log("Đăng nhập thành công.");
