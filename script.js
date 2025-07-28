/* ---------- State ---------- */
let names  = JSON.parse(localStorage.getItem("names") || "[]"); // [{name,hidden}]
let picked = []; // names already chosen this round

/* ---------- DOM ---------- */
const nameListEl   = document.getElementById("nameList");
const nameInput    = document.getElementById("nameInput");
const currentNameE = document.getElementById("currentName");
const popcornRain  = document.getElementById("popcornRain");

/* ---------- Helpers ---------- */
const saveNames = () => localStorage.setItem("names", JSON.stringify(names));

/* ---------- List Rendering ---------- */
function renderList(){
  nameListEl.innerHTML = "";
  names.forEach((entry, i) => {
    const li   = document.createElement("li");
    if (entry.hidden) li.classList.add("hidden");

    const label = document.createElement("span");
    label.textContent = entry.name;

    /* buttons: hide/show + delete */
    const btnWrap = document.createElement("div");
    btnWrap.className = "name-btns";

    const hideBtn = document.createElement("button");
    hideBtn.textContent = entry.hidden ? "👁️" : "🙈";
    hideBtn.title = entry.hidden ? "Un-hide" : "Hide";
    hideBtn.onclick = () => { entry.hidden = !entry.hidden; saveNames(); renderList(); };

    const delBtn  = document.createElement("button");
    delBtn.textContent = "🗑️";
    delBtn.title = "Delete";
    delBtn.onclick = () => { 
      names.splice(i,1);           // remove from list
      picked = picked.filter(n=>n!==entry.name); // also remove from picked pool
      saveNames(); 
      renderList(); 
    };

    btnWrap.append(hideBtn, delBtn);
    li.append(label, btnWrap);
    nameListEl.appendChild(li);
  });
}

/* ---------- Add Name ---------- */
function addName(){
  const val = nameInput.value.trim();
  if(!val) return;
  names.push({name:val,hidden:false});
  nameInput.value="";
  saveNames();
  renderList();
}

/* ---------- Picker ---------- */
function pickName(){
  const pool = names.filter(n=>!n.hidden && !picked.includes(n.name));
  if (pool.length === 0){
    alert("All visible names picked! Hit Reset to start over.");
    return;
  }

  let jumps = 0, maxJumps = Math.floor(Math.random()*10)+10;
  const interval = setInterval(()=>{
    const next = pool[Math.floor(Math.random()*pool.length)].name;
    currentNameE.textContent = next;
    if (++jumps>maxJumps){
      clearInterval(interval);
      picked.push(next);
    }
  }, 100);
}

/* ---------- Reset + Popcorn Rain ---------- */
function resetRound(){
  picked = [];
  currentNameE.textContent = "";

  popcornRain.innerHTML = "";        // fresh slate
  popcornRain.classList.remove("hidden");

  for (let i=0;i<150;i++){
    const pop = document.createElement("div");
    pop.className = "popcorn-emoji";
    pop.textContent = "🍿";
    pop.style.animationDelay = `${Math.random()*1.5}s`;
    popcornRain.appendChild(pop);
  }

  // clear overlay on first click
  const clear = () =>{
    popcornRain.classList.add("hidden");
    popcornRain.innerHTML = "";
    popcornRain.removeEventListener("click", clear);
  };
  popcornRain.addEventListener("click", clear);
}

/* ---------- Init ---------- */
renderList();
