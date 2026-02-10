import 'fastify';

declare module 'fastify' {
  interface FastifyInstance {
    jwtVerify: () => Promise<void>;
  }
  
  interface FastifyRequest {
    jwtVerify: () => Promise<void>;
  }
}
