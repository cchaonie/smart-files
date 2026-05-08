# Backend Tests

Integration and unit tests for the Smart Files NestJS backend.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure test database:
```bash
cp .env.test.example .env.test
# Edit .env.test with your test database URL
```

3. Set up test database:
```bash
# Create test database
createdb smart_files_test

# Run migrations
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/smart_files_test npx prisma migrate deploy
```

## Running Tests

```bash
# Run all tests
npm run test

# Run integration tests only
npm run test:integration

# Run unit tests only
npm run test:unit

# Run tests with coverage
npm run test:cov

# Run tests in watch mode
npm run test:watch

# Debug tests
npm run test:debug
```

## Test Structure

```
test/
├── integration/           # Integration tests (full HTTP requests)
│   ├── auth.controller.spec.ts
│   └── files.controller.spec.ts
├── unit/                  # Unit tests (isolated services)
├── factories/             # Data factories
│   ├── user.factory.ts
│   └── file.factory.ts
├── helpers/               # Test helpers
│   ├── test-app.ts       # NestJS app factory
│   └── test-database.ts  # Database utilities
├── jest.setup.ts         # Jest setup
├── jest-integration.json # Integration test config
└── README.md
```

## Factories

### User Factory
```typescript
import { createUser, createUserCredentials } from '../factories/user.factory';

// Create user with hashed password
const user = await createUser({ email: 'test@example.com' });

// Create login credentials
const credentials = createUserCredentials({ password: 'mypassword' });
```

### File/Folder Factory
```typescript
import { createFile, createFolder } from '../factories/file.factory';

const folder = createFolder(userId, { name: 'Documents' });
const file = createFile(userId, { name: 'document.pdf', folderId: folder.id });
```

## Test Database Helpers

```typescript
import { cleanDatabase, disconnectDatabase, prisma } from '../helpers/test-database';

// Clean all data before/after tests
await cleanDatabase();

// Disconnect when done
await disconnectDatabase();

// Use prisma for direct database access
const user = await prisma.user.create({ data: createUser() });
```

## Writing Integration Tests

```typescript
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, closeTestApp } from '../helpers/test-app';
import { cleanDatabase } from '../helpers/test-database';

describe('MyController (integration)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('should do something', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/endpoint')
      .expect(200);

    expect(response.body).toEqual({ ... });
  });
});
```

## Writing Unit Tests

```typescript
import { Test } from '@nestjs/testing';
import { MyService } from '../../src/my/my.service';

describe('MyService', () => {
  let service: MyService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [MyService],
    }).compile();

    service = module.get<MyService>(MyService);
  });

  it('should do something', () => {
    const result = service.doSomething();
    expect(result).toBe('expected');
  });
});
```

## Best Practices

1. **Use factories for test data** - Never hardcode test data
2. **Clean database between tests** - Use `cleanDatabase()` in `beforeEach`
3. **Test at the appropriate level** - Unit for business logic, integration for API contracts
4. **Use supertest for HTTP assertions** - Fluent API for status codes, headers, body
5. **Isolate tests** - Each test should be independent
