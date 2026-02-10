import 'fastify';

declare module 'fastify' {
  interface FastifyInstance {
    jwtVerify: () => Promise<void>;
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  
  interface FastifyRequest {
    jwtVerify: () => Promise<void>;
  }
}
