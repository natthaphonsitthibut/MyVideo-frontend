import { createHash } from 'node:crypto';

/**
 * Checksum manifest of the stage bundle. The version is derived from the content (first 12 hex of a sha256 over
 * the sorted `path sha256` lines), so any change to the stage, its fonts or the host page gives a new version and
 * the same sources always give the same version.
 *
 * @param {Record<string, Uint8Array>} files bundle-relative path → bytes (manifest.json itself excluded)
 * @returns {{ name: string, version: string, files: Record<string, { sha256: string, size: number }> }}
 */
export function buildManifest(files) {
  const entries = Object.keys(files)
    .sort()
    .map((path) => {
      const bytes = files[path];
      return [path, { sha256: createHash('sha256').update(bytes).digest('hex'), size: bytes.byteLength }];
    });
  const digest = createHash('sha256')
    .update(entries.map(([p, f]) => `${p} ${f.sha256}\n`).join(''))
    .digest('hex');
  return { name: '@myvideo/stage', version: digest.slice(0, 12), files: Object.fromEntries(entries) };
}

/**
 * Keeps only the `@font-face` blocks whose comment names one of `subsets` (fontsource writes
 * `/* <family>-<subset>-wght-normal *\/` above each block) and rewrites `./files/x.woff2` → `fonts/x.woff2`.
 *
 * @param {string} css fontsource index.css
 * @param {string[]} subsets e.g. ['thai', 'latin', 'latin-ext']
 * @returns {{ css: string, fonts: string[] }}
 */
export function pickFontFaces(css, subsets) {
  const blocks = [...css.matchAll(/\/\* ([\w-]+) \*\/\s*@font-face\s*\{[^}]*\}/g)];
  const fonts = [];
  const out = [];
  for (const [block, label] of blocks) {
    if (!subsets.some((s) => label.endsWith(`-${s}-wght-normal`))) continue;
    out.push(
      block.replace(/url\(\.\/files\/([\w.-]+)\)/g, (_m, file) => {
        fonts.push(file);
        return `url(fonts/${file})`;
      }),
    );
  }
  return { css: `${out.join('\n\n')}\n`, fonts };
}
