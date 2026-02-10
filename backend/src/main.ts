import fastify from 'fastify';
import fastifyJwt from '@fastify/jwt';

const app = fastify();

// Register authentication plugin BEFORE routes
await app.register(fastifyJwt, {
  secret: process.env.JWT_SECRET || 'your-secret-key'
});

// Decorate fastify instance with authenticate hook
app.decorate('authenticate', async function(request: any) {
  try {
    await request.jwtVerify();
  } catch (err) {
    throw err;
  }
});

// ...existing code...
// Then register routes