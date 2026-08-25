import type { Metadata } from 'next';
import Link from 'next/link';
import {
  getCitySummary,
  getMeta,
  getPtAll,
  getPtRanking,
  lastCompleteYear,
  type PtYear,
  type Run,
} from '@/lib/data';
import { deFor, fmtDateRo, fmtDec, fmtInt, fmtZile, yearLabel } from '@/lib/format';
import { JsonLd, datasetJsonLd } from '@/lib/seo';
import { DEFICIENTA_GUARD_DAYS } from '@/lib/verdict';

export const dynamic = 'error';

export const metadata: Metadata = {
  title: 'Metodologie — cum măsurăm întreruperile',
  description:
    'Cum reconstruim zilele fără apă caldă din București: surse, reconstrucția episoadelor, ce numărăm, limitări și verificări încrucișate.',
  alternates: { canonical: '/metodologie' },
};

export default function MetodologiePage() {
  const meta = getMeta();
  const summary = getCitySummary();
  const lcy = lastCompleteYear();

  // Every number below is computed at build from the same bundle the ranking
  // pages already load, so the published magnitude can never go stale.
  const allPts = [...getPtAll().values()];
  const deficientaByYear = meta.years.map((y) => {
    const rows = getPtRanking(y);
    // headline is identical either way (a zero-outage PT contributes 0 and is
    // absent from the ranking); deficienta is NOT - those same PTs still carry
    // deficiency days, so that half must be summed over the full universe.
    const headline = rows.reduce((a, r) => a + r.days, 0);
    const deficienta = allPts.reduce(
      (a, pt) => a + (pt.years[String(y)]?.days_deficienta ?? 0),
      0,
    );
    return {
      year: y,
      headline,
      deficienta,
      pct: headline > 0 ? Math.round((deficienta / headline) * 100) : 0,
    };
  });
  const lcyRow = deficientaByYear.find((d) => d.year === lcy);
  const lcyRows = getPtRanking(lcy);
  const worseThanOutage = lcyRows.filter((r) => r.days_deficienta > r.days).length;
  const worsePct = lcyRows.length > 0 ? (worseThanOutage / lcyRows.length) * 100 : 0;
  const cleanButDeficient = lcyRows.filter(
    (r) => r.days < 10 && r.days_deficienta >= DEFICIENTA_GUARD_DAYS,
  ).length;
  // Zero-outage PTs are dropped from the rankings entirely, so they are only
  // reachable through the entity file.
  const invisible = allPts
    .map((pt) => pt.years[String(lcy)])
    .filter((y): y is PtYear => y !== undefined && y.days === 0 && y.days_deficienta > 0);
  const invisibleDays = invisible.reduce((a, y) => a + y.days_deficienta, 0);

  // Share of deficiency days that fall on a day with NO outage. Computed, not
  // asserted: this sits under a sentence promising the section is recalculated
  // on every data refresh, and the true value drifts year to year (84-93%).
  const dayset = (runs: Run[], classes: readonly string[]) => {
    const out = new Set<number>();
    for (const [start, len, cause] of runs) {
      if (classes.includes(cause)) for (let i = 0; i < len; i++) out.add(start + i);
    }
    return out;
  };
  let defTotal = 0;
  let defOverlap = 0;
  for (const pt of getPtAll().values()) {
    for (const y of Object.values(pt.years)) {
      const d = dayset(y.runs, ['deficienta']);
      if (d.size === 0) continue;
      const h = dayset(y.runs, ['avarie', 'programat', 'unclassified']);
      defTotal += d.size;
      for (const doy of d) if (h.has(doy)) defOverlap += 1;
    }
  }
  const netNewPct = defTotal > 0 ? (100 * (defTotal - defOverlap)) / defTotal : 0;

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="font-display text-3xl font-bold">Metodologie</h1>
      <p className="mt-3 max-w-2xl text-ink-soft">
        Tot ce vedeți pe acest site este reconstruit din anunțurile publice Termoenergetica,
        arhivate independent din decembrie 2021 până la {fmtDateRo(meta.data_through)}. Mai jos:
        de unde vin datele, cum le transformăm în episoade și zile, și unde greșesc.
      </p>

      <section id="surse" className="mt-12 border-t border-hairline pt-6">
        <h2 className="font-display text-2xl font-bold">Surse de date</h2>
        <div className="mt-3 max-w-2xl space-y-3 leading-relaxed">
          <p>
            Sursa primară este pagina publică de „funcționare" a Termoenergetica București
            (cmteb.ro), care listează punctele termice cu întreruperi de apă caldă (ACC), cauza
            raportată și termenul estimat de remediere. Pagina a fost arhivată automat, în medie la
            fiecare oră, începând cu 19 decembrie 2021 — întâi de o arhivă comunitară independentă,
            apoi, de la {fmtDateRo(meta.sources_cutover_utc.slice(0, 10))}, de propriul nostru
            colector.
          </p>
          <p>
            Coordonatele și registrul punctelor termice provin din harta oficială a rețelei
            ({fmtInt(meta.universe_size)} puncte termice în universul de referință). Limitele
            sectoarelor sunt derivate din OpenStreetMap și sunt folosite sub licența{' '}
            <a href="https://opendatacommons.org/licenses/odbl/" className="underline">
              ODbL
            </a>{' '}
            — © contribuitorii OpenStreetMap.
          </p>
        </div>
        <h3 className="mt-6 font-display text-lg font-bold">Acoperirea colectării, pe ani</h3>
        <table className="mt-3 w-full max-w-xl border-collapse text-sm tnum">
          <thead>
            <tr className="hairline-b text-left text-xs text-ink-soft">
              <th scope="col" className="py-2 pr-3 font-normal">An</th>
              <th scope="col" className="py-2 pr-3 text-right font-normal">Instantanee</th>
              <th scope="col" className="py-2 pr-3 text-right font-normal">Zile lipsă</th>
              <th scope="col" className="py-2 text-right font-normal">Cea mai lungă pauză (ore)</th>
            </tr>
          </thead>
          <tbody>
            {meta.years.map((y) => {
              const cov = meta.coverage[String(y)];
              if (!cov) return null;
              return (
                <tr key={y} className="hairline-b">
                  <td className="py-2 pr-3">{y}</td>
                  <td className="py-2 pr-3 text-right">{fmtInt(cov.snapshots)}</td>
                  <td className="py-2 pr-3 text-right">{fmtInt(cov.missing_days)}</td>
                  <td className="py-2 text-right">{fmtDec(cov.gap_hours_max)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section id="episoade" className="mt-12 border-t border-hairline pt-6">
        <h2 className="font-display text-2xl font-bold">Cum reconstruim episoadele</h2>
        <div className="mt-3 max-w-2xl space-y-3 leading-relaxed">
          <p>
            Un episod este intervalul continuu în care un punct termic apare pe pagina de
            funcționare cu aceeași problemă: începe la prima apariție și se închide când dispare
            din listă. Instantaneele succesive ale paginii sunt comparate; un punct termic care
            rămâne listat prelungește episodul, unul care dispare îl închide.
          </p>
          <p>
            Pauzele de colectare sunt tratate explicit: dacă sursa a avut o întrerupere în timpul
            unui episod, episodul este marcat ca interval estimat (≈) și creditul de durată la
            margini este plafonat la 3 ore pe fiecare parte, ca pauzele lungi de arhivă să nu umfle
            duratele. Episoadele care traversează miezul nopții de Anul Nou sunt împărțite pe ani
            calendaristici.
          </p>
        </div>
      </section>

      <section id="ce-numaram" className="mt-12 border-t border-hairline pt-6">
        <h2 className="font-display text-2xl font-bold">Ce numărăm</h2>
        <div className="mt-3 max-w-2xl space-y-3 leading-relaxed">
          <p>
            O „zi cu întrerupere" = o zi calendaristică atinsă de cel puțin un episod de oprire a
            apei calde (avarie sau lucrare programată). Deficiențele (presiune sau temperatură
            scăzută) se numără separat și nu intră în indicatorul principal. Cât de mult
            înseamnă „separat" — mai jos.
          </p>
          <p>
            Zilele sunt zile calendaristice locale (București). Indicatorul principal al unui an
            este numărul de zile distincte atinse de cel puțin un episod de oprire — nu suma
            duratelor. O zi atinsă și de o avarie și de o lucrare programată se numără o singură
            dată în total, dar apare în ambele defalcări — de aceea „din care avarii" plus „din
            care programate" poate depăși totalul. Încălzirea (INC) nu face parte din această
            versiune a datelor.
          </p>
        </div>
      </section>

      <section id="deficiente" className="mt-12 border-t border-hairline pt-6">
        <h2 className="font-display text-2xl font-bold">Cât de mare e ce nu numărăm</h2>
        <div className="mt-3 max-w-2xl space-y-3 leading-relaxed">
          <p>
            Indicatorul principal numără doar zilele de <b>oprire</b> a apei calde. Pe lângă
            ele, Termoenergetica anunță <b>deficiențe</b>: presiune sau temperatură scăzută — apă
            călduță sau care abia curge, dar care tehnic nu e „oprită". Nu le adunăm la
            indicatorul principal, pentru că sunt o altă stare. Dar nu sunt o notă de subsol, așa
            că le arătăm aici, la scară, recalculate la fiecare actualizare a datelor.
          </p>
          <p>
            În {lcy}, punctele termice din București au adunat{' '}
            <b>{fmtZile(lcyRow?.headline ?? 0)} de oprire</b> (punct termic × zi) și, pe
            lângă ele, <b>{fmtZile(lcyRow?.deficienta ?? 0)} cu presiune sau temperatură
            scăzută</b>, numărate separat. {fmtDec(netNewPct, 0)}% dintre zilele cu deficiențe cad
            în zile în care apa <i>nu</i> era oprită: sunt zile în plus, nu aceleași zile numărate
            de două ori.
          </p>
        </div>

        <h3 className="mt-6 font-display text-lg font-bold">Pe ani</h3>
        <table className="mt-3 w-full max-w-xl border-collapse text-sm tnum">
          <thead>
            <tr className="hairline-b text-left text-xs text-ink-soft">
              <th scope="col" className="py-2 pr-3 font-normal">An</th>
              <th scope="col" className="py-2 pr-3 text-right font-normal">Zile de oprire</th>
              <th scope="col" className="py-2 pr-3 text-right font-normal">Zile cu deficiențe</th>
              <th scope="col" className="py-2 text-right font-normal">Deficiențe față de opriri</th>
            </tr>
          </thead>
          <tbody>
            {deficientaByYear.map((d) => (
              <tr key={d.year} className="hairline-b">
                <td className="py-2 pr-3">{yearLabel(d.year, meta)}</td>
                <td className="py-2 pr-3 text-right">{fmtInt(d.headline)}</td>
                <td className="py-2 pr-3 text-right">{fmtInt(d.deficienta)}</td>
                <td className="py-2 text-right">{d.pct}%</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-ink-soft">
          Zile cumulate punct termic × zi, pe toate punctele termice din București — inclusiv
          cele care nu apar în clasamentul anului pentru că nu au avut nicio oprire.
        </p>

        <h3 className="mt-6 font-display text-lg font-bold">Pe cine ascunde</h3>
        <ul className="mt-3 max-w-2xl list-disc space-y-2 pl-5 leading-relaxed">
          <li>
            <b>{fmtInt(worseThanOutage)}</b> din cele {fmtInt(lcyRows.length)} {deFor(lcyRows.length)}puncte termice
            clasate în {lcy} ({fmtDec(worsePct)}%) au avut mai multe zile cu deficiențe decât zile
            de oprire.
          </li>
          <li>
            La <b>{fmtInt(cleanButDeficient)}</b> puncte termice, verdictul calculat doar din
            opriri ar fi ieșit „Curat" (sub 10 zile), deși au avut cel puțin{' '}
            {DEFICIENTA_GUARD_DAYS} de zile cu presiune sau temperatură scăzută. Pentru ele,
            verdictul de pe pagină trece la „Moderat" — numărul mare rămâne neschimbat, doar
            eticheta spune adevărul întreg.
          </li>
          <li>
            <b>{fmtInt(invisible.length)}</b> puncte termice au avut zero zile de oprire în {lcy},
            dar {fmtZile(invisibleDays)} cu deficiențe. Cum clasamentele se construiesc pe
            zilele de oprire, ele lipsesc complet din clasamente și apar „curate" pe hartă.
          </li>
        </ul>

        <p className="mt-4 max-w-2xl leading-relaxed">
          Regula, pe scurt: numărul mare de pe fiecare pagină rămâne numărul zilelor de oprire și
          nu se schimbă niciodată din cauza deficiențelor. Deficiențele apar ca al doilea număr,
          iar dacă depășesc {DEFICIENTA_GUARD_DAYS} de zile într-un an, verdictul unei zone nu mai
          poate fi „Curat".
        </p>
      </section>

      <section id="avarii-vs-programate" className="mt-12 border-t border-hairline pt-6">
        <h2 className="font-display text-2xl font-bold">Avarii vs lucrări programate</h2>
        <div className="mt-3 max-w-2xl space-y-3 leading-relaxed">
          <p>
            Clasificarea vine din textul cauzei raportate de Termoenergetica: avariile sunt
            defecțiuni neplanificate (spărturi, intervenții de urgență), lucrările programate sunt
            revizii și modernizări anunțate (de exemplu „Revizie tehnică CTE Progresu"). Cauzele
            care nu pot fi clasificate rămân „neclasificate" — în anii recenți, 3–6% din episoadele
            de oprire.
          </p>
        </div>
      </section>

      <section id="strazi" className="mt-12 border-t border-hairline pt-6">
        <h2 className="font-display text-2xl font-bold">De ce punctul termic, nu strada</h2>
        <div className="mt-3 max-w-2xl space-y-3 leading-relaxed">
          <p>
            Termoenergetica raportează întreruperile la nivel de punct termic — unitatea care
            deservește un grup de blocuri. Zilele unei străzi sunt reuniunea zilelor punctelor
            termice care au listat strada în anunțuri: „strada X, 200 de zile" înseamnă „200 de
            zile în care cel puțin o adresă de pe stradă a fost afectată", nu că toată strada a
            stat fără apă caldă 200 de zile. Arterele mari, deservite de zeci de puncte termice,
            ajung astfel la totaluri mari — efect real al reuniunii, documentat și verificat.
          </p>
        </div>
      </section>

      <section id="limitari" className="mt-12 border-t border-hairline pt-6">
        <h2 className="font-display text-2xl font-bold">Limitări</h2>
        <ul className="mt-3 max-w-2xl list-disc space-y-2 pl-5 leading-relaxed">
          <li>
            Datele reflectă ce a publicat Termoenergetica — întreruperile neraportate nu există în
            date.
          </li>
          <li>
            Pauzele de colectare (vezi tabelul de acoperire) pot pierde episoade scurte; episoadele
            care traversează pauze sunt marcate ca estimate.
          </li>
          <li>
            Anii parțiali ({meta.partial_years.join(', ')}) nu sunt comparabili direct cu anii
            întregi.
          </li>
          <li>
            Numărul de blocuri deservite de un punct termic este o estimare din anunțuri, nu o
            evidență oficială.
          </li>
          <li>
            Site-ul se reconstruiește o dată pe noapte. O avarie rezolvată recent poate apărea încă
            activă („în curs") până la următoarea actualizare.
          </li>
          <li>
            Termoenergetica numește doar o parte dintre străzile pe care le deservește un punct
            termic. Pentru o stradă pe care nu a numit-o niciodată, îi estimăm punctul termic după
            proximitate (cel mai apropiat punct termic ale cărui străzi numite sunt în preajmă) și
            o marcăm clar drept estimare. Estimarea poate fi greșită; sursa sigură ar fi registrul
            intern CMTEB.
          </li>
          <li>
            Căutarea după număr (de ex. „Colentina 64") alege, dintre punctele termice care
            deservesc strada, pe cel mai apropiat de adresa respectivă — coordonatele numerelor
            poștale vin din OpenStreetMap (ODbL), cu acoperire parțială. E tot o estimare după
            proximitate, nu o cartare oficială adresă–punct termic; un număr care lipsește din
            hartă folosește cea mai apropiată adresă cunoscută.
          </li>
        </ul>
      </section>

      <section id="verificari" className="mt-12 border-t border-hairline pt-6">
        <h2 className="font-display text-2xl font-bold">
          Verificări încrucișate (PMB, ANRE, Wayback)
        </h2>
        <div className="mt-3 max-w-2xl space-y-3 leading-relaxed">
          <p>
            Arhiva a fost verificată independent față de Internet Archive (Wayback Machine): 134 de
            copii arhivate ale paginii de funcționare, comparabile cu cel mai apropiat instantaneu
            propriu din interval de 6 ore, dau o similaritate Jaccard medie de 0,951 a seturilor de
            înregistrări — istoricul colectat coincide cu ce a capturat independent Internet
            Archive.
          </p>
          <p>
            Suplimentar, reconstituiri independente (recensământ complet al instantaneelor din
            2024) au reprodus exact numărul de zile pentru punctele termice eșantionate, iar
            cifrele agregate au fost confruntate cu rapoartele publice PMB și ANRE privind starea
            sistemului de termoficare.
          </p>
        </div>
      </section>

      <section id="citare" className="mt-12 border-t border-hairline pt-6">
        <h2 className="font-display text-2xl font-bold">Cum citați aceste date</h2>
        <div className="mt-3 max-w-2xl space-y-3 leading-relaxed">
          <p className="border-l-2 border-hairline pl-3">
            Fără Apă Caldă (faraapacalda.ro), pe baza anunțurilor publice Termoenergetica
            (cmteb.ro), decembrie 2021 – {meta.data_through.slice(0, 4)}.
          </p>
          <p>
            Setul de date complet se poate descărca ca{' '}
            <a
              href="https://github.com/tiXor-code/termo-data/releases/download/data-latest/bundle.tar.gz"
              className="underline"
            >
              arhivă publică
            </a>
            , regenerată în fiecare noapte.
          </p>
        </div>
      </section>

      <section id="changelog" className="mt-12 border-t border-hairline pt-6">
        <h2 className="font-display text-2xl font-bold">Istoric modificări</h2>
        <ul className="mt-3 max-w-2xl list-disc space-y-2 pl-5 leading-relaxed">
          <li>
            {fmtDateRo(meta.generated_at.slice(0, 10))} — ultima regenerare a setului de date
            (date până la {fmtDateRo(meta.data_through)}).
          </li>
          <li>
            August 2026 — deficiențele (presiune sau temperatură scăzută) sunt acum afișate pe
            paginile de punct termic și de stradă, pe cele de sector, în clasamente și în
            calendarul întreruperilor, cu mărimea lor publicată mai sus. Harta rămâne colorată
            doar după zilele de oprire. Indicatorul principal nu s-a schimbat: numără în
            continuare doar zilele de oprire, iar toate cifrele istorice au rămas identice.
            Singura schimbare de verdict: o zonă cu cel puțin {DEFICIENTA_GUARD_DAYS} de zile cu
            deficiențe într-un an nu mai poate fi etichetată „Curat".
          </li>
          <li>
            Iunie 2026 — prima versiune publică: episoade de oprire ACC, {summary.length} ani de
            istorie, {fmtInt(meta.universe_size)} puncte termice în univers.
          </li>
        </ul>
        <p className="mt-4 text-sm text-ink-soft">
          Întrebări sau corecturi:{' '}
          <Link href="/despre" className="underline">
            pagina Despre
          </Link>
          .
        </p>
      </section>

      <JsonLd data={datasetJsonLd(meta)} />
    </main>
  );
}
