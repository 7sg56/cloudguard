"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import type { CloudAccount, ScanResult } from "@/lib/types";
import * as api from "@/lib/api";

interface AccountContextType {
  accounts: CloudAccount[];
  selectedAccountId: string | null;
  selectedAccount: CloudAccount | null;
  scanStatus: Record<string, ScanResult>;
  isScanning: boolean;
  loading: boolean;
  error: string | null;
  selectAccount: (id: string) => void;
  addAccount: (data: {
    account_id: string;
    name: string;
    role_arn: string;
    environment: string;
    regions: string;
  }) => Promise<void>;
  editAccount: (
    id: string,
    data: {
      name?: string;
      role_arn?: string;
      environment?: string;
      regions?: string;
    },
  ) => Promise<void>;
  removeAccount: (id: string) => Promise<void>;
  updateScanStatus: (accountId: string, scan: ScanResult) => void;
  refreshAccounts: () => Promise<void>;
  clearError: () => void;
}

const AccountContext = createContext<AccountContextType | null>(null);

export function AccountProvider({ children }: { children: ReactNode }) {
  const [accounts, setAccounts] = useState<CloudAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [scanStatus, setScanStatus] = useState<Record<string, ScanResult>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId) || null;

  // Global check if any scan is running
  const isScanning = Object.values(scanStatus).some((s) => s?.status === "running");

  const refreshAccounts = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getAccounts();
      setAccounts(data);
      if (data.length > 0) {
        setSelectedAccountId((prev) => {
          if (prev && data.some((a) => a.id === prev)) return prev;
          return data[0].id;
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch accounts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshAccounts();
  }, [refreshAccounts]);

  // Global scan polling: check active running scans every 3 seconds
  useEffect(() => {
    const runningScans = Object.entries(scanStatus).filter(
      ([_, scan]) => scan?.status === "running",
    );
    if (runningScans.length === 0) return;

    const interval = setInterval(async () => {
      for (const [acctKey, scan] of runningScans) {
        try {
          const updated = await api.getScanStatus(scan.id);
          setScanStatus((prev) => ({ ...prev, [acctKey]: updated }));
          if (updated.status === "completed" || updated.status === "failed") {
            refreshAccounts();
          }
        } catch (err) {
          console.error("Global scan poll error:", err);
        }
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [scanStatus, refreshAccounts]);

  const selectAccount = useCallback((id: string) => {
    setSelectedAccountId(id);
  }, []);

  const addAccount = useCallback(
    async (data: {
      account_id: string;
      name: string;
      role_arn: string;
      environment: string;
      regions: string;
    }) => {
      try {
        const newAccount = await api.createAccount(data);
        setAccounts((prev) => [...prev, newAccount]);
        setSelectedAccountId(newAccount.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to add account");
        throw err;
      }
    },
    [],
  );

  const editAccount = useCallback(
    async (
      id: string,
      data: {
        name?: string;
        role_arn?: string;
        environment?: string;
        regions?: string;
      },
    ) => {
      try {
        const updated = await api.updateAccount(id, data);
        setAccounts((prev) => prev.map((a) => (a.id === id ? updated : a)));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update account");
        throw err;
      }
    },
    [],
  );

  const removeAccount = useCallback(
    async (id: string) => {
      try {
        await api.deleteAccount(id);
        setAccounts((prev) => prev.filter((a) => a.id !== id));
        if (selectedAccountId === id) {
          setSelectedAccountId(accounts.length > 1 ? accounts[0].id : null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete account");
        throw err;
      }
    },
    [selectedAccountId, accounts],
  );

  const updateScanStatus = useCallback((accountId: string, scan: ScanResult) => {
    setScanStatus((prev) => ({ ...prev, [accountId]: scan }));
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return (
    <AccountContext.Provider
      value={{
        accounts,
        selectedAccountId,
        selectedAccount,
        scanStatus,
        isScanning,
        loading,
        error,
        selectAccount,
        addAccount,
        editAccount,
        removeAccount,
        updateScanStatus,
        refreshAccounts,
        clearError,
      }}
    >
      {children}
    </AccountContext.Provider>
  );
}

export function useAccountContext() {
  const ctx = useContext(AccountContext);
  if (!ctx) throw new Error("useAccountContext must be used within AccountProvider");
  return ctx;
}
