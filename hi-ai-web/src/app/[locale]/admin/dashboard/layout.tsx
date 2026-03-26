'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useParams, usePathname } from 'next/navigation';
import { Link, useRouter } from '@/lib/i18n/navigation';
import { useAuthStore } from '@/lib/stores/auth-store';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { LocaleSwitcher } from '@/components/layout/locale-switcher';
import {
  LayoutDashboard,
  Users,
  RefreshCw,
  FileText,
  BarChart3,
  Server,
  Settings,
  Shield,
  GitBranch,
  CreditCard,
  Key,
  LogOut,
  Menu,
  X,
  ChevronRight,
  ShieldCheck,
  ArrowLeft,
  Loader2,
  UserCog,
  Cpu,
} from 'lucide-react';

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = useTranslations('admin');
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const locale = (params.locale as string) || 'en';
  const { user, logout, isAuthenticated } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Check authentication and role
    if (!isAuthenticated) {
      router.push('/admin/login');
      return;
    }
    if (user?.role !== 'owner' && user?.role !== 'admin') {
      router.push('/dashboard');
      return;
    }
    setIsReady(true);
  }, [isAuthenticated, user, router]);

  const navItems: NavItem[] = [
    {
      href: '/admin/dashboard',
      label: t('nav.dashboard'),
      icon: <LayoutDashboard className="h-5 w-5" />,
    },
    {
      href: '/admin/dashboard/users',
      label: t('nav.users'),
      icon: <Users className="h-5 w-5" />,
    },
    {
      href: '/admin/dashboard/refunds',
      label: t('nav.refunds'),
      icon: <RefreshCw className="h-5 w-5" />,
    },
    {
      href: '/admin/dashboard/audit',
      label: t('nav.audit'),
      icon: <FileText className="h-5 w-5" />,
    },
    {
      href: '/admin/dashboard/analytics',
      label: t('nav.analytics'),
      icon: <BarChart3 className="h-5 w-5" />,
    },
    {
      href: '/admin/dashboard/team',
      label: t('nav.team'),
      icon: <UserCog className="h-5 w-5" />,
    },
    {
      href: '/admin/dashboard/providers',
      label: t('nav.providers'),
      icon: <Server className="h-5 w-5" />,
    },
    {
      href: '/admin/dashboard/model-management',
      label: t('nav.modelManagement'),
      icon: <Cpu className="h-5 w-5" />,
    },
    {
      href: '/admin/dashboard/settings',
      label: t('nav.settings'),
      icon: <Settings className="h-5 w-5" />,
    },
    {
      href: '/admin/dashboard/security',
      label: t('nav.security'),
      icon: <Shield className="h-5 w-5" />,
    },
    {
      href: '/admin/dashboard/routing',
      label: t('nav.routing'),
      icon: <GitBranch className="h-5 w-5" />,
    },
    {
      href: '/admin/dashboard/payments',
      label: t('nav.payments'),
      icon: <CreditCard className="h-5 w-5" />,
    },
    {
      href: '/admin/dashboard/api-keys',
      label: t('nav.apiKeys'),
      icon: <Key className="h-5 w-5" />,
    },
  ];

  // Check if a nav item is active
  const isActive = (href: string) => {
    const normalizedPathname = pathname.replace(`/${locale}`, '') || '/admin/dashboard';
    if (href === '/admin/dashboard') {
      return normalizedPathname === '/admin/dashboard';
    }
    return normalizedPathname.startsWith(href);
  };

  // Get current page title for breadcrumb
  const getCurrentPageTitle = () => {
    const normalizedPathname = pathname.replace(`/${locale}`, '') || '/admin/dashboard';
    const item = navItems.find((item) => isActive(item.href));
    return item?.label || t('overview');
  };

  // Get user initials for avatar
  const getUserInitials = () => {
    if (!user?.display_name) return 'A';
    const names = user.display_name.split(' ');
    if (names.length >= 2) {
      return `${names[0][0]}${names[1][0]}`.toUpperCase();
    }
    return user.display_name.substring(0, 2).toUpperCase();
  };

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  if (!isReady || !mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
          <p className="text-sm text-muted-foreground">{t('loading')}</p>
        </div>
      </div>
    );
  }

  return (
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
          fixed top-0 left-0 z-50 h-full w-64 bg-zinc-900 dark:bg-zinc-950 border-r border-zinc-800
          transform transition-transform duration-200 ease-in-out
          lg:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-4 border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-lg text-white">{t('adminPanel')}</span>
            </div>
            <button
              className="lg:hidden p-2 hover:bg-zinc-800 rounded-md text-zinc-400"
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
                        ? 'bg-amber-500/20 text-amber-500 border-l-2 border-amber-500 ml-[-2px]'
                        : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                    }
                  `}
                >
                  {item.icon}
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Back to site link */}
          <div className="px-3 py-2">
            <Link
              href="/dashboard"
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
              {t('backToSite')}
            </Link>
          </div>

          {/* User section & Logout */}
          <div className="p-3 border-t border-zinc-800">
            {mounted && user && (
              <div className="flex items-center gap-3 px-3 py-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center">
                  <span className="text-white text-sm font-medium">
                    {getUserInitials()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{user.display_name}</p>
                  <p className="text-xs text-zinc-400 truncate">{user.email}</p>
                </div>
              </div>
            )}
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
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
                <span className="text-amber-500 font-medium">{t('title')}</span>
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
        <main className="p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
