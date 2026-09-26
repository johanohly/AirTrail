## How It Works

### Setup Tests
- Located in `setup/`
- Run first and sequentially (order-dependent)
- Test user onboarding flow

### Regular Tests
- Located in `tests/`
- Run in parallel after setup tests
- Each test creates its own data using factories
- No cleanup needed

## Writing Tests

### Basic Test Structure

```typescript
import { usersFactory } from '@test/factories/users';
import { login } from '@test/helpers/auth';
import { expect, test } from '@test/index';

test.describe('Feature Name', () => {
  test('test description', async ({ page }) => {
    const { user } = await usersFactory.create();

    await login(page, user);

    await page.goto('/');
    await expect(page).toHaveURL('/');
  });
});
```

## Running Tests

```bash
bun run test:e2e
```

Every test signs in from the same address, so the login and OAuth rate limits
would block the suite. `test:e2e` starts the server with
`DISABLE_RATE_LIMITS=true`; set it too when running the tests against a server
you started yourself.
