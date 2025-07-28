let names = JSON.parse(localStorage.getItem("names")) || [];
let picked = [];

const nameListEl = document.getElementById("nameList");
const nameInput = document.getElementById("nameInput");
const currentNameEl = document.getElementById("currentName");

function saveNames() {
  localStorage.setItem("names", JSON.stringify(names));
}

function addName() {
  const name = nameInput.value.trim();
  if (name) {
    names.push({ name, hidden: false });
    nameInput.value = "";
    saveNames();
    renderList();
  }
}

function toggleHide(index) {
  names[index].hidden = !names[index].hidden;
  saveNames();
  renderList();
}

function renderList() {
  nameListEl.innerHTML = "";
  names.forEach((entry, i) => {
    const li = document.createElement("li");
    li.className = entry.hidden ? "hidden" : "";

    const span = document.createElement("span");
    span.textContent = entry.name;

    const toggleBtn = document.createElement("button");
    toggleBtn.textContent = entry.hidden ? "👁️" : "🙈";
    toggleBtn.onclick = () => toggleHide(i);

    li.appendChild(span);
    li.appendChild(toggleBtn);
    nameListEl.appendChild(li);
  });
}

function pickName() {
  const pool = names.filter(n => !n.hidden && !picked.includes(n.name));
  if (pool.length === 0) {
    alert("All names have been picked! Reset to start over.");
    return;
  }

  let i = 0;
  const maxJumps = Math.floor(Math.random() * 10) + 10;
  const interval = setInterval(() => {
    const nextName = pool[Math.floor(Math.random() * pool.length)].name;
    currentNameEl.textContent = nextName;
    i++;
    if (i > maxJumps) {
      clearInterval(interval);
      picked.push(currentNameEl.textContent);
    }
  }, 100);
}

function resetRound() {
  picked = [];
  currentNameEl.textContent = "";
  alert("Round reset! All names are back in the pool.");
}

renderList();
