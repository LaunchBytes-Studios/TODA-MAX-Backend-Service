import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { supabase } from '../../config/db';
import { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_key';

const supabaseAuth = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);

export const login = async (req: Request, res: Response) => {
  try {
    const { contact, password } = req.body ?? {};

    if (!contact || !password) {
      return res.status(400).json({ error: 'Contact and password are required' });
    }

    const { data: authData, error: authError } = await supabaseAuth.auth.signInWithPassword({
      email: contact,
      password,
    });

    if (authError || !authData.user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const userId = authData.user.id;

    const { data: navigator, error } = await supabase
      .from('eNavigator')
      .select('enav_id, name, contact')
      .eq('enav_id', userId)
      .single();

    if (error || !navigator) {
      return res.status(404).json({ error: 'eNavigator profile not found' });
    }

    const token = jwt.sign(
      {
        userId: navigator.enav_id,
        role: 'admin',
        contact: navigator.contact,
      },
      JWT_SECRET,
      { expiresIn: '3d' },
    );

    return res.json({
      token,
      user: {
        enav_id: navigator.enav_id,
        email: navigator.contact,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
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
        contact: decoded.contact,
      },
    });
  } catch (err) {
    console.error('Me endpoint error:', err);
    return res.status(401).json({ error: 'Invalid token' });
  }
};
