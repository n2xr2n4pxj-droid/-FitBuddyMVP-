# FitBuddy API 服務層

## 概述

所有 API 服務層都使用 **React Query + Axios** 統一架構。

## 認證服務 (authService.ts)

### 使用方式

#### 1. 使用 React Query Hooks（推薦）

```tsx
import { useLogin, useRegister, useMe } from '@/services/authService';
import { useToast } from '@/hooks/use-toast';

function LoginForm() {
  const { toast } = useToast();
  const loginMutation = useLogin();

  const handleLogin = async (email: string, password: string) => {
    try {
      const result = await loginMutation.mutateAsync({ email, password });
      
      // 處理登入成功
      if (result.user && result.token) {
        toast({
          title: "登入成功",
          description: `歡迎回來，${result.user.firstName}！`,
        });
      }
    } catch (error: any) {
      // 處理錯誤
      if (error.response?.data?.needsVerification) {
        toast({
          title: "郵箱未驗證",
          description: "請先驗證你的郵箱",
          variant: "destructive",
        });
      }
    }
  };

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      handleLogin(email, password);
    }}>
      {/* 表單內容 */}
      <button disabled={loginMutation.isPending}>
        {loginMutation.isPending ? '登入中...' : '登入'}
      </button>
    </form>
  );
}
```

#### 2. 直接使用服務對象

```tsx
import authService from '@/services/authService';

async function handleLogin(email: string, password: string) {
  try {
    const response = await authService.login({ email, password });
    console.log('登入成功:', response.user);
  } catch (error) {
    console.error('登入失敗:', error);
  }
}
```

### 可用的 Hooks

#### `useLogin()`
用戶登入 mutation。

```tsx
const loginMutation = useLogin();

await loginMutation.mutateAsync({
  email: 'user@example.com',
  password: 'password123'
});
```

#### `useRegister()`
用戶註冊 mutation。

```tsx
const registerMutation = useRegister();

await registerMutation.mutateAsync({
  email: 'user@example.com',
  password: 'password123',
  firstName: 'John',
  lastName: 'Doe',
  role: 'client'
});
```

#### `useMe()`
獲取當前用戶信息 query。

```tsx
const { data: user, isLoading, error } = useMe();

if (isLoading) return <div>載入中...</div>;
if (error) return <div>載入失敗</div>;
if (user) return <div>歡迎，{user.firstName}</div>;
```

#### `useVerifyEmail()`
驗證郵箱 mutation。

```tsx
const verifyMutation = useVerifyEmail();

await verifyMutation.mutateAsync(verificationToken);
```

#### `useResendVerification()`
重新發送驗證郵件 mutation。

```tsx
const resendMutation = useResendVerification();

await resendMutation.mutateAsync('user@example.com');
```

### 與現有架構的集成

**與 Zustand Store (`auth.store.ts`) 的關係：**

- `authService.ts` - 提供 API 調用和 React Query hooks
- `auth.store.ts` - 管理認證狀態（用戶信息、token 等）
- 兩者可以同時使用，但建議：
  - 新的組件：直接使用 `authService` hooks
  - 現有組件：繼續使用 `useAuth()` hook（它內部使用 `auth.store.ts`）

**與 API Client (`api-client.ts`) 的關係：**

- `authService.ts` 使用 `apiClient` (Axios) 進行 HTTP 請求
- `apiClient` 提供統一的請求/響應攔截器、token 刷新、錯誤處理等

## 其他服務

### 邀請服務 (invitationService.ts)

邀請相關的 API 調用，使用 fetch API。

```tsx
import { invitationService } from '@/services/invitationService';

await invitationService.sendInvitation('client@example.com');
```

## 最佳實踐

1. **優先使用 React Query Hooks**：獲得自動緩存、重新獲取、錯誤處理等特性
2. **類型安全**：所有服務都提供完整的 TypeScript 類型定義
3. **錯誤處理**：使用 try-catch 和 React Query 的錯誤狀態
4. **統一使用 Axios**：所有 HTTP 請求都通過 `apiClient`，確保統一的攔截器和錯誤處理

## 遷移指南

### 從 `fetch` API 遷移

**之前：**
```tsx
const res = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password })
});
const data = await res.json();
```

**之後：**
```tsx
const loginMutation = useLogin();
await loginMutation.mutateAsync({ email, password });
```

### 從直接使用 `apiClient` 遷移

**之前：**
```tsx
const response = await apiClient.post('/api/auth/login', { email, password });
```

**之後：**
```tsx
const loginMutation = useLogin();
await loginMutation.mutateAsync({ email, password });
```

## 架構圖

```
組件
  ↓
React Query Hooks (authService.ts)
  ↓
API Client (api-client.ts) - Axios
  ↓
後端 API (/api/auth/*)
```
