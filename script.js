/* ---------- Config ---------- */
const POPCORN_SRC = "assets/popcorn.png"; // image name per your request
const ICON_STROKE = "#7a5a2a";            // inline icon color

/* ---------- State ---------- */
let names = JSON.parse(localStorage.getItem("names") || "[]"); // [{name, absent}]
let picked = [];
let isAnimating = false;

/* Migrate old formats if needed */
let migrated = false;
names = names.map(n => {
  if (typeof n === "string") { migrated = true; return { name: n, absent: false }; }
  if ("hidden" in n && !("absent" in n)) { migrated = true; return { name: n.name, absent: !!n.hidden }; }
  return n;
});
if (migrated) localStorage.setItem("names", JSON.stringify(names));

/* ---------- DOM ---------- */
const listEl       = document.getElementById("nameList");
const currentNameE = document.getElementById("currentName");
const popcornOv    = document.getElementById("popcornOverlay");

/* ---------- Storage ---------- */
const saveNames = () => localStorage.setItem("names", JSON.stringify(names));

/* ---------- Helpers ---------- */
const visibleNames = () => names.filter(n => !n.absent).map(n => n.name);
const roundComplete = () => {
  const vis = visibleNames();
  if (vis.length === 0) return false;
  return vis.every(n => picked.includes(n));
};

/* ---------- Inline SVG Icons ---------- */
const NS = "http://www.w3.org/2000/svg";
function svgEl(name, attrs = {}){ const el = document.createElementNS(NS, name); for (const [k,v] of Object.entries(attrs)) el.setAttribute(k,v); return el; }
function iconEye(open = true){
  const svg = svgEl("svg", { viewBox:"0 0 24 24", fill:"none", "aria-hidden":"true" });
  svg.appendChild(svgEl("path", { d:"M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z", stroke:ICON_STROKE, "stroke-width":"2", "stroke-linecap":"round", "stroke-linejoin":"round" }));
  svg.appendChild(svgEl("circle", { cx:"12", cy:"12", r:"3", fill:ICON_STROKE }));
  if (!open) svg.appendChild(svgEl("path", { d:"M3 3l18 18", stroke:ICON_STROKE, "stroke-width":"2", "stroke-linecap":"round" }));
  return svg;
}
function iconTrash(){
  const svg = svgEl("svg", { viewBox:"0 0 24 24", fill:"none", "aria-hidden":"true" });
  svg.appendChild(svgEl("polyline", { points:"3 6 5 6 21 6", stroke:ICON_STROKE, "stroke-width":"2", "stroke-linecap":"round", "stroke-linejoin":"round" }));
  svg.appendChild(svgEl("path", { d:"M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6", stroke:ICON_STROKE, "stroke-width":"2", "stroke-linecap":"round", "stroke-linejoin":"round" }));
  svg.appendChild(svgEl("path", { d:"M10 11v6", stroke:ICON_STROKE, "stroke-width":"2", "stroke-linecap":"round" }));
  svg.appendChild(svgEl("path", { d:"M14 11v6", stroke:ICON_STROKE, "stroke-width":"2", "stroke-linecap":"round" }));
  svg.appendChild(svgEl("path", { d:"M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2", stroke:ICON_STROKE, "stroke-width":"2", "stroke-linecap":"round" }));
  return svg;
}

/* ---------- Rendering ---------- */
function renderList() {
  listEl.innerHTML = "";

  // existing names
  names.forEach((entry, i) => {
    const li = document.createElement("li");
    li.className = "item";
    if (entry.absent) li.classList.add("absent");

    // left: eye toggle
    const eyeBtn = document.createElement("button");
    eyeBtn.className = "icon-btn";
    eyeBtn.title = entry.absent ? "Show for this meeting" : "Hide for this meeting";
    eyeBtn.setAttribute("aria-label", eyeBtn.title);
    eyeBtn.appendChild(iconEye(!entry.absent));
    eyeBtn.onclick = (e) => {
      e.stopPropagation();
      entry.absent = !entry.absent;
      // If someone is hidden mid-round, roundComplete() uses only visible names
      saveNames();
      renderList();
    };

    // middle: name text
    const nameSpan = document.createElement("span");
    nameSpan.textContent = entry.name;

    // right: trash
    const trashBtn = document.createElement("button");
    trashBtn.className = "icon-btn";
    trashBtn.title = "Delete";
    trashBtn.setAttribute("aria-label", "Delete");
    trashBtn.appendChild(iconTrash());
    trashBtn.onclick = (e) => {
      e.stopPropagation();
      const removed = entry.name;
      names.splice(i, 1);
      picked = picked.filter(n => n !== removed);
      saveNames();
      renderList();
    };

    li.append(eyeBtn, nameSpan, trashBtn);
    listEl.appendChild(li);
  });

  // input row at the end
  const inputLi = document.createElement("li");
  inputLi.className = "input-row";
  const input = document.createElement("input");
  input.id = "newNameInput";
  input.type = "text";
  input.placeholder = "Type a name and press Enter…";
  input.autocomplete = "off";
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const val = input.value.trim();
      if (!val) return;
      addName(val);
    }
  });
  inputLi.appendChild(input);
  listEl.appendChild(inputLi);

  // focus the new row for fast entry
  setTimeout(() => document.getElementById("newNameInput")?.focus(), 0);
}

function addName(val) {
  names.push({ name: val, absent: false });
  saveNames();
  renderList(); // re-render and focus a fresh input row automatically
}

/* ---------- Picker ---------- */
function pickName(){
  if (isAnimating) return; // avoid spam during rain
  const pool = names.filter(n => !n.absent && !picked.includes(n.name));
  const vis = visibleNames();

  if (vis.length === 0) {
    currentNameE.textContent = "Add names below";
    return;
  }

  let jumps = 0, maxJumps = Math.floor(Math.random()*10) + 10;

  // If pool is empty right now (e.g., user kept clicking), auto reset
  if (pool.length === 0) {
    autoRainReset();
    return;
  }

  const interval = setInterval(() => {
    const next = pool[Math.floor(Math.random() * pool.length)].name;
    currentNameE.textContent = next;
    if (++jumps > maxJumps){
      clearInterval(interval);
      picked.push(next);

      // If after adding this one we're done with all visible names, auto rain+reset
      if (roundComplete()) autoRainReset();
    }
  }, 100);
}

/* ---------- Popcorn pile (auto on final pick) ---------- */
function launchPopcornPile({ auto=false, duration=2400 } = {}){
  popcornOv.innerHTML = "";
  popcornOv.classList.remove("u-hidden");

  const size = 40, cell = 42, offset = Math.floor((cell - size) / 2);
  const cols = Math.max(1, Math.floor(window.innerWidth  / cell));
  const rows = Math.max(1, Math.floor(window.innerHeight / cell));
  const total = cols * rows;
  const stack = new Array(cols).fill(0);

  for (let i = 0; i < total; i++){
    const col  = i % cols;
    const row  = stack[col]++;
    const x    = col * cell + offset;
    const yEnd = window.innerHeight - (row + 1) * cell + offset;

    const el = document.createElement("img");
    el.className = "popcorn-piece";
    el.src = POPCORN_SRC;
    el.alt = "Popcorn";

    const jitter = 6;
    const xJ = x + Math.floor(Math.random() * jitter);
    el.style.transform = `translate(${xJ}px, -80px)`;
    popcornOv.appendChild(el);

    const delay = Math.random() * 800;
    setTimeout(() => {
      el.style.transform = `translate(${xJ}px, ${yEnd}px)`;
    }, delay);
  }

  const clear = () => {
    popcornOv.classList.add("u-hidden");
    popcornOv.innerHTML = "";
    popcornOv.removeEventListener("click", clear);
  };

  // still allow click to dismiss, but also auto-hide if requested
  popcornOv.addEventListener("click", clear);
  if (auto) setTimeout(clear, duration);
}

/* Auto rain + reset state */
function autoRainReset(){
  isAnimating = true;
  launchPopcornPile({ auto: true, duration: 2600 });
  // reset round shortly after rain completes
  setTimeout(() => {
    picked = [];
    currentNameE.textContent = "Ready?";
    isAnimating = false;
  }, 2800);
}

/* ---------- Init ---------- */
renderList();

/* Expose for inline handlers in HTML */
window.pickName = pickName;
