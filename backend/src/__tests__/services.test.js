const request = require('supertest');
const { app, server } = require('../server');

describe('Services API Routes', () => {
  afterAll(async () => {
    if (server && server.close) {
      await new Promise(resolve => server.close(resolve));
    }
  });

  describe('GET /api/services', () => {
    it('debe retornar la lista de servicios', async () => {
      const res = await request(app).get('/api/services');
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('POST /api/services', () => {
    it('debe requerir autenticación para crear un servicio', async () => {
      const res = await request(app)
        .post('/api/services')
        .send({ name: 'Test Service', prefix: 'TST' });
      expect(res.statusCode).toBe(401);
    });
  });
});
