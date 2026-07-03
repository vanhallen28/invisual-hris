import { supabaseServer } from '@/lib/supabase/server';
import type { MyTask } from '@/lib/types';

// Returns the tasks assigned to the currently signed-in user.
// RLS + the my_tasks_v view guarantee a user only ever gets their OWN tasks,
// so there is no user-id filter to forge here — it is enforced in the database.
export async function getMyTasks(): Promise<MyTask[]> {
  const supabase = await supabaseServer();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('my_tasks_v')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('getMyTasks error:', error.message);
    return [];
  }
  return (data ?? []) as MyTask[];
}
