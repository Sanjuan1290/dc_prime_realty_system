
import { db } from '../db/connect.js'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcrypt'


export const login = async(req, res) => {
    const { email, password } = req.body

    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' })
    }

    const [rows] = await db.query(
        `
            SELECT
                id, 
                first_name, 
                last_name,
                middle_name, 
                email, 
                password_hash,
                role,
                status, 
                must_change_password, 
                last_login, 
                created_at, 
                updated_at
            FROM users WHERE email = ?  
            LIMIT 1
        `, [String(email.trim())]
    )

    const user = rows[0]
    
    if (!user) return res.status(401).json({ message: 'Email does not exist!' })
    if (user.status !== 'active')  return res.status(403).json({ message: 'Account is not active' })
    
    const isPasswordCorrect = await bcrypt.compare(password, user.password_hash)

    if (!isPasswordCorrect) return res.status(401).json({ message: 'Wrong password' })

    const token = jwt.sign(
        { id: user.id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '1d' }
    )

    res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 1000 * 60 * 60 * 24 * 1,
    })

    await db.query(`UPDATE users SET last_login = NOW() WHERE id = ?`, [user.id])

    const responseUser = {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
        status: user.status,
        must_change_password: Boolean(user.must_change_password)
    }

    
    res.status(200).json({
        message: user.must_change_password
        ? 'Login successful. Password change is required.'
        : 'Login successful',
        user: responseUser,
    })
  
}