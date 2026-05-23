import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, closeTestApp } from '../helpers/test-app';
import { cleanDatabase, disconnectDatabase } from '../helpers/test-database';
import { createUserCredentials } from '../factories/user.factory';

describe('AuthController (integration)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await closeTestApp(app);
    await disconnectDatabase();
  });

  beforeEach(async () => {
    await cleanDatabase();
  });

  describe('POST /auth/register', () => {
    it('should register a new user with valid credentials', async () => {
      // Arrange
      const credentials = createUserCredentials();

      // Act
      const response = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send(credentials)
        .expect(201);

      // Assert
      expect(response.body).toHaveProperty('access_token');
      expect(response.body.user).toMatchObject({
        email: credentials.email.toLowerCase(),
        name: credentials.name,
      });
      expect(response.body.user).toHaveProperty('id');
    });

    it('should reject registration with duplicate email', async () => {
      // Arrange
      const credentials = createUserCredentials();
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send(credentials);

      // Act & Assert
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send(credentials)
        .expect(409);
    });

    it('should reject registration with invalid email', async () => {
      // Arrange
      const credentials = createUserCredentials({ email: 'invalid-email' });

      // Act & Assert
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send(credentials)
        .expect(400);
    });

    it('should reject registration with short password', async () => {
      // Arrange
      const credentials = createUserCredentials({ password: '123' });

      // Act & Assert
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send(credentials)
        .expect(400);
    });
  });

  describe('POST /auth/login', () => {
    it('should login with valid credentials', async () => {
      // Arrange
      const credentials = createUserCredentials();
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send(credentials);

      // Act
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: credentials.email,
          password: credentials.password,
        })
        .expect(201);

      // Assert
      expect(response.body).toHaveProperty('access_token');
      expect(response.body.user).toMatchObject({
        email: credentials.email.toLowerCase(),
      });
    });

    it('should reject login with invalid credentials', async () => {
      // Arrange
      const credentials = createUserCredentials();
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send(credentials);

      // Act & Assert
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: credentials.email,
          password: 'wrongpassword',
        })
        .expect(401);
    });

    it('should reject login for non-existent user', async () => {
      // Act & Assert
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'password123',
        })
        .expect(401);
    });
  });
});
