import { faker } from '@faker-js/faker';

export type User = {
  id: string;
  email: string;
  name: string;
  password: string;
  role: 'user' | 'admin';
  createdAt: Date;
};

export const createUser = (overrides: Partial<User> = {}): User => ({
  id: faker.string.uuid(),
  email: faker.internet.email(),
  name: faker.person.fullName(),
  password: faker.internet.password({ length: 12 }),
  role: 'user',
  createdAt: new Date(),
  ...overrides,
});

export const createAdminUser = (overrides: Partial<User> = {}): User =>
  createUser({ role: 'admin', ...overrides });
