// Marcador de Guardados: se pulsa en instagram.com con la sesion abierta y
// descarga guardados.json (caption, cuenta, fecha y enlace a la portada de cada
// post guardado). Nada sale del navegador: el fichero se importa a mano en la app.
// Es pull.js adaptado (misma API: /api/v1/feed/saved/posts/, el cajon general
// con TODO lo guardado). La app lo convierte en un enlace javascript: quitando
// las lineas de comentario, asi que dentro del codigo no hay comentarios.
// Para no parecer un robot ante Instagram: 1 s entre paginas, para en seco si
// responde 429 (demasiadas peticiones) y, si ya se uso antes, baja solo lo
// nuevo: recuerda en el localStorage de instagram.com el guardado mas reciente
// de la ultima vuelta completa y para al encontrarlo.
(async () => {
  if (!/(^|\.)instagram\.com$/.test(location.hostname)) {
    alert("Abre instagram.com con tu cuenta y vuelve a pulsar este marcador.");
    return;
  }
  const box = document.createElement("div");
  box.style.cssText = "position:fixed;z-index:2147483647;left:50%;top:16px;transform:translateX(-50%);" +
    "max-width:calc(100vw - 32px);padding:14px 18px;border-radius:14px;background:#1C1917;color:#FAFAF9;" +
    "font:15px/1.4 -apple-system,system-ui,sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.35)";
  document.body.append(box);
  const say = html => { box.innerHTML = html; };
  say("Leyendo tus guardados…");

  const pick = m => {
    const c = (m.image_versions2 || m.carousel_media?.[0]?.image_versions2 || {}).candidates || [];
    const ok = c.filter(x => x.width >= 320).sort((a, b) => a.width - b.width);
    return (ok[0] || c[0])?.url || null;
  };
  const slim = m => ({
    code: m.code, user: m.user?.username || "", name: m.user?.full_name || "",
    caption: m.caption?.text || "", taken_at: m.taken_at, type: m.media_type,
    plays: m.play_count || m.ig_play_count || 0, thumb: pick(m),
  });

  const H = { "X-IG-App-ID": "936619743392459" };
  const KEY = "guardados-marcador";
  let prev = null;
  try { prev = JSON.parse(localStorage.getItem(KEY)); } catch {}
  const onlyNew = !!prev?.last && confirm(`La última vez bajaste ${prev.n} guardados (${new Date(prev.at).toLocaleDateString()}).\n\nAceptar: solo los nuevos desde entonces (rápido).\nCancelar: todos otra vez.`);
  let max = "", items = [], pages = 0, err = "", reached = false;
  while (pages < 400) {
    let r;
    try {
      r = await fetch("/api/v1/feed/saved/posts/?count=50" + (max ? "&max_id=" + encodeURIComponent(max) : ""),
        { headers: H, credentials: "include" });
    } catch { err = "Sin conexión."; break; }
    if (r.status === 429) { err = "Instagram pide ir más despacio. Espera una hora antes de repetir."; break; }
    if (!r.ok) { err = r.status === 401 || r.status === 403 ? "Instagram no te reconoce: inicia sesión y repite." : "Instagram respondió " + r.status + "."; break; }
    const j = await r.json();
    for (const i of j.items || []) {
      const m = i.media || i;
      if (onlyNew && m?.code === prev.last) { reached = true; break; }
      if (m?.code) items.push(slim(m));
    }
    pages++;
    say(`Leyendo tus guardados… <b>${items.length}</b><br><small>No cambies de pestaña hasta que diga «Listo».</small>`);
    if (reached || !j.more_available || !j.next_max_id) break;
    max = j.next_max_id;
    await new Promise(r => setTimeout(r, 1000));
  }
  if (!err && items.length) {
    try { localStorage.setItem(KEY, JSON.stringify({ last: items[0].code, at: Date.now(), n: onlyNew ? prev.n + items.length : items.length })); } catch {}
  }
  if (!items.length) { say((err || (onlyNew ? "No hay guardados nuevos desde la última vez." : "No he encontrado guardados.")) + ' <button id="gx">Cerrar</button>'); box.querySelector("#gx").onclick = () => box.remove(); return; }

  const blob = new Blob([JSON.stringify({ app: "guardados", v: 1, pulled_at: Date.now(), items })], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "guardados-" + new Date().toISOString().slice(0, 10) + ".json";
  document.body.append(a); a.click(); a.remove();
  say(`Listo: <b>${items.length}</b> guardados en <b>${a.download}</b>.` + (err ? ` (Se cortó antes del final: ${err})` : "") +
    `<br>Vuelve a Guardados y pulsa <b>Importar</b> antes de 4 días (las portadas caducan). ` +
    `<button id="gx" style="margin-left:6px;font:inherit;padding:2px 10px;border-radius:8px;border:0">OK</button>`);
  box.querySelector("#gx").onclick = () => box.remove();
})();
