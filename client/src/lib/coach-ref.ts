const PENDING_COACH_REF_KEY = 'fitbuddy_pending_coach_ref';

export function savePendingCoachRef(coachRef: string | null | undefined): void {
  const value = (coachRef ?? '').trim();
  if (!value) return;
  localStorage.setItem(PENDING_COACH_REF_KEY, value);
}

export function getPendingCoachRef(): string | null {
  const value = localStorage.getItem(PENDING_COACH_REF_KEY);
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed || null;
}

export function clearPendingCoachRef(): void {
  localStorage.removeItem(PENDING_COACH_REF_KEY);
}

