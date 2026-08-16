"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/lib/constants";
import { Shield, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "flex flex-col h-screen bg-white text-slate-900 border-r border-slate-200 transition-all duration-200 sticky top-0 shrink-0 z-30",
        collapsed ? "w-16" : "w-56",
      )}
    >
      {/* Brand Header */}
      <div className="flex items-center justify-between px-4 h-14 border-b border-slate-200">
        <Link href="/dashboard" className="flex items-center gap-2.5 min-w-0">
          <div className="p-1.5 bg-slate-900 text-white rounded-md flex items-center justify-center shrink-0">
            <Shield className="w-4 h-4" />
          </div>
          {!collapsed && (
            <div className="min-w-0 flex items-center gap-1.5">
              <span className="text-sm font-bold tracking-tight text-slate-900">
                CloudGuard
              </span>
              <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                CSPM
              </span>
            </div>
          )}
        </Link>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-2.5 py-2 rounded-md text-sm transition-colors",
                isActive
                  ? "bg-slate-100 text-slate-900 font-semibold"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium",
                collapsed && "justify-center px-2",
              )}
              title={collapsed ? item.label : undefined}
            >
              <Icon className={cn("w-4 h-4 shrink-0", isActive ? "text-slate-900" : "text-slate-500")} />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer / Toggle */}
      <div className="p-2 border-t border-slate-200">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            "flex items-center justify-center w-full py-1.5 rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors text-xs",
            !collapsed && "gap-2 justify-start px-2.5",
          )}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <>
              <ChevronLeft className="w-4 h-4" />
              <span>Collapse sidebar</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
