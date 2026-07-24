'use strict';
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const bcrypt = require('bcryptjs');
const pool = require('../db');

async function main() {
  const email = String(process.env.PROVISION_ADMIN_EMAIL || process.env.ADMIN_EMAIL || process.env.DEFAULT_EMAIL || '').trim().toLowerCase();
  const password = String(process.env.PROVISION_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || process.env.DEFAULT_PASSWORD || '');
  if (!email || password.length < 12) throw new Error('Provisioning requires an admin email and a password of at least 12 characters');
  const hash = await bcrypt.hash(password, 12);
  await pool.query(
    `INSERT INTO users(email,password,name,role) VALUES($1,$2,$3,'admin')
     ON CONFLICT(email) DO UPDATE SET password=EXCLUDED.password,name=EXCLUDED.name,role='admin'`,
    [email, hash, 'Runtime Administrator']
  );
  console.log('Runtime administrator provisioned');
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(() => pool.end());
