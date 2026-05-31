/**
 * 日期工具函數
 * 用於處理邀請過期相關的日期計算
 */

/**
 * 計算距離過期還有多少天
 * @param expiresAt 過期時間字符串 (ISO 格式)
 * @returns 正數表示還剩多少天，負數表示已過期多少天
 */
export function getDaysUntilExpiry(expiresAt: string): number {
  try {
    const expiryDate = new Date(expiresAt);
    const now = new Date();
    
    // 設置為當天的開始時間（00:00:00）以便準確計算天數
    const expiryStart = new Date(expiryDate.getFullYear(), expiryDate.getMonth(), expiryDate.getDate());
    const nowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // 計算天數差
    const diffTime = expiryStart.getTime() - nowStart.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
  } catch (error) {
    console.error('Error calculating days until expiry:', error);
    return 0;
  }
}

/**
 * 計算過期後已經過了多少天
 * @param expiresAt 過期時間字符串 (ISO 格式)
 * @returns 正數表示已過期多少天，0 或負數表示未過期
 */
export function getDaysSinceExpiry(expiresAt: string): number {
  try {
    const expiryDate = new Date(expiresAt);
    const now = new Date();
    
    // 設置為當天的開始時間（00:00:00）以便準確計算天數
    const expiryStart = new Date(expiryDate.getFullYear(), expiryDate.getMonth(), expiryDate.getDate());
    const nowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // 計算天數差
    const diffTime = nowStart.getTime() - expiryStart.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    // 如果未過期，返回 0
    return diffDays > 0 ? diffDays : 0;
  } catch (error) {
    console.error('Error calculating days since expiry:', error);
    return 0;
  }
}

/**
 * 檢查邀請是否已過期
 * @param expiresAt 過期時間字符串 (ISO 格式)
 * @returns true 表示已過期，false 表示未過期
 */
export function isExpired(expiresAt: string): boolean {
  try {
    const expiryDate = new Date(expiresAt);
    const now = new Date();
    
    // 設置為當天的開始時間（00:00:00）以便準確比較
    const expiryStart = new Date(expiryDate.getFullYear(), expiryDate.getMonth(), expiryDate.getDate());
    const nowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    return nowStart.getTime() > expiryStart.getTime();
  } catch (error) {
    console.error('Error checking if expired:', error);
    return false;
  }
}

/**
 * 檢查邀請是否即將過期
 * @param expiresAt 過期時間字符串 (ISO 格式)
 * @param days 默認 7 天，表示在多少天內過期視為"即將過期"
 * @returns true 表示即將過期（1-7天內），false 表示不是
 */
export function isExpiringSoon(expiresAt: string, days: number = 7): boolean {
  try {
    const daysUntil = getDaysUntilExpiry(expiresAt);
    // 即將過期：還剩 1 到 days 天
    return daysUntil > 0 && daysUntil <= days;
  } catch (error) {
    console.error('Error checking if expiring soon:', error);
    return false;
  }
}

