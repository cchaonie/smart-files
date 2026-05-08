import { faker } from '@faker-js/faker';
import * as bcrypt from 'bcryptjs';

export type User = {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  createdAt: Date;
};

export const createUser = async (overrides: Partial<User> = {}): Promise<User> => {
  const password = faker.internet.password({ length: 12 });
  const passwordHash = await bcrypt.hash(password, 10);

  return {
    id: faker.string.uuid(),
    email: faker.internet.email(),
    name: faker.person.fullName(),
    passwordHash,
    createdAt: new Date(),
    ...overrides,
  };
};

export const createUserCredentials = (overrides: Partial<{ email: string; password: string; name: string }> = {}) => ({
  email: faker.internet.email(),
  password: faker.internet.password({ length: 12 }),
  name: faker.person.fullName(),
  ...overrides,
});
