import { buildIndex, search, norm } from "./search.js";
import { makeRules } from "./rules.js";
import * as store from "./store.js";

const CATS = {
  tecnologia: ["Tecnología", "#1D4ED8", "#0F172A"],
  finanzas: ["Finanzas", "#047857", "#022C22"],
  carrera: ["Carrera", "#6D28D9", "#1E1B4B"],
  recetas: ["Recetas", "#C2410C", "#431407"],
  viajes: ["Viajes", "#0E7490", "#083344"],
  pelis_series: ["Pelis y series", "#B91C1C", "#1C1917"],
  fitness_salud: ["Fitness y salud", "#4D7C0F", "#1A2E05"],
  diseño: ["Diseño", "#BE185D", "#2E1065"],
  negocios: ["Negocios", "#A16207", "#292524"],
  humor: ["Humor", "#9333EA", "#3B0764"],
  anime: ["Anime", "#E11D48", "#4C0519"],
  videojuegos: ["Videojuegos", "#4338CA", "#0B0A2E"],
  musica: ["Música", "#C026D3", "#4A044E"],
  deportes: ["Deportes", "#15803D", "#052E16"],
  moda: ["Moda y belleza", "#DB2777", "#1F0512"],
  animales: ["Animales", "#92400E", "#1C0F05"],
  planes: ["Planes y restaurantes", "#EA580C", "#3B1106"],
  ciencia: ["Ciencia y curiosidades", "#0891B2", "#082F49"],
  estudios: ["Estudios", "#2563EB", "#172554"],
  coches: ["Coches y motor", "#475569", "#0F172A"],
  hogar: ["Hogar y DIY", "#65A30D", "#1A2E05"],
  motivacion: ["Motivación", "#CA8A04", "#2A1B02"],
  otros: ["Otros", "#57534E", "#1C1917"],
};
const label = c => (CATS[c] || [c])[0];
const PAGE = 40;

const $ = id => document.getElementById(id);
const q = $("q"), grid = $("grid"), status = $("status"), chips = $("chips"), sheet = $("sheet");
let ix, cat = null, results = [], shown = 0, total = 0;
let rules, mine = false;  // mine: guardados propios (IndexedDB); si no, la muestra de demo/

const AUDIO_ICO = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/></svg>';
const esc = s => s.replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]);

function coverHTML(p) {
  if (p.img && !mine) return `<img src="demo/covers/${p.id}.jpg" alt="" loading="lazy" decoding="async">`;
  if (p.img) return `<img data-cover="${p.id}" alt="" decoding="async">`;
  const [, c1, c2] = CATS[p.cat[0]] || CATS.otros;
  return `<div class="ph" style="--c1:${c1};--c2:${c2}">${esc(label(p.cat[0]))}</div>`;
}

function card(r) {
  const p = r.p;
  const li = document.createElement("li");
  li.innerHTML = `<button class="card" type="button" data-id="${p.id}">
    <div class="cover">${coverHTML(p)}${p.src === "tiktok" ? '<span class="src">TikTok</span>' : ""}${r.audio ? `<span class="badge">${AUDIO_ICO}Lo dice en el vídeo</span>` : ""}</div>
    <h3>${esc(p.t)}</h3>
    <p class="who">@${esc(p.u)}</p></button>`;
  return li;
}

function renderMore() {
  const frag = document.createDocumentFragment();
  for (const r of results.slice(shown, shown + PAGE)) frag.append(card(r));
  shown = Math.min(results.length, shown + PAGE);
  grid.append(frag);
  hydrate(grid);
}

// portadas propias: Blob en IndexedDB -> URL de objeto (una por post, se reutiliza)
const coverURL = new Map();
async function hydrate(root) {
  for (const img of root.querySelectorAll("img[data-cover]:not([src])")) {
    const id = img.dataset.cover;
    if (!coverURL.has(id)) {
      const b = await store.getCover(id).catch(() => null);
      coverURL.set(id, b ? URL.createObjectURL(b) : "");
      if (!b) broken.add(id);
    }
    if (coverURL.get(id)) {
      img.onerror = () => { broken.add(id); repairSoon(); };
      img.src = coverURL.get(id);
    }
  }
  repairSoon();
}
// portadas que no se pueden leer: se marcan y, si la app esta vinculada al Mac,
// se vuelven a bajar solas
const broken = new Set();
let repairT;
function repairSoon() {
  if (!broken.size) return;
  clearTimeout(repairT);
  repairT = setTimeout(async () => {
    const ids = [...broken]; broken.clear();
    await store.markNoCover(ids).catch(() => {});
    for (const id of ids) coverURL.delete(id);
    sync();
  }, 1500);
}

function renderChips(hint = []) {
  const counts = {};
  for (const p of ix.posts) for (const c of p.cat) counts[c] = (counts[c] || 0) + 1;
  // las que sugiere la pregunta van delante, para que se vean sin deslizar
  const sug = c => hint.includes(norm(c)) ? 0 : 1;
  const order = Object.keys(counts).sort((a, b) => sug(a) - sug(b) || (a === "otros") - (b === "otros") || counts[b] - counts[a]);
  chips.innerHTML = [`<button class="chip" type="button" data-cat="" aria-pressed="${!cat}">Todo <span class="n">${ix.posts.length}</span></button>`]
    .concat(order.map(c => `<button class="chip${hint.includes(norm(c)) ? " hint" : ""}" type="button" data-cat="${c}" aria-pressed="${cat === c}">${esc(label(c))} <span class="n">${counts[c]}</span></button>`))
    .join("");
}

function run() {
  const text = q.value.trim();
  $("clear").hidden = !text;
  const r = search(ix, text, { cat, limit: 400 });
  results = r.results; total = r.total; shown = 0;
  grid.innerHTML = "";
  if (!results.length) {
    grid.innerHTML = `<li class="empty">Nada por aquí. Prueba a decirlo de otra forma${cat ? " o quita el filtro de categoría" : ""}.</li>`;
  } else renderMore();
  const where = cat ? ` en ${label(cat)}` : "";
  status.textContent = text
    ? `${total} ${total === 1 ? "resultado" : "resultados"}${where}, los más útiles primero`
    : `${total} guardados${where}, los más recientes primero`;
  renderChips(r.cats);
  const url = new URL(location);
  text ? url.searchParams.set("q", text) : url.searchParams.delete("q");
  cat ? url.searchParams.set("cat", cat) : url.searchParams.delete("cat");
  history.replaceState(history.state, "", url);
}

// --- pellizcar: 2, 3 o 4 portadas por fila, como en la galeria de Fotos ---
// Abrir los dedos agranda (menos columnas); juntarlos, al reves. Se recuerda.
const COLS_KEY = "guardados.cols";
function setCols(n, keep = true) {
  n = Math.max(2, Math.min(4, n));
  if (+grid.dataset.cols === n) return;
  // que la tarjeta que tenias arriba siga arriba al cambiar el tamano
  const top = [...grid.children].find(li => li.getBoundingClientRect().bottom > 160);
  const y = top?.getBoundingClientRect().top;
  grid.dataset.cols = n;
  grid.style.setProperty("--cols", n);
  if (top) scrollBy(0, top.getBoundingClientRect().top - y);
  if (keep) try { localStorage.setItem(COLS_KEY, n); } catch {}
}
try { const n = +localStorage.getItem(COLS_KEY); if (n) setCols(n, false); } catch {}
const cols = () => +grid.dataset.cols || (innerWidth >= 900 ? 5 : innerWidth >= 600 ? 3 : 2);
let pinch = 1;  // escala desde el ultimo cambio de columnas
function onPinch(scale) {
  if (scale / pinch > 1.3) { setCols(Math.min(cols(), 4) - 1); pinch = scale; }
  else if (scale / pinch < 0.77) { setCols(Math.min(cols(), 3) + 1); pinch = scale; }
}
// Safari (iPhone y trackpad del Mac): gesture*. preventDefault = que no amplie la pagina entera
for (const ev of ["gesturestart", "gesturechange", "gestureend"]) {
  document.addEventListener(ev, e => {
    if (sheet.open || e.target.closest?.("dialog")) return;
    e.preventDefault();
    if (ev === "gesturestart") pinch = 1; else if (ev === "gesturechange") onPinch(e.scale);
  }, { passive: false });
}
// Chrome/Android: dos dedos a mano
let d0 = 0;
const dist = t => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
document.addEventListener("touchstart", e => { if (e.touches.length === 2 && !window.GestureEvent) { d0 = dist(e.touches); pinch = 1; } }, { passive: true });
document.addEventListener("touchmove", e => {
  if (e.touches.length !== 2 || !d0 || window.GestureEvent) return;
  e.preventDefault(); onPinch(dist(e.touches) / d0);
}, { passive: false });
document.addEventListener("touchend", () => { d0 = 0; });

let timer;
q.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(run, 120); });
$("form").addEventListener("submit", e => { e.preventDefault(); q.blur(); run(); });
$("clear").addEventListener("click", () => { q.value = ""; run(); q.focus(); });
chips.addEventListener("click", e => {
  const b = e.target.closest(".chip");
  if (!b) return;
  cat = b.dataset.cat || null;
  run();
  scrollTo({ top: 0 });
});

// cargar mas al acercarse al final
new IntersectionObserver(es => { if (es[0].isIntersecting && shown < results.length) renderMore(); },
  { rootMargin: "800px" }).observe($("more"));

// --- ficha ---
function openPost(id, push = true) {
  const p = ix.posts.find(x => x.id === id);
  if (!p) return;
  $("d-cover").innerHTML = `<div class="cover">${coverHTML(p)}</div>`;
  hydrate($("d-cover"));
  $("d-title").textContent = p.t;
  const d = p.d ? new Date(p.d * 1000).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" }) : "";
  $("d-meta").textContent = [`@${p.u}`, d].filter(Boolean).join(" · ");
  $("d-cats").innerHTML = p.cat.map(c => `<button class="chip" type="button" data-cat="${c}">${esc(label(c))}</button>`).join("");
  $("d-open").href = p.url;
  $("d-open").classList.toggle("tt", p.src === "tiktok");
  $("d-open-txt").textContent = p.src === "tiktok" ? "Abrir en TikTok" : "Abrir en Instagram";
  $("d-cap").textContent = p.c;
  if (push) history.pushState({ post: id }, "", `#${id}`);
  if (!sheet.open) sheet.showModal();
  sheet.scrollTop = 0;
}
grid.addEventListener("click", e => {
  const b = e.target.closest(".card");
  if (b) openPost(b.dataset.id);
});
const closeSheet = () => history.state?.post ? history.back() : sheet.close();
$("close").addEventListener("click", closeSheet);
sheet.addEventListener("cancel", e => { e.preventDefault(); closeSheet(); });
sheet.addEventListener("click", e => { if (e.target === sheet) closeSheet(); });
$("d-cats").addEventListener("click", e => {
  const b = e.target.closest(".chip");
  if (!b) return;
  cat = b.dataset.cat; closeSheet(); run(); scrollTo({ top: 0 });
});
window.addEventListener("popstate", () => {
  const id = location.hash.slice(1);
  if (id) openPost(id, false); else if (sheet.open) sheet.close();
});

// --- voz: reconocimiento de Safari si existe; si no, el micro del teclado ---
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const mic = $("mic");
mic.addEventListener("click", () => {
  if (!SR) {
    q.focus();
    status.textContent = "Pulsa el micro del teclado para dictar.";
    return;
  }
  const rec = new SR();
  rec.lang = "es-ES"; rec.interimResults = true; rec.continuous = false;
  mic.classList.add("on"); mic.setAttribute("aria-label", "Escuchando…");
  status.textContent = "Escuchando… di lo que necesitas";
  rec.onresult = e => {
    q.value = [...e.results].map(r => r[0].transcript).join(" ");
    run();
  };
  const stop = () => { mic.classList.remove("on"); mic.setAttribute("aria-label", "Dictar búsqueda"); };
  rec.onend = () => { stop(); run(); };
  rec.onerror = () => { stop(); q.focus(); status.textContent = "No te he oído. Pulsa el micro del teclado para dictar."; };
  rec.start();
});

// --- importar tus guardados ---
const imp = $("imp"), impStatus = $("imp-status");
document.addEventListener("click", e => {
  if (e.target.closest("[data-open-import]")) { impStatus.textContent = ""; imp.showModal(); }
});
$("imp-close").addEventListener("click", () => imp.close());
imp.addEventListener("click", e => { if (e.target === imp) imp.close(); });

// cada marcador es su .js sin las lineas de comentario, en una sola URL
const bookmarklets = {};
for (const [id, file, site] of [["bm", "bookmarklet.js", "instagram.com"], ["bm-tt", "bookmarklet-tiktok.js", "tiktok.com"]]) {
  fetch(file).then(r => r.text()).then(src => {
    const code = src.split("\n").filter(l => !l.trim().startsWith("//")).join("\n");
    bookmarklets[id] = "javascript:" + encodeURIComponent(code);
    $("drag-" + id).href = bookmarklets[id];
  });
  $("drag-" + id).addEventListener("click", e => { e.preventDefault(); impStatus.textContent = `Arrástralo a la barra de marcadores; se usa en ${site}.`; });
  $("copy-" + id).addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(bookmarklets[id]); impStatus.textContent = "Copiado. Ahora pégalo como dirección del marcador."; }
    catch { prompt("Copia esto:", bookmarklets[id]); }
  });
}

const fmt = n => n.toLocaleString("es-ES");
$("file").addEventListener("change", async e => {
  const f = e.target.files[0];
  e.target.value = "";
  if (!f) return;
  const notMine = () => { impStatus.textContent = "Ese fichero no parece de guardados. Usa el que baja el marcador (guardados-fecha.json)."; };
  impStatus.textContent = "Leyendo el fichero…";
  try {
    const { parsed, result: r } = await store.importFile(f, rules, (fase, n, t) => {
      impStatus.textContent = fase === "posts" ? `Ordenando ${fmt(t)} guardados…` : `Guardando portadas… ${fmt(n)} de ${fmt(t)}`;
    });
    if (!parsed) return notMine();
    const tt = parsed.src === "tiktok", days = tt ? 2 : 4;
    const old = parsed.pulledAt && Date.now() - parsed.pulledAt > days * 864e5;
    impStatus.textContent = `Listo: ${fmt(r.total)} guardados (${fmt(r.isNew)} nuevos), ${fmt(r.covers)} portadas nuevas.` +
      (r.missing ? ` ${fmt(r.missing)} sin portada${old ? `: el fichero tiene más de ${days} días, vuelve a pulsar el marcador` : ""}.` : "") +
      (parsed.kind === "oficial" ? ` La descarga oficial no trae el texto de los ${tt ? "vídeos" : "posts"}: con el marcador buscarás mucho mejor.` : "");
    await load();
  } catch (err) {
    impStatus.textContent = "No he podido guardarlos en este navegador" + (err?.name === "QuotaExceededError" ? ": no queda espacio." : ".");
  }
});

$("backup").addEventListener("click", async () => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(await store.exportBackup());
  a.download = `guardados-copia-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
});
$("wipe").addEventListener("click", async () => {
  if (!confirm("¿Borrar tus guardados de este dispositivo? Podrás volver a importarlos.")) return;
  await store.clearAll();
  coverURL.forEach(u => u && URL.revokeObjectURL(u)); coverURL.clear();
  await load();
});

// tus guardados si los has importado; si no, la muestra
async function load() {
  const posts = await store.loadPosts();
  mine = posts.length > 0;
  let data;
  if (mine) data = { posts };
  else data = await (await fetch("demo/posts.json")).json();
  // search.js quiere las palabras clave sin los espacios de borde que usa rules.py
  data.kw = Object.fromEntries(Object.entries(rules.kw).map(([c, ks]) => [c, ks.map(k => k.trim())]));
  ix = buildIndex(data);
  $("intro").hidden = mine;
  $("intro-n").textContent = ix.posts.length;
  $("mine-actions").hidden = !mine;
  $("f-import").textContent = mine ? "Actualizar con un fichero nuevo" : "Importar mis guardados";
  $("built").textContent = mine ? `${fmt(ix.posts.length)} guardados tuyos, en este dispositivo` : `Muestra de ${ix.posts.length} guardados`;
  $("foot").hidden = false;
  run();
}

// --- sincronizar con el Mac: al abrir la app, si esta vinculada ---
let syncing = false;
async function sync() {
  if (syncing || !store.syncKey() || !navigator.onLine) return;
  syncing = true;
  try {
    const r = await store.syncNow(rules, (fase, n, t) => {
      status.textContent = fase === "datos" ? "Trayendo lo nuevo del Mac…" : `Trayendo portadas del Mac… ${n + 1} de ${t}`;
    });
    if (r) {
      await load();
      status.textContent = `Del Mac: ${fmt(r.posts)} guardados nuevos, ${fmt(r.covers)} portadas. ` + status.textContent;
    } else if (/^Trayendo/.test(status.textContent)) run();
  } catch {
    run();  // sin red o sin paquetes: se queda lo que habia, sin ruido
  } finally { syncing = false; }
}
$("link-mac").addEventListener("click", () => {
  const s = prompt("Pega el enlace del QR de tu Mac (o solo la clave):");
  if (s == null) return;
  if (!store.setSyncKey(s)) { impStatus.textContent = "Eso no parece el enlace del QR. Ábrelo desde la cámara o cópialo entero."; return; }
  impStatus.textContent = "Vinculado. Trayendo tus guardados del Mac…";
  sync().then(() => { impStatus.textContent = "Vinculado con el Mac: cada vez que abras la app, se pone al día sola."; });
});
document.addEventListener("visibilitychange", () => { if (!document.hidden) sync(); });

async function main() {
  rules = makeRules(await (await fetch("rules-data.json")).json());
  const params = new URLSearchParams(location.search);
  q.value = params.get("q") || "";
  cat = params.get("cat");
  // enlace del QR (#k=clave): se guarda y se quita de la barra de direcciones
  if (location.hash.startsWith("#k=")) {
    store.setSyncKey(location.hash);
    history.replaceState(history.state, "", location.pathname + location.search);
  }
  await load();
  if (location.hash.length > 1) openPost(location.hash.slice(1), false);
  let checked = null;
  try { checked = localStorage.getItem("guardados.covers.v2"); } catch {}
  if (mine && !checked) {
    const n = await store.checkCovers((i, t) => { status.textContent = `Revisando portadas… ${fmt(i)} de ${fmt(t)}`; }).catch(() => -1);
    try { if (n >= 0) localStorage.setItem("guardados.covers.v2", "1"); } catch {}
    if (n > 0) await load();
    else run();
  }
  sync();
}
main().catch(() => { status.textContent = "No he podido cargar la app. Ábrela una vez con conexión."; });

if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js");
