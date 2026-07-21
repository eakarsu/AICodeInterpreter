require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');
if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL is required');
module.exports = new Pool({ connectionString: process.env.DATABASE_URL, ssl:process.env.DB_SSL==='true'?{rejectUnauthorized:true}:undefined });
