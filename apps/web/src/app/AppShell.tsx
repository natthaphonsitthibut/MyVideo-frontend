import {
  Activity,
  ChevronDown,
  Clapperboard,
  Film,
  Folder,
  Image,
  Library,
  LogOut,
  Menu,
  Timer,
  X,
} from 'lucide-react';
import { Suspense, useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router';
import { useLogout, useMe } from '@/api/auth';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { activeNavHref } from '@/features/clip/navigation';
import { cn } from '@/lib/utils';

/** Project folders, all Library footage, the separate collection of edited clips, and measured step times. */
const NAV = [
  { to: '/projects', label: 'โปรเจกต์', icon: Folder },
  { to: '/clips', label: 'คลิปที่ตัดแล้ว', icon: Clapperboard },
  { to: '/timings', label: 'บันทึกเวลา', icon: Timer },
] as const;

function NavItem({
  to,
  label,
  icon: Icon,
  onNavigate,
}: {
  to: string;
  label: string;
  icon: typeof Film;
  onNavigate?: () => void;
}) {
  const location = useLocation();
  const active = activeNavHref(location.pathname, location.search) === to;
  return (
    <Link
      to={to}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex min-h-touch items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
        active ? 'bg-secondary text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      <Icon className="size-4" aria-hidden />
      {label}
    </Link>
  );
}

export function MediaNav({ onNavigate }: { onNavigate?: () => void }) {
  const location = useLocation();
  const active = ['/library', '/photos'].includes(activeNavHref(location.pathname, location.search) ?? '');
  const [expanded, setExpanded] = useState(() => {
    try {
      return localStorage.getItem('myvideo:media-menu') !== 'closed';
    } catch {
      return true;
    }
  });
  const activePath = active ? location.pathname : '';
  useEffect(() => {
    if (activePath) setExpanded(true);
  }, [activePath]);
  const toggle = () =>
    setExpanded((old) => {
      try {
        localStorage.setItem('myvideo:media-menu', old ? 'closed' : 'open');
      } catch {}
      return !old;
    });
  return (
    <div>
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls="media-submenu"
        onClick={toggle}
        className={cn(
          'flex min-h-touch w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm font-medium transition-colors hover:bg-muted',
          active ? 'text-primary' : 'text-muted-foreground',
        )}
      >
        <Library className="size-4" aria-hidden />
        <span className="flex-1">คลังสื่อ</span>
        <ChevronDown
          aria-hidden
          className={cn(
            'size-4 transition-transform duration-200 motion-reduce:transition-none',
            !expanded && '-rotate-90',
          )}
        />
      </button>
      <div
        id="media-submenu"
        aria-hidden={!expanded}
        inert={!expanded}
        className={cn(
          'grid transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none',
          expanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="ml-5 space-y-1 border-l pl-2">
            <NavItem to="/library" label="คลังวิดีโอ" icon={Film} onNavigate={onNavigate} />
            <NavItem to="/photos" label="คลังรูป" icon={Image} onNavigate={onNavigate} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function PageFallback() {
  return (
    <div className="space-y-3" role="status" aria-busy="true" aria-label="กำลังโหลด">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}

function Account() {
  const me = useMe().data;
  const logout = useLogout();
  const navigate = useNavigate();
  if (!me) return null;
  return (
    <div className="mt-3 border-t px-3 pt-3">
      <div className="truncate text-sm font-medium" data-testid="merchant-name">
        {me.merchant.name}
      </div>
      <div className="truncate text-xs text-muted-foreground">{me.user.email}</div>
      <Button
        variant="ghost"
        size="sm"
        className="mt-2 -ml-2 text-muted-foreground"
        disabled={logout.isPending}
        onClick={() => logout.mutate(undefined, { onSuccess: () => navigate('/login', { replace: true }) })}
      >
        <LogOut />
        ออกจากระบบ
      </Button>
    </div>
  );
}

export function AppShell() {
  // Below md the sidebar becomes a drawer opened from a top bar.
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-card focus:p-3"
      >
        ข้ามไปเนื้อหา
      </a>
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-card px-4 md:hidden">
        <span className="text-lg font-semibold tracking-tight">MyVideo</span>
        <Button
          variant="ghost"
          size="icon"
          aria-label={open ? 'ปิดเมนู' : 'เปิดเมนู'}
          aria-expanded={open}
          aria-controls="app-sidebar"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X /> : <Menu />}
        </Button>
      </header>
      {open ? (
        <button
          type="button"
          aria-label="ปิดเมนู"
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={close}
        />
      ) : null}
      <aside
        id="app-sidebar"
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r bg-card px-3 py-4 transition-transform md:sticky md:top-0 md:h-dvh md:w-56 md:shrink-0 md:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="mb-6 px-3 text-lg font-semibold tracking-tight">MyVideo</div>
        <nav aria-label="เมนูหลัก" className="flex flex-1 flex-col gap-1">
          {NAV.map((item) => (
            <div key={item.to}>
              <NavItem {...item} onNavigate={close} />
              {item.to === '/projects' ? <MediaNav onNavigate={close} /> : null}
            </div>
          ))}
        </nav>
        {import.meta.env.DEV ? (
          <NavItem to="/dev/status" label="สถานะระบบ (dev)" icon={Activity} onNavigate={close} />
        ) : null}
        <Account />
      </aside>
      <main id="main-content" tabIndex={-1} className="min-w-0 flex-1 px-page py-6">
        <Suspense fallback={<PageFallback />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}
