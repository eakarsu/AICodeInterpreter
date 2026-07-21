const test=require('node:test'),assert=require('node:assert/strict');const {policy,artifactUri,secretHash}=require('../lib/executionPolicy');
test('policy enforces deny-by-default network and bounded resources',()=>{const p=policy({language:'python',runtimeVersion:'3.12',cpuMillis:1000,memoryMb:256,timeoutSeconds:10,networkMode:'deny',maxOutputBytes:1000});assert.equal(p.networkMode,'deny');assert.throws(()=>policy({...p,networkMode:'allow'}),/denied/);});
test('unsupported runtimes and excessive quotas fail',()=>{assert.throws(()=>policy({language:'bash',runtimeVersion:'1',cpuMillis:1,memoryMb:1,timeoutSeconds:1,networkMode:'deny',maxOutputBytes:1}),/not allowed/);});
test('artifacts require governed storage',()=>{assert.equal(artifactUri('s3://bucket/key'),'s3://bucket/key');assert.throws(()=>artifactUri('file:///etc/passwd'),/approved/);});
test('lease secrets are stored as hashes',()=>assert.notEqual(secretHash('secret'),'secret'));
