const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('=== ASM Railway Startup ===');

// Step 0: Schema is already postgresql (committed as such), just generate client
console.log('Schema is already set to postgresql, generating Prisma client...');
try {
  execSync('npx prisma generate', { stdio: 'inherit', timeout: 60000 });
  console.log('Prisma client ready');
} catch (e) {
  console.error('Warning: prisma generate failed:', e.message);
}

// Step 1: Push database schema
console.log('Pushing database schema to PostgreSQL...');
try {
  execSync('npx prisma db push --accept-data-loss 2>&1', { stdio: 'inherit', timeout: 120000 });
  console.log('Successfully pushed database schema');
} catch (e) {
  console.error('Warning: prisma db push failed:', e.message);
  console.error('Tables may already exist from a previous deploy.');
}

// Step 2: Start the Next.js server
const port = process.env.PORT || 3000;

const standalonePath = path.join(__dirname, '.next', 'standalone', 'server.js');
if (fs.existsSync(standalonePath)) {
  console.log(`Starting Next.js standalone server on port ${port}...`);

  process.env.HOSTNAME = '0.0.0.0';
  process.env.PORT = port;

  const server = spawn('node', [standalonePath], {
    stdio: 'inherit',
    env: { ...process.env },
    cwd: path.join(__dirname, '.next', 'standalone')
  });

  server.on('error', (err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });

  server.on('exit', (code) => {
    console.log(`Server exited with code ${code}`);
    process.exit(code || 0);
  });
} else {
  console.log('Standalone build not found, falling back to npx next start...');
  try {
    execSync(`npx next start -p ${port}`, { stdio: 'inherit' });
  } catch (e) {
    console.error('Failed to start Next.js server:', e.message);
    process.exit(1);
  }
}
