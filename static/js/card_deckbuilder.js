/* -------- 1. 載入卡池 -------- */
let cards = {};
fetch("/api/cards")
  .then(r=>r.json())
  .then(data=>{
    cards = Object.fromEntries(data.map(c=>[c.id, c]));
    const collection = document.getElementById("collection");
    data.forEach(c=>{
      const img = new Image();
      img.src = card.img; 
      img.className = "card";
      img.dataset.cardId = c.id;
      collection.appendChild(img);
    });
    initSortable();
  });

/* -------- 2. 拖拉 + 計數 -------- */
function initSortable(){
  const deckSlots = document.getElementById("deck-slots");
  new Sortable(collection ,{group:'cards', animation:150});
  new Sortable(deckSlots,{
    group:'cards', animation:150,
    onAdd:updateCount, onRemove:updateCount
  });
  updateCount();
}

function updateCount(){
  const slots = [...document.querySelectorAll("#deck-slots .card")];
  const stone = slots.filter(c=>cards[c.dataset.cardId].type==="stone").length;
  const non   = slots.length - stone;
  const total = slots.length;

  document.getElementById("deck-progress").value = total;
  document.getElementById("card-count").textContent = total;

  // 規則提示
  let err = "";
  if (stone!==70)           err = "棋子牌需 70 張";
  else if (non<40||non>60)  err = "非棋子牌須 40-60 張";
  else if (total>130)       err = "超過 130 張";
  else {
    // 同名 >2 檢查
    const dup = {};
    slots.forEach(c=>{
      const id = c.dataset.cardId;
      dup[id] = (dup[id]||0)+1;
      if (cards[id].type!=="stone" && dup[id]>2) err=`${cards[id].name} 超過 2 張`;
    });
  }
  document.getElementById("export-deck").disabled = !!err;
  document.getElementById("export-deck").textContent = err ? err : "匯出 / 匯入";
}

/* -------- 3. 儲存 -------- */
document.getElementById("export-deck").onclick = ()=>{
  const deck = [...document.querySelectorAll("#deck-slots .card")]
               .map(c=>+c.dataset.cardId);
  fetch("/api/decks",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({deck})
  })
  .then(r=>r.json().then(j=>[r.status,j]))
  .then(([status,json])=>{
    if(status===201) alert("牌組已儲存！");
    else alert(json.error);
  });
};

  