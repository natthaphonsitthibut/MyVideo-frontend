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
  if (source && UUID.test(source))
    return {
      to: `/library/${source}`,
      label: 'กลับไปวิดีโอต้นฉบับ',
      menu: '/library',
      search: `?source=${source}`,
    };
  return { to: '/clips', label: 'คลิปที่ตัดแล้ว', menu: '/clips', search: '' };
}
export function sourceClipSearch(search: string, sourceId: string) {
  const origin = clipOrigin(search);
  return origin.menu === '/projects' ? origin.search : `?source=${sourceId}`;
}
export function activeNavHref(pathname: string, search: string): string | null {
  if (pathname.startsWith('/clips/')) return clipOrigin(search).menu;
  if (pathname === '/clips') return '/clips';
  if (pathname.startsWith('/projects')) return '/projects';
  if (pathname.startsWith('/library'))
    return clipOrigin(search).menu === '/projects' ? '/projects' : '/library';
  if (pathname.startsWith('/dev/status')) return '/dev/status';
  return null;
}
