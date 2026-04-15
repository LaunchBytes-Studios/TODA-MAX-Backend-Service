import { Request, Response } from 'express';
import { supabase } from '../../config/db'; // make sure this points to your Supabase client
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

// Secret key for JWT — store in .env for production
const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_key';

const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const isPhone = (value: string) => /^\+?[1-9]\d{7,14}$/.test(value);

export const loginPatient = async (req: Request, res: Response) => {
  try {
    const { contact, pin } = req.body ?? {};

    console.log('Trying to login with credentials:', contact);

    if (!contact || !pin) {
      return res.status(400).json({ error: 'Contact and PIN are required' });
    }

    // Determine contact type
    let userId: string | null = null;

    if (isEmail(contact)) {
      const { data: users, error } = await supabase
        .from('Patient')
        .select('*')
        .eq('contact', contact)
        .single();

      if (error || !users) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      userId = users.patient_id;

      const match = await bcrypt.compare(pin, users.pin_hash);
      if (!match) return res.status(401).json({ error: 'Invalid credentials' });

      // generate JWT
      const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });

      return res.json({ token, user: users });
    } else if (isPhone(contact)) {
      const { data: users, error } = await supabase
        .from('Patient')
        .select('*')
        .eq('contact', contact)
        .single();

      if (error || !users) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      userId = users.patient_id;

      const match = await bcrypt.compare(pin, users.pin_hash);
      if (!match) return res.status(401).json({ error: 'Invalid credentials' });

      // generate JWT
      const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });

      console.log('Successful login for:', userId);
      return res.json({ token, user: users });
    } else {
      return res.status(400).json({ error: 'Invalid contact format' });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
};
