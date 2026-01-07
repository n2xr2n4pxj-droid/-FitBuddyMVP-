import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { apiClient } from "./api-client";

// ========== 統一使用 Axios 的 Query Function ==========
type UnauthorizedBehavior = "returnNull" | "throw";

/**
 * 創建一個使用 apiClient (Axios) 的 Query Function
 * 所有 React Query hooks 應該使用這個函數來確保統一的錯誤處理和 token 刷新
 */
export const createQueryFn = <T>(options?: {
  on401?: UnauthorizedBehavior;
}): QueryFunction<T> => {
  const unauthorizedBehavior = options?.on401 || "throw";
  
  return async ({ queryKey }) => {
    // Query key 格式: ['/api/meals'] 或 ['/api/meals', '2026-01-05']
    const url = queryKey.join("/") as string;
    
    try {
      const response = await apiClient.get<T>(url);
      return response.data;
    } catch (error: any) {
      // 處理 401 錯誤
      if (error.response?.status === 401) {
        if (unauthorizedBehavior === "returnNull") {
          return null as T;
        }
        // 否則拋出錯誤（會觸發 React Query 的錯誤處理）
      }
      throw error;
    }
  };
};

/**
 * 統一的 API Request 函數（使用 Axios）
 * 用於 mutations 和直接 API 調用
 */
export async function apiRequest<T = any>(
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  url: string,
  data?: unknown
): Promise<T> {
  try {
    let response;
    switch (method) {
      case "GET":
        response = await apiClient.get<T>(url);
        break;
      case "POST":
        response = await apiClient.post<T>(url, data);
        break;
      case "PUT":
        response = await apiClient.put<T>(url, data);
        break;
      case "PATCH":
        response = await apiClient.patch<T>(url, data);
        break;
      case "DELETE":
        response = await apiClient.delete<T>(url);
        break;
    }
    return response.data;
  } catch (error) {
    throw error;
  }
}

// ========== React Query Client 配置 ==========
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 使用統一的 queryFn（通過 createQueryFn）
      // 注意：這裡不設置默認 queryFn，讓每個 hook 明確指定
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 分鐘（數據在 5 分鐘內被認為是新鮮的）
      retry: 1, // 失敗時重試 1 次
      retryDelay: 1000, // 重試延遲 1 秒
    },
    mutations: {
      retry: false, // Mutations 不重試
    },
  },
});
