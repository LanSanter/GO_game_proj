// interaction.js

export function registerBoardClickHandler({ canvas, cellSize, boardState, socket, gameIdRef, getCurrentColor, onMessage }) {
    
    canvas.addEventListener("click", (e) => {
        console.log(gameIdRef.value);
        const rect = canvas.getBoundingClientRect();
        const x = Math.floor((e.clientX - rect.left) / cellSize);
        const y = Math.floor((e.clientY - rect.top) / cellSize);

        if (boardState[y][x] !== null) {
            onMessage("該位置已有棋子！");
            return;
        }

        socket.emit("place_stone", {
            game_id: gameIdRef.value,
            x,
            y,
            color: getCurrentColor()
        });
    });
}
