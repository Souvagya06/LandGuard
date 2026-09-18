#!/usr/bin/env node
/**
 * Prints an AUTHORITY_USERS entry for one authority account.
 *   node scripts/hash-password.js <username> <role> [display name]
 * The password is read from the LANDGUARD_PASSWORD environment variable or
 * prompted on stdin, so it never appears in shell history.
 */
const readline = require('readline');
const { hashPassword, ROLE_RANK } = require('../services/auth');

const [username, role, ...nameParts] = process.argv.slice(2);
if (!username || !(role in ROLE_RANK)) {
  console.error(`Usage: node scripts/hash-password.js <username> <${Object.keys(ROLE_RANK).join('|')}> [display name]`);
  process.exit(1);
}

function emit(password) {
  if (!password || password.length < 12) {
    console.error('Use a password of at least 12 characters.');
    process.exit(1);
  }
  const entry = { username, role, name: nameParts.join(' ') || username, passwordHash: hashPassword(password) };
  console.log(JSON.stringify(entry));
}

if (process.env.LANDGUARD_PASSWORD) emit(process.env.LANDGUARD_PASSWORD);
else {
  const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
  rl.question('Password: ', (answer) => { rl.close(); emit(answer.trim()); });
}
