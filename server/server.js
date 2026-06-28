import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import helmet from 'helmet'
import 'express-async-errors'

import { db } from './db/connect.js'


// Routers
import userRouter from './routers/users.routers.js'

const app = express()

app.use(helmet())

app.use(express.json())
app.use(cookieParser())

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5174',
    credentials: true,
  })
)

app.get('/', (req, res) => {
  res.json({ message: '✅Server is running' })
})

// Routers
app.use('/api/v1/user', userRouter)


const PORT = process.env.PORT || 5001

app.listen(PORT, async() => {
    try {
        console.log(`Server running on port ${PORT}`)
        await db.query('SELECT 1')
        console.log('🟢 Database connected successfully')
    } catch (err) {
        console.error('Failed to start server:', err.message)
        console.log('🔴 Database connection failed')
        process.exit(1)
    }
})
