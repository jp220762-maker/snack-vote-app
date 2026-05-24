# 零食採購票選系統

辦公室零食票選網站，貼上賣場連結自動帶入商品資料，匿名投票，結果即時公開。

## 功能

- 貼上全聯 / 家樂福 / momo / 蝦皮商品網址，自動帶入名稱、圖片、價格
- 匿名投票（瀏覽器指紋防重複），每人可投多個品項
- 結果即時同步（Supabase Realtime），所有人看到同一份排名
- 結果頁每個品項旁有「前往下單」連結，直接跳轉賣場商品頁
- 管理員可開關投票週期、刪除品項
- 自動計算前三名採購預算

---

## 部署步驟（約 20 分鐘）

### 1. 建立 Supabase 專案

1. 前往 [https://supabase.com](https://supabase.com) 免費註冊
2. 建立新專案，記下 **Project URL** 和 **anon public key**（在 Settings > API）
3. 進入 **SQL Editor**，把 `supabase-schema.sql` 的內容全部貼上執行

### 2. 部署到 Vercel

```bash
# 安裝 Vercel CLI（已有可跳過）
npm i -g vercel

# 在專案資料夾執行
vercel

# 跟著提示操作，部署完成後會得到一個網址
```

或直接在 [vercel.com](https://vercel.com) 匯入此 GitHub repo。

### 3. 設定環境變數

在 Vercel 專案的 **Settings > Environment Variables** 新增：

| 變數名 | 值 |
|--------|-----|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://你的ID.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 你的 anon key |
| `NEXT_PUBLIC_ADMIN_PASSWORD` | 自訂管理員密碼 |

設定完後在 Vercel 重新部署一次（Deployments > Redeploy）。

### 4. 建立第一個投票週期

1. 開啟網站，點「管理」頁籤
2. 輸入管理員密碼登入
3. 點「建立新週期」，輸入標題（如「2024/06 零食票選」）
4. 系統自動開放投票

### 5. 分享連結給同仁

把 Vercel 給的網址傳到 LINE 群組或公司群組即可。

---

## 本地開發

```bash
npm install
cp .env.example .env.local
# 填入 .env.local 的 Supabase 資料
npm run dev
# 開啟 http://localhost:3000
```

---

## 注意事項

**自動抓取成功率**

| 賣場 | 成功率 | 備註 |
|------|--------|------|
| 全聯 | 中 | og:title 有，圖片不一定有 |
| 家樂福 | 高 | og 標籤完整 |
| momo | 低 | 有反爬蟲，圖片可能抓不到 |
| 蝦皮 | 低 | JavaScript 渲染，需手動確認 |

抓不到時會顯示錯誤提示，使用者可手動填寫商品名稱和價格。

**安全性**

- 管理員密碼存在環境變數，不會暴露在前端 bundle 中（NEXT_PUBLIC 除外）
- 若需更嚴格的權限控制，可在 Supabase 的 RLS policy 加上 JWT 驗證
- 目前匿名投票用瀏覽器 localStorage fingerprint，換裝置或清瀏覽器資料可重複投票；如需更嚴格可改用公司 Google OAuth

---

## 技術架構

```
前端：Next.js 14 (React + TypeScript)
資料庫：Supabase (PostgreSQL + Realtime)
部署：Vercel (免費方案)
商品抓取：Next.js API Route (Serverless Function)
```
