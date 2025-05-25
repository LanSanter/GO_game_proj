import { boardState, currentColorRef, updateCurrentColor, resetGameState, setGameId } from './board_state.js';
import { redrawBoard ,drawBoard} from './board_core.js';

function initSocketEvents(socket, ctx, cellSize,gameIdRef,lastMove,
    {
    onMessage,
    onTurnChanged
}) {
    socket.on("connect", () => {
        
        socket.emit("new_game");
    });

    socket.on("game_created", (data) => {
        gameIdRef.value = data.game_id;
        setGameId(data.game_id);
        console.log(gameIdRef.value);
        redrawBoard(ctx, boardState, cellSize, 19, lastMove);
    });

    socket.on("update_board", (data) => {
        if (data.captures) {
            for (let stone of data.captures) {
                boardState[stone[1]][stone[0]] = null;
            }
            redrawBoard(ctx, boardState, cellSize, 19, lastMove);
        }

        if (data.success) {
            boardState[data.y][data.x] = data.color;
            lastMove = { x: data.x, y: data.y };
            redrawBoard(ctx, boardState, cellSize, 19, lastMove);

            const next = (data.color === "black") ? "white" : "black";
            updateCurrentColor(next);
            onTurnChanged(next);
            onMessage("");  // 清空錯誤訊息
        } else {
            onMessage(data.message || "落子失敗");
        }
    });
    
}

function emitResetBoard(socket, gameIdRef, ctx, boardSize, cellSize) {
    resetGameState(boardState, boardSize);
    socket.emit("reset_board", { game_id: gameIdRef.value });
    drawBoard(ctx, boardSize, cellSize);
}

export {initSocketEvents, emitResetBoard};