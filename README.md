# TODA MAX AI Service

A Node.js backend service for the TODA MAX platform, providing APIs for medication tracking, patient support, and eNavigator management.

## Description

TODA MAX Backend Service is the core API service that powers the TODA MAX application for patients with hypertension and diabetes. It provides medication tracking, ordering systems, patient support chat with AI integration, and administrative tools for the eNavigator.

## Technologies Used

- **Node.js**: JavaScript runtime
- **Express.js**: HTTP server framework
- **TypeScript**: Typed JavaScript
- **Supabase**: Authentication, database, and real-time features
- **Prisma**: Database ORM and migrations
- **Zod**: Schema validation
- **Axios**: HTTP client for upstream requests
- **dotenv**: Environment configuration

## Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/LaunchBytes-Studios/TODA-MAX-Backend-Service.git
   cd TODA-MAX-Backend-Service
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Start the development server:

   ```bash
   npm run dev
   ```

## Environment Variables

Set the following variables in your environment or a local `.env` file:

- `EXPO_PUBLIC_SUPABASE_URL`: Supabase project URL
- `EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key
- `JWT_SECRET`: JWT signing secret for patient authentication
- `AI_SERVICE_URL`: Base URL for the AI service (e.g., `http://localhost:3001`)
- `AI_SERVICE_KEY`: Shared service key used to call the AI service
- `PORT`: Optional override for the default port (3000)

## Scripts

- `npm run dev`: Start development server with hot reload
- `npm run build`: Compile TypeScript to JavaScript
- `npm start`: Build and start production server
- `npm run lint`: Lint code with ESLint
- `npm run lint:fix`: Auto-fix linting issues
- `npm run format`: Format code with Prettier
- `npm run prisma`:generate: Generate Prisma client

## Project Structure

```text
├── src/
│   ├── config/           # Configuration files
│   ├── controllers/      # Request handlers
│   ├── middleware/       # Express middleware
│   ├── prisma/          # Database schema
│   ├── routes/          # API route definitions
│   ├── services/        # Business logic
│   ├── utils/           # Utility functions
│   └── server.ts        # Application entry point
├── .env                # Environment variables
├── .prettierrc         # Code formatting rules
├── eslint.config.mjs   # ESLint configuration
├── tsconfig.json      # TypeScript configuration
└── package.json       # Dependencies and scripts
```
