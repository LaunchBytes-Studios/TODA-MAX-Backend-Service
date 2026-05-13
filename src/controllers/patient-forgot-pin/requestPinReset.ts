import { Request, Response } from 'express';
import { supabase } from '../../config/db';
import bcrypt from 'bcrypt';
import { sendEmailToEnav } from '../../services/email.service';

export const requestPinReset = async (req: Request, res: Response) => {
  try {
    const { contact } = req.body;

    if (!contact) {
      return res.status(400).json({
        success: false,
        message: 'Contact is required',
      });
    }

    const now = new Date();

    /* --------------------------------------------------
      COOLDOWN CHECK (60 seconds)
    -------------------------------------------------- */
    const { data: lastRequest } = await supabase
      .from('PinResetRequests')
      .select('created_at')
      .eq('contact', contact)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (lastRequest?.created_at) {
      const lastTime = new Date(lastRequest.created_at).getTime();
      const diffSeconds = (now.getTime() - lastTime) / 1000;

      if (diffSeconds < 60) {
        return res.status(429).json({
          success: false,
          message: 'Please wait before requesting another code',
        });
      }
    }

    /* --------------------------------------------------
      DAILY LIMIT CHECK (5 per 24h)
    -------------------------------------------------- */
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const { data: dailyRequests } = await supabase
      .from('PinResetRequests')
      .select('id')
      .eq('contact', contact)
      .gte('created_at', oneDayAgo.toISOString());

    if ((dailyRequests?.length || 0) >= 5) {
      return res.status(429).json({
        success: false,
        message: 'Daily reset limit reached. Try again tomorrow.',
      });
    }

    await supabase
      .from('PinResetRequests')
      .update({ is_used: true })
      .eq('contact', contact)
      .eq('is_used', false);

    const rawCode = Math.floor(100000 + Math.random() * 900000).toString();

    const resetCodeHash = await bcrypt.hash(rawCode, 10);

    const expiresAt = new Date(now.getTime() + 15 * 60 * 1000);

    const { error } = await supabase.from('PinResetRequests').insert({
      contact,
      reset_code_hash: resetCodeHash,
      expires_at: expiresAt,
      is_used: false,
    });

    if (error) throw error;

    await sendEmailToEnav({
      subject: 'PIN Reset Request',
      body: `
New PIN reset request:

Contact: ${contact}
Code: ${rawCode}
Expires: ${expiresAt.toISOString()}
      `,
      html: `
<div style="font-family: Arial, sans-serif; background:#f4f6f8; padding:20px;">
  <div style="max-width:600px; margin:auto; background:white; padding:24px; border-radius:12px; border:1px solid #e5e7eb;">

    <h2 style="color:#1f2937; margin-bottom:16px;">
      🔐 PIN Reset Request
    </h2>

    <p style="color:#374151; font-size:14px;">
      A user has requested a PIN reset. Please verify and provide the reset code.
    </p>

    <div style="margin-top:20px; padding:16px; background:#f9fafb; border-radius:10px;">
      <p style="margin:0; font-size:14px;">
        <strong>Contact:</strong> ${contact}
      </p>

      <p style="margin:12px 0 0; font-size:14px;">
        <strong>Reset Code:</strong>
      </p>

      <div style="
        font-size:24px;
        font-weight:bold;
        letter-spacing:6px;
        color:#111827;
        margin-top:6px;
      ">
        ${rawCode}
      </div>

      <p style="margin-top:12px; font-size:12px; color:#6b7280;">
        Expires: ${expiresAt.toLocaleString()}
      </p>
    </div>

    <p style="margin-top:20px; font-size:12px; color:#9ca3af;">
      This is an automated message from TODA MAX system.
    </p>

  </div>
</div>
`,
    });

    console.log(`Sent PIN reset code for ${contact} successfully.`);
    return res.json({
      success: true,
      message: 'Reset request sent successfully',
    });
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};
