import { useState, useCallback, useEffect } from 'react';
import { InvitationTemplate } from '@/types/invitations';
import { invitationService } from '@/services/invitationService';
import { useToast } from '@/hooks/use-toast';
import { normalizeApiError } from '@/lib/api-client';
import type { AppApiError } from '@/lib/api-error';

export const useInvitationTemplates = () => {
  const [templates, setTemplates] = useState<InvitationTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<AppApiError | null>(null);
  const { toast } = useToast();

  // 獲取模板列表
  const getTemplates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await invitationService.getInvitationTemplates();
      setTemplates(data);
    } catch (err) {
      const normalized = normalizeApiError(err);
      setError(normalized);
      throw normalized;
    } finally {
      setLoading(false);
    }
  }, []);

  // 創建模板
  const createTemplate = useCallback(
    async (name: string, message: string) => {
      try {
        setError(null);
        const newTemplate = await invitationService.createInvitationTemplate(name, message);
        setTemplates((prev) => [newTemplate, ...prev]);
        toast({
          title: '成功',
          description: '模板已創建',
        });
        return newTemplate;
      } catch (err) {
        const normalized = normalizeApiError(err);
        setError(normalized);
        toast({
          title: '錯誤',
          description: normalized.message,
          variant: 'destructive',
        });
        throw normalized;
      }
    },
    [toast]
  );

  // 更新模板
  const updateTemplate = useCallback(
    async (templateId: string, updates: { name?: string; message?: string }) => {
      try {
        setError(null);
        const updated = await invitationService.updateInvitationTemplate(templateId, updates);
        setTemplates((prev) =>
          prev.map((t) => (t.id === templateId ? updated : t))
        );
        toast({
          title: '成功',
          description: '模板已更新',
        });
        return updated;
      } catch (err) {
        const normalized = normalizeApiError(err);
        setError(normalized);
        toast({
          title: '錯誤',
          description: normalized.message,
          variant: 'destructive',
        });
        throw normalized;
      }
    },
    [toast]
  );

  // 刪除模板
  const deleteTemplate = useCallback(
    async (templateId: string) => {
      try {
        setError(null);
        await invitationService.deleteInvitationTemplate(templateId);
        setTemplates((prev) => prev.filter((t) => t.id !== templateId));
        toast({
          title: '成功',
          description: '模板已刪除',
        });
      } catch (err) {
        const normalized = normalizeApiError(err);
        setError(normalized);
        toast({
          title: '錯誤',
          description: normalized.message,
          variant: 'destructive',
        });
        throw normalized;
      }
    },
    [toast]
  );

  // 初始化時載入
  useEffect(() => {
    getTemplates();
  }, [getTemplates]);

  return {
    templates,
    loading,
    error: error?.message ?? null,
    getTemplates,
    createTemplate,
    updateTemplate,
    deleteTemplate,
  };
};

