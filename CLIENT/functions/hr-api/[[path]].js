import { proxy } from '../../shared/proxy.js'
export const onRequest = (context) => proxy(context, { originVar: 'HR_API_ORIGIN', prefix: '/hr-api', system: 'hr' })
