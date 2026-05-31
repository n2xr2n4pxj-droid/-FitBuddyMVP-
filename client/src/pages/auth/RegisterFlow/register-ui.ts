/**
 * Register Flow 共用 Tailwind class（與 LandingPage / auth Login 一致的 Liquid Glass + 科技藍）
 */

/** 文字輸入、與 Login 對齊 */
export const regInputClass =
  'bg-neutral-950/60 rounded-xl border border-neutral-800 text-white text-lg placeholder:text-neutral-500 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-none transition-all';

/** Primary：下一步 / 完成 */
export const regPrimaryButtonClass =
  'w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 px-8 rounded-xl transition-all shadow-md active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950 disabled:opacity-50 disabled:pointer-events-none';

/** 步驟標題 / 副標題 */
export const regStepTitleClass =
  'text-3xl font-black text-white tracking-tighter mb-3 text-center';
export const regStepSubtitleClass = 'text-base text-neutral-400 mb-10 text-center';
