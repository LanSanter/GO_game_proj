import { drawBoard, redrawBoard } from './board_core.js';
import { registerBoardClickHandler } from './interaction.js';
import { gameIdRef,lastMove, boardState, boardSize, cellSize, currentColorRef } from './board_state.js';
import { emitResetBoard, initSocketEvents } from './board_socket.js';
import { createCardSelector, loadFilterCardsFromAPI, registerApplyHandler } from './filter_ui.js';



window.addEventListener("DOMContentLoaded", () => {
    const canvas = document.getElementById("board");
    const ctx = canvas.getContext("2d");
    const socket = io();
    
    if (!ctx) {
        console.log("ctx is undefined in drawBoard()");
        return;
    }

    // 建立選擇器
    const selector = createCardSelector({
        setButtonDisabled: (v) => {
            document.getElementById("apply-btn").disabled = v;
        }
    });
    // 載入並渲染卡片
    loadFilterCardsFromAPI({
        container: document.getElementById("filter-list"),
        onSelect: selector.selectCard
    });
    //初始化棋盤
    initSocketEvents(socket, ctx, cellSize, gameIdRef, lastMove, {
        onMessage: (msg) => {
            document.getElementById("error-msg").textContent = msg;
        },
        onTurnChanged: (color) => {
            const turnBox = document.getElementById("turn-indicator");
            turnBox.textContent = (color === "black") ? "⚫黑棋" : "⚪白棋";
        }
    });
    


    // 註冊卷機卡使用按鈕
    registerApplyHandler({
        socket,
        selector,
        gameIdRef,
        currentColorRef,
        boardState,
        boardSize,
        onTurnChanged: (color) => {
            const turnBox = document.getElementById("turn-indicator");
            turnBox.textContent = (color === "black") ? "⚫黑棋" : "⚪白棋";
        }
    });
    //註冊重設棋盤按鈕
    document.getElementById("reset-btn").onclick = () => {
        emitResetBoard(socket, gameIdRef, ctx, boardSize, cellSize);
    };
    //註冊畫布點擊事件
    registerBoardClickHandler({
        canvas,
        cellSize,
        boardState,
        socket,
        gameIdRef,
        getCurrentColor: () => currentColorRef.value,
        onMessage: (msg) => {
            document.getElementById("error-msg").textContent = msg;
        }
    });


    //後端要增加socketio event:"filter_used"
    /*@socketio.on("filter_used")
    def handle_filter_used(data):
        game_id = data.get("game_id")
        player = data.get("player")
        filter_id = data.get("filter_id")

        emit("filter_used", {"filter_id": filter_id}, room=game_id, broadcast=True)
    */
    socket.on("filter_used", ({ filter_id }) => {
        const cards = document.querySelectorAll(".filter-card");
        for (let card of cards) {
            if (card.dataset.id === filter_id) {
                card.classList.remove("selected");
                card.classList.add("flipped");
                card.onclick = null;  // 禁用點擊
            }
        }
    });
});



