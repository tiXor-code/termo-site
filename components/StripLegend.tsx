/**
 * Shared legend for OutageStrip. Server component. The PT page and the street
 * union disclosure had no legend at all, which became a real gap the moment the
 * strip started painting a fourth class.
 */
export default function StripLegend({ deficienta = false }: { deficienta?: boolean }) {
  return (
    <div className="legend">
      <span>
        <i style={{ background: 'var(--color-avarie)' }} />
        Avarii (defecțiuni)
      </span>
      <span>
        <i style={{ background: 'var(--color-programat)' }} />
        Lucrări programate
      </span>
      {deficienta && (
        <span>
          <i className="def" />
          Presiune sau temperatură scăzută
        </span>
      )}
      <span>
        <i style={{ background: 'var(--color-ok)' }} />A avut apă caldă
      </span>
    </div>
  );
}
