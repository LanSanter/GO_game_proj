import { drawBoard, redrawBoard } from './board_core.js';
import { registerBoardClickHandler } from './board_interaction.js';
import { gameIdRef,lastMove, boardState, boardSize, cellSize, currentColorRef } from './board_state.js';
import { emitResetBoard, initSocketEvents } from './board_socket.js';
import { DeathReviewState, drawTerritoryOnTop} from './review.js';
import { registerDeathReviewClickHandler } from './board_interaction.js';
import { runBenson } from './benson.js';


window.addEventListener("DOMContentLoaded", () => {
    const canvas = document.getElementById("board");
    const ctx = canvas.getContext("2d");
    const socket = io();
    
    if (!ctx) {
        console.log("ctx is undefined in drawBoard()");
        return;
    }
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
    
    //註冊重設棋盤按鈕
    document.getElementById("reset-btn").onclick = () => {
        emitResetBoard(socket, gameIdRef, ctx, boardState, boardSize, cellSize);
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
    //註冊審查模式點擊事件
    document.getElementById("review-btn").onclick = () => {
        const autoMarked = runBenson(boardState, boardSize); // 依照目前棋盤狀態重新分析
        const deathReview = new DeathReviewState(autoMarked); // 建立新的標記物件

        registerDeathReviewClickHandler({
            canvas,
            cellSize,
            deathReview,
            statedraw: () => {
                deathReview.drawOnTop(ctx, cellSize, boardState, boardSize, lastMove);
            }
        });
    };
    //註冊領地分布按鈕
    document.getElementById("territory-btn").onclick = () => {
        drawTerritoryOnTop(ctx, cellSize, boardState, boardSize, lastMove);
    }


});