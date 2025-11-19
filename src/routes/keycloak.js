// src/routes/keycloak.js

const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');

// GET /api/keycloak/config
router.get('/config', async (req, res) => {
  try {
    logger.info('Keycloak config request', { ip: req.ip });

    const config = {
      url: process.env.KEYCLOAK_URL || 'http://localhost:8080',
      realm: process.env.KEYCLOAK_REALM || 'synthai',
      clientId: process.env.KEYCLOAK_CLIENT_ID || 'synthai-logic-client'
    };

    res.json(config);
  } catch (error) {
    logger.error('Keycloak config error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

// GET /api/keycloak/debug-env
router.get('/debug-env', (req, res) => {
  res.json({
    KEYCLOAK_URL: process.env.KEYCLOAK_URL,
    KEYCLOAK_REALM: process.env.KEYCLOAK_REALM,
    KEYCLOAK_CLIENT_ID: process.env.KEYCLOAK_CLIENT_ID,
    KEYCLOAK_REDIRECT_URI: process.env.KEYCLOAK_REDIRECT_URI
  });
});

module.exports = router;
