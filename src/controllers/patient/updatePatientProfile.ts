import { Request, Response } from 'express';
import { supabase } from '../../config/db';


export const updateAvatar = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const file = req.file;

    if (!file) return res.status(400).json({ error: 'No file uploaded' });

    // 1. Create a unique file name
    const fileExt = file.originalname.split('.').pop();
    const fileName = `${id}-${Date.now()}.${fileExt}`;
    const filePath = `${fileName}`; // Path inside the bucket

    // 2. Upload the actual file buffer to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: true,
      });

    if (uploadError) {
      console.error('Supabase Upload Error:', uploadError);
      throw uploadError;
    }

    // 3. Get the Public URL of the uploaded file
    const {
      data: { publicUrl },
    } = supabase.storage.from('avatars').getPublicUrl(filePath);

    // 4. Update the avatar_url column in your Patient table
    const { error: dbError } = await supabase
      .from('Patient')
      .update({ avatar_url: publicUrl })
      .eq('patient_id', id);

    if (dbError) throw dbError;

    // Return the URL to the frontend
    return res.json({ avatar_url: publicUrl });
  } catch (err) {
    console.error('Avatar Update Error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};
