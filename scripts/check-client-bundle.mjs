// Fails if server-only secrets or identifiers appear in the built browser
// bundle (PLAN.md 17.4). Run after `pnpm build`.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = ".next/static";
const forbidden = ["SUPABASE_SERVICE_ROLE_KEY", "question_secrets", "answer_spec"];
const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (secret) forbidden.push(secret);

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

let files;
try {
  files = walk(root).filter((f) => f.endsWith(".js"));
} catch {
  console.error(`No ${root} directory. Run \`pnpm build\` first.`);
  process.exit(1);
}

const hits = [];
for (const file of files) {
  const text = readFileSync(file, "utf8");
  for (const needle of forbidden) {
    if (text.includes(needle)) {
      hits.push(`${file}: ${needle === secret ? "<service role key value>" : needle}`);
    }
  }
}

if (hits.length) {
  console.error("Server-only content found in the client bundle:\n" + hits.join("\n"));
  process.exit(1);
}
console.log(`Checked ${files.length} client bundle files: no server-only content.`);
