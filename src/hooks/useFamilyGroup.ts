import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAppStore } from '@/stores/appStore';
import type { FamilyGroup } from '@/types/finance';

const familyGroupsKey = (userId: string) => ['family_groups', userId] as const;

export function useFamilyGroup() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { currentFamilyGroupId, setCurrentFamilyGroupId } = useAppStore();

  const query = useQuery({
    queryKey: familyGroupsKey(user?.id || ''),
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase.from('family_groups').select('*');
      return (data as FamilyGroup[]) || [];
    },
  });

  const familyGroups = query.data ?? [];

  // Auto-select first group when none chosen
  useEffect(() => {
    if (!currentFamilyGroupId && familyGroups.length > 0) {
      setCurrentFamilyGroupId(familyGroups[0].id);
    }
  }, [currentFamilyGroupId, familyGroups, setCurrentFamilyGroupId]);

  const invalidate = () => qc.invalidateQueries({ queryKey: familyGroupsKey(user?.id || '') });

  const createGroup = async (name: string) => {
    if (!user) return null;
    const { data, error } = await supabase.rpc('create_family_group', { _name: name });
    if (error) throw error;

    const groupId = data as string;
    setCurrentFamilyGroupId(groupId);
    await invalidate();
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
    await invalidate();
    return group as FamilyGroup;
  };

  return {
    familyGroups,
    currentFamilyGroupId,
    setCurrentFamilyGroupId,
    loading: !!user && query.isLoading,
    createGroup,
    joinGroup,
  };
}
