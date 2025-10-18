# SynthAI Authorization Backend

Authorization microservice for the SynthAI platform (Node.js, Express, Keycloak, PostgreSQL, Redis).

## Quick Start

- Node.js 18+
- PostgreSQL 15+
- Redis 7+

```bash
npm ci
npm run dev
```

## Main Endpoints

- `/health` – service health
- `/auth/login` – user login
- `/auth/logout` – user logout
- `/auth/profile` – user profile

## Environment Variables

- `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`
- `REDIS_URL`
- `KEYCLOAK_URL`, `KEYCLOAK_REALM`, `KEYCLOAK_CLIENT_ID`, `KEYCLOAK_CLIENT_SECRET`

# CI/CD Pipeline – SynthAI Authorization Backend

**What is checked?**

- Code quality (ESLint, Prettier)
- Security audit (npm audit, Trivy)
- Tests (Jest)
- Docker build
- Deployment (if all checks pass)

**How to test locally?**

```bash
npm run lint
npm test
npm audit
```

**How to trigger on GitHub?**

- Push or pull request to any branch

---

For details, see `.github/workflows/ci-cd.yml`.
