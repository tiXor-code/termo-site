import { getCitySummary, getMeta, getPtRanking, lastCompleteYear } from "@/lib/data";
import { siteUrl } from "@/lib/seo";

// /llms.txt - machine-readable site primer for AI crawlers/agents (GEO).
// Statically generated at build time, so numbers refresh with every nightly
// data deploy, same as the rest of the site.
export const dynamic = "force-static";

export async function GET() {
  const meta = getMeta();
  const lcy = lastCompleteYear();
  const summary = getCitySummary().filter((y) => !y.partial && y.year > 2021);
  const worst = getPtRanking(lcy)[0];

  const lines = [
    "# Fără Apă Caldă",
    "",
    "> Câte zile pe an stă Bucureștiul fără apă caldă: istoric multi-anual al întreruperilor",
    "> de apă caldă (sistemul centralizat Termoenergetica/CMTEB), reconstruit din anunțurile",
    "> publice și agregat pe punct termic, stradă și sector.",
    "> (English: multi-year history of Bucharest district-heating hot-water outages,",
    "> rebuilt from the public utility announcements; rankings per thermal point, street, sector.)",
    "",
    `Date acoperite: decembrie 2021 - ${meta.data_through}. Actualizare: zilnic (scraper la 15 minute + reconstrucție nocturnă).`,
    "",
    "## Cifre cheie (mediana zilelor cu întreruperi pe punct termic, pe an)",
    "",
    ...summary.map(
      (y) =>
        `- ${y.year}: mediana ${y.median_pt_days} zile, ${y.share_universe_hit_pct}% din cele ${meta.universe_size} puncte termice afectate cel puțin o dată (${y.episodes} episoade)`,
    ),
    `- Cel mai afectat punct termic în ${lcy}: ${worst.name} (Sector ${worst.sector}), ${worst.days} zile.`,
    "",
    "## Pagini principale",
    "",
    `- [Clasamente](${siteUrl(`/clasament/puncte-termice/${lcy}`)}): puncte termice, străzi și sectoare, pe ani`,
    `- [Acasă + căutare](${siteUrl("/")}): caută orice stradă sau punct termic`,
    `- [Hartă](${siteUrl("/harta")}): toate punctele termice, colorate după zilele cu întreruperi`,
    `- [Metodologie](${siteUrl("/metodologie")}): surse, reguli de numărare, limitări, verificări încrucișate (Wayback, PMB, ANRE)`,
    "",
    "## Definiția indicatorului",
    "",
    'O "zi cu întrerupere" = o zi calendaristică atinsă de cel puțin un episod de oprire a',
    "apei calde (avarie sau lucrare programată) la punctul termic respectiv. Deficiențele",
    "(presiune/temperatură scăzută) se numără separat. Întreruperile sunt raportate de",
    "Termoenergetica la nivel de punct termic; zilele unei străzi sunt reuniunea zilelor",
    "punctelor termice care o deservesc.",
    "",
    "## Date și atribuire",
    "",
    "- Sursa primară: anunțurile publice Termoenergetica/CMTEB (cmteb.ro), arhivate independent",
    "- Arhive istorice: github.com/FlorinPopaCodes/termoficare-data, github.com/gov2-ro/prometeu",
    "- Pachet de date (regenerat zilnic): https://github.com/tiXor-code/termo-data/releases/download/data-latest/bundle.tar.gz",
    "- Limite sectoare: OpenStreetMap, licență ODbL",
    `- Citare: Fără Apă Caldă (faraapacalda.ro), pe baza anunțurilor publice Termoenergetica (cmteb.ro), decembrie 2021 - ${lcy}.`,
    "",
  ];

  return new Response(lines.join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
