const express = require('express');
const { getOutbreakData } = require('../services/aggregator');

const router = express.Router();

router.get('/mv-hondius', (req, res) => {
  const data = getOutbreakData();
  res.json({ status: 'success', data });
});

module.exports = router;
