"use client";
import { QueryClientProvider, HydrationBoundary, type DehydratedState } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { queryClient } from "@/lib/queryClient";
import type { ReactNode } from "react"; // 👈

export default function Providers({
  children,
  dehydratedState,
}: {
  children: ReactNode;               // 👈 usa ReactNode
  dehydratedState?: DehydratedState;
}) {
  return (
    <QueryClientProvider client={queryClient}>
      <HydrationBoundary state={dehydratedState}>
        {children}
      </HydrationBoundary>
      {process.env.NODE_ENV === "development" && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  );
}
