import { supabase } from '../../config/db';
import { Request, Response } from 'express';

interface Medication {
    name: string;
    price: number
    type: string;
    stock_qty: number;
    threshold_qty: number;
    
}

export const alertMedication = async (req: Request, res: Response) => {
    try {
        // Fetch all medications and filter where stock_qty is less than or equal to threshold_qty
        const { data, error } = await supabase
            .from('Medication')
            .select('*');

        const filteredData = (data as Medication[] )?.filter((med: Medication) => med.stock_qty <= med.threshold_qty) || [];

        if (error) {
            return res.status(500).json({ message: 'Error fetching medications.', error });
        }
        return res.status(200).json(filteredData);
    } catch (error) {
        return res.status(500).json({ message: 'Server error.', error });
    }
};