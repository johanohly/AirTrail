/**
 * AirTrail Admin CLI — administrative commands for managing AirTrail.
 *
 * Usage inside Docker:
 *   docker exec -it <container> airtrail-admin <command>
 *
 * Commands:
 *   list-users         List all users and their roles
 *   list-roles         List roles
 *   reset-password     Reset a user's password
 *   set-role           Assign a role to a user
 *   grant-admin        Assign the built-in Administrator role
 *   revoke-admin       Assign the default role
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

const ADMINISTRATOR_ROLE_ID = 'role-administrator';

const USER_WITH_ROLE = `
  SELECT u.id, u.username, u.display_name, u.is_owner, u.oauth_id,
         u.role_id, u.role_assignment_source, r.name AS role_name
  FROM "user" u
  LEFT JOIN access_role r ON r.id = u.role_id`;

const roleLabel = (user) =>
  user.is_owner ? 'Owner' : (user.role_name ?? '(no role)');

async function findUser(client, username) {
  const { rows } = await client.query(
    `${USER_WITH_ROLE} WHERE u.username = $1`,
    [username],
  );
  if (rows.length === 0) {
    console.error(`Error: User "${username}" not found.`);
    process.exit(1);
  }
  return rows[0];
}

async function findRole(client, nameOrId) {
  const { rows } = await client.query(
    'SELECT id, name FROM access_role WHERE id = $1 OR LOWER(name) = LOWER($1)',
    [nameOrId],
  );
  return rows[0] ?? null;
}

async function askUsername(message) {
  const rl = createPrompt();
  try {
    const username = (await rl.question(message)).trim();
    if (!username) {
      console.error('Error: Username cannot be empty.');
      process.exit(1);
    }
    return username;
  } finally {
    rl.close();
  }
}

async function assignRole(client, user, role) {
  if (user.is_owner) {
    console.error(
      'Error: The owner has every permission; their role cannot be changed.',
    );
    process.exit(1);
  }
  if (user.role_id === role.id) {
    console.log(`User "${user.username}" already has the ${role.name} role.`);
    return;
  }
  // A local assignment, so OAuth role mapping on login does not overwrite it.
  await client.query(
    `UPDATE "user" SET role_id = $1, role_assignment_source = 'local' WHERE id = $2`,
    [role.id, user.id],
  );
  console.log(`\nAssigned the ${role.name} role to "${user.username}".`);
}

async function listUsers() {
  await withClient(async (client) => {
    const { rows } = await client.query(
      `${USER_WITH_ROLE} ORDER BY u.is_owner DESC, r.name, u.username`,
    );

    console.log(`\nUsers (${rows.length}):\n`);
    formatTable(rows, [
      { header: 'Username', value: (r) => r.username },
      { header: 'Display Name', value: (r) => r.display_name },
      { header: 'Role', value: roleLabel },
      { header: 'OAuth', value: (r) => (r.oauth_id ? 'yes' : 'no') },
      { header: 'ID', value: (r) => r.id },
    ]);
    console.log();
  });
}

async function listRoles() {
  await withClient(async (client) => {
    const { rows } = await client.query(`
      SELECT r.id, r.name, r.id = s.default_role_id AS is_default,
             (SELECT COUNT(*) FROM "user" u WHERE u.role_id = r.id) AS users
      FROM access_role r
      CROSS JOIN authorization_settings s
      ORDER BY r.name`);

    console.log(`\nRoles (${rows.length}):\n`);
    formatTable(rows, [
      { header: 'Name', value: (r) => r.name },
      { header: 'Default', value: (r) => (r.is_default ? 'yes' : '') },
      { header: 'Users', value: (r) => r.users },
      { header: 'ID', value: (r) => r.id },
    ]);
    console.log();
  });
}

async function resetPassword() {
  const username = await askUsername('Username: ');

  await withClient(async (client) => {
    const user = await findUser(client, username);

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
      `\nPassword for "${user.username}" (${roleLabel(user)}) has been reset.`,
    );
  });
}

async function setRole() {
  const username = await askUsername('Username: ');
  await withClient(async (client) => {
    const user = await findUser(client, username);
    const rl = createPrompt();
    const answer = (
      await rl.question(`Role for "${user.username}" (name or ID): `)
    ).trim();
    rl.close();
    const role = await findRole(client, answer);
    if (!role) {
      console.error(
        `Error: Role "${answer}" not found. Run "airtrail-admin list-roles".`,
      );
      process.exit(1);
    }
    await assignRole(client, user, role);
  });
}

async function grantAdmin() {
  const username = await askUsername('Username to grant admin: ');
  await withClient(async (client) => {
    const user = await findUser(client, username);
    const role = await findRole(client, ADMINISTRATOR_ROLE_ID);
    if (!role) {
      console.error(
        'Error: The built-in Administrator role no longer exists. Use "set-role" instead.',
      );
      process.exit(1);
    }
    await assignRole(client, user, role);
  });
}

async function revokeAdmin() {
  const username = await askUsername('Username to revoke admin: ');
  await withClient(async (client) => {
    const user = await findUser(client, username);
    const { rows } = await client.query(`
      SELECT r.id, r.name FROM authorization_settings s
      JOIN access_role r ON r.id = s.default_role_id`);
    await assignRole(client, user, rows[0]);
  });
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
  list-users         List all users and their roles
  list-roles         List roles, marking the default for new users
  reset-password     Reset a user's password
  set-role           Assign a role to a user
  grant-admin        Assign the built-in Administrator role to a user
  revoke-admin       Assign the default role to a user
  version            Print AirTrail version
  help               Show this help message

Examples:
  docker exec -it airtrail airtrail-admin list-users
  docker exec -it airtrail airtrail-admin reset-password
  docker exec -it airtrail airtrail-admin set-role
`);
}

// --- Main ---

const commands = {
  'list-users': listUsers,
  'list-roles': listRoles,
  'reset-password': resetPassword,
  'set-role': setRole,
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
