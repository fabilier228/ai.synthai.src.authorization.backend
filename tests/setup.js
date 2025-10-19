// Test setup file
process.env.NODE_ENV = 'test';
process.env.PORT = '3001';
process.env.JWT_SECRET = 'test-jwt-secret';

// Set test timeout
jest.setTimeout(30000);
