import type { Metadata } from 'next';
import ClasamentPage, { UNITATI, clasamentH1, type Unitate } from '@/components/clasament/ClasamentPage';
import { getMeta, getYears, lastCompleteYear } from '@/lib/data';
import { yearLabel } from '@/lib/format';

export const dynamic = 'error';
export const dynamicParams = false;

export function generateStaticParams(): { unitate: Unitate; an: string }[] {
  const params: { unitate: Unitate; an: string }[] = [];
  for (const unitate of UNITATI) {
    for (const y of getYears()) {
      params.push({ unitate, an: String(y) });
    }
  }
  return params;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ unitate: Unitate; an: string }>;
}): Promise<Metadata> {
  const { unitate, an } = await params;
  const year = Number(an);
  const meta = getMeta();
  const titles: Record<Unitate, string> = {
    'puncte-termice': `Clasamentul punctelor termice după zile fără apă caldă — ${year}`,
    strazi: `Clasamentul străzilor după zile fără apă caldă — ${year}`,
    sectoare: `Sectoarele Bucureștiului după zile fără apă caldă — ${year}`,
  };
  // The last complete year's canonical home is the yearless page.
  const canonical =
    year === lastCompleteYear() ? `/clasament/${unitate}` : `/clasament/${unitate}/${year}`;
  return {
    title: titles[unitate],
    description: `${clasamentH1(unitate, yearLabel(year, meta))} — zile fără apă caldă în București, reconstruite din anunțurile publice Termoenergetica.`,
    alternates: { canonical },
  };
}

export default async function ClasamentAnPage({
  params,
}: {
  params: Promise<{ unitate: Unitate; an: string }>;
}) {
  const { unitate, an } = await params;
  return <ClasamentPage unitate={unitate} an={Number(an)} />;
}
