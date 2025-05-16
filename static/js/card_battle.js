// ===== 1. 畫 19×19 棋盤 =====
const board = new Chessboard('board', {
    pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png',
    // 用 chessboard.js 畫格線就可以，之後再換自家 board.js
  });
  document.querySelector('#board').style.border = '1px solid #333';
  
  
fetch("/api/card_deal")
  .then(r=>r.json())
  .then(({hand})=>{
      const handEl = document.getElementById("hand-cards");
      handEl.innerHTML = "";
      hand.forEach(c=>{
         const img = new Image();
         img.src = c.img;
         img.className = "card";
         img.dataset.cardId = c.id;
         handEl.appendChild(img);
      });
  });
