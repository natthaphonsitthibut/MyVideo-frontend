export type MediaKind = 'video' | 'photo';
export function mediaKind(source: { kind?: MediaKind | null; originalFilename: string }): MediaKind {
  return source.kind ?? (/\.(jpg|jpeg|png|webp)$/i.test(source.originalFilename) ? 'photo' : 'video');
}
