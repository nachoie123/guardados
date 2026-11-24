// Titulo + categorias SIN IA, en el navegador: port de rules.py (rule_title,
// categorize, categorize_multi) y de categories.py (secundarias con >= 3
// palabras clave). Las listas vienen de rules-data.json, que escribe
// rules.py: una sola fuente. tools/parity.mjs comprueba que sale lo mismo.

const MIN_HITS = 3;  // igual que categories.py
// como \w de Python: letras, numeros y _ (sin marcas combinadas)
const HASHTAG = /#[\p{L}\p{N}_]+/gu;
const MENTION = /@[\p{L}\p{N}_]+/gu;
const URL_RE = /https?:\/\/\S+/g;
const SENT = /^(.{20,140}?[.!?])(\s|$)/u;

const len = s => Array.from(s).length;  // como len() de Python: por caracter, no por unidad UTF-16
const squash = s => (s || "").split(/\s+/).filter(Boolean).join(" ");
const count = (blob, kw) => blob.split(kw).length - 1;  // str.count: sin solaparse

export function makeRules(data) {
  const KW = data.kw, FIABLE = new Set(data.fiable);
  let RUIDO;
  try { RUIDO = new RegExp(data.ruido.replace(/\\"/g, '"'), "iu"); }
  catch { RUIDO = new RegExp(data.ruido, "i"); }

  // signos -> espacio antes de contar (rules.SEP_RE): "#anime" casa con " anime"
  const SEP = new RegExp((data.sep || "[#]").replace(/\\"/g, '"'), "gu");
  const scores = (...texts) => {
    const blob = ` ${texts.map(t => t || "").join(" ").toLowerCase().replace(SEP, " ")} `;
    return Object.entries(KW).map(([c, kws]) => [c, kws.reduce((n, k) => n + count(blob, k), 0)]);
  };

  function categorize(...texts) {
    let best = null;
    for (const [c, n] of scores(...texts)) if (n && (!best || n > best[1])) best = [c, n];
    return best || ["otros", 0];
  }

  function categorizeMulti(...texts) {
    const s = scores(...texts).filter(([, n]) => n).sort((a, b) => b[1] - a[1]);
    if (!s.length) return [];
    const top = s[0][1];
    return [s[0], ...s.slice(1).filter(([, n]) => n >= 2 && n >= 0.4 * top)];
  }

  const limpiar = cap => squash((cap || "").replace(HASHTAG, "").replace(MENTION, "").replace(URL_RE, ""));
  const esRuido = (t, crudo = "") => !t || RUIDO.test(t) || (len(crudo) > 40 && len(t) < 0.3 * len(crudo));

  // rules.rule_title sin el idioma del audio (en el navegador no hay transcripcion)
  function ruleTitle(caption, transcript = "", username = "") {
    const [cat] = categorize(caption, transcript, username);
    const tr = squash(transcript), cap = limpiar(caption);
    const trOk = len(tr) >= 25 && !esRuido(tr);
    const capOk = len(cap) >= 25 && !esRuido(cap, caption || "");
    let fuente = "";
    if (FIABLE.has(cat) && capOk && categorize(cap)[1] > 0) fuente = cap;
    else if (trOk) fuente = tr;
    else if (capOk) fuente = cap;
    if (!fuente) return [null, cat];
    const m = fuente.match(SENT);
    if (m) return [m[1].trim(), cat];
    const cut = Array.from(fuente).slice(0, 100).join("");
    const sp = cut.lastIndexOf(" ");
    return [sp < 0 ? cut : cut.slice(0, sp), cat];
  }

  // Cuando las reglas no dan titulo (caption corto, de relleno o solo
  // hashtags): la primera frase del caption limpio que no sea cebo ("comenta X
  // y te lo mando"); si no hay ninguna, el caption limpio; si ni eso, la cuenta.
  function fallbackTitle(caption, username = "") {
    const cap = limpiar(caption);
    const frases = cap.split(/(?<=[.!?])\s+/).filter(f => len(f) >= 12 && !RUIDO.test(f));
    const t = frases[0] || cap;
    if (t) return len(t) > 90 ? Array.from(t).slice(0, 90).join("").replace(/\s+\S*$/, "") + "…" : t;
    return username ? `Post de @${username}` : "Post guardado";
  }

  // lo que la app necesita de un post: titulo y categorias (principal delante).
  // title es el de rules.py (null si no lo hay); display nunca esta vacio.
  function label(caption, transcript = "", username = "") {
    const [title, primary] = ruleTitle(caption, transcript, username);
    const cats = [primary];
    if (primary !== "otros") {
      for (const [c, n] of categorizeMulti(caption, transcript)) if (c !== primary && n >= MIN_HITS) cats.push(c);
    }
    return { title, cats, display: title || fallbackTitle(caption, username) };
  }

  return { categorize, categorizeMulti, ruleTitle, label, fallbackTitle, kw: KW };
}
