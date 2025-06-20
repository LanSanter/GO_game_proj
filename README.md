# GO_game_proj
Game project about GO for PD course

# 🧠 Go Game WebSocket Framework (Flask + JS)

這是一個基於 **Flask + Flask-SocketIO + 原生 JavaScript** 的多人網路圍棋遊戲框架，支援 WebSocket 即時對戰、帳號註冊/登入、棋盤互動與動態前端渲染。適合未來擴展如雙人對戰、自動配對、戰績統計、AI 玩家等功能。

---

## 📁 專案結構
```
go_game_project/ 
├── app.py # 主 Flask 應用（routing + WebSocket） 
├── server.js # 建立連線伺服器
├── game_logic.py # 遊戲邏輯（棋盤控制、輪流判斷、清空） 
├── user_auth.py # 使用者登入/註冊驗證（與 DB 整合）
├── models.py # 資料庫模型（User） 
├── requirements.txt # Python 依賴列表 
├── static/ 前端網頁使用資料
│ ├── css/ 
│ │ └── base.css # 基本樣式 
│ ├── js/ 
│ │ ├── main.js # partial 畫面載入邏輯 
│ │ ├── board/ # WebSocket + 棋盤繪製相關函數 
│ │ ├── conv_mode2.js #卷積圍棋載入
│ │ └── board2.js # 經典圍棋載入
├── templates/ html檔案
│ ├── base.html # 母板模板 
│ ├── lobby.html # 主頁（遊戲畫面） 
│ ├── login.html # 登入頁 
│ ├── register.html # 註冊頁 
│ └── partials/ 
│ │ ├── profile.html # 個人資訊頁 
│ │ └── rules.html # 圍棋規則說明 
├── instance/ # Flask instance folder（會被忽略） 
└── pycache/ # Python cache（會被忽略）
```

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
cd 到妳目前的資料夾 #可做可不做

pip install -r requirement.txt
#或者
# 1) 先把 pip 升級到最新
python -m pip install --upgrade pip

# 2) 裝 Flask、SocketIO 與 eventlet
python -m pip install flask flask_socketio eventlet

# 3) 裝 Flask-SQLAlchemy
pip install Flask-SQLAlchemy
```

### 3.根目錄啟動伺服器
```bash
python app.py              #卷積圍棋目前只需要啟動這個
python server.py           #這是卡牌對戰需要的伺服器
```
開啟瀏覽器進入:
```bash
http://localhost:5000
http://(你的ip):5000/card?room=demo&player=1 #卡牌對戰玩家1
http://(你的ip):5000/card?room=demo&player=2 #卡牌對戰玩家2
```
 

✅ 功能概覽

✅ 帳號註冊/登入（SHA256 加密）

✅ 單人對局、棋子落子、輪流交替

✅ 死活棋評估、領地估算

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
