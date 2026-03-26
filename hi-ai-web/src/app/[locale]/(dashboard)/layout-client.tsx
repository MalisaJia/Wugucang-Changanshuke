'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useParams, usePathname } from 'next/navigation';
import { Link } from '@/lib/i18n/navigation';
import { AuthGuard } from '@/components/auth/auth-guard';
import { useAuthStore } from '@/lib/stores/auth-store';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { LocaleSwitcher } from '@/components/layout/locale-switcher';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import {
  LayoutDashboard,
  Key,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronRight,
  Wallet,
  MessageSquare,
  Users,
} from 'lucide-react';

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = useTranslations('dashboard');
  const params = useParams();
  const pathname = usePathname();
  const locale = (params.locale as string) || 'en';
  const { user, logout } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const navItems: NavItem[] = [
    {
      href: '/dashboard',
      label: t('overview'),
      icon: <LayoutDashboard className="h-5 w-5" />,
    },
    {
      href: '/dashboard/chat',
      label: t('chat'),
      icon: <MessageSquare className="h-5 w-5" />,
    },
    {
      href: '/dashboard/api-keys',
      label: t('apiKeys'),
      icon: <Key className="h-5 w-5" />,
    },
    {
      href: '/dashboard/billing',
      label: t('billing'),
      icon: <Wallet className="h-5 w-5" />,
    },
    {
      href: '/dashboard/team',
      label: t('team'),
      icon: <Users className="h-5 w-5" />,
    },
    {
      href: '/dashboard/analytics',
      label: t('analytics'),
      icon: <BarChart3 className="h-5 w-5" />,
    },
    {
      href: '/dashboard/settings',
      label: t('settings'),
      icon: <Settings className="h-5 w-5" />,
    },
  ];

  // Check if a nav item is active
  const isActive = (href: string) => {
    const normalizedPathname = pathname.replace(`/${locale}`, '') || '/dashboard';
    if (href === '/dashboard') {
      return normalizedPathname === '/dashboard' || normalizedPathname === '';
    }
    return normalizedPathname.startsWith(href);
  };

  // Get current page title for breadcrumb
  const getCurrentPageTitle = () => {
    const normalizedPathname = pathname.replace(`/${locale}`, '') || '/dashboard';
    const item = navItems.find((item) => isActive(item.href));
    return item?.label || t('overview');
  };

  // Get user initials for avatar
  const getUserInitials = () => {
    if (!user?.display_name) return 'U';
    const names = user.display_name.split(' ');
    if (names.length >= 2) {
      return `${names[0][0]}${names[1][0]}`.toUpperCase();
    }
    return user.display_name.substring(0, 2).toUpperCase();
  };

  const handleLogout = () => {
    logout();
  };

  return (
    <AuthGuard locale={locale}>
      <div className="min-h-screen bg-background">
        {/* Mobile Sidebar Overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={`
            fixed top-0 left-0 z-50 h-full w-64 bg-card border-r border-border
            transform transition-transform duration-200 ease-in-out
            lg:translate-x-0
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          `}
        >
          <div className="flex flex-col h-full">
            {/* Logo */}
            <div className="flex items-center justify-between h-16 px-4 border-b border-border">
              <Link href="/" className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                  <span className="text-primary-foreground font-bold text-sm">W</span>
                </div>
                <span className="font-bold text-lg">WuguHub</span>
              </Link>
              <button
                className="lg:hidden p-2 hover:bg-accent rounded-md"
                onClick={() => setSidebarOpen(false)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
              {navItems.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={`
                      flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                      transition-colors
                      ${
                        active
                          ? 'bg-primary/10 text-primary border-l-2 border-primary ml-[-2px]'
                          : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                      }
                    `}
                  >
                    {item.icon}
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            {/* User section & Logout */}
            <div className="p-3 border-t border-border">
              {mounted && user && (
                <div className="flex items-center gap-3 px-3 py-2 mb-2">
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                    <span className="text-primary-foreground text-sm font-medium">
                      {getUserInitials()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{user.display_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                  </div>
                </div>
              )}
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              >
                <LogOut className="h-5 w-5" />
                {t('logout')}
              </button>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <div className="lg:pl-64">
          {/* Top bar */}
          <header className="sticky top-0 z-30 h-16 bg-background/95 backdrop-blur border-b border-border">
            <div className="flex items-center justify-between h-full px-4 lg:px-6">
              <div className="flex items-center gap-4">
                {/* Mobile menu button */}
                <button
                  className="lg:hidden p-2 -ml-2 hover:bg-accent rounded-md"
                  onClick={() => setSidebarOpen(true)}
                >
                  <Menu className="h-5 w-5" />
                </button>

                {/* Breadcrumb */}
                <nav className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">{t('title')}</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{getCurrentPageTitle()}</span>
                </nav>
              </div>

              {/* Right actions */}
              <div className="flex items-center gap-2">
                <LocaleSwitcher />
                <ThemeToggle />
              </div>
            </div>
          </header>

          {/* Page content */}
          <main className="p-4 lg:p-6">
            <ErrorBoundary>{children}</ErrorBoundary>
          </main>
        </div>
      </div>
    </AuthGuard>
  );
}
