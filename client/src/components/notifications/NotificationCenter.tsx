import { useEffect, useMemo, useState } from "react";
import { Bell } from "lucide-react";
import { api, type NotificationItem } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

interface NotificationCenterProps {
  activeView: "LEARNER" | "TRAINER";
}

export default function NotificationCenter({ activeView }: NotificationCenterProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const hasUnread = unreadCount > 0;

  const bellClass = useMemo(
    () =>
      activeView === "LEARNER"
        ? "bg-blue-50 text-blue-600"
        : "bg-amber-400/10 text-amber-400",
    [activeView],
  );

  const reloadUnread = async () => {
    try {
      const r = await api.getUnreadCount();
      setUnreadCount(r.count);
    } catch {
      // keep silent for badge polling
    }
  };

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const page = await api.getNotifications({ limit: 20 });
      setNotifications(page.notifications);
    } catch {
      toast({
        title: "讀取通知失敗",
        description: "請稍後再試",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reloadUnread();
  }, []);

  useEffect(() => {
    if (!open) return;
    void loadNotifications();
    void reloadUnread();
  }, [open]);

  const openLink = async (item: NotificationItem) => {
    try {
      if (!item.isRead) {
        await api.markNotificationRead(item.id);
        setNotifications((prev) =>
          prev.map((n) => (n.id === item.id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n)),
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
      if (item.linkUrl) {
        window.location.href = item.linkUrl;
      }
    } catch {
      toast({
        title: "通知操作失敗",
        description: "請稍後再試",
        variant: "destructive",
      });
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          className={`relative mr-1 rounded-full p-2 active:scale-95 transition-transform ${bellClass}`}
          title="通知中心"
        >
          <Bell size={18} />
          {hasUnread ? (
            <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" />
          ) : null}
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full max-w-md bg-slate-950 text-slate-100 border-slate-800">
        <SheetHeader>
          <SheetTitle className="text-slate-100">通知中心</SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-3">
          {loading ? <p className="text-sm text-slate-400">載入中...</p> : null}
          {!loading && notifications.length === 0 ? (
            <p className="text-sm text-slate-400">暫時沒有通知</p>
          ) : null}
          {notifications.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => void openLink(item)}
              className={`w-full rounded-xl border p-3 text-left transition-colors ${
                item.isRead
                  ? "border-slate-800 bg-slate-900/40"
                  : "border-blue-500/40 bg-blue-500/10"
              }`}
            >
              <p className="text-sm font-semibold">{item.title}</p>
              <p className="mt-1 text-xs text-slate-300">{item.body}</p>
              <p className="mt-2 text-[11px] text-slate-500">
                {new Date(item.sentAt).toLocaleString("zh-HK")}
              </p>
            </button>
          ))}
        </div>

        <div className="mt-4">
          <Button variant="secondary" onClick={() => void loadNotifications()} className="w-full">
            重新整理
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

