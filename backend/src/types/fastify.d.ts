import 'fastify';
import { FastifyRequest } from 'fastify';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate(this: FastifyInstance, request: FastifyRequest): Promise<void>;
  }
}
