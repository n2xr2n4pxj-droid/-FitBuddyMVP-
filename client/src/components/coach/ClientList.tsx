import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface Client {
  id: string;
  clientId: string;
  coachId: string;
  username: string;
  email: string;
  status: 'active' | 'paused' | 'completed';
  startDate: string;
  notes: string | null;
}

interface ClientListProps {
  clients: Client[];
  onClientSelect: (clientId: string) => void;
  onRefresh: () => void;
}

export default function ClientList({ clients, onClientSelect, onRefresh }: ClientListProps) {
  const { toast } = useToast();
  const [addClientOpen, setAddClientOpen] = useState(false);
  const [clientEmail, setClientEmail] = useState('');
  const [adding, setAdding] = useState(false);

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientEmail.trim()) {
      toast({
        title: '錯誤',
        description: '請輸入客戶郵箱',
        variant: 'destructive',
      });
      return;
    }

    setAdding(true);
    try {
      const response = await fetch('/api/coaches/add-client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ clientEmail: clientEmail.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || 'Failed to add client');
      }

      toast({
        title: '成功',
        description: '客戶已添加',
      });

      setClientEmail('');
      setAddClientOpen(false);
      onRefresh();
    } catch (err) {
      toast({
        title: '添加失敗',
        description: err instanceof Error ? err.message : 'Failed to add client',
        variant: 'destructive',
      });
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveClient = async (clientId: string) => {
    if (!confirm('確定要移除這個客戶嗎？')) {
      return;
    }

    try {
      const response = await fetch('/api/coaches/remove-client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ clientId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || 'Failed to remove client');
      }

      toast({
        title: '成功',
        description: '客戶已移除',
      });

      onRefresh();
    } catch (err) {
      toast({
        title: '移除失敗',
        description: err instanceof Error ? err.message : 'Failed to remove client',
        variant: 'destructive',
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      active: 'default',
      paused: 'secondary',
      completed: 'outline',
    };

    const labels: Record<string, string> = {
      active: '活躍',
      paused: '暫停',
      completed: '已完成',
    };

    return (
      <Badge variant={variants[status] || 'outline'}>
        {labels[status] || status}
      </Badge>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold">客戶列表</h2>
        <Dialog open={addClientOpen} onOpenChange={setAddClientOpen}>
          <DialogTrigger asChild>
            <Button>添加客戶</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>添加客戶</DialogTitle>
              <DialogDescription>
                輸入客戶的郵箱地址來添加他們到您的客戶列表
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddClient}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="email">客戶郵箱</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="client@example.com"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                    disabled={adding}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAddClientOpen(false)}
                  disabled={adding}
                >
                  取消
                </Button>
                <Button type="submit" disabled={adding}>
                  {adding ? '添加中...' : '添加'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {clients.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">還沒有客戶，點擊「添加客戶」開始吧！</p>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>用戶名</TableHead>
                <TableHead>郵箱</TableHead>
                <TableHead>狀態</TableHead>
                <TableHead>開始日期</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((client) => (
                <TableRow key={client.id}>
                  <TableCell className="font-medium">{client.username}</TableCell>
                  <TableCell>{client.email}</TableCell>
                  <TableCell>{getStatusBadge(client.status)}</TableCell>
                  <TableCell>
                    {new Date(client.startDate).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onClientSelect(client.clientId)}
                      >
                        查看
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleRemoveClient(client.clientId)}
                      >
                        移除
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

