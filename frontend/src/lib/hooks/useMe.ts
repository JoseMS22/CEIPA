// src/lib/hooks/useMe.ts
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: async () => (await api.get("/api/v1/auth/me")).data,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}
