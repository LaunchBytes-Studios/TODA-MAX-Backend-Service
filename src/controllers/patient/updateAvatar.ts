import { Request, Response } from 'express';
import { supabase } from '../../config/db';

export const updateAvatar = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const file = req.file;

    if (!file) return res.status(400).json({ error: 'No file uploaded' });

    // Validation: Only allow images
    const allowedMimeTypes = ['image/jpeg', 'image/png'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return res.status(400).json({ error: 'Invalid file type. Only JPG, and PNG are allowed.' });
    }

    // Storage Management: Use a stable path (patient_id/avatar) to prevent unbounded growth
    // Upsert: true will overwrite the existing file at this path
    const fileExt = file.originalname.split('.').pop() || 'png';
    const filePath = `${id}/avatar.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: true,
      });

    if (uploadError) throw uploadError;

    const {
      data: { publicUrl },
    } = supabase.storage.from('avatars').getPublicUrl(filePath);

    const { error: dbError } = await supabase
      .from('Patient')
      .update({ avatar_url: publicUrl })
      .eq('patient_id', id);

    if (dbError) throw dbError;

    return res.json({ avatar_url: publicUrl });
  } catch (err) {
    console.error('Avatar Update Error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};
