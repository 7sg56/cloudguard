"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useAccountContext } from "@/context/AccountContext";
import { Cloud, ChevronDown, Loader2, ShieldAlert } from "lucide-react";
import { useState, useRef, useEffect } from "react";

export function Topbar() {
  const pathname = usePathname();
  const { accounts, selectedAccount, selectAccount, isScanning } = useAccountContext();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Derive page title from pathname
  const getPageTitle = () => {
    const segment = pathname.split("/").filter(Boolean).pop() || "dashboard";
    return segment.charAt(0).toUpperCase() + segment.slice(1);
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <header className="flex items-center justify-between h-16 px-6 bg-white border-b border-slate-200 shrink-0">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{getPageTitle()}</h1>
      </div>

      <div className="flex items-center gap-3">
        {/* Global Scan Status Indicator */}
        {isScanning && (
          <Link
            href="/scans"
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors animate-pulse"
          >
            <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" />
            <span>Scanning AWS in background...</span>
          </Link>
        )}

        {/* Account Selector */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <Cloud className="w-4 h-4 text-slate-500" />
            <span>{selectedAccount?.name || "Select Account"}</span>
            <ChevronDown className="w-4 h-4 text-slate-400" />
          </button>

          {dropdownOpen && accounts.length > 0 && (
            <div className="absolute right-0 mt-1 w-72 bg-white border border-slate-200 rounded-lg shadow-lg z-50 animate-fade-in">
              <div className="p-2 space-y-0.5">
                {accounts.map((account) => (
                  <button
                    key={account.id}
                    onClick={() => {
                      selectAccount(account.id);
                      setDropdownOpen(false);
                    }}
                    className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-md text-left text-sm transition-colors ${
                      account.id === selectedAccount?.id
                        ? "bg-brand-50 text-brand-700"
                        : "hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    <Cloud className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{account.name}</div>
                      <div className="text-xs text-slate-500 font-mono">
                        {account.account_id}
                      </div>
                    </div>
                    {account.status === "connected" && (
                      <span className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
