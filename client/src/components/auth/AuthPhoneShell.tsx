import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type AuthPhoneShellProps = {
  children: ReactNode;
  /** 加在內層主內容 wrapper（z-10）上，例如 `min-h-0` 已由預設提供 */
  className?: string;
};

/**
 * 未登入頁與 [App.tsx](App.tsx) 已登入分支一致的雙層佈局：
 * 桌面置中、max-w-md 手機框、光暈鎖在內層 overflow-hidden 內。
 */
export default function AuthPhoneShell({ children, className }: AuthPhoneShellProps) {
  return (
    <div className="flex min-h-[100dvh] w-full justify-center bg-neutral-950 md:bg-neutral-900">
      <div className="relative flex min-h-[100dvh] w-full max-w-md flex-col overflow-hidden bg-neutral-950 shadow-2xl md:border-x md:border-neutral-800">
        <div
          className="pointer-events-none absolute inset-0 overflow-hidden"
          aria-hidden
        >
          <div className="absolute -top-32 -left-32 h-[min(50vw,28rem)] w-[min(50vw,28rem)] rounded-full bg-blue-600/10 blur-[120px]" />
          <div className="absolute -bottom-40 -right-32 h-[min(55vw,32rem)] w-[min(55vw,32rem)] rounded-full bg-blue-600/10 blur-[120px]" />
        </div>
        <div
          className={cn(
            "relative z-10 flex min-h-0 flex-1 flex-col",
            className,
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
