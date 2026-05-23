# Smart Files Web

React-based web frontend for Smart Files, built with Vite.

## Features

- JWT authentication
- File and folder management
- Chunked file upload with resume support
- Parallel upload control
- Dark mode support

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables:
```bash
cp .env.example .env
# Edit .env and set VITE_API_URL to your backend URL
```

3. Start the development server:
```bash
npm run dev
```

The app will be available at `http://localhost:3000`.

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_URL` | Backend API URL | `/api` (relative path for same-origin) |

## Building for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

## Project Structure

```
src/
├── api/           # API client and endpoints
├── context/       # React Context providers
├── pages/         # Page components
├── types/         # TypeScript type definitions
├── App.tsx        # Main app component with routing
└── main.tsx       # Entry point
```
