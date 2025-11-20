// src/lib/queryClient.ts
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: (failureCount: number, err: any) =>
        err?.response?.status === 401 ? false : failureCount < 2,
    },
    mutations: {
      retry: 0,
    },
  },
});
