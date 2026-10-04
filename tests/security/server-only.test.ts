import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// PLAN.md 17.4: the service-role key and answer specs must never reach client code.

const SRC = join(__dirname, "..", "..", "src");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

const files = walk(SRC).map((path) => ({
  path: relative(SRC, path).replaceAll("\\", "/"),
  text: readFileSync(path, "utf8"),
}));

const isClientModule = (text: string) => /^\s*["']use client["']/m.test(text);

describe("server-only boundaries", () => {
  it("reads SUPABASE_SERVICE_ROLE_KEY only in lib/supabase/admin.ts", () => {
    const users = files
      .filter((f) => f.text.includes("SUPABASE_SERVICE_ROLE_KEY"))
      .map((f) => f.path);
    expect(users).toEqual(["lib/supabase/admin.ts"]);
  });

  it("marks the admin and server Supabase clients as server-only", () => {
    for (const name of ["lib/supabase/admin.ts", "lib/supabase/server.ts"]) {
      const file = files.find((f) => f.path === name);
      expect(file?.text, name).toMatch(/^import "server-only";/m);
    }
  });

  it("never imports the admin client from a client module", () => {
    const offenders = files
      .filter((f) => isClientModule(f.text) && /lib\/supabase\/admin/.test(f.text))
      .map((f) => f.path);
    expect(offenders).toEqual([]);
  });

  it("never mentions question_secrets or answer specs in a client module", () => {
    const offenders = files
      .filter(
        (f) => isClientModule(f.text) && /question_secrets|answer_spec|answerSpec/.test(f.text),
      )
      .map((f) => f.path);
    expect(offenders).toEqual([]);
  });
});
