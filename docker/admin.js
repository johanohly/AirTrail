/**
 * AirTrail Admin CLI — administrative commands for managing AirTrail.
 *
 * Usage inside Docker:
 *   docker exec -it <container> airtrail-admin <command>
 *
 * Commands:
 *   list-users         List all users
 *   reset-password     Reset a user's password
 *   grant-admin        Grant admin role to a user
 *   revoke-admin       Revoke admin role from a user
 *   version            Print AirTrail version
 *   help               Show this help message
 */

import { createInterface } from 'node:readline/promises';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';
import { hash } from '@node-rs/argon2';

// --- Config ---

const ARGON2_OPTIONS = {
  memoryCost: 19456,
  timeCost: 2,
  outputLen: 32,
  parallelism: 1,
};

// --- Helpers ---

function getClient() {
  return new pg.Client({ connectionString: process.env.DB_URL });
}

async function withClient(fn) {
  const client = getClient();
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

function createPrompt() {
  return createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

async function promptPassword(message) {
  // Disable echo for password input
  process.stdout.write(message);
  const password = await new Promise((resolve) => {
    let input = '';
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    const onData = (ch) => {
      if (ch === '\n' || ch === '\r' || ch === '\u0004') {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.removeListener('data', onData);
        process.stdout.write('\n');
        resolve(input);
      } else if (ch === '\u0003') {
        // Ctrl+C
        process.stdout.write('\n');
        process.exit(1);
      } else if (ch === '\u007F' || ch === '\b' || ch === '\x7f') {
        // Backspace
        if (input.length > 0) {
          input = input.slice(0, -1);
          process.stdout.write('\b \b');
        }
      } else {
        input += ch;
        process.stdout.write('*');
      }
    };

    process.stdin.on('data', onData);
  });
  return password;
}

async function hashPassword(password) {
  return hash(password.normalize('NFKC'), ARGON2_OPTIONS);
}

function formatTable(rows, columns) {
  if (rows.length === 0) {
    console.log('  (no results)');
    return;
  }

  const widths = columns.map((col) =>
    Math.max(
      col.header.length,
      ...rows.map((row) => String(col.value(row)).length),
    ),
  );

  const header = columns
    .map((col, i) => col.header.padEnd(widths[i]))
    .join('  ');
  const separator = widths.map((w) => '-'.repeat(w)).join('  ');

  console.log(`  ${header}`);
  console.log(`  ${separator}`);
  for (const row of rows) {
    const line = columns
      .map((col, i) => String(col.value(row)).padEnd(widths[i]))
      .join('  ');
    console.log(`  ${line}`);
  }
}

// --- Commands ---

async function listUsers() {
  await withClient(async (client) => {
    const { rows } = await client.query(
      'SELECT id, username, display_name, role, oauth_id FROM "user" ORDER BY role, username',
    );

    console.log(`\nUsers (${rows.length}):\n`);
    formatTable(rows, [
      { header: 'Username', value: (r) => r.username },
      { header: 'Display Name', value: (r) => r.display_name },
      { header: 'Role', value: (r) => r.role },
      { header: 'OAuth', value: (r) => (r.oauth_id ? 'yes' : 'no') },
      { header: 'ID', value: (r) => r.id },
    ]);
    console.log();
  });
}

async function resetPassword() {
  const rl = createPrompt();

  try {
    const username = await rl.question('Username: ');
    if (!username.trim()) {
      console.error('Error: Username cannot be empty.');
      process.exit(1);
    }

    await withClient(async (client) => {
      const { rows } = await client.query(
        'SELECT id, username, role FROM "user" WHERE username = $1',
        [username.trim()],
      );

      if (rows.length === 0) {
        console.error(`Error: User "${username.trim()}" not found.`);
        process.exit(1);
      }

      const user = rows[0];
      rl.close();

      const password = await promptPassword(
        `New password for "${user.username}": `,
      );
      if (!password || password.length < 8) {
        console.error('Error: Password must be at least 8 characters.');
        process.exit(1);
      }

      const confirm = await promptPassword('Confirm password: ');
      if (password !== confirm) {
        console.error('Error: Passwords do not match.');
        process.exit(1);
      }

      const hashed = await hashPassword(password);
      await client.query('UPDATE "user" SET password = $1 WHERE id = $2', [
        hashed,
        user.id,
      ]);

      console.log(
        `\nPassword for "${user.username}" (${user.role}) has been reset.`,
      );
    });
  } catch (e) {
    rl.close();
    throw e;
  }
}

async function grantAdmin() {
  const rl = createPrompt();

  try {
    const username = await rl.question('Username to grant admin: ');
    rl.close();

    if (!username.trim()) {
      console.error('Error: Username cannot be empty.');
      process.exit(1);
    }

    await withClient(async (client) => {
      const { rows } = await client.query(
        'SELECT id, username, role FROM "user" WHERE username = $1',
        [username.trim()],
      );

      if (rows.length === 0) {
        console.error(`Error: User "${username.trim()}" not found.`);
        process.exit(1);
      }

      const user = rows[0];

      if (user.role === 'owner') {
        console.error('Error: Cannot change role of the owner.');
        process.exit(1);
      }

      if (user.role === 'admin') {
        console.log(`User "${user.username}" is already an admin.`);
        return;
      }

      await client.query('UPDATE "user" SET role = $1 WHERE id = $2', [
        'admin',
        user.id,
      ]);

      console.log(`\nGranted admin role to "${user.username}".`);
    });
  } catch (e) {
    rl.close();
    throw e;
  }
}

async function revokeAdmin() {
  const rl = createPrompt();

  try {
    const username = await rl.question('Username to revoke admin: ');
    rl.close();

    if (!username.trim()) {
      console.error('Error: Username cannot be empty.');
      process.exit(1);
    }

    await withClient(async (client) => {
      const { rows } = await client.query(
        'SELECT id, username, role FROM "user" WHERE username = $1',
        [username.trim()],
      );

      if (rows.length === 0) {
        console.error(`Error: User "${username.trim()}" not found.`);
        process.exit(1);
      }

      const user = rows[0];

      if (user.role === 'owner') {
        console.error('Error: Cannot change role of the owner.');
        process.exit(1);
      }

      if (user.role === 'user') {
        console.log(`User "${user.username}" is already a regular user.`);
        return;
      }

      await client.query('UPDATE "user" SET role = $1 WHERE id = $2', [
        'user',
        user.id,
      ]);

      console.log(`\nRevoked admin role from "${user.username}".`);
    });
  } catch (e) {
    rl.close();
    throw e;
  }
}

function printVersion() {
  try {
    const pkg = JSON.parse(
      readFileSync(join(import.meta.dirname, '..', 'package.json'), 'utf-8'),
    );
    console.log(`AirTrail v${pkg.version}`);
  } catch {
    console.error('Error: Could not read version from package.json');
    process.exit(1);
  }
}

function printHelp() {
  console.log(`
AirTrail Admin CLI

Usage: airtrail-admin <command>

Commands:
  list-users         List all users with their roles
  reset-password     Reset a user's password
  grant-admin        Grant admin role to a user
  revoke-admin       Revoke admin role from a user
  version            Print AirTrail version
  help               Show this help message

Examples:
  docker exec -it airtrail airtrail-admin list-users
  docker exec -it airtrail airtrail-admin reset-password
  docker exec -it airtrail airtrail-admin grant-admin
`);
}

// --- Main ---

const commands = {
  'list-users': listUsers,
  'reset-password': resetPassword,
  'grant-admin': grantAdmin,
  'revoke-admin': revokeAdmin,
  version: printVersion,
  help: printHelp,
};

async function main() {
  const command = process.argv[2];

  if (!command) {
    printHelp();
    process.exit(1);
  }

  const fn = commands[command];
  if (!fn) {
    console.error(`Unknown command: ${command}\n`);
    printHelp();
    process.exit(1);
  }

  await fn();
}

main().catch((err) => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
