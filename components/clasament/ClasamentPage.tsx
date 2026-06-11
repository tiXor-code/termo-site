// Shared server renderer for the 3 yearless + 18 year clasament pages (Group B).
import Link from 'next/link';
import Breadcrumbs from '@/components/Breadcrumbs';
import MethodologyFootnote from '@/components/MethodologyFootnote';
import RankingTable from '@/components/RankingTable';
import {
  clientAsset,
  getMeta,
  getPtRanking,
  getSectoareRanking,
  getStraziRanking,
  getYearSummary,
} from '@/lib/data';
import { fmtDateRo, fmtInt, yearLabel } from '@/lib/format';
import {
  ptRowToView,
  sectorRowToView,
  streetRowToView,
  type RankingRowView,
} from '@/lib/rankings';

export type Unitate = 'puncte-termice' | 'strazi' | 'sectoare';

export const UNITATI: Unitate[] = ['puncte-termice', 'strazi', 'sectoare'];

export function clasamentH1(unitate: Unitate, anLabel: string): string {
  switch (unitate) {
    case 'puncte-termice':
      return `Clasamentul punctelor termice — ${anLabel}`;
    case 'strazi':
      return `Clasamentul străzilor — ${anLabel}`;
    case 'sectoare':
      return `Sectoare — ${anLabel}`;
  }
}

const UNIT_NAME: Record<Unitate, string> = {
  'puncte-termice': 'Puncte termice',
  strazi: 'Străzi',
  sectoare: 'Sectoare',
};

export default function ClasamentPage({ unitate, an }: { unitate: Unitate; an: number }) {
  const meta = getMeta();
  const summary = getYearSummary(an);
  const partial = meta.partial_years.includes(an);
  const anLabel = yearLabel(an, meta);

  let rows: RankingRowView[];
  let totalCount: number;
  let restUrl: string | undefined;
  let maxDays: number;
  let unit: 'pt' | 'strada' | 'sector';
  if (unitate === 'puncte-termice') {
    const ranking = getPtRanking(an);
    rows = ranking.map((r, i) => ptRowToView(r, i + 1));
    totalCount = ranking.length;
    maxDays = ranking[0]?.days ?? 1;
    unit = 'pt';
  } else if (unitate === 'strazi') {
    const ranking = getStraziRanking(an);
    rows = ranking.slice(0, 100).map((r, i) => streetRowToView(r, i + 1));
    totalCount = ranking.length;
    restUrl = clientAsset(`rankings/strazi-${an}.json`);
    maxDays = ranking[0]?.days ?? 1;
    unit = 'strada';
  } else {
    const ranking = getSectoareRanking(an);
    rows = ranking.map((r, i) => sectorRowToView(r, i + 1));
    totalCount = ranking.length;
    maxDays = Math.max(...ranking.map((r) => r.median_days), 1);
    unit = 'sector';
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <Breadcrumbs
        items={[
          { name: 'Acasă', href: '/' },
          { name: 'Clasamente', href: '/clasament' },
          { name: UNIT_NAME[unitate], href: `/clasament/${unitate}` },
        ]}
      />
      <h1 className="mt-6 font-display text-3xl font-bold">{clasamentH1(unitate, anLabel)}</h1>
      <p className="mt-3 max-w-2xl text-sm text-ink-soft">
        {fmtInt(summary.pts_hit)} din {fmtInt(meta.universe_size)} puncte termice au avut cel puțin
        o zi cu întreruperi în {an}; mediana: {fmtInt(summary.median_pt_days)} zile.
      </p>
      {partial && (
        <p className="mt-3 max-w-2xl border-l-2 border-avarie pl-3 text-sm">
          An incomplet: date până la {fmtDateRo(meta.data_through)}. Comparațiile cu alți ani se fac
          doar pe perioade echivalente.
        </p>
      )}
      <nav aria-label="Alege anul" className="mt-6 flex flex-wrap gap-x-4 border-y border-hairline py-3 text-sm">
        {meta.years.map((y) => (
          <Link
            key={y}
            href={`/clasament/${unitate}/${y}`}
            aria-current={y === an ? 'page' : undefined}
            className={y === an ? 'font-bold' : 'text-ink-soft hover:underline'}
          >
            {y}
            {meta.partial_years.includes(y) ? '*' : ''}
          </Link>
        ))}
      </nav>
      <div className="mt-6">
        <RankingTable
          rows={rows}
          unit={unit}
          year={an}
          maxDays={maxDays}
          totalCount={totalCount}
          restUrl={restUrl}
          enableCauzaFilter={unitate !== 'sectoare'}
        />
      </div>
      <div className="mt-8">
        <MethodologyFootnote anchor="ce-numaram">
          O „zi cu întrerupere" = o zi calendaristică atinsă de cel puțin un episod de oprire a apei
          calde (avarie sau lucrare programată). Deficiențele (presiune sau temperatură scăzută) se
          numără separat și nu intră în indicatorul principal.
        </MethodologyFootnote>
      </div>
    </main>
  );
}
