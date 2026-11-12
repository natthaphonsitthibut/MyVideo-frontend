import { RefreshCw } from 'lucide-react';
import { type CheckStatus, useHealth } from '@/api/health';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

const LABELS: Record<string, string> = {
  postgres: 'ฐานข้อมูล (PostgreSQL)',
  redis: 'คิวงาน (Redis)',
  ai: 'บริการ AI',
};

function CheckRow({ name, check }: { name: string; check: CheckStatus }) {
  const up = check.status === 'up';
  return (
    <li
      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3"
      data-testid={`check-${name}`}
      data-status={check.status}
    >
      <div className="min-w-0 flex-1">
        <div className="font-medium">{LABELS[name] ?? name}</div>
        {check.error ? <div className="text-sm break-words text-destructive">{check.error}</div> : null}
      </div>
      <div className="flex shrink-0 items-center gap-3 text-sm text-muted-foreground">
        <span>{check.latencyMs} ms</span>
        <Badge variant={up ? 'success' : 'destructive'}>{up ? 'ปกติ' : 'ล่ม'}</Badge>
      </div>
    </li>
  );
}

export function StatusPage() {
  const health = useHealth();
  return (
    <section className="page-layout w-full max-w-2xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">สถานะระบบ</h1>
        <Button variant="outline" size="sm" onClick={() => health.refetch()} disabled={health.isFetching}>
          <RefreshCw className={health.isFetching ? 'animate-spin' : undefined} />
          ตรวจอีกครั้ง
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle data-testid="overall-status">
            {health.isPending
              ? 'กำลังตรวจ…'
              : health.isError
                ? 'ติดต่อเซิร์ฟเวอร์ไม่ได้'
                : health.data.status === 'ok'
                  ? 'ทุกอย่างปกติ'
                  : 'บางส่วนมีปัญหา'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {health.isPending ? (
            <Skeleton className="h-24 w-full" />
          ) : health.isError ? (
            <p className="text-sm text-destructive">
              API ไม่ตอบ — ตรวจว่าเปิด backend แล้ว (`./scripts/dev.sh start`)
            </p>
          ) : (
            <ul className="divide-y">
              {Object.entries(health.data.checks).map(([name, check]) => (
                <CheckRow key={name} name={name} check={check} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
