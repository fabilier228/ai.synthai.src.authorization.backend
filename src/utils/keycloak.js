// src/utils/keycloak.js

const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const logger = require('./logger');

const getConfig = () => {
  const {
    KEYCLOAK_URL,
    KEYCLOAK_INTERNAL_URL,
    KEYCLOAK_REALM,
    KEYCLOAK_CLIENT_ID,
    KEYCLOAK_CLIENT_SECRET,
    KEYCLOAK_REDIRECT_URI
  } = process.env;

  const publicUrl = KEYCLOAK_URL;
  const internalUrl = KEYCLOAK_INTERNAL_URL;

  const config = {
    publicUrl,   // do redirectu dla przeglądarki
    internalUrl, // do zapytań z backendu
    realm: KEYCLOAK_REALM || 'synthai',
    clientId: KEYCLOAK_CLIENT_ID || 'synthai-logic-client',
    clientSecret: KEYCLOAK_CLIENT_SECRET,
    redirectUri: KEYCLOAK_REDIRECT_URI
  };

  if (!KEYCLOAK_CLIENT_ID) {
    logger.warn(
      'KEYCLOAK_CLIENT_ID is not set; using fallback "synthai-logic-client". Upewnij się, że taki client istnieje w Keycloak.'
    );
  }

  if (!KEYCLOAK_REDIRECT_URI) {
    logger.warn(
      'KEYCLOAK_REDIRECT_URI is not set; redirect_uri będzie wyliczany dynamicznie na podstawie requestu.'
    );
  }

  return config;
};

const getRealmEndpoints = () => {
  const { internalUrl, realm } = getConfig();
  const baseRealmUrl = `${internalUrl}/realms/${realm}`;
  return {
    authEndpoint: `${baseRealmUrl}/protocol/openid-connect/auth`,
    tokenEndpoint: `${baseRealmUrl}/protocol/openid-connect/token`,
    userInfoEndpoint: `${baseRealmUrl}/protocol/openid-connect/userinfo`,
    logoutEndpoint: `${baseRealmUrl}/protocol/openid-connect/logout`
  };
};

// Jedno źródło prawdy dla redirect_uri
const resolveRedirectUri = req => {
  const { redirectUri } = getConfig();

  if (redirectUri) {
    return redirectUri;
  }

  const dynamicUri = `${req.protocol}://${req.get('host')}/api/auth/callback`;
  logger.warn(
    `KEYCLOAK_REDIRECT_URI nie jest ustawione – używam dynamicznego redirect URI: ${dynamicUri}`
  );
  return dynamicUri;
};

// Buduje URL do logowania w Keycloak
const getLoginUrl = (redirectUri, stateFromReq, nonceFromReq) => {
  const { clientId, publicUrl, realm } = getConfig();

  const authEndpoint = `${publicUrl}/realms/${realm}/protocol/openid-connect/auth`;

  const state = stateFromReq || uuidv4();
  const nonce = nonceFromReq || uuidv4();

  const url = new URL(authEndpoint);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid profile email');
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('state', state);
  url.searchParams.set('nonce', nonce);

  logger.info('Generated Keycloak login URL', {
    clientId,
    redirectUri,
    authEndpoint
  });

  return { url: url.toString(), state, nonce };
};

// Wymiana code -> tokeny
const exchangeCodeForTokens = async (code, redirectUri) => {
  const { clientId, clientSecret } = getConfig();
  const { tokenEndpoint } = getRealmEndpoints();

  const params = new URLSearchParams();
  params.append('grant_type', 'authorization_code');
  params.append('code', code);
  params.append('client_id', clientId);

  if (clientSecret) {
    params.append('client_secret', clientSecret);
  }

  if (redirectUri) {
    params.append('redirect_uri', redirectUri);
  }

  const { data } = await axios.post(tokenEndpoint, params);
  return data; // access_token, refresh_token, id_token, itd.
};

const getUserInfo = async accessToken => {
  const { userInfoEndpoint } = getRealmEndpoints();

  const { data } = await axios.get(userInfoEndpoint, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  return data;
};

const logoutFromKeycloak = async refreshToken => {
  const { clientId, clientSecret } = getConfig();
  const { logoutEndpoint } = getRealmEndpoints();

  const params = new URLSearchParams();
  params.append('client_id', clientId);
  if (clientSecret) {
    params.append('client_secret', clientSecret);
  }
  params.append('refresh_token', refreshToken);

  await axios.post(logoutEndpoint, params);
};

module.exports = {
  getLoginUrl,
  exchangeCodeForTokens,
  getUserInfo,
  logoutFromKeycloak,
  resolveRedirectUri
};
