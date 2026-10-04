import { buildIndex, search, norm } from "./search.js";
import { makeRules } from "./rules.js";
import * as store from "./store.js";
import { abierto } from "./horario.js";
import { BUZON_URL } from "./buzon-config.js";

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
  todo: ["Todos los vídeos", "#57534E", "#1C1917"],
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
  // 29/09/2026: subcarpetas para lo que pasaba de ~200 videos
  asiatico: "Asiático", italiano: "Italiano", hamburguesas: "Hamburguesas", espanola: "Española y tapas",
  comedia: "Comedia", accion: "Acción", drama: "Drama", scifi: "Ciencia ficción", animacion: "Animación", series: "Series",
  edits: "Edits", ia_noticias: "Noticias de IA", asistentes: "ChatGPT y Claude", apps: "Apps",
  memes: "Memes", sketches: "Sketches", clips: "Clips", juegos: "Juegos y simulaciones", bots: "Bots y agentes",
  visual: "Visual y efectos", negocio: "Negocio", hardware: "Hardware",
  // 04/10/2026 (export.py sitios_geo): Sitios partido por donde esta el sitio
  japon: "Japón", japoneses: "Japoneses", fuera: "Fuera de Madrid",
};
// la misma clave con otro nombre segun la carpeta (restaurantes en Sitios = "Otros restaurantes")
const SUBS_EN = { "sitios/restaurantes": "Otros restaurantes", "sitios/asiatico": "Otros asiáticos", "ideas/webs": "Webs y SaaS", "ideas/automatizaciones": "Automatizaciones" };
const ICO = {
  sitios: "📍", viajes: "✈️", recetas: "🍳", pelis_series: "🎬", anime: "🍥", tecnologia: "💻", ideas: "💡",
  finanzas: "📈", carrera: "🎓", videojuegos: "🎮", moda: "👕", fitness_salud: "💪", humor: "😂", musica: "🎵",
  ciencia: "🔬", negocios: "💼", coches: "🏎️", diseño: "🎨", deportes: "⚽", hogar: "🏠", motivacion: "🔥",
  animales: "🐾", otros: "📦", planes: "🎟️", estudios: "📚", todo: "🗂️", "src:instagram": "📸", "src:tiktok": "🎵",
  // subcarpetas
  restaurantes: "🍽️", bares: "🍸", cafes: "☕", hoteles: "🏨", museos: "🏛️", naturaleza: "🌿", tiendas: "🛍️",
  destinos: "🗺️", trucos: "💡", platos: "🍝", postres: "🍰", saludables: "🥗", rapidas: "⏱️", bebidas: "🍹",
  recomendaciones: "⭐", escenas: "🎞️", terror: "👻", explicaciones: "🧠", ia: "🤖", programacion: "⌨️",
  automatizaciones: "⚙️", prompts: "💬", webs: "🌐", gadgets: "🔌", inversion: "💰", trading: "📊", dinero: "🪙",
  quant: "🧮", practicas: "💼", estudio: "📝", universidad: "🏫", outfits: "👔", cuidado: "🧴", entreno: "🏋️", salud: "❤️",
  japon: "🗾", japoneses: "🍣", fuera: "✈️",
};
// una carpeta, como las colecciones de Instagram: portada cuadrada a sangre, nombre y numero debajo
function carpetaHTML(attr, nombre, n, colorDe, p) {
  const [, c1, c2] = CATS[colorDe] || CATS.otros;
  return `<li><button class="carpeta" type="button" ${attr}>
    <span class="c-portada" style="--c1:${c1};--c2:${c2}">${p ? coverHTML(p) : ""}</span>
    <span class="c-nom">${esc(nombre)}</span><span class="c-n">${fmt(n)} ${n === 1 ? "vídeo" : "vídeos"}</span></button></li>`;
}
const portadaDe = (ps, used) => { const p = ps.find(p => p.img && !p.dk && !used.has(p.id)) || ps.find(p => p.img && !p.dk) || ps.find(p => p.img) || ps[0]; if (p) used.add(p.id); return p; };
const subLabel = r => SUBS_EN[r] || SUBS[r.split("/")[1]] || r.split("/")[1];
let sub = null;  // subcarpeta elegida dentro de la carpeta actual
const SRC = ["src:instagram", "src:tiktok"];
const srcOf = p => "src:" + (p.src || "instagram");
const label = c => c?.startsWith("col:") ? c.slice(4) : (CATS[c] || [c])[0];
const PAGE = 40;

const $ = id => document.getElementById(id);
const q = $("q"), grid = $("grid"), status = $("status"), chips = $("chips"), sheet = $("sheet");
let ix, cat = null, results = [], shown = 0, total = 0;
let rules, mine = false;  // mine: guardados propios (IndexedDB); si no, la muestra de demo/

const AUDIO_ICO = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/></svg>';
const esc = s => s.replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]);

function coverHTML(p) {
  if (p.img && !mine) return `<img src="demo/covers/${p.id}.jpg" alt="" loading="lazy" decoding="async">`;
  // videos de Sitios: de portada, la foto del sitio (sin gente) en vez del fotograma con alguien hablando
  const sitio = mine && p.cat.includes("sitios") && p.lug?.find(l => l.f);
  if (sitio) return `<img data-cover="${sitio.f}" alt="" decoding="async">`;
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
  chips.innerHTML = [`<button class="chip" type="button" data-cat="todo" aria-pressed="${cat === "todo"}">Todo <span class="n">${ix.posts.length}</span></button>`, ...srcChips]
    .concat(order.map(c => `<button class="chip${hint.includes(norm(c)) ? " hint" : ""}" type="button" data-cat="${c}" aria-pressed="${cat === c}">${esc(label(c))} <span class="n">${counts[c]}</span></button>`))
    .join("");
}

// --- filtros rapidos (y, dentro de Ideas, por estado) ---
const FLT = {};  // los filtros rapidos (largos, voz, vistos, mes) los quito Nacho el 29/09/2026
const ST = { pend: ["Pendientes", p => !p.st], haciendo: ["Haciéndolas", p => p.st === "haciendo"], hecha: ["Hechas", p => p.st === "hecha"] };
const flt = new Set();
// sub: null = portadas de las subcarpetas; "*" = todos los videos de la carpeta; "sitios/bares" = una
function subsDe(c) {
  const n = new Map();
  if (c) for (const p of ix.posts) if (p.cat.includes(c)) for (const r of p.sub || []) if (r.startsWith(c + "/")) {
    if (!n.has(r)) n.set(r, []);
    n.get(r).push(p);
  }
  // los de Madrid primero, por tipo; Japon y Fuera de Madrid al final
  const lejos = r => r === "sitios/japon" || r === "sitios/fuera";
  return [...n].sort((a, b) => lejos(a[0]) - lejos(b[0]) || b[1].length - a[1].length);
}
function renderSubs(rs) {
  if (sub && sub !== "*" && !rs.some(([r]) => r === sub)) sub = null;
  $("subs").hidden = !rs.length || !sub;
  $("subs").innerHTML = rs.length && sub ? `<button type="button" data-sub="*" aria-pressed="${sub === "*"}">Todos</button>` + rs.map(([r, ps]) =>
    `<button type="button" data-sub="${r}" aria-pressed="${sub === r}">${esc(subLabel(r))} <small>${fmt(ps.length)}</small></button>`).join("") : "";
}
function pintarCarpetas(rs) {
  const todos = ix.posts.filter(p => p.cat.includes(cat));
  const used = new Set();
  grid.innerHTML = [["*", todos], ...rs].map(([r, ps]) => r === "*"
    ? carpetaHTML(`data-sub="*"`, "Todos los vídeos", ps.length, cat, portadaDe(ps, used))
    : carpetaHTML(`data-sub="${r}"`, subLabel(r), ps.length, cat, portadaDe(ps, used))).join("");
  hydrate(grid);
}
// inicio: una portada por carpeta (las mismas del menu), la mas grande primero
function pintarInicio() {
  const g = new Map([["todo", ix.posts]]);
  for (const c of SRC) g.set(c, ix.posts.filter(p => srcOf(p) === c));
  g.set("ideas", ix.posts.filter(p => p.cat.includes("ideas")));
  const n = {};
  for (const p of ix.posts) for (const c of p.cat) if (c !== "ideas") (n[c] ||= []).push(p);
  Object.keys(n).sort((a, b) => (a === "otros") - (b === "otros") || n[b].length - n[a].length).forEach(c => g.set(c, n[c]));
  // lo mismo y en el mismo orden que el menu (Nacho, 04/10/2026): Todos, Instagram, TikTok, Ideas y por tamano.
  // Sin las colecciones de Instagram ("Sitios con Nacho", "Comidas para Sofi"...): siguen mandando en que carpeta va cada video
  const used = new Set();
  grid.innerHTML = [...g].filter(([, ps]) => ps.length)
    .map(([c, ps]) => carpetaHTML(`data-carpeta="${c}"`, c === "todo" ? "Todos" : label(c), ps.length, c, portadaDe(ps, used))).join("");
  hydrate(grid);
}
grid.addEventListener("click", e => {
  const b = e.target.closest("[data-carpeta]");
  if (!b) return;
  e.stopPropagation();
  cat = b.dataset.carpeta; sub = null;
  run(); scrollTo({ top: 0 });
}, true);
for (const el of [$("subs"), grid]) el.addEventListener("click", e => {
  const b = e.target.closest("[data-sub]");
  if (!b) return;
  e.stopPropagation();
  sub = b.dataset.sub || null;
  run(); scrollTo({ top: 0 });
}, true);
function renderFilters() {
  const all = cat === "ideas" ? ST : {};
  for (const k of [...flt]) if (!all[k]) flt.delete(k);
  $("filters").hidden = !Object.keys(all).length;
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

// y: volver a esa altura despues de pintar (al sincronizar o al reabrir la app), en vez de saltar arriba
function run(y) {
  const text = q.value.trim();
  $("clear").hidden = !text;
  const rs = subsDe(cat);
  renderSubs(rs);
  renderFilters();
  const r = search(ix, text, { cat, limit: Infinity });  // todos: la rejilla carga de 40 en 40 al bajar
  results = r.results;
  if (sub && sub !== "*") results = results.filter(x => x.p.sub?.includes(sub));
  for (const k of flt) { const f = (FLT[k] || ST[k])[1]; if (f) results = results.filter(x => f(x.p)); }
  if (flt.has("vistos")) results = [...results].sort((a, b) => (b.p.p || 0) - (a.p.p || 0));
  // el mismo clip guardado dos veces: sale solo el primero; el otro, en su ficha
  const visto = new Set();
  results = results.filter(({ p }) => { if (p.dup?.some(d => visto.has(d))) return false; visto.add(p.id); return true; });
  total = results.length; shown = 0;
  grid.innerHTML = "";
  const inicio = !cat && !text;  // pantalla de inicio: portadas de todas las carpetas
  const enCarpetas = inicio || (rs.length && !sub && !text);  // al entrar en una carpeta: sus subcarpetas con portada
  grid.classList.toggle("carpetas", !!enCarpetas);
  if (inicio) pintarInicio();
  else if (enCarpetas) pintarCarpetas(rs);
  else if (!results.length) {
    grid.innerHTML = `<li class="empty">Nada por aquí. Prueba a decirlo de otra forma${cat || flt.size ? " o quita algún filtro" : ""}.</li>`;
  } else renderMore();
  $("folder").hidden = !cat;
  $("mapa-btn").hidden = cat !== "sitios";
  $("tab-inicio").setAttribute("aria-current", String(inicio));
  $("folder-t").textContent = cat ? (sub && sub !== "*" ? subLabel(sub) : label(cat)) : "";
  q.placeholder = cat ? "Buscar aquí…" : "¿Qué necesitas?";
  status.textContent = inicio ? `${fmt(ix.posts.length)} guardados`
    : enCarpetas ? `${rs.length} subcarpetas · ${fmt(total)} vídeos`
    : text ? `${total} ${total === 1 ? "resultado" : "resultados"}, los más útiles primero`
    : `${total} guardados, los más recientes primero`;
  renderChips(r.cats);
  // siempre a mano (Nacho): sin buscar nada abre una caja para escribir la pregunta
  const ask = !!store.askKey();
  $("ask-btn").hidden = !ask;
  if (ask) $("ask-btn").textContent = text.length >= 3 ? `✨ Pregúntale a tus guardados: «${text}»` : "✨ Pregúntale a tus guardados";
  const url = new URL(location);
  text ? url.searchParams.set("q", text) : url.searchParams.delete("q");
  cat ? url.searchParams.set("cat", cat) : url.searchParams.delete("cat");
  history.replaceState(history.state, "", url);
  if (typeof y === "number" && y > 0) {
    while (shown < results.length && document.documentElement.scrollHeight < y + innerHeight) renderMore();
    scrollTo(0, y);
  }
  guardarEstado();
}

// --- la app vuelve donde la dejaste (Nacho, 04/10/2026: "me salgo y al volver se resetea") ---
// iOS cierra la app de la pantalla de inicio cuando esta en segundo plano y la abre de cero:
// la carpeta, la subcarpeta, la busqueda, la altura y el video de Deslizar se apuntan aqui.
const ESTADO_KEY = "guardados.estado";
function guardarEstado() {
  try {
    localStorage.setItem(ESTADO_KEY, JSON.stringify({ cat, sub, q: q.value.trim(), y: Math.round(scrollY),
      feed: $("feed").open ? feedI : null }));
  } catch {}
}
function leerEstado() {
  try { return JSON.parse(localStorage.getItem(ESTADO_KEY)) || {}; } catch { return {}; }
}
let guardarT;
addEventListener("scroll", () => { clearTimeout(guardarT); guardarT = setTimeout(guardarEstado, 250); }, { passive: true });
addEventListener("pagehide", guardarEstado);
document.addEventListener("visibilitychange", () => { if (document.hidden) guardarEstado(); });

// --- preguntame: Gemini lee tus guardados mas relacionados y responde ---
// La clave de Gemini llega cifrada con la sincronizacion (sync-pack.py). Tope: 40 preguntas al dia.
$("answer-x").addEventListener("click", () => { $("answer").hidden = true; });
$("ask-btn").addEventListener("click", () => {
  const text = q.value.trim();
  if (text.length >= 3) return preguntar(text);
  $("ask-form").hidden = false;
  $("ask-q").focus();
});
$("ask-form").addEventListener("submit", e => {
  e.preventDefault();
  const text = $("ask-q").value.trim();
  if (text.length < 3) return;
  $("ask-q").blur();
  preguntar(text);
});
async function preguntar(text) {
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
}

// --- pellizcar: 2, 3 o 4 portadas por fila, como en la galeria de Fotos ---
// Abrir los dedos agranda (menos columnas); juntarlos, al reves. Se recuerda.
const COLS_KEY = "guardados.cols", CCOLS_KEY = "guardados.cols.carpetas";
// las carpetas tienen su propio zoom (2, 3 o 4 por fila), aparte del de los videos
function setCCols(n, keep = true) {
  n = Math.max(2, Math.min(4, n));
  grid.dataset.ccols = n;
  if (keep) try { localStorage.setItem(CCOLS_KEY, n); } catch {}
}
try { setCCols(+localStorage.getItem(CCOLS_KEY) || 2, false); } catch { setCCols(2, false); }
function setCols(n, keep = true) {
  if (grid.classList.contains("carpetas")) return setCCols(n, keep);
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
const cols = () => grid.classList.contains("carpetas") ? +grid.dataset.ccols || 2
  : +grid.dataset.cols || (innerWidth >= 900 ? 5 : innerWidth >= 600 ? 3 : 2);
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
$("menu-btn").addEventListener("click", () => { folders(); $("settings-hint").textContent = linkedAny() ? "✓ Mac" : ""; menu.showModal(); });
menu.addEventListener("click", e => { if (e.target === menu) menu.close(); });  // tocar fuera = cerrar
$("folders").addEventListener("click", e => {
  const b = e.target.closest("button[data-cat]");
  if (!b) return;
  cat = b.dataset.cat || null; sub = null;
  q.value = "";
  menu.close(); run(); scrollTo({ top: 0 });
});
$("folder-back").addEventListener("click", () => { if (sub && subsDe(cat).length) sub = null; else { cat = null; sub = null; } run(); scrollTo({ top: 0 }); });
function segCols() {
  const n = cols();
  for (const b of $("seg-cols").children) b.setAttribute("aria-pressed", +b.dataset.cols === n);
}
$("open-settings").addEventListener("click", () => { menu.close(); segCols(); aj.showModal(); });
$("aj-close").addEventListener("click", () => aj.close());
$("seg-cols").addEventListener("click", e => { const b = e.target.closest("[data-cols]"); if (b) { setCols(+b.dataset.cols); segCols(); } });
// desde ajustes se abren importar o vincular: que no se apilen dos hojas
document.addEventListener("click", e => { if (e.target.closest("[data-open-import],[data-open-mac]") && aj.open) aj.close(); }, true);

// barra de abajo: Carpetas (inicio) y Mapa (todos los sitios, directo)
$("tab-inicio").addEventListener("click", () => { cat = null; sub = null; q.value = ""; run(); scrollTo({ top: 0 }); });
$("tab-mapa").addEventListener("click", () => {
  if (cat !== "sitios") sub = null;  // desde fuera de Sitios: el mapa entero
  abrirMapa();
});

// al bajar, la cabecera se hace pequena (buscador y botones mas bajos, sin la fila de carpetas)
let compacta = false;
addEventListener("scroll", () => {
  const c = scrollY > 60 ? true : scrollY < 20 ? false : compacta;
  if (c !== compacta) { compacta = c; document.querySelector(".top").classList.toggle("compact", c); }
}, { passive: true });

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
// --- mapa de Sitios: MapLibre + OpenFreeMap (vectorial, gratis y sin clave), a pantalla completa ---
let mapa = null, mapaListo = null, yo = null, mapaCargado = null;
const mapaDlg = $("mapa-dlg");
const TIPO = {
  restaurantes: ["Restaurante", "#F97316", "🍽️"], bares: ["Bar", "#A855F7", "🍸"], cafes: ["Café", "#B45309", "☕"],
  hoteles: ["Hotel", "#3B82F6", "🏨"], museos: ["Museo", "#14B8A6", "🏛️"], planes: ["Plan", "#EC4899", "🎟️"],
  naturaleza: ["Naturaleza", "#22C55E", "🌿"], tiendas: ["Tienda", "#EAB308", "🛍️"],
};
const TIPO_ICO = Object.fromEntries(Object.entries(TIPO).map(([k, v]) => [k, v[2]]));
const dirDe = l => [l.a, l.a?.includes(l.ci) ? "" : l.ci].filter(Boolean).join(" · ");
const appleMaps = l => `https://maps.apple.com/?q=${encodeURIComponent(l.n)}&ll=${l.lat},${l.lng}`;
const oscuro = () => matchMedia("(prefers-color-scheme: dark)").matches;
function cargarMapLibre() {
  return mapaCargado ||= new Promise((ok, mal) => {
    const s = document.createElement("script");
    s.src = "vendor/maplibre-gl.js"; s.onload = ok; s.onerror = mal;
    document.head.append(s);
  });
}
// los sitios que tocan: los de la carpeta Sitios (o de la subcarpeta en la que estes)
let tipoMapa = null;  // null = todos; si no, la clave de TIPO
let soloAbiertos = false;  // "Abierto ahora": solo los que tienen horario y estan abiertos
function sitiosGeo(ignorarTipo) {
  const vistos = new Map();
  for (const p of ix.posts) {
    if (!p.cat.includes("sitios") || !p.lug?.length) continue;
    if (sub && sub !== "*" && cat === "sitios" && !p.sub?.includes(sub)) continue;
    p.lug.forEach((l, i) => {
      if (!ignorarTipo && tipoMapa && l.t !== tipoMapa) return;
      if (soloAbiertos && abierto(l.h) !== true) return;
      // el mismo sitio en dos videos: una chincheta, la del video que tenga foto del sitio
      const k = `${norm(l.n)}|${l.lat.toFixed(3)}|${l.lng.toFixed(3)}`;
      if (vistos.has(k) && (vistos.get(k).f || !l.f)) return;
      vistos.set(k, { f: !!l.f, feat: { type: "Feature", geometry: { type: "Point", coordinates: [l.lng, l.lat] },
        properties: { id: p.id, i, n: l.n, t: l.t, color: (TIPO[l.t] || TIPO.planes)[1] } } });
    });
  }
  return { type: "FeatureCollection", features: [...vistos.values()].map(v => v.feat) };
}
// chips de tipo con su numero; tocar uno filtra el mapa y la lista, tocarlo otra vez quita el filtro
function pintarFiltros() {
  const n = {}, previo = tipoMapa;
  for (const k of Object.keys(TIPO)) {  // el numero de cada pastilla = lo que saldria al tocarla
    tipoMapa = k;
    const c = sitiosGeo().features.length;
    if (c) n[k] = c;
  }
  tipoMapa = previo;
  const claves = Object.keys(n).sort((a, b) => n[b] - n[a]);
  if (tipoMapa && !n[tipoMapa]) tipoMapa = null;
  // "Abierto ahora" solo sale si hay horarios de sobra: con pocos (OSM da ~3%) enganaria ("no sale = cerrado")
  const conHorario = ix.posts.reduce((s, p) => s + (p.lug?.filter(l => l.h).length || 0), 0);
  const previoA = soloAbiertos; soloAbiertos = true;
  const nAb = sitiosGeo().features.length;  // con el tipo elegido, cuantos estan abiertos
  soloAbiertos = previoA;
  $("mapa-filtros").innerHTML = (conHorario >= 150 && (nAb || soloAbiertos) ? `<button type="button" class="ab" data-abierto="1" aria-pressed="${soloAbiertos}"><span>🟢</span>Abierto ahora <small>${nAb}</small></button>` : "") + claves.map(k => `<button type="button" data-tipo="${k}" aria-pressed="${tipoMapa === k}"><span>${(TIPO[k] || TIPO.planes)[2]}</span>${(TIPO[k] || TIPO.planes)[0]} <small>${n[k]}</small></button>`).join("");
}
$("mapa-filtros").addEventListener("click", e => {
  const b = e.target.closest("[data-tipo], [data-abierto]"); if (!b) return;
  if (b.dataset.abierto) soloAbiertos = !soloAbiertos;
  else tipoMapa = tipoMapa === b.dataset.tipo ? null : b.dataset.tipo;
  pintarFiltros();
  const geo = geoActual = sitiosGeo();
  mapa.getSource("sitios").setData(geo);
  $("hoja-sub").textContent = `${fmt(geo.features.length)} sitios`;
  $("mapa-card").hidden = true; hoja.hidden = false;
  pintarLista();
});
async function abrirMapa(foco) {
  $("mapa-t").textContent = sub && sub !== "*" && cat === "sitios" ? subLabel(sub) : "Sitios";
  $("mapa-card").hidden = true;
  if (foco) tipoMapa = null, soloAbiertos = false;  // venir de un video: que se vea ese sitio
  pintarFiltros();
  estadoHoja("baja");
  if (!mapaDlg.open) { mapaDlg.showModal(); history.pushState({ mapa: 1 }, "", location.pathname + location.search); }
  await cargarMapLibre();
  if (!mapa) {
    mapa = new maplibregl.Map({ container: "mapa", style: "https://tiles.openfreemap.org/styles/liberty",  // claro y con color, como Google/Apple Maps (Nacho: el oscuro no se veia)
      center: [-3.7038, 40.4168], zoom: 11.5, attributionControl: { compact: true }, pitchWithRotate: false });
    mapaListo = new Promise(r => mapa.on("load", r)).then(() => {
      // sin edificios (Nacho: la sombra de los edificios molesta); solo calles, parques y agua
      for (const l of mapa.getStyle().layers) if (/building/.test(l.id)) mapa.setLayoutProperty(l.id, "visibility", "none");
      // circulos grandes por zona (barrio) que se separan al acercarte; desde zoom 15, cada sitio suelto
      mapa.addSource("sitios", { type: "geojson", data: { type: "FeatureCollection", features: [] },
        cluster: true, clusterRadius: 30, clusterMaxZoom: 14 });  // pequeno: el centro se reparte en varios
      mapa.addLayer({ id: "grupos", type: "circle", source: "sitios", filter: ["has", "point_count"], paint: {
        "circle-color": "#F97316", "circle-opacity": 0.92, "circle-stroke-color": "#fff", "circle-stroke-width": 3,
        "circle-radius": ["step", ["get", "point_count"], 15, 5, 18, 15, 21, 40, 24] } });
      mapa.addLayer({ id: "grupos-n", type: "symbol", source: "sitios", filter: ["has", "point_count"],
        layout: { "text-field": ["get", "point_count_abbreviated"], "text-font": ["Noto Sans Bold"], "text-size": 13, "text-allow-overlap": true },
        paint: { "text-color": "#fff" } });
      mapa.addLayer({ id: "puntos", type: "circle", source: "sitios", filter: ["!", ["has", "point_count"]], paint: {
        "circle-color": ["get", "color"], "circle-radius": 10, "circle-stroke-color": "#fff", "circle-stroke-width": 3 } });
      mapa.addLayer({ id: "nombres", type: "symbol", source: "sitios", filter: ["!", ["has", "point_count"]],
        layout: { "text-field": ["get", "n"], "text-font": ["Noto Sans Bold"], "text-size": 12.5, "text-offset": [0, 1.1],
          "text-anchor": "top", "text-max-width": 9, "text-optional": true },
        paint: { "text-color": "#1c1917", "text-halo-color": "#fff", "text-halo-width": 2 } });
      // tocar un circulo: acercarse a esa zona hasta que se separen
      mapa.on("click", "grupos", async e => {
        const f = e.features[0];
        const z = await mapa.getSource("sitios").getClusterExpansionZoom(f.properties.cluster_id);
        mapa.easeTo({ center: f.geometry.coordinates, zoom: z + 0.4 });
      });
      mapa.on("click", "puntos", e => tarjeta(e.features[0].properties));
      mapa.on("click", e => {
        if (mapa.queryRenderedFeatures(e.point, { layers: ["puntos", "grupos"] }).length) return;
        $("mapa-card").hidden = true; hoja.hidden = false;  // tocar el mapa: fuera la tarjeta, vuelve la lista
      });
      mapa.on("moveend", () => { if (hoja.dataset.estado === "alta" && !yo) pintarLista(); });
      for (const l of ["grupos", "puntos"]) {
        mapa.on("mouseenter", l, () => mapa.getCanvas().style.cursor = "pointer");
        mapa.on("mouseleave", l, () => mapa.getCanvas().style.cursor = "");
      }
    });
  }
  await mapaListo;
  mapa.resize();
  const geo = geoActual = sitiosGeo();
  mapa.getSource("sitios").setData(geo);
  hoja.hidden = !!foco;
  if (hoja.dataset.estado === "alta") pintarLista();  // la abrio mientras cargaba
  $("hoja-sub").textContent = `${fmt(geo.features.length)} sitios`;
  if (foco) {
    mapa.jumpTo({ center: [foco.lng, foco.lat], zoom: 16.5 });
    const f = geo.features.find(f => Math.abs(f.geometry.coordinates[0] - foco.lng) < 1e-3 && Math.abs(f.geometry.coordinates[1] - foco.lat) < 1e-3 && norm(f.properties.n) === norm(foco.n))
      || geo.features.find(f => f.geometry.coordinates[0] === foco.lng && f.geometry.coordinates[1] === foco.lat);
    if (f) tarjeta(f.properties);
  } else if (!yo && geo.features.length) {
    // al abrir: la zona con mas sitios (Madrid), no el mundo entero
    const zona = new Map();
    // celdas de ~5 km: abre en el centro de Madrid, no en toda la comunidad
    for (const f of geo.features) { const [x, y] = f.geometry.coordinates, k = `${Math.round(x * 20)}|${Math.round(y * 20)}`; zona.set(k, [...(zona.get(k) || []), f]); }
    const fs = [...zona.values()].sort((a, b) => b.length - a.length)[0];
    const b = new maplibregl.LngLatBounds();
    for (const f of fs) b.extend(f.geometry.coordinates);
    mapa.fitBounds(b, { padding: 60, maxZoom: 15, duration: 0 });
  }
}
function estadoHorario(l) {
  const ab = abierto(l.h);
  if (ab === null) return "";
  return `<small class="mc-hor ${ab ? "si" : "no"}">${ab ? "🟢 Abierto ahora" : "🔴 Cerrado ahora"} · ${esc(l.h.length > 60 ? l.h.slice(0, 58) + "…" : l.h)}</small>`;
}
function tarjeta({ id, i }) {
  const p = ix.posts.find(x => x.id === id), l = p?.lug?.[+i];
  if (!l) return;
  const [nombre, color, ico] = TIPO[l.t] || TIPO.planes;
  // foto del sitio (un fotograma sin gente que eligio Gemini); si no hay, el icono del tipo, nunca la portada
  const foto = l.f ? `<img data-cover="${l.f}" alt="">` : `<span class="mc-ico" style="--c:${color}">${ico}</span>`;
  $("mapa-card").innerHTML = `<div class="mc-foto">${foto}</div>
    <div class="mc-txt"><b>${esc(l.n)}</b><small>${nombre}${l.ci ? " · " + esc(l.ci) : ""}</small><small class="mc-dir">${esc(l.a || "")}</small>${estadoHorario(l)}
      <div class="mc-bot"><a class="mc-ir" href="${appleMaps(l)}" target="_blank" rel="noopener">Cómo llegar</a>
      <button type="button" class="mc-video" data-id="${p.id}">Ver vídeo</button></div></div>`;
  $("mapa-card").hidden = false;
  hoja.hidden = true;  // con la tarjeta de un sitio abierta, la lista se aparta
  hydrate($("mapa-card"));
}

// --- hoja deslizable con la lista de sitios, los mas cercanos primero (como Apple Maps) ---
const hoja = $("hoja");
let geoActual = null;
const km = (a, b) => {  // [lng, lat]
  const r = Math.PI / 180, dla = (b[1] - a[1]) * r, dlo = (b[0] - a[0]) * r;
  const h = Math.sin(dla / 2) ** 2 + Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.sin(dlo / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
};
const verKm = d => d < 1 ? `${Math.round(d * 100) * 10} m` : d < 10 ? `${d.toFixed(1).replace(".", ",")} km` : `${Math.round(d)} km`;
function pintarLista() {
  if (!mapa || !geoActual) return;
  const desde = yo ? yo.getLngLat().toArray() : mapa.getCenter().toArray();
  const base = soloGrupo || geoActual.features;
  const fs = base.map(f => ({ f, d: km(desde, f.geometry.coordinates) })).sort((a, b) => a.d - b.d).slice(0, 80);
  $("hoja-t").textContent = soloGrupo ? "En este punto" : yo ? "Cerca de ti" : "Cerca de aquí";
  $("hoja-sub").textContent = `${fmt(base.length)} sitios`;
  $("hoja-lista").innerHTML = fs.map(({ f, d }) => {
    const { id, i } = f.properties, p = ix.posts.find(x => x.id === id), l = p?.lug?.[+i];
    if (!l) return "";
    const [nombre, color, ico] = TIPO[l.t] || TIPO.planes;
    const foto = l.f ? `<img data-cover="${l.f}" alt="" loading="lazy">` : `<span class="mc-ico" style="--c:${color}">${ico}</span>`;
    return `<li><button type="button" data-lug="${id}|${i}"><span class="hl-foto">${foto}</span>
      <span class="hl-txt"><b>${esc(l.n)}</b><small><span class="hl-km">${verKm(d)}</span> · ${nombre}${l.a ? " · " + esc(l.a) : ""}</small></span></button></li>`;
  }).join("");
  hydrate($("hoja-lista"));
}
let soloGrupo = null;  // al tocar un grupo, la lista solo con sus sitios; al bajarla, vuelve a todos
function estadoHoja(e) {
  if (e === "baja") soloGrupo = null;
  hoja.hidden = false; $("mapa-card").hidden = true;
  hoja.dataset.estado = e;
  hoja.style.transform = "";
  if (e === "alta") { pintarLista(); $("hoja-lista").scrollTop = 0; }
}
$("hoja-lista").addEventListener("click", e => {
  const b = e.target.closest("[data-lug]");
  if (!b) return;
  const [id, i] = b.dataset.lug.split("|"), l = ix.posts.find(x => x.id === id)?.lug?.[+i];
  if (!l) return;
  estadoHoja("baja");
  mapa.flyTo({ center: [l.lng, l.lat], zoom: 16.5, duration: 900 });
  tarjeta({ id, i });
});
$("hoja-asa").addEventListener("click", () => { if (!movido) estadoHoja(hoja.dataset.estado === "alta" ? "baja" : "alta"); });
$("hoja-asa").addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); estadoHoja(hoja.dataset.estado === "alta" ? "baja" : "alta"); } });
// arrastrar: por el asa siempre; por la lista, solo hacia abajo y estando arriba del todo
let arrastre = null, movido = false;
function empezar(e, desdeLista) {
  if (desdeLista && ($("hoja-lista").scrollTop > 0 || hoja.dataset.estado !== "alta")) return;
  const alto = hoja.getBoundingClientRect().height, asa = 76;
  arrastre = { y0: e.clientY, t0: performance.now(), base: hoja.dataset.estado === "alta" ? 0 : alto - asa, max: alto - asa, lista: desdeLista };
  movido = false;
}
function mover(e) {
  if (!arrastre) return;
  const dy = e.clientY - arrastre.y0;
  if (arrastre.lista && dy < 0) { arrastre = null; return; }  // hacia arriba en la lista: que haga scroll
  if (Math.abs(dy) > 6) movido = true;
  if (!movido) return;
  e.preventDefault();
  hoja.classList.add("arrastrando");
  hoja.style.transform = `translateY(${Math.min(arrastre.max, Math.max(0, arrastre.base + dy))}px)`;
}
function soltar(e) {
  if (!arrastre) return;
  hoja.classList.remove("arrastrando");
  if (movido) {
    const dy = e.clientY - arrastre.y0, v = dy / Math.max(1, performance.now() - arrastre.t0);  // px/ms
    const pos = arrastre.base + dy;
    estadoHoja(v < -0.4 ? "alta" : v > 0.4 ? "baja" : pos < arrastre.max / 2 ? "alta" : "baja");
  }
  arrastre = null;
}
$("hoja-asa").addEventListener("pointerdown", e => empezar(e, false));
$("hoja-lista").addEventListener("pointerdown", e => empezar(e, true));
addEventListener("pointermove", mover, { passive: false });
addEventListener("pointerup", soltar);
addEventListener("pointercancel", soltar);
$("mapa-btn").addEventListener("click", () => abrirMapa());
$("mapa-card").addEventListener("click", e => { const b = e.target.closest("[data-id]"); if (b) openPost(b.dataset.id); });
$("mapa-volver").addEventListener("click", () => history.state?.mapa ? history.back() : mapaDlg.close());
mapaDlg.addEventListener("cancel", e => { e.preventDefault(); $("mapa-volver").click(); });
$("mapa-yo").addEventListener("click", () => {
  if (!navigator.geolocation || !mapa) return;
  $("mapa-yo").classList.add("buscando");
  navigator.geolocation.getCurrentPosition(pos => {
    const ll = [pos.coords.longitude, pos.coords.latitude];
    if (!yo) {
      const el = document.createElement("div"); el.className = "yo";
      yo = new maplibregl.Marker({ element: el }).setLngLat(ll).addTo(mapa);
    } else yo.setLngLat(ll);
    mapa.easeTo({ center: ll, zoom: 14.5 });
    $("mapa-yo").classList.remove("buscando");
    pintarLista();  // ya sabemos donde estas: la lista, por cercania a ti
  }, () => $("mapa-yo").classList.remove("buscando"), { enableHighAccuracy: true, timeout: 10000 });
});
function verEnMapa(l) {
  sheet.close();
  history.replaceState({ mapa: 1 }, "", location.pathname + location.search);
  mapaDlg.showModal();
  abrirMapa(l);
}

// --- Deslizar: los videos de donde estes (carpeta, subcarpeta o busqueda), uno por pantalla, como Reels ---
// Se reproduce solo el de la pantalla. Instagram: el Worker del buzon saca el MP4 de su reproductor
// publico (/video/ig/<code>); si Instagram no lo deja (musica con derechos, ~1 de cada 4) queda la
// portada y el boton abre el reel en Instagram. TikTok: su reproductor oficial (player/v1).
const feedDlg = $("feed"), feedBox = $("feed-scroll");
let feedLista = [], feedN = 0, feedI = 0;
const FEED_LOTE = 12;
const PLAY_ICO = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" class="fill"/></svg>';
const MAPA_ICO = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4 3 6.5v13.5l6-2.5 6 2.5 6-2.5V4l-6 2.5z"/><path d="M9 4v13.5M15 6.5V20"/></svg>';
const SON_ICO = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>';
const MUDO_ICO = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="m16 9.5 5 5M21 9.5l-5 5"/></svg>';
const INFO_ICO = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><circle cx="12" cy="7.8" r="1.1" class="fill"/></svg>';
function feedSlide(p, i) {
  const ls = p.lug || [], desde = yo?.getLngLat().toArray();
  const lugs = ls.slice(0, 3).map((l, j) => `<li><button type="button" data-ver="${j}"><span class="s-ico">${TIPO_ICO[l.t] || "📍"}</span>
      <span class="s-l"><b>${esc(l.n)}</b><small>${desde ? verKm(km(desde, [l.lng, l.lat])) + " · " : ""}${esc(dirDe(l))}</small></span></button>
      <a class="s-ir" href="${appleMaps(l)}" target="_blank" rel="noopener">Ir</a></li>`).join("")
    + (ls.length > 3 ? `<li class="s-mas">y ${ls.length - 3} ${ls.length - 3 === 1 ? "sitio" : "sitios"} más en la ficha</li>` : "");
  const tt = p.src === "tiktok";
  return `<section class="slide" data-i="${i}" data-id="${p.id}">
    <div class="s-fondo">${coverHTML(p)}</div>
    <div class="s-tap" aria-hidden="true"></div>
    <button type="button" class="s-play" data-play aria-label="Reproducir">${PLAY_ICO}</button>
    <p class="s-aviso">Instagram no deja ver este vídeo fuera de su app</p>
    <div class="s-info"><p class="s-who">@${esc(p.u)}</p><h2>${esc(p.t)}</h2>${lugs ? `<ul class="s-lug">${lugs}</ul>` : ""}</div>
    <div class="s-acc">
      <button type="button" class="s-btn" data-sonido aria-label="Sonido">${sonido ? SON_ICO : MUDO_ICO}<span>${sonido ? "Sonido" : "Silencio"}</span></button>
      <a class="s-btn" href="${p.url}" target="_blank" rel="noopener">${PLAY_ICO}<span>Ver</span></a>
      ${ls.length ? `<button type="button" class="s-btn" data-mapa>${MAPA_ICO}<span>Mapa</span></button>` : ""}
      <button type="button" class="s-btn" data-ficha>${INFO_ICO}<span>Ficha</span></button>
    </div></section>`;
}
function feedMas(hasta = 0) {
  if (feedN >= feedLista.length) return;
  const fin = Math.min(feedLista.length, Math.max(feedN + FEED_LOTE, hasta + 4));
  feedBox.insertAdjacentHTML("beforeend", feedLista.slice(feedN, fin).map((p, k) => feedSlide(p, feedN + k)).join(""));
  for (const el of feedBox.querySelectorAll(".slide:not([data-visto])")) { el.dataset.visto = 1; feedVer.observe(el); }
  feedN = fin;
  hydrate(feedBox);
}
// el video que ocupa la pantalla: se apunta (para volver a el) y, cerca del final, se pintan mas
const feedVer = new IntersectionObserver(es => {
  for (const e of es) if (e.isIntersecting) {
    if (+e.target.dataset.i !== feedI || !feedBox.querySelector(".s-media, .slide.sin-video")) { feedI = +e.target.dataset.i; reproducir(); }
    if (feedI > feedN - 4) feedMas();
    guardarEstado();
  }
}, { root: feedBox, threshold: 0.6 });
function abrirFeed(desde = 0) {
  feedLista = results.map(r => r.p);
  if (!feedLista.length) return;
  feedI = Math.min(Math.max(0, desde), feedLista.length - 1);
  feedBox.innerHTML = ""; feedN = 0;
  feedMas(feedI);
  $("feed-t").textContent = q.value.trim() ? `«${q.value.trim()}»` : cat ? (sub && sub !== "*" ? subLabel(sub) : label(cat)) : "Todo";
  if (!feedDlg.open) { feedDlg.showModal(); history.pushState({ feed: 1 }, "", location.pathname + location.search); }
  feedBox.scrollTop = feedI * feedBox.clientHeight;
  guardarEstado();
}
$("tab-feed").addEventListener("click", () => {
  // empieza por el primer video que tenias a la vista en la rejilla
  const visible = [...grid.querySelectorAll(".card")].find(b => b.getBoundingClientRect().bottom > 120);
  const i = visible ? results.findIndex(r => r.p.id === visible.dataset.id) : 0;
  // desbloquear el reproductor dentro de este toque, aunque el primer video sea un TikTok o una foto
  const v = videoFeed(); v.muted = false; v.play().catch(() => {});
  abrirFeed(Math.max(0, i));
  reproducir();  // dentro del toque: asi iOS deja empezar con sonido
});
// Un solo <video> para todo el feed, creado y arrancado DENTRO del toque en «Deslizar»: iOS solo deja sonar
// con sonido a un video que empezo con un toque, y si luego se le cambia el video conserva el permiso
// (uno nuevo por pantalla empezaria siempre en silencio). Si iOS no deja (la app reabierta sola, sin toque),
// arranca en silencio y el primer toque en la pantalla pone el sonido.
let sonido = true, feedVideo = null, forzado = false;  // forzado: en silencio porque iOS no dejo, no porque lo quitaras
const tiktok = (s, msg) => s.querySelector("iframe.s-media")?.contentWindow?.postMessage({ type: msg, value: true, "x-tiktok-player": true }, "*");
function botonesSonido() {
  const on = sonido && !forzado;
  for (const b of feedBox.querySelectorAll("[data-sonido]")) b.innerHTML = `${on ? SON_ICO : MUDO_ICO}<span>${on ? "Sonido" : "Silencio"}</span>`;
}
function videoFeed() {
  if (feedVideo) return feedVideo;
  const v = feedVideo = document.createElement("video");
  v.className = "s-media"; v.playsInline = true; v.loop = true; v.preload = "auto";
  v.setAttribute("playsinline", ""); v.setAttribute("webkit-playsinline", "");
  v.addEventListener("playing", () => v.closest(".slide")?.classList.replace("cargando", "sonando") || v.closest(".slide")?.classList.add("sonando"));
  v.addEventListener("error", async () => {
    const s = v.closest(".slide"), src = v.getAttribute("src");
    if (!s || !src) return;
    // ¿bloqueado de verdad (404: musica con derechos) o Instagram frenando un momento (503)? Se pregunta al Worker
    const base = src.split("?")[0], n = +(v.dataset.intentos || 0);
    const st = await fetch(base, { redirect: "manual", cache: "no-store" }).then(r => r.type === "opaqueredirect" ? 302 : r.status).catch(() => 0);
    if (v.closest(".slide") !== s) return;
    if (st === 404) return sinVideo(s, "Instagram no deja ver este vídeo fuera de su app", true);
    if (n >= 4) return sinVideo(s, "Instagram está ocupado. Toca para intentarlo otra vez", false);
    v.dataset.intentos = n + 1;
    setTimeout(() => { if (v.closest(".slide") === s) { v.src = base + "?r=" + (n + 1); v.play().catch(() => {}); } }, st === 302 ? 0 : 2000 * (n + 1));
  });
  return v;
}
// bloqueado: el boton abre el reel en Instagram; ocupado: el boton lo vuelve a intentar
function sinVideo(s, txt, bloqueado) {
  s.classList.remove("cargando"); s.classList.add("sin-video");
  s.classList.toggle("ocupado", !bloqueado);
  s.querySelector(".s-aviso").textContent = txt;
  feedVideo?.remove();
}
function quitarMedia() {
  if (feedVideo) { feedVideo.pause(); feedVideo.removeAttribute("src"); feedVideo.remove(); }
  feedBox.querySelectorAll("iframe.s-media").forEach(m => m.remove());
  feedBox.querySelectorAll(".sonando, .pausado, .cargando").forEach(s => s.classList.remove("sonando", "pausado", "cargando"));
}
function reproducir() {
  quitarMedia();
  const s = feedBox.querySelector(`.slide[data-i="${feedI}"]`), p = feedLista[feedI];
  if (!s || !p || (s.classList.contains("sin-video") && !s.classList.contains("ocupado"))) return;
  s.classList.remove("sin-video", "ocupado");
  if (p.src === "tiktok") {
    const f = Object.assign(document.createElement("iframe"), { className: "s-media", allow: "autoplay; encrypted-media; fullscreen",
      src: `https://www.tiktok.com/player/v1/${p.id.slice(3)}?autoplay=1&loop=1&controls=0&music_info=0&description=0&rel=0&native_context_menu=0&closed_caption=0` });
    f.addEventListener("load", () => { s.classList.add("sonando"); if (sonido) setTimeout(() => tiktok(s, "unMute"), 600); });
    s.querySelector(".s-fondo").after(f);
    return;
  }
  if (!p.v) return sinVideo(s, "Es una foto o un carrusel: ábrelo en Instagram", true);
  const v = videoFeed();
  s.querySelector(".s-fondo").after(v);
  s.classList.add("cargando");
  v.dataset.intentos = 0;
  v.muted = !sonido;
  v.src = `${BUZON_URL}/video/ig/${encodeURIComponent(p.id)}`;
  v.play().catch(e => {
    if (e?.name !== "NotAllowedError" || v.closest(".slide") !== s) return;  // AbortError: ya se cambio de video
    v.muted = true; forzado = true; botonesSonido();
    v.play().catch(() => {});
  });
}
// si iOS lo dejo en silencio, el siguiente toque en la pantalla pone el sonido (un toque si cuenta como permiso)
feedBox.addEventListener("click", e => {
  if (!forzado || e.target.closest("[data-sonido]")) return;
  forzado = false;
  if (sonido && feedVideo?.isConnected) {
    if (e.target.closest(".s-tap, [data-play]")) e.stopPropagation();  // tocar el video aqui es para el sonido, no para pausar
    feedVideo.muted = false;
    feedVideo.play().catch(() => { feedVideo.muted = true; forzado = true; botonesSonido(); });
  }
  botonesSonido();
}, true);
function pausar(s) {
  const parar = s.classList.contains("sonando") && !s.classList.contains("pausado");  // aun sin arrancar: arrancar
  s.classList.toggle("pausado", parar);
  if (feedVideo && s.contains(feedVideo)) parar ? feedVideo.pause() : feedVideo.play().catch(() => {});
  else tiktok(s, parar ? "pause" : "play");
}
function cambiarSonido() {
  sonido = forzado ? true : !sonido; forzado = false;
  if (feedVideo) { feedVideo.muted = !sonido; if (sonido) feedVideo.play().catch(() => {}); }
  const s = feedBox.querySelector(`.slide[data-i="${feedI}"]`);
  if (s) tiktok(s, sonido ? "unMute" : "mute");
  botonesSonido();
}
feedDlg.addEventListener("close", quitarMedia);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) feedVideo?.pause();
  else if (feedDlg.open && feedVideo?.isConnected && !feedVideo.closest(".pausado")) feedVideo.play().catch(() => {});
});
$("feed-volver").addEventListener("click", () => history.state?.feed ? history.back() : feedDlg.close());
feedDlg.addEventListener("cancel", e => { e.preventDefault(); $("feed-volver").click(); });
feedDlg.addEventListener("close", guardarEstado);
feedBox.addEventListener("click", e => {
  const s = e.target.closest(".slide"), p = s && ix.posts.find(x => x.id === s.dataset.id);
  if (!p) return;
  const v = e.target.closest("[data-ver]");
  if (e.target.closest("[data-sonido]")) cambiarSonido();
  else if (e.target.closest("[data-play], .s-tap") && s.classList.contains("ocupado")) { s.classList.remove("sin-video", "ocupado"); reproducir(); }
  else if (e.target.closest("[data-play]") && s.classList.contains("sin-video")) Object.assign(document.createElement("a"), { href: p.url, target: "_blank", rel: "noopener" }).click();
  else if (e.target.closest(".s-tap, [data-play]")) pausar(s);
  else if (v) abrirMapa(p.lug[+v.dataset.ver]);
  else if (e.target.closest("[data-mapa]")) abrirMapa(p.lug[0]);
  else if (e.target.closest("[data-ficha]")) openPost(p.id);
  if (e.target.closest("[data-ver], [data-mapa], [data-ficha], .s-ir, .s-btn[href]") && !s.classList.contains("pausado")) pausar(s);
});

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
  if (mapaDlg.open && !history.state?.mapa) mapaDlg.close();
  if (feedDlg.open && !history.state?.feed && !history.state?.mapa && !location.hash) feedDlg.close();
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
async function load(y) {
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
  run(y);
}

// --- sincronizar con el Mac: al abrir la app, si esta vinculada ---
// Dos caminos, cada uno con su llave: los paquetes de Nacho (sync/, tools/sync-pack.py) y el
// buzon cifrado de la app Guardados del Mac (store.buzonNow). Sin ninguno, no se hace nada.
const linkedAny = () => !!(store.syncKey() || store.buzon());
let syncing = null;
function sync(onProgress) {
  if (syncing) return syncing;
  if (!linkedAny()) return Promise.resolve(null);
  syncing = (async () => {
    try {
      const prog = (fase, n, t) => {
        onProgress?.(fase, n, t);
        status.textContent = fase === "datos" ? "Trayendo lo nuevo del Mac…" : `Trayendo portadas del Mac… ${fmt(n)} de ${fmt(t)}`;
      };
      let r = null, error = false, extra = null;
      if (store.syncKey()) {
        try { r = await store.syncNow(rules, prog); } catch { error = true; }
      }
      if (store.buzon()) {
        try {
          const b = await store.buzonNow(rules, prog);
          if (b?.gone || b?.pending) extra = b;
          else if (b) r = { posts: (r?.posts || 0) + b.posts, covers: (r?.covers || 0) + b.covers };
        } catch { error = true; }
      }
      if (r) {
        await load(scrollY);
        status.textContent = `Del Mac: ${fmt(r.posts)} guardados nuevos, ${fmt(r.covers)} portadas. ` + status.textContent;
      } else if (/^Trayendo/.test(status.textContent)) run(scrollY);
      if (extra?.gone) status.textContent = "Tu Mac cambió la llave: este móvil se ha desconectado. Escanea el código nuevo.";
      else if (extra?.pending && !r) status.textContent = "Tu Mac aún está subiendo tus guardados. Vuelve a abrir la app en un rato.";
      if (error && !r) { run(scrollY); return { error: true }; }  // sin red o sin paquetes: se queda lo que habia
      return r || extra;
    } catch {
      run(scrollY);
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
  $("f-mac").textContent = linkedAny() ? "✓ Vinculado con el Mac · traer lo nuevo" : "Vincular con el Mac";
}
document.addEventListener("click", e => {
  if (!e.target.closest("[data-open-mac]")) return;
  if (linkedAny()) { mac.showModal(); linked(); return; }  // ya vinculado: sincronizar ahora
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
  } else if (r?.gone) {
    ok.classList.add("err"); $("mac-ok-t").textContent = "Este código ya no vale";
    msg.textContent = "Tu Mac cambió la llave. Pulsa «Conectar el móvil» en la app del Mac y escanea el código nuevo.";
  } else if (r?.pending) {
    msg.textContent = "Conectado. Tu Mac aún está subiendo tus guardados: aparecerán solos al volver a abrir la app.";
  } else msg.textContent = r?.covers || r?.posts
    ? `Listo: ${fmt(r.posts)} guardados nuevos y ${fmt(r.covers)} portadas.` : "Todo al día: no faltaba nada.";
  $("mac-done").hidden = false;
  macButton();
}
function gotKey(s) {
  // el QR de Nacho (#k=) o el de la app Guardados del Mac (#conectar=)
  if (!(/conectar=/.test(s) ? store.setBuzon(s) : store.setSyncKey(s))) return false;
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
      if ((code?.data?.includes("#k=") || code?.data?.includes("#conectar=")) && gotKey(code.data)) return;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});

async function main() {
  rules = makeRules(await (await fetch("rules-data.json")).json());
  const params = new URLSearchParams(location.search);
  // donde la dejaste, salvo que el enlace abra otra carpeta
  const guardado = leerEstado();
  const est = !params.has("cat") || params.get("cat") === guardado.cat ? guardado : {};
  q.value = params.has("q") ? params.get("q") : est.q || "";
  cat = params.get("cat") || est.cat || null;
  sub = est.sub || null;
  // enlace del QR (#k=clave): se guarda y se quita de la barra de direcciones
  if (location.hash.startsWith("#k=")) {
    store.setSyncKey(location.hash);
    history.replaceState(history.state, "", location.pathname + location.search);
  }
  // enlace del QR de la app Guardados del Mac (#conectar=...): la llave se queda en este
  // dispositivo y se borra de la barra (y del historial) antes de nada
  let conectado = false;
  if (location.hash.startsWith("#conectar=")) {
    conectado = store.setBuzon(location.hash);
    history.replaceState(history.state, "", location.pathname + location.search);
  }
  await load(est.y);
  if (Number.isInteger(est.feed)) abrirFeed(est.feed);
  if (conectado) { macButton(); mac.showModal(); await linked(); return; }
  if (location.hash.length > 1) openPost(location.hash.slice(1), false);
  let checked = null;
  try { checked = localStorage.getItem("guardados.covers.v2"); } catch {}
  if (mine && !checked) {
    const n = await store.checkCovers((i, t) => { status.textContent = `Revisando portadas… ${fmt(i)} de ${fmt(t)}`; }).catch(() => -1);
    try { if (n >= 0) localStorage.setItem("guardados.covers.v2", "1"); } catch {}
    if (n > 0) await load(scrollY);
    else run(scrollY);
  }
  sync();
}
main().catch(() => { status.textContent = "No he podido cargar la app. Ábrela una vez con conexión."; });

if ("serviceWorker" in navigator) {
  // version nueva publicada: recargar ya, no a la segunda vez que se abre la app
  const habia = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener("controllerchange", () => { if (habia) location.reload(); });
  navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).then(r => r.update()).catch(() => {});
}
