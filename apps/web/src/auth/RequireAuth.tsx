import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useMe } from '@/api/auth';
import { Skeleton } from '@/components/ui/skeleton';

/** Protected routes: no session → /login?next=<where you were>. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const me = useMe();
  const location = useLocation();
  if (me.isPending) {
    return (
      <div className="p-8" role="status" aria-busy="true" aria-label="กำลังโหลด">
        <Skeleton className="h-8 w-48" />
      </div>
    );
  }
  if (me.isError) throw me.error;
  if (!me.data) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  return children;
}
