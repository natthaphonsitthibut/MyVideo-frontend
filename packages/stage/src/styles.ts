import type { TextStyle } from './types';

/** Bundled fonts only (ARCHITECTURE §7: no system fonts in a render). The host page loads these families. */
export const STAGE_FONT = '"Noto Sans Thai Variable", "Noto Sans Variable", sans-serif';

/** Named text styles a project can refer to with `styleRef` (templates add more later). */
const NAMED: Record<string, TextStyle> = {
  title: {
    fontFamily: STAGE_FONT,
    fontWeight: 800,
    fontSize: 88,
    color: '#ffffff',
    background: '#00000099',
    align: 'center',
  },
  body: { fontFamily: STAGE_FONT, fontWeight: 500, fontSize: 56, color: '#ffffff', align: 'center' },
  price: {
    fontFamily: STAGE_FONT,
    fontWeight: 800,
    fontSize: 96,
    color: '#111111',
    background: '#facc15',
    align: 'center',
  },
};

export function textStyleFor(style: TextStyle | undefined, ref: string | undefined): TextStyle {
  if (style) return { ...style, fontFamily: `${style.fontFamily}, ${STAGE_FONT}` };
  return NAMED[ref ?? ''] ?? (NAMED.body as TextStyle);
}
