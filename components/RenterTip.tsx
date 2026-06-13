// Renter takeaway (server). Dashed terracotta tip. Copy varies green vs not,
// verbatim from the /tmp/strada.html render logic.
import type { Grade } from '@/lib/verdict';

export default function RenterTip({ grade }: { grade: Grade }) {
  const good = grade === 'green';
  return (
    <div className="tip">
      <span className="ico" aria-hidden="true">
        💡
      </span>
      <div>
        {good ? (
          <>
            <b>Pentru chiriași:</b> zonă cu istoric bun pe rețeaua centralizată. Verifică totuși
            anii de mai jos pentru avarii repetate.
          </>
        ) : (
          <>
            <b>Pentru chiriași:</b> verifică anii de mai jos — dacă vezi avarii repetate, întreabă
            proprietarul dacă apartamentul are centrală proprie de apartament.
          </>
        )}
      </div>
    </div>
  );
}
