/**
 * The sector-page FAQ. Every answer is a plain string built from
 * lib/sector-stats.ts, so the visible text and the FAQPage JSON-LD are byte
 * identical — which is what Google requires and what keeps us honest: there is
 * no sentence here that is not computed from the published bundle.
 *
 * Deliberately no links or markup inside the answers. Internal links live in
 * the surrounding sections (top streets, top thermal points, breadcrumbs).
 */
import type { Meta } from '@/lib/data';
import {
  fmtCu,
  fmtDateRo,
  fmtDateTimeRo,
  fmtDec,
  fmtDurata,
  fmtInt,
  fmtPct,
  fmtZile,
  monthNameRo,
} from '@/lib/format';
import type { SectorStats } from '@/lib/sector-stats';

export interface FaqItem {
  q: string;
  a: string;
}

/** "2024–2026 (până la 11 iulie 2026)" / "2024" for a single-year window. */
export function windowLabel(years: number[], meta: Meta): string {
  if (years.length === 0) return '';
  const first = years[0];
  const last = years[years.length - 1];
  const base = first === last ? `${first}` : `${first}–${last}`;
  if (!meta.partial_years.includes(last)) return base;
  return `${base} (până la ${fmtDateRo(meta.data_through)})`;
}

export function buildSectorFaq(stats: SectorStats, meta: Meta): FaqItem[] {
  const s = stats.sector;
  const win = windowLabel(stats.durationWindow, meta);
  const monthWin = windowLabel(stats.monthWindow, meta);
  const stamp = fmtDateRo(stats.dataThrough);
  const items: FaqItem[] = [];

  // ---- 1. the actual query: "când se dă drumul la apa caldă sector N" ----
  const latest = stats.ongoing[0];
  const nowParts: string[] = [];
  if (stats.ongoing.length === 0) {
    nowParts.push(
      `La ultima actualizare a datelor (${stamp}) nu era nicio întrerupere de apă caldă în desfășurare în Sectorul ${s}.`,
    );
  } else {
    nowParts.push(
      `La ultima actualizare a datelor (${stamp}), în Sectorul ${s} ${stats.ongoing.length === 1 ? 'era' : 'erau'} ` +
        `${stats.ongoing.length === 1 ? '1 punct termic' : fmtCu(stats.ongoing.length, 'puncte termice')} cu apa caldă oprită.`,
    );
    if (latest?.announcedEnd) {
      nowParts.push(
        `Pentru cea mai recentă întrerupere (${latest.ptName}), Termoenergetica a anunțat reluarea până la ${fmtDateTimeRo(latest.announcedEnd)}.`,
      );
    }
  }
  if (stats.avarie.n > 0) {
    nowParts.push(
      `Istoric, avariile din Sectorul ${s} încheiate în ${win} s-au terminat în mediană după ` +
        `${fmtDurata(stats.avarie.medianHours)}, iar ${fmtPct(stats.avarie.shareUnder24hPct)} dintre ele în mai puțin de 24 de ore.`,
    );
    if (stats.avarie.metDeadlinePct !== null) {
      nowParts.push(
        `În ${fmtPct(stats.avarie.metDeadlinePct)} din cazuri întreruperea a dispărut din lista oficială de funcționare până la ora anunțată de Termoenergetica.`,
      );
    }
  }
  items.push({
    q: `Când se dă drumul la apa caldă în Sectorul ${s}?`,
    a: nowParts.join(' '),
  });

  // ---- 2. how long an unplanned outage lasts ----
  if (stats.avarie.n > 0) {
    items.push({
      q: `Cât durează o avarie de apă caldă în Sectorul ${s}?`,
      a:
        `Cele ${fmtCu(stats.avarie.n, 'avarii')} încheiate în Sectorul ${s} în ${win} au durat în mediană ` +
        `${fmtDurata(stats.avarie.medianHours)}: ${fmtPct(stats.avarie.shareUnder24hPct)} s-au terminat în ` +
        `mai puțin de 24 de ore, iar 10% au trecut de ${fmtDurata(stats.avarie.p90Hours)}. ` +
        `Durata se măsoară între prima și ultima apariție a punctului termic în lista oficială de funcționare.`,
    });
  }

  // ---- 3. how long a planned shutdown lasts ----
  if (stats.programat.n > 0) {
    items.push({
      q: `Cât durează o oprire programată în Sectorul ${s}?`,
      a:
        `Cele ${fmtCu(stats.programat.n, 'lucrări programate')} încheiate în Sectorul ${s} în ${win} ` +
        `au durat în mediană ${fmtDurata(stats.programat.medianHours)}, ` +
        `iar 10% dintre ele au trecut de ${fmtDurata(stats.programat.p90Hours)}. ` +
        `Reviziile și modernizările sunt anunțate din timp, cu o oră estimată pentru reluare.`,
    });
  }

  // ---- 4. why is it off ----
  const a = stats.row.mean_days_avarie;
  const p = stats.row.mean_days_programat;
  const which =
    a > p
      ? 'deci cele mai multe zile fără apă caldă vin din avarii neplanificate'
      : a < p
        ? 'deci cele mai multe zile fără apă caldă vin din lucrări programate'
        : 'deci avariile și lucrările programate cântăresc aproximativ la fel';
  items.push({
    q: `De ce nu am apă caldă în Sectorul ${s}?`,
    a:
      `În ${stats.year}, un punct termic din Sectorul ${s} a stat în medie ${fmtDec(a)} zile fără apă caldă ` +
      `din avarii și ${fmtDec(p)} zile din lucrări programate — ${which}. ` +
      `Cauza exactă se publică la nivel de punct termic, nu de sector: caută strada sau punctul termic care ` +
      `te deservește și vezi cauza raportată de Termoenergetica și ora anunțată pentru reluare.`,
  });

  // ---- 5. how often ----
  items.push({
    q: `Cât de des se întrerupe apa caldă în Sectorul ${s}?`,
    a:
      `În ${stats.year}, mediana a fost ${fmtZile(stats.row.median_days)} fără apă caldă pe punct termic în ` +
      `Sectorul ${s}, față de ${fmtZile(stats.city.medianDays)} în tot Bucureștiul — locul ${stats.rankByMedianDays} ` +
      `din 6 sectoare (locul 1 = cele mai multe zile). Sectorul are ${fmtCu(stats.row.pts, 'puncte termice')} și ` +
      `${fmtCu(stats.row.episodes, 'episoade')} de oprire înregistrate în ${stats.year}.`,
  });

  // ---- 6. worst streets ----
  if (stats.topStreets.length > 0) {
    const top = stats.topStreets.slice(0, 3);
    const list = top
      .map((st, i) => (i === 0 ? `${st.name} (${fmtZile(st.days)})` : `${st.name} (${fmtInt(st.days)})`))
      .join(', ');
    items.push({
      q: `Care străzi din Sectorul ${s} au fost cele mai afectate?`,
      a:
        `În ${stats.year}, cele mai multe zile cu întreruperi de apă caldă în Sectorul ${s} le-au avut ${list}. ` +
        `Cifra pe stradă este reuniunea zilelor tuturor punctelor termice care deservesc strada — nu ce a trăit ` +
        `un singur apartament.`,
    });
  }

  // ---- 7. seasonality ----
  if (stats.peakMonth.ptDays > 0) {
    const sameMonth = stats.peakMonthProgramat.month === stats.peakMonth.month;
    const programatSentence =
      stats.peakMonthProgramat.ptDays === 0
        ? ''
        : ` Vârful lucrărilor programate este ${sameMonth ? 'în aceeași lună' : `în ${monthNameRo(stats.peakMonthProgramat.month)}`},` +
          ` iar ${fmtPct(stats.programatSummerSharePct)} din zilele-punct-termic cu lucrări programate cad între iunie și septembrie.`;
    items.push({
      q: `În ce lună se oprește cel mai des apa caldă în Sectorul ${s}?`,
      a:
        `Cumulat pe ${monthWin}, luna cu cele mai multe zile-punct-termic fără apă caldă în Sectorul ${s} a fost ` +
        `${monthNameRo(stats.peakMonth.month)} (${fmtCu(stats.peakMonth.ptDays, 'zile-punct-termic')}).` +
        programatSentence,
    });
  }

  return items;
}
