import {defineConfig} from 'vite';import react from '@vitejs/plugin-react';
export default defineConfig({plugins:[react()],base: process.env.DC_MULTI_APP_BUILD === '1' ? '/finance/' : '/',server:{port:5177,strictPort:true,proxy:{'/api':'http://127.0.0.1:5103'}}});
