import { supabase } from '../config/db';

type RewardRow = {
  reward_id: number;
  name: string | null;
  description: string | null;
  category: string | null;
  points_required: number;
  stock_available: number | null;
  is_active: boolean | null;
  total_redeemed: number | null;
};

type RewardClaimRow = {
  trans_id: string;
  code: string;
  status: string | null;
  points: number;
  created_at: string | null;
  reward_id: number | null;
};

type PatientRewardClaimRow = RewardClaimRow & {
  patient_id: string | null;
};

type PatientRow = {
  patient_id: string;
  points: number | null;
};

export type RewardClaimTicket = {
  transId: string;
  code: string;
  status: string;
  pointsSpent: number;
  createdAt: string | null;
  rewardId: number | null;
  rewardName: string;
  rewardDescription: string;
  rewardCategory: string;
  instructions: string;
};

export type RedeemRewardResult =
  | { type: 'success'; data: { ticket: RewardClaimTicket; remainingPoints: number } }
  | { type: 'not_found' }
  | { type: 'inactive_or_unavailable' }
  | {
      type: 'pending_claim_exists';
      data: { currentPoints: number; claim: RewardClaimTicket };
    }
  | { type: 'insufficient_points'; data: { currentPoints: number; pointsRequired: number } };

export type CancelRewardClaimResult =
  | { type: 'success'; data: { ticket: RewardClaimTicket; remainingPoints: number } }
  | { type: 'not_found' }
  | { type: 'not_pending' };

const CLAIM_INSTRUCTIONS =
  'Present this claim code to an eNavigator in person to receive your reward.';

const createClaimCode = (): string => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'RW-';
  for (let i = 0; i < 8; i += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
};

const getPatientById = async (patientId: string): Promise<PatientRow | null> => {
  const { data, error } = await supabase
    .from('Patient')
    .select('patient_id, points')
    .eq('patient_id', patientId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to retrieve patient: ${error.message}`);
  }

  return data as PatientRow | null;
};

const getRewardById = async (rewardId: number): Promise<RewardRow | null> => {
  const { data, error } = await supabase
    .from('Reward')
    .select(
      'reward_id, name, description, category, points_required, stock_available, is_active, total_redeemed',
    )
    .eq('reward_id', rewardId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to retrieve reward: ${error.message}`);
  }

  return data as RewardRow | null;
};

const getLatestPendingClaimByPatientId = async (
  patientId: string,
): Promise<PatientRewardClaimRow | null> => {
  const { data, error } = await supabase
    .from('RewardTransaction')
    .select('trans_id, code, status, points, created_at, reward_id, patient_id')
    .eq('patient_id', patientId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(`Failed to retrieve pending reward claim: ${error.message}`);
  }

  return (data?.[0] as PatientRewardClaimRow | undefined) ?? null;
};

const getPendingClaimByCodeAndPatientId = async (
  patientId: string,
  code: string,
): Promise<PatientRewardClaimRow | null> => {
  const { data, error } = await supabase
    .from('RewardTransaction')
    .select('trans_id, code, status, points, created_at, reward_id, patient_id')
    .eq('patient_id', patientId)
    .eq('code', code)
    .eq('status', 'pending')
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to retrieve reward claim: ${error.message}`);
  }

  return (data as PatientRewardClaimRow | null) ?? null;
};

const mapClaimRowsToTickets = async (rows: RewardClaimRow[]): Promise<RewardClaimTicket[]> => {
  const rewardIds = Array.from(
    new Set(rows.map((row) => row.reward_id).filter((id): id is number => typeof id === 'number')),
  );

  const rewardMap = new Map<number, RewardRow>();

  if (rewardIds.length > 0) {
    const { data: rewards, error } = await supabase
      .from('Reward')
      .select(
        'reward_id, name, description, category, points_required, stock_available, is_active, total_redeemed',
      )
      .in('reward_id', rewardIds);

    if (error) {
      throw new Error(`Failed to retrieve reward metadata: ${error.message}`);
    }

    (rewards ?? []).forEach((reward) => {
      rewardMap.set((reward as RewardRow).reward_id, reward as RewardRow);
    });
  }

  return rows.map((row) => {
    const reward = row.reward_id ? rewardMap.get(row.reward_id) : null;

    return {
      transId: row.trans_id,
      code: row.code,
      status: row.status ?? 'pending',
      pointsSpent: row.points,
      createdAt: row.created_at,
      rewardId: row.reward_id,
      rewardName: reward?.name ?? 'Unknown reward',
      rewardDescription: reward?.description ?? '',
      rewardCategory: reward?.category ?? 'Unknown',
      instructions: CLAIM_INSTRUCTIONS,
    };
  });
};

export const redeemRewardByPatientService = async (
  patientId: string,
  rewardId: number,
): Promise<RedeemRewardResult> => {
  const [patient, reward] = await Promise.all([getPatientById(patientId), getRewardById(rewardId)]);

  if (!patient || !reward) {
    return { type: 'not_found' };
  }

  const currentPoints = patient.points ?? 0;
  const pointsRequired = reward.points_required;
  const stockAvailable = reward.stock_available ?? 0;
  const isActive = reward.is_active ?? true;

  if (!isActive || stockAvailable <= 0) {
    return { type: 'inactive_or_unavailable' };
  }

  const pendingClaim = await getLatestPendingClaimByPatientId(patientId);

  if (pendingClaim) {
    const claimTickets = await mapClaimRowsToTickets([pendingClaim]);

    return {
      type: 'pending_claim_exists',
      data: {
        currentPoints,
        claim: claimTickets[0],
      },
    };
  }

  if (currentPoints < pointsRequired) {
    return {
      type: 'insufficient_points',
      data: {
        currentPoints,
        pointsRequired,
      },
    };
  }

  const remainingPoints = currentPoints - pointsRequired;
  const updatedStock = Math.max(0, stockAvailable - 1);
  const updatedTotalRedeemed = (reward.total_redeemed ?? 0) + 1;

  const rollbackPatientPoints = async () => {
    const { error } = await supabase
      .from('Patient')
      .update({ points: currentPoints })
      .eq('patient_id', patientId);

    if (error) {
      throw new Error(`Failed to rollback patient points: ${error.message}`);
    }
  };

  const rollbackRewardCounters = async () => {
    const { error } = await supabase
      .from('Reward')
      .update({
        stock_available: stockAvailable,
        total_redeemed: reward.total_redeemed ?? 0,
      })
      .eq('reward_id', reward.reward_id);

    if (error) {
      throw new Error(`Failed to rollback reward counters: ${error.message}`);
    }
  };

  const { error: patientUpdateError } = await supabase
    .from('Patient')
    .update({ points: remainingPoints })
    .eq('patient_id', patientId);

  if (patientUpdateError) {
    throw new Error(`Failed to update patient points: ${patientUpdateError.message}`);
  }

  const { error: rewardUpdateError } = await supabase
    .from('Reward')
    .update({
      stock_available: updatedStock,
      total_redeemed: updatedTotalRedeemed,
    })
    .eq('reward_id', reward.reward_id);

  if (rewardUpdateError) {
    await rollbackPatientPoints();
    throw new Error(`Failed to update reward stock: ${rewardUpdateError.message}`);
  }

  const claimCode = createClaimCode();
  const nowIso = new Date().toISOString();

  const { data: inserted, error: transactionError } = await supabase
    .from('RewardTransaction')
    .insert([
      {
        code: claimCode,
        status: 'pending',
        points: pointsRequired,
        patient_id: patientId,
        enav_id: null,
        reward_id: reward.reward_id,
        created_at: nowIso,
      },
    ])
    .select('trans_id, code, status, points, created_at, reward_id')
    .single();

  if (transactionError) {
    await rollbackPatientPoints();
    await rollbackRewardCounters();
    throw new Error(`Failed to create reward claim ticket: ${transactionError.message}`);
  }

  const tickets = await mapClaimRowsToTickets([inserted as RewardClaimRow]);

  return {
    type: 'success',
    data: {
      ticket: tickets[0],
      remainingPoints,
    },
  };
};

export const getPatientRewardClaimsService = async (patientId: string) => {
  const patient = await getPatientById(patientId);

  if (!patient) {
    throw new Error('Patient not found');
  }

  const { data, error } = await supabase
    .from('RewardTransaction')
    .select('trans_id, code, status, points, created_at, reward_id')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    throw new Error(`Failed to retrieve reward claims: ${error.message}`);
  }

  const claims = await mapClaimRowsToTickets((data ?? []) as RewardClaimRow[]);

  return {
    currentPoints: patient.points ?? 0,
    claims,
  };
};

export const cancelRewardClaimByPatientService = async (
  patientId: string,
  code: string,
): Promise<CancelRewardClaimResult> => {
  const claim = await getPendingClaimByCodeAndPatientId(patientId, code.trim());

  if (!claim) {
    const { data, error } = await supabase
      .from('RewardTransaction')
      .select('trans_id, code, status, points, created_at, reward_id, patient_id')
      .eq('patient_id', patientId)
      .eq('code', code.trim())
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to retrieve reward claim: ${error.message}`);
    }

    if (!data) {
      return { type: 'not_found' };
    }

    return { type: 'not_pending' };
  }

  const [patient, reward] = await Promise.all([
    getPatientById(patientId),
    claim.reward_id ? getRewardById(claim.reward_id) : Promise.resolve(null),
  ]);

  if (!patient || !reward) {
    return { type: 'not_found' };
  }

  const currentPoints = patient.points ?? 0;
  const refundedPoints = currentPoints + claim.points;
  const refundedStock = (reward.stock_available ?? 0) + 1;
  const refundedRedeemed = Math.max(0, (reward.total_redeemed ?? 0) - 1);

  const rollbackPatientPoints = async () => {
    const { error } = await supabase
      .from('Patient')
      .update({ points: currentPoints })
      .eq('patient_id', patientId);

    if (error) {
      throw new Error(`Failed to rollback patient points: ${error.message}`);
    }
  };

  const rollbackRewardCounters = async () => {
    const { error } = await supabase
      .from('Reward')
      .update({
        stock_available: reward.stock_available ?? 0,
        total_redeemed: reward.total_redeemed ?? 0,
      })
      .eq('reward_id', reward.reward_id);

    if (error) {
      throw new Error(`Failed to rollback reward counters: ${error.message}`);
    }
  };

  const { error: patientUpdateError } = await supabase
    .from('Patient')
    .update({ points: refundedPoints })
    .eq('patient_id', patientId);

  if (patientUpdateError) {
    throw new Error(`Failed to refund patient points: ${patientUpdateError.message}`);
  }

  const { error: rewardUpdateError } = await supabase
    .from('Reward')
    .update({
      stock_available: refundedStock,
      total_redeemed: refundedRedeemed,
    })
    .eq('reward_id', reward.reward_id);

  if (rewardUpdateError) {
    await rollbackPatientPoints();
    throw new Error(`Failed to restore reward stock: ${rewardUpdateError.message}`);
  }

  const { data: updated, error: updateError } = await supabase
    .from('RewardTransaction')
    .update({
      status: 'cancelled',
    })
    .eq('trans_id', claim.trans_id)
    .select('trans_id, code, status, points, created_at, reward_id')
    .single();

  if (updateError) {
    await rollbackPatientPoints();
    await rollbackRewardCounters();
    throw new Error(`Failed to cancel reward claim: ${updateError.message}`);
  }

  const [ticket] = await mapClaimRowsToTickets([updated as RewardClaimRow]);

  return {
    type: 'success',
    data: {
      ticket,
      remainingPoints: refundedPoints,
    },
  };
};
