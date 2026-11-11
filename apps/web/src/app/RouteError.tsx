import { isRouteErrorResponse, Link, useRouteError } from 'react-router';
import { Button } from '@/components/ui/button';

export function RouteError() {
  const error = useRouteError();
  const notFound = isRouteErrorResponse(error) && error.status === 404;
  return (
    <div role="alert" className="mx-auto mt-24 max-w-md space-y-4 text-center">
      <h1 className="text-xl font-semibold">{notFound ? 'ไม่พบหน้านี้' : 'เกิดข้อผิดพลาด'}</h1>
      <p className="text-muted-foreground">
        {notFound ? 'ลิงก์อาจไม่ถูกต้อง' : 'ลองโหลดหน้าใหม่อีกครั้ง ถ้ายังไม่หายให้ดูหน้าสถานะระบบ'}
      </p>
      <Button asChild variant="outline">
        <Link to="/library">กลับหน้าคลังวิดีโอ</Link>
      </Button>
    </div>
  );
}
