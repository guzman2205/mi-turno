const request = require('supertest');
const { app, server } = require('../server');

describe('Tickets API Routes', () => {
  afterAll(async () => {
    if (server && server.close) {
      await new Promise(resolve => server.close(resolve));
    }
  });

  describe('POST /api/tickets/create', () => {
    it('debe retornar 422 si no se envía service_id entero', async () => {
      const res = await request(app)
        .post('/api/tickets/create')
        .send({ service_id: 'invalido' });
      expect(res.statusCode).toBe(422);
      expect(res.body).toHaveProperty('details');
    });

    it('debe retornar 400 si el servicio no existe o no está activo', async () => {
      const res = await request(app)
        .post('/api/tickets/create')
        .send({ service_id: 999999 });
      expect([400, 404]).toContain(res.statusCode);
    });
  });

  describe('GET /api/tickets/lookup', () => {
    it('debe retornar 400 si la consulta viene vacía', async () => {
      const res = await request(app).get('/api/tickets/lookup?query=');
      expect(res.statusCode).toBe(400);
    });
  });

  describe('GET /api/tickets/screen-flow', () => {
    it('debe retornar la estructura de pantalla con attending, upcoming y attended', async () => {
      const res = await request(app).get('/api/tickets/screen-flow');
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('attending');
      expect(res.body).toHaveProperty('upcoming');
      expect(res.body).toHaveProperty('attended');
    });
  });
});
