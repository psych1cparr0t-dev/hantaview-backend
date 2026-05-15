const { getAllSubscriptions, isAlreadyNotified, markNotified } = require('../db/alertsDb');
const { sendAlertEmail } = require('./mailer');
const logger = require('../utils/logger');

/**
 * Stable fingerprint for a case record so we never email the same
 * (subscription, case) pair twice — even across server restarts.
 */
function caseFingerprint(c) {
  return [c.country_code, c.date, c.strain, c.confirmed].join(':');
}

/**
 * Returns true when a case's coordinates fall within the subscription's
 * bounding box. Cases with no coordinates are skipped.
 */
function caseInZone(c, zone) {
  if (c.latitude == null || c.longitude == null) return false;
  return (
    c.latitude  >= zone.south &&
    c.latitude  <= zone.north &&
    c.longitude >= zone.west  &&
    c.longitude <= zone.east
  );
}

/**
 * Run after every successful data refresh.
 * Checks every subscription against the full case list and fires alert
 * emails for any (sub, case) pair that hasn't been notified yet.
 *
 * @param {object[]} cases  — deduplicated case array from the aggregator
 */
async function runAlertCheck(cases) {
  if (!process.env.RESEND_API_KEY) {
    logger.debug('RESEND_API_KEY not configured — alert check skipped');
    return;
  }

  let subs;
  try {
    subs = getAllSubscriptions();
  } catch (err) {
    logger.error({ message: 'Alert check: failed to read subscriptions', error: err.message });
    return;
  }

  if (!subs.length) {
    logger.debug('Alert check: no subscriptions registered');
    return;
  }

  logger.info({ message: `Alert check: ${cases.length} cases × ${subs.length} zones` });

  for (const sub of subs) {
    const newHits = cases.filter(
      c => caseInZone(c, sub) && !isAlreadyNotified(sub.id, caseFingerprint(c))
    );

    if (!newHits.length) continue;

    try {
      await sendAlertEmail({ to: sub.email, cases: newHits, zone: sub, unsubscribeId: sub.id });
      // Persist "notified" records only after the email actually sends
      newHits.forEach(c => markNotified(sub.id, caseFingerprint(c)));
      logger.info({ message: `Alerted ${sub.email}: ${newHits.length} case(s)`, subId: sub.id });
    } catch (err) {
      logger.error({ message: `Alert email failed for ${sub.email}`, error: err.message, subId: sub.id });
      // Don't mark as notified — will retry on next refresh cycle
    }
  }
}

module.exports = { runAlertCheck };
