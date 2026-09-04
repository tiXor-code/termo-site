// Verdict band (server). The single, plain-language "what does my apartment
// actually experience" answer. Matches the /tmp/strada.html mockup markup so
// the contrast rules in globals.css apply: color goes on the big number, the
// pill, the left border, and the YOU bar fill ONLY — never the label/value text.
import Link from 'next/link';
import { verdictFor, type Grade } from '@/lib/verdict';
import { fmtInt, fmtZile } from '@/lib/format';

// Bar scale caps at the "problematic" threshold (90) for legibility, matching
// the mockup's MAXBAR. Values above 90 saturate the bar.
const MAXBAR = 90;
const barPct = (n: number) => Math.min(100, Math.round((Math.max(0, n) / MAXBAR) * 100));

export interface VerdictBandProps {
  days: number;
  /**
   * Deficiency days (pressure/temperature) for the same entity and year.
   * Optional and defaulting to 0 so a caller built against an older bundle -
   * or a street-year whose days_deficienta has not shipped yet - degrades to
   * today's exact behaviour instead of rendering NaN.
   */
  daysDeficienta?: number;
  year: number;
  /** Display name of the entity, e.g. "PT 13 Pantelimon". */
  name: string;
  /** 'pt' = canonical zone page; 'block' = chosen via the street block finder. */
  scope: 'pt' | 'block';
  /** City median days for the year (getYearSummary(year).median_pt_days). */
  cityMedian: number;
  /** True when `year` is the partial current year — softens the copy. */
  partial?: boolean;
}

export default function VerdictBand({
  days,
  daysDeficienta,
  year,
  name,
  scope,
  cityMedian,
  partial = false,
}: VerdictBandProps) {
  const { key, label, demoted, daysDeficienta: def } = verdictFor(days, daysDeficienta);

  // "Blocul tău (PT 13 Pantelimon)" for the finder; "PT 13 Pantelimon" for a PT page.
  const entityLabel = scope === 'block' ? `Blocul tău (${name})` : name;

  // Headline sentence (plain RO). Partial years say "până acum în <an>".
  const periodSuffix = partial ? `până acum în ${year}` : `în ${year}`;
  const headline = `${entityLabel} a stat ${fmtZile(days)} fără apă caldă ${periodSuffix}.`;

  // Comparison framing vs the city median (mockup thresholds: 0.7× / 1.3×).
  const better = days < cityMedian * 0.7;
  const near = days <= cityMedian * 1.3;

  return (
    <div className="verdict" data-v={key}>
      <div className="num">
        <b className="v-num tnum">{fmtInt(days)}</b>
        <span>
          zile fără apă caldă
          <br />
          {partial ? `până acum în ${year}` : `în ${year}`}
        </span>
      </div>
      <div>
        <span className="label v-pill">{label}</span>
        {def > 0 && <span className="v-flag tnum">+{fmtZile(def)} cu deficiențe</span>}
        <h2>{headline}</h2>
        {def > 0 && (
          <p className="v-def">
            {demoted ? (
              <>
                Nu e o zonă „curată": pe lângă cele {fmtZile(days)} fără apă caldă,{' '}
                {entityLabel} a mai avut{' '}
                <b>{fmtZile(def)} cu presiune sau temperatură scăzută</b> {periodSuffix}. Nu
                sunt opriri, deci nu intră în cifra din stânga — dar apa a fost călduță sau
                abia curgea în acele zile.{' '}
              </>
            ) : (
              <>
                Pe lângă acestea, {entityLabel} a mai avut{' '}
                <b>{fmtZile(def)} cu presiune sau temperatură scăzută</b> {periodSuffix} — se
                numără separat și nu intră în cifra din stânga.{' '}
              </>
            )}
            <Link href="/metodologie#deficiente" className="underline">
              Cum le numărăm.
            </Link>
          </p>
        )}
        <div className="cmp">
          <p className="note">
            {better ? (
              <>
                Mai bine decât <b>media Bucureștiului</b> — și mult sub numărul „pe toată
                strada”.
              </>
            ) : near ? (
              <>
                Cam cât <b>media Bucureștiului</b>. Mult mai bine decât numărul „pe toată
                strada”.
              </>
            ) : (
              <>
                Peste <b>media Bucureștiului</b>, dar tot sub numărul „pe toată strada”.
              </>
            )}
          </p>
          <div className="row you">
            <span className="key">{entityLabel}</span>
            <span className="track">
              <span style={{ width: `${barPct(days)}%` }} />
            </span>
            <span className="val tnum">{fmtInt(days)}</span>
          </div>
          <div className="row med">
            <span className="key">Media orașului</span>
            <span className="track">
              <span style={{ width: `${barPct(cityMedian)}%` }} />
            </span>
            <span className="val tnum">{fmtInt(cityMedian)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export type { Grade };
