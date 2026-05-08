# Web E2E Tests

Playwright E2E tests for the Smart Files web application.

## Setup

1. Install dependencies:
```bash
npm install
npx playwright install
```

2. Configure environment:
```bash
cp .env.example .env
# Edit .env with your test credentials and URLs
```

3. Start the backend and web servers:
```bash
# Terminal 1
npm run dev:backend

# Terminal 2
npm run dev:web
```

## Running Tests

```bash
# Run all tests
npm run test

# Run with UI mode (for debugging)
npm run test:ui

# Run in headed mode (see browser)
npm run test:headed

# Run specific browser
npm run test:chromium
npm run test:firefox
npm run test:webkit

# Run mobile tests
npm run test:mobile

# Debug mode
npm run test:debug
```

## Test Structure

```
tests/
├── e2e/                    # End-to-end tests
│   ├── auth.spec.ts       # Authentication tests
│   └── files.spec.ts      # File management tests
├── support/
│   ├── fixtures/          # Playwright fixtures
│   │   ├── auth-fixture.ts
│   │   ├── api-fixture.ts
│   │   └── index.ts
│   ├── helpers/           # Helper functions
│   └── factories/         # Data factories
│       ├── user-factory.ts
│       └── file-factory.ts
└── README.md
```

## Fixtures

### Auth Fixture
Provides authentication helpers:
- `auth.loginAs(email, password)` - Login via API
- `auth.registerUser(overrides)` - Register new user
- `auth.getToken()` - Get current auth token

### API Fixture
Provides API helpers:
- `api.get(endpoint)` - GET request with auth
- `api.post(endpoint, data)` - POST request with auth
- `api.put(endpoint, data)` - PUT request with auth
- `api.patch(endpoint, data)` - PATCH request with auth
- `api.delete(endpoint)` - DELETE request with auth

## Data Factories

### User Factory
```typescript
import { createUser, createAdminUser } from './support/factories/user-factory';

const user = createUser({ email: 'test@example.com' });
const admin = createAdminUser();
```

### File Factory
```typescript
import { createFile, createFolder, createImageFile } from './support/factories/file-factory';

const file = createFile({ name: 'document.pdf' });
const folder = createFolder({ name: 'Documents' });
const image = createImageFile();
```

## Writing Tests

```typescript
import { test, expect } from './support/fixtures';

test('user can create folder', async ({ page, auth }) => {
  // Arrange
  const user = await auth.registerUser();
  await auth.loginAs(user.email, user.password);

  // Act
  await page.goto('/files');
  await page.fill('[data-testid="new-folder-input"]', 'My Folder');
  await page.click('[data-testid="create-folder-button"]');

  // Assert
  await expect(page.getByText('My Folder')).toBeVisible();
});
```

## Best Practices

1. **Use data-testid selectors** - Add `data-testid` attributes to components for reliable selectors
2. **Use factories for test data** - Dynamic data prevents parallel test collisions
3. **Use fixtures for auth** - API-based auth is faster than UI login
4. **Clean up after tests** - Tests should not leave data that affects other tests
