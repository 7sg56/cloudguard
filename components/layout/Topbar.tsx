"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useAccountContext } from "@/context/AccountContext";
import { Cloud, ChevronDown, Loader2 } from "lucide-react";
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
    <header className="flex items-center justify-between h-14 px-6 bg-white border-b border-slate-200 shrink-0">
      <div>
        <h1 className="text-sm font-semibold text-slate-900">{getPageTitle()}</h1>
      </div>

      <div className="flex items-center gap-3">
        {/* Global Scan Status Indicator */}
        {isScanning && (
          <Link
            href="/scans"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors"
          >
            <Loader2 className="w-3 h-3 animate-spin text-amber-600" />
            <span>Scanning...</span>
          </Link>
        )}

        {/* Account Selector */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors shadow-sm"
          >
            <Cloud className="w-3.5 h-3.5 text-slate-500" />
            <span>{selectedAccount?.name || "Select Account"}</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {dropdownOpen && accounts.length > 0 && (
            <div className="absolute right-0 mt-1 w-64 bg-white border border-slate-200 rounded-md shadow-md z-50 animate-fade-in">
              <div className="p-1 space-y-0.5">
                {accounts.map((account) => (
                  <button
                    key={account.id}
                    onClick={() => {
                      selectAccount(account.id);
                      setDropdownOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded text-left text-xs transition-colors ${
                      account.id === selectedAccount?.id
                        ? "bg-slate-100 text-slate-900 font-semibold"
                        : "hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <div className="truncate">{account.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {account.account_id}
                      </div>
                    </div>
                    {account.status === "connected" && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
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
