import { describe, expect, it } from 'vitest';
import { buildManifest, pickFontFaces } from './manifest.mjs';

const enc = (s: string) => new TextEncoder().encode(s);

describe('buildManifest', () => {
  it('is independent of insertion order and changes with any byte', () => {
    const a = buildManifest({ 'stage.js': enc('x'), 'stage.css': enc('y') });
    const b = buildManifest({ 'stage.css': enc('y'), 'stage.js': enc('x') });
    const c = buildManifest({ 'stage.css': enc('y'), 'stage.js': enc('x ') });
    expect(a).toEqual(b);
    expect(a.version).toMatch(/^[0-9a-f]{12}$/);
    expect(c.version).not.toBe(a.version);
    expect(a.files['stage.js']).toEqual({
      sha256: '2d711642b726b04401627ca9fbac32f5c8530fb1903cc4db02258717921a4881',
      size: 1,
    });
  });

  it('changes when a file is renamed', () => {
    expect(buildManifest({ 'a.js': enc('x') }).version).not.toBe(buildManifest({ 'b.js': enc('x') }).version);
  });
});

describe('pickFontFaces', () => {
  const css = `/* noto-sans-thai-wght-normal */
@font-face {
  font-family: 'Noto Sans Thai Variable';
  src: url(./files/noto-sans-thai-thai-wght-normal.woff2) format('woff2-variations');
}

/* noto-sans-cyrillic-wght-normal */
@font-face {
  font-family: 'Noto Sans Variable';
  src: url(./files/noto-sans-cyrillic-wght-normal.woff2) format('woff2-variations');
}

/* noto-sans-latin-ext-wght-normal */
@font-face {
  font-family: 'Noto Sans Variable';
  src: url(./files/noto-sans-latin-ext-wght-normal.woff2) format('woff2-variations');
}`;

  it('keeps the requested subsets and points them at fonts/', () => {
    const r = pickFontFaces(css, ['thai', 'latin-ext']);
    expect(r.fonts).toEqual([
      'noto-sans-thai-thai-wght-normal.woff2',
      'noto-sans-latin-ext-wght-normal.woff2',
    ]);
    expect(r.css).toContain('url(fonts/noto-sans-thai-thai-wght-normal.woff2)');
    expect(r.css).not.toContain('cyrillic');
    expect(r.css).not.toContain('./files/');
  });

  it('does not take latin-ext for latin', () => {
    expect(pickFontFaces(css, ['latin']).fonts).toEqual([]);
  });
});
