import { Activity, Clapperboard, Download, Film } from 'lucide-react';
import { Suspense } from 'react';
import { NavLink, Outlet } from 'react-router';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const NAV = [
  { to: '/library', label: 'คลังวิดีโอ', icon: Film },
  { to: '/clips', label: 'คลิป', icon: Clapperboard },
  { to: '/exports', label: 'ไฟล์ส่งออก', icon: Download },
] as const;

function NavItem({ to, label, icon: Icon }: { to: string; label: string; icon: typeof Film }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
          isActive
            ? 'bg-accent text-accent-foreground'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        )
      }
    >
      <Icon className="size-4" aria-hidden />
      {label}
    </NavLink>
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

export function AppShell() {
  return (
    <div className="flex min-h-dvh">
      <aside className="flex w-56 shrink-0 flex-col border-r bg-card px-3 py-4">
        <div className="mb-6 px-3 text-lg font-semibold tracking-tight">MyVideo</div>
        <nav aria-label="เมนูหลัก" className="flex flex-1 flex-col gap-1">
          {NAV.map((item) => (
            <NavItem key={item.to} {...item} />
          ))}
        </nav>
        <NavItem to="/status" label="สถานะระบบ" icon={Activity} />
      </aside>
      <main className="min-w-0 flex-1 px-8 py-6">
        <Suspense fallback={<PageFallback />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}
