"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/lib/constants";
import { Shield, ChevronLeft, ChevronRight, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "flex flex-col h-screen bg-slate-950 text-slate-100 transition-all duration-300 sticky top-0 border-r border-slate-800/80 shrink-0 z-30",
        collapsed ? "w-16" : "w-64",
      )}
    >
      {/* Brand Header */}
      <div className="flex items-center justify-between px-4 h-16 border-b border-slate-800/80">
        <Link href="/dashboard" className="flex items-center gap-3 min-w-0">
          <div className="p-2 bg-brand-600/20 text-brand-400 rounded-lg border border-brand-500/30 flex items-center justify-center shrink-0">
            <Shield className="w-5 h-5 text-brand-400" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-base font-bold tracking-tight text-white font-mono">
                  CLOUDGUARD
                </span>
                <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-brand-500/20 text-brand-400 border border-brand-500/30">
                  CSPM
                </span>
              </div>
              <span className="text-[11px] text-slate-400 block truncate">Security Platform</span>
            </div>
          )}
        </Link>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 py-5 px-3 space-y-1 overflow-y-auto">
        <div className={cn("px-3 mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400", collapsed && "hidden")}>
          Platform
        </div>
        {NAV_ITEMS.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group relative",
                isActive
                  ? "bg-brand-600 text-white shadow-md shadow-brand-600/20"
                  : "text-slate-300 hover:bg-slate-900 hover:text-white",
                collapsed && "justify-center px-2",
              )}
              title={collapsed ? item.label : undefined}
            >
              <Icon
                className={cn(
                  "w-5 h-5 shrink-0 transition-transform group-hover:scale-110",
                  isActive ? "text-white" : "text-slate-400 group-hover:text-slate-200",
                )}
              />
              {!collapsed && <span className="truncate">{item.label}</span>}
              {isActive && (
                <span className="absolute right-2 w-1.5 h-1.5 rounded-full bg-white hidden md:block" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer / Toggle */}
      <div className="p-3 border-t border-slate-800/80 flex items-center justify-between">
        {!collapsed && (
          <div className="flex items-center gap-2 px-2 text-xs text-slate-400">
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
            <span>Agent v2.4</span>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            "p-2 rounded-lg text-slate-400 hover:bg-slate-900 hover:text-white transition-colors",
            collapsed && "w-full flex justify-center",
          )}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </div>
    </aside>
  );
}
