import { useState, useCallback, useEffect } from 'react';
import { InvitationTemplate } from '@/types/invitations';
import { invitationService } from '@/services/invitationService';
import { useToast } from '@/hooks/use-toast';

export const useInvitationTemplates = () => {
  const [templates, setTemplates] = useState<InvitationTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // 獲取模板列表
  const getTemplates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await invitationService.getInvitationTemplates();
      setTemplates(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '獲取模板失敗';
      setError(errorMessage);
      throw err;
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
        const errorMessage = err instanceof Error ? err.message : '創建模板失敗';
        setError(errorMessage);
        toast({
          title: '錯誤',
          description: errorMessage,
          variant: 'destructive',
        });
        throw err;
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
        const errorMessage = err instanceof Error ? err.message : '更新模板失敗';
        setError(errorMessage);
        toast({
          title: '錯誤',
          description: errorMessage,
          variant: 'destructive',
        });
        throw err;
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
        const errorMessage = err instanceof Error ? err.message : '刪除模板失敗';
        setError(errorMessage);
        toast({
          title: '錯誤',
          description: errorMessage,
          variant: 'destructive',
        });
        throw err;
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
    error,
    getTemplates,
    createTemplate,
    updateTemplate,
    deleteTemplate,
  };
};

