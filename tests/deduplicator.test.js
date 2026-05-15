const { deduplicateCases } = require('../src/utils/deduplicator');
const { STRAINS, SOURCES } = require('../src/config/constants');

const base = {
  location: 'Buenos Aires, Argentina',
  country: 'Argentina',
  country_code: 'AR',
  latitude: -34.6,
  longitude: -58.4,
  strain: STRAINS.ANDES,
  date: '2026-03-10',
  confirmed: 5,
  probable: 1,
  deaths: 1,
};

describe('Deduplicator', () => {
  it('passes through a single case unchanged', () => {
    const result = deduplicateCases([{ ...base, source: SOURCES.WHO }]);
    expect(result).toHaveLength(1);
  });

  it('merges two entries for the same outbreak', () => {
    const whoCopy = { ...base, source: SOURCES.WHO, confirmed: 5 };
    const ecdcCopy = { ...base, source: SOURCES.ECDC, confirmed: 7 };
    const result = deduplicateCases([whoCopy, ecdcCopy]);
    expect(result).toHaveLength(1);
    expect(result[0].confirmed).toBe(7); // max
    expect(result[0].source).toBe(SOURCES.MERGED);
  });

  it('keeps separate cases for different countries', () => {
    const ar = { ...base, source: SOURCES.WHO };
    const cl = { ...base, location: 'Santiago, Chile', country: 'Chile', country_code: 'CL', latitude: -33.45, longitude: -70.67, source: SOURCES.ECDC };
    const result = deduplicateCases([ar, cl]);
    expect(result).toHaveLength(2);
  });

  it('keeps separate cases for different strains', () => {
    const andes = { ...base, source: SOURCES.WHO };
    const seoul = { ...base, strain: STRAINS.SEOUL, source: SOURCES.ECDC };
    const result = deduplicateCases([andes, seoul]);
    expect(result).toHaveLength(2);
  });

  it('takes highest confirmed count when merging', () => {
    const low = { ...base, source: SOURCES.CDC, confirmed: 2 };
    const high = { ...base, source: SOURCES.ECDC, confirmed: 9 };
    const result = deduplicateCases([low, high]);
    expect(result[0].confirmed).toBe(9);
  });

  it('lists all contributing sources in source_list', () => {
    const a = { ...base, source: SOURCES.CDC };
    const b = { ...base, source: SOURCES.WHO };
    const c = { ...base, source: SOURCES.ECDC };
    const result = deduplicateCases([a, b, c]);
    expect(result).toHaveLength(1);
    expect(result[0].source_list).toEqual(expect.arrayContaining([SOURCES.CDC, SOURCES.WHO, SOURCES.ECDC]));
  });

  it('does not merge cases more than one week apart', () => {
    const early = { ...base, source: SOURCES.WHO, date: '2026-01-01' };
    const late = { ...base, source: SOURCES.ECDC, date: '2026-03-10' };
    const result = deduplicateCases([early, late]);
    expect(result).toHaveLength(2);
  });

  it('handles empty input', () => {
    expect(deduplicateCases([])).toEqual([]);
  });
});
