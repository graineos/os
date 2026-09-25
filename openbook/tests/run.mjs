// Lance les trois parcours de la démo à la suite : npm test (démo lancée).
import { spawnSync } from "node:child_process";

let failed = false;
for (const file of ["etapes-1-3.mjs", "etapes-4-8.mjs", "v2.mjs", "v3.mjs"]) {
  console.log(`\n── ${file}`);
  const r = spawnSync(process.execPath, [new URL(file, import.meta.url).pathname], { stdio: "inherit" });
  if (r.status !== 0) failed = true;
}
process.exit(failed ? 1 : 0);
