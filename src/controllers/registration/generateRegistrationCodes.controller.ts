import { supabase } from '../../config/db';
import { getFirstEnavId } from '../../utils/getFirstEnavId';
import { Request, Response } from 'express';

export const generateRegistrationCode = async (req: Request, res: Response) => {
  try {
    // Set expires_at to the end of today (23:59:59.999)
    const now = new Date();
    const expiresAt = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    let enav_id: string;
    try {
      enav_id = await getFirstEnavId();
    } catch (err) {
      return res
        .status(500)
        .json({
          message: 'Error fetching enav_id from eNavigator table.',
          error: err instanceof Error ? err.message : err,
        });
    }

    const { data, error } = await supabase
      .from('RegistrationCode')
      .insert([
        {
          enav_id,
          expires_at: expiresAt,
          code: generateRandomCode(),
          status: 'active',
        },
      ])
      .select();
    if (error) {
      return res.status(500).json({ message: 'Error generating registration code.', error });
    }
    return res.status(201).json(data[0]);
  } catch (error) {
    return res.status(500).json({ message: 'Server error.', error });
  }
};

const generateRandomCode = (): string => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
};
