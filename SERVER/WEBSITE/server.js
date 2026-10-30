import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const app = express()
app.disable('x-powered-by')
const here = path.dirname(fileURLToPath(import.meta.url))
const publicDir = path.resolve(here, '../../CLIENT/WEBSITE/dist')
app.get('/health', (_req,res) => res.json({status:'ok',service:'website'}))
app.use(express.static(publicDir, {index:false, maxAge:'1h'}))
app.get(/.*/, (_req,res) => res.sendFile(path.join(publicDir,'index.html')))
const port = Number(process.env.PORT || 5101)
app.listen(port, '0.0.0.0', () => console.log(`Website server listening on ${port}`))
