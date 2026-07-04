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

  const refreshAccounts = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getAccounts();
      setAccounts(data);
      if (data.length > 0 && !selectedAccountId) {
        setSelectedAccountId(data[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch accounts");
    } finally {
      setLoading(false);
    }
  }, [selectedAccountId]);

  useEffect(() => {
    refreshAccounts();
  }, [refreshAccounts]);

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
        loading,
        error,
        selectAccount,
        addAccount,
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
