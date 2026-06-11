import Link from 'next/link';
import SearchBox from '@/components/SearchBox';
import { clientAsset, lastCompleteYear } from '@/lib/data';

const LINKS: { name: string; href: string }[] = [
  { name: 'Acasă', href: '/' },
  { name: 'Clasamente', href: '/clasament' },
  { name: 'Hartă', href: '/harta' },
  { name: 'Metodologie', href: '/metodologie' },
  { name: 'Despre', href: '/despre' },
];

export default function SiteNav() {
  return (
    <header className="hairline-b">
      <nav
        aria-label="Navigație principală"
        className="mx-auto flex max-w-5xl flex-wrap items-baseline gap-x-6 gap-y-2 px-4 py-4"
      >
        <Link href="/" className="font-display text-lg font-bold tracking-tight hover:underline">
          Fără Apă Caldă
        </Link>
        <ul className="flex flex-wrap items-baseline gap-x-5 text-sm">
          {LINKS.map((link) => (
            <li key={link.href}>
              <Link href={link.href} className="hover:underline">
                {link.name}
              </Link>
            </li>
          ))}
        </ul>
        <div className="ml-auto">
          <SearchBox
            variant="nav"
            indexUrl={clientAsset('search-index.json')}
            year={lastCompleteYear()}
          />
        </div>
      </nav>
    </header>
  );
}
