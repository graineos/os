// Calculs et conversions pour le lanceur et Quick Insert (sans eval).

export const formatNumber = (n, digits = 8) =>
  new Intl.NumberFormat("fr-FR", { maximumFractionDigits: digits }).format(Math.abs(n) < 1e-12 ? 0 : Number(n.toPrecision(12)));

/** Évalue une expression : + - × ÷ ^ %, parenthèses, virgule décimale. null si ce n'en est pas une. */
export function calculate(input) {
  const src = input.replace(/\s+/g, "").replace(/,/g, ".").replace(/[x×]/gi, "*").replace(/÷/g, "/").replace(/^=/, "");
  if (!/^[\d.+\-*/^%()]+$/.test(src) || !/\d/.test(src) || !/[+\-*/^%]/.test(src.replace(/^-/, ""))) return null;
  let i = 0;
  const peek = () => src[i];
  const number = () => {
    const m = /^\d*\.?\d+(e[+-]?\d+)?/i.exec(src.slice(i));
    if (!m) throw new Error();
    i += m[0].length;
    return parseFloat(m[0]);
  };
  const factor = () => {
    if (peek() === "-") return i++, -factor();
    if (peek() === "+") return i++, factor();
    let v;
    if (peek() === "(") {
      i++;
      v = expr();
      if (peek() !== ")") throw new Error();
      i++;
    } else v = number();
    if (peek() === "%") {
      i++;
      v /= 100;
    }
    if (peek() === "^") {
      i++;
      v = Math.pow(v, factor());
    }
    return v;
  };
  const term = () => {
    let v = factor();
    while (peek() === "*" || peek() === "/") {
      const op = src[i++];
      const r = factor();
      v = op === "*" ? v * r : v / r;
    }
    return v;
  };
  const expr = () => {
    let v = term();
    while (peek() === "+" || peek() === "-") {
      const op = src[i++];
      const r = term();
      v = op === "+" ? v + r : v - r;
    }
    return v;
  };
  try {
    const v = expr();
    return i === src.length && Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}

// Unités : [facteur vers l'unité de base, catégorie, nom affiché]
const U = {};
const add = (names, factor, cat, label) => names.forEach((n) => (U[n] = { factor, cat, label }));
add(["m", "metre", "metres", "mètre", "mètres"], 1, "long", "m");
add(["km", "kilometre", "kilometres", "kilomètre", "kilomètres"], 1000, "long", "km");
add(["cm", "centimetre", "centimetres"], 0.01, "long", "cm");
add(["mm"], 0.001, "long", "mm");
add(["mi", "mile", "miles"], 1609.344, "long", "miles");
add(["ft", "pied", "pieds", "feet"], 0.3048, "long", "pieds");
add(["in", "pouce", "pouces", "inch", "inches"], 0.0254, "long", "pouces");
add(["yd", "yard", "yards"], 0.9144, "long", "yards");
add(["kg", "kilo", "kilos"], 1, "mass", "kg");
add(["g", "gramme", "grammes"], 0.001, "mass", "g");
add(["mg"], 1e-6, "mass", "mg");
add(["t", "tonne", "tonnes"], 1000, "mass", "t");
add(["lb", "lbs", "livre", "livres", "pound", "pounds"], 0.45359237, "mass", "livres");
add(["oz", "once", "onces", "ounce"], 0.028349523125, "mass", "onces");
add(["l", "litre", "litres"], 1, "vol", "L");
add(["ml"], 0.001, "vol", "mL");
add(["cl"], 0.01, "vol", "cL");
add(["gal", "gallon", "gallons"], 3.785411784, "vol", "gallons");
add(["kmh", "km/h"], 1, "speed", "km/h");
add(["mph"], 1.609344, "speed", "mph");
add(["ms", "m/s"], 3.6, "speed", "m/s");
add(["o", "octet", "octets", "b"], 1, "data", "o");
add(["ko", "kb"], 1024, "data", "Ko");
add(["mo", "mb"], 1024 ** 2, "data", "Mo");
add(["go", "gb"], 1024 ** 3, "data", "Go");
add(["to", "tb"], 1024 ** 4, "data", "To");
const TEMP = { c: "°C", "°c": "°C", celsius: "°C", f: "°F", "°f": "°F", fahrenheit: "°F", k: "K", kelvin: "K" };

/** « 10 km en miles » → { text, value } ; null si ce n'est pas une conversion. */
export function convert(input) {
  const m = /^\s*(-?[\d.,]+)\s*([a-zà-ü°/²]+)\s+(?:en|to|in|vers|=|->|=>)\s+([a-zà-ü°/²]+)\s*$/i.exec(input);
  if (!m) return null;
  const value = parseFloat(m[1].replace(",", "."));
  const from = m[2].toLowerCase();
  const to = m[3].toLowerCase();
  if (!Number.isFinite(value)) return null;
  if (TEMP[from] && TEMP[to]) {
    const c = TEMP[from] === "°C" ? value : TEMP[from] === "°F" ? ((value - 32) * 5) / 9 : value - 273.15;
    const out = TEMP[to] === "°C" ? c : TEMP[to] === "°F" ? (c * 9) / 5 + 32 : c + 273.15;
    return { value: out, text: `${formatNumber(value)} ${TEMP[from]} = ${formatNumber(out, 2)} ${TEMP[to]}` };
  }
  const a = U[from];
  const b = U[to];
  if (!a || !b || a.cat !== b.cat) return null;
  const out = (value * a.factor) / b.factor;
  return { value: out, text: `${formatNumber(value)} ${a.label} = ${formatNumber(out, 4)} ${b.label}` };
}
