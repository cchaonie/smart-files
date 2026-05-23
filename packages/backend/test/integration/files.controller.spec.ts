import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, closeTestApp } from '../helpers/test-app';
import { cleanDatabase, disconnectDatabase, prisma } from '../helpers/test-database';
import { createUserCredentials } from '../factories/user.factory';
import { createFile, createFolder } from '../factories/file.factory';

describe('FilesController (integration)', () => {
  let app: INestApplication;
  let authToken: string;
  let userId: string;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await closeTestApp(app);
    await disconnectDatabase();
  });

  beforeEach(async () => {
    await cleanDatabase();

    // Create user and get auth token
    const credentials = createUserCredentials();
    const registerResponse = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send(credentials);

    authToken = registerResponse.body.access_token;
    userId = registerResponse.body.user.id;
  });

  describe('GET /folders/browse', () => {
    it('should return empty folders and files for new user', async () => {
      // Act
      const response = await request(app.getHttpServer())
        .get('/api/folders/browse')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Assert
      expect(response.body).toEqual({
        folders: [],
        files: [],
      });
    });

    it('should return user folders and files', async () => {
      // Arrange
      const folder = await prisma.folder.create({
        data: createFolder(userId, { name: 'Test Folder' }),
      });

      const file = await prisma.file.create({
        data: createFile(userId, { name: 'test.txt', folderId: null }),
      });

      // Act
      const response = await request(app.getHttpServer())
        .get('/api/folders/browse')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Assert
      expect(response.body.folders).toHaveLength(1);
      expect(response.body.folders[0].name).toBe('Test Folder');
      expect(response.body.files).toHaveLength(1);
      expect(response.body.files[0].name).toBe('test.txt');
    });

    it('should return 401 without auth token', async () => {
      // Act & Assert
      await request(app.getHttpServer())
        .get('/api/folders/browse')
        .expect(401);
    });
  });

  describe('POST /folders', () => {
    it('should create a new folder', async () => {
      // Act
      const response = await request(app.getHttpServer())
        .post('/api/folders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'New Folder' })
        .expect(201);

      // Assert
      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe('New Folder');
      expect(response.body).toHaveProperty('createdAt');
    });

    it('should reject folder creation without name', async () => {
      // Act & Assert
      await request(app.getHttpServer())
        .post('/api/folders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);
    });

    it('should create nested folder with parentId', async () => {
      // Arrange
      const parentFolder = await prisma.folder.create({
        data: createFolder(userId, { name: 'Parent' }),
      });

      // Act
      const response = await request(app.getHttpServer())
        .post('/api/folders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Child Folder', parentId: parentFolder.id })
        .expect(201);

      // Assert
      expect(response.body.name).toBe('Child Folder');
    });
  });

  describe('DELETE /files/:id', () => {
    it('should delete user file', async () => {
      // Arrange
      const file = await prisma.file.create({
        data: createFile(userId, { name: 'to-delete.txt' }),
      });

      // Act
      await request(app.getHttpServer())
        .delete(`/api/files/${file.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Assert
      const deletedFile = await prisma.file.findUnique({
        where: { id: file.id },
      });
      expect(deletedFile).toBeNull();
    });

    it('should return 404 for non-existent file', async () => {
      // Act & Assert
      await request(app.getHttpServer())
        .delete('/api/files/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('PATCH /folders/:id', () => {
    it('should rename a folder', async () => {
      // Arrange
      const folder = await prisma.folder.create({
        data: createFolder(userId, { name: 'Old Name' }),
      });

      // Act
      const response = await request(app.getHttpServer())
        .patch(`/api/folders/${folder.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'New Name' })
        .expect(200);

      // Assert
      expect(response.body.name).toBe('New Name');
    });
  });
});
