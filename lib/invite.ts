import { supabase } from './supabase';

export function getInviteLink(token: string): string {
  return `dwella://invite/${token}`;
}

export async function getInviteDetails(token: string) {
  const { data, error } = await supabase
    .from('tenants')
    .select('*, properties(*)')
    .eq('invite_token', token)
    .eq('invite_status', 'pending')
    .single();

  if (error || !data) return null;
  return data;
}

export async function acceptInvite(token: string, userId: string): Promise<{ success: boolean; error?: string }> {
  const { data: tenant, error: fetchError } = await supabase
    .from('tenants')
    .select('id, invite_status')
    .eq('invite_token', token)
    .single();

  if (fetchError || !tenant) {
    return { success: false, error: 'Invite not found or already used.' };
  }

  if (tenant.invite_status !== 'pending') {
    return { success: false, error: 'This invite has already been accepted or has expired.' };
  }

  const { error: updateError } = await supabase
    .from('tenants')
    .update({ user_id: userId, invite_status: 'accepted' })
    .eq('id', tenant.id);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  return { success: true };
}
