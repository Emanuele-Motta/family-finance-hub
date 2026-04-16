import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAppStore } from '@/stores/appStore';
import type { FamilyGroup } from '@/types/finance';

export function useFamilyGroup() {
  const { user } = useAuth();
  const { currentFamilyGroupId, setCurrentFamilyGroupId } = useAppStore();
  const [familyGroups, setFamilyGroups] = useState<FamilyGroup[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchGroups = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from('family_groups')
      .select('*');
    if (data && data.length > 0) {
      setFamilyGroups(data as FamilyGroup[]);
      if (!currentFamilyGroupId) {
        setCurrentFamilyGroupId(data[0].id);
      }
    }
    setLoading(false);
  }, [user, currentFamilyGroupId, setCurrentFamilyGroupId]);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  const createGroup = async (name: string) => {
    if (!user) return null;
    const { data, error } = await supabase.rpc('create_family_group', { _name: name });
    if (error) throw error;
    
    const groupId = data as string;
    setCurrentFamilyGroupId(groupId);
    await fetchGroups();
    return { id: groupId, name } as FamilyGroup;
  };

  const joinGroup = async (inviteCode: string) => {
    if (!user) return null;
    const { data: group } = await supabase
      .from('family_groups')
      .select('*')
      .eq('invite_code', inviteCode)
      .single();
    if (!group) throw new Error('Codice invito non valido');
    
    await supabase.from('family_members').insert({
      user_id: user.id,
      family_group_id: group.id,
      role: 'member',
    });
    
    setCurrentFamilyGroupId(group.id);
    await fetchGroups();
    return group as FamilyGroup;
  };

  return { familyGroups, currentFamilyGroupId, setCurrentFamilyGroupId, loading, createGroup, joinGroup };
}
