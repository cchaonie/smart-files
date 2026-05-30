# Smart Files Mobile

React Native mobile application for Smart Files, built with Expo.

## Features

- Browse folders and files
- Upload files with chunked upload support
- Download files
- JWT authentication

## Prerequisites

- Node.js 18+
- Expo CLI
- iOS Simulator (macOS) or Android Emulator

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables:
```bash
cp .env.example .env
# Edit .env and set EXPO_PUBLIC_API_URL to your backend URL
```

3. Start the development server:
```bash
npm start
```

4. Press `i` for iOS simulator or `a` for Android emulator

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `EXPO_PUBLIC_API_URL` | Backend API URL (must include `/api` path) | `http://localhost:4000/api` |

## Project Structure

```
src/
├── api/           # API client and endpoints
├── components/    # Reusable UI components
├── context/       # React Context providers
├── hooks/         # Custom React hooks
├── screens/       # Screen components
├── types/         # TypeScript type definitions
└── utils/         # Utility functions
```

## Building for Production

### iOS
```bash
eas build --platform ios
```

### Android
```bash
eas build --platform android
```
