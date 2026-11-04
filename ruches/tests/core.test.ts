import { describe, expect, test } from "bun:test";
import { chunkBlob, SMALL, LARGE } from "../src/core/chunker";
import { csvToSheet, evaluateSheet, parseSheet, sheetToCsv } from "../src/core/sheet";
import { detect, detectDates, detectTasks, linesToRows } from "../src/core/detect";
import { MemoryStore } from "../src/core/store";
import { Vault } from "../src/core/vault";

const random = (n: number) => { const a = new Uint8Array(n); for (let i = 0; i < n; i += 65536) crypto.getRandomValues(a.subarray(i, Math.min(n, i + 65536))); return a; };
const hashes = async (u8: Uint8Array, p = SMALL) => { const out: string[] = []; for await (const c of chunkBlob(new Blob([u8]), p)) out.push(Buffer.from(await crypto.subtle.digest("SHA-256", c)).toString("hex")); return out; };
const open = (store = new MemoryStore()) => Vault.open("test", { store, broadcast: false });

describe("découpage par le contenu", () => {
  test("une insertion ne décale qu'une alvéole", async () => {
    const base = random(3_000_000);
    const edited = new Uint8Array(base.length + 50);
    edited.set(base.subarray(0, 1000)); edited.set(new Uint8Array(50).fill(7), 1000); edited.set(base.subarray(1000), 1050);
    const a = await hashes(base); const b = new Set(await hashes(edited));
    expect(a.filter((h) => b.has(h)).length).toBeGreaterThanOrEqual(a.length - 2);
  });
  test("le contenu est reconstitué à l'identique, même vide", async () => {
    const data = random(5_000_000); let total = 0;
    for await (const c of chunkBlob(new Blob([data]), LARGE)) total += c.length;
    expect(total).toBe(data.length);
    expect((await hashes(new Uint8Array(0))).length).toBe(0);
  });
});

describe("Grille", () => {
  const v = (cells: Record<string, string>) => evaluateSheet({ v: 1, cols: 5, rows: 5, cells });
  test("formules, cycles, erreurs", () => {
    const r = v({ A1: "10", A2: "20,5", A3: "=SOMME(A1:A2)", B1: "=B2", B2: "=B1", C1: "=1/0", C2: '="x"&A1', C3: "=sum(A1:A2)*10%" });
    expect(r.A3).toBe(30.5); expect(r.B1).toBe("#CYCLE"); expect(r.C1).toBe("#DIV/0"); expect(r.C2).toBe("x10"); expect(r.C3).toBeCloseTo(3.05);
  });
  test("SI n'évalue pas la branche non retenue", () => {
    expect(v({ A1: "0", B1: "=SI(A1<>0;1/A1;0)" }).B1).toBe(0);
    expect(v({ A1: "4", B1: "=SI(A1<>0;1/A1;0)" }).B1).toBe(0.25);
  });
  test("CSV et TSV", () => {
    expect(csvToSheet("a\tb\n1\t2").cells.B2).toBe("2");
    expect(csvToSheet("a;b\n1,5;2").cells.A2).toBe("1,5");
    expect(sheetToCsv(csvToSheet('a;b\n1;"2;3"'))).toBe('a;b\n1;"2;3"');
  });
});

describe("Flow : repérage déterministe", () => {
  const now = new Date(2026, 9, 13, 10, 0); // 13 octobre 2026
  test("dates en français", () => {
    const [d] = detectDates("Réunion le 12 mars à 14h30", now);
    expect(new Date(d.start)).toEqual(new Date(2027, 2, 12, 14, 30)); expect(d.allDay).toBe(false);
    expect(new Date(detectDates("le 1er novembre 2026", now)[0].start)).toEqual(new Date(2026, 10, 1));
    expect(new Date(detectDates("rendu le 15/10", now)[0].start)).toEqual(new Date(2026, 9, 15));
    expect(new Date(detectDates("demain 9h", now)[0].start)).toEqual(new Date(2026, 9, 14, 9, 0));
    expect(new Date(detectDates("lundi prochain", now)[0].start)).toEqual(new Date(2026, 9, 19));
    expect(detectDates("version 3.5 et 1-2 personnes, 31 avril", now)).toEqual([]);
  });
  test("montants, e-mails, liens, listes, cases", () => {
    const e = detect("Budget 1 250,50 € — écrire à jo@exemple.fr ou https://exemple.fr/a.", now);
    expect(e.find((x) => x.kind === "amount")).toMatchObject({ value: 1250.5 });
    expect(e.find((x) => x.kind === "email")?.text).toBe("jo@exemple.fr");
    expect(e.find((x) => x.kind === "url")?.text).toBe("https://exemple.fr/a");
    expect(linesToRows("- Pain ; 2\n- Lait ; 1")).toEqual([["Pain", "2"], ["Lait", "1"]]);
    expect(detectTasks("[ ] Appeler\n[x] Réserver")).toEqual([{ done: false, text: "Appeler" }, { done: true, text: "Réserver" }]);
  });
});

describe("Coffre", () => {
  test("doublons gratuits, versions, nettoyage", async () => {
    const store = new MemoryStore(); const vault = await open(store);
    const text = "Bonjour la ruche. ".repeat(2000);
    await vault.importFile(null, new File([text], "a.txt", { type: "text/plain" }));
    const before = vault.stats().physical;
    const b = await vault.importFile(null, new File([text], "a.txt", { type: "text/plain" }));
    expect(vault.stats().physical).toBe(before);
    expect(b.name).toBe("a (2).txt");
    const doc = await vault.createContent(null, "doc", "Doc", "<p>v1</p>".repeat(400), "v1");
    await vault.saveContent(doc.id, "<p>v1</p>".repeat(400) + "<p>fin</p>", "v2");
    expect(vault.node(doc.id)!.versions.length).toBe(2);
    await vault.restore(doc.id, 0);
    expect(vault.search("v1").length).toBe(1);
    await vault.trash(doc.id); await vault.purge([doc.id]);
    expect(vault.node(doc.id)).toBeUndefined();
    expect(store.size).toBeGreaterThan(0);
  });
  test("objets, espaces, migration v1", async () => {
    const store = new MemoryStore();
    await store.put("manifest.json", new TextEncoder().encode(JSON.stringify({ v: 1, nodes: { f: { id: "f", kind: "folder", name: "Ancien", parent: null, created: 1, updated: 1, versions: [] } }, stored: {} })));
    const vault = await open(store);
    expect(vault.node("f")?.name).toBe("Ancien");
    const space = await vault.createObject("space", "Mariage");
    const ev = await vault.createObject("event", "Traiteur", { start: Date.now(), place: "Lyon" }, [space.id]);
    const task = await vault.createObject("task", "Envoyer les faire-part", { done: false });
    await vault.toggleSpace(task.id, space.id);
    expect(vault.members(space.id).map((n) => n.id).sort()).toEqual([ev.id, task.id].sort());
    expect(vault.search("lyon")[0].node.id).toBe(ev.id);
    await vault.updateObject(task.id, { props: { done: true } });
    expect(vault.node(task.id)!.props!.done).toBe(true);
    await vault.trash(space.id); await vault.purge([space.id]);
    expect(vault.node(ev.id)!.spaces).toEqual([]);
  });
  test("capsule : aller-retour, intégrité, validation", async () => {
    const a = await open();
    const f = await a.importFile(null, new File([random(300_000)], "r.bin"));
    await a.createObject("task", "T", { due: 5 });
    const cap = await a.exportCapsule();
    const b = await open();
    await expect(b.importCapsule(cap.slice(0, cap.size - 3))).rejects.toThrow();
    expect(b.stats().cells).toBe(0);
    expect((await b.importCapsule(cap)).added).toBe(2);
    expect(new Uint8Array(await (await b.read(f.id)).arrayBuffer())).toEqual(new Uint8Array(await (await a.read(f.id)).arrayBuffer()));
    const header = new TextEncoder().encode(JSON.stringify({ v: 1, nodes: { x: { id: "x", kind: "evil", name: {}, versions: [] } } }));
    const len = new Uint8Array(4); new DataView(len.buffer).setUint32(0, header.length);
    expect((await b.importCapsule(new Blob([new TextEncoder().encode("RUCHE1\n"), len, header]))).added).toBe(0);
  });
});

describe("Revue : régressions", () => {
  const v = (cells: Record<string, string>) => evaluateSheet({ v: 1, cols: 5, rows: 5, cells });
  test("priorité de la puissance et texte commençant par #", () => {
    const r = v({ A1: "=-2^2", A2: "=2^-1", A3: "=2^3^2", B1: "#budget", B2: '=CONCAT(B1;" x")', B3: "=B1" });
    expect(r.A1).toBe(-4); expect(r.A2).toBe(0.5); expect(r.A3).toBe(512);
    expect(r.B2).toBe("#budget x"); expect(r.B3).toBe("#budget");
  });
  test("restauration : limite de versions, nom unique, capsule corrompue refusée", async () => {
    const vault = await open();
    const doc = await vault.createContent(null, "doc", "Rapport", "<p>0</p>", "0");
    await vault.saveContent(doc.id, "<p>1</p>", "1");
    for (let i = 0; i < 45; i++) await vault.restore(doc.id, 0);
    expect(vault.node(doc.id)!.versions.length).toBe(40);
    await vault.trash(doc.id);
    await vault.createContent(null, "doc", "Rapport", "<p>autre</p>", "autre");
    await vault.trash(doc.id, true);
    expect(vault.node(doc.id)!.name).toBe("Rapport (2)");
    const cap = new Uint8Array(await (await vault.exportCapsule()).arrayBuffer());
    cap[cap.length - 1] ^= 0xff;
    const other = await open();
    await expect(other.importCapsule(new Blob([cap]))).rejects.toThrow(/abîmée/);
    expect(other.stats().cells).toBe(0);
  });
});

import { decodePostings, DOCS_PER_SHARD, encodePostings, rank, shardOf, stem, terms, WebIndex, type DocRecord, type IndexManifest } from "../src/core/websearch";

describe("Ruches Search", () => {
  test("découpage : accents, mots vides, pluriels", () => {
    expect(terms("Les impôts sur le revenu des Français")).toEqual(["impot", "revenu", "francai"]);
    expect(stem("journaux")).toBe("journal");
    expect(terms("Demande de passeport")).toEqual(terms("demandes passeports"));
  });
  test("postings compacts réversibles", () => {
    const list: [number, number][] = [[0, 1], [35, 4], [1000, 1]];
    expect(decodePostings(encodePostings(list))).toEqual(list);
  });
  test("index statique : BM25, ET puis OU, explication, filtre par site", async () => {
    const pages = [
      ["https://a.fr/passeport", "Passeport : demande et renouvellement", "Comment demander un passeport en mairie."],
      ["https://a.fr/carte", "Carte d'identité", "Demande de carte nationale d'identité, délais en mairie."],
      ["https://b.fr/voyage", "Voyager à l'étranger", "Passeport ou carte d'identité selon le pays de destination."],
    ];
    const docs: DocRecord[] = [];
    const lengths: number[] = [];
    const postings = new Map<string, [number, number][]>();
    pages.forEach(([url, title, body], id) => {
      const tf = new Map<string, number>();
      for (const t of terms(title)) tf.set(t, (tf.get(t) ?? 0) + 3);
      for (const t of terms(body)) tf.set(t, (tf.get(t) ?? 0) + 1);
      for (const [t, n] of tf) postings.set(t, [...(postings.get(t) ?? []), [id, n]]);
      const len = terms(title).length * 3 + terms(body).length;
      lengths.push(len);
      docs.push([url, title, body, len, 0]);
    });
    const files: Record<string, unknown> = {};
    for (const [t, list] of postings) ((files[`t/${shardOf(t)}`] ??= {}) as Record<string, string>)[t] = encodePostings(list);
    files["d/0"] = docs;
    const manifest: IndexManifest = { v: 1, built: 0, docs: 3, avgLength: Math.round(lengths.reduce((a, b) => a + b) / 3), sites: [], shards: Object.keys(files).filter((k) => k.startsWith("t/")).map((k) => k.slice(2)), lengths: lengths.map((n) => n.toString(36)).join(",") };
    files.index = manifest;
    const index = new WebIndex("x", async (url) => { const key = url.slice(2).replace(/\.json$/, ""); if (!(key in files)) throw new Error("404"); return files[key]; });
    const r = await index.search("demande passeport");
    expect(r.results[0].url).toBe("https://a.fr/passeport");
    expect(r.results[0].explain.map((e) => e.term).sort()).toEqual(["demand", "passeport"]);
    expect(r.results[0].bonus.title).toBeGreaterThan(0);
    // Aucun document ne réunit tous les mots : bascule en OU plutôt que « rien ».
    expect((await index.search("passeport délais")).results.length).toBeGreaterThan(0);
    expect((await index.search("passeport", { host: "b.fr" })).results.map((x) => x.host)).toEqual(["b.fr"]);
    expect(DOCS_PER_SHARD).toBe(100);
    expect(rank([], new Map(), () => 1, { docs: 1, avgLength: 1 })).toEqual([]);
  });
});

describe("Revue 3 : régressions", () => {
  test("plage démesurée bornée, pas de gel", () => {
    const t = performance.now();
    const r = evaluateSheet({ v: 1, cols: 12, rows: 60, cells: { A1: "2", B1: "=SOMME(A1:A99999)", C1: "5", A2: "=SOMME(C1:ZZZ99999)" } });
    expect(r.A2).toBe(5); // C1:ZZZ99999 bornée à la feuille (C1:L60)
    expect(r.B1).toBe(7); // A1 + A2
    expect(performance.now() - t).toBeLessThan(500);
    expect(evaluateSheet({ v: 1, cols: 702, rows: 5000, cells: { B1: "=SOMME(A1:ZZZ5000)" } }).B1).toBe("#ERREUR");
  });
  test("une lecture du manifeste en échec n'écrase jamais le coffre", async () => {
    const store = new MemoryStore();
    const vault = await open(store);
    await vault.createFolder(null, "Important");
    const get = store.get.bind(store);
    store.get = async () => { throw new DOMException("disque indisponible", "NotReadableError"); };
    await expect(vault.createFolder(null, "Autre")).rejects.toThrow();
    store.get = get;
    const again = await open(store);
    expect(again.all().map((n) => n.name)).toEqual(["Important"]);
  });
  test("grille reçue : cellules hors dimensions écartées, export CSV borné", () => {
    const t = performance.now();
    const sheet = parseSheet(JSON.stringify({ v: 1, cols: 3, rows: 2, cells: { A1: "1", B2: "=A1*2", ZZZ99999: "x", "<b>": "y", C1: 5 } }));
    expect(Object.keys(sheet.cells).sort()).toEqual(["A1", "B2"]);
    expect(sheetToCsv(sheet)).toBe("1;\n;2");
    expect(sheetToCsv({ v: 1, cols: 2, rows: 2, cells: { A1: "1", ZZZ99999: "x" } })).toBe("1;\n;"); // bornée à 2 × 2, pas à ZZZ99999
    expect(parseSheet("pas du json").cells).toEqual({});
    // Cellules au-delà des dimensions déclarées (anciennes grilles) : conservées, dimensions agrandies.
    const cells: Record<string, string> = { C1: "=SOMME(B1:B70)" };
    for (let r = 1; r <= 100; r++) cells[`B${r}`] = "1";
    cells.N3 = "x";
    const grown = parseSheet(JSON.stringify({ v: 1, cols: 12, rows: 60, cells }));
    expect(Object.keys(grown.cells).length).toBe(102);
    expect([grown.cols, grown.rows]).toEqual([14, 100]);
    expect(evaluateSheet(grown).C1).toBe(70);
    expect(performance.now() - t).toBeLessThan(500);
  });
  test("budget de plage cumulé par formule (découper la plage ne le contourne pas)", () => {
    // 2 plages de 36 × 5 000 = 180 000 cellules chacune : chacune passe seule, pas les deux ensemble.
    const r = evaluateSheet({ v: 1, cols: 80, rows: 5000, cells: { C1: "4", B1: "=SOMME(C1:AL5000;AM1:BV5000)", B2: "=SOMME(C1:AL5000)", B3: "=B2+SOMME(C1:AL5000)" } });
    expect(r.B1).toBe("#ERREUR");
    expect(r.B2).toBe(4);
    expect(r.B3).toBe(8); // chaque formule a son propre budget, y compris celle qu'elle référence
    // Plafond pour toute la feuille : 40 formules de 180 000 cellules ne figent pas l'onglet.
    const many: Record<string, string> = { C1: "4" };
    for (let i = 1; i <= 40; i++) many[`B${i}`] = "=SOMME(C1:AL5000)";
    const t = performance.now();
    const m = evaluateSheet({ v: 1, cols: 80, rows: 5000, cells: many });
    expect(m.B1).toBe(4);
    expect(m.B40).toBe("#ERREUR");
    expect(performance.now() - t).toBeLessThan(3000);
  });
  test("capsule : reste partiel refusé, parents réparés, espace non copié", async () => {
    const a = await open();
    const folder = await a.createFolder(null, "Dossier");
    await a.createContent(folder.id, "doc", "Doc", "<p>x</p>", "x");
    const cap = new Uint8Array(await (await a.exportCapsule()).arrayBuffer());
    const b = await open();
    await expect(b.importCapsule(new Blob([cap, new Uint8Array(10)]))).rejects.toThrow(/incomplète/);
    expect(b.all().length).toBe(0);
    // Parent invalide : un élément rattaché à un document revient à la racine.
    const len = new DataView(cap.buffer).getUint32(7);
    const header = JSON.parse(new TextDecoder().decode(cap.slice(11, 11 + len)));
    const docId = Object.values(header.nodes as Record<string, { id: string; kind: string }>).find((n) => n.kind === "doc")!.id;
    header.nodes[folder.id].parent = docId;
    const h = new TextEncoder().encode(JSON.stringify(header));
    const u = new Uint8Array(4); new DataView(u.buffer).setUint32(0, h.length);
    await b.importCapsule(new Blob([cap.slice(0, 7), u, h, cap.slice(11 + len)]));
    expect(b.node(folder.id)!.parent).toBeNull();
    expect(b.node(docId)!.parent).toBe(folder.id);
    // Même identifiant sous deux clés : la capsule est refusée, rien n'est importé.
    const dup = JSON.parse(new TextDecoder().decode(cap.slice(11, 11 + len)));
    dup.nodes.copie = { ...dup.nodes[folder.id], name: "Autre" };
    const hd = new TextEncoder().encode(JSON.stringify(dup));
    const ud = new Uint8Array(4); new DataView(ud.buffer).setUint32(0, hd.length);
    const c = await open();
    await expect(c.importCapsule(new Blob([cap.slice(0, 7), ud, hd, cap.slice(11 + len)]))).rejects.toThrow(/deux fois/);
    expect(c.all().length).toBe(0);
  });
});
