'use strict';
const express=require('express');const auth=require('../middleware/auth');const W=require('../lib/wave30');
const router=express.Router();const store=W.createTaskStore();
function uid(req){return String((req.user&&(req.user.id||req.user.userId||req.user.email))||'');}
async function mainRows(req){const db=require('../db');const run=(sql,params)=>db.query?db.query(sql,params):db.pool.query(sql,params);let sql='SELECT * FROM notebooks';const p=[];const c=[];if(req.query.search){p.push('%'+req.query.search+'%');const i='$'+p.length;c.push('(title ILIKE '+i+' OR description ILIKE '+i+')');}if(req.query.status){p.push(req.query.status);c.push('status=$'+p.length);}if(c.length)sql+=' WHERE '+c.join(' AND ');sql+=' ORDER BY created_at DESC LIMIT 500';const r=await run(sql,p);return r.rows||[];}
router.get('/tasks',auth,(req,res)=>res.json({data:store.list(uid(req),req.query),total:store.list(uid(req),req.query).length}));
router.post('/tasks',auth,(req,res)=>{try{res.status(201).json(store.create(uid(req),req.body||{}));}catch(e){res.status(e.status||400).json({error:e.message});}});
function upd(req,res){const t=store.update(uid(req),req.params.id,req.body||{});if(!t)return res.status(404).json({error:'Task not found'});res.json(t);}
router.put('/tasks/:id',auth,upd);router.patch('/tasks/:id',auth,upd);
router.get('/records/export',auth,async(req,res)=>{try{const rows=await mainRows(req);if(String(req.query.format||'json').toLowerCase()==='csv'){res.setHeader('Content-Type','text/csv');res.setHeader('Content-Disposition','attachment; filename="notebooks.csv"');return res.send(W.toCsv(rows));}return res.json({data:rows,total:rows.length});}catch(e){res.status(500).json({error:e.message});}});
function ai(name,fn){return async(req,res)=>{try{let rows=Array.isArray((req.body||{}).records)?req.body.records:null;if(!rows){try{rows=await mainRows(req);}catch(e){rows=[];}}const out=await W.runAi(name,rows,fn);res.json(out);}catch(e){res.status(500).json({error:e.message});}}}
router.post('/ai/portfolio-summary',auth,ai('portfolio-summary',W.portfolioSummary));
router.post('/ai/readiness-summary',auth,ai('readiness-summary',W.readinessSummary||W.completenessSummary));
router.post('/ai/coverage-summary',auth,ai('coverage-summary',W.coverageSummary||W.languageSummary||W.skillsSummary));
module.exports=router;
