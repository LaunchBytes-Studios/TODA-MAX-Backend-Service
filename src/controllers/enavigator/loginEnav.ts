import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { supabase } from '../../config/db';
import { Request, Response } from 'express';

const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_key';

export const login = async (req: Request, res: Response) => {
  try {
    const { contact, password: inputPassword } = req.body ?? {};

    console.log('Trying to login admin with contact:', contact);

    if (!contact || !inputPassword) {
      return res.status(400).json({ error: 'Contact and password are required' });
    }

    const { data: admin, error } = await supabase
      .from('eNavigator')
      .select('*')
      .eq('contact', contact)
      .single();

    if (error || !admin) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const storedPassword = admin.password_hash || admin.password;
    
    if (!storedPassword) {
      return res.status(500).json({ error: 'Account configuration error' });
    }

    let passwordValid = false;

    if (typeof storedPassword === 'string' && storedPassword.startsWith('$2')) {
      passwordValid = await bcrypt.compare(inputPassword, storedPassword);
    } else {
      passwordValid = inputPassword === storedPassword;
    }

    if (!passwordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { 
        userId: admin.enav_id,
        role: 'admin',
        contact: admin.contact
      }, 
      JWT_SECRET, 
      { expiresIn: '3d' }
    );

    console.log('Successful admin login for:', admin.enav_id);
    
    const { password: adminPassword, ...adminWithoutPassword } = admin;
    
    return res.json({ 
      token, 
      user: adminWithoutPassword 
    });

  } catch (err) {
    console.error('Admin login error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

type JwtPayload = {
  userId: string;
  role: string;
  contact: string;
  iat?: number;
  exp?: number;
};

export const me = async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);
    
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    
    return res.json({ 
      user: {
        userId: decoded.userId,
        role: decoded.role,
        contact: decoded.contact
      }
    });
    
  } catch (err) {
    console.error('Me endpoint error:', err);
    return res.status(401).json({ error: 'Invalid token' });
  }
};