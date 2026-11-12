/**
 * Brand kit (E08-F08): element styles may use tokens instead of fixed values — colour `brand:primary` |
 * `brand:accent` | `brand:text`, font `brand` — and the stage turns them into CSS variables set on its root from the
 * merchant's CURRENT kit. Changing the kit restyles every project on its next mount (preview and render) without
 * touching the projects.
 */
export type BrandTheme = { primary: string; accent: string; text: string; font: string };

/** Fonts a brand kit may choose (bundled with the stage, so render and preview match). */
export const BRAND_FONTS: { id: string; name: string; css: string }[] = [
  {
    id: 'noto-sans-thai',
    name: 'Noto Sans Thai',
    css: '"Noto Sans Thai Variable", "Noto Sans Variable", sans-serif',
  },
];

export const DEFAULT_BRAND: BrandTheme = {
  primary: '#111111',
  accent: '#facc15',
  text: '#ffffff',
  font: 'noto-sans-thai',
};

const TOKEN = /^brand:(primary|accent|text)$/;
const HEX = /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/;

export function brandColor(value: string | undefined): string | undefined {
  const m = value?.match(TOKEN);
  if (!m) return value;
  const key = m[1] as 'primary' | 'accent' | 'text';
  return `var(--brand-${key}, ${DEFAULT_BRAND[key]})`;
}

export function brandFont(value: string): string | undefined {
  return value === 'brand' ? `var(--brand-font, ${BRAND_FONTS[0]?.css})` : undefined;
}

/** CSS custom properties for the stage root (invalid colours fall back to the defaults). */
export function brandVars(theme: Partial<BrandTheme> | undefined): string {
  const t = { ...DEFAULT_BRAND, ...theme };
  const color = (v: string, d: string) => (HEX.test(v) ? v : d);
  const font = BRAND_FONTS.find((f) => f.id === t.font) ?? BRAND_FONTS[0];
  return [
    `--brand-primary:${color(t.primary, DEFAULT_BRAND.primary)}`,
    `--brand-accent:${color(t.accent, DEFAULT_BRAND.accent)}`,
    `--brand-text:${color(t.text, DEFAULT_BRAND.text)}`,
    `--brand-font:${font?.css}`,
  ].join(';');
}
