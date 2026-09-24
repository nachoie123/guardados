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
    <div class="cover">${coverHTML(p)}${r.audio ? `<span class="badge">${AUDIO_ICO}Lo dice en el vídeo</span>` : ""}</div>
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
    }
    if (coverURL.get(id)) img.src = coverURL.get(id);
  }
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

// el marcador es bookmarklet.js sin sus lineas de comentario, en una sola URL
let bookmarklet = "";
fetch("bookmarklet.js").then(r => r.text()).then(src => {
  const code = src.split("\n").filter(l => !l.trim().startsWith("//")).join("\n");
  bookmarklet = "javascript:" + encodeURIComponent(code);
  $("drag-bm").href = bookmarklet;
});
$("drag-bm").addEventListener("click", e => { e.preventDefault(); impStatus.textContent = "Arrástralo a la barra de marcadores; se usa en instagram.com."; });
$("copy-bm").addEventListener("click", async () => {
  try { await navigator.clipboard.writeText(bookmarklet); impStatus.textContent = "Copiado. Ahora pégalo como dirección del marcador."; }
  catch { prompt("Copia esto:", bookmarklet); }
});

const fmt = n => n.toLocaleString("es-ES");
$("file").addEventListener("change", async e => {
  const f = e.target.files[0];
  e.target.value = "";
  if (!f) return;
  let parsed;
  try { parsed = store.parseFile(JSON.parse(await f.text())); } catch { parsed = null; }
  if (!parsed?.items.length) { impStatus.textContent = "Ese fichero no parece de guardados. Usa el que baja el marcador (guardados-fecha.json)."; return; }
  const old = parsed.pulledAt && Date.now() - parsed.pulledAt > 4 * 864e5;
  try {
    const r = await store.importItems(parsed, rules, (fase, n, t) => {
      impStatus.textContent = fase === "posts" ? `Ordenando ${fmt(t)} guardados…` : `Bajando portadas… ${fmt(n)} de ${fmt(t)}`;
    });
    impStatus.textContent = `Listo: ${fmt(r.total)} guardados (${fmt(r.isNew)} nuevos), ${fmt(r.covers)} portadas nuevas.` +
      (r.missing ? ` ${fmt(r.missing)} sin portada${old ? ": el fichero tiene más de 4 días, vuelve a pulsar el marcador" : ""}.` : "") +
      (parsed.kind === "oficial" ? " La descarga oficial no trae el texto de los posts: con el marcador buscarás mucho mejor." : "");
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

async function main() {
  rules = makeRules(await (await fetch("rules-data.json")).json());
  const params = new URLSearchParams(location.search);
  q.value = params.get("q") || "";
  cat = params.get("cat");
  await load();
  if (location.hash.length > 1) openPost(location.hash.slice(1), false);
}
main().catch(() => { status.textContent = "No he podido cargar la app. Ábrela una vez con conexión."; });

if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js");
