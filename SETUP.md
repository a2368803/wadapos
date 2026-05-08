# 餐廳備援點餐系統 — 部署指南

## 1. 建立 Supabase 專案

1. 前往 [supabase.com](https://supabase.com) 建立免費帳號
2. 建立新專案（選擇最近的地區，例如東京）
3. 進入 **SQL Editor**，完整執行 `supabase-schema.sql`
4. 至 **Settings > API** 複製：
   - `Project URL`
   - `anon public` key
   - `service_role` key（**保密，勿分享**）

## 2. 建立管理員帳號

1. 進入 Supabase **Authentication > Users**
2. 點選 **Add user > Create new user**
3. 填入電子信箱與密碼（這就是後台登入帳號）
4. 建議啟用 **Email Confirm** 關閉（避免需要驗信）：
   - **Authentication > Providers > Email** → 關閉 `Confirm email`

## 3. 本機開發

```bash
# 複製環境變數範例
cp .env.local.example .env.local
# 填入你的 Supabase URL 與 key
# 安裝相依套件
npm install
# 啟動開發伺服器
npm run dev
```

開啟：
- 客戶點餐頁：`http://localhost:3000/order`
- 管理後台：`http://localhost:3000/admin`

## 4. 部署到 Vercel（免費）

1. 將專案 push 到 GitHub
2. 前往 [vercel.com](https://vercel.com) → Import Project
3. 選取 GitHub repo
4. 在 **Environment Variables** 填入三個 key（參考 `.env.local.example`）
5. 點選 Deploy

## 5. QR Code 設定

部署後取得 Vercel 網址（例如：`https://wadapos.vercel.app`）

用任何 QR Code 產生器（免費）產生指向以下 URL 的 QR Code：

```
https://wadapos.vercel.app/order?table=1
```

每桌一個 QR Code，`table=` 後面填桌號，客人掃碼後桌號會自動填入。

## 6. 列印設定

### 58mm 熱感印表機
1. 用藍牙連接到平板/電腦
2. 將印表機設為預設印表機
3. 管理後台點「🖨 列印」會開啟新視窗
4. 點視窗內「🖨 列印」按鈕
5. 選擇你的熱感印表機，確認 **紙張尺寸** 設為 58mm

### A4 備援列印
若暫無熱感印表機，系統會用 A4 格式列印，一樣清晰可用。

## 7. 備援流程

```
主 POS 掛掉
     ↓
打開 /admin/dashboard（平板/手機）
     ↓
客人掃 QR Code → 點餐 → 自動出現在後台
     ↓
後台看到訂單 → 點「🖨 列印」→ 印出廚房單
     ↓
如果 QR 也不能用（客人手機壞、網路斷）
     ↓
進入「手動建立訂單」→ 店員快速打單 → 印出
```

## 8. 網路斷線應急

若 WiFi 斷線：
- 請使用手機行動熱點
- 讓平板/電腦連上手機熱點
- 系統即可正常運作（需要 3G 以上網速）

---

**系統管理帳號：** 請記錄在安全的地方，遺失需至 Supabase 後台重設。
