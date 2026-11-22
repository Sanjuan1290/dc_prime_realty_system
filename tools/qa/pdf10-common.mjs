import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
export const requireSystem=createRequire(new URL('../../SERVER/SYSTEM/package.json',import.meta.url));
const mysql=requireSystem('mysql2/promise');
export const db=mysql.createPool({host:'127.0.0.1',port:13307,user:'qa_system',password:'qa-isolated-only-password',database:'dc_prime_realty_system_db',dateStrings:true});
export const hrDb=mysql.createPool({host:'127.0.0.1',port:13307,user:'qa_hr',password:'qa-isolated-only-password',database:'dc_prime_hr_db',dateStrings:true});
export const guard=async connection=>{const [[server]]=await connection.query('SELECT @@port AS port,@@datadir AS datadir');assert.equal(server.port,13307);assert.equal(server.datadir.toLowerCase().replaceAll('\\','/').replace(/\/$/,''),resolve('QA_REPORTS/.runtime/mysql').toLowerCase().replaceAll('\\','/'))};
export const base='http://127.0.0.1:4179',password='Synthetic-QA-only-2026!';
export async function api(path,body,{method=body?'POST':'GET',cookie='',app='system'}={}){
 const prefix=app==='hr'?'/hr-api/api/v1':'/api/v1';
 const response=await fetch(base+prefix+path,{method,headers:{origin:base,...(cookie?{cookie}:{}),...(body?{'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(30000)});
 const text=await response.text();let data;try{data=JSON.parse(text)}catch{data={message:text.slice(0,500)}}
 return {status:response.status,data,cookie:response.headers.get('set-cookie')?.split(';')[0]};
}
export const ok=(response,status=200)=>{assert.equal(response.status,status,JSON.stringify(response.data));return response.data};
export async function login(email,app='system'){const result=await api(app==='hr'?'/auth/login':'/user/login',{email,password},{app});ok(result);return result.cookie}
