import { supabase } from '../supabase';

export type Reward = {
  id: string;
  title: string;
  description: string | null;
  cost: number;
  stock: number | null;
  house_id: string | null;
  is_active: boolean;
  created_at: string;
  youth_houses?: { name: string } | null;
};

export type Redemption = {
  id: string;
  reward_id: string | null;
  reward_title: string;
  user_id: string;
  house_id: string;
  cost: number;
  code: string;
  status: 'pending' | 'delivered' | 'cancelled';
  created_at: string;
  delivered_at: string | null;
  youth_houses?: { name: string } | null;
};

export type RewardInput = {
  title: string;
  description: string | null;
  cost: number;
  stock: number | null;
  is_active: boolean;
  house_id: string | null;
};

/** Gəncin xərcləyə biləcəyi balans (qazanılan − xərclənən). */
export async function fetchMyBalance(): Promise<number> {
  const { data, error } = await supabase.rpc('user_balance');
  if (error) throw error;
  return (data as number) ?? 0;
}

/** Gəncə görünən aktiv hədiyyələr (ümumi + öz mərkəzinin hədiyyələri). */
export async function fetchAvailableRewards(): Promise<Reward[]> {
  const { data, error } = await supabase
    .from('rewards')
    .select('*, youth_houses(name)')
    .eq('is_active', true)
    .order('cost', { ascending: true });
  if (error) throw error;
  return (data as Reward[]) ?? [];
}

export async function fetchMyRedemptions(): Promise<Redemption[]> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return [];
  const { data, error } = await supabase
    .from('reward_redemptions')
    .select('*, youth_houses(name)')
    .eq('user_id', uid)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data as Redemption[]) ?? [];
}

export async function redeemReward(rewardId: string) {
  const { data, error } = await supabase.rpc('redeem_reward', { p_reward_id: rewardId });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return row as { id: string; code: string; reward_title: string; cost: number; house_name: string | null };
}

export async function cancelRedemption(id: string) {
  const { error } = await supabase.rpc('cancel_redemption', { p_id: id });
  if (error) throw error;
}

export async function lookupRedemption(houseId: string, code: string) {
  const { data, error } = await supabase.rpc('lookup_redemption', { p_house_id: houseId, p_code: code });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return (row ?? null) as {
    id: string;
    reward_title: string;
    cost: number;
    user_name: string | null;
    created_at: string;
  } | null;
}

export async function deliverRedemption(id: string) {
  const { error } = await supabase.rpc('deliver_redemption', { p_id: id });
  if (error) throw error;
}

/** Admin: houseId=null → ümumi hədiyyələr; mərkəz: öz hədiyyələri. */
export async function fetchManagedRewards(houseId: string | null): Promise<Reward[]> {
  let q = supabase.from('rewards').select('*').order('created_at', { ascending: false });
  q = houseId ? q.eq('house_id', houseId) : q.is('house_id', null);
  const { data, error } = await q;
  if (error) throw error;
  return (data as Reward[]) ?? [];
}

export async function saveReward(id: string | null, input: RewardInput) {
  if (id) {
    const { error } = await supabase
      .from('rewards')
      .update({
        title: input.title,
        description: input.description,
        cost: input.cost,
        stock: input.stock,
        is_active: input.is_active,
      })
      .eq('id', id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('rewards').insert(input);
    if (error) throw error;
  }
}

export async function deleteReward(id: string) {
  const { error } = await supabase.from('rewards').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchHouseRedemptions(houseId: string): Promise<Redemption[]> {
  const { data, error } = await supabase
    .from('reward_redemptions')
    .select('*')
    .eq('house_id', houseId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data as Redemption[]) ?? [];
}

export async function fetchAllRedemptions(): Promise<Redemption[]> {
  const { data, error } = await supabase
    .from('reward_redemptions')
    .select('*, youth_houses(name)')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data as Redemption[]) ?? [];
}

export const STATUS_LABEL: Record<Redemption['status'], string> = {
  pending: 'Gözləyir',
  delivered: 'Təhvil verilib',
  cancelled: 'Ləğv edilib',
};
