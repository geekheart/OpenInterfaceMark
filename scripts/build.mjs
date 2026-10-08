import { cp, mkdir, rm, readFile, writeFile } from 'node:fs/promises';
await rm(new URL('../dist', import.meta.url), { recursive: true, force: true });
await mkdir(new URL('../dist', import.meta.url));
for (const path of ['index.html', 'src', 'public']) {
  await cp(new URL(`../${path}`, import.meta.url), new URL(`../dist/${path}`, import.meta.url), { recursive: true });
}
const { name, version } = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
await writeFile(new URL('../dist/version.json', import.meta.url), JSON.stringify({
  name, version, commit: process.env.GITHUB_SHA || null, tag: process.env.RELEASE_TAG || null,
}, null, 2) + '\n');
console.log('Built static app → dist/');
