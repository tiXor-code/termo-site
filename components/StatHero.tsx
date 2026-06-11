import type { ReactNode } from 'react';

export default function StatHero({
  value,
  label,
  footnote,
}: {
  value: string;
  label: ReactNode;
  footnote?: ReactNode;
}) {
  return (
    <div className="py-10">
      <p className="display-num tnum text-7xl leading-none sm:text-8xl">{value}</p>
      <div className="mt-4 max-w-2xl text-lg leading-snug">{label}</div>
      {footnote !== undefined && (
        <div className="mt-3 max-w-2xl text-sm text-ink-soft">{footnote}</div>
      )}
    </div>
  );
}
