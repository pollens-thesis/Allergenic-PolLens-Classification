import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import ts from "typescript";

// Run the pure dashboard tests with the existing TypeScript dependency, including on Node 20.
const root = fileURLToPath(new URL("../", import.meta.url));
const output = mkdtempSync(join(tmpdir(), "pollens-dashboard-tests-"));
try {
  for (const name of ["data", "geo", "dashboard-locations", "dashboard", "dashboard.test"]) {
    const source = readFileSync(join(root, "lib", `${name}.ts`), "utf8").replaceAll('"@/lib/', '"./');
    const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } });
    writeFileSync(join(output, `${name}.js`), compiled.outputText);
  }
  const result = spawnSync(process.execPath, ["--test", join(output, "dashboard.test.js")], { stdio: "inherit" });
  process.exitCode = result.status ?? 1;
} finally {
  rmSync(output, { recursive: true, force: true });
}
