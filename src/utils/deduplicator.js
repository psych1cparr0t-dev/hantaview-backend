const { SOURCE_PRIORITY, SOURCES } = require('../config/constants');

/**
 * Groups cases that represent the same outbreak event, then merges them
 * by source priority: ECDC > WHO > CDC > manual
 */
function deduplicateCases(cases) {
  const groups = new Map();

  for (const c of cases) {
    const key = buildKey(c);
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(c);
  }

  return Array.from(groups.values()).map(mergeCaseGroup);
}

function buildKey(c) {
  const country = (c.country_code || c.country || '').toLowerCase();
  const strain = (c.strain || '').toLowerCase();
  // Round date to week to absorb minor reporting-date differences
  const weekDate = toWeekDate(c.date);
  // Round coordinates to ~50km precision for grouping
  const latBucket = Math.round((c.latitude || 0) * 2) / 2;
  const lngBucket = Math.round((c.longitude || 0) * 2) / 2;
  return `${country}|${strain}|${weekDate}|${latBucket},${lngBucket}`;
}

function toWeekDate(dateStr) {
  if (!dateStr) return 'unknown';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  // Truncate to Monday of that week
  const day = d.getUTCDay();
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() - ((day + 6) % 7));
  return monday.toISOString().slice(0, 10);
}

function mergeCaseGroup(group) {
  if (group.length === 1) return group[0];

  // Sort by source priority (highest first)
  const sorted = [...group].sort((a, b) => {
    const ai = SOURCE_PRIORITY.indexOf(a.source);
    const bi = SOURCE_PRIORITY.indexOf(b.source);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  const primary = sorted[0];
  const allSources = [...new Set(group.map(c => c.source))];

  return {
    ...primary,
    confirmed: Math.max(...group.map(c => c.confirmed || 0)),
    probable: group.reduce((sum, c) => sum + (c.probable || 0), 0),
    deaths: Math.max(...group.map(c => c.deaths || 0)),
    source: allSources.length > 1 ? SOURCES.MERGED : primary.source,
    source_list: allSources,
    updated_at: new Date().toISOString(),
  };
}

module.exports = { deduplicateCases };
