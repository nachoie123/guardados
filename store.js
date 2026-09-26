// Tus guardados, en tu navegador (IndexedDB). Sin servidor: el fichero que baja
// el marcador se procesa aqui mismo (titulo y categoria con rules.js, portada
// descargada y reducida) y no sale del dispositivo.
//
// posts:  { id, t, u, n, c, tr, cat, d, v, p, url, img } — el formato de siempre
// covers: Blob JPEG por id

const DB = "guardados", VER = 1;
let dbp;

function db() {
  return dbp ||= new Promise((res, rej) => {
    const r = indexedDB.open(DB, VER);
    r.onupgradeneeded = () => {
      r.result.createObjectStore("posts", { keyPath: "id" });
      r.result.createObjectStore("covers");
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

const done = tx => new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = tx.onabort = () => rej(tx.error); });
const req = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

export async function loadPosts() {
  try {
    const d = await db();
    const posts = await req(d.transaction("posts").objectStore("posts").getAll());
    return posts.sort((a, b) => (b.d || 0) - (a.d || 0));
  } catch { return []; }
}

// Las portadas se guardan como bytes (ArrayBuffer), no como Blob: en el iPhone,
// sobre todo abierta desde la pantalla de inicio, WebKit pierde el fichero que
// hay detras de un Blob guardado ("WebKitBlobResource error 1") y la portada sale
// en blanco. Las viejas (Blob) se pasan a bytes al leerlas; si ya no se pueden
// leer -> null, y quien llama la marca para volver a bajarla (markNoCover).
const jpeg = v => new Blob([v], { type: "image/jpeg" });
export async function getCover(id) {
  const d = await db();
  const v = await req(d.transaction("covers").objectStore("covers").get(id));
  if (!v) return null;
  if (!(v instanceof Blob)) return jpeg(v);
  const buf = await v.arrayBuffer();  // lanza si WebKit perdio el fichero
  if (!buf.byteLength) throw new Error("vacia");
  const tx = d.transaction("covers", "readwrite");
  tx.objectStore("covers").put(buf, id);
  await done(tx);
  return jpeg(buf);
}

export async function markNoCover(ids) {
  const d = await db();
  const tx = d.transaction(["posts", "covers"], "readwrite");
  for (const id of ids) {
    const row = await req(tx.objectStore("posts").get(id));
    if (row) tx.objectStore("posts").put({ ...row, img: false });
    tx.objectStore("covers").delete(id);
  }
  await done(tx);
}

// Una pasada por todas: Blob -> bytes, y las ilegibles a reparar. Devuelve cuantas estaban rotas.
export async function checkCovers(onProgress = () => {}) {
  const d = await db();
  const ids = await req(d.transaction("covers").objectStore("covers").getAllKeys());
  const bad = [];
  for (let i = 0; i < ids.length; i += 50) {
    for (const id of ids.slice(i, i + 50)) {
      try { if (!(await getCover(id))) bad.push(id); } catch { bad.push(id); }
    }
    onProgress(Math.min(i + 50, ids.length), ids.length);
  }
  if (bad.length) await markNoCover(bad);
  return bad.length;
}

export async function clearAll() {
  const d = await db();
  const tx = d.transaction(["posts", "covers"], "readwrite");
  tx.objectStore("posts").clear(); tx.objectStore("covers").clear();
  await done(tx);
}

// --- importar ---

// Acepta: el fichero del marcador ({app:"guardados", items}), el saved_all.json
// de pull.js ({items}) y el export oficial de Instagram (saved_posts.json:
// solo cuenta + enlace + fecha, sin caption ni portada). Y el posts.json de
// export.py, que trae ademas la transcripcion ("tr") y las palabras clave
// ocultas ("kw"): asi Nacho enriquece lo que ya importo con el marcador.
export function parseFile(json) {
  if (Array.isArray(json?.posts)) {
    return {
      kind: "export", pulledAt: json.built || null,
      items: json.posts.filter(p => p?.id).map(p => ({
        code: p.id, user: p.u || "", name: p.n || "", caption: p.c || "", taken_at: p.d || null,
        video: !!p.v, plays: p.p || 0, tr: p.tr || "", kw: p.kw || "",
        src: p.src || "instagram", url: p.url || null,
        // mis-guardados.json (export.py --mio) trae la portada dentro, en base64
        thumb: p.cov || null,
      })),
    };
  }
  if (Array.isArray(json?.items)) {
    return {
      kind: json.app === "guardados" ? "marcador" : "pull",
      pulledAt: json.pulled_at || null,
      src: json.src || "instagram",
      items: json.items.filter(i => i?.code).map(i => ({
        code: i.code, user: i.user || "", name: i.name || "", caption: i.caption || "",
        taken_at: i.taken_at || null, video: i.type === 2, plays: i.plays || 0, thumb: i.thumb || null,
        // TikTok (bookmarklet-tiktok.js): enlace propio y subtitulos automaticos en tr
        src: i.src || "instagram", url: i.url || null, tr: i.tr || "",
      })),
    };
  }
  // descarga oficial de TikTok (user_data_tiktok.json): la lista de favoritos
  // cambia de sitio segun la version, asi que se busca por nombre
  const find = (o, d = 0) => o && typeof o === "object" && d < 5 &&
    (Array.isArray(o.FavoriteVideoList) ? o.FavoriteVideoList : Object.values(o).reduce((a, v) => a || find(v, d + 1), null));
  const ttOfficial = !Array.isArray(json) && find(json);
  if (ttOfficial) {
    const items = [];
    for (const e of ttOfficial) {
      const link = e?.Link || e?.link || "";
      const m = link.match(/\/(?:video|photo|v)\/(\d{8,})/);
      const t = Date.parse((e.Date || e.date || "").replace(" ", "T") + "Z");
      if (m) items.push({ code: "tt_" + m[1], src: "tiktok", url: link, user: "", name: "", caption: "",
        taken_at: isNaN(t) ? null : t / 1000, video: true, plays: 0, thumb: null });
    }
    return { kind: "oficial", src: "tiktok", pulledAt: null, items };
  }
  const official = json?.saved_saved_media || (Array.isArray(json) ? json : null);
  if (official) {
    const items = [];
    for (const e of official) {
      const s = e?.string_map_data?.["Saved on"] || Object.values(e?.string_map_data || {})[0];
      const m = s?.href?.match(/instagram\.com\/(?:[\w.]+\/)?(?:p|reel|tv)\/([\w-]+)/);
      if (m) items.push({ code: m[1], user: e.title || "", name: "", caption: "", taken_at: s.timestamp || null,
        video: /\/reel\//.test(s.href), plays: 0, thumb: null });
    }
    return { kind: "oficial", pulledAt: null, items };
  }
  return null;
}

// Portada: la de Instagram, reducida a 270 px de ancho (≈15 KB). Los enlaces
// caducan en unos 5 dias, por eso se bajan al importar y no al mirarlas.
async function shrink(url) {
  const r = await fetch(url, { mode: "cors", credentials: "omit" });
  if (!r.ok) throw new Error(r.status);
  const bmp = await createImageBitmap(await r.blob());
  const w = Math.min(270, bmp.width), h = Math.round(bmp.height * w / bmp.width);
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  cv.getContext("2d").drawImage(bmp, 0, 0, w, h);
  bmp.close?.();
  return new Promise((res, rej) => cv.toBlob(b => b ? res(b) : rej(new Error("toBlob")), "image/jpeg", 0.72));
}

// La de mis-guardados.json ya viene reducida (base64 a secas): se guarda tal
// cual, sin canvas (en Safari del iPhone, 2.000 canvas seguidos pueden fallar sin avisar).
async function cover(t) {
  if (/^https?:/.test(t)) return shrink(t);
  const b64 = t.startsWith("data:") ? t.slice(t.indexOf(",") + 1) : t;
  let u8;
  if (Uint8Array.fromBase64) u8 = Uint8Array.fromBase64(b64);
  else {
    const bin = atob(b64);
    u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  }
  return new Blob([u8], { type: "image/jpeg" });
}

// --- ficheros grandes, a trozos ---
// mis-guardados.json pesa ~100 MB. Leido de golpe, la pestana pasa de 1 GB y
// Safari del iPhone la mata a medias: las portadas que no llegaron a guardarse
// se quedaban en degradado. export.py lo escribe con un post por linea ("lines":1)
// y aqui se lee linea a linea, dos veces: primero los datos, luego las portadas.
async function* lines(file) {
  const rd = file.stream().pipeThrough(new TextDecoderStream()).getReader();
  let buf = "";
  for (;;) {
    const { value, done } = await rd.read();
    if (done) break;
    buf += value;
    let i;
    while ((i = buf.indexOf("\n")) >= 0) { yield buf.slice(0, i); buf = buf.slice(i + 1); }
  }
  if (buf) yield buf;
}
const postLine = l => l.startsWith('{"id":') ? JSON.parse(l.endsWith(",") ? l.slice(0, -1) : l) : null;

// Cualquier fichero: el de lineas, a trozos; el resto, como siempre.
// Devuelve { parsed, result } o { parsed: null } si no es de guardados.
export async function importFile(file, rules, onProgress) {
  const head = await file.slice(0, 200).text();
  if (!/^\{"built":[^\n]*"lines":1/.test(head) || !file.stream || typeof TextDecoderStream === "undefined") {
    let parsed;
    try { parsed = parseFile(JSON.parse(await file.text())); } catch { parsed = null; }
    if (!parsed?.items.length) return { parsed: null };
    return { parsed, result: await importItems(parsed, rules, onProgress) };
  }
  const posts = [];
  for await (const l of lines(file)) {
    const p = postLine(l);
    if (p?.id) { p.cov = p.cov ? 1 : 0; posts.push(p); }  // la portada, en la segunda vuelta
  }
  const parsed = parseFile({ built: (JSON.parse(head.split("\n")[0] + "]}")).built, posts });
  if (!parsed?.items.length) return { parsed: null };
  const thumbs = async function* (want) {
    for await (const l of lines(file)) {
      const p = postLine(l);
      if (p?.cov && want.has(p.id)) yield [p.id, p.cov];
    }
  };
  return { parsed, result: await importItems(parsed, rules, onProgress, thumbs) };
}

// Fusiona con lo que ya hay (por code: el mismo post nunca sale dos veces).
// onProgress(fase, hechos, total). thumbs(ids): de donde salen las portadas
// (por defecto, del propio parsed; importFile las va leyendo del fichero).
export async function importItems(parsed, rules, onProgress = () => {}, thumbs = null) {
  const d = await db();
  const old = new Map((await loadPosts()).map(p => [p.id, p]));
  const posts = parsed.items.map(i => {
    const prev = old.get(i.code);
    // el export oficial no trae caption: no pisar uno que ya teniamos
    const caption = i.caption || prev?.c || "";
    const tr = i.tr || prev?.tr || "", kw = i.kw || prev?.kw || "";
    const { display, cats } = rules.label(caption, tr, i.user || prev?.u || "");
    return {
      id: i.code, t: display,
      u: i.user || prev?.u || "", n: i.name || prev?.n || "", c: caption, tr, kw,
      cat: cats, d: i.taken_at || prev?.d || null, v: i.video, p: i.plays || prev?.p || 0,
      src: i.src || prev?.src || "instagram",
      url: i.url || prev?.url || `https://www.instagram.com/p/${i.code}/`,
      img: !!prev?.img, _thumb: i.thumb,
    };
  });

  onProgress("posts", 0, posts.length);
  let tx = d.transaction("posts", "readwrite");
  for (const p of posts) { const { _thumb, ...row } = p; tx.objectStore("posts").put(row); }
  await done(tx);

  // portadas que faltan, de 6 en 6. Reimportar el mismo fichero solo rellena
  // las que falten; las que fallan se reintentan una vez, de una en una.
  const todo = new Map(posts.filter(p => p._thumb && !p.img).map(p => [p.id, p]));
  thumbs ||= async function* () { for (const p of todo.values()) yield [p.id, p._thumb]; };
  let n = 0, ok = 0, batch = [], failed = [];
  const save = async (pairs, retry) => {
    const got = await Promise.all(pairs.map(([p, t]) => cover(t).then(b => b.arrayBuffer()).then(b => [p, t, b], () => [p, t, null])));
    const tx = d.transaction(["posts", "covers"], "readwrite");
    for (const [p, t, b] of got) {
      if (!b) { if (!retry) failed.push([p, t]); continue; }
      const { _thumb, ...row } = p;
      row.img = true; ok++;
      tx.objectStore("covers").put(b, p.id);
      tx.objectStore("posts").put(row);
    }
    await done(tx);
  };
  onProgress("portadas", 0, todo.size);
  for await (const [id, t] of thumbs(new Set(todo.keys()))) {
    const p = todo.get(id);
    if (!p) continue;
    p._thumb = null;  // que la memoria se vaya liberando
    batch.push([p, t]);
    if (batch.length < 6) continue;
    await save(batch); n += batch.length; batch = [];
    onProgress("portadas", n, todo.size);
  }
  if (batch.length) { await save(batch); n += batch.length; }
  for (const f of failed) await save([f], true);
  onProgress("portadas", todo.size, todo.size);
  const total = (await loadPosts()).length;
  return { imported: posts.length, isNew: posts.filter(p => !old.has(p.id)).length, covers: ok, missing: todo.size - ok, total };
}

// Copia de seguridad: lo mismo que importa (sin portadas, que se pueden rebajar)
export async function exportBackup() {
  const posts = await loadPosts();
  return new Blob([JSON.stringify({ app: "guardados", v: 1, backup: true, pulled_at: Date.now(),
    items: posts.map(p => ({ code: p.id, user: p.u, name: p.n, caption: p.c, taken_at: p.d, type: p.v ? 2 : 1, plays: p.p,
      src: p.src, url: p.url, tr: p.src === "tiktok" ? p.tr : undefined })) })],
    { type: "application/json" });
}

// --- sincronizacion con el Mac (tools/sync-pack.py) ---
// El Mac publica en sync/ paquetes cifrados (AES-GCM) con lo nuevo; la clave
// llega una vez por el QR (#k=...) y se queda en este dispositivo. Aqui se baja
// el indice, los datos si han cambiado y solo las portadas que falten.
const SYNC_KEY = "guardados.sync", SYNC_POSTS = "guardados.sync.posts";
const ls = {
  get: k => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} },
};
export const syncKey = () => ls.get(SYNC_KEY);
// acepta la clave a secas o el enlace entero del QR
export function setSyncKey(s) {
  const k = (s || "").trim().replace(/^.*#k=/, "");
  if (!/^[A-Za-z0-9_-]{43}$/.test(k)) return false;
  ls.set(SYNC_KEY, k); ls.set(SYNC_POSTS, null);
  return true;
}

async function unseal(k, buf) {
  const raw = Uint8Array.from(atob(k.replace(/-/g, "+").replace(/_/g, "/") + "="), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["decrypt"]);
  return new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: buf.slice(0, 12) }, key, buf.slice(12)));
}
const getBin = async f => {
  const r = await fetch("sync/" + f, { cache: "no-store" });
  if (!r.ok) throw new Error("sync " + r.status);
  return new Uint8Array(await r.arrayBuffer());
};

// -> null si no hay nada nuevo; si no, { posts, covers } con lo que ha entrado
export async function syncNow(rules, onProgress = () => {}) {
  const k = syncKey();
  if (!k) return null;
  const ix = JSON.parse(new TextDecoder().decode(await unseal(k, await getBin("index.bin"))));
  let posts = 0, covers = 0;
  if (ix.posts && ix.posts !== ls.get(SYNC_POSTS)) {
    onProgress("datos", 0, 1);
    const gz = await unseal(k, await getBin(ix.posts));
    const text = await new Response(new Blob([gz]).stream().pipeThrough(new DecompressionStream("gzip"))).text();
    const r = await importItems(parseFile(JSON.parse(text)), rules);
    posts = r.isNew;
    ls.set(SYNC_POSTS, ix.posts);
  }
  const rows = new Map((await loadPosts()).filter(p => !p.img).map(p => [p.id, p]));
  const packs = ix.covers.filter(p => p.ids.some(id => rows.has(id)));
  const want = packs.reduce((n, p) => n + p.ids.filter(id => rows.has(id)).length, 0);
  const d = await db();
  const breathe = () => new Promise(r => setTimeout(r, 0));  // que la pantalla no se congele
  onProgress("portadas", 0, want);
  for (const p of packs) {
    const b = await unseal(k, await getBin(p.f));
    const len = new DataView(b.buffer, b.byteOffset).getUint32(0);
    let off = 4 + len, batch = [];
    const flush = async () => {
      const tx = d.transaction(["posts", "covers"], "readwrite");
      for (const [row, buf] of batch) {
        tx.objectStore("covers").put(buf, row.id);
        tx.objectStore("posts").put({ ...row, img: true });
      }
      await done(tx);
      covers += batch.length; batch = [];
      onProgress("portadas", covers, want);
      await breathe();
    };
    for (const [id, size] of JSON.parse(new TextDecoder().decode(b.subarray(4, 4 + len)))) {
      const row = rows.get(id);
      if (row) { batch.push([row, b.slice(off, off + size).buffer]); if (batch.length >= 100) await flush(); }
      off += size;
    }
    if (batch.length) await flush();
  }
  return posts || covers ? { posts, covers } : null;
}
