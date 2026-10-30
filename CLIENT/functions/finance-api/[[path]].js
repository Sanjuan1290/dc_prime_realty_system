import { proxy } from '../../shared/proxy.js'
export const onRequest = (context) => proxy(context, { originVar: 'FINANCE_API_ORIGIN', prefix: '/finance-api', system: 'finance' })
