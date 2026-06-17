import { describe, expect, it } from 'vitest';
import { resolveAddr, type AddrMap } from '@/lib/address';

const ADDR: AddrMap = { '64': [1, 0.12], '66': [2, 0.2], '70': [2, 0.42], '12': [-1, 0.5] };
const PTS = ['pt-a', 'pt-b', 'pt-c'];

describe('resolveAddr', () => {
  it('exact hit returns the indexed serving PT', () => {
    expect(resolveAddr(ADDR, '64', PTS, null)).toEqual({ slug: 'pt-b', km: 0.12, interpolated: false });
    expect(resolveAddr(ADDR, '70', PTS, null)?.slug).toBe('pt-c');
  });

  it('-1 index uses inferredPt (null when there is none)', () => {
    expect(resolveAddr(ADDR, '12', PTS, 'pt-inf')).toEqual({ slug: 'pt-inf', km: 0.5, interpolated: false });
    expect(resolveAddr(ADDR, '12', PTS, null)).toBeNull();
  });

  it('missing number interpolates to the nearest known house number', () => {
    const r = resolveAddr(ADDR, '68', PTS, null);
    expect(r?.interpolated).toBe(true);
    expect(r?.km).toBeNull();
    expect(['pt-b', 'pt-c']).toContain(r?.slug);
    expect(resolveAddr(ADDR, '65', PTS, null)?.interpolated).toBe(true);
  });

  it('empty map or empty number -> null', () => {
    expect(resolveAddr({}, '64', PTS, null)).toBeNull();
    expect(resolveAddr(ADDR, '   ', PTS, null)).toBeNull();
  });

  it('out-of-range index -> null', () => {
    expect(resolveAddr({ '5': [9, 0.1] }, '5', PTS, null)).toBeNull();
  });
});
