const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const {
  getLoginUrl,
  exchangeCodeForTokens,
  getUserInfo,
  logoutFromKeycloak,
  resolveRedirectUri
} = require('../utils/keycloak');

// GET /api/auth/login
// Redirects browser to Keycloak login (Authorization Code Flow)
router.get('/login', async (req, res) => {
  try {
    const redirectUri = resolveRedirectUri(req);
    const { url, state, nonce } = getLoginUrl(redirectUri, 'login');

    // Save state/nonce/redirectUri in session to validate callback
    req.session.oauth2 = { state, nonce, redirectUri };

    return res.redirect(url);
  } catch (error) {
    logger.error('Login redirect error:', {
      error: error.message,
      stack: error.stack
    });

    return res.status(500).json({
      error: 'Internal server error'
    });
  }
});

// GET /api/auth/register
// Redirects browser to Keycloak registration page
router.get('/register', async (req, res) => {
  try {
    const redirectUri = resolveRedirectUri(req);
    const { url, state, nonce } = getLoginUrl(redirectUri, 'register');

    // Save state/nonce/redirectUri in session to validate callback
    req.session.oauth2 = { state, nonce, redirectUri };

    return res.redirect(url);
  } catch (error) {
    logger.error('Register redirect error:', {
      error: error.message,
      stack: error.stack
    });

    return res.status(500).json({
      error: 'Internal server error'
    });
  }
});

// GET /api/auth/callback
// Keycloak redirects here with ?code=&state=
router.get('/callback', async (req, res) => {
  try {
    const { code, state } = req.query;

    if (!code) {
      return res.status(400).json({ error: 'Missing authorization code' });
    }

    // Validate state
    if (req.session.oauth2?.state && state !== req.session.oauth2.state) {
      return res.status(400).json({ error: 'Invalid state' });
    }

    const redirectUri =
      req.session.oauth2?.redirectUri || resolveRedirectUri(req);

    const tokenResponse = await exchangeCodeForTokens(code, redirectUri);
    logger.info('Tokens from Keycloak', {
      hasAccessToken: !!tokenResponse.access_token,
      hasIdToken: !!tokenResponse.id_token,
      accessTokenPreview: tokenResponse.access_token?.slice(0, 30)
    });
    const userInfo = await getUserInfo(tokenResponse.access_token);

    // Save session (BFF style – tokens on backend, cookie HttpOnly)
    req.session.user = {
      username: userInfo.preferred_username || userInfo.sub,
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token,
      idToken: tokenResponse.id_token,
      expiresIn: tokenResponse.expires_in
    };

    // Clean temp data
    delete req.session.oauth2;

    // CRITICAL: Save session before redirect
    req.session.save((err) => {
      if (err) {
        logger.error('Session save error:', err);
        return res.status(500).json({ error: 'Failed to save session' });
      }
      
      // Redirect to frontend home page after successful authentication
      return res.redirect(process.env.FRONTEND_URL || 'https://synthai.pl');
    });
  } catch (error) {
    if (error.response) {
      return res.status(error.response.status).json({
        error: 'Error exchanging code for tokens',
        details: error.response.data || error.message
      });
    }

    return res.status(500).json({
      error: 'Internal server error'
    });
  }
});

// GET /api/auth/me
router.get('/me', async (req, res) => {
  try {
    if (!req.session.user?.accessToken) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const userInfo = await getUserInfo(req.session.user.accessToken);

    return res.json({ user: userInfo });
  } catch (error) {
    logger.error('Get user info error:', error);
    return res.status(500).json({
      error: 'Internal server error'
    });
  }
});

// POST /api/auth/logout
router.post('/logout', async (req, res) => {
  try {
    const refreshToken = req.session.user?.refreshToken;

    if (refreshToken) {
      try {
        await logoutFromKeycloak(refreshToken);
      } catch (e) {
        // Do not fail logout if Keycloak call fails
        logger.warn('Keycloak logout call failed', {
          error: e.message
        });
      }
    }

    req.session.destroy(() => {});

    res.json({ message: 'Logged out' });
  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

module.exports = router;
