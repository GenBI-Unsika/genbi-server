import fs from 'node:fs/promises';
import path from 'node:path';

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) {
      args._.push(a);
      continue;
    }

    const key = a.slice(2);
    if (key === 'help') {
      args.help = true;
      continue;
    }

    const value = argv[i + 1];
    if (value == null || value.startsWith('--')) {
      args[key] = true;
      continue;
    }

    args[key] = value;
    i++;
  }
  return args;
}

function printHelp() {
  // Keep this intentionally minimal.
  // This script targets the WordPress-import article SQL shape used in this repo.
  console.log(`Usage:
  node scripts/fix-article-sql.mjs <input.sql> <output.sql> --null-author-id <id>

Examples:
  node scripts/fix-article-sql.mjs ./article.sql ./article.fixed.sql --null-author-id 48

Notes:
  - This only rewrites patterns like: , 48, 'PUBLISHED' (also DRAFT/ARCHIVED)
  - It is meant to fix MySQL error 1452 (FK articles.author_id -> users.id)
`);
}

function toInt(str, flagName) {
  const n = Number.parseInt(String(str), 10);
  if (!Number.isFinite(n)) throw new Error(`Invalid ${flagName}: ${str}`);
  return n;
}

function escapeForRegExp(literal) {
  return String(literal).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    process.exit(0);
  }

  const input = args._[0];
  const output = args._[1];
  if (!input || !output) {
    printHelp();
    process.exit(2);
  }

  if (!args['null-author-id']) {
    throw new Error('Missing required flag: --null-author-id <id>');
  }

  const authorId = toInt(args['null-author-id'], '--null-author-id');

  const src = await fs.readFile(input, 'utf8');

  const authorIdRe = escapeForRegExp(authorId);
  const statusGroup = '(PUBLISHED|DRAFT|ARCHIVED)';
  const pattern = new RegExp(`,\\s*${authorIdRe}\\s*,\\s*'${statusGroup}'`, 'g');

  const replaced = src.replace(pattern, ", NULL, '$1'");

  if (replaced === src) {
    console.warn(`No replacements made. Did you pass the correct --null-author-id? (authorId=${authorId})`);
  }

  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.writeFile(output, replaced, 'utf8');

  console.log(`Wrote fixed SQL to: ${output}`);
}

main().catch((err) => {
  console.error(err?.stack || String(err));
  process.exit(1);
});
