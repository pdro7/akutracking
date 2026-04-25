import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

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
      return (data?.role as string) || 'staff';
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
