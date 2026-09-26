// Create a login user, or reset an existing user's password.
//
//   node --env-file=.env.local scripts/create-user.mjs <username>
//
// You'll be prompted for the password (input is hidden).
import { randomBytes, scrypt as scryptCb } from 'node:crypto';
import { promisify } from 'node:util';
import { neon } from '@neondatabase/serverless';

const scrypt = promisify(scryptCb);

// Must stay in sync with lib/password.ts
async function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

function promptHidden(question) {
  return new Promise((resolve) => {
    const { stdin, stdout } = process;
    stdout.write(question);
    let input = '';
    stdin.setRawMode?.(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    const onData = (ch) => {
      if (ch === '\r' || ch === '\n' || ch === '\u0004') {
        stdin.setRawMode?.(false);
        stdin.pause();
        stdin.off('data', onData);
        stdout.write('\n');
        resolve(input);
      } else if (ch === '\u0003') {
        process.exit(1);
      } else if (ch === '\u007f' || ch === '\b') {
        input = input.slice(0, -1);
      } else {
        input += ch;
      }
    };
    stdin.on('data', onData);
  });
}

const username = process.argv[2]?.trim().toLowerCase();
if (!username || !/^[a-z0-9._-]{3,64}$/.test(username)) {
  console.error('Usage: node --env-file=.env.local scripts/create-user.mjs <username>');
  console.error('Username: 3-64 chars, letters, digits, dot, dash or underscore.');
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Run with --env-file=.env.local');
  process.exit(1);
}

const password = await promptHidden(`Password for "${username}": `);
if (password.length < 10) {
  console.error('Password must be at least 10 characters.');
  process.exit(1);
}
const confirm = await promptHidden('Confirm password: ');
if (password !== confirm) {
  console.error('Passwords do not match.');
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);
const hash = await hashPassword(password);
const rows = await sql`
  INSERT INTO users (username, password_hash) VALUES (${username}, ${hash})
  ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash
  RETURNING (xmax = 0) AS inserted
`;
console.log(rows[0]?.inserted ? `Created user "${username}".` : `Updated password for "${username}".`);
