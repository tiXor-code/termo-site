export default function StatRow({
  stats,
}: {
  stats: { value: string; label: string; footnoteHref?: string }[];
}) {
  return (
    <dl className="flex flex-wrap gap-x-10 gap-y-6 border-y border-hairline py-6">
      {stats.map((stat) => (
        <div key={stat.label}>
          <dd className="display-num tnum text-3xl">{stat.value}</dd>
          <dt className="mt-1 text-sm text-ink-soft">
            {stat.footnoteHref ? (
              <a href={stat.footnoteHref} className="hover:underline">
                {stat.label}
              </a>
            ) : (
              stat.label
            )}
          </dt>
        </div>
      ))}
    </dl>
  );
}
