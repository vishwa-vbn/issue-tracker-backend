import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';

describe('Health Endpoints (Integration)', () => {
  it('GET /api/v1/ping returns standard welcome message', async () => {
    const res = await request(app).get('/api/v1/ping');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      data: 'Welcome to Issue Tracker Backend',
    });
    expect(res.headers['x-request-id']).toBeDefined();
  });

  it('GET /api/v1/health returns liveness status', async () => {
    const res = await request(app).get('/api/v1/health');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('ok');
    expect(typeof res.body.data.uptime).toBe('number');
  });

  it('GET /api/v1/non-existent-route returns 404 with ROUTE_NOT_FOUND code', async () => {
    const res = await request(app).get('/api/v1/non-existent-route');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('ROUTE_NOT_FOUND');
    expect(res.body.requestId).toBeDefined();
  });
});
