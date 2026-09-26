// Buscador por objetivo, sin IA: BM25 sobre titulo + descripcion + transcripcion,
// con sinonimos ES<->EN, coincidencia por prefijo ("invers" -> inversion,
// inversiones, investing...) y la categoria que sugiere la pregunta (mismas
// palabras clave que rules.py, en data.kw; no confundir con el "kw" de cada
// post, que son sus palabras clave ocultas).
// Es la version movil de ask.py; funciona igual en el navegador y en Node.

const STOP = new Set(`
algo alguna alguno algun algunos algunas cosa cosas sirva sirvan servir sirve util utiles
quiero queria necesito busca buscar buscame encuentra encontrar dame tengo tener tenia hay
hacer como para por con sin una uno unos unas que the and for with want need make my me
de del en un el la los las lo le les se su sus mi mis tu tus yo es son era esta este esto
eso ese esa al a o y e u ni pero mas muy mejor mejores bien sobre desde hasta entre donde
cuando cual cuales quien video videos reel reels post guardado guardados vi visto
something anything thing things some any help helps useful find show give get got have
how what which who that this those these about from into your you our its are was were
to of in on at by or an is it be do does did can could would should will just
hoy ahora ver ser soy estar estoy siendo parezca parece dia dias cada todo todos toda
`.split(/\s+/).filter(Boolean));

// tu dices una cosa, el reel dice otra (ampliado desde ask.py)
const SYN = {
  cara: "premium expensive luxury caro lujo profesional",
  caro: "premium expensive luxury",
  apple: "minimal minimalist clean premium polished elegant",
  diseno: "design ui ux frontend aesthetic visual layout figma",
  design: "diseno ui ux frontend aesthetic",
  web: "website webapp frontend landing pagina",
  pagina: "website web landing",
  tokens: "context cheap budget usage limit",
  memoria: "memory remember context persist",
  acuerde: "memory remember memoria context persist",
  acordar: "memory remember memoria",
  recordar: "memory remember memoria",
  recuerde: "memory remember memoria",
  ganar: "earn income ingresos revenue money",
  clientes: "clients customers sales ventas leads",
  agente: "agent agents subagent orchestration workflow",
  video: "remotion motion animation edit",
  datos: "data scraping database sql analytics",
  dinero: "money finanzas invest ahorro income",
  ahorrar: "ahorro save saving money budget",
  invertir: "invest investing inversion stocks etf bolsa",
  bolsa: "stocks stock market trading",
  trabajo: "job empleo work career hiring",
  practicas: "internship intern summer analyst",
  cv: "resume curriculum",
  entrevista: "interview",
  receta: "recipe cocina cook",
  comida: "food recipe receta",
  cena: "dinner recipe receta",
  barato: "cheap budget low cost gratis free",
  gratis: "free",
  viaje: "travel trip vuelo flight",
  vuelo: "flight vuelos",
  ejercicio: "workout gym fitness training",
  gimnasio: "gym workout",
  peli: "movie film pelicula",
  pelicula: "movie film",
  serie: "series show netflix",
  gracioso: "funny meme humor",
  negocio: "business startup emprender",
  ventas: "sales selling",
  ia: "ai llm gpt claude",
  automatizar: "automation automate workflow n8n",
  programar: "coding code programming developer",
  app: "application aplicacion",
  aprender: "learn course curso tutorial",
  productividad: "productivity focus habits",
};

// palabras que por si solas apuntan a una categoria (ademas de las de rules.py)
const CAT_ALIAS = {
  tecnologia: "tecnologia tech ia ai programar codigo code app herramienta herramientas tool tools",
  finanzas: "finanzas dinero invertir inversion ahorro ahorrar money finance",
  carrera: "carrera trabajo practicas cv entrevista career job",
  recetas: "receta recetas cocinar comida cena comer",
  viajes: "viaje viajes viajar vuelo vacaciones",
  pelis_series: "peli pelis pelicula peliculas serie series",
  fitness_salud: "ejercicio gimnasio gym salud dieta entrenar",
  diseno: "diseno design web",
  negocios: "negocio negocios emprender empresa clientes",
  humor: "gracioso meme memes risa humor",
  anime: "anime manga otaku",
  videojuegos: "videojuego videojuegos juego juegos gaming games consola",
  musica: "musica cancion canciones song songs rap dj concierto",
  deportes: "deporte deportes futbol baloncesto tenis sports",
  moda: "moda ropa outfit outfits belleza maquillaje zapatillas",
  animales: "animal animales perro perros gato gatos mascota mascotas",
  planes: "plan planes restaurante restaurantes bar bares sitio sitios madrid",
  ciencia: "ciencia curiosidad curiosidades historia experimento",
  estudios: "estudiar estudios universidad examen examenes uni",
  coches: "coche coches motor moto motos",
  hogar: "hogar casa decoracion diy piso muebles",
  motivacion: "motivacion mentalidad mindset habitos",
};

export const norm = s => (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const toks = s => norm(s).split(/[^a-z0-9]+/).filter(w => w.length > 1);
const stem = w => w.length > 5 && w.endsWith("es") ? w.slice(0, -2) : w.length > 4 && w.endsWith("s") ? w.slice(0, -1) : w;

// kw: palabras clave ocultas (texto en pantalla + relacionadas), solo en
// los guardados de Nacho y la muestra: ver keywords.py
const FIELDS = [["t", 3], ["c", 1.5], ["u", 1.5], ["n", 1], ["tr", 0.6], ["kw", 0.8]];

export function buildIndex(data) {
  const posts = data.posts;
  const inv = new Map();           // term -> [[doc, peso]]
  const len = new Float32Array(posts.length);
  const inTr = new Map();          // term -> Set(doc) solo en transcripcion
  posts.forEach((p, i) => {
    const tf = new Map();
    const trOnly = new Set();
    for (const [f, w] of FIELDS) {
      for (const t of toks(p[f])) {
        tf.set(t, (tf.get(t) || 0) + w);
        len[i] += w;
        if (f === "tr") trOnly.add(t);
      }
    }
    for (const [f] of FIELDS.slice(0, 4)) for (const t of toks(p[f])) trOnly.delete(t);
    for (const [t, n] of tf) {
      if (!inv.has(t)) inv.set(t, []);
      inv.get(t).push([i, n]);
    }
    for (const t of trOnly) {
      if (!inTr.has(t)) inTr.set(t, new Set());
      inTr.get(t).add(i);
    }
  });
  const avg = len.reduce((a, b) => a + b, 0) / posts.length;
  const vocab = [...inv.keys()].sort();

  // categoria que sugiere cada palabra: la de rules.py + los alias
  const catOf = new Map();
  const catPhrases = [];
  for (const [cat, kws] of Object.entries(data.kw || {})) {
    for (const k of kws) {
      const nk = norm(k).trim();
      if (nk.includes(" ")) catPhrases.push([nk, norm(cat)]);
      else if (nk.length > 2) catOf.set(nk, norm(cat));
    }
  }
  for (const [cat, words] of Object.entries(CAT_ALIAS)) for (const w of words.split(" ")) catOf.set(w, cat);

  return { posts, inv, len, avg, vocab, inTr, catOf, catPhrases, N: posts.length };
}

function prefixTerms(ix, p) {
  // busqueda binaria en el vocabulario ordenado
  let lo = 0, hi = ix.vocab.length;
  while (lo < hi) { const m = (lo + hi) >> 1; ix.vocab[m] < p ? lo = m + 1 : hi = m; }
  const out = [];
  for (let i = lo; i < ix.vocab.length && ix.vocab[i].startsWith(p) && out.length < 40; i++) out.push(ix.vocab[i]);
  return out;
}

// cada palabra de la pregunta es un "concepto"; sus sinonimos y variantes suman a ese concepto
function concepts(ix, q) {
  const words = [...new Set(toks(q).filter(w => !STOP.has(w)))];
  return words.map(w => {
    const terms = new Map([[w, 1]]);
    const s = stem(w);
    if (s.length >= 5) {  // con 4 letras "cara" arrastra "caramelo"
      const pre = s.length > 6 ? s.slice(0, s.length - 2) : s;
      for (const t of prefixTerms(ix, pre)) if (!terms.has(t)) terms.set(t, 0.7);
    }
    for (const syn of (SYN[w] || SYN[s] || "").split(" ").filter(Boolean)) {
      if (!terms.has(syn)) terms.set(syn, 0.5);
    }
    return { word: w, terms };
  });
}

export function search(ix, q, { cat = null, limit = 60 } = {}) {
  const cs = concepts(ix, q);
  const nq = " " + norm(q) + " ";
  const wantCats = new Set();
  for (const c of cs) { const k = ix.catOf.get(c.word) || ix.catOf.get(stem(c.word)); if (k) wantCats.add(k); }
  for (const [ph, k] of ix.catPhrases) if (nq.includes(" " + ph + " ")) wantCats.add(k);

  // "src:instagram" / "src:tiktok": carpetas por red social, no por tema
  const inCat = i => !cat || (cat.startsWith("src:") ? (ix.posts[i].src || "instagram") === cat.slice(4)
    : ix.posts[i].cat.map(norm).includes(norm(cat)));
  if (!cs.length) {
    const all = ix.posts.map((p, i) => ({ p, i, score: 0 })).filter(r => inCat(r.i));
    return { results: all.slice(0, limit), total: all.length, cats: [...wantCats] };
  }

  const k1 = 1.2, b = 0.75;
  const score = new Map(), hitConcepts = new Map(), audio = new Map();
  cs.forEach((c, ci) => {
    const best = new Map();  // el mejor termino de este concepto por doc
    for (const [t, w] of c.terms) {
      const post = ix.inv.get(t);
      if (!post) continue;
      const idf = Math.log(1 + (ix.N - post.length + 0.5) / (post.length + 0.5));
      for (const [d, tf] of post) {
        const s = w * idf * (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * ix.len[d] / ix.avg));
        if (s > (best.get(d)?.s || 0)) best.set(d, { s, t });
      }
    }
    for (const [d, { s, t }] of best) {
      score.set(d, (score.get(d) || 0) + s);
      if (!hitConcepts.has(d)) hitConcepts.set(d, new Set());
      hitConcepts.get(d).add(ci);
      if (ix.inTr.get(t)?.has(d)) audio.set(d, true);
    }
  });

  const results = [];
  for (const [d, s0] of score) {
    if (!inCat(d)) continue;
    const p = ix.posts[d];
    // premia al que cubre mas partes de la pregunta, y a la categoria que pide
    let s = s0 * (1 + (hitConcepts.get(d).size - 1) / Math.max(1, cs.length - 1) * (cs.length > 1 ? 1 : 0));
    if (wantCats.size) s *= p.cat.some(c => wantCats.has(norm(c))) ? 1.6 : 0.7;
    results.push({ p, i: d, score: s, audio: !!audio.get(d) && hitConcepts.get(d).size > 0 });
  }
  results.sort((a, b) => b.score - a.score);
  return { results: results.slice(0, limit), total: results.length, cats: [...wantCats] };
}
