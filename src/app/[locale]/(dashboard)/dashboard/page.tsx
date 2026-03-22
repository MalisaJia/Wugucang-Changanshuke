'use client';

export const runtime = 'edge';

import { useTranslations } from 'next-intl';
import { Link } from '@/lib/i18n/navigation';
import { useAuthStore } from '@/lib/stores/auth-store';
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
} from 'lucide-react';

// Mock data for demonstration
const mockStats = {
  totalRequests: 12847,
  activeKeys: 3,
  currentPlan: 'Pro',
  tokensUsed: 1250000,
};

const mockRecentActivity = [
  { id: 1, action: 'API Key created', model: 'production-key-v2', time: '2 hours ago' },
  { id: 2, action: 'Model accessed', model: 'gpt-4o', time: '3 hours ago' },
  { id: 3, action: 'Rate limit warning', model: 'claude-3.5-sonnet', time: '5 hours ago' },
  { id: 4, action: 'New model enabled', model: 'gemini-pro', time: '1 day ago' },
];

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: string;
  trendLabel?: string;
  iconBgColor: string;
}

function StatsCard({ title, value, icon, trend, trendLabel, iconBgColor }: StatsCardProps) {
  return (
    <div className="bg-card rounded-lg border border-border p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-3xl font-bold mt-2">{value}</p>
          {trend && (
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

export default function DashboardOverviewPage() {
  const t = useTranslations('dashboard');
  const { user } = useAuthStore();

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div>
        <h1 className="text-2xl font-bold">
          {t('welcome')}, {user?.display_name || 'User'}!
        </h1>
        <p className="text-muted-foreground mt-1">
          Here&apos;s an overview of your API usage and activity.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title={t('stats.totalRequests')}
          value={formatNumber(mockStats.totalRequests)}
          icon={<Activity className="h-5 w-5 text-blue-500" />}
          trend="+12%"
          trendLabel={t('stats.thisMonth')}
          iconBgColor="bg-blue-500/10"
        />
        <StatsCard
          title={t('stats.activeKeys')}
          value={mockStats.activeKeys}
          icon={<Key className="h-5 w-5 text-green-500" />}
          iconBgColor="bg-green-500/10"
        />
        <StatsCard
          title={t('stats.currentPlan')}
          value={mockStats.currentPlan}
          icon={<CreditCard className="h-5 w-5 text-purple-500" />}
          iconBgColor="bg-purple-500/10"
        />
        <StatsCard
          title={t('stats.tokensUsed')}
          value={formatTokens(mockStats.tokensUsed)}
          icon={<Zap className="h-5 w-5 text-yellow-500" />}
          trend="+8%"
          trendLabel={t('stats.thisMonth')}
          iconBgColor="bg-yellow-500/10"
        />
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
            href="/dashboard/settings"
          />
        </div>
      </div>

      {/* Recent Activity */}
      <div>
        <h2 className="text-lg font-semibold mb-4">{t('recentActivity.title')}</h2>
        <div className="bg-card rounded-lg border border-border">
          {mockRecentActivity.length > 0 ? (
            <ul className="divide-y divide-border">
              {mockRecentActivity.map((activity) => (
                <li
                  key={activity.id}
                  className="flex items-center justify-between p-4 hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-muted">
                      <Activity className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{activity.action}</p>
                      <p className="text-xs text-muted-foreground">{activity.model}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {activity.time}
                  </div>
                </li>
              ))}
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
