import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { test } from "node:test";
import ts from "typescript";

const source = readFileSync(new URL("../lib/appearance.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;

function browser(raw = null, blocked = false) {
  const storage = new Map(raw === null ? [] : [["pollens.appearance.v1", raw]]);
  const target = new EventTarget();
  let snapshot, subscribe, serverSnapshot;
  const context = {
    exports: {}, Event,
    require: () => ({ useSyncExternalStore: (sub, get, server) => { subscribe = sub; snapshot = get; serverSnapshot = server; return get(); } }),
    localStorage: {
      getItem: (key) => { if (blocked) throw new Error("Storage blocked"); return storage.get(key) ?? null; },
      setItem: (key, value) => { if (blocked) throw new Error("Storage blocked"); storage.set(key, value); },
    },
    document: { documentElement: { dataset: {} } },
    window: target,
  };
  vm.runInNewContext(compiled, context);
  context.exports.useAppearance();
  return { context, storage, read: () => ({ ...snapshot() }), server: () => ({ ...serverSnapshot() }), subscribe: (cb) => subscribe(cb), update: context.exports.updateAppearance, target };
}

test("saved preferences survive a fresh page, with a stable light server snapshot", () => {
  const b = browser();
  b.update({ theme: "dark" });
  b.update({ sidebarCollapsed: true });
  const reloaded = browser(b.storage.get("pollens.appearance.v1"));
  assert.deepEqual(reloaded.read(), { theme: "dark", sidebarCollapsed: true });
  assert.deepEqual(reloaded.server(), { theme: "light", sidebarCollapsed: false });
});

test("malformed or invalid preferences use safe defaults", () => {
  for (const raw of ["invalid json", "null", '{"theme":"other","sidebarCollapsed":"true"}']) {
    assert.deepEqual(browser(raw).read(), { theme: "light", sidebarCollapsed: false });
  }
});

test("blocked storage still allows both controls to work during the session", () => {
  const b = browser(null, true);
  b.update({ theme: "dark" });
  b.update({ sidebarCollapsed: true });
  assert.deepEqual(b.read(), { theme: "dark", sidebarCollapsed: true });
  assert.equal(b.context.document.documentElement.dataset.theme, "dark");
  assert.equal(b.context.document.documentElement.dataset.sidebar, "collapsed");
});

test("subscribers sync the document across tabs and unsubscribe cleanly", () => {
  const b = browser();
  let changes = 0;
  const unsubscribe = b.subscribe(() => changes++);
  b.storage.set("pollens.appearance.v1", '{"theme":"dark","sidebarCollapsed":true}');
  const event = new Event("storage");
  Object.defineProperty(event, "key", { value: "pollens.appearance.v1" });
  b.target.dispatchEvent(event);
  assert.equal(changes, 1);
  assert.equal(b.context.document.documentElement.dataset.theme, "dark");
  assert.equal(b.context.document.documentElement.dataset.sidebar, "collapsed");
  unsubscribe();
  b.update({ theme: "light" });
  assert.equal(changes, 1);
});
