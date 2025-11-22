const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const requireAuth = require('../middleware/authenticated');
const { getUserInfo } = require('../utils/keycloak');

// GET /api/users/profile
router.get('/profile', requireAuth, async (req, res) => {
  try {
    logger.info('User profile request', { ip: req.ip });

    const userInfo = await getUserInfo(req.session.user.accessToken);

    res.json({
      profile: userInfo
    });
  } catch (error) {
    logger.error('Get user profile error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

module.exports = router;
