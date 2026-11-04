import { describe, expect, test } from "bun:test";
import { assembler, canonique, decouper, nouvellePlan, resoudreNoms, type Json } from "../src/web/alveoles";

const page: Json = {
  titre: "Essai",
  blocs: [
    { type: "texte", texte: "Bonjour" },
    { type: "cartes", cartes: [{ nom: "A", lien: { href: "/a" } }, { nom: "A", lien: { href: "/a" } }] },
  ],
};

describe("moteur web en alvéoles", () => {
  test("canonique ne dépend pas de l'ordre des clés", () => {
    expect(canonique({ b: 1, a: [2, { d: 3, c: 4 }] })).toBe(canonique({ a: [2, { c: 4, d: 3 }], b: 1 }));
  });

  test("découper puis assembler redonne exactement le contenu", async () => {
    const store = new Map<string, string>();
    const racine = await decouper(page, store);
    const { contenu, stats } = await assembler(racine, (h) => store.get(h));
    expect(contenu).toEqual(page);
    // la carte en double n'est stockée qu'une fois
    expect(store.size).toBe(4);
    expect(stats.uniques).toBe(4);
    expect(stats.blocs).toBe(5);
  });

  test("même contenu, même empreinte ; contenu modifié, nouvelle racine sans toucher aux autres alvéoles", async () => {
    const s1 = new Map<string, string>();
    const r1 = await decouper(page, s1);
    const r1bis = await decouper(structuredClone(page), new Map());
    expect(r1bis).toBe(r1);
    const modifiee = structuredClone(page) as { blocs: { texte?: string }[] };
    modifiee.blocs[0].texte = "Bonsoir";
    const s2 = new Map<string, string>();
    const r2 = await decouper(modifiee as Json, s2);
    expect(r2).not.toBe(r1);
    const communes = [...s2.keys()].filter((h) => s1.has(h));
    expect(communes.length).toBe(2); // les deux cartes (identiques) et le bloc cartes sont réutilisés
  });

  test("une alvéole altérée est refusée", async () => {
    const store = new Map<string, string>();
    const racine = await decouper(page, store);
    const [h] = [...store.keys()].filter((k) => k !== racine);
    store.set(h, store.get(h)!.replace("A", "B").replace("Bonjour", "Pirate"));
    await expect(assembler(racine, (x) => store.get(x))).rejects.toThrow(/altérée/);
  });

  test("alvéoles vivantes : une modification se propage à toutes les pages", async () => {
    const partagees: Record<string, Json> = { contact: { label: "Contact", href: "/c" } };
    const p1: Json = { blocs: [{ $nom: "contact" }] };
    const p2: Json = { blocs: [{ type: "x" }, { $nom: "contact" }] };
    const r = await assembler(await decouper(resoudreNoms(p2, partagees), new Map([])), () => undefined).catch(() => null);
    expect(r).toBeNull(); // store vide : assemblage impossible, rien n'est inventé
    const store = new Map<string, string>();
    const a1 = await assembler(await decouper(resoudreNoms(p1, partagees), store), (h) => store.get(h));
    expect((a1.contenu as { blocs: { label: string }[] }).blocs[0].label).toBe("Contact");
    partagees.contact = { label: "Écrivez-moi", href: "/c" };
    const a2 = await assembler(await decouper(resoudreNoms(p2, partagees), store), (h) => store.get(h));
    expect((a2.contenu as { blocs: { label?: string }[] }).blocs[1].label).toBe("Écrivez-moi");
    expect(() => resoudreNoms({ blocs: [{ $nom: "absente" }] }, partagees)).toThrow(/inconnue/);
  });

  test("le plan n'ajoute une version que si la racine change", () => {
    const v1 = nouvellePlan("s/p", "aa", undefined, "2026-11-04");
    expect(nouvellePlan("s/p", "aa", v1, "2026-11-05")).toBe(v1);
    expect(nouvellePlan("s/p", "bb", v1, "2026-11-05").historique.length).toBe(2);
  });
});
