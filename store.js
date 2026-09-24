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

export async function getCover(id) {
  const d = await db();
  return req(d.transaction("covers").objectStore("covers").get(id));
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
        video: !!p.v, plays: p.p || 0, thumb: null, tr: p.tr || "", kw: p.kw || "",
      })),
    };
  }
  if (Array.isArray(json?.items)) {
    return {
      kind: json.app === "guardados" ? "marcador" : "pull",
      pulledAt: json.pulled_at || null,
      items: json.items.filter(i => i?.code).map(i => ({
        code: i.code, user: i.user || "", name: i.name || "", caption: i.caption || "",
        taken_at: i.taken_at || null, video: i.type === 2, plays: i.plays || 0, thumb: i.thumb || null,
      })),
    };
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

// Fusiona con lo que ya hay (por code: el mismo post nunca sale dos veces).
// onProgress(fase, hechos, total)
export async function importItems(parsed, rules, onProgress = () => {}) {
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
      url: `https://www.instagram.com/p/${i.code}/`,
      img: !!prev?.img, _thumb: i.thumb,
    };
  });

  onProgress("posts", 0, posts.length);
  let tx = d.transaction("posts", "readwrite");
  for (const p of posts) { const { _thumb, ...row } = p; tx.objectStore("posts").put(row); }
  await done(tx);

  // portadas que faltan, de 6 en 6
  const todo = posts.filter(p => p._thumb && !p.img);
  let n = 0, ok = 0;
  onProgress("portadas", 0, todo.length);
  for (let i = 0; i < todo.length; i += 6) {
    const batch = await Promise.all(todo.slice(i, i + 6).map(p => shrink(p._thumb).then(b => [p, b], () => [p, null])));
    tx = d.transaction(["posts", "covers"], "readwrite");
    for (const [p, b] of batch) {
      if (!b) continue;
      const { _thumb, ...row } = p;
      row.img = true; ok++;
      tx.objectStore("covers").put(b, p.id);
      tx.objectStore("posts").put(row);
    }
    await done(tx);
    n += batch.length;
    onProgress("portadas", n, todo.length);
  }
  const total = (await loadPosts()).length;
  return { imported: posts.length, isNew: posts.filter(p => !old.has(p.id)).length, covers: ok, missing: todo.length - ok, total };
}

// Copia de seguridad: lo mismo que importa (sin portadas, que se pueden rebajar)
export async function exportBackup() {
  const posts = await loadPosts();
  return new Blob([JSON.stringify({ app: "guardados", v: 1, backup: true, pulled_at: Date.now(),
    items: posts.map(p => ({ code: p.id, user: p.u, name: p.n, caption: p.c, taken_at: p.d, type: p.v ? 2 : 1, plays: p.p })) })],
    { type: "application/json" });
}
