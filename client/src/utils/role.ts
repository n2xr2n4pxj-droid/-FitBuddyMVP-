export const normalizeRole = (
  role: string | undefined | null
): 'client' | 'coach' | 'admin' | null => {
  if (!role) return null;
  const normalized = role.toLowerCase();
  if (normalized === 'both') {
    return 'coach';
  }
  const validRoles = ['client', 'coach', 'admin'];
  if (validRoles.includes(normalized)) {
    return normalized as 'client' | 'coach' | 'admin';
  }
  console.warn(`Unknown role: ${role}`);
  return null;
};

export const isCoachRole = (role: string | null | undefined): boolean => {
  return role === 'coach';
};

export const isClientRole = (role: string | null | undefined): boolean => {
  return role === 'client';
};

export const isBothRole = (_role: string | null | undefined): boolean => false;
