const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** URL context survives reloads and editor round-trips. Never accept arbitrary return URLs. */
export function clipOrigin(search: string) {
  const params = new URLSearchParams(search);
  const project = params.get('project');
  if (project && UUID.test(project))
    return {
      to: `/projects/${project}`,
      label: 'กลับไปโปรเจกต์',
      menu: '/projects',
      search: `?project=${project}`,
    };
  const source = params.get('source');
  const photo = params.get('media') === 'photo';
  if (source && UUID.test(source))
    return {
      to: `/library/${source}${photo ? '?media=photo' : ''}`,
      label: 'กลับไปวิดีโอต้นฉบับ',
      menu: photo ? '/photos' : '/library',
      search: `?source=${source}${photo ? '&media=photo' : ''}`,
    };
  return { to: '/clips', label: 'คลิปที่ตัดแล้ว', menu: '/clips', search: '' };
}
export function sourceClipSearch(search: string, sourceId: string) {
  const origin = clipOrigin(search);
  return origin.menu === '/projects'
    ? origin.search
    : `?source=${sourceId}${new URLSearchParams(search).get('media') === 'photo' ? '&media=photo' : ''}`;
}
export function activeNavHref(pathname: string, search: string): string | null {
  if (pathname.startsWith('/clips/')) return clipOrigin(search).menu;
  if (pathname === '/clips') return '/clips';
  if (pathname.startsWith('/projects')) return '/projects';
  if (pathname === '/photos') return '/photos';
  if (pathname.startsWith('/library'))
    return clipOrigin(search).menu === '/projects'
      ? '/projects'
      : new URLSearchParams(search).get('media') === 'photo'
        ? '/photos'
        : '/library';
  if (pathname === '/timings') return '/timings';
  if (pathname.startsWith('/dev/status')) return '/dev/status';
  return null;
}
