import { Request, Response } from 'express';
import { supabase } from '../../config/db';

// Deletes a registration code by numeric `code_id` provided via query param `codeId`
export const deleteRegistrationCode = async (req: Request, res: Response) => {
	try {
		const codeIdParam = req.query.codeId as string | undefined;

		// If a specific codeId is provided, delete that record only
		if (codeIdParam) {
			const codeId = Number(codeIdParam);
			if (Number.isNaN(codeId) || codeId <= 0) {
				return res.status(400).json({ message: 'Invalid `codeId` provided.' });
			}

			const { error } = await supabase
				.from('RegistrationCode')
				.delete()
				.eq('code_id', codeId);

			if (error) {
				if ((error as { code?: string }).code === 'PGRST116') {
					return res.status(404).json({ message: 'Registration code not found.' });
				}
				return res.status(500).json({ message: 'Failed to delete registration code.', error });
			}

			return res.status(200).json({ success: true, codeId });
		}

		// No codeId provided: bulk delete all expired codes but do NOT delete 'used'
		const nowIso = new Date().toISOString();
		const { error } = await supabase
			.from('RegistrationCode')
			.delete()
			.lte('expires_at', nowIso)
			.neq('status', 'used');

		if (error) {
			return res.status(500).json({ message: 'Failed to delete expired registration codes.', error });
		}

		return res.status(200).json({ success: true, mode: 'bulk-expired' });
	} catch (err) {
		return res.status(500).json({ message: 'Server error.', error: err });
	}
};
