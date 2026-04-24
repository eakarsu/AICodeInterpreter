require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');
module.exports = new Pool({ connectionString: process.env.DATABASE_URL });
