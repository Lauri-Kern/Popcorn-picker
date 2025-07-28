/* ---------- Config ---------- */
const POPCORN_SRC = "assets/popcorn.png"; // your PNG
const ICON_STROKE = "#7a5a2a";            // inline icon color
const MAX_NAMES   = 200;                  // soft cap to keep UI snappy

/* ---------- State ---------- */
let names = JSON.parse(localStorage.getItem("names") || "[]"); // [{name, absent}]
let picked = [];
let isAnimating = false;
let finaleRunning = false; // prevents double finales
let editingIndex = null;
let editingOriginal = "";

/* ---------- Sanitization ---------- */
function sanitizeName(s){
  const clean = String(s)
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
  return clean;
}

/* ---------- Migrate old formats if needed ---------- */
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
const overlay      = document.getElementById("popcornOverlay");
const overlayMsg   = document.getElementById("overlayMsg");
const popBtn       = document.getElementById("popBtn");

/* ---------- Storage ---------- */
const saveNames = () => localStorage.setItem("names", JSON.stringify(names));

/* ---------- Helpers ---------- */
const visibleNames = () => names.filter(n => !n.absent).map(n => n.name);
const roundComplete = () => {
  const vis = visibleNames();
  if (vis.length === 0) return false;
  return vis.every(n => picked.includes(n));
};
const hasDuplicate = (value, exceptIndex = -1) => {
  const v = value.toLowerCase();
  return names.some((n, i) => i !== exceptIndex && n.name.toLowerCase() === v);
};
const physicsAvailable = () => typeof window.Matter !== "undefined" && !!Matter.Engine;

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

/* ---------- Editing helpers ---------- */
function beginEdit(i){
  editingIndex = i;
  editingOriginal = names[i].name;
  renderList();
  setTimeout(() => {
    const el = document.getElementById(`editInput-${i}`);
    if (el) { el.focus(); el.setSelectionRange(0, el.value.length); }
  }, 0);
}
function commitEdit(i, value){
  const newVal = sanitizeName(value ?? "");
  const oldVal = names[i].name;
  if (!newVal) { cancelEdit(); return; }
  if (hasDuplicate(newVal, i)) { cancelEdit(); return; }
  if (newVal !== oldVal) {
    names[i].name = newVal;
    picked = picked.map(n => n === oldVal ? newVal : n);
    saveNames();
  }
  editingIndex = null; editingOriginal = "";
  renderList();
}
function cancelEdit(){
  editingIndex = null; editingOriginal = "";
  renderList();
}

/* ---------- Rendering ---------- */
function renderList() {
  listEl.textContent = "";
  names.forEach((entry, i) => {
    const li = document.createElement("li");
    li.className = "item";
    if (entry.absent) li.classList.add("absent");

    const eyeBtn = document.createElement("button");
    eyeBtn.className = "icon-btn";
    eyeBtn.title = entry.absent ? "Show for this meeting" : "Hide for this meeting";
    eyeBtn.setAttribute("aria-label", eyeBtn.title);
    eyeBtn.appendChild(iconEye(!entry.absent));
    eyeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      entry.absent = !entry.absent;
      saveNames(); renderList();
    });

    let middle;
    if (editingIndex === i) {
      middle = document.createElement("input");
      middle.type = "text";
      middle.className = "edit-input";
      middle.id = `editInput-${i}`;
      middle.value = entry.name;
      middle.addEventListener("keydown", (e) => {
        if (e.key === "Enter") commitEdit(i, middle.value);
        else if (e.key === "Escape") cancelEdit();
      });
      middle.addEventListener("blur", () => commitEdit(i, middle.value));
    } else {
      middle = document.createElement("span");
      middle.className = "name-label";
      middle.title = "Click to edit";
      middle.textContent = entry.name;
      middle.addEventListener("click", () => beginEdit(i));
    }

    const trashBtn = document.createElement("button");
    trashBtn.className = "icon-btn";
    trashBtn.title = "Delete";
    trashBtn.setAttribute("aria-label", "Delete");
    trashBtn.appendChild(iconTrash());
    trashBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const removed = entry.name;
      names.splice(i, 1);
      picked = picked.filter(n => n !== removed);
      saveNames(); renderList();
    });

    li.append(eyeBtn, middle, trashBtn);
    listEl.appendChild(li);
  });

  // input row
  const inputLi = document.createElement("li");
  inputLi.className = "input-row";
  const input = document.createElement("input");
  input.id = "newNameInput";
  input.type = "text";
  input.placeholder = "Type a name and press Enter…";
  input.autocomplete = "off";
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const v = sanitizeName(input.value);
      if (!v || names.length >= MAX_NAMES || hasDuplicate(v)) return;
      addName(v);
    }
  });
  inputLi.appendChild(input);
  listEl.appendChild(inputLi);

  if (editingIndex === null) {
    setTimeout(() => document.getElementById("newNameInput")?.focus(), 0);
  }
}

function addName(val) {
  const v = sanitizeName(val);
  if (!v || names.length >= MAX_NAMES || hasDuplicate(v)) return;
  names.push({ name: v, absent: false });
  saveNames();
  renderList();
}

/* ---------- Picker ---------- */
function pickName(){
  if (isAnimating || finaleRunning) return;
  const pool = names.filter(n => !n.absent && !picked.includes(n.name));
  const vis = visibleNames();

  if (vis.length === 0) {
    currentNameE.textContent = "Add names below";
    return;
  }
  if (pool.length === 0) {
    finaleThenResetOnClick();
    return;
  }

  let jumps = 0, maxJumps = Math.floor(Math.random()*10) + 10;
  const interval = setInterval(() => {
    const next = pool[Math.floor(Math.random() * pool.length)].name;
    currentNameE.textContent = next;
    if (++jumps > maxJumps){
      clearInterval(interval);
      picked.push(next);
      if (roundComplete()) finaleThenResetOnClick();
    }
  }, 100);
}

/* ---------- Finale: Physics first; fallback to DOM if blocked ---------- */
let physicsCleanup = null;

// Physics params
const SPRITE_PX = 56;
const PIECE_RADIUS = SPRITE_PX/2;
const DENSITY_FACTOR = 4500;
let spriteScale = null;
(function preloadPopcorn(){
  const img = new Image();
  img.src = POPCORN_SRC;
  img.onload = () => { spriteScale = SPRITE_PX / img.naturalWidth; };
})();

function runPhysicsFinale(afterClose){
  if (!physicsAvailable()) return false;

  if (finaleRunning) return true;
  finaleRunning = true;
  isAnimating = true;

  const { Engine, Render, Runner, Bodies, Composite } = Matter;
  const width  = window.innerWidth;
  const height = window.innerHeight;

  // Clean any previous canvas
  overlay.querySelector("canvas")?.remove();

  overlay.classList.remove("u-hidden");
  overlayMsg.classList.remove("u-hidden");
  overlayMsg.textContent = "Everyone popped! 🎉 Click to reset";

  const engine = Engine.create();
  engine.gravity.y = 1.0;

  const render = Render.create({
    element: overlay, engine,
    options: {
      width, height, wireframes: false, background: "transparent",
      pixelRatio: window.devicePixelRatio || 1
    }
  });

  const floor  = Bodies.rectangle(width/2, height+40, width+400, 80, { isStatic:true, render:{ fillStyle:"transparent" } });
  const leftW  = Bodies.rectangle(-40, height/2, 80, height+400,     { isStatic:true, render:{ fillStyle:"transparent" } });
  const rightW = Bodies.rectangle(width+40, height/2, 80, height+400, { isStatic:true, render:{ fillStyle:"transparent" } });
  Composite.add(engine.world, [floor, leftW, rightW]);

  const baseTotal = Math.floor((width * height) / DENSITY_FACTOR);
  const total = Math.max(180, baseTotal);
  for (let i = 0; i < total; i++) {
    const x = Math.random() * width;
    const y = -100 - Math.random() * 500;

    const body = Matter.Bodies.circle(x, y, PIECE_RADIUS, {
      restitution: 0.18,
      friction: 0.3,
      frictionAir: 0.012,
      render: {
        sprite: {
          texture: POPCORN_SRC,
          xScale: (spriteScale ?? (SPRITE_PX / 256)),
          yScale: (spriteScale ?? (SPRITE_PX / 256))
        }
      }
    });
    Matter.Composite.add(engine.world, body);
  }

  const runner = Matter.Runner.create();
  Matter.Runner.run(runner, engine);
  Matter.Render.run(render);

  physicsCleanup = function cleanup() {
    try {
      Matter.Render.stop(render);
      Matter.Runner.stop(runner);
      overlay.querySelector("canvas")?.remove();
      Matter.Composite.clear(engine.world, false);
      overlay.classList.add("u-hidden");
      overlayMsg.classList.add("u-hidden");
    } finally {
      physicsCleanup = null;
      finaleRunning = false;
      isAnimating = false;
      if (typeof afterClose === "function") afterClose();
    }
  };

  const onClick = () => { physicsCleanup?.(); overlay.removeEventListener("click", onClick); };
  overlay.addEventListener("click", onClick);

  return true;
}

/* ---------- Simple DOM fallback (no physics, still fills screen & piles visually) ---------- */
function runFallbackFinale(afterClose){
  if (finaleRunning) return;
  finaleRunning = true;
  isAnimating = true;

  overlay.classList.remove("u-hidden");
  overlayMsg.classList.remove("u-hidden");
  overlayMsg.textContent = "Everyone popped! 🎉 Click to reset";

  // Remove any physics canvas just in case
  overlay.querySelector("canvas")?.remove();

  // Build a grid of popcorns that drop into rows (CSS transitions)
  const size = 56, cell = 58, offset = Math.floor((cell - size) / 2);
  const cols = Math.max(1, Math.floor(window.innerWidth  / cell));
  const rows = Math.max(1, Math.floor(window.innerHeight / cell));
  const total = cols * rows;
  const stack = new Array(cols).fill(0);

  // Clear existing nodes
  [...overlay.querySelectorAll(".fallback-pop")].forEach(n => n.remove());

  for (let i = 0; i < total; i++){
    const col  = i % cols;
    const row  = stack[col]++;
    const x    = col * cell + offset;
    const yEnd = window.innerHeight - (row + 1) * cell + offset;

    const el = document.createElement("img");
    el.className = "fallback-pop";
    el.src = POPCORN_SRC;
    el.alt = "Popcorn";
    el.style.position = "absolute";
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.style.willChange = "transform";
    el.style.transition = "transform 1.1s cubic-bezier(.2,.8,.2,1)";
    el.style.transform = `translate(${x}px, -80px)`;
    overlay.appendChild(el);

    const delay = Math.random() * 800;
    setTimeout(() => { el.style.transform = `translate(${x}px, ${yEnd}px)`; }, delay);
  }

  const onClick = () => {
    // Clear fallback nodes
    [...overlay.querySelectorAll(".fallback-pop")].forEach(n => n.remove());
    overlay.classList.add("u-hidden");
    overlayMsg.classList.add("u-hidden");
    overlay.removeEventListener("click", onClick);
    finaleRunning = false;
    isAnimating = false;
    if (typeof afterClose === "function") afterClose();
  };
  overlay.addEventListener("click", onClick);
}

/* ---------- Unified finale trigger ---------- */
function finaleThenResetOnClick(){
  const afterClose = () => { picked = []; currentNameE.textContent = "Ready?"; };

  // Try physics first; if it fails (e.g., CSP or CDN blocked), fall back
  const started = runPhysicsFinale(afterClose);
  if (!started) runFallbackFinale(afterClose);
}

/* ---------- Init & event bindings ---------- */
renderList();
// Script is at the end of <body>, so DOM is ready—bind directly:
popBtn?.addEventListener("click", pickName);
