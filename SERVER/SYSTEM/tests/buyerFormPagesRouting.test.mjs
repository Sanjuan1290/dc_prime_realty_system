import test from 'node:test'
import assert from 'node:assert/strict'
import {onRequest as legacyBuyerForm} from '../../../CLIENT/functions/buyer-form/[[path]].js'
import {onRequest as buyerFormRoot} from '../../../CLIENT/functions/buyer-form.js'
import {onRequest as systemPage} from '../../../CLIENT/functions/system/[[path]].js'

test('an existing shared buyer link redirects to Realty and preserves its token and query',()=>{
  const response=legacyBuyerForm({request:new Request('https://app.example/buyer-form/synthetic_A-123?lang=en')})
  assert.equal(response.status,302)
  assert.equal(response.headers.get('location'),'https://app.example/system/buyer-form/synthetic_A-123?lang=en')
})
test('buyer form routing preserves encoded paths without changing the destination host',()=>{
  const response=legacyBuyerForm({request:new Request('https://app.example/buyer-form/%2F%2Fevil.invalid?test=1')})
  assert.equal(response.headers.get('location'),'https://app.example/system/buyer-form/%2F%2Fevil.invalid?test=1')
})
test('a buyer-form link without a token still reaches the Realty application',()=>{
  const response=buyerFormRoot({request:new Request('https://app.example/buyer-form')})
  assert.equal(response.headers.get('location'),'https://app.example/system/buyer-form')
})
test('the redirected buyer link serves the Realty SPA on direct loads and refreshes',async()=>{
  const requests=[]
  const response=await systemPage({request:new Request('https://app.example/system/buyer-form/synthetic_A-123'),env:{ASSETS:{fetch:async url=>{requests.push(String(url));return new Response('Realty application')}}},next:()=>assert.fail('Buyer links must not use the Website SPA')})
  assert.equal(await response.text(),'Realty application')
  assert.deepEqual(requests,['https://app.example/system/'])
})
