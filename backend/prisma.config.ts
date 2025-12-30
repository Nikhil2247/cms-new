/// <reference types="node" />
import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// Use process.env directly with fallback for CI/build environments
// where DATABASE_URL might not be set
const databaseUrl = process.env.DATABASE_URL || 'postgresql://placeholder:placeholder@localhost:5432/placeholder';

export default defineConfig({
  schema: './prisma/schema.prisma',
  migrations: {
    path: './prisma/migrations',
  },
  datasource: {
    url: databaseUrl,
  },
});
