const request = require('supertest');
const express = require('express');

describe('Health Check', () => {
  let app;

  beforeAll(() => {
    app = express();
    app.get('/health', (req, res) => {
      res.status(200).json({
        status: 'healthy',
        service: 'synthai-authorization-backend'
      });
    });
  });

  test('should return health status', async () => {
    const response = await request(app).get('/health').expect(200);

    expect(response.body.status).toBe('healthy');
    expect(response.body.service).toBe('synthai-authorization-backend');
  });
});
