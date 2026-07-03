import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type {
  SopTemplate,
  SopItem,
  DailySop,
  SopItemCheck,
  SopTaskComment,
  AdHocTask,
} from '@/types/database';

export function useSopTemplates() {
  return useQuery({
    queryKey: ['sopTemplates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sop_templates')
        .select('*')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data as SopTemplate[];
    },
  });
}

export function useSopTemplate(id: string) {
  return useQuery({
    queryKey: ['sopTemplate', id],
    queryFn: async () => {
      const [templateResult, itemsResult] = await Promise.all([
        supabase.from('sop_templates').select('*').eq('id', id).single(),
        supabase
          .from('sop_items')
          .select('*')
          .eq('sop_template_id', id)
          .order('sort_order'),
      ]);
      if (templateResult.error) throw templateResult.error;
      if (itemsResult.error) throw itemsResult.error;
      return {
        template: templateResult.data as SopTemplate,
        items: itemsResult.data as SopItem[],
      };
    },
    enabled: !!id,
  });
}

export function useSaveSopTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      name,
      description,
      items,
    }: {
      id?: string;
      name: string;
      description?: string;
      items: Array<{
        title: string;
        description?: string;
        item_type?: string;
        media?: unknown[];
        equipment?: string[];
        sort_order: number;
      }>;
    }) => {
      let templateId = id;

      if (id) {
        const { error: updateErr } = await supabase
          .from('sop_templates')
          .update({ name, description })
          .eq('id', id);
        if (updateErr) throw updateErr;

        const { error: deleteErr } = await supabase
          .from('sop_items')
          .delete()
          .eq('sop_template_id', id);
        if (deleteErr) throw deleteErr;
      } else {
        const { data, error } = await supabase
          .from('sop_templates')
          .insert({ name, description })
          .select('id')
          .single();
        if (error) throw error;
        templateId = data.id;
      }

      for (const item of items) {
        if (!item.title?.trim()) continue;
        const { error } = await supabase.from('sop_items').insert({
          sop_template_id: templateId,
          sort_order: item.sort_order,
          title: item.title.trim(),
          description: item.description?.trim() || null,
          item_type: item.item_type || 'task',
          media: item.media || [],
          equipment: item.equipment || [],
        });
        if (error) throw error;
      }

      return templateId!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sopTemplates'] });
      queryClient.invalidateQueries({ queryKey: ['sopTemplate'] });
    },
  });
}

export function useDeleteSopTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('sop_templates')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sopTemplates'] });
    },
  });
}

export function useTodayDailySop() {
  return useQuery({
    queryKey: ['todayDailySop'],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from('daily_sops')
        .select('*, sop_templates(name)')
        .eq('date', today)
        .order('completed_at', { ascending: true, nullsFirst: true })
        .limit(1);
      if (error) throw error;
      const row = data?.[0] ?? null;
      return row as (DailySop & { sop_templates: { name: string } | null }) | null;
    },
  });
}

export function useCreateDailySop() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      sopTemplateId,
      createdBy,
    }: {
      sopTemplateId: string;
      createdBy: string;
    }) => {
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from('daily_sops')
        .insert({
          date: today,
          sop_template_id: sopTemplateId,
          created_by: createdBy,
        })
        .select('*, sop_templates(name)')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todayDailySop'] });
      queryClient.invalidateQueries({ queryKey: ['sopChecklist'] });
    },
  });
}

export interface SopChecklistItem extends SopItem {
  checked: boolean;
  checked_by: string | null;
  checked_by_name: string | null;
  _adHoc?: boolean;
}

export function useSopChecklist(dailySopId: string) {
  return useQuery({
    queryKey: ['sopChecklist', dailySopId],
    queryFn: async () => {
      const { data: daily } = await supabase
        .from('daily_sops')
        .select('sop_template_id')
        .eq('id', dailySopId)
        .single();
      if (!daily) throw new Error('Daily SOP not found');

      const [itemsResult, adHocResult, checksResult] = await Promise.all([
        supabase
          .from('sop_items')
          .select('*')
          .eq('sop_template_id', daily.sop_template_id)
          .order('sort_order'),
        supabase
          .from('ad_hoc_tasks')
          .select('*')
          .eq('daily_sop_id', dailySopId)
          .order('created_at'),
        supabase
          .from('sop_item_checks')
          .select('sop_item_id, checked_by, checked_at, profiles(first_name, last_name)')
          .eq('daily_sop_id', dailySopId),
      ]);

      const checkMap: Record<string, { checked_by: string; name: string }> = {};
      (checksResult.data ?? []).forEach((c: any) => {
        const name = c.profiles
          ? `${c.profiles.first_name || ''} ${c.profiles.last_name || ''}`.trim()
          : '';
        if (c.sop_item_id) {
          checkMap[c.sop_item_id] = { checked_by: c.checked_by, name };
        }
      });

      const templateItems: SopChecklistItem[] = (itemsResult.data ?? []).map(
        (item: any) => ({
          ...item,
          checked: !!checkMap[item.id],
          checked_by: checkMap[item.id]?.checked_by ?? null,
          checked_by_name: checkMap[item.id]?.name ?? null,
        }),
      );

      const adHocItems: AdHocTask[] = (adHocResult.data ?? []);

      return { templateItems, adHocItems };
    },
    enabled: !!dailySopId,
  });
}

export function useToggleSopCheck() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      dailySopId,
      sopItemId,
      checkedBy,
      checked,
    }: {
      dailySopId: string;
      sopItemId: string;
      checkedBy: string;
      checked: boolean;
    }) => {
      if (checked) {
        const { error } = await supabase.from('sop_item_checks').insert({
          daily_sop_id: dailySopId,
          sop_item_id: sopItemId,
          checked_by: checkedBy,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('sop_item_checks')
          .delete()
          .eq('daily_sop_id', dailySopId)
          .eq('sop_item_id', sopItemId);
        if (error) throw error;
      }
    },
    onSuccess: (_data, { dailySopId }) => {
      queryClient.invalidateQueries({ queryKey: ['sopChecklist', dailySopId] });
      queryClient.invalidateQueries({ queryKey: ['todayDailySop'] });
      queryClient.invalidateQueries({ queryKey: ['completedDailySops'] });
    },
  });
}

export function useCompleteDailySop() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (dailySopId: string) => {
      const { error } = await supabase
        .from('daily_sops')
        .update({ completed_at: new Date().toISOString() })
        .eq('id', dailySopId);
      if (error) throw error;
    },
    onSuccess: (_data, dailySopId) => {
      const completedAt = new Date().toISOString();
      queryClient.setQueryData(['todayDailySop'], (old: any) => {
        if (!old || old.id !== dailySopId) return old;
        return { ...old, completed_at: completedAt };
      });
      queryClient.invalidateQueries({ queryKey: ['todayDailySop'] });
      queryClient.invalidateQueries({ queryKey: ['completedDailySops'] });
    },
  });
}

export function useCompletedDailySops() {
  return useQuery({
    queryKey: ['completedDailySops'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_sops')
        .select('*, sop_templates(name)')
        .not('completed_at', 'is', null)
        .order('date', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useSopTaskComments(dailySopId: string, itemId?: string) {
  return useQuery({
    queryKey: ['sopTaskComments', dailySopId, itemId],
    queryFn: async () => {
      let query = supabase
        .from('sop_task_comments')
        .select('*')
        .eq('daily_sop_id', dailySopId)
        .order('created_at', { ascending: false });

      if (itemId) {
        query = query.eq('sop_item_id', itemId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as SopTaskComment[];
    },
    enabled: !!dailySopId,
  });
}

export function useAddSopComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      sopItemId,
      dailySopId,
      comment,
      authorId,
    }: {
      sopItemId: string;
      dailySopId: string;
      comment: string;
      authorId: string;
    }) => {
      const { data, error } = await supabase
        .from('sop_task_comments')
        .insert({
          sop_item_id: sopItemId,
          daily_sop_id: dailySopId,
          comment,
          author_id: authorId,
        })
        .select()
        .single();
      if (error) throw error;
      return data as SopTaskComment;
    },
    onSuccess: (_data, { dailySopId }) => {
      queryClient.invalidateQueries({ queryKey: ['sopTaskComments', dailySopId] });
    },
  });
}

export function useAdHocTasks(dailySopId: string) {
  return useQuery({
    queryKey: ['adHocTasks', dailySopId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ad_hoc_tasks')
        .select('*')
        .eq('daily_sop_id', dailySopId)
        .order('sort_order');
      if (error) throw error;
      return data as AdHocTask[];
    },
    enabled: !!dailySopId,
  });
}

export function useAddAdHocTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      dailySopId,
      title,
      createdBy,
    }: {
      dailySopId: string;
      title: string;
      createdBy: string;
    }) => {
      const { data, error } = await supabase
        .from('ad_hoc_tasks')
        .insert({
          daily_sop_id: dailySopId,
          title,
          created_by: createdBy,
        })
        .select()
        .single();
      if (error) throw error;
      return data as AdHocTask;
    },
    onSuccess: (_data, { dailySopId }) => {
      queryClient.invalidateQueries({ queryKey: ['adHocTasks', dailySopId] });
      queryClient.invalidateQueries({ queryKey: ['sopChecklist', dailySopId] });
    },
  });
}

export function useToggleAdHocTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      taskId,
      dailySopId,
      completedBy,
    }: {
      taskId: string;
      dailySopId: string;
      completedBy: string;
    }) => {
      const { data: existing } = await supabase
        .from('ad_hoc_tasks')
        .select('completed_by')
        .eq('id', taskId)
        .single();

      if (existing?.completed_by) {
        const { error } = await supabase
          .from('ad_hoc_tasks')
          .update({ completed_by: null, completed_at: null })
          .eq('id', taskId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('ad_hoc_tasks')
          .update({ completed_by: completedBy, completed_at: new Date().toISOString() })
          .eq('id', taskId);
        if (error) throw error;
      }
    },
    onSuccess: (_data, { dailySopId }) => {
      queryClient.invalidateQueries({ queryKey: ['sopChecklist', dailySopId] });
      queryClient.invalidateQueries({ queryKey: ['adHocTasks', dailySopId] });
    },
  });
}
