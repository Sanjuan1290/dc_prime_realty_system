import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {loadHrEnvironment} from '../config/environment.js';

test('HR loads its selected settings without overwriting running service variables',()=>{
  const folder=mkdtempSync(join(tmpdir(),'dcprime-hr-env-')),path=join(folder,'.env');
  try {
    writeFileSync(path,'RESEND_API_KEY=fixture-key\nEMAIL_FROM=fixture@qa.invalid\n');
    const env={NODE_ENV:'development',RESEND_API_KEY:'running-service-key'};
    loadHrEnvironment({env,path});
    assert.equal(env.RESEND_API_KEY,'running-service-key');assert.equal(env.EMAIL_FROM,'fixture@qa.invalid');
    const testEnv={NODE_ENV:'test'};loadHrEnvironment({env:testEnv,path});
    assert.equal(testEnv.EMAIL_FROM,undefined);
    testEnv.DOTENV_CONFIG_PATH=path;loadHrEnvironment({env:testEnv});
    assert.equal(testEnv.RESEND_API_KEY,'fixture-key');
  } finally {rmSync(folder,{recursive:true,force:true})}
});
