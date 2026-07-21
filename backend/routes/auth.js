const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const router = express.Router();

router.post('/register',async(req,res)=>{try{const {email,password,name}=req.body||{};if(typeof email!=='string'||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return res.status(400).json({error:'Valid email required'});if(typeof password!=='string'||password.length<12)return res.status(400).json({error:'Password must be at least 12 characters'});if(typeof name!=='string'||!name.trim())return res.status(400).json({error:'Name required'});const hash=await bcrypt.hash(password,12);const r=await pool.query("INSERT INTO users(email,password,name,role)VALUES($1,$2,$3,'user')RETURNING id,email,name,role",[email.toLowerCase(),hash,name.trim()]);const user=r.rows[0],token=jwt.sign({id:user.id,email:user.email,role:user.role},process.env.JWT_SECRET,{expiresIn:'8h'});res.status(201).json({token,user});}catch(e){if(e.code==='23505')return res.status(409).json({error:'Email already exists'});res.status(500).json({error:'Internal server error'});}});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });
    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role || 'user' }, process.env.JWT_SECRET, { expiresIn: '8h' });
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, role:user.role || 'user' } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/me', require('../middleware/auth'), async (req, res) => {
  try {
    const result = await pool.query('SELECT id, email, name FROM users WHERE id = $1', [req.user.id]);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
