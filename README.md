# GO_game_proj
Game project about GO for PD course

# 🧠 Go Game WebSocket Framework (Flask + JS)

這是一個基於 **Flask + Flask-SocketIO + 原生 JavaScript** 的多人網路圍棋遊戲框架，支援 WebSocket 即時對戰、帳號註冊/登入、棋盤互動與動態前端渲染。適合未來擴展如雙人對戰、自動配對、戰績統計、AI 玩家等功能。

---

## 📁 專案結構

go_game_project/ 
├── app.py # 主 Flask 應用（routing + WebSocket） 
├── game_logic.py # 遊戲邏輯（棋盤控制、輪流判斷、清空） 
├── user_auth.py # 使用者登入/註冊驗證（與 DB 整合） ├── models.py # 資料庫模型（User） 
├── requirements.txt # Python 依賴列表 
├── static/ 
│ ├── css/ 
│ │ └── base.css # 基本樣式 
│ ├── js/ 
│ │ ├── main.js # partial 畫面載入邏輯 
│ │ └── board.js # WebSocket + 棋盤繪製 
├── templates/ │ ├── base.html # 母板模板 
│ ├── index.html # 主頁（遊戲畫面） 
│ ├── login.html # 登入頁 
│ ├── register.html # 註冊頁 
│ └── partials/ 
│ ├── profile.html # 個人資訊頁 
│ └── rules.html # 圍棋規則說明 
├── instance/ # Flask instance folder（會被忽略） 
└── pycache/ # Python cache（會被忽略）


---

## ⚙️ 安裝與環境準備

### 1. 建立虛擬環境（可選）
```bash
python -m venv venv
source venv/bin/activate        # macOS/Linux
venv\Scripts\activate           # Windows
```
### 2.安裝依賴
```bash
pip install -r requirements.txt
```

### 3.根目錄啟動伺服器
```bash
python app.py
```
開啟瀏覽器進入:
```bash
http://localhost:5000
```

✅ 功能概覽
✅ 帳號註冊/登入（SHA256 加密）

✅ 單人對局、棋子落子、輪流交替

✅ 清空棋盤功能（reset）

✅ WebSocket 即時同步

✅ Partial 載入（動態插入 profile、規則）

✅ SQLite 資料儲存
🛠️ 可擴充方向
 雙人配對對戰（房間機制）

 棋譜儲存與重播

 AI 對戰模式（連結 GnuGo 或自製判斷）

 使用者積分 / 排行榜

 對戰邀請 / 好友系統
