import { useEffect, useMemo, useState } from "react";
import { BellRing } from "lucide-react";
import { api, type ApiError, type NotificationPreferences } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from(Array.from(rawData).map((char) => char.charCodeAt(0)));
}

function extractKeys(subscription: PushSubscription): { auth: string; p256dh: string } | null {
  const authKey = subscription.getKey("auth");
  const p256dhKey = subscription.getKey("p256dh");
  if (!authKey || !p256dhKey) return null;

  const auth = window.btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(authKey))));
  const p256dh = window.btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(p256dhKey))));
  return { auth, p256dh };
}

const SW_READY_MS = 15_000;

async function ensureServiceWorkerForPush(): Promise<ServiceWorkerRegistration> {
  if (!("serviceWorker" in navigator)) {
    throw new Error("此瀏覽器不支援 Service Worker");
  }
  try {
    await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  } catch (e) {
    console.error("[NotificationSettings] Service Worker register failed:", e);
    throw new Error("無法註冊 Service Worker（請使用 HTTPS 或 localhost，並確認 /sw.js 可載入）");
  }

  return await Promise.race([
    navigator.serviceWorker.ready,
    new Promise<ServiceWorkerRegistration>((_, reject) => {
      setTimeout(() => reject(new Error("Service Worker 啟動逾時，請重新整理頁面再試")), SW_READY_MS);
    }),
  ]);
}

function isLikelyIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && (navigator as Navigator & { maxTouchPoints?: number }).maxTouchPoints > 1);
}

function isStandalonePWA(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
}

/** Chromium 在無法連線推播服務（FCM 等）時常拋此訊息，與 VAPID 是否正確無直接關係 */
function describePushServiceUnavailable(): string {
  const bits: string[] = [
    "瀏覽器無法向推播服務註冊（push service not available）。",
  ];
  if (isLikelyIOS()) {
    if (!isStandalonePWA()) {
      bits.push(
        "iPhone／iPad 請用 Safari 開啟本站，點分享→「加入主畫面」，再從主畫面圖示開啟（需 iOS 16.4+）。",
      );
    } else {
      bits.push("若已從主畫面開啟仍失敗，可能是網路阻擋推播服務；可改用手機 Chrome／或電腦版 Chrome 再試。");
    }
  } else {
    bits.push(
      "請用 Chrome／Edge 最新版，網址須為 https 或 localhost；公司網路／防火牆有時會擋住 Google 推播服務。",
    );
  }
  return bits.join("");
}

function pushSetupErrorDescription(error: unknown): string {
  if (error && typeof error === "object" && "statusCode" in error) {
    const ae = error as ApiError;
    if (ae.statusCode === 401) return "請重新登入後再試";
    if (ae.statusCode === 400) return "訂閱資料格式錯誤，請重新整理後再試";
    return `伺服器回應 ${ae.statusCode}`;
  }

  const rawMessage =
    error instanceof DOMException
      ? `${error.name} ${error.message}`
      : error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : "";

  if (/push service not available|registration failed/i.test(rawMessage)) {
    return describePushServiceUnavailable();
  }

  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError") return "通知權限被拒絕";
    if (error.name === "NotSupportedError") {
      return "此環境不支援推播（建議 Chrome／Edge；iOS 請先「加入主畫面」再試）";
    }
    return error.message || error.name;
  }
  if (error instanceof Error) return error.message;
  return "請檢查瀏覽器支援與權限";
}

const DEFAULT_PREF: Omit<NotificationPreferences, "userId"> = {
  workoutRemindersEnabled: true,
  sessionFeedbackEnabled: true,
  planAssignedEnabled: true,
  marketingEnabled: false,
  quietHoursStart: "22:00",
  quietHoursEnd: "08:00",
};

export default function NotificationSettings() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  /** 僅在「同意並繼續」訂閱流程中為 true；勿在 togglePush 設 disabled，否則點擊瞬間會鎖死 Switch */
  const [pushSubscribing, setPushSubscribing] = useState(false);
  const [prefs, setPrefs] = useState(DEFAULT_PREF);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [showPermissionConfirm, setShowPermissionConfirm] = useState(false);
  const [permissionState, setPermissionState] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "default",
  );

  const canSaveQuietTime = useMemo(() => {
    const re = /^([01]\d|2[0-3]):([0-5]\d)$/;
    return re.test(prefs.quietHoursStart) && re.test(prefs.quietHoursEnd);
  }, [prefs.quietHoursStart, prefs.quietHoursEnd]);

  /** 真實已訂閱為 on；尚未訂閱但已點過開關並出現確認框時，視覺上也顯示為 on，避免使用者以為沒反應 */
  const browserPushVisualOn = pushEnabled || showPermissionConfirm;

  /** Chrome 在網站設定改通知後，同一分頁內 Notification.permission 常不會自動更新，需主動同步 */
  useEffect(() => {
    if (typeof Notification === "undefined") return;

    const syncNotificationPermission = () => {
      setPermissionState(Notification.permission);
    };

    syncNotificationPermission();

    const onFocus = () => syncNotificationPermission();
    const onVisibility = () => {
      if (document.visibilityState === "visible") syncNotificationPermission();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    let permCleanup: (() => void) | undefined;
    if (navigator.permissions?.query) {
      void navigator.permissions
        .query({ name: "notifications" as PermissionName })
        .then((status) => {
          syncNotificationPermission();
          const onPermChange = () => syncNotificationPermission();
          status.addEventListener("change", onPermChange);
          permCleanup = () => status.removeEventListener("change", onPermChange);
        })
        .catch(() => {
          /* 部分環境不支援 notifications descriptor */
        });
    }

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      permCleanup?.();
    };
  }, []);

  useEffect(() => {
    const run = async () => {
      try {
        const p = await api.getNotificationPreferences();
        setPrefs({
          workoutRemindersEnabled: p.workoutRemindersEnabled,
          sessionFeedbackEnabled: p.sessionFeedbackEnabled,
          planAssignedEnabled: p.planAssignedEnabled,
          marketingEnabled: p.marketingEnabled,
          quietHoursStart: p.quietHoursStart,
          quietHoursEnd: p.quietHoursEnd,
        });

        if ("serviceWorker" in navigator) {
          const reg =
            (await navigator.serviceWorker.getRegistration()) ??
            (await navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => null));
          if (reg) {
            const sub = await reg.pushManager.getSubscription();
            setPushEnabled(!!sub);
          }
        }
        if (typeof Notification !== "undefined") {
          setPermissionState(Notification.permission);
        }
      } catch (error) {
        toast({
          title: "讀取通知設定失敗",
          description: "請稍後再試",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, [toast]);

  const savePrefs = async () => {
    if (!canSaveQuietTime) return;
    setSaving(true);
    try {
      await api.updateNotificationPreferences(prefs);
      toast({ title: "通知設定已儲存" });
    } catch {
      toast({
        title: "儲存失敗",
        description: "請稍後再試",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const subscribePush = async () => {
    setPushSubscribing(true);
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        throw new Error("Web Push not supported");
      }
      // 使用者可能剛在另一分頁改完網站設定，先讀最新 permission
      let permission = Notification.permission;
      if (permission === "default") {
        permission = await Notification.requestPermission();
      }
      setPermissionState(permission);
      if (permission !== "granted") {
        toast({
          title: permission === "denied" ? "通知仍為封鎖或未同步" : "未授權通知",
          description:
            permission === "denied"
              ? "若已在 Chrome 設為允許，請按下方「重新同步權限」或重新整理頁面。另請確認網址是 localhost 而非 127.0.0.1（兩者權限分開）。"
              : "請在瀏覽器允許通知權限",
          variant: "destructive",
        });
        return;
      }

      const vapidKey = (import.meta.env.VITE_PUSH_VAPID_PUBLIC_KEY as string | undefined)?.trim();
      if (!vapidKey) {
        toast({
          title: "缺少 VAPID 公鑰",
          description: "請設定 VITE_PUSH_VAPID_PUBLIC_KEY",
          variant: "destructive",
        });
        return;
      }

      let applicationServerKey: Uint8Array;
      try {
        applicationServerKey = urlBase64ToUint8Array(vapidKey);
      } catch (e) {
        console.error("[NotificationSettings] Invalid VAPID public key:", e);
        toast({
          title: "VAPID 公鑰格式錯誤",
          description: "請檢查 client/.env.local 的 VITE_PUSH_VAPID_PUBLIC_KEY（須為 web-push 產生的 URL-safe Base64）",
          variant: "destructive",
        });
        return;
      }
      if (applicationServerKey.byteLength !== 65) {
        toast({
          title: "VAPID 公鑰長度異常",
          description: `解碼後應為 65 bytes，目前為 ${applicationServerKey.byteLength}。請重新執行 npx web-push generate-vapid-keys 並更新環境變數。`,
          variant: "destructive",
        });
        return;
      }

      const reg = await ensureServiceWorkerForPush();
      const newSub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });
      const keys = extractKeys(newSub);
      if (!keys) throw new Error("Failed to extract push keys");

      await api.savePushSubscription({
        endpoint: newSub.endpoint,
        auth: keys.auth,
        p256dh: keys.p256dh,
        userAgent: navigator.userAgent,
      });
      setPushEnabled(true);
      toast({ title: "推播通知已啟用" });
    } catch (error) {
      console.error("[NotificationSettings] subscribePush failed:", error);
      toast({
        title: "推播設定失敗",
        description: pushSetupErrorDescription(error),
        variant: "destructive",
      });
    } finally {
      setPushSubscribing(false);
      setShowPermissionConfirm(false);
    }
  };

  const togglePush = async () => {
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        throw new Error("此瀏覽器不支援 Web Push（請使用 Chrome / Edge / Safari 16.4+）");
      }

      const reg = await navigator.serviceWorker.getRegistration();
      const existing = reg ? await reg.pushManager.getSubscription() : null;

      if (existing) {
        await api.deletePushSubscription(existing.endpoint);
        await existing.unsubscribe();
        setPushEnabled(false);
        toast({ title: "已關閉推播通知" });
        if (typeof Notification !== "undefined") {
          setPermissionState(Notification.permission);
        }
        return;
      }
      setShowPermissionConfirm(true);
    } catch (error) {
      console.error("[NotificationSettings] togglePush failed:", error);
      toast({
        title: "推播設定失敗",
        description: pushSetupErrorDescription(error),
        variant: "destructive",
      });
    }
  };

  const sendTest = async () => {
    try {
      await api.sendTestPush();
      toast({ title: "已送出測試推播" });
    } catch {
      toast({
        title: "測試推播失敗",
        description: "請先啟用推播並稍後再試",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return <div className="px-4 py-6 text-slate-400">載入通知設定中...</div>;
  }

  return (
    <div className="px-4 py-4 text-slate-100">
      <div className="mb-4 flex items-center gap-2">
        <BellRing className="h-5 w-5 text-blue-400" />
        <h2 className="text-lg font-semibold">通知與提醒</h2>
      </div>

      <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-950 p-4">
        {permissionState === "denied" ? (
          <div className="space-y-2 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-200">
            <p>
              瀏覽器目前仍回報「通知已封鎖」。請在 Chrome 網站設定將本站設為「允許」後，按下方「重新同步權限」或
              <strong className="font-semibold">重新整理頁面（F5）</strong>
              ，再啟用推播。
            </p>
            <p className="text-[11px] text-red-200/80">
              提示：<code className="rounded bg-red-950/80 px-1">localhost</code> 與{" "}
              <code className="rounded bg-red-950/80 px-1">127.0.0.1</code>{" "}
              在 Chrome 視為不同網站，請確認你改的是目前網址列那一個。
            </p>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="w-full border-red-400/30 bg-red-950/50 text-red-100 hover:bg-red-950"
              onClick={() => {
                if (typeof Notification === "undefined") return;
                setPermissionState(Notification.permission);
                toast({
                  title:
                    Notification.permission === "granted"
                      ? "已偵測為允許通知"
                      : "仍為封鎖或未授權",
                  description:
                    Notification.permission === "granted"
                      ? "可繼續開啟瀏覽器推播。"
                      : "請確認網站設定為「允許」後再按一次，或重新整理頁面。",
                  variant: Notification.permission === "granted" ? "default" : "destructive",
                });
              }}
            >
              重新同步權限
            </Button>
          </div>
        ) : null}
        <button
          type="button"
          className={cn(
            "flex w-full items-center justify-between rounded-xl py-2 text-left outline-none ring-offset-background transition-opacity focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            pushSubscribing && "pointer-events-none opacity-50",
          )}
          onClick={() => void togglePush()}
          disabled={pushSubscribing}
          aria-pressed={browserPushVisualOn}
          aria-label={
            pushEnabled
              ? "關閉瀏覽器推播"
              : showPermissionConfirm
                ? "瀏覽器推播啟用流程進行中，請在下方完成確認"
                : "開啟瀏覽器推播"
          }
        >
          <span className="text-sm">瀏覽器推播</span>
          <span
            className={cn(
              "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border-2 border-transparent transition-colors",
              browserPushVisualOn ? "bg-primary" : "bg-input",
            )}
            aria-hidden
          >
            <span
              className={cn(
                "pointer-events-none block h-6 w-6 rounded-full bg-background shadow-md ring-0 transition-transform",
                browserPushVisualOn ? "translate-x-[1.35rem]" : "translate-x-0.5",
              )}
            />
          </span>
        </button>
        {showPermissionConfirm && !pushEnabled ? (
          <p className="text-xs text-slate-400">
            已為你開啟下方步驟；請點「同意並繼續」以允許瀏覽器通知，完成後開關會保持開啟。
          </p>
        ) : null}
        <div className="flex items-center justify-between">
          <span className="text-sm">訓練提醒</span>
          <Switch
            checked={prefs.workoutRemindersEnabled}
            onCheckedChange={(v) => setPrefs((s) => ({ ...s, workoutRemindersEnabled: v }))}
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm">教練點評</span>
          <Switch
            checked={prefs.sessionFeedbackEnabled}
            onCheckedChange={(v) => setPrefs((s) => ({ ...s, sessionFeedbackEnabled: v }))}
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm">新計畫指派</span>
          <Switch
            checked={prefs.planAssignedEnabled}
            onCheckedChange={(v) => setPrefs((s) => ({ ...s, planAssignedEnabled: v }))}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="mb-1 text-xs text-slate-400">靜音開始（HKT）</p>
            <Input
              value={prefs.quietHoursStart}
              onChange={(e) => setPrefs((s) => ({ ...s, quietHoursStart: e.target.value }))}
              placeholder="22:00"
            />
          </div>
          <div>
            <p className="mb-1 text-xs text-slate-400">靜音結束（HKT）</p>
            <Input
              value={prefs.quietHoursEnd}
              onChange={(e) => setPrefs((s) => ({ ...s, quietHoursEnd: e.target.value }))}
              placeholder="08:00"
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void savePrefs()} disabled={saving || !canSaveQuietTime}>
            儲存設定
          </Button>
          <Button variant="secondary" onClick={() => void sendTest()}>
            測試推播
          </Button>
        </div>
        {showPermissionConfirm ? (
          <div className="rounded-lg border border-blue-500/40 bg-blue-500/10 p-3 text-xs text-blue-100">
            <p className="mb-2">是否接收教練點評與課表提醒？確認後會彈出瀏覽器通知授權視窗。</p>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => void subscribePush()} disabled={pushSubscribing}>
                同意並繼續
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowPermissionConfirm(false)}
                disabled={pushSubscribing}
              >
                暫不啟用
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

