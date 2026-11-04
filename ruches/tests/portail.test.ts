import { describe, expect, test } from "bun:test";
import { bangHints, engineUrl, instantAnswer, parseQuery } from "../src/core/bangs";

describe("Ruches — raccourcis et moteurs", () => {
  test("raccourci au début ou à la fin, avec ! ou &", () => {
    const a = parseQuery("!w Victor Hugo");
    expect(a.kind).toBe("bang");
    if (a.kind === "bang") expect(a.url).toBe("https://fr.wikipedia.org/w/index.php?search=Victor%20Hugo");
    const b = parseQuery("carte grise &sp");
    expect(b.kind === "bang" && b.bang.label).toBe("Service-Public");
    const c = parseQuery("!W");
    expect(c.kind === "bang" && c.url).toBe("https://fr.wikipedia.org/");
  });
  test("un raccourci inconnu reste du texte", () => {
    expect(parseQuery("!zzz bonjour")).toEqual({ kind: "plain", query: "!zzz bonjour" });
    expect(parseQuery("prix !important du gaz").kind).toBe("plain");
  });
  test("« ? » force la recherche dans Ruches", () => {
    expect(parseQuery("? facture EDF")).toEqual({ kind: "local", query: "facture EDF" });
  });
  test("moteurs : Lilo pour Tous/Images, Qwant sinon, cartes IGN", () => {
    expect(engineUrl("lilo", "a b")).toBe("https://search.lilo.org/?q=a%20b");
    expect(engineUrl("lilo", "x", "news")).toBe("https://www.qwant.com/?l=fr&t=news&q=x");
    expect(engineUrl("qwant", "x", "maps")).toBe("https://cartes.gouv.fr/?q=x");
  });
  test("suggestions de raccourcis pendant la saisie", () => {
    expect(bangHints("!s").map((h) => h.key)).toContain("sp");
    expect(bangHints("bonjour")).toEqual([]);
  });
  test("calculs instantanés sans eval", () => {
    expect(instantAnswer("12*7")).toBe("84");
    expect(instantAnswer("(2+3)^2")).toBe("25");
    expect(instantAnswer("15 % de 80")).toBe("12");
    expect(instantAnswer("1,5 + 1,5")).toBe("3");
    expect(instantAnswer("2024")).toBeNull();
    expect(instantAnswer("alert(1)")).toBeNull();
  });
});
