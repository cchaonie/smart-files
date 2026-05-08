# Testing Guide

Complete testing documentation for the Smart Files monorepo.

## Quick Start

```bash
# Install dependencies and test tools
npm install

# Backend: Set up test database
cp packages/backend/.env.test.example packages/backend/.env.test
# Edit packages/backend/.env.test with your test database URL

# Web: Set up test environment
cp packages/web/.env.example packages/web/.env
# Edit packages/web/.env with test credentials

# Install Playwright browsers (web only)
cd packages/web && npx playwright install
```

## Running Tests

### All Tests
```bash
# Run backend tests
cd packages/backend && npm run test

# Run web E2E tests
cd packages/web && npm run test
```

### Backend Tests
```bash
# Run all backend tests
cd packages/backend && npm run test

# Run integration tests only
cd packages/backend && npm run test:integration

# Run unit tests only
cd packages/backend && npm run test:unit

# Run with coverage
cd packages/backend && npm run test:cov

# Run in watch mode
cd packages/backend && npm run test:watch
```

### Web E2E Tests
```bash
# Run all E2E tests
cd packages/web && npm run test

# Run with UI mode (interactive debugging)
cd packages/web && npm run test:ui

# Run in headed mode (see browser)
cd packages/web && npm run test:headed

# Run specific browsers
cd packages/web && npm run test:chromium
cd packages/web && npm run test:firefox
cd packages/web && npm run test:webkit

# Run mobile tests
cd packages/web && npm run test:mobile
```

## Test Structure

```
packages/
├── backend/
│   └── test/
│       ├── integration/       # API integration tests
│       │   ├── auth.controller.spec.ts
│       │   └── files.controller.spec.ts
│       ├── unit/              # Unit tests
│       ├── factories/         # Data factories
│       │   ├── user.factory.ts
│       │   └── file.factory.ts
│       ├── helpers/           # Test utilities
│       │   ├── test-app.ts
│       │   └── test-database.ts
│       └── README.md
└── web/
    └── tests/
        ├── e2e/               # Playwright E2E tests
        │   ├── auth.spec.ts
        │   └── files.spec.ts
        ├── support/
        │   ├── fixtures/      # Custom fixtures
        │   │   ├── auth-fixture.ts
        │   │   ├── api-fixture.ts
        │   │   └── index.ts
        │   ├── helpers/       # Helper functions
        │   └── factories/     # Data factories
        │       ├── user-factory.ts
        │       └── file-factory.ts
        └── README.md
```

## Test Frameworks

### Backend: Jest + Supertest
- **Unit tests**: Test services, utilities in isolation
- **Integration tests**: Test API endpoints with real HTTP requests
- **Database**: Uses test database with Prisma

### Web: Playwright
- **E2E tests**: Full browser automation
- **Multi-browser**: Chromium, Firefox, WebKit
- **Mobile**: Mobile Chrome and Safari emulation
- **Fixtures**: Custom auth and API fixtures

## Best Practices

1. **Use Factories for Test Data**
   ```typescript
   // Dynamic data prevents parallel test collisions
   const user = createUser({ email: 'test@example.com' });
   ```

2. **Clean Up After Tests**
   ```typescript
   beforeEach(async () => {
     await cleanDatabase();
   });
   ```

3. **Use API for Setup (Not UI)**
   ```typescript
   // Fast: Use API to create test data
   await api.post('/auth/register', userData);

   // Slow: Don't use UI for setup
   // await page.fill(...); await page.click(...);
   ```

4. **Use data-testid Selectors**
   ```html
   <!-- Add to your components -->
   <button data-testid="submit-button">Submit</button>
   ```

   ```typescript
   // In tests
   await page.click('[data-testid="submit-button"]');
   ```

## CI Integration

Tests are designed to run in CI:

```yaml
# Example GitHub Actions workflow
- name: Run backend tests
  run: cd packages/backend && npm run test

- name: Run web E2E tests
  run: cd packages/web && npm run test
  env:
    TEST_ENV: staging
```

## Environment Configuration

### Backend (.env.test)
```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/smart_files_test
JWT_SECRET=test-secret
UPLOAD_ROOT=./test-uploads
```

### Web (.env)
```
TEST_ENV=local
TEST_USER_EMAIL=test@example.com
TEST_USER_PASSWORD=testpassword123
```

## Troubleshooting

### Backend Tests Fail with Database Error
```bash
# Create test database
createdb smart_files_test

# Run migrations
cd packages/shared
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/smart_files_test npx prisma migrate deploy
```

### Playwright Tests Fail to Launch
```bash
# Reinstall browsers
cd packages/web && npx playwright install --with-deps
```

### Port Conflicts
```bash
# Backend runs on 4000, Web on 3000
# Ensure these ports are available before running tests
```

## Next Steps

- Add mobile (React Native) tests with Jest + React Native Testing Library
- Set up contract testing with Pact for API contracts
- Add performance/load tests with k6
- Configure CI/CD pipeline with GitHub Actions
