'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Users,
  DollarSign,
  Activity,
  UserCheck,
  Loader2,
} from 'lucide-react';
import { getAdminStats, type AdminStats, type AdminUser, type Transaction } from '@/lib/api/admin';

export default function AdminDashboardClient() {
  const t = useTranslations('admin');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getAdminStats();
      setStats(data);
    } catch (err) {
      setError(t('error'));
      console.error('Failed to fetch admin stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-destructive">{error}</p>
        <button
          onClick={fetchStats}
          className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors"
        >
          {t('confirm')}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Users className="h-6 w-6" />}
          label={t('totalUsers')}
          value={formatNumber(stats?.total_users || 0)}
          color="amber"
        />
        <StatCard
          icon={<DollarSign className="h-6 w-6" />}
          label={t('totalRevenue')}
          value={formatNumber(stats?.total_revenue || 0)}
          suffix={t('tokens')}
          color="green"
        />
        <StatCard
          icon={<Activity className="h-6 w-6" />}
          label={t('todayRequests')}
          value={formatNumber(stats?.total_requests || 0)}
          color="blue"
        />
        <StatCard
          icon={<UserCheck className="h-6 w-6" />}
          label={t('activeUsers')}
          value={formatNumber(stats?.active_users_today || 0)}
          color="purple"
        />
      </div>

      {/* Recent Activity Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Users */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Users className="h-5 w-5 text-amber-500" />
            {t('recentUsers')}
          </h3>
          {stats?.recent_users && stats.recent_users.length > 0 ? (
            <div className="space-y-3">
              {stats.recent_users.map((user: AdminUser) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                      <span className="text-amber-500 font-medium text-sm">
                        {user.display_name?.substring(0, 2).toUpperCase() || 'U'}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-sm">{user.display_name || user.email}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="inline-block px-2 py-0.5 text-xs rounded-full bg-amber-500/10 text-amber-500">
                      {user.role}
                    </span>
                    <p className="text-xs text-muted-foreground mt-1">{formatDate(user.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">{t('noUsers')}</p>
          )}
        </div>

        {/* Recent Transactions */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Activity className="h-5 w-5 text-amber-500" />
            {t('recentTransactions')}
          </h3>
          {stats?.recent_transactions && stats.recent_transactions.length > 0 ? (
            <div className="space-y-3">
              {stats.recent_transactions.map((tx: Transaction) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      tx.amount >= 0 ? 'bg-green-500/20' : 'bg-red-500/20'
                    }`}>
                      <DollarSign className={`h-5 w-5 ${
                        tx.amount >= 0 ? 'text-green-500' : 'text-red-500'
                      }`} />
                    </div>
                    <div>
                      <p className="font-medium text-sm capitalize">{tx.type.replace('_', ' ')}</p>
                      <p className="text-xs text-muted-foreground truncate max-w-[150px]">
                        {tx.description || '-'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-medium text-sm ${
                      tx.amount >= 0 ? 'text-green-500' : 'text-red-500'
                    }`}>
                      {tx.amount >= 0 ? '+' : ''}{formatNumber(tx.amount)}
                    </p>
                    <p className="text-xs text-muted-foreground">{formatDate(tx.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">{t('noData')}</p>
          )}
        </div>
      </div>
    </div>
  );
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  suffix?: string;
  color: 'amber' | 'green' | 'blue' | 'purple';
}

function StatCard({ icon, label, value, suffix, color }: StatCardProps) {
  const colorClasses = {
    amber: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    green: 'bg-green-500/10 text-green-500 border-green-500/20',
    blue: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    purple: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  };

  const iconColorClasses = {
    amber: 'bg-amber-500/20 text-amber-500',
    green: 'bg-green-500/20 text-green-500',
    blue: 'bg-blue-500/20 text-blue-500',
    purple: 'bg-purple-500/20 text-purple-500',
  };

  return (
    <div className={`rounded-xl border bg-card p-6 ${colorClasses[color].split(' ')[2]}`}>
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${iconColorClasses[color]}`}>
          {icon}
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold">
            {value}
            {suffix && <span className="text-sm font-normal text-muted-foreground ml-1">{suffix}</span>}
          </p>
        </div>
      </div>
    </div>
  );
}
