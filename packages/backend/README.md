# Smart Files Backend API

NestJS backend API for Smart Files, serving both Web and React Native clients.

## Features

- JWT Authentication (universal for Web & Mobile)
- File upload with chunked transfer (pause/resume support)
- Folder management
- RESTful API with OpenAPI/Swagger documentation
- PostgreSQL database via Prisma

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your configuration
```

### 3. Database Setup

```bash
# Generate Prisma client
npm run db:generate

# Run migrations
npm run db:migrate
```

### 4. Start Development Server

```bash
npm run start:dev
```

The API will be available at `http://localhost:4000`

API Documentation: `http://localhost:4000/api/docs`

## API Endpoints

### Auth
- `POST /auth/login` - Login with email/password
- `POST /auth/register` - Register new user

### Files
- `GET /files` - List user files
- `DELETE /files/:id` - Delete a file
- `GET /files/:id/download` - Download file
- `GET /files/:id/preview` - Preview file (images)

### Folders
- `GET /folders/browse` - Browse folders and files
- `POST /folders` - Create folder
- `PATCH /folders/:id` - Rename folder
- `DELETE /folders/:id` - Delete folder

### Upload
- `POST /upload/session` - Create upload session
- `GET /upload/session/:id` - Get session status
- `PUT /upload/session/:id/chunk?index=n` - Upload chunk
- `POST /upload/session/:id/complete` - Complete upload

## Architecture

```
src/
├── auth/           # Authentication module
├── files/          # File management module
├── folders/        # Folder management module
├── upload/         # Chunked upload module
├── prisma/         # Prisma client service
└── common/         # Guards, decorators, utilities
```

## Scripts

- `npm run start:dev` - Start development with hot reload
- `npm run build` - Build production
- `npm run start:prod` - Start production server
- `npm run db:generate` - Generate Prisma client
- `npm run db:migrate` - Run database migrations
- `npm run db:studio` - Open Prisma Studio
