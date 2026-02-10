# Dockal — CalDAV calendar (minimal)

Run:
```
docker-compose up -d
```

Ports (host -> container):
- Frontend: 5182 -> 80
- Backend: 3002 -> 3000
- Radicale: 5232 -> 5232

JWT_SECRET:
- Purpose: secret used by backend to sign/verify JWT tokens for frontend↔backend auth.
- Usage: set a strong random value before starting (env, .env or CI secret).
  Example: JWT_SECRET="s3cr3t..." injected in your deploy pipeline.

Images:
- tiritibambix/dockal-backend:latest
- tiritibambix/dockal-frontend:latest

Notes:
- Backend still talks to Radicale at http://radicale:5232 (Docker network).
