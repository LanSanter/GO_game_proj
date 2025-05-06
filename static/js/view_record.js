const canvas = document.getElementById("recordBoard");
const ctx = canvas.getContext("2d");
const cellSize = 30;
const boardSize = 19;
let currentStep = 0;
let moves = [];

try {
  moves = JSON.parse(document.getElementById("movesData").value);
  console.log("moves:", moves);
} catch (err) {
  console.error("parse movesData error:", err);
}

function drawBoard() {
  ctx.fillStyle = "#8B7765";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "black";
  for (let i = 0; i < boardSize; i++) {
    ctx.beginPath();
    ctx.moveTo(cellSize / 2, cellSize / 2 + i * cellSize);
    ctx.lineTo(cellSize * (boardSize - 0.5), cellSize / 2 + i * cellSize);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cellSize / 2 + i * cellSize, cellSize / 2);
    ctx.lineTo(cellSize / 2 + i * cellSize, cellSize * (boardSize - 0.5));
    ctx.stroke();
  }
}

function drawStone(x, y, color) {
  ctx.beginPath();
  ctx.arc((x + 0.5) * cellSize, (y + 0.5) * cellSize, cellSize / 2.5, 0, 2 * Math.PI);
  ctx.fillStyle = color;
  ctx.fill();
  console.log("drawStone:", x, y, color);
}

function renderStep(step) {
  drawBoard();
  console.log("renderStep:", step);
  for (let i = 0; i < step && i < moves.length; i++) {
    let move = moves[i];
    drawStone(move.x, move.y, move.color);
  }
}

document.getElementById("prevMove").addEventListener("click", () => {
  if (currentStep > 0) {
    currentStep--;
    console.log("prevMove, currentStep:", currentStep);
    renderStep(currentStep);
  }
});

document.getElementById("nextMove").addEventListener("click", () => {
  if (currentStep < moves.length) {
    currentStep++;
    console.log("nextMove, currentStep:", currentStep);
    renderStep(currentStep);
  }
});

drawBoard();
renderStep(0);