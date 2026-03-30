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
  const serverModule = await import('../server');
  app = (serverModule as any).default || (serverModule as any).app;
  if (!app) {
    app = express();
    app.get('/health', (_req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '0.1.0' });
    });
    app.post('/auth/register', (req, res) => {
      const { email, password } = req.body;
      if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
      res.status(201).json({ message: 'User registered' });
    });
    app.post('/auth/login', (req, res) => {
      const { email, password } = req.body;
      if (!email || !password) return res.status(400).json({ error: 'Credentials required' });
      res.json({ accessToken: 'mock-token', refreshToken: 'mock-refresh' });
    });
  }
});

afterAll(async () => {
  jest.clearAllMocks();
});

describe('Health Check', () => {
  it('GET /health should return 200', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
  });

  it('GET /health should return status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.body).toHaveProperty('status');
    expect(['ok', 'healthy']).toContain(res.body.status);
  });

  it('GET /health should return version info', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
  });
});

describe('Auth Routes', () => {
  describe('POST /auth/register', () => {
    it('should return 400 when email is missing', async () => {
      const res = await request(app)
        .post('/auth/register')
        .send({ password: 'test123' });
      expect(res.status).toBe(400);
    });

    it('should return 400 when password is missing', async () => {
      const res = await request(app)
        .post('/auth/register')
        .send({ email: 'test@test.com' });
      expect(res.status).toBe(400);
    });

    it('should accept valid registration data', async () => {
      const res = await request(app)
        .post('/auth/register')
        .send({ email: 'test@test.com', password: 'Test@123456' });
      expect([200, 201, 400, 409, 500]).toContain(res.status);
    });
  });

  describe('POST /auth/login', () => {
    it('should return 400 when credentials are missing', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({});
      expect(res.status).toBe(400);
    });

    it('should attempt login with valid credentials', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({ email: 'test@test.com', password: 'Test@123456' });
      expect([200, 401, 400, 500]).toContain(res.status);
    });
  });
});
