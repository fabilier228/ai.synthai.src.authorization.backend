const request = require('supertest');

const BASE_URL = process.env.AUTH_SERVICE_BASE_URL || 'http://localhost:3001';

const api = () => request(BASE_URL);

describe('Authorization backend integration tests', () => {
  beforeAll(async () => {
    // Fail fast with a clear message when the integration environment is not running.
    try {
      await api().get('/health').timeout({ response: 8000, deadline: 10000 });
    } catch (error) {
      throw new Error(
        `Auth service is not reachable at ${BASE_URL}. Start docker services first: ` +
          'docker compose --env-file .env up -d postgres redis keycloak auth-service'
      );
    }
  });

  test('GET /health should return healthy status', async () => {
    const response = await api().get('/health').expect(200);

    expect(response.body.status).toBe('healthy');
    expect(response.body.service).toBe('synthai-authorization-backend');
  });

  test('GET /api/users should return 401 without session', async () => {
    const response = await api().get('/api/users').expect(401);

    expect(response.body.error).toBe('Access denied');
  });

  test('GET /api should return service metadata', async () => {
    const response = await api().get('/api').expect(200);

    expect(response.body.service).toContain('Authorization Service');
    expect(response.body.endpoints).toBeDefined();
    expect(response.body.endpoints.auth).toBe('/api/auth');
  });

  test('GET /api/auth/login should redirect to Keycloak', async () => {
    const response = await api().get('/api/auth/login').redirects(0).expect(302);

    expect(response.headers.location).toContain('/protocol/openid-connect/auth');
    expect(response.headers.location).toContain('client_id=');
    expect(response.headers.location).toContain('redirect_uri=');
  });

  test('GET /api/auth/register should redirect to Keycloak', async () => {
    const response = await api().get('/api/auth/register').redirects(0).expect(302);

    expect(response.headers.location).toContain('/protocol/openid-connect/registrations');
    expect(response.headers.location).toContain('client_id=');
    expect(response.headers.location).toContain('redirect_uri=');
  });

  test('GET /api/auth/me should return 401 without session', async () => {
    const response = await api().get('/api/auth/me').expect(401);

    expect(response.body.error).toContain('Not authenticated');
  });

  test('POST /api/auth/logout should return success even without session user', async () => {
    const response = await api().post('/api/auth/logout').expect(200);

    expect(response.body.message).toBe('Logged out');
  });
});
