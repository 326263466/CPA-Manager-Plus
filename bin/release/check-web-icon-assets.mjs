import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const bundlePath = path.resolve(repoRoot, process.argv[2] || 'apps/web/dist/index.html');

const assets = [
  {
    id: 'cpamp-favicon',
    href: 'favicon.ico',
    source: 'apps/web/public/favicon.ico',
    dataUrlPrefix: 'data:image/x-icon;base64,',
  },
  {
    id: 'cpamp-apple-touch-icon',
    href: 'apple-touch-icon.png',
    source: 'apps/web/public/apple-touch-icon.png',
    dataUrlPrefix: 'data:image/png;base64,',
  },
];

const escapeRegExp = (value) => value.replace(/[.*+?^$()|[\]\\]/g, '\\$&');

if (!existsSync(bundlePath)) {
  console.error(`Missing web bundle: ${path.relative(repoRoot, bundlePath)}`);
  process.exit(1);
}

const bundle = readFileSync(bundlePath, 'utf8');
const failures = [];

for (const asset of assets) {
  const sourcePath = path.resolve(repoRoot, asset.source);
  const base64 = readFileSync(sourcePath).toString('base64');
  const tagPattern = new RegExp(
    `<link\\b[^>]*\\bid=["']${escapeRegExp(asset.id)}["'][^>]*>`,
    'i'
  );
  const tag = bundle.match(tagPattern)?.[0] || '';
  const hrefPattern = new RegExp(
    `\\bhref=["']/?${escapeRegExp(asset.href)}["']`,
    'i'
  );

  if (!tag || !hrefPattern.test(tag)) {
    failures.push(`${asset.id} does not retain the root-resource href in the built HTML`);
  }
  if (!bundle.includes(`${asset.dataUrlPrefix}${base64}`)) {
    failures.push(`${asset.source} is missing from the built single-file fallback payload`);
  }
}

if (failures.length > 0) {
  console.error([
    `Web icon artifact validation failed: ${path.relative(repoRoot, bundlePath)}`,
    ...failures.map((failure) => `- ${failure}`),
  ].join('\n'));
  process.exit(1);
}

console.log(
  `Web icon root resources and embedded fallbacks are present: ${path.relative(repoRoot, bundlePath)}`
);
