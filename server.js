// server.js
import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import process from "process";
import crypto from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const resetTokens = {}; //token 對應 userId 的暫存資料

const app = express();
app.use(cors());
app.use(express.json());

const dbPath = path.join(__dirname, "db.json");

let dbData;

function loadDB() {
  const rawData = fs.readFileSync(dbPath, "utf-8");
  dbData = JSON.parse(rawData);
}

function saveDB() {
  fs.writeFileSync(dbPath, JSON.stringify(dbData, null, 2), "utf-8");
}

// 初始化資料
try {
  loadDB();
} catch (error) {
  console.error("讀取 db.json 失敗:", error);
  process.exit(1);
}

// Middleware: 簡易驗證 token
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ code: 401, message: "未授權，缺少 token" });
  }

  const token = authHeader.replace("Bearer ", "");
  const userId = token.replace("fake-jwt-token-", "");

  // 檢查用戶是否存在
  const user = dbData.user?.find((u) => u.id === userId);
  if (!user) {
    return res.status(401).json({ code: 401, message: "Token 無效" });
  }

  // 將用戶 ID 加入到請求物件中
  req.userId = userId;
  next();
}

// 取得菜單
app.get("/menu", (req, res) => {
  res.json({
    code: 0,
    message: "取得成功",
    data: {
      categories: dbData.menu.categories,
      products: dbData.menu.products,
      extras: dbData.menu.extras,
    },
  });
});

// 新增訂單
app.post("/orders", (req, res) => {
  const newOrder = {
    orderId: "order_" + Date.now(),
    timestamp: new Date().toISOString(),
    ...req.body,
  };

  dbData.orders = dbData.orders || [];
  dbData.orders.push(newOrder);
  saveDB();

  res.json({
    code: 0,
    message: "新增成功",
    data: {
      orderId: newOrder.orderId,
      timestamp: newOrder.timestamp,
    },
  });
});

// 取得歷史訂單（需登入）
app.get("/orders/history", authMiddleware, (req, res) => {
  // 從請求物件中取得用戶 ID
  const userId = req.userId;

  // 過濾出該用戶的訂單
  const userOrders = dbData.orders.filter((order) => order.userId === userId);

  res.json({
    code: 0,
    message: "取得成功",
    data: userOrders || [],
  });
});

// 會員登入
app.post("/login", (req, res) => {
  const { email, password } = req.body;

  // 模擬數據庫查詢帳密
  const user = dbData.user?.find((u) => u.email === email);

  // 先檢查帳號是否存在
  if (!user) {
    return res.status(401).json({
      code: 401,
      message: "找不到此帳號",
    });
  }

  // 再檢查密碼是否正確
  if (user.password !== password) {
    // 密碼錯誤
    return res.status(403).json({
      code: 403,
      message: "密碼錯誤",
    });
  }

  // 登入成功，根據用戶 ID 生成對應的 token
  const token = `fake-jwt-token-${user.id}`;

  res.json({
    code: 0,
    message: "登入成功",
    data: {
      token: token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        birthday: user.birthday,
        createdAt: user.createdAt,
      },
    },
  });
});

// 會員註冊
app.post("/register", (req, res) => {
  const { email, password, name, phone, birthday } = req.body;

  // 檢查 email 是否已存在
  const existingUser = dbData.user?.find((u) => u.email === email);
  if (existingUser) {
    return res.status(400).json({
      code: 400,
      message: "此 email 已被註冊",
    });
  }

  // 生成新用戶 ID
  const newUserId = "C" + (dbData.user?.length + 1).toString().padStart(2, "0");

  // 創建新用戶
  const newUser = {
    id: newUserId,
    email,
    password,
    name,
    phone,
    birthday,
    createdAt: new Date().toISOString(),
  };

  // 將新用戶加入資料庫
  dbData.user = dbData.user || [];
  dbData.user.push(newUser);
  saveDB();

  // 生成 token
  const token = `fake-jwt-token-${newUserId}`;

  res.json({
    code: 0,
    message: "註冊成功",
    data: {
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        phone: newUser.phone,
        birthday: newUser.birthday,
        createdAt: newUser.createdAt,
      },
      token,
    },
  });
});

// 取得首頁橫幅
app.get("/banners", (req, res) => {
  res.json({
    code: 0,
    message: "取得成功",
    data: {
      list: dbData.banners,
    },
  });
});

// 更新密碼
app.patch("/users/:id", authMiddleware, (req, res) => {
  const userId = req.params.id;
  const { oldPassword, newPassword } = req.body;

  // 驗證請求的用戶 ID 是否與 token 中的一致
  if (userId !== req.userId) {
    return res.status(403).json({
      code: 403,
      message: "無權限修改其他用戶資料",
    });
  }

  // 找到用戶
  const user = dbData.user.find((u) => u.id === userId);
  if (!user) {
    return res.status(404).json({
      code: 404,
      message: "找不到用戶",
    });
  }

  // 驗證舊密碼
  if (user.password !== oldPassword) {
    return res.status(405).json({
      code: 405,
      message: "舊密碼錯誤",
    });
  }

  // 更新密碼
  user.password = newPassword;
  saveDB();

  res.json({
    code: 0,
    message: "密碼修改成功",
  });
});

//忘記密碼
app.post("/forgot-password", (req, res) => {
  const { email } = req.body;
  const user = dbData.user?.find((u) => u.email === email);

  if (!user) {
    return res.status(404).json({ code: 1, message: "信箱不存在" });
  }

  const token = crypto.randomUUID();
  resetTokens[token] = user.id;

  res.json({
    code: 0,
    message: "重設連結已產生",
    token: token,
    resetLink: `/reset-password?token=${token}`,
  });
});

//重設密碼
app.post("/reset-password", (req, res) => {
  const { token, newPassword } = req.body;

  const userId = resetTokens[token];

  if (!userId) {
    return res.status(400).json({ code: 400, message: "無效或過期的 token" });
  }

  const user = dbData.user?.find((u) => u.id === userId);

  if (!user) {
    return res.status(404).json({ code: 404, message: "找不到對應使用者" });
  }

  user.password = newPassword;
  saveDB();

  delete resetTokens[token];

  res.json({
    code: 0,
    message: "密碼已成功重設",
  });
});

// 處理 Vue Router History 模式的路由 fallback
app.use((req, res, next) => {
  const accept = req.headers.accept || "";
  if (accept.includes("text/html")) {
    res.sendFile(path.resolve(__dirname, "dist/index.html"));
  } else {
    next();
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {});
