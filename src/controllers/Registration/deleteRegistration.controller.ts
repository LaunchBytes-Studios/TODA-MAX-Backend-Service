import { Request, Response } from 'express';
import { supabase } from '../../config/db';

// Deletes/updates registration codes based on the following logic:
//   - Mark codes older than 1 day as status 'expired' (excluding 'used').
//   - Delete codes older than 30 days (excluding 'used').
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

		// Bulk maintenance: expire >1 day old, delete >30 days old (do not touch 'used')
		const now = Date.now();
		const oneDayAgoIso = new Date(now - 24 * 60 * 60 * 1000).toISOString();
		const thirtyDaysAgoIso = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();

		// 1) Mark as expired: created_at <= oneDayAgo AND status is not 'used' or already 'expired'
		const { error: updateError } = await supabase
			.from('RegistrationCode')
			.update({ status: 'expired' })
			.lte('created_at', oneDayAgoIso)
			.neq('status', 'used')
			.neq('status', 'expired');

		if (updateError) {
			return res.status(500).json({ message: 'Failed to update stale registration codes to expired.', error: updateError });
		}

		// 2) Delete very old: created_at <= thirtyDaysAgo AND status is not 'used'
		const { error: deleteError } = await supabase
			.from('RegistrationCode')
			.delete()
			.lte('created_at', thirtyDaysAgoIso)
			.neq('status', 'used');

		if (deleteError) {
			return res.status(500).json({ message: 'Failed to delete very old registration codes.', error: deleteError });
		}

		return res.status(200).json({ success: true, mode: 'maintenance' });
	} catch (err) {
		return res.status(500).json({ message: 'Server error.', error: err });
	}
};
