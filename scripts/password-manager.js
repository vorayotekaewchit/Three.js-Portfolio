#!/usr/bin/env node
/**
 * Password manager — generate SALT_B64 and EXPECTED_HASH_B64 for password-auth.js.
 * Run: node scripts/password-manager.js "YourNewPassword"
 * Paste the output into js/password-auth.js (replace SALT_B64 and EXPECTED_HASH_B64).
 * Rotate passwords monthly for client demos.
 */

import crypto from 'crypto';
import readline from 'readline';

const ITERATIONS = 100000;
const SALT_LEN = 16;
const KEY_LEN = 32;

function toB64(buf) {
  return Buffer.from(buf).toString('base64');
}

function derive(password, salt) {
  return crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LEN, 'sha256');
}

function main() {
  const password = process.argv[2];
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const run = (pwd) => {
    if (!pwd || !pwd.trim()) {
      console.error('Usage: node scripts/password-manager.js "YourNewPassword"');
      process.exit(1);
    }
    const salt = crypto.randomBytes(SALT_LEN);
    const hash = derive(pwd, salt);
    console.log('\nPaste these into js/password-auth.js (replace SALT_B64 and EXPECTED_HASH_B64):\n');
    console.log("  var SALT_B64 = '" + toB64(salt) + "';");
    console.log("  var EXPECTED_HASH_B64 = '" + toB64(hash) + "';\n");
    process.exit(0);
  };

  if (password) {
    run(password);
  } else {
    rl.question('Enter new portfolio password: ', (pwd) => {
      rl.close();
      run(pwd);
    });
  }
}

main();
