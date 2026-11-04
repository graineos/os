/**
 * Ruches Flow — repérage déterministe d'entités dans un texte (aucune IA, aucun réseau).
 * Ce qui est repéré devient des actions proposées : une date → un événement, une liste → une grille…
 * Règle d'or : on ne propose que ce qu'on a réellement reconnu ; rien n'est créé sans un geste explicite.
 */

export type DateEntity = { kind: "date"; text: string; start: number; allDay: boolean };
export type AmountEntity = { kind: "amount"; text: string; value: number };
export type EmailEntity = { kind: "email"; text: string };
export type UrlEntity = { kind: "url"; text: string };
export type Entity = DateEntity | AmountEntity | EmailEntity | UrlEntity;

const MONTHS: Record<string, number> = {
  janvier: 0, janv: 0, fevrier: 1, fevr: 1, fev: 1, mars: 2, avril: 3, avr: 3, mai: 4, juin: 5,
  juillet: 6, juil: 6, aout: 7, septembre: 8, sept: 8, sep: 8, octobre: 9, oct: 9, novembre: 10, nov: 10, decembre: 11, dec: 11,
};
const WEEKDAYS: Record<string, number> = { dimanche: 0, lundi: 1, mardi: 2, mercredi: 3, jeudi: 4, vendredi: 5, samedi: 6 };

const fold = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

// Heure facultative après une date : « à 14h », « 14h30 », « 14:30 », « à 9 h ».
const TIME = String.raw`(?:\s*(?:,\s*)?(?:a|vers|des)?\s*(\d{1,2})\s*(?:h|:)\s*(\d{2})?)?`;

function at(base: Date, day: number, month: number, year: number, hh?: string, mm?: string): { start: number; allDay: boolean } | null {
  if (month < 0 || month > 11 || day < 1 || day > 31) return null;
  const hours = hh !== undefined ? Number(hh) : 0;
  const minutes = mm !== undefined ? Number(mm) : 0;
  if (hours > 23 || minutes > 59) return null;
  const date = new Date(year, month, day, hours, minutes, 0, 0);
  if (date.getMonth() !== month) return null; // 31 avril, 30 février…
  void base;
  return { start: date.getTime(), allDay: hh === undefined };
}

/** Année implicite : la prochaine occurrence (« 12 mars » en décembre → mars de l'année suivante). */
function nextYear(now: Date, month: number, day: number) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return new Date(now.getFullYear(), month, day).getTime() < today ? now.getFullYear() + 1 : now.getFullYear();
}

export function detectDates(text: string, now = new Date()): DateEntity[] {
  const folded = fold(text);
  if (folded.length !== text.length) return []; // garde-fou : positions identiques entre les deux textes
  const out: (DateEntity & { index: number })[] = [];
  const push = (index: number, length: number, value: { start: number; allDay: boolean } | null) => {
    if (!value) return;
    if (out.some((e) => index < e.index + e.text.length && e.index < index + length)) return; // chevauchement
    out.push({ kind: "date", index, text: text.slice(index, index + length).trim(), ...value });
  };

  // « 12 mars 2027 », « 1er mars », « mardi 12 mars à 14h ».
  const longDate = new RegExp(String.raw`\b(?:(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\s+)?(\d{1,2})(?:er)?\s+(${Object.keys(MONTHS).join("|")})\.?(?:\s+(\d{4}))?\b${TIME}`, "g");
  for (const m of folded.matchAll(longDate)) {
    const month = MONTHS[m[2]];
    const day = Number(m[1]);
    const year = m[3] ? Number(m[3]) : nextYear(now, month, day);
    push(m.index ?? 0, m[0].length, at(now, day, month, year, m[4], m[5]));
  }
  // « 12/03/2027 », « 12-03-27 », « 12/03 ».
  // Sans année, seul « / » est accepté : « 3.5 » (une version) ou « 1-2 » (un intervalle) ne sont pas des dates.
  const numeric = new RegExp(String.raw`\b(\d{1,2})([/.-])(\d{1,2})(?:\2(\d{4}|\d{2}))?\b${TIME}`, "g");
  for (const m of folded.matchAll(numeric)) {
    if (!m[4] && m[2] !== "/") continue;
    const day = Number(m[1]);
    const month = Number(m[3]) - 1;
    const year = m[4] ? (m[4].length === 2 ? 2000 + Number(m[4]) : Number(m[4])) : nextYear(now, month, day);
    push(m.index ?? 0, m[0].length, at(now, day, month, year, m[5], m[6]));
  }
  // ISO « 2027-03-12 ».
  for (const m of folded.matchAll(new RegExp(String.raw`\b(\d{4})-(\d{2})-(\d{2})\b${TIME}`, "g")))
    push(m.index ?? 0, m[0].length, at(now, Number(m[3]), Number(m[2]) - 1, Number(m[1]), m[4], m[5]));
  // Relatif : « aujourd'hui », « demain », « après-demain », « lundi prochain », « vendredi ».
  const relative = new RegExp(String.raw`\b(aujourd'hui|apres-demain|demain|(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)(?:\s+prochain)?)\b${TIME}`, "g");
  for (const m of folded.matchAll(relative)) {
    const word = m[1];
    const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let offset = 0;
    if (word === "demain") offset = 1;
    else if (word === "apres-demain") offset = 2;
    else if (word !== "aujourd'hui") {
      const target = WEEKDAYS[word.split(/\s+/)[0]];
      offset = (target - base.getDay() + 7) % 7 || 7;
    }
    base.setDate(base.getDate() + offset);
    push(m.index ?? 0, m[0].length, at(now, base.getDate(), base.getMonth(), base.getFullYear(), m[2], m[3]));
  }
  return out.sort((a, b) => a.index - b.index).map(({ index: _index, ...entity }) => entity);
}

export function detectAmounts(text: string): AmountEntity[] {
  const out: AmountEntity[] = [];
  for (const m of text.matchAll(/(?:€\s*)?(\d{1,3}(?:[ \u00a0\u202f]\d{3})+|\d+)(?:[,.](\d{1,2}))?\s*(?:€|euros?\b|EUR\b)/gi)) {
    const value = Number(`${m[1].replace(/[ \u00a0\u202f]/g, "")}.${m[2] ?? "0"}`);
    if (Number.isFinite(value)) out.push({ kind: "amount", text: m[0].trim(), value });
  }
  return out;
}

export function detect(text: string, now = new Date()): Entity[] {
  const emails = [...text.matchAll(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g)].map((m) => ({ kind: "email" as const, text: m[0] }));
  const urls = [...text.matchAll(/\bhttps?:\/\/[^\s<>"')]+/g)].map((m) => ({ kind: "url" as const, text: m[0].replace(/[.,;:!?]+$/, "") }));
  return [...detectDates(text, now), ...detectAmounts(text), ...emails, ...urls];
}

/**
 * Une liste de lignes devient des lignes de tableau.
 * Séparateurs reconnus : tabulation, « ; », « | », « : » ou « - » entourés d'espaces. Les puces sont retirées.
 */
export function linesToRows(text: string): string[][] {
  const lines = text.split(/\r?\n/).map((l) => l.replace(/^\s*(?:[-*•–]|\d+[.)]|\[[ xX]\])\s+/, "").trim()).filter(Boolean);
  const seps = ["\t", ";", " | ", " : ", " - "];
  const sep = seps.find((s) => lines.filter((l) => l.includes(s)).length >= Math.ceil(lines.length / 2));
  return lines.map((l) => (sep ? l.split(sep).map((c) => c.trim()) : [l]));
}

/** Lignes de type case à cocher : « [ ] Appeler le traiteur » → tâches. */
export function detectTasks(text: string): { text: string; done: boolean }[] {
  return [...text.matchAll(/^\s*(?:[-*•]\s*)?\[( |x|X)\]\s+(.+)$/gm)].map((m) => ({ done: m[1] !== " ", text: m[2].trim() }));
}
