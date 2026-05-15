const express = require('express');
const { z } = require('zod');
const { v4: uuidv4 } = require('uuid');
const {
  createSubscription,
  getSubscription,
  deleteSubscription,
  countByEmail,
} = require('../db/alertsDb');
const logger = require('../utils/logger');

const router = express.Router();

const MAX_ZONES_PER_EMAIL = 5;

const CreateSchema = z.object({
  email: z.string().email().max(254).transform(s => s.toLowerCase().trim()),
  north: z.number().min(-90).max(90),
  south: z.number().min(-90).max(90),
  east:  z.number().min(-180).max(180),
  west:  z.number().min(-180).max(180),
}).refine(d => d.north > d.south, {
  message: 'north must be greater than south',
  path: ['north'],
}).refine(d => d.east !== d.west, {
  message: 'east and west cannot be equal (zero-width zone)',
  path: ['east'],
});

// ─── POST /api/alerts ─────────────────────────────────────────────────────────
// Register a new alert zone subscription.
router.post('/', async (req, res, next) => {
  try {
    const body = CreateSchema.parse(req.body);

    const existing = countByEmail(body.email);
    if (existing >= MAX_ZONES_PER_EMAIL) {
      return res.status(429).json({
        status: 'error',
        message: `Maximum ${MAX_ZONES_PER_EMAIL} zones per email address. Unsubscribe an existing zone first.`,
        error_code: 'ZONE_LIMIT_EXCEEDED',
      });
    }

    const sub = createSubscription({ id: uuidv4(), ...body });
    logger.info({ message: `Alert zone registered`, email: body.email, id: sub.id });

    return res.status(201).json({
      status: 'success',
      data: {
        id:         sub.id,
        email:      sub.email,
        created_at: sub.created_at,
      },
      message: 'Alert zone registered. You will receive an email when confirmed cases are reported within your boundary.',
    });
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid request body',
        error_code: 'VALIDATION_ERROR',
        details: err.errors,
        timestamp: new Date().toISOString(),
      });
    }
    next(err);
  }
});

// ─── GET /api/alerts/:id ──────────────────────────────────────────────────────
// Confirm a subscription exists — also handles browser-friendly ?action=unsubscribe.
router.get('/:id', (req, res) => {
  const { id } = req.params;

  if (req.query.action === 'unsubscribe') {
    const deleted = deleteSubscription(id);
    const msg = deleted
      ? 'You have been unsubscribed. Your email and zone have been permanently removed.'
      : 'Subscription not found — it may have already been removed.';
    logger.info({ message: `Unsubscribe via link: id=${id}, deleted=${deleted}` });
    return res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Hantaview — Unsubscribed</title>
  <style>
    body { margin:0; display:flex; align-items:center; justify-content:center; min-height:100vh;
           background:#0a1a1a; font-family:'Courier New',monospace; color:#c8e6e6; }
    .card { text-align:center; padding:40px; border:1px solid #20c9c9; border-radius:4px; max-width:420px; }
    .icon { font-size:32px; margin-bottom:16px; }
    .msg  { font-size:14px; line-height:1.7; color:#99c0c0; margin-bottom:24px; }
    a { color:#20c9c9; text-decoration:none; font-size:12px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✓</div>
    <div class="msg">${msg}</div>
    <a href="https://psych1cparr0t-dev.github.io/hantaview/">Return to Hantaview</a>
  </div>
</body>
</html>`);
  }

  const sub = getSubscription(id);
  if (!sub) {
    return res.status(404).json({
      status: 'error',
      message: 'Subscription not found',
      error_code: 'NOT_FOUND',
    });
  }

  return res.json({
    status: 'success',
    data: { id: sub.id, email: sub.email, created_at: sub.created_at },
  });
});

// ─── DELETE /api/alerts/:id ───────────────────────────────────────────────────
// Programmatic unsubscribe (used by the frontend).
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const deleted = deleteSubscription(id);

  if (!deleted) {
    return res.status(404).json({
      status: 'error',
      message: 'Subscription not found',
      error_code: 'NOT_FOUND',
    });
  }

  logger.info({ message: `Alert zone deleted via API: ${id}` });
  return res.json({
    status: 'success',
    message: 'Alert zone removed. You will no longer receive notifications for this zone.',
  });
});

module.exports = router;
