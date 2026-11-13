import { expect, it } from 'vitest';
import { activeNavHref, clipOrigin, sourceClipSearch } from './navigation';

const id = '00000000-0000-7000-8000-000000000123';
it('returns to the originating folder and keeps Projects active through both editors', () => {
  const origin = clipOrigin(`?project=${id}`);
  expect(origin).toMatchObject({ to: `/projects/${id}`, menu: '/projects', search: `?project=${id}` });
  for (const suffix of ['', '/edit', '/advanced'])
    expect(activeNavHref(`/clips/${id}${suffix}`, origin.search)).toBe('/projects');
});
it('keeps Library active for source-origin clips and uses the collection for direct clips', () => {
  expect(clipOrigin(`?source=${id}`)).toMatchObject({ to: `/library/${id}`, menu: '/library' });
  expect(clipOrigin('')).toMatchObject({ to: '/clips', menu: '/clips', search: '' });
  expect(activeNavHref(`/clips/${id}`, '')).toBe('/clips');
  expect(activeNavHref(`/library/${id}`, '')).toBe('/library');
  expect(activeNavHref(`/library/${id}`, `?project=${id}`)).toBe('/projects');
});
it('retains folder context when creating a clip from its footage, without arbitrary return URLs', () => {
  expect(sourceClipSearch(`?project=${id}`, id)).toBe(`?project=${id}`);
  expect(sourceClipSearch('', id)).toBe(`?source=${id}`);
  expect(clipOrigin('?project=https://bad.example&returnTo=//bad.example')).toMatchObject({
    to: '/clips',
    search: '',
  });
});
it('keeps the photo library active and preserves photo context through source and clip links', () => {
  expect(activeNavHref('/photos', '')).toBe('/photos');
  expect(activeNavHref(`/library/${id}`, '?media=photo')).toBe('/photos');
  expect(clipOrigin(`?source=${id}&media=photo`)).toMatchObject({
    to: `/library/${id}?media=photo`,
    menu: '/photos',
  });
  expect(sourceClipSearch('?media=photo', id)).toBe(`?source=${id}&media=photo`);
});
