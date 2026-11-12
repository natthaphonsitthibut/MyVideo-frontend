import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Button } from './button';

export function PageBackLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Button variant="ghost" size="sm" asChild className="-ml-2 self-start">
      <Link to={to} data-testid="page-back">
        <ArrowLeft aria-hidden />
        {children}
      </Link>
    </Button>
  );
}
