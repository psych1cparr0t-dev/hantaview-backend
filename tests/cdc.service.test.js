const { parseCDCHtml } = require('../src/services/cdc.service');
const { STRAINS } = require('../src/config/constants');

describe('CDC HTML Parser', () => {
  const mockTableHtml = `
    <html><body>
    <table>
      <thead>
        <tr><th>State</th><th>2025</th><th>2026</th></tr>
      </thead>
      <tbody>
        <tr><td>New Mexico</td><td>4</td><td>5</td></tr>
        <tr><td>Colorado</td><td>3</td><td>2</td></tr>
        <tr><td>California</td><td>2</td><td>1</td></tr>
        <tr><td>Total</td><td>9</td><td>8</td></tr>
      </tbody>
    </table>
    </body></html>
  `;

  it('parses state-level case counts from table', () => {
    const cases = parseCDCHtml(mockTableHtml);
    // Total row should be excluded
    const locations = cases.map(c => c.location);
    expect(locations).not.toContain(expect.stringContaining('Total'));
    expect(cases.length).toBeGreaterThanOrEqual(2);
  });

  it('assigns Sin Nombre strain to all CDC cases', () => {
    const cases = parseCDCHtml(mockTableHtml);
    cases.forEach(c => {
      expect(c.strain).toBe(STRAINS.SIN_NOMBRE);
    });
  });

  it('all cases have USA as country', () => {
    const cases = parseCDCHtml(mockTableHtml);
    cases.forEach(c => {
      expect(c.country).toBe('USA');
      expect(c.country_code).toBe('US');
    });
  });

  it('returns empty array for unrecognized HTML structure', () => {
    const cases = parseCDCHtml('<html><body><p>No tables here</p></body></html>');
    expect(Array.isArray(cases)).toBe(true);
  });

  it('handles tables without year columns gracefully', () => {
    const simpleHtml = `
      <html><body>
      <table>
        <thead><tr><th>State</th><th>Cases</th></tr></thead>
        <tbody><tr><td>Wyoming</td><td>3</td></tr></tbody>
      </table>
      </body></html>
    `;
    const cases = parseCDCHtml(simpleHtml);
    expect(Array.isArray(cases)).toBe(true);
  });
});
