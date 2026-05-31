export interface StoreUser {
  id: string;
  email: string;
  roles: string[];
  registrationComplete: boolean;
  // 其他必要的欄位（視畫面需求擴充）
  role: string;
  name?: string;
  firstName?: string | null;
  lastName?: string | null;
  avatar?: string | null;
}
