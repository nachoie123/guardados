// "Abierto ahora" a partir del texto opening_hours de OpenStreetMap ("Mo-Fr 09:00-17:00; Sa 10:00-14:00").
// abierto(txt, fecha) -> true | false | null (null = no lo entiendo: la app no lo esconde).
// Solo entiende lo comun: dias (Mo-Fr, Sa,Su, Su-Th), horas (varios tramos, pasando de medianoche),
// 24/7 y off. Meses, semanas, amaneceres o "PH" -> null.
const DIA = { Mo: 1, Tu: 2, We: 3, Th: 4, Fr: 5, Sa: 6, Su: 0 };
const HORA = /^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/;

function dias(txt) {  // "Mo-Fr,Su" -> Set de 0..6, o null si no lo entiendo
  const s = new Set();
  for (const parte of txt.split(",")) {
    const m = parte.trim().match(/^([A-Z][a-z])(?:-([A-Z][a-z]))?$/);
    if (!m || !(m[1] in DIA) || (m[2] && !(m[2] in DIA))) return null;
    let d = DIA[m[1]];
    const fin = DIA[m[2] || m[1]];
    for (let n = 0; n < 8; n++) { s.add(d); if (d === fin) break; d = (d + 1) % 7; }
  }
  return s;
}
function tramos(txt) {  // "12:00-16:00,20:00-00:30" -> [[ini, fin]] en minutos
  const r = [];
  for (const t of txt.split(",")) {
    const m = t.trim().match(HORA);
    if (!m) return null;
    r.push([+m[1] * 60 + +m[2], +m[3] * 60 + +m[4]]);
  }
  return r;
}
export function abierto(txt, ahora = new Date()) {
  if (!txt) return null;
  const porDia = Array.from({ length: 7 }, () => null);  // tramos de cada dia; la regla de despues pisa a la de antes
  for (const regla of txt.split(";")) {
    const r = regla.trim();
    if (!r) continue;
    if (r === "24/7") return true;
    let ds, resto;
    const m = r.match(/^([A-Z][a-z](?:[-,]\s*[A-Z][a-z])*)\s+(.+)$/);
    if (m) { ds = dias(m[1]); resto = m[2]; } else { ds = new Set([0, 1, 2, 3, 4, 5, 6]); resto = r; }
    if (!ds) return null;
    const t = /^(off|closed)$/i.test(resto) ? [] : tramos(resto);
    if (!t) return null;
    for (const d of ds) porDia[d] = t;
  }
  const hoy = ahora.getDay(), min = ahora.getHours() * 60 + ahora.getMinutes();
  for (const [a, b] of porDia[hoy] || []) {
    if (a === b) return true;
    if (a < b ? min >= a && min < b : min >= a) return true;
  }
  for (const [a, b] of porDia[(hoy + 6) % 7] || []) if (b < a && min < b) return true;  // el de ayer que sigue tras medianoche
  return porDia.every(x => x === null) ? null : false;
}
