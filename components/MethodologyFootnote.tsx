import Link from 'next/link';
import type { ReactNode } from 'react';

export default function MethodologyFootnote({
  anchor,
  children,
}: {
  anchor: string;
  children: ReactNode;
}) {
  return (
    <p className="text-xs leading-relaxed text-ink-soft">
      {children}{' '}
      <Link href={`/metodologie#${anchor}`} className="underline">
        Detalii în metodologie.
      </Link>
    </p>
  );
}
