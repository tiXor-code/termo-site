import type { Metadata } from 'next';
import ClasamentPage, { UNITATI, clasamentH1, type Unitate } from '@/components/clasament/ClasamentPage';
import { getMeta, lastCompleteYear } from '@/lib/data';
import { yearLabel } from '@/lib/format';

export const dynamic = 'error';
export const dynamicParams = false;

export function generateStaticParams(): { unitate: Unitate }[] {
  return UNITATI.map((unitate) => ({ unitate }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ unitate: Unitate }>;
}): Promise<Metadata> {
  const { unitate } = await params;
  const meta = getMeta();
  const lcy = lastCompleteYear();
  const titles: Record<Unitate, string> = {
    'puncte-termice': `Clasamentul punctelor termice după zile fără apă caldă — ${lcy}`,
    strazi: `Clasamentul străzilor după zile fără apă caldă — ${lcy}`,
    sectoare: `Sectoarele Bucureștiului după zile fără apă caldă — ${lcy}`,
  };
  return {
    title: titles[unitate],
    description: `${clasamentH1(unitate, yearLabel(lcy, meta))} — zile fără apă caldă în București, reconstruite din anunțurile publice Termoenergetica.`,
    alternates: { canonical: `/clasament/${unitate}` },
  };
}

export default async function ClasamentUnitatePage({
  params,
}: {
  params: Promise<{ unitate: Unitate }>;
}) {
  const { unitate } = await params;
  return <ClasamentPage unitate={unitate} an={lastCompleteYear()} />;
}
