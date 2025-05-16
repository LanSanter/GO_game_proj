const pack  = document.getElementById('pack');
const btn   = document.getElementById('open-btn');
const grid  = document.getElementById('result-grid');
const title = document.getElementById('result-title');

btn.addEventListener('click', async ()=>{
  pack.classList.add('opened');
  btn.disabled = true;
  // 伺服器取得抽卡結果
  const res = await fetch('/api/gacha').then(r=>r.json());
  title.classList.remove('hidden');
  res.cards.forEach(c=>{
    const el = document.createElement('div');
    el.className = 'card';
    el.textContent = c.name;
    grid.appendChild(el);
  });
});