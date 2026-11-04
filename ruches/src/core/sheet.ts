/**
 * Grille — moteur de calcul des feuilles de la Ruche.
 * Formules en français ou en anglais : =SOMME(A1:A5), =MOYENNE(B2:B9), =SI(A1>10;"oui";"non")…
 */

export type SheetData = { v: 1; cols: number; rows: number; cells: Record<string, string> };
export type CellValue = number | string | boolean;

/** Seules ces valeurs sont des erreurs de calcul ; un texte saisi comme « #budget » reste du texte. */
const ERRORS = new Set(["#CYCLE", "#DIV/0", "#ERREUR"]);
export const isError = (v: CellValue | undefined): v is string => typeof v === "string" && ERRORS.has(v);

const MAX_RANGE = 200_000;
/** Toutes formules confondues, une évaluation de feuille ne parcourt pas plus de 2 millions de cellules. */
const MAX_SHEET_WORK = 2_000_000;
export const MAX_COLS = 702;
export const MAX_ROWS = 5000;

export const emptySheet = (): SheetData => ({ v: 1, cols: 12, rows: 60, cells: {} });

export function colName(index: number) {
  let name = "";
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
  return name;
}

export function parseRef(ref: string): { col: number; row: number } | null {
  const match = /^\$?([A-Z]{1,3})\$?(\d{1,5})$/.exec(ref.toUpperCase());
  if (!match) return null;
  let col = 0;
  for (const ch of match[1]) col = col * 26 + (ch.charCodeAt(0) - 64);
  return { col: col - 1, row: Number(match[2]) - 1 };
}

export const cellId = (col: number, row: number) => `${colName(col)}${row + 1}`;

class FormulaError extends Error {}

type Token = { t: "num" | "str" | "ref" | "range" | "fn" | "op" | "(" | ")" | "sep"; v: string };

function tokenize(src: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (/\s/.test(ch)) { i++; continue; }
    if (ch === '"') {
      const end = src.indexOf('"', i + 1);
      if (end < 0) throw new FormulaError("guillemet");
      out.push({ t: "str", v: src.slice(i + 1, end) });
      i = end + 1;
      continue;
    }
    const num = /^\d+(\.\d+)?/.exec(src.slice(i));
    if (num) { out.push({ t: "num", v: num[0] }); i += num[0].length; continue; }
    const word = /^\$?[A-Za-z_][A-Za-z0-9_.$]*(:\$?[A-Za-z]{1,3}\$?\d{1,5})?/.exec(src.slice(i));
    if (word) {
      const w = word[0];
      i += w.length;
      if (w.includes(":")) out.push({ t: "range", v: w.toUpperCase() });
      else if (src[i] === "(") out.push({ t: "fn", v: w.toUpperCase() });
      else if (parseRef(w)) out.push({ t: "ref", v: w.toUpperCase() });
      else if (/^(VRAI|TRUE|FAUX|FALSE)$/i.test(w)) out.push({ t: "num", v: /^(VRAI|TRUE)$/i.test(w) ? "1" : "0" });
      else throw new FormulaError("nom");
      continue;
    }
    const op = /^(<=|>=|<>|[-+*/^&=<>%])/.exec(src.slice(i));
    if (op) { out.push({ t: "op", v: op[0] }); i += op[0].length; continue; }
    if (ch === "(" || ch === ")") { out.push({ t: ch, v: ch }); i++; continue; }
    if (ch === ";" || ch === ",") { out.push({ t: "sep", v: ch }); i++; continue; }
    throw new FormulaError("caractère");
  }
  return out;
}

const toNum = (v: CellValue | CellValue[]): number => {
  if (Array.isArray(v)) throw new FormulaError("plage");
  if (typeof v === "number") return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (v === "") return 0;
  const n = Number(v.replace(",", "."));
  if (Number.isNaN(n)) throw new FormulaError("valeur");
  return n;
};
const flat = (args: (CellValue | CellValue[])[]) => args.flatMap((a) => (Array.isArray(a) ? a : [a]));
const nums = (args: (CellValue | CellValue[])[]) => flat(args).filter((v) => typeof v === "number" || (typeof v === "string" && v !== "" && !Number.isNaN(Number(v.replace(",", "."))))).map(toNum);

const FUNCS: Record<string, (args: (CellValue | CellValue[])[]) => CellValue> = {
  SOMME: (a) => nums(a).reduce((x, y) => x + y, 0),
  MOYENNE: (a) => { const n = nums(a); if (!n.length) throw new FormulaError("div0"); return n.reduce((x, y) => x + y, 0) / n.length; },
  MIN: (a) => (nums(a).length ? Math.min(...nums(a)) : 0),
  MAX: (a) => (nums(a).length ? Math.max(...nums(a)) : 0),
  NB: (a) => nums(a).length,
  NBVAL: (a) => flat(a).filter((v) => v !== "").length,
  SI: (a) => (toNum(a[0] ?? 0) ? (a[1] as CellValue) ?? true : (a[2] as CellValue) ?? false),
  ARRONDI: (a) => { const p = 10 ** toNum(a[1] ?? 0); return Math.round(toNum(a[0] ?? 0) * p) / p; },
  ABS: (a) => Math.abs(toNum(a[0] ?? 0)),
  RACINE: (a) => Math.sqrt(toNum(a[0] ?? 0)),
  CONCAT: (a) => flat(a).map(String).join(""),
  MAJUSCULE: (a) => String(a[0] ?? "").toUpperCase(),
  MINUSCULE: (a) => String(a[0] ?? "").toLowerCase(),
  NBCAR: (a) => String(a[0] ?? "").length,
  ET: (a) => flat(a).every((v) => toNum(v) !== 0),
  OU: (a) => flat(a).some((v) => toNum(v) !== 0),
};
const ALIASES: Record<string, string> = { SUM: "SOMME", AVERAGE: "MOYENNE", COUNT: "NB", COUNTA: "NBVAL", IF: "SI", ROUND: "ARRONDI", SQRT: "RACINE", UPPER: "MAJUSCULE", LOWER: "MINUSCULE", LEN: "NBCAR", AND: "ET", OR: "OU", CONCATENER: "CONCAT" };
export const FUNCTION_NAMES = Object.keys(FUNCS);

/** Évalue toute la feuille ; renvoie la valeur affichable de chaque cellule non vide. */
export function evaluateSheet(sheet: SheetData): Record<string, CellValue> {
  const cache = new Map<string, CellValue>();
  const visiting = new Set<string>();
  let budget = MAX_RANGE;
  let work = MAX_SHEET_WORK;

  const valueOf = (id: string): CellValue => {
    const key = id.replace(/\$/g, "");
    if (cache.has(key)) return cache.get(key) as CellValue;
    if (visiting.has(key)) throw new FormulaError("cycle");
    const raw = sheet.cells[key] ?? "";
    let value: CellValue;
    if (raw.startsWith("=")) {
      visiting.add(key);
      // Chaque formule dispose de son propre budget de cellules, cumulé sur toutes ses plages :
      // découper une plage géante en morceaux (=SOMME(A1:AM5000;AN1:BZ5000;…)) ne le contourne pas.
      const outer = budget;
      budget = MAX_RANGE;
      try {
        value = evalFormula(raw.slice(1));
      } catch (error) {
        value = error instanceof FormulaError && error.message === "cycle" ? "#CYCLE" : error instanceof FormulaError && error.message === "div0" ? "#DIV/0" : "#ERREUR";
      } finally {
        visiting.delete(key);
        budget = outer;
      }
    } else {
      const trimmed = raw.trim();
      const n = trimmed !== "" && /^-?\d+([.,]\d+)?$/.test(trimmed) ? Number(trimmed.replace(",", ".")) : NaN;
      value = Number.isNaN(n) ? raw : n;
    }
    cache.set(key, value);
    return value;
  };

  const rangeValues = (range: string): CellValue[] => {
    const [a, b] = range.split(":").map(parseRef);
    if (!a || !b) throw new FormulaError("plage");
    // Bornée à la feuille (au-delà, tout est vide) et au budget de 200 000 cellules de la formule :
    // une plage démesurée (=SOMME(A1:ZZZ99999)) ne peut pas figer le navigateur.
    const r0 = Math.min(a.row, b.row);
    const c0 = Math.min(a.col, b.col);
    const r1 = Math.min(Math.max(a.row, b.row), sheet.rows - 1);
    const c1 = Math.min(Math.max(a.col, b.col), sheet.cols - 1);
    if (r1 >= r0 && c1 >= c0) {
      const size = (r1 - r0 + 1) * (c1 - c0 + 1);
      budget -= size;
      work -= size;
      if (budget < 0 || work < 0) throw new FormulaError("plage");
    }
    const out: CellValue[] = [];
    for (let r = r0; r <= r1; r++)
      for (let c = c0; c <= c1; c++) {
        const v = valueOf(cellId(c, r));
        if (isError(v)) throw new FormulaError(v === "#CYCLE" ? "cycle" : v === "#DIV/0" ? "div0" : "valeur");
        out.push(v);
      }
    return out;
  };

  const evalFormula = (src: string): CellValue => {
    const tokens = tokenize(src);
    let pos = 0;
    // Branche non retenue d'un SI : on la lit sans la calculer (=SI(A1<>0;1/A1;0) ne doit pas échouer).
    let skip = 0;
    const num = (v: CellValue | CellValue[]) => (skip ? 0 : toNum(v));
    const peek = () => tokens[pos];
    const next = () => tokens[pos++];
    const expect = (t: Token["t"]) => { if (peek()?.t !== t) throw new FormulaError("syntaxe"); return next(); };
    const checkErr = (v: CellValue) => { if (isError(v)) throw new FormulaError(v === "#CYCLE" ? "cycle" : v === "#DIV/0" ? "div0" : "valeur"); return v; };

    const compare = (): CellValue => {
      let left = concatExpr();
      while (peek()?.t === "op" && ["=", "<>", "<", ">", "<=", ">="].includes(peek().v)) {
        const op = next().v;
        const right = concatExpr();
        const [l, r] = typeof left === "number" && typeof right === "number" ? [left, right] : [String(left).toLowerCase(), String(right).toLowerCase()];
        left = op === "=" ? l === r : op === "<>" ? l !== r : op === "<" ? l < r : op === ">" ? l > r : op === "<=" ? l <= r : l >= r;
      }
      return left;
    };
    const concatExpr = (): CellValue => {
      let left = additive();
      while (peek()?.t === "op" && peek().v === "&") { next(); left = `${left}${additive()}`; }
      return left;
    };
    const additive = (): CellValue => {
      let left = term();
      while (peek()?.t === "op" && (peek().v === "+" || peek().v === "-")) {
        const op = next().v;
        const right = term();
        left = op === "+" ? num(left) + num(right) : num(left) - num(right);
      }
      return left;
    };
    const term = (): CellValue => {
      let left = unary();
      while (peek()?.t === "op" && (peek().v === "*" || peek().v === "/")) {
        const op = next().v;
        const right = num(unary());
        if (op === "/" && right === 0 && !skip) throw new FormulaError("div0");
        left = op === "*" ? num(left) * right : skip ? 0 : num(left) / right;
      }
      return left;
    };
    // Priorités usuelles des tableurs : -2^2 = -4 (la puissance avant le signe), 2^-1 = 0,5, 2^3^2 = 2^9.
    const unary = (): CellValue => {
      if (peek()?.t === "op" && (peek().v === "-" || peek().v === "+")) { const op = next().v; const v = num(unary()); return op === "-" ? -v : v; }
      return power();
    };
    const power = (): CellValue => {
      const base = postfix();
      if (peek()?.t === "op" && peek().v === "^") { next(); return num(base) ** num(unary()); }
      return base;
    };
    const postfix = (): CellValue => {
      const v = primary();
      if (peek()?.t === "op" && peek().v === "%") { next(); return num(v) / 100; }
      return v;
    };
    const argument = (): CellValue | CellValue[] => (peek()?.t === "range" ? (skip ? (next(), []) : rangeValues(next().v)) : compare());
    const primary = (): CellValue => {
      const tok = next();
      if (!tok) throw new FormulaError("syntaxe");
      if (tok.t === "num") return Number(tok.v);
      if (tok.t === "str") return tok.v;
      if (tok.t === "ref") return skip ? 0 : checkErr(valueOf(tok.v));
      if (tok.t === "(") { const v = compare(); expect(")"); return v; }
      if (tok.t === "fn") {
        const name = ALIASES[tok.v] ?? tok.v;
        const fn = FUNCS[name];
        if (!fn) throw new FormulaError("nom");
        expect("(");
        if (name === "SI") {
          const condition = skip ? 0 : toNum(compare());
          const branch = (take: boolean): CellValue => {
            if (take) return argument() as CellValue;
            skip++;
            try { argument(); } finally { skip--; }
            return 0;
          };
          let chosen: CellValue = condition ? true : false;
          if (peek()?.t === "sep") { next(); const yes = branch(!!condition); if (condition) chosen = yes; }
          if (peek()?.t === "sep") { next(); const no = branch(!condition); if (!condition) chosen = no; }
          expect(")");
          return skip ? 0 : chosen;
        }
        const args: (CellValue | CellValue[])[] = [];
        if (peek()?.t !== ")") {
          args.push(argument());
          while (peek()?.t === "sep") { next(); args.push(argument()); }
        }
        expect(")");
        return skip ? 0 : fn(args);
      }
      throw new FormulaError("syntaxe");
    };

    const result = compare();
    if (pos !== tokens.length) throw new FormulaError("syntaxe");
    return typeof result === "number" && !Number.isFinite(result) ? "#ERREUR" : result;
  };

  const out: Record<string, CellValue> = {};
  for (const id of Object.keys(sheet.cells)) if (sheet.cells[id] !== "") out[id] = valueOf(id);
  return out;
}

export function formatValue(value: CellValue | undefined) {
  if (value === undefined) return "";
  if (typeof value === "boolean") return value ? "VRAI" : "FAUX";
  if (typeof value === "number") return Number.isInteger(value) ? value.toLocaleString("fr-FR") : value.toLocaleString("fr-FR", { maximumFractionDigits: 10 });
  return value;
}

/** Texte indexé pour la recherche locale. */
export function sheetText(sheet: SheetData) {
  return Object.values(sheet.cells).filter((v) => v && !v.startsWith("=")).join(" ");
}

/**
 * Lit une grille enregistrée (elle peut venir d'une capsule reçue) : cellules texte uniquement, dans la
 * limite de 702 colonnes × 5 000 lignes. Les dimensions sont agrandies pour couvrir chaque cellule
 * conservée (une grille plus ancienne peut avoir des cellules au-delà de ses dimensions déclarées :
 * on ne les perd jamais). Contenu illisible → feuille vide.
 */
export function parseSheet(raw: string): SheetData {
  try {
    const data = JSON.parse(raw) as SheetData;
    if (data && data.v === 1 && data.cells && typeof data.cells === "object") {
      const dim = (value: unknown, fallback: number, max: number) => (Number.isInteger(value) && (value as number) > 0 ? Math.min(value as number, max) : fallback);
      let cols = dim(data.cols, 12, MAX_COLS);
      let rows = dim(data.rows, 60, MAX_ROWS);
      const cells: Record<string, string> = {};
      for (const [key, value] of Object.entries(data.cells)) {
        const ref = typeof value === "string" && /^[A-Z]{1,3}\d{1,5}$/.test(key) ? parseRef(key) : null;
        if (!ref || ref.col >= MAX_COLS || ref.row >= MAX_ROWS) continue;
        cells[key] = value;
        cols = Math.max(cols, ref.col + 1);
        rows = Math.max(rows, ref.row + 1);
      }
      return { v: 1, cols, rows, cells };
    }
  } catch {
    /* contenu illisible : feuille vide */
  }
  return emptySheet();
}

export function sheetToCsv(sheet: SheetData) {
  const values = evaluateSheet(sheet);
  let maxRow = -1;
  let maxCol = -1;
  for (const id of Object.keys(values)) {
    const ref = parseRef(id);
    if (ref) { maxRow = Math.max(maxRow, ref.row); maxCol = Math.max(maxCol, ref.col); }
  }
  // Jamais au-delà des dimensions de la feuille, même si une clé de cellule les dépasse.
  maxRow = Math.min(maxRow, sheet.rows - 1);
  maxCol = Math.min(maxCol, sheet.cols - 1);
  const lines: string[] = [];
  for (let r = 0; r <= maxRow; r++) {
    const row: string[] = [];
    for (let c = 0; c <= maxCol; c++) {
      const v = values[cellId(c, r)];
      const text = v === undefined ? "" : typeof v === "number" ? String(v) : formatValue(v);
      row.push(/[";\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text);
    }
    lines.push(row.join(";"));
  }
  return lines.join("\n");
}

export function csvToSheet(csv: string): SheetData {
  const firstLine = csv.split("\n", 1)[0] ?? "";
  const count = (ch: string) => firstLine.split(ch).length - 1;
  const sep = count("\t") > 0 && count("\t") >= count(";") && count("\t") >= count(",") ? "\t" : count(";") >= count(",") ? ";" : ",";
  const sheet = emptySheet();
  let row = 0;
  let col = 0;
  let field = "";
  let quoted = false;
  const push = () => { if (field !== "") sheet.cells[cellId(col, row)] = field; field = ""; };
  for (let i = 0; i < csv.length && row < 5000; i++) {
    const ch = csv[i];
    if (quoted) {
      if (ch === '"' && csv[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) { push(); col++; }
    else if (ch === "\n") { push(); row++; col = 0; }
    else if (ch !== "\r") field += ch;
  }
  push();
  let maxCol = 0;
  for (const id of Object.keys(sheet.cells)) maxCol = Math.max(maxCol, parseRef(id)?.col ?? 0);
  sheet.rows = Math.max(sheet.rows, row + 10);
  sheet.cols = Math.min(Math.max(sheet.cols, maxCol + 3), 702);
  return sheet;
}
