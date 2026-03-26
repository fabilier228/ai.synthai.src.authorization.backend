const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');
const {
  getLoginUrl,
  exchangeCodeForTokens,
  getUserInfo,
  logoutFromKeycloak,
  resolveRedirectUri
} = require('../utils/keycloak');
const { updateLastLogin } = require('../utils/userLogins');
const { getLastLogin } = require('../utils/userLogins');
const requireAuth = require('../middleware/authenticated');

// GET /api/auth/login
// Redirects browser to Keycloak login (Authorization Code Flow)
router.get('/login', async (req, res) => {
  try {
    const redirectUri = resolveRedirectUri(req);
    const { url, state, nonce } = getLoginUrl(redirectUri, 'login');

    // Save state/nonce/redirectUri in session to validate callback
    req.session.oauth2 = { state, nonce, redirectUri };

    logger.info('Login initiated', {
      redirectUri,
      sessionId: req.sessionID,
      state,
      nonce
    });

    // Save session to ensure oauth2 data persists
    req.session.save(err => {
      if (err) {
        logger.error('Failed to save session during login:', err);
      }
      return res.redirect(url);
    });
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
      logger.warn('Callback called without authorization code');
      return res.status(400).json({ error: 'Missing authorization code' });
    }

    // Validate state
    if (req.session.oauth2?.state && state !== req.session.oauth2.state) {
      logger.warn('State mismatch in callback', {
        expectedState: req.session.oauth2.state,
        receivedState: state
      });
      return res.status(400).json({ error: 'Invalid state' });
    }

    const redirectUri =
      req.session.oauth2?.redirectUri || resolveRedirectUri(req);

    logger.info('Exchanging authorization code for tokens', {
      redirectUri,
      sessionId: req.sessionID
    });

    const tokenResponse = await exchangeCodeForTokens(code, redirectUri);
    logger.info('Tokens from Keycloak', {
      hasAccessToken: !!tokenResponse.access_token,
      hasIdToken: !!tokenResponse.id_token,
      hasRefreshToken: !!tokenResponse.refresh_token,
      accessTokenPreview: tokenResponse.access_token?.slice(0, 30),
      expiresIn: tokenResponse.expires_in
    });

    const userInfo = await getUserInfo(tokenResponse.access_token);
    logger.info('User info retrieved from Keycloak', {
      username: userInfo.preferred_username || userInfo.sub,
      sub: userInfo.sub
    });

    await updateLastLogin(userInfo.sub);

    // Save session (BFF style – tokens on backend, cookie HttpOnly)
    req.session.user = {
      username: userInfo.preferred_username || userInfo.sub,
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token,
      idToken: tokenResponse.id_token,
      expiresIn: tokenResponse.expires_in,
      obtainedAt: Date.now()
    };

    logger.info('Session user object set', {
      sessionId: req.sessionID,
      username: req.session.user.username,
      hasAccessToken: !!req.session.user.accessToken
    });

    // Clean temp data
    delete req.session.oauth2;

    // CRITICAL: Save session before redirect
    req.session.save(err => {
      if (err) {
        logger.error('Session save error:', {
          error: err.message,
          stack: err.stack,
          sessionId: req.sessionID
        });
        return res.status(500).json({ error: 'Failed to save session' });
      }

      logger.info('Session saved successfully', {
        sessionId: req.sessionID
      });

      // Redirect to frontend home page after successful authentication
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      logger.info('Redirecting to frontend', { url: frontendUrl });
      return res.redirect(frontendUrl);
    });
  } catch (error) {
    logger.error('Callback error:', {
      error: error.message,
      stack: error.stack,
      sessionId: req.sessionID
    });

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
    // Check if user session exists
    if (!req.session?.user) {
      logger.debug('No user session found', {
        sessionId: req.sessionID,
        hasSession: !!req.session,
        sessionKeys: req.session ? Object.keys(req.session) : []
      });
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Check if access token exists
    if (!req.session.user.accessToken) {
      logger.debug('No access token in session', {
        sessionId: req.sessionID,
        userKeys: Object.keys(req.session.user)
      });
      return res.status(401).json({ error: 'Not authenticated - no access token' });
    }

    logger.debug('Fetching user info with access token', {
      sessionId: req.sessionID,
      tokenPreview: req.session.user.accessToken?.slice(0, 20)
    });

    const userInfo = await getUserInfo(req.session.user.accessToken);

    // Decode access token to get roles
    const decodedToken = jwt.decode(req.session.user.accessToken);
    const realmRoles = decodedToken?.realm_access?.roles || [];
    const resourceAccess = decodedToken?.resource_access || {};

    // Collect all client roles
    const clientRoles = Object.values(resourceAccess).flatMap(
      client => client.roles || []
    );

    // Combine and deduplicate roles
    userInfo.roles = [...new Set([...realmRoles, ...clientRoles])];

    const lastLogin = await getLastLogin(userInfo.sub);

    userInfo.last_login = lastLogin || null;

    return res.json({ user: userInfo });
  } catch (error) {
    logger.error('Get user info error:', {
      error: error.message,
      stack: error.stack,
      sessionId: req.sessionID
    });
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
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

    // Clear session
    req.session.destroy(() => {});
    
    // Clear session cookie
    res.clearCookie('synthai.sid', {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      domain: process.env.COOKIE_DOMAIN || undefined
    });

    res.json({ message: 'Logged out' });
  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

// GET /api/auth/account/email
router.get('/account/email', requireAuth, (req, res) => {
  const keycloakUrl = process.env.KEYCLOAK_URL;
  const realm = process.env.KEYCLOAK_REALM || 'synthai';
  const clientId =
    process.env.KEYCLOAK_FRONTEND_CLIENT_ID || 'synthai-frontend-client';
  const frontendBase = process.env.FRONTEND_BASE_URL || 'http://localhost:3000';

  const accountBase = `${keycloakUrl}/realms/${realm}/account`;

  const redirectBack = `${frontendBase}/profile`;

  const params = new URLSearchParams({
    referrer: clientId,
    referrer_uri: redirectBack
  });

  const url = `${accountBase}/?${params.toString()}#/personal-info`;

  return res.redirect(url);
});

// GET /api/auth/account/password
router.get('/account/password', requireAuth, (req, res) => {
  const keycloakUrl = process.env.KEYCLOAK_URL;
  const realm = process.env.KEYCLOAK_REALM || 'synthai';
  const clientId =
    process.env.KEYCLOAK_FRONTEND_CLIENT_ID || 'synthai-frontend-client';
  const frontendBase = process.env.FRONTEND_BASE_URL || 'http://localhost:3000';

  const accountBase = `${keycloakUrl}/realms/${realm}/account`;
  const redirectBack = `${frontendBase}/profile`;

  const params = new URLSearchParams({
    referrer: clientId,
    referrer_uri: redirectBack
  });

  const url = `${accountBase}/?${params.toString()}#/security/signingin`;

  return res.redirect(url);
});

// GET /api/auth/debug/session (for debugging only - remove in production)
router.get('/debug/session', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Not found' });
  }

  res.json({
    sessionId: req.sessionID,
    hasSession: !!req.session,
    sessionKeys: req.session ? Object.keys(req.session) : [],
    hasUser: !!req.session?.user,
    user: req.session?.user ? {
      username: req.session.user.username,
      hasAccessToken: !!req.session.user.accessToken,
      hasRefreshToken: !!req.session.user.refreshToken,
      expiresIn: req.session.user.expiresIn,
      obtainedAt: req.session.user.obtainedAt
    } : null
  });
});

module.exports = router;
