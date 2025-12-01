const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const requireAuth = require('../middleware/authenticated');
const { getUserInfo } = require('../utils/keycloak');
const { getLastLogin } = require('../utils/userLogins');

// GET /api/users/profile
router.get('/profile', requireAuth, async (req, res) => {
  try {
    logger.info('User profile request', { ip: req.ip });

    const userInfo = await getUserInfo(req.session.user.accessToken);
    const lastLogin = await getLastLogin(userInfo.sub);

    userInfo.last_login = lastLogin || null;

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
