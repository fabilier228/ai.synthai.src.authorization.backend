const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const requireAuth = require('../middleware/authenticated');
const { getUserInfo, getUsers, deleteUser } = require('../utils/keycloak');
const { getLastLogin } = require('../utils/userLogins');

// GET /api/users
router.get('/', requireAuth, async (req, res) => {
  try {
    const users = await getUsers(req.session.user.accessToken);
    res.json(users);
  } catch (error) {
    logger.error('Get users error:', error);
    if (error.response && error.response.status === 403) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

// DELETE /api/users/:id
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    await deleteUser(req.session.user.accessToken, id);
    res.status(204).send();
  } catch (error) {
    logger.error('Delete user error:', error);
    if (error.response && error.response.status === 403) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

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
