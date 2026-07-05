import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Clear cached role/teacher data whenever the auth session changes so a
// previous user's cache never leaks into the next session.
export function useAuthCacheInvalidation() {
  const queryClient = useQueryClient();
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      queryClient.invalidateQueries({ queryKey: ['userRole'] });
      queryClient.invalidateQueries({ queryKey: ['teacherRecord'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    });
    return () => sub.subscription.unsubscribe();
  }, [queryClient]);
}

export function useUserRole() {
  return useQuery({
    queryKey: ['userRole'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();
      // No role assigned = no access. Admin must assign one via user_roles.
      return (data?.role as string) || 'unassigned';
    },
    staleTime: 60_000,
  });
}

export function useTeacherRecord() {
  return useQuery({
    queryKey: ['teacherRecord'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase
        .from('teachers')
        .select('id, name')
        .eq('email', user.email!)
        .maybeSingle();
      return data;
    },
    staleTime: 60_000,
  });
}
