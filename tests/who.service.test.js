const { parseWHOItem } = require('../src/services/who.service');
const { STRAINS, SOURCES } = require('../src/config/constants');

const makeItem = (overrides = {}) => ({
  title: ['Hantavirus - Argentina - 2026'],
  description: ['12 laboratory-confirmed cases of hantavirus disease, including 4 deaths, have been reported in Argentina. The cases are caused by Andes virus.'],
  pubDate: ['Wed, 01 May 2026 00:00:00 +0000'],
  link: ['https://www.who.int/emergencies/disease-outbreak-news/item/2026-DON123'],
  ...overrides,
});

describe('WHO RSS Item Parser', () => {
  it('parses a valid hantavirus DON item', () => {
    const result = parseWHOItem(makeItem());
    expect(result).not.toBeNull();
    expect(result.confirmed).toBe(12);
    expect(result.deaths).toBe(4);
    expect(result.strain).toBe(STRAINS.ANDES);
    expect(result.source).toBe(SOURCES.WHO);
    expect(result.verified).toBe(true);
  });

  it('returns null for non-hantavirus items', () => {
    const item = makeItem({
      title: ['Ebola - Congo - 2026'],
      description: ['Ebola virus disease outbreak in Congo.'],
    });
    expect(parseWHOItem(item)).toBeNull();
  });

  it('extracts country from title correctly', () => {
    const result = parseWHOItem(makeItem({ title: ['Hantavirus - Chile - 2026'] }));
    expect(result.country).toBe('Chile');
  });

  it('infers Seoul strain from description', () => {
    const item = makeItem({
      description: ['Seoul hantavirus cases reported in laboratory-confirmed patients. 3 confirmed cases, 0 deaths.'],
    });
    const result = parseWHOItem(item);
    expect(result.strain).toBe(STRAINS.SEOUL);
  });

  it('defaults to OTHER strain when no keyword matches', () => {
    const item = makeItem({
      description: ['Hantavirus cases reported. 5 confirmed cases.'],
    });
    const result = parseWHOItem(item);
    expect(result).not.toBeNull();
    expect(result.strain).toBe(STRAINS.OTHER);
  });

  it('normalizes date to YYYY-MM-DD', () => {
    const result = parseWHOItem(makeItem());
    expect(result.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('handles missing case count gracefully (defaults to 1)', () => {
    const item = makeItem({
      description: ['A hantavirus outbreak has been reported in Argentina. Response measures are underway.'],
    });
    const result = parseWHOItem(item);
    expect(result).not.toBeNull();
    expect(result.confirmed).toBeGreaterThanOrEqual(1);
  });
});
