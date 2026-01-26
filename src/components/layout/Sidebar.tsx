import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Receipt,
  Repeat,
  Wallet,
  Upload,
  Settings,
  ChevronLeft,
  ChevronRight,
  Search,
  Bell,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/stores/appStore';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Transactions', href: '/transactions', icon: Receipt },
  { name: 'Subscriptions', href: '/subscriptions', icon: Repeat },
  { name: 'Accounts', href: '/accounts', icon: Wallet },
  { name: 'Upload', href: '/upload', icon: Upload },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const location = useLocation();
  const { sidebarCollapsed, toggleSidebar } = useAppStore();

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-300",
        sidebarCollapsed ? "w-16" : "w-60"
      )}
    >
      {/* Logo */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-sidebar-border">
        <div className={cn("flex items-center gap-3", sidebarCollapsed && "justify-center w-full")}>
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-primary-foreground">
              <rect x="3" y="3" width="7" height="7" rx="1.5" fill="currentColor" />
              <rect x="14" y="3" width="7" height="7" rx="1.5" fill="currentColor" />
              <rect x="3" y="14" width="7" height="7" rx="1.5" fill="currentColor" />
              <rect x="14" y="14" width="7" height="7" rx="1.5" fill="currentColor" />
            </svg>
          </div>
          {!sidebarCollapsed && (
            <span className="text-lg font-bold text-foreground">SubTrack</span>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-6 space-y-1.5 overflow-y-auto custom-scrollbar">
        {navigation.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <NavLink
              key={item.name}
              to={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                sidebarCollapsed && "justify-center px-2"
              )}
            >
              <item.icon className={cn("w-5 h-5 shrink-0")} />
              {!sidebarCollapsed && <span>{item.name}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* Collapse Toggle */}
      <div className="p-3 border-t border-sidebar-border">
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleSidebar}
          className={cn(
            "w-full text-muted-foreground hover:text-foreground hover:bg-sidebar-accent",
            sidebarCollapsed ? "justify-center" : "justify-start"
          )}
        >
          {sidebarCollapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <>
              <ChevronLeft className="w-4 h-4 mr-2" />
              <span>Collapse</span>
            </>
          )}
        </Button>
      </div>

      {/* Privacy Badge */}
      <div className={cn(
        "px-3 py-4 border-t border-sidebar-border",
        sidebarCollapsed && "px-2"
      )}>
        <div className={cn(
          "flex items-center gap-2 text-xs text-muted-foreground",
          sidebarCollapsed && "justify-center"
        )}>
          <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
          {!sidebarCollapsed && <span>100% Local • No Cloud</span>}
        </div>
      </div>
    </aside>
  );
}
