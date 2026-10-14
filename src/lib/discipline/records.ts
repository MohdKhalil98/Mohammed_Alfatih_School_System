import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Incident, IncidentAction, Referral, Summons } from './types';

// تحميل سجلات الانضباط كاملة (حجم مدرسة واحدة) للوحة والتقارير والسجل
export function useRecords() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [actions, setActions] = useState<IncidentAction[]>([]);
  const [summons, setSummons] = useState<Summons[]>([]);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    const [i, a, s, r] = await Promise.all([
      supabase.from('incidents').select('*').order('incident_date', { ascending: false }).order('incident_time', { ascending: false }),
      supabase.from('incident_actions').select('*').order('action_date', { ascending: false }),
      supabase.from('guardian_summons').select('*').order('created_on', { ascending: false }),
      supabase.from('committee_referrals').select('*').order('referred_on', { ascending: false }),
    ]);
    const err = [i, a, s, r].find((x) => x.error)?.error;
    setError(err ? err.message : null);
    setIncidents((i.data ?? []) as Incident[]);
    setActions((a.data ?? []) as IncidentAction[]);
    setSummons((s.data ?? []) as Summons[]);
    setReferrals((r.data ?? []) as Referral[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { incidents, actions, summons, referrals, loading, error, reload };
}
