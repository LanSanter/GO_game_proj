/*******************************************************************************
 * Card Gacha - 1~50.jpg, 寫入 localStorage.ownedCards
 ******************************************************************************/
const MAX_ID   = 50;
const PER_PACK = 5;
const LS_KEY   = "ownedCards";

/* === DOM === */
const btn   = document.getElementById("open-btn");
const grid  = document.getElementById("result-grid");
const title = document.getElementById("result-title");

/* === LocalStorage helpers === */
const load = () => JSON.parse(localStorage.getItem(LS_KEY) || "[]");
const save = data => localStorage.setItem(LS_KEY, JSON.stringify(data));

/* === 卡牌節點 === */
const node = (id, qty) => {
  const li = document.createElement("li");
  li.className = "card";
  li.style.backgroundImage = `url('static/img/cards/${id}.jpg')`;
  if (qty > 1){
    const b = document.createElement("span");
    b.className = "badge";
    b.textContent = `×${qty}`;
    li.appendChild(b);
  }
  return li;
};

/* === 抽卡 === */
btn.onclick = () => {
  btn.disabled = true; grid.innerHTML = ""; title.classList.remove("hidden");

  const owned = load();
  const add = id => {
    const hit = owned.find(o => o.id === id);
    if (hit) hit.qty += 1; else owned.push({id, qty:1});
    return hit ? hit.qty : 1;
  };

  for (let i=0;i<PER_PACK;i++){
    const id = Math.floor(Math.random()*MAX_ID)+1;
    const qty = add(id);
    grid.appendChild(node(id, qty));
  }
  save(owned);
  setTimeout(()=>btn.disabled=false,1500);
};
