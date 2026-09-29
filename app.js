import { buildIndex, search, norm } from "./search.js";
import { makeRules } from "./rules.js";
import * as store from "./store.js";

const CATS = {
  tecnologia: ["Tecnología", "#1D4ED8", "#0F172A"],
  finanzas: ["Finanzas", "#047857", "#022C22"],
  sitios: ["Sitios", "#EA580C", "#3B1106"],
  carrera: ["Carrera y estudios", "#6D28D9", "#1E1B4B"],
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
  moda: ["Moda y cuidado", "#DB2777", "#1F0512"],
  animales: ["Animales", "#92400E", "#1C0F05"],
  planes: ["Planes y restaurantes", "#EA580C", "#3B1106"],
  ciencia: ["Ciencia y curiosidades", "#0891B2", "#082F49"],
  estudios: ["Estudios", "#2563EB", "#172554"],
  coches: ["Coches y motor", "#475569", "#0F172A"],
  hogar: ["Hogar y DIY", "#65A30D", "#1A2E05"],
  motivacion: ["Motivación", "#CA8A04", "#2A1B02"],
  ideas: ["Ideas", "#F59E0B", "#7C2D12"],
  otros: ["Otros", "#57534E", "#1C1917"],
  // carpetas por red social (search.js: cat "src:...")
  "src:instagram": ["Instagram", "#C13584", "#405DE6"],
  "src:tiktok": ["TikTok", "#0F0F0F", "#0E7490"],
};
// subcarpetas (carpetas.py en el Mac): "sitios/restaurantes" -> "Restaurantes"
const SUBS = {
  restaurantes: "Restaurantes", bares: "Bares y copas", cafes: "Cafés y dulces", hoteles: "Hoteles",
  museos: "Museos y cultura", planes: "Planes y ocio", naturaleza: "Naturaleza y escapadas", tiendas: "Tiendas",
  destinos: "Destinos", trucos: "Trucos", platos: "Platos", postres: "Postres", saludables: "Saludables",
  rapidas: "Rápidas", bebidas: "Bebidas", recomendaciones: "Recomendaciones", escenas: "Escenas",
  terror: "Terror", explicaciones: "Explicaciones", ia: "IA y herramientas", programacion: "Programación",
  automatizaciones: "Automatizaciones", prompts: "Prompts", webs: "Webs y apps útiles", gadgets: "Gadgets",
  inversion: "Inversión", trading: "Trading", dinero: "Dinero y ahorro", quant: "Quant",
  practicas: "Prácticas y CV", estudio: "Técnicas de estudio", universidad: "Universidad",
  outfits: "Outfits", cuidado: "Cuidado personal", entreno: "Entreno", salud: "Salud",
};
const subLabel = r => SUBS[r.split("/")[1]] || r.split("/")[1];
let sub = null;  // subcarpeta elegida dentro de la carpeta actual
const SRC = ["src:instagram", "src:tiktok"];
const srcOf = p => "src:" + (p.src || "instagram");
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
    <div class="cover">${coverHTML(p)}${p.st ? `<span class="st ${p.st}">${p.st === "hecha" ? "✓ Hecha" : "En marcha"}</span>` : ""}${p.src === "tiktok" ? '<span class="src">TikTok</span>' : ""}${r.audio ? `<span class="badge">${AUDIO_ICO}Lo dice en el vídeo</span>` : ""}</div>
    ${cat === "ideas" && p.que ? `<h3 class="que">💡 ${esc(p.que)}</h3>` : `<h3>${esc(p.t)}</h3>`}
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
  const nsrc = {};
  for (const p of ix.posts) nsrc[srcOf(p)] = (nsrc[srcOf(p)] || 0) + 1;
  const srcChips = Object.keys(nsrc).length > 1 ? SRC.filter(c => nsrc[c]).map(c =>
    `<button class="chip" type="button" data-cat="${c}" aria-pressed="${cat === c}">${esc(label(c))} <span class="n">${nsrc[c]}</span></button>`) : [];
  chips.innerHTML = [`<button class="chip" type="button" data-cat="" aria-pressed="${!cat}">Todo <span class="n">${ix.posts.length}</span></button>`, ...srcChips]
    .concat(order.map(c => `<button class="chip${hint.includes(norm(c)) ? " hint" : ""}" type="button" data-cat="${c}" aria-pressed="${cat === c}">${esc(label(c))} <span class="n">${counts[c]}</span></button>`))
    .join("");
}

// --- filtros rapidos (y, dentro de Ideas, por estado) ---
const FLT = {
  largos: ["Largos (+1 min)", p => p.dur >= 60],
  voz: ["Con voz", p => (p.tr || "").length > 40],
  vistos: ["Más vistos", null],  // no filtra: ordena
  mes: ["Del último mes", p => p.d && Date.now() / 1000 - p.d < 31 * 86400],
};
const ST = { pend: ["Pendientes", p => !p.st], haciendo: ["Haciéndolas", p => p.st === "haciendo"], hecha: ["Hechas", p => p.st === "hecha"] };
const flt = new Set();
function renderSubs() {
  const n = {};
  if (cat) for (const p of ix.posts) if (p.cat.includes(cat)) for (const r of p.sub || []) if (r.startsWith(cat + "/")) n[r] = (n[r] || 0) + 1;
  const rs = Object.keys(n).sort((a, b) => n[b] - n[a]);
  if (sub && !n[sub]) sub = null;
  $("subs").hidden = !rs.length;
  $("subs").innerHTML = rs.length ? `<button type="button" data-sub="" aria-pressed="${!sub}">Todas</button>` + rs.map(r =>
    `<button type="button" data-sub="${r}" aria-pressed="${sub === r}">${esc(subLabel(r))} <small>${fmt(n[r])}</small></button>`).join("") : "";
}
$("subs").addEventListener("click", e => {
  const b = e.target.closest("[data-sub]");
  if (!b) return;
  sub = b.dataset.sub || null;
  run();
});
function renderFilters() {
  const all = { ...(cat === "ideas" ? ST : {}), ...FLT };
  for (const k of [...flt]) if (!all[k]) flt.delete(k);
  $("filters").innerHTML = Object.entries(all).map(([k, [name]]) =>
    `<button type="button" data-f="${k}" aria-pressed="${flt.has(k)}">${name}</button>`).join("");
}
$("filters").addEventListener("click", e => {
  const b = e.target.closest("[data-f]");
  if (!b) return;
  const k = b.dataset.f;
  if (flt.has(k)) flt.delete(k);
  else { if (ST[k]) for (const s of Object.keys(ST)) flt.delete(s); flt.add(k); }  // un solo estado a la vez
  run();
});

const miniCard = (p, sub) => `<button type="button" data-id="${p.id}"><div class="cover">${coverHTML(p)}</div><small>${esc(sub || p.t)}</small></button>`;
for (const row of ["answer-refs"]) $(row).addEventListener("click", e => { const b = e.target.closest("[data-id]"); if (b) openPost(b.dataset.id); });

function run() {
  const text = q.value.trim();
  $("clear").hidden = !text;
  renderSubs();
  renderFilters();
  const r = search(ix, text, { cat, limit: Infinity });  // todos: la rejilla carga de 40 en 40 al bajar
  results = r.results;
  if (sub) results = results.filter(x => x.p.sub?.includes(sub));
  for (const k of flt) { const f = (FLT[k] || ST[k])[1]; if (f) results = results.filter(x => f(x.p)); }
  if (flt.has("vistos")) results = [...results].sort((a, b) => (b.p.p || 0) - (a.p.p || 0));
  // el mismo clip guardado dos veces: sale solo el primero; el otro, en su ficha
  const visto = new Set();
  results = results.filter(({ p }) => { if (p.dup?.some(d => visto.has(d))) return false; visto.add(p.id); return true; });
  total = results.length; shown = 0;
  grid.innerHTML = "";
  if (!results.length) {
    grid.innerHTML = `<li class="empty">Nada por aquí. Prueba a decirlo de otra forma${cat || flt.size ? " o quita algún filtro" : ""}.</li>`;
  } else renderMore();
  $("folder").hidden = !cat;
  $("vista").hidden = cat !== "sitios";
  if (cat !== "sitios") vista = "lista";
  for (const b of $("vista").children) b.setAttribute("aria-pressed", b.dataset.v === vista);
  $("mapa").hidden = vista !== "mapa";
  grid.hidden = vista === "mapa";
  if (vista === "mapa") pintarMapa();
  $("folder-t").textContent = cat ? label(cat) + (sub ? ` · ${subLabel(sub)}` : "") : "";
  q.placeholder = cat ? "Buscar aquí…" : "¿Qué necesitas?";
  status.textContent = text
    ? `${total} ${total === 1 ? "resultado" : "resultados"}, los más útiles primero`
    : `${total} guardados, ${flt.has("vistos") ? "los más vistos" : "los más recientes"} primero`;
  renderChips(r.cats);
  const ask = text.length >= 3 && !!store.askKey();
  $("ask-btn").hidden = !ask;
  if (ask) $("ask-btn").textContent = `✨ Pregúntale a tus guardados: «${text}»`;
  const url = new URL(location);
  text ? url.searchParams.set("q", text) : url.searchParams.delete("q");
  cat ? url.searchParams.set("cat", cat) : url.searchParams.delete("cat");
  history.replaceState(history.state, "", url);
}

// --- preguntame: Gemini lee tus guardados mas relacionados y responde ---
// La clave de Gemini llega cifrada con la sincronizacion (sync-pack.py). Tope: 40 preguntas al dia.
$("answer-x").addEventListener("click", () => { $("answer").hidden = true; });
$("ask-btn").addEventListener("click", async () => {
  const text = q.value.trim();
  const box = $("answer"), txt = $("answer-txt"), refs = $("answer-refs");
  box.hidden = false; refs.innerHTML = ""; txt.textContent = "Leyendo tus guardados…";
  box.scrollIntoView({ behavior: "smooth", block: "start" });
  // contexto: lo que encuentra el buscador (dentro de la carpeta si estas en una) y, si hay poco, lo mas reciente
  let ctx = search(ix, text, { cat, limit: 60 }).results.map(r => r.p);
  if (ctx.length < 20) ctx = ctx.concat((cat ? search(ix, "", { cat, limit: 60 }).results.map(r => r.p) : ix.posts.slice(0, 60)).filter(p => !ctx.includes(p))).slice(0, 60);
  try {
    const out = await store.ask(text, ctx.map(p => ({ id: p.id, t: p.t, que: p.que, cat: p.cat.map(label).join(", "), u: p.u,
      d: p.d ? new Date(p.d * 1000).toISOString().slice(0, 7) : "", st: p.st, txt: ((p.c || "") + " " + (p.tr || "")).slice(0, 260) })));
    const byId = new Map(ix.posts.map(p => [p.id, p]));
    const cited = [...new Set([...out.matchAll(/\[([\w-]+)\]/g)].map(m => m[1]))].filter(id => byId.has(id));
    txt.innerHTML = out.replace(/\s*\[([\w-]+)\]/g, (m, id) => byId.has(id) ? ` <sup>${cited.indexOf(id) + 1}</sup>` : "")
      .split(/\n{2,}/).map(par => `<p>${esc(par).replace(/&lt;sup&gt;(\d+)&lt;\/sup&gt;/g, "<sup>$1</sup>")
        .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<i>$2</i>").replace(/\n/g, "<br>")}</p>`).join("");
    refs.innerHTML = cited.slice(0, 9).map((id, i) => miniCard(byId.get(id), `${i + 1}. ${byId.get(id).t}`)).join("");
    hydrate(refs);
  } catch (e) {
    txt.textContent = e?.message === "tope" ? "Hoy ya has preguntado 40 veces: mañana más."
      : /429|503/.test(e?.message) ? "Gemini está saturado ahora mismo (el cupo gratis va por minutos). Prueba en un minuto."
      : "No he podido preguntar (¿sin conexión?). Prueba otra vez.";
  }
});

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
  cat = b.dataset.cat || null; sub = null;
  run();
  scrollTo({ top: 0 });
});

// --- indice de carpetas (boton de arriba a la izquierda) y ajustes ---
const menu = $("menu"), aj = $("ajustes");
function folders() {
  const groups = new Map([["", ix.posts]]);
  for (const c of SRC) groups.set(c, ix.posts.filter(p => srcOf(p) === c));
  groups.set("ideas", ix.posts.filter(p => p.cat.includes("ideas")));
  const counts = {};
  for (const p of ix.posts) for (const c of p.cat) (counts[c] ||= []).push(p);
  Object.keys(counts).filter(c => c !== "ideas").sort((a, b) => (a === "otros") - (b === "otros") || counts[b].length - counts[a].length)
    .forEach(c => groups.set(c, counts[c]));
  const used = new Set();  // cada carpeta con su propia portada: la mas reciente que no se haya usado ya
  const recent = ps => { const p = ps.find(p => p.img && !used.has(p.id)) || ps[0]; used.add(p.id); return p; };
  $("folders").innerHTML = [...groups].filter(([, ps]) => ps.length).map(([c, ps]) => {
    const p = recent(ps);
    const ph = CATS[c] ? { ...p, img: false, cat: [c] } : p;  // sin portada: el color de la carpeta
    return `<li><button type="button" class="f-row" data-cat="${c}" aria-current="${(cat || "") === c}">
      <span class="f-ico">${coverHTML(p?.img ? p : ph)}</span><span class="f-name">${esc(c ? label(c) : "Todo")}</span><small>${fmt(ps.length)}</small></button></li>`;
  }).join("");
  hydrate($("folders"));
}
$("menu-btn").addEventListener("click", () => { folders(); $("settings-hint").textContent = store.syncKey() ? "✓ Mac" : ""; menu.showModal(); });
menu.addEventListener("click", e => { if (e.target === menu) menu.close(); });  // tocar fuera = cerrar
$("folders").addEventListener("click", e => {
  const b = e.target.closest("button[data-cat]");
  if (!b) return;
  cat = b.dataset.cat || null; sub = null;
  q.value = "";
  menu.close(); run(); scrollTo({ top: 0 });
});
$("folder-back").addEventListener("click", () => { if (sub) sub = null; else cat = null; run(); scrollTo({ top: 0 }); });
function segCols() {
  const n = cols();
  for (const b of $("seg-cols").children) b.setAttribute("aria-pressed", +b.dataset.cols === n);
}
$("open-settings").addEventListener("click", () => { menu.close(); segCols(); aj.showModal(); });
$("aj-close").addEventListener("click", () => aj.close());
$("seg-cols").addEventListener("click", e => { const b = e.target.closest("[data-cols]"); if (b) { setCols(+b.dataset.cols); segCols(); } });
// desde ajustes se abren importar o vincular: que no se apilen dos hojas
document.addEventListener("click", e => { if (e.target.closest("[data-open-import],[data-open-mac]") && aj.open) aj.close(); }, true);

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
  const otros = (p.dup || []).map(d => ix.posts.find(x => x.id === d)).filter(Boolean);
  $("d-dup").hidden = !otros.length;
  $("d-dup").innerHTML = otros.length ? "También lo guardaste de " + otros.map(o =>
    `<button type="button" class="link" data-post="${o.id}">@${esc(o.u)}${o.src === "tiktok" ? " (TikTok)" : ""}</button>`).join(", ") : "";
  pintarLugares(p);
  const idea = p.cat.includes("ideas");
  $("d-idea").hidden = !idea;
  if (idea) {
    $("d-que").textContent = p.que || "Idea para construir";
    $("d-que").hidden = false;
    for (const b of $("d-st").children) b.setAttribute("aria-pressed", (p.st || "") === b.dataset.st);
    $("d-repo").hidden = !p.repo; if (p.repo) $("d-repo").href = p.repo;
    $("d-repo-set").textContent = p.repo ? "Cambiar el enlace" : "Añadir enlace al proyecto";
    $("d-idea").dataset.id = p.id;
  }
  if (push) history.pushState({ post: id }, "", `#${id}`);
  if (!sheet.open) sheet.showModal();
  sheet.scrollTop = 0;
}
// --- mapa de Sitios (Leaflet + OpenStreetMap; los sitios los saca el Mac con Apple Maps) ---
let vista = "lista", mapa = null, capa = null, yo = null;
const TIPO_ICO = { restaurantes: "🍽️", bares: "🍸", cafes: "☕", hoteles: "🏨", museos: "🏛️", planes: "🎟️", naturaleza: "🌿", tiendas: "🛍️" };
const dirDe = l => [l.a, l.a?.includes(l.ci) ? "" : l.ci].filter(Boolean).join(" · ");
const appleMaps = l => `https://maps.apple.com/?q=${encodeURIComponent(l.n)}&ll=${l.lat},${l.lng}`;
function pintarMapa(foco) {
  if (!window.L) return;
  if (!mapa) {
    mapa = L.map("mapa", { zoomControl: false, attributionControl: true }).setView([40.4168, -3.7038], 12);
    // teselas oficiales de OpenStreetMap (gratis, sin clave); en modo oscuro se invierten por CSS
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19, className: "teselas", attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(mapa);
    mapa.on("popupopen", e => hydrate(e.popup.getElement()));
  }
  setTimeout(() => mapa.invalidateSize(), 0);  // estaba oculto: que mida bien
  if (capa) capa.remove();
  capa = L.markerClusterGroup({ showCoverageOnHover: false, maxClusterRadius: 45 });
  const puntos = [];
  for (const { p } of results) for (const l of p.lug || []) {
    const m = L.marker([l.lat, l.lng], { icon: L.divIcon({ className: "pin", html: `<span><i>${TIPO_ICO[l.t] || "📍"}</i></span>`, iconSize: [34, 34], iconAnchor: [17, 34], popupAnchor: [0, -30] }) });
    m.bindPopup(`<div class="pop"><button type="button" data-id="${p.id}" class="pop-cover"><div class="cover">${coverHTML(p)}</div></button>
      <div><b>${esc(l.n)}</b>${l.aprox ? ' <small class="aprox">aprox.</small>' : ""}<br><small>${esc(dirDe(l))}</small>
      <p><button type="button" class="link" data-id="${p.id}">Ver vídeo</button> <a class="link" href="${appleMaps(l)}" target="_blank" rel="noopener">Apple Maps</a></p></div></div>`, { maxWidth: 260 });
    m._lug = l;
    capa.addLayer(m); puntos.push(m);
  }
  mapa.addLayer(capa);
  if (foco) {
    const m = puntos.find(m => m._lug.lat === foco.lat && m._lug.lng === foco.lng);
    if (m) capa.zoomToShowLayer(m, () => m.openPopup()); else mapa.setView([foco.lat, foco.lng], 17);
  } else if (puntos.length && !yo) {
    // al abrir: la ciudad con mas sitios (Madrid), no el mundo entero
    const n = {};
    for (const m of puntos) n[m._lug.ci] = (n[m._lug.ci] || 0) + 1;
    const top = Object.keys(n).sort((a, b) => n[b] - n[a])[0];
    const zona = puntos.filter(m => m._lug.ci === top);
    mapa.fitBounds(L.latLngBounds(zona.map(m => m.getLatLng())), { padding: [30, 30], maxZoom: 15 });
  }
}
$("vista").addEventListener("click", e => {
  const b = e.target.closest("[data-v]");
  if (!b || b.dataset.v === vista) return;
  vista = b.dataset.v; run();
});
$("mapa").addEventListener("click", e => { const b = e.target.closest("[data-id]"); if (b) openPost(b.dataset.id); });
$("cerca").addEventListener("click", () => {
  if (!navigator.geolocation) return;
  $("cerca").textContent = "Buscándote…";
  navigator.geolocation.getCurrentPosition(pos => {
    const ll = [pos.coords.latitude, pos.coords.longitude];
    if (yo) yo.setLatLng(ll); else yo = L.circleMarker(ll, { radius: 8, color: "#fff", weight: 3, fillColor: "#0A84FF", fillOpacity: 1 }).addTo(mapa);
    mapa.setView(ll, 15);
    $("cerca").textContent = "📍 Cerca de mí";
  }, () => { $("cerca").textContent = "Sin permiso de ubicación"; }, { enableHighAccuracy: true, timeout: 10000 });
});
function verEnMapa(l) {
  closeSheet();
  cat = "sitios"; sub = null; q.value = ""; vista = "mapa";
  run(); scrollTo({ top: 0 });
  pintarMapa(l);
}

// ficha: la lista de sitios del video (borrar, anadir, volver a investigar)
function pintarLugares(p) {
  const ls = p.lug || [];
  $("d-lug").hidden = !ls.length && !p.cat.includes("sitios");
  $("d-lug").dataset.id = p.id;
  $("d-lug-msg").hidden = true;
  $("d-lug-list").innerHTML = ls.map((l, i) => `<li><span class="ico">${TIPO_ICO[l.t] || "📍"}</span>
    <button type="button" class="l-main" data-ver="${i}"><b>${esc(l.n)}</b>${l.aprox ? ' <small class="aprox">aprox.</small>' : ""}<small>${esc(dirDe(l))}</small></button>
    <a class="l-apple" href="${appleMaps(l)}" target="_blank" rel="noopener" aria-label="Abrir en Apple Maps">Ir</a>
    <button type="button" class="l-x" data-borrar="${i}" aria-label="Borrar ${esc(l.n)}">×</button></li>`).join("")
    || `<li class="vacio">Aún no hay sitios en este vídeo.</li>`;
}
async function guardarLugares(p, lug, msg) {
  p.lug = lug; p.lugMio = true;
  await store.setLugares(p.id, lug).catch(() => {});
  pintarLugares(p);
  if (msg) { $("d-lug-msg").textContent = msg; $("d-lug-msg").hidden = false; }
}
const postDeFicha = () => ix.posts.find(x => x.id === $("d-lug").dataset.id);
$("d-lug-list").addEventListener("click", e => {
  const p = postDeFicha(); if (!p) return;
  const x = e.target.closest("[data-borrar]"), v = e.target.closest("[data-ver]");
  if (x) guardarLugares(p, p.lug.filter((_, i) => i !== +x.dataset.borrar));
  else if (v) verEnMapa(p.lug[+v.dataset.ver]);
});
$("d-lug-add").addEventListener("submit", async e => {
  e.preventDefault();
  const p = postDeFicha(), inp = e.target.q, txt = inp.value.trim();
  if (!p || !txt) return;
  $("d-lug-msg").textContent = "Buscando…"; $("d-lug-msg").hidden = false;
  // "Casa Pepe" a secas: se busca en la ciudad del video
  const ci = p.ciudad || p.lug?.[0]?.ci || "";
  const tipo = (p.sub || []).find(r => r.startsWith("sitios/"))?.slice(7) || "planes";  // el del video: 🍽️ si es de restaurantes
  const h = await store.buscarSitio(ci && !norm(txt).includes(norm(ci)) ? `${txt}, ${ci}` : txt, tipo).catch(() => null)
    || (ci ? await store.buscarSitio(txt, tipo).catch(() => null) : null);
  if (!h) { $("d-lug-msg").textContent = `No encuentro «${txt}». Prueba con la calle o la ciudad.`; return; }
  inp.value = "";
  await guardarLugares(p, [...(p.lug || []), { ...h, n: txt.split(",")[0] }], `Añadido: ${h.n}${h.a ? ", " + h.a : ""}.`);
});
$("d-lug-inv").addEventListener("click", async () => {
  const p = postDeFicha(); if (!p) return;
  $("d-lug-msg").textContent = "Investigando el vídeo…"; $("d-lug-msg").hidden = false;
  try {
    const ls = await store.investigarSitios(p);
    if (!ls.length) { $("d-lug-msg").textContent = "No he encontrado ningún sitio con nombre en este vídeo."; return; }
    await guardarLugares(p, ls, `Encontrados ${ls.length}: ${ls.map(l => l.n).join(", ")}.`);
  } catch { $("d-lug-msg").textContent = "No he podido investigarlo ahora. Inténtalo en un rato."; }
});

// estado de la idea: se guarda en el movil y se ve en la tarjeta
async function saveEstado(st, repo) {
  const id = $("d-idea").dataset.id, p = ix.posts.find(x => x.id === id);
  if (!p) return;
  if (st != null) p.st = st;
  if (repo != null) p.repo = repo;
  await store.setEstado(id, p.st || "", p.repo || "");
  const y = sheet.scrollTop;
  openPost(id, false);
  sheet.scrollTop = y;  // que no salte arriba al cambiar el estado
  const card = grid.querySelector(`[data-id="${CSS.escape(id)}"] .cover`);
  if (card) { card.querySelector(".st")?.remove(); if (p.st) card.insertAdjacentHTML("beforeend", `<span class="st ${p.st}">${p.st === "hecha" ? "✓ Hecha" : "En marcha"}</span>`); }
}
$("d-st").addEventListener("click", e => { const b = e.target.closest("[data-st]"); if (b) saveEstado(b.dataset.st); });
$("d-repo-set").addEventListener("click", () => {
  const u = prompt("Enlace al proyecto (GitHub, web…):", ix.posts.find(x => x.id === $("d-idea").dataset.id)?.repo || "https://");
  if (u != null) saveEstado(null, /^https?:\/\/\S+\.\S+/.test(u.trim()) ? u.trim() : "");
});
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
  cat = b.dataset.cat; sub = null; closeSheet(); run(); scrollTo({ top: 0 });
});
$("d-dup").addEventListener("click", e => {
  const b = e.target.closest("[data-post]");
  if (b) openPost(b.dataset.post);
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
  macButton();
  $("f-import").textContent = mine ? "Actualizar con un fichero nuevo" : "Importar mis guardados";
  $("built").textContent = mine ? `${fmt(ix.posts.length)} guardados tuyos, en este dispositivo` : `Muestra de ${ix.posts.length} guardados`;
  $("foot").hidden = false;
  run();
}

// --- sincronizar con el Mac: al abrir la app, si esta vinculada ---
let syncing = null;
function sync(onProgress) {
  if (syncing) return syncing;
  if (!store.syncKey()) return Promise.resolve(null);
  syncing = (async () => {
    try {
      const r = await store.syncNow(rules, (fase, n, t) => {
        onProgress?.(fase, n, t);
        status.textContent = fase === "datos" ? "Trayendo lo nuevo del Mac…" : `Trayendo portadas del Mac… ${fmt(n)} de ${fmt(t)}`;
      });
      if (r) {
        await load();
        status.textContent = `Del Mac: ${fmt(r.posts)} guardados nuevos, ${fmt(r.covers)} portadas. ` + status.textContent;
      } else if (/^Trayendo/.test(status.textContent)) run();
      return r;
    } catch {
      run();  // sin red o sin paquetes: se queda lo que habia
      return { error: true };
    } finally { syncing = null; }
  })();
  return syncing;
}
document.addEventListener("visibilitychange", () => { if (!document.hidden) sync(); });

// --- vincular con el Mac: pantalla propia, con tic verde y barra de progreso ---
// La Camara del iPhone abre los enlaces en Safari, no en la app de la pantalla
// de inicio (que guarda sus datos aparte): por eso el QR se lee desde aqui.
const mac = $("mac");
let scanStream = null;
function stopScan() {
  scanStream?.getTracks().forEach(t => t.stop()); scanStream = null;
  $("scan").hidden = true;
}
function macView(v) {
  $("mac-start").hidden = v !== "start"; $("scan").hidden = v !== "scan"; $("mac-ok").hidden = v !== "ok";
}
function macButton() {
  $("f-mac").textContent = store.syncKey() ? "✓ Vinculado con el Mac · traer lo nuevo" : "Vincular con el Mac";
}
document.addEventListener("click", e => {
  if (!e.target.closest("[data-open-mac]")) return;
  if (store.syncKey()) { mac.showModal(); linked(); return; }  // ya vinculado: sincronizar ahora
  macView("start"); mac.showModal();
});
$("mac-close").addEventListener("click", () => mac.close());
mac.addEventListener("close", () => { stopScan(); macButton(); });
$("scan-stop").addEventListener("click", () => { stopScan(); macView("start"); });
$("mac-done").addEventListener("click", () => mac.close());

async function linked() {
  macView("ok");
  const ok = $("mac-ok"), bar = $("mac-bar").firstElementChild, msg = $("mac-msg");
  ok.classList.remove("err"); $("mac-done").hidden = true;
  $("mac-ok-t").textContent = "Vinculado con el Mac";
  bar.style.width = "4%"; msg.textContent = "Conectando con el Mac…";
  navigator.vibrate?.(40);
  const r = await sync((fase, n, t) => {
    bar.style.width = Math.max(4, Math.round(100 * n / Math.max(t, 1))) + "%";
    msg.textContent = fase === "datos" ? "Trayendo tus guardados…" : `Trayendo portadas… ${fmt(n)} de ${fmt(t)}`;
  });
  bar.style.width = "100%";
  if (r?.error) {
    ok.classList.add("err"); $("mac-ok-t").textContent = "QR leído, pero no llego al Mac";
    msg.textContent = "Sin conexión o la red bloquea la web. Prueba con datos móviles; se reintenta sola al abrir la app.";
  } else msg.textContent = r?.covers || r?.posts
    ? `Listo: ${fmt(r.posts)} guardados nuevos y ${fmt(r.covers)} portadas.` : "Todo al día: no faltaba nada.";
  $("mac-done").hidden = false;
  macButton();
}
function gotKey(s) {
  if (!store.setSyncKey(s)) return false;
  stopScan(); linked(); return true;
}
$("link-mac").addEventListener("click", () => {
  const s = prompt("Pega el enlace del QR de tu Mac (o solo la clave):");
  if (s != null && !gotKey(s)) alert("Eso no parece el enlace del QR. Cópialo entero.");
});
$("scan-mac").addEventListener("click", async () => {
  if (!window.jsQR) await new Promise((res, rej) => { const sc = document.createElement("script"); sc.src = "vendor/jsQR.js"; sc.onload = res; sc.onerror = rej; document.head.append(sc); }).catch(() => {});
  try { scanStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false }); }
  catch { alert("No puedo usar la cámara. Dale permiso en Ajustes o usa «pegar el enlace»."); return; }
  const v = $("scan-v"), cv = document.createElement("canvas"), cx = cv.getContext("2d", { willReadFrequently: true });
  v.srcObject = scanStream; macView("scan"); await v.play().catch(() => {});
  let last = 0;
  const tick = t => {
    if (!scanStream) return;
    if (t - last > 150 && v.videoWidth && window.jsQR) {  // ~7 lecturas por segundo: sobra y no calienta
      last = t;
      const w = 400, h = Math.round(v.videoHeight * w / v.videoWidth);
      cv.width = w; cv.height = h; cx.drawImage(v, 0, 0, w, h);
      const code = jsQR(cx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: "dontInvert" });
      if (code?.data?.includes("#k=") && gotKey(code.data)) return;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});

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
