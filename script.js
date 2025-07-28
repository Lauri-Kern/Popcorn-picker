/* ---------- Config ---------- */
const POPCORN_SRC = "assets/popcorn.png"; // your PNG
const ICON_STROKE = "#7a5a2a";            // inline icon color

/* ---------- State ---------- */
let names = JSON.parse(localStorage.getItem("names") || "[]"); // [{name, absent}]
let picked = [];
let isAnimating = false;
let finaleRunning = false;      // prevents double physics finales
let editingIndex = null;        // which row is being edited
let editingOriginal = "";       // original text of that row

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
const overlay      = document.getElementById("popcornOverlay");
const overlayMsg   = document.getElementById("overlayMsg");

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

/* ---------- Editing helpers ---------- */
function beginEdit(i){
  editingIndex = i;
  editingOriginal = names[i].name;
  renderList();
  // Focus and select text
  setTimeout(() => {
    const el = document.getElementById(`editInput-${i}`);
    if (el) { el.focus(); el.setSelectionRange(0, el.value.length); }
  }, 0);
}

function commitEdit(i, value){
  const newVal = (value || "").trim();
  const oldVal = names[i].name;
  if (!newVal) {
    // empty -> revert
    editingIndex = null; editingOriginal = "";
    renderList();
    return;
  }
  if (newVal !== oldVal) {
    names[i].name = newVal;
    // update any picked occurrences so no-repeat logic still works
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
      saveNames(); renderList();
    };

    // middle: name (label OR edit input)
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
      middle.onclick = () => beginEdit(i);
    }

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
      saveNames(); renderList();
    };

    li.append(eyeBtn, middle, trashBtn);
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

  // focus the new row for fast entry (only if not in edit mode)
  if (editingIndex === null) {
    setTimeout(() => document.getElementById("newNameInput")?.focus(), 0);
  }
}

function addName(val) {
  names.push({ name: val, absent: false });
  saveNames();
  renderList(); // re-render and focus a fresh input row automatically
}

/* ---------- Picker ---------- */
function pickName(){
  if (isAnimating || finaleRunning) return; // avoid spam / duplicate finales
  const pool = names.filter(n => !n.absent && !picked.includes(n.name));
  const vis = visibleNames();

  if (vis.length === 0) {
    currentNameE.textContent = "Add names below";
    return;
  }

  // If pool is empty (all visible already picked), trigger finale once
  if (pool.length === 0) {
    physicsFinaleThenResetOnClick();
    return;
  }

  let jumps = 0, maxJumps = Math.floor(Math.random()*10) + 10;
  const interval = setInterval(() => {
    const next = pool[Math.floor(Math.random() * pool.length)].name;
    currentNameE.textContent = next;
    if (++jumps > maxJumps){
      clearInterval(interval);
      picked.push(next);
      if (roundComplete()) physicsFinaleThenResetOnClick();
    }
  }, 100);
}

/* ---------- Physics finale (gravity + collisions) ---------- */
let physicsCleanup = null; // function to clean engine/renderer

// Preload image to compute sprite scale accurately
let spriteScale = null;
(function preloadPopcorn(){
  const img = new Image();
  img.src = POPCORN_SRC;
  img.onload = () => { spriteScale = SPRITE_PX / img.naturalWidth; };
})();

// Larger sprites & higher fill
const SPRITE_PX = 56;            // visual width of each popcorn sprite (~56px)
const PIECE_RADIUS = SPRITE_PX/2; // physics circle radius
const DENSITY_FACTOR = 4500;     // smaller = more pieces; was 7000

function launchPhysicsFinale({ afterClose } = {}){
  if (finaleRunning) return; // guard
  finaleRunning = true;
  isAnimating = true;

  const { Engine, Render, Runner, Bodies, Composite } = Matter;
  const width  = window.innerWidth;
  const height = window.innerHeight;

  // Ensure overlay is clean (remove old canvas if any)
  const oldCanvas = overlay.querySelector("canvas");
  if (oldCanvas) oldCanvas.remove();

  // Show overlay & message
  overlay.classList.remove("u-hidden");
  overlayMsg.classList.remove("u-hidden");
  overlayMsg.textContent = "Everyone popped! 🎉 Click to reset";

  // Create engine & renderer
  const engine = Engine.create();
  engine.gravity.y = 1.0; // gravity

  const render = Render.create({
    element: overlay, engine,
    options: {
      width, height, wireframes: false, background: "transparent",
      pixelRatio: window.devicePixelRatio || 1
    }
  });

  // Static boundaries (floor + side walls)
  const floor  = Bodies.rectangle(width/2, height+40, width+400, 80, { isStatic:true, render:{ fillStyle:"transparent" } });
  const leftW  = Bodies.rectangle(-40, height/2, 80, height+400,      { isStatic:true, render:{ fillStyle:"transparent" } });
  const rightW = Bodies.rectangle(width+40, height/2, 80, height+400,  { isStatic:true, render:{ fillStyle:"transparent" } });
  Composite.add(engine.world, [floor, leftW, rightW]);

  // Spawn popcorn pieces (sprites) with collisions
  const baseTotal = Math.floor((width * height) / DENSITY_FACTOR);
  const total = Math.max(180, baseTotal); // ensure a good fill on small screens
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
          xScale: (spriteScale ?? (SPRITE_PX / 256)), // fallback scale (assume 256px source)
          yScale: (spriteScale ?? (SPRITE_PX / 256))
        }
      }
    });

    Matter.Composite.add(engine.world, body);
  }

  // Start engine
  const runner = Matter.Runner.create();
  Matter.Runner.run(runner, engine);
  Matter.Render.run(render);

  // Cleanup function
  physicsCleanup = function cleanup() {
    try {
      Matter.Render.stop(render);
      Matter.Runner.stop(runner);
      const canvases = overlay.getElementsByTagName("canvas");
      if (canvases.length) overlay.removeChild(canvases[0]);
      Matter.Composite.clear(engine.world, false);
      overlay.classList.add("u-hidden");
      overlayMsg.classList.add("u-hidden");
    } catch(e) {
      // no-op
    } finally {
      physicsCleanup = null;
      finaleRunning = false;
      isAnimating = false;
      if (typeof afterClose === "function") afterClose();
    }
  };

  // Click to dismiss (no auto-timeout)
  const onClick = () => {
    if (physicsCleanup) physicsCleanup();
    overlay.removeEventListener("click", onClick);
  };
  overlay.addEventListener("click", onClick);
}

function physicsFinaleThenResetOnClick(){
  if (finaleRunning) return;
  launchPhysicsFinale({
    afterClose: () => {
      picked = [];
      currentNameE.textContent = "Ready?";
    }
  });
}

/* ---------- Init ---------- */
renderList();

/* Expose for inline handlers in HTML */
window.pickName = pickName;
