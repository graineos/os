// Regénère src/vendor/mcu.js : un seul fichier ESM minifié contenant
// uniquement ce qu'OpenBook utilise de @material/material-color-utilities.
// L'app elle-même n'a pas de bundler ; ce script ne sert qu'à vendoriser.
import { build } from "esbuild";

await build({
  stdin: {
    contents:
      "export { argbFromHex, argbFromRgb, hexFromArgb, Hct, SchemeTonalSpot, MaterialDynamicColors, QuantizerCelebi, Score } from '@material/material-color-utilities';",
    resolveDir: process.cwd(),
    loader: "js",
  },
  bundle: true,
  format: "esm",
  minify: true,
  legalComments: "inline",
  outfile: "src/vendor/mcu.js",
});
console.log("src/vendor/mcu.js généré");
