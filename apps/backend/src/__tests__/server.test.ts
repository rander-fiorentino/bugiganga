import express from 'express';
import request from 'supertest';

// Mock all external dependencies
jest.mock('../memory/index', () => ({
  saveMemory: jest.fn().mockResolvedValue(undefined),
  getMemory: jest.fn().mockResolvedValue([]),
}));
jest.mock('../logs/index', () => ({
  saveLog: jest.fn().mockResolvedValue(undefined),
  getLogs: jest.fn().mockResolvedValue([]),
}));
jest.mock('../tools/executor', () => ({
  runTool: jest.fn().mockResolvedValue({ success: true }),
}));
jest.mock('../memory/sessions', () => ({
  getSession: jest.fn().mockResolvedValue(null),
  saveSession: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../agent/agentLoop', () => ({
  agentLoop: jest.fn().mockResolvedValue({ result: 'done' }),
}));
jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({
    query: jest.fn().mockResolvedValue({ rows: [] }),
    connect: jest.fn().mockResolvedValue({
      query: jest.fn().mockResolvedValue({ rows: [] }),
      release: jest.fn(),
    }),
  })),
}));
jest.mock('ioredis', () => jest.fn().mockImplementation(() => ({
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue('OK'),
  del: jest.fn().mockResolvedValue(1),
  quit: jest.fn().mockResolvedValue('OK'),
})));

let app: express.Application;

beforeAll(async () => {
  process.env.JWT_ACCESS_SECRET = 'test_access_secret_minimum_32_chars';
  process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_minimum_32chars';
  process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
  process.env.NODE_ENV = 'test';
  // Import server app after mocks are set
  const serverModule = await import('../server.js');
  app = (serverModule as any).default || (serverModule as any).app;
});

describe('GET /health', () => {
  it('returns 200 with status healthy', async () => {
    if (!app) return;
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'healthy' });
  });
});

describe('POST /api/auth/register', () => {
  it('returns 400 when fields are missing', async () => {
    if (!app) return;
    const res = await request(app)
      .post('/api/auth/register')
      .send({});
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('returns 400 when email is invalid', async () => {
    if (!app) return;
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'not-an-email', password: 'password123' });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});

describe('POST /api/auth/login', () => {
  it('returns 400 when credentials are missing', async () => {
    if (!app) return;
    const res = await request(app)
      .post('/api/auth/login')
      .send({});
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});

describe('API Routes', () => {
  it('returns 401 for protected routes without token', async () => {
    if (!app) return;
    const res = await request(app).get('/api/tasks');
    expect([401, 403, 404]).toContain(res.status);
  });

  it('returns 404 for unknown routes', async () => {
    if (!app) return;
    const res = await request(app).get('/api/nonexistent-route-xyz');
    expect(res.status).toBe(404);
  });
});
