const { validateAndNormalize } = require('../src/services/dataValidator');
const { STRAINS, SOURCES } = require('../src/config/constants');

const validCase = {
  location: 'New Mexico, USA',
  country: 'USA',
  latitude: 34.5,
  longitude: -106.5,
  confirmed: 5,
  probable: 1,
  strain: STRAINS.SIN_NOMBRE,
  date: '2026-04-15',
  source: SOURCES.CDC,
};

describe('Data Validator', () => {
  it('accepts a valid case record', () => {
    const result = validateAndNormalize([validCase], SOURCES.CDC);
    expect(result).toHaveLength(1);
    expect(result[0].location).toBe('New Mexico, USA');
    expect(result[0].id).toBeDefined();
  });

  it('rejects case with no location and no country', () => {
    const bad = { ...validCase, location: undefined, country: undefined };
    const result = validateAndNormalize([bad], SOURCES.CDC);
    expect(result).toHaveLength(0);
  });

  it('rejects case with missing date', () => {
    const bad = { ...validCase, date: undefined };
    const result = validateAndNormalize([bad], SOURCES.CDC);
    expect(result).toHaveLength(0);
  });

  it('rejects case with out-of-range latitude', () => {
    const bad = { ...validCase, latitude: 200 };
    const result = validateAndNormalize([bad], SOURCES.CDC);
    expect(result).toHaveLength(0);
  });

  it('rejects case with out-of-range longitude', () => {
    const bad = { ...validCase, longitude: -400 };
    const result = validateAndNormalize([bad], SOURCES.CDC);
    expect(result).toHaveLength(0);
  });

  it('resolves coordinates from location name when lat/lng missing', () => {
    const noCoords = { ...validCase, latitude: undefined, longitude: undefined };
    const result = validateAndNormalize([noCoords], SOURCES.CDC);
    expect(result).toHaveLength(1);
    expect(result[0].latitude).toBeCloseTo(34.5, 0);
    expect(result[0].longitude).toBeCloseTo(-106.5, 0);
  });

  it('processes a mixed batch — keeps valid, drops invalid', () => {
    const cases = [
      validCase,
      { ...validCase, location: 'Colorado, USA', date: '2026-03-10' },
      { confirmed: 5, date: '2026-01-01' }, // missing location — invalid
    ];
    const result = validateAndNormalize(cases, SOURCES.CDC);
    expect(result).toHaveLength(2);
  });

  it('assigns source from parameter if not in raw', () => {
    const noSource = { ...validCase, source: undefined };
    const result = validateAndNormalize([noSource], SOURCES.WHO);
    expect(result[0].source).toBe(SOURCES.WHO);
  });

  it('defaults probable and inconclusive to 0', () => {
    const noProb = { ...validCase, probable: undefined, inconclusive: undefined };
    const result = validateAndNormalize([noProb], SOURCES.CDC);
    expect(result[0].probable).toBe(0);
    expect(result[0].inconclusive).toBe(0);
  });
});
