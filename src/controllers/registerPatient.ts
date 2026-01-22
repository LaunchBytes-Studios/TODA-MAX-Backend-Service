import bcrypt from 'bcrypt';
import { supabase } from '../config/db';
import { Request, Response } from 'express';

const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const isPhone = (value: string) => /^\+?[1-9]\d{7,14}$/.test(value); // E.164-ish format

export const registerPatient = async (req: Request, res: Response) => {
  const { firstname, surname, birthday, contact, address, diagnosis, pin, registrationCode } =
    req.body ?? {};

  if (!contact || !pin || !birthday || !firstname || !surname || !diagnosis || !registrationCode) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const cleanCode = registrationCode.trim();
  console.log({
    received: registrationCode,
    cleaned: cleanCode,
  });

  try {
    /* -------------------------
       1. Validate registration code
    --------------------------*/
    const { data: codeRow, error: codeError } = await supabase
      .from('RegistrationCode')
      .select('*')
      .ilike('code', cleanCode)
      .single();

    console.log(codeRow, codeError);

    if (codeError || !codeRow) {
      return res.status(400).json({ error: 'Invalid registration code' });
    }

    if (codeRow.status === 'used') {
      return res.status(400).json({ error: 'Registration code already used' });
    }

    if (
      codeRow.status === 'expired' ||
      (codeRow.expires_at && new Date(codeRow.expires_at) < new Date())
    ) {
      return res.status(400).json({ error: 'Registration code expired' });
    }

    /* -------------------------
       2. Determine contact type
    --------------------------*/
    let authResponse;

    if (isEmail(contact)) {
      authResponse = await supabase.auth.admin.createUser({
        email: contact,
        password: pin,
        email_confirm: true,
      });
    } else if (isPhone(contact)) {
      authResponse = await supabase.auth.admin.createUser({
        phone: contact,
        password: pin,
        phone_confirm: true,
      });
    } else {
      return res.status(400).json({
        error: 'Contact must be a valid email or phone number',
      });
    }

    const { data: authData, error: authError } = authResponse;

    if (authError) {
      console.error('Error creating auth user:', authError);
      return res.status(400).json({ error: authError.message });
    }

    const userId = authData.user.id;

    /* -------------------------
       3. Hash PIN
    --------------------------*/
    const pin_hash = pin ? await bcrypt.hash(pin, 10) : null;

    /* -------------------------
       4. Insert patient profile
    --------------------------*/
    const { error: patientError } = await supabase.from('Patient').insert({
      patient_id: userId,
      firstname,
      surname,
      contact,
      address,
      diagnosis,
      birthday,
      pin_hash,
    });

    if (patientError) {
      // rollback auth user if profile insert fails
      console.error('Rolling back user creation due to patient insert error:', patientError);
      await supabase.auth.admin.deleteUser(userId);
      return res.status(500).json({ error: patientError.message });
    }

    /* -------------------------
       5. Mark code as used
    --------------------------*/
    await supabase
      .from('RegistrationCode')
      .update({ status: 'used', used_at: new Date() })
      .eq('code', registrationCode);

    /* -------------------------
       6. Success
    --------------------------*/
    return res.status(201).json({
      message: 'Patient registered successfully',
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
};
