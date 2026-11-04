/**
 * Évaluation de Ruches Search sur un jeu de requêtes jugées à la main.
 *   bun ruches/search/eval.ts <dossier de l'index>
 * Les critères de pertinence ont été écrits AVANT de consulter les résultats.
 * Mesures : réussite@3 (au moins un bon résultat dans les 3 premiers), précision@5, MRR, temps de réponse.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { foldText, WebIndex, type WebResult } from "../src/core/websearch";

const dir = process.argv[2] ?? "public/ruches-index";
const has = (text: string, ...words: string[]) => words.every((w) => foldText(text).includes(foldText(w)));
const QUERIES: { q: string; ok: (r: WebResult) => boolean }[] = [
  { q: "passeport", ok: (r) => has(r.title, "passeport") },
  { q: "renouveler carte d'identité", ok: (r) => has(r.title, "carte", "identit") },
  { q: "déclaration de revenus", ok: (r) => has(r.title, "revenu") },
  { q: "révolution française", ok: (r) => has(r.title, "revolution") },
  { q: "intelligence artificielle", ok: (r) => has(r.title, "intelligence artificielle") },
  { q: "données personnelles RGPD", ok: (r) => r.host.includes("cnil") },
  { q: "taux de chômage", ok: (r) => has(r.title, "chomage") },
  { q: "allocations familiales", ok: (r) => has(r.title, "allocation") },
  { q: "musée du Louvre", ok: (r) => r.host.includes("louvre") || has(r.title, "louvre") },
  { q: "réchauffement climatique", ok: (r) => has(r.title, "clima") },
  { q: "inflation prix", ok: (r) => has(`${r.title} ${r.snippet}`, "inflation") },
  { q: "question prioritaire de constitutionnalité", ok: (r) => r.host.includes("conseil-constitutionnel") || has(r.title, "constitutionnalit") },
  { q: "vaccination grippe", ok: (r) => has(`${r.title}`, "grippe") || has(r.title, "vaccin") },
  { q: "Paris", ok: (r) => r.host.includes("wikipedia") && has(r.title, "paris") },
  { q: "cuisine française", ok: (r) => has(r.title, "cuisine") },
  { q: "recherche scientifique CNRS", ok: (r) => r.host.includes("cnrs") },
  { q: "carte topographique randonnée", ok: (r) => r.host.includes("ign") || has(r.title, "carte") },
  { q: "impôt sur le revenu", ok: (r) => has(r.title, "impot") || has(r.title, "revenu") },
  { q: "Angel Leclerc communication", ok: (r) => r.host.includes("angel-leclerc") },
  { q: "inscription demandeur d'emploi", ok: (r) => has(`${r.title} ${r.snippet}`, "inscri") && (r.host.includes("francetravail") || r.host.includes("service-public") || r.host.includes("travail")) },
];

const index = new WebIndex(dir, async (url) => JSON.parse(readFileSync(join(url), "utf8")));
let success = 0;
let precision = 0;
let mrr = 0;
const times: number[] = [];
const lines: string[] = [];
for (const { q, ok } of QUERIES) {
  const { results, ms, total } = await index.search(q, { limit: 10 });
  times.push(ms);
  const top5 = results.slice(0, 5);
  const firstGood = results.findIndex(ok);
  const p5 = top5.filter(ok).length / 5;
  if (firstGood >= 0 && firstGood < 3) success++;
  precision += p5;
  mrr += firstGood >= 0 ? 1 / (firstGood + 1) : 0;
  const cell = (t: string) => t.replace(/\|/g, "\\|");
  lines.push(`| ${q} | ${total} | ${firstGood >= 0 ? firstGood + 1 : "—"} | ${(p5 * 100).toFixed(0)} % | ${results[0] ? cell(`${results[0].title.slice(0, 60)} (${results[0].host})`) : "—"} |`);
}
const n = QUERIES.length;
times.sort((a, b) => a - b);
console.log(`| Requête | Pages trouvées | Rang du 1er bon | Précision@5 | 1er résultat |\n| --- | --- | --- | --- | --- |\n${lines.join("\n")}`);
console.log(`\nRéussite@3 : ${success}/${n} (${Math.round((success / n) * 100)} %) · Précision@5 moyenne : ${Math.round((precision / n) * 100)} % · MRR : ${(mrr / n).toFixed(2)} · temps médian : ${times[Math.floor(n / 2)]} ms (lecture disque, première requête incluse)`);
