import { supabase } from '../config/db';

type RewardTransactionRow = {
  trans_id: string;
  points: number;
  code: string;
  status: string | null;
  patient_id: string | null;
  enav_id: string | null;
  trans_date: string | null;
  reward_id: number | null;
};

export type RewardVerificationPayload = {
  transId: string;
  code: string;
  status: string;
  points: number;
  patientId: string | null;
  patientName: string;
  rewardId: number | null;
  rewardName: string;
  transDate: string | null;
  validatedByEnavId: string | null;
  isValid: boolean;
  isFinalized: boolean;
};

type FinalizeResult = {
  type: 'success' | 'not_found' | 'already_finalized' | 'not_finalizable';
  data?: RewardVerificationPayload;
};

const FINALIZED_STATUSES = ['claimed', 'used', 'redeemed', 'completed', 'finalized'];
const NOT_FINALIZABLE_STATUSES = ['expired', 'cancelled', 'invalid'];

const normalizeStatus = (status: string | null | undefined): string =>
  String(status ?? '')
    .trim()
    .toLowerCase();

const getLatestTransactionByCode = async (code: string): Promise<RewardTransactionRow | null> => {
  const normalizedCode = code.trim();

  const { data, error } = await supabase
    .from('RewardTransaction')
    .select('trans_id, points, code, status, patient_id, enav_id, trans_date, reward_id')
    .eq('code', normalizedCode)
    .order('trans_date', { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(`Failed to retrieve reward transaction: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return null;
  }

  return data[0] as RewardTransactionRow;
};

const getRewardName = async (rewardId: number | null): Promise<string> => {
  if (!rewardId) {
    return 'Unknown reward';
  }

  const { data, error } = await supabase
    .from('Reward')
    .select('name')
    .eq('reward_id', rewardId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to retrieve reward details: ${error.message}`);
  }

  return data?.name ?? 'Unknown reward';
};

const getPatientName = async (patientId: string | null): Promise<string> => {
  if (!patientId) {
    return 'Unknown patient';
  }

  const { data, error } = await supabase
    .from('Patient')
    .select('firstname, surname')
    .eq('patient_id', patientId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to retrieve patient details: ${error.message}`);
  }

  const fullName = [data?.firstname, data?.surname].filter(Boolean).join(' ');
  return fullName || 'Unknown patient';
};

const buildVerificationPayload = async (
  transaction: RewardTransactionRow,
): Promise<RewardVerificationPayload> => {
  const normalizedStatus = normalizeStatus(transaction.status);
  const isFinalized = FINALIZED_STATUSES.includes(normalizedStatus);
  const isValid = !isFinalized && !NOT_FINALIZABLE_STATUSES.includes(normalizedStatus);

  const [rewardName, patientName] = await Promise.all([
    getRewardName(transaction.reward_id),
    getPatientName(transaction.patient_id),
  ]);

  return {
    transId: transaction.trans_id,
    code: transaction.code,
    status: transaction.status ?? 'unknown',
    points: transaction.points,
    patientId: transaction.patient_id,
    patientName,
    rewardId: transaction.reward_id,
    rewardName,
    transDate: transaction.trans_date,
    validatedByEnavId: transaction.enav_id,
    isValid,
    isFinalized,
  };
};

export const verifyRewardCodeService = async (
  code: string,
): Promise<RewardVerificationPayload | null> => {
  const transaction = await getLatestTransactionByCode(code);

  if (!transaction) {
    return null;
  }

  return buildVerificationPayload(transaction);
};

export const finalizeRewardCodeService = async (
  code: string,
  enavId?: string,
): Promise<FinalizeResult> => {
  const transaction = await getLatestTransactionByCode(code);

  if (!transaction) {
    return { type: 'not_found' };
  }

  const normalizedStatus = normalizeStatus(transaction.status);

  if (FINALIZED_STATUSES.includes(normalizedStatus)) {
    const existingPayload = await buildVerificationPayload(transaction);
    return { type: 'already_finalized', data: existingPayload };
  }

  if (NOT_FINALIZABLE_STATUSES.includes(normalizedStatus)) {
    const existingPayload = await buildVerificationPayload(transaction);
    return { type: 'not_finalizable', data: existingPayload };
  }

  const { data: updated, error } = await supabase
    .from('RewardTransaction')
    .update({
      status: 'claimed',
      enav_id: enavId ?? transaction.enav_id,
      trans_date: new Date().toISOString(),
    })
    .eq('trans_id', transaction.trans_id)
    .select('trans_id, points, code, status, patient_id, enav_id, trans_date, reward_id')
    .single();

  if (error) {
    throw new Error(`Failed to finalize reward transaction: ${error.message}`);
  }

  const payload = await buildVerificationPayload(updated as RewardTransactionRow);
  return { type: 'success', data: payload };
};
