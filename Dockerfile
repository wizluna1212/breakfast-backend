# 使用 Node.js 官方映像
FROM node:18

# 建立 app 資料夾
WORKDIR /app

# 複製 backend 資料夾裡的所有東西
COPY . .

# 安裝依賴
RUN npm install

# 對外開放埠號
EXPOSE 3001

# 執行伺服器
CMD ["node", "server.js"]
