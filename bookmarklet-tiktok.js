// Marcador de Guardados para TikTok: se pulsa en tiktok.com con la sesion abierta
// y descarga guardados-tiktok-fecha.json con los Favoritos (descripcion, cuenta,
// fecha, reproducciones, enlace a la portada y los subtitulos automaticos).
// Nada sale del navegador: el fichero se importa a mano en la app.
// API: /api/user/collect/item_list/ (la que usa Perfil -> Favoritos). Va firmada
// en la web (X-Bogus, X-Gnarly), pero responde igual sin firma si lleva
// aid=1988, app_name y device_platform. El secUid de la sesion sale del JSON que
// TikTok mete en la pagina (__UNIVERSAL_DATA_FOR_REHYDRATION__).
// Subtitulos: el CDN solo deja leerlos desde tiktok.com (CORS), asi que los baja
// el marcador y no la app. Son texto de TikTok (su ASR), no audio: la version
// publica sigue siendo solo texto.
// Igual que el de Instagram: 1 s entre paginas, para si hay 429 y desde la 2a
// vez baja solo lo nuevo. Sin comentarios dentro del codigo (ver bookmarklet.js).
(async () => {
  if (!/(^|\.)tiktok\.com$/.test(location.hostname)) {
    alert("Abre tiktok.com con tu cuenta y vuelve a pulsar este marcador.");
    return;
  }
  const box = document.createElement("div");
  box.style.cssText = "position:fixed;z-index:2147483647;left:50%;top:16px;transform:translateX(-50%);" +
    "max-width:calc(100vw - 32px);padding:14px 18px;border-radius:14px;background:#1C1917;color:#FAFAF9;" +
    "font:15px/1.4 -apple-system,system-ui,sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.35)";
  document.body.append(box);
  const say = html => { box.innerHTML = html; };
  const close = msg => { say(msg + ' <button id="gx" style="margin-left:6px;font:inherit;padding:2px 10px;border-radius:8px;border:0">Cerrar</button>'); box.querySelector("#gx").onclick = () => box.remove(); };
  const wait = ms => new Promise(r => setTimeout(r, ms));

  let sec = null;
  try { sec = JSON.parse(document.getElementById("__UNIVERSAL_DATA_FOR_REHYDRATION__").textContent).__DEFAULT_SCOPE__["webapp.app-context"].user.secUid; } catch {}
  if (!sec) { close("TikTok no te reconoce: inicia sesión en tiktok.com, recarga la página y repite."); return; }
  say("Leyendo tus favoritos…");

  const slim = m => {
    const ip = m.imagePost;
    return {
      code: "tt_" + m.id, src: "tiktok", url: `https://www.tiktok.com/@${m.author?.uniqueId || "_"}/${ip ? "photo" : "video"}/${m.id}`,
      user: m.author?.uniqueId || "", name: m.author?.nickname || "",
      caption: [ip?.title, m.desc].filter(Boolean).join("\n"), taken_at: m.createTime || null,
      type: ip ? 1 : 2, plays: +(m.statsV2?.playCount || m.stats?.playCount || 0),
      thumb: m.video?.cover || ip?.cover?.imageURL?.urlList?.[0] || null,
      _subs: m.video?.subtitleInfos || [], _lang: m.textLanguage || "",
    };
  };

  const KEY = "guardados-marcador-tiktok";
  let prev = null;
  try { prev = JSON.parse(localStorage.getItem(KEY)); } catch {}
  const onlyNew = !!prev?.last && confirm(`La última vez bajaste ${prev.n} favoritos (${new Date(prev.at).toLocaleDateString()}).\n\nAceptar: solo los nuevos desde entonces (rápido).\nCancelar: todos otra vez.`);
  const base = "/api/user/collect/item_list/?aid=1988&app_name=tiktok_web&device_platform=web_pc&count=30&secUid=" + encodeURIComponent(sec) + "&cursor=";
  let cursor = "0", items = [], seen = new Set(), pages = 0, err = "", reached = false, total = 0;
  while (pages < 400) {
    let r;
    try { r = await fetch(base + cursor, { credentials: "include" }); } catch { err = "Sin conexión."; break; }
    if (r.status === 429) { err = "TikTok pide ir más despacio. Espera una hora antes de repetir."; break; }
    let j = null;
    try { j = await r.json(); } catch {}
    if (!r.ok || !j || j.statusCode) { err = "TikTok respondió " + (j?.statusCode || r.status) + ". Recarga tiktok.com y repite."; break; }
    total = j.total || total;
    for (const m of j.itemList || []) {
      if (onlyNew && "tt_" + m.id === prev.last) { reached = true; break; }
      if (m?.id && !seen.has(m.id)) { seen.add(m.id); items.push(slim(m)); }
    }
    pages++;
    say(`Leyendo tus favoritos… <b>${items.length}</b>${total && !onlyNew ? " de " + total : ""}<br><small>No cambies de pestaña hasta que diga «Listo».</small>`);
    if (reached || !j.hasMore || !j.cursor || j.cursor === cursor) break;
    cursor = j.cursor;
    await wait(1000);
  }

  const vtt = t => [...new Set(t.split(/\r?\n/).filter(l => l.trim() && !/-->|^WEBVTT|^\d+$|^NOTE/.test(l.trim())).map(l => l.replace(/<[^>]+>/g, "").trim()))].join(" ").slice(0, 3000);
  const withSubs = items.filter(i => i._subs.length);
  for (let k = 0; k < withSubs.length; k += 4) {
    await Promise.all(withSubs.slice(k, k + 4).map(async i => {
      const lang = i._lang.slice(0, 2);
      const s = i._subs.find(x => x.LanguageCodeName?.startsWith(lang) && x.Source === "ASR") || i._subs.find(x => x.LanguageCodeName?.startsWith(lang)) || i._subs.find(x => /^(spa|es|eng|en)/.test(x.LanguageCodeName || "")) || i._subs[0];
      try { const r = await fetch(s.Url); if (r.ok) i.tr = vtt(await r.text()); } catch {}
    }));
    say(`Leyendo lo que se dice en los vídeos… <b>${Math.min(k + 4, withSubs.length)}</b> de ${withSubs.length}<br><small>No cambies de pestaña hasta que diga «Listo».</small>`);
    await wait(250);
  }
  for (const i of items) { delete i._subs; delete i._lang; }

  if (!err && items.length) {
    try { localStorage.setItem(KEY, JSON.stringify({ last: items[0].code, at: Date.now(), n: onlyNew ? prev.n + items.length : items.length })); } catch {}
  }
  if (!items.length) { close(err || (onlyNew ? "No hay favoritos nuevos desde la última vez." : "No he encontrado favoritos.")); return; }

  const blob = new Blob([JSON.stringify({ app: "guardados", src: "tiktok", v: 1, pulled_at: Date.now(), items })], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "guardados-tiktok-" + new Date().toISOString().slice(0, 10) + ".json";
  document.body.append(a); a.click(); a.remove();
  close(`Listo: <b>${items.length}</b> favoritos en <b>${a.download}</b>.` + (err ? ` (Se cortó antes del final: ${err})` : "") +
    `<br>Vuelve a Guardados y pulsa <b>Importar</b> hoy o mañana (las portadas de TikTok caducan en 2 días).`);
})();
