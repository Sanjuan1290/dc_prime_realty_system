import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig(({mode})=>{
  const env=loadEnv(mode,process.cwd(),'VITE_HR_')
  const target=env.VITE_HR_PROXY_TARGET || 'http://127.0.0.1:5102'
  if(!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(target)) throw new Error('HR dev proxy must point to the local HR API, not Realty.')
  return { plugins:[react()], base: process.env.DC_MULTI_APP_BUILD === '1' ? '/hr/' : '/', server:{port:5175,proxy:{'/api/v1':{target,changeOrigin:true}}} }
})
