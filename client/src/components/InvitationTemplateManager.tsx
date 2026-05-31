import React, { useState } from 'react';
import { useInvitationTemplates } from '@/hooks/useInvitationTemplates';
import { InvitationTemplate } from '@/types/invitations';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Trash2, Edit2, Plus, X } from 'lucide-react';

interface InvitationTemplateManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InvitationTemplateManager: React.FC<InvitationTemplateManagerProps> = ({
  isOpen,
  onClose,
}) => {
  const { templates, loading, createTemplate, updateTemplate, deleteTemplate } = useInvitationTemplates();
  const [editingTemplate, setEditingTemplate] = useState<InvitationTemplate | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', message: '' });
  const [viewingTemplate, setViewingTemplate] = useState<InvitationTemplate | null>(null);

  const handleCreate = async () => {
    try {
      await createTemplate(formData.name, formData.message);
      setFormData({ name: '', message: '' });
      setIsCreateDialogOpen(false);
    } catch (err) {
      // Error handled by hook
    }
  };

  const handleUpdate = async () => {
    if (!editingTemplate) return;
    try {
      await updateTemplate(editingTemplate.id, {
        name: formData.name,
        message: formData.message,
      });
      setEditingTemplate(null);
      setFormData({ name: '', message: '' });
    } catch (err) {
      // Error handled by hook
    }
  };

  const handleDelete = async (templateId: string) => {
    if (window.confirm('確定要刪除這個模板嗎？')) {
      try {
        await deleteTemplate(templateId);
      } catch (err) {
        // Error handled by hook
      }
    }
  };

  const openEditDialog = (template: InvitationTemplate) => {
    setEditingTemplate(template);
    setFormData({ name: template.name, message: template.message });
  };

  const openCreateDialog = () => {
    setFormData({ name: '', message: '' });
    setIsCreateDialogOpen(true);
  };

  const closeEditDialog = () => {
    setEditingTemplate(null);
    setFormData({ name: '', message: '' });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-2xl font-bold">📝 邀請模板管理</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">載入中...</div>
          ) : templates.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">還沒有模板</p>
              <Button onClick={openCreateDialog}>
                <Plus className="h-4 w-4 mr-2" />
                創建第一個模板
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-end mb-4">
                <Button onClick={openCreateDialog}>
                  <Plus className="h-4 w-4 mr-2" />
                  新建模板
                </Button>
              </div>

              <div className="grid gap-4">
                {templates.map((template) => (
                  <Card key={template.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg">{template.name}</CardTitle>
                          <p className="text-sm text-muted-foreground mt-1">
                            創建於 {new Date(template.createdAt).toLocaleDateString('zh-HK')}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setViewingTemplate(template)}
                          >
                            查看
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditDialog(template)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(template.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-gray-600 line-clamp-2">
                        {template.message}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建模板</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="create-name">模板名稱 *</Label>
              <Input
                id="create-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="例如：激勵模板"
                maxLength={50}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {formData.name.length}/50 字符
              </p>
            </div>
            <div>
              <Label htmlFor="create-message">模板內容 *</Label>
              <Textarea
                id="create-message"
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                placeholder="輸入模板內容..."
                rows={6}
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {formData.message.length}/500 字符
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              取消
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!formData.name.trim() || !formData.message.trim()}
            >
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingTemplate} onOpenChange={(open) => !open && closeEditDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>編輯模板</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-name">模板名稱 *</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="例如：激勵模板"
                maxLength={50}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {formData.name.length}/50 字符
              </p>
            </div>
            <div>
              <Label htmlFor="edit-message">模板內容 *</Label>
              <Textarea
                id="edit-message"
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                placeholder="輸入模板內容..."
                rows={6}
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {formData.message.length}/500 字符
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeEditDialog}>
              取消
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={!formData.name.trim() || !formData.message.trim()}
            >
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={!!viewingTemplate} onOpenChange={(open) => !open && setViewingTemplate(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{viewingTemplate?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>模板內容</Label>
              <div className="mt-2 p-4 bg-gray-50 rounded-lg border">
                <p className="text-sm whitespace-pre-wrap">{viewingTemplate?.message}</p>
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              創建於 {viewingTemplate && new Date(viewingTemplate.createdAt).toLocaleString('zh-HK')}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewingTemplate(null)}>
              關閉
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

