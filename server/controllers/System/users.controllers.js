
import { db } from '../../db/connect.js'
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
        maxAge: 1000 * 60 * 60 * 24,
    })

    await db.query(`UPDATE users SET last_login = NOW() WHERE id = ?`, [user.id])

    
    res.status(200).json({
        message: user.must_change_password
        ? 'Login successful. Password change is required.'
        : 'Login successful',
        user: {
            id: user.id, 
            first_name: user.first_name, 
            last_name: user.last_name,
            middle_name: user.middle_name, 
            email: user.email, 
            role: user.role,
            status: user.status, 
            must_change_password: Boolean(user.must_change_password), 
            last_login: user.last_login, 
            created_at: user.created_at, 
            updated_at: user.updated_at
        },
    })
  
}

export const createUser = async(req, res) => { 
}
export const editUser = async(req, res) => { 
}
export const deactivateUser = async(req, res) => { 
}
export const activateUser = async(req, res) => { 
}

export const getMe = async (req, res) => {
  try {
    const token = req.cookies.token;

    if (!token) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const [rows] = await db.query(
      `
        SELECT
          id,
          first_name,
          last_name,
          middle_name,
          email,
          role,
          status,
          must_change_password,
          last_login,
          created_at,
          updated_at
        FROM users
        WHERE id = ?
        LIMIT 1
      `,
      [decoded.id]
    );

    const user = rows[0];

    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    return res.json({ user, message: 'Successfully getMe :3' });
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};