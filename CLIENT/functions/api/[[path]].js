import { proxy } from '../../shared/proxy.js'
export const onRequest = (context) => proxy(context, { originVar: 'RENDER_API_ORIGIN', prefix: '', system: 'system' })
