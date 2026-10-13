const request = require('supertest');
const { app, server } = require('../server');

describe('Auth API Routes', () => {
  afterAll(async () => {
    if (server && server.close) {
      await new Promise(resolve => server.close(resolve));
    }
  });

  describe('POST /api/auth/login', () => {
    it('debe retornar 422 si falta email o password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: '' });
      expect(res.statusCode).toBe(422);
      expect(res.body).toHaveProperty('error');
    });

    it('debe retornar 401 si las credenciales son incorrectas', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'noexisto@miturno.com', password: 'badpassword' });
      expect(res.statusCode).toBe(401);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('GET /api/auth/me', () => {
    it('debe retornar 401 sin cabecera de autenticación', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.statusCode).toBe(401);
    });
  });
});
