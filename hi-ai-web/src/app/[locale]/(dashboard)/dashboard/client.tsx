'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/lib/i18n/navigation';
import { useAuthStore } from '@/lib/stores/auth-store';
import { getBalance, type Balance } from '@/lib/api/billing';
import { listKeys, type APIKey } from '@/lib/api/keys';
import { getUsageSummary, type UsageSummary } from '@/lib/api/analytics';
import { getAuditLogs, type AuditLog } from '@/lib/api/audit';
import {
  Activity,
  Key,
  CreditCard,
  Zap,
  Plus,
  FileText,
  BarChart3,
  Server,
  TrendingUp,
  Clock,
  Wallet,
  AlertTriangle,
  MessageSquare,
  LogIn,
  User,
  Settings,
} from 'lucide-react';

// Dashboard data state interface
interface DashboardStats {
  totalRequests: number;
  activeKeys: number;
  currentPlan: string;
  totalConsumed: number;  // 累计消耗（分）
}

// Format relative time (e.g., "2 hours ago")
function formatRelativeTime(dateStr: string, t: ReturnType<typeof useTranslations>): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return t('justNow');
  if (diffMins < 60) return diffMins === 1 ? t('minsAgo', { count: diffMins }) : t('minsAgoPlural', { count: diffMins });
  if (diffHours < 24) return diffHours === 1 ? t('hoursAgo', { count: diffHours }) : t('hoursAgoPlural', { count: diffHours });
  if (diffDays < 7) return diffDays === 1 ? t('daysAgo', { count: diffDays }) : t('daysAgoPlural', { count: diffDays });
  return date.toLocaleDateString();
}

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: string;
  trendLabel?: string;
  iconBgColor: string;
  loading?: boolean;
}

function StatsCard({ title, value, icon, trend, trendLabel, iconBgColor, loading }: StatsCardProps) {
  return (
    <div className="bg-card rounded-lg border border-border p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          {loading ? (
            <div className="h-9 w-24 bg-muted animate-pulse rounded mt-2" />
          ) : (
            <p className="text-3xl font-bold mt-2">{value}</p>
          )}
          {trend && !loading && (
            <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-green-500" />
              <span className="text-green-500">{trend}</span>
              <span>{trendLabel}</span>
            </p>
          )}
        </div>
        <div className={`p-3 rounded-full ${iconBgColor}`}>{icon}</div>
      </div>
    </div>
  );
}

interface QuickActionCardProps {
  title: string;
  icon: React.ReactNode;
  href: string;
}

function QuickActionCard({ title, icon, href }: QuickActionCardProps) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 p-4 bg-card rounded-lg border border-border hover:bg-accent transition-colors"
    >
      <div className="p-2 rounded-lg bg-primary/10 text-primary">{icon}</div>
      <span className="font-medium text-sm">{title}</span>
    </Link>
  );
}

// Format large numbers with commas
function formatNumber(num: number): string {
  return num.toLocaleString();
}

// Format token count (e.g., 1.25M)
function formatTokens(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(2)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toString();
}

// Format currency (cents to yuan)
function formatCurrency(cents: number): string {
  return `¥${(cents / 100).toFixed(2)}`;
}

// Activity display interface
interface ActivityDisplay {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}

// Get activity display based on action type
function getActivityDisplay(activity: AuditLog, t: ReturnType<typeof useTranslations>): ActivityDisplay {
  const action = activity.action || '';
  const resourceType = activity.resource_type || '';
  const resourceId = activity.resource_id || '';
  const detail = resourceType + (resourceId ? `: ${resourceId}` : '');

  switch (action) {
    case 'chat_completion':
      return {
        icon: <MessageSquare className="h-4 w-4 text-blue-500" />,
        title: t('activity.chatCompletion'),
        subtitle: detail,
      };
    case 'api_key_create':
    case 'create':
      if (resourceType === 'api_key' || resourceType.includes('key')) {
        return {
          icon: <Key className="h-4 w-4 text-green-500" />,
          title: t('activity.apiKeyCreate'),
          subtitle: resourceId,
        };
      }
      return {
        icon: <Activity className="h-4 w-4 text-gray-500" />,
        title: action,
        subtitle: detail,
      };
    case 'api_key_revoke':
    case 'revoke':
      return {
        icon: <Key className="h-4 w-4 text-red-500" />,
        title: t('activity.apiKeyRevoke'),
        subtitle: resourceId,
      };
    case 'provider_update':
      return {
        icon: <Settings className="h-4 w-4 text-orange-500" />,
        title: t('activity.providerUpdate'),
        subtitle: resourceId,
      };
    case 'user_login':
    case 'login':
      return {
        icon: <LogIn className="h-4 w-4 text-purple-500" />,
        title: t('activity.userLogin'),
        subtitle: '',
      };
    case 'user_register':
    case 'register':
      return {
        icon: <User className="h-4 w-4 text-indigo-500" />,
        title: t('activity.userRegister'),
        subtitle: '',
      };
    case 'billing_recharge':
    case 'recharge':
      return {
        icon: <CreditCard className="h-4 w-4 text-emerald-500" />,
        title: t('activity.billingRecharge'),
        subtitle: detail,
      };
    case 'profile_update':
      return {
        icon: <User className="h-4 w-4 text-cyan-500" />,
        title: t('activity.profileUpdate'),
        subtitle: '',
      };
    default:
      // Backward compatibility: infer from action field
      if (action === 'post' && (!resourceType || resourceType === 'unknown')) {
        return {
          icon: <MessageSquare className="h-4 w-4 text-blue-500" />,
          title: t('activity.chatCompletion'),
          subtitle: '',
        };
      }
      if (action === 'update' && resourceType?.includes('provider_config')) {
        return {
          icon: <Settings className="h-4 w-4 text-orange-500" />,
          title: t('activity.providerUpdate'),
          subtitle: resourceId || resourceType.replace('provider_config: ', ''),
        };
      }
      if (action === 'update') {
        return {
          icon: <Settings className="h-4 w-4 text-orange-500" />,
          title: t('activity.settingsUpdate'),
          subtitle: detail,
        };
      }
      return {
        icon: <Activity className="h-4 w-4 text-gray-500" />,
        title: action || t('activity.unknownAction'),
        subtitle: detail,
      };
  }
}

// Balance card component
interface BalanceCardProps {
  balance: Balance | null;
  loading: boolean;
  t: ReturnType<typeof useTranslations>;
}

function BalanceCard({ balance, loading, t }: BalanceCardProps) {
  const isLowBalance = balance && balance.amount_balance < 1000;  // 余额小于 ¥10.00

  return (
    <Link href="/dashboard/billing" className="block">
      <div className={`bg-card rounded-lg border p-6 transition-colors hover:bg-accent/50 ${
        isLowBalance ? 'border-yellow-500/50' : 'border-border'
      }`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{t('stats.accountBalance')}</p>
            {loading ? (
              <div className="h-9 w-24 bg-muted animate-pulse rounded mt-2" />
            ) : (
              <p className="text-3xl font-bold mt-2">
                {balance ? formatCurrency(balance.amount_balance) : '—'}
              </p>
            )}
            {isLowBalance && (
              <p className="text-sm text-yellow-500 mt-1 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                {t('stats.lowBalance')}
              </p>
            )}
          </div>
          <div className={`p-3 rounded-full ${isLowBalance ? 'bg-yellow-500/10' : 'bg-green-500/10'}`}>
            <Wallet className={`h-5 w-5 ${isLowBalance ? 'text-yellow-500' : 'text-green-500'}`} />
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function DashboardOverviewPage() {
  const t = useTranslations('dashboard');
  const { user } = useAuthStore();
  const [balance, setBalance] = useState<Balance | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    totalRequests: 0,
    activeKeys: 0,
    currentPlan: 'Free',
    totalConsumed: 0,
  });
  const [statsLoading, setStatsLoading] = useState(true);
  const [recentActivity, setRecentActivity] = useState<AuditLog[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      // Fetch all data in parallel for better performance
      const [balanceResult, keysResult, usageResult, auditResult] = await Promise.allSettled([
        getBalance(),
        listKeys(),
        getUsageSummary(30),
        getAuditLogs(1, 5),
      ]);

      // Process balance
      if (balanceResult.status === 'fulfilled') {
        setBalance(balanceResult.value);
        setStats(prev => ({
          ...prev,
          totalConsumed: balanceResult.value.total_consumed,
        }));
      } else {
        console.error('Failed to fetch balance:', balanceResult.reason);
      }
      setBalanceLoading(false);

      // Process keys
      if (keysResult.status === 'fulfilled') {
        const keys: APIKey[] = keysResult.value;
        const activeCount = keys.filter(k => k.status === 'active').length;
        setStats(prev => ({ ...prev, activeKeys: activeCount }));
      } else {
        console.error('Failed to fetch keys:', keysResult.reason);
      }

      // Process usage summary
      if (usageResult.status === 'fulfilled') {
        const usage: UsageSummary = usageResult.value;
        setStats(prev => ({ ...prev, totalRequests: usage.month_requests }));
      } else {
        console.error('Failed to fetch usage summary:', usageResult.reason);
      }
      setStatsLoading(false);

      // Process audit logs
      if (auditResult.status === 'fulfilled') {
        setRecentActivity(auditResult.value.data || []);
      } else {
        console.error('Failed to fetch audit logs:', auditResult.reason);
      }
      setActivityLoading(false);
    };

    fetchDashboardData();
  }, []);

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div>
        <h1 className="text-2xl font-bold">
          {t('welcome')}, {user?.display_name || t('defaultUser')}!
        </h1>
        <p className="text-muted-foreground mt-1">
          {t('welcomeSubtitle')}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatsCard
          title={t('stats.totalRequests')}
          value={statsLoading ? '—' : formatNumber(stats.totalRequests)}
          icon={<Activity className="h-5 w-5 text-blue-500" />}
          iconBgColor="bg-blue-500/10"
          loading={statsLoading}
        />
        <StatsCard
          title={t('stats.activeKeys')}
          value={statsLoading ? '—' : stats.activeKeys}
          icon={<Key className="h-5 w-5 text-green-500" />}
          iconBgColor="bg-green-500/10"
          loading={statsLoading}
        />
        <StatsCard
          title={t('stats.currentPlan')}
          value={stats.currentPlan}
          icon={<CreditCard className="h-5 w-5 text-purple-500" />}
          iconBgColor="bg-purple-500/10"
        />
        <StatsCard
          title={t('stats.totalConsumed')}
          value={statsLoading ? '—' : formatCurrency(stats.totalConsumed)}
          icon={<Zap className="h-5 w-5 text-yellow-500" />}
          iconBgColor="bg-yellow-500/10"
          loading={statsLoading}
        />
        <BalanceCard balance={balance} loading={balanceLoading} t={t} />
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold mb-4">{t('quickActions.title')}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <QuickActionCard
            title={t('quickActions.createKey')}
            icon={<Plus className="h-5 w-5" />}
            href="/dashboard/api-keys"
          />
          <QuickActionCard
            title={t('quickActions.viewDocs')}
            icon={<FileText className="h-5 w-5" />}
            href="/docs"
          />
          <QuickActionCard
            title={t('quickActions.viewAnalytics')}
            icon={<BarChart3 className="h-5 w-5" />}
            href="/dashboard/analytics"
          />
          <QuickActionCard
            title={t('quickActions.manageProviders')}
            icon={<Server className="h-5 w-5" />}
            href="/dashboard/providers"
          />
        </div>
      </div>

      {/* Recent Activity */}
      <div>
        <h2 className="text-lg font-semibold mb-4">{t('recentActivity.title')}</h2>
        <div className="bg-card rounded-lg border border-border">
          {activityLoading ? (
            <div className="divide-y divide-border">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-muted animate-pulse w-8 h-8" />
                    <div className="space-y-2">
                      <div className="h-4 w-32 bg-muted animate-pulse rounded" />
                      <div className="h-3 w-24 bg-muted animate-pulse rounded" />
                    </div>
                  </div>
                  <div className="h-3 w-16 bg-muted animate-pulse rounded" />
                </div>
              ))}
            </div>
          ) : recentActivity.length > 0 ? (
            <ul className="divide-y divide-border">
              {recentActivity.map((activity) => {
                const display = getActivityDisplay(activity, t);
                return (
                  <li
                    key={activity.id}
                    className="flex items-center justify-between p-4 hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-muted">
                        {display.icon}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{display.title}</p>
                        {display.subtitle && (
                          <p className="text-xs text-muted-foreground">
                            {display.subtitle}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {formatRelativeTime(activity.created_at, t)}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="p-8 text-center text-muted-foreground">
              {t('recentActivity.noActivity')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
