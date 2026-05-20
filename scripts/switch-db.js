#!/usr/bin/env node
/**
 * Switch Prisma schema database provider based on DATABASE_URL.
 * Usage:
 *   node scripts/switch-db.js              - Auto-detect from DATABASE_URL
 *   node scripts/switch-db.js postgresql   - Force PostgreSQL
 *   node scripts/switch-db.js sqlite       - Force SQLite
 */
const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, '..', 'prisma', 'schema.prisma');
const arg = process.argv[2];

let targetProvider;

if (arg && ['sqlite', 'postgresql'].includes(arg)) {
  // Explicit provider passed
  targetProvider = arg;
} else {
  // Auto-detect from DATABASE_URL
  const dbUrl = process.env.DATABASE_URL || '';
  if (dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://')) {
    targetProvider = 'postgresql';
  } else {
    targetProvider = 'sqlite';
  }
}

let schema = fs.readFileSync(schemaPath, 'utf-8');

// Replace the provider line
schema = schema.replace(
  /provider\s*=\s*"(sqlite|postgresql)"/,
  `provider = "${targetProvider}"`
);

fs.writeFileSync(schemaPath, schema);
console.log(`Switched Prisma provider to "${targetProvider}" (DATABASE_URL: ${process.env.DATABASE_URL ? 'set' : 'not set'})`);
