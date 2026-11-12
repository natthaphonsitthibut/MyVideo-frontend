import { describe, expect, it } from 'vitest';
import { BRAND_FONTS, brandColor, brandVars, DEFAULT_BRAND } from './brand';
import { textStyleFor } from './styles';

describe('brand tokens', () => {
  it('a brand colour token becomes a CSS variable with the default as fallback; hex stays hex', () => {
    expect(brandColor('brand:primary')).toBe(`var(--brand-primary, ${DEFAULT_BRAND.primary})`);
    expect(brandColor('#ff0000')).toBe('#ff0000');
    expect(brandColor(undefined)).toBeUndefined();
  });

  it('text styles resolve tokens (colour, background, font) so the current brand kit applies on mount', () => {
    const s = textStyleFor(
      {
        fontFamily: 'brand',
        fontWeight: 800,
        fontSize: 72,
        color: 'brand:text',
        background: 'brand:primary',
        align: 'center',
      },
      undefined,
    );
    expect(s.color).toBe(`var(--brand-text, ${DEFAULT_BRAND.text})`);
    expect(s.background).toBe(`var(--brand-primary, ${DEFAULT_BRAND.primary})`);
    expect(s.fontFamily.startsWith('var(--brand-font')).toBe(true);
  });

  it('the theme becomes CSS variables on the stage root; unknown fonts fall back to the stage font', () => {
    const vars = brandVars({ primary: '#e11d48', accent: '#fde047', text: '#ffffff', font: 'Comic' });
    expect(vars).toContain('--brand-primary:#e11d48');
    expect(vars).toContain('--brand-accent:#fde047');
    expect(vars).toContain(`--brand-font:${BRAND_FONTS[0]?.css}`);
  });
});
