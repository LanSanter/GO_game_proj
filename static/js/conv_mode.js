const socket = io();
const gameId = /* 從 URL 或伺服器取得目前房間 ID */;
const myColor= /* 登入者對應的顏色，後端可塞到 template */;

let chosenKernel = null;

fetch('/api/filters')
  .then(r => r.json())
  .then(filters => renderFilters(filters));

function renderFilters(filters) {
  const list = document.getElementById('filter-list');
  filters.forEach((kernel, idx) => {
    const card = document.createElement('div');
    card.className = 'filter-card';
    card.dataset.idx = idx;
    const tbl = document.createElement('table');
    kernel.forEach(row => {
      const tr = document.createElement('tr');
      row.forEach(n => {
        const td = document.createElement('td');
        td.textContent = n;
        tr.appendChild(td);
      });
      tbl.appendChild(tr);
    });
    card.appendChild(tbl);
    card.addEventListener('click', () => selectFilter(card, kernel));
    list.appendChild(card);
  });
}

function selectFilter(el, kernel) {
  if (el.classList.contains('filter-used')) return;
  document.querySelectorAll('.filter-card').forEach(c => c.style.outline='none');
  el.style.outline = '3px solid #f00';
  chosenKernel = kernel;
  document.getElementById('apply-btn').disabled = false;
}

document.getElementById('apply-btn').addEventListener('click', () => {
  socket.emit('apply_filter', {
    game_id: gameId,
    color  : myColor,
    kernel : chosenKernel
  });
});

socket.on('update_board', data => {
  updateBoardCanvas(data.board);
  if (data.conv_by === myColor) {
    document.querySelectorAll('.filter-card').forEach(card => {
      const k = JSON.parse(card.dataset.kernel || '[]');
      if (JSON.stringify(k) === JSON.stringify(chosenKernel))
        card.classList.add('filter-used');
    });
    document.getElementById('apply-btn').disabled = true;
  }
});

socket.on('conv_error', d => alert(d.msg));