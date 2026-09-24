import assert from "node:assert/strict";
import { test } from "node:test";
import { Kernel, KernelError, covers } from "../src/kernel/kernel.ts";

function site() {
  return new Kernel({
    boot(k) {
      k.createCell("root");
      k.createCell("admin");
      k.createCell("editor");
      k.mintRoot("root", "site");
    },
  });
}

const rootCap = (k: Kernel) => k.status().cells.find((c) => c.id === "root")!.capabilityIds[0];

test("covers suit les segments, pas les préfixes de texte", () => {
  assert.equal(covers("/", "n/importe/quoi"), true);
  assert.equal(covers("site/admin", "site/admin/actualites"), true);
  assert.equal(covers("site/admin", "site/admin"), true);
  assert.equal(covers("site/admin", "site/administration"), false);
  assert.equal(covers("site/admin", "site"), false);
});

test("check accorde uniquement les droits et la portée détenus", () => {
  const k = site();
  const cap = k.delegate("root", rootCap(k), "admin", ["read", "write", "delegate"], "site/admin");
  assert.ok(cap.parentId);
  assert.equal(k.check("admin", "site/admin/actualites", "write"), true);
  assert.equal(k.check("admin", "site/admin/actualites", "execute"), false);
  assert.equal(k.check("admin", "site/boutique", "read"), false);
  assert.equal(k.check("editor", "site/admin/actualites", "read"), false);
  assert.equal(k.check("inconnue", "site", "read"), false);
});

test("delegate refuse d'élargir droits ou portée", () => {
  const k = site();
  const admin = k.delegate("root", rootCap(k), "admin", ["read", "delegate"], "site/admin");
  assert.throws(() => k.delegate("admin", admin.id, "editor", ["write"]), KernelError);
  assert.throws(() => k.delegate("admin", admin.id, "editor", ["read"], "site"), KernelError);
  assert.throws(() => k.delegate("admin", admin.id, "editor", ["read"], "site/administration"), KernelError);
});

test("delegate exige de détenir la capacité et le droit delegate", () => {
  const k = site();
  const admin = k.delegate("root", rootCap(k), "admin", ["read", "write"], "site/admin");
  assert.throws(() => k.delegate("editor", admin.id, "editor", ["read"]), KernelError);
  assert.throws(() => k.delegate("admin", admin.id, "editor", ["read"]), KernelError);
});

test("revoke retire les droits en cascade", () => {
  const k = site();
  const admin = k.delegate("root", rootCap(k), "admin", ["read", "write", "delegate"], "site/admin");
  k.delegate("admin", admin.id, "editor", ["read"], "site/admin/actualites");
  assert.equal(k.check("editor", "site/admin/actualites", "read"), true);

  k.revoke(admin.id);
  assert.equal(k.check("admin", "site/admin", "read"), false);
  assert.equal(k.check("editor", "site/admin/actualites", "read"), false);
  assert.throws(() => k.delegate("admin", admin.id, "editor", ["read"]), KernelError);
  assert.equal(k.check("root", "site/admin", "write"), true);
});

test("reset rejoue le démarrage", () => {
  const k = site();
  k.delegate("root", rootCap(k), "admin", ["read"]);
  k.reset();
  const { cells, capabilities } = k.status();
  assert.equal(cells.length, 3);
  assert.equal(capabilities.length, 1);
});
