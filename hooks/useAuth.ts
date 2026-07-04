"use client";

import { useEffect, useCallback, useState } from "react";
import { setAuthTokenGetter } from "@/lib/api";

/**
 * Unified auth hook.
 * When Clerk is configured, the ClerkProvider handles auth transparently.
 * This hook provides a token getter that checks localStorage as a fallback
 * for development without Clerk.
 */
export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const getToken = useCallback(async (): Promise<string | null> => {
    // In development without Clerk, use localStorage IAM token
    if (typeof window !== "undefined") {
      return localStorage.getItem("iam_token");
    }
    return null;
  }, []);

  useEffect(() => {
    setAuthTokenGetter(getToken);
    getToken().then((token) => setIsAuthenticated(!!token));
  }, [getToken]);

  return { isAuthenticated, getToken };
}
