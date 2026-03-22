'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Activity, Zap, Clock, TrendingUp } from 'lucide-react';

// Mock data for charts
const requestData7Days = [
  { date: 'Mon', requests: 1200, tokens: 45000 },
  { date: 'Tue', requests: 1800, tokens: 62000 },
  { date: 'Wed', requests: 1400, tokens: 51000 },
  { date: 'Thu', requests: 2200, tokens: 78000 },
  { date: 'Fri', requests: 1900, tokens: 68000 },
  { date: 'Sat', requests: 800, tokens: 29000 },
  { date: 'Sun', requests: 600, tokens: 22000 },
];

const requestData30Days = [
  { date: 'Week 1', requests: 8200, tokens: 295000 },
  { date: 'Week 2', requests: 9400, tokens: 338000 },
  { date: 'Week 3', requests: 7800, tokens: 281000 },
  { date: 'Week 4', requests: 10200, tokens: 367000 },
];

const requestData90Days = [
  { date: 'Jan', requests: 32000, tokens: 1150000 },
  { date: 'Feb', requests: 38000, tokens: 1368000 },
  { date: 'Mar', requests: 42000, tokens: 1512000 },
];

const modelUsage = [
  { model: 'GPT-4o', tokens: 450000, color: '#10a37f' },
  { model: 'Claude 3.5', tokens: 280000, color: '#d4a574' },
  { model: 'Gemini Pro', tokens: 180000, color: '#4285f4' },
  { model: 'Llama 3', tokens: 120000, color: '#6366f1' },
  { model: 'Others', tokens: 70000, color: '#94a3b8' },
];

const providerData = [
  { name: 'OpenAI', value: 45, color: '#10a37f' },
  { name: 'Anthropic', value: 25, color: '#d4a574' },
  { name: 'Google', value: 18, color: '#4285f4' },
  { name: 'Meta', value: 12, color: '#6366f1' },
];

type TimeRange = '7d' | '30d' | '90d';

interface SummaryCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  change?: string;
}

function SummaryCard({ title, value, icon, change }: SummaryCardProps) {
  return (
    <div className="bg-card rounded-lg border border-border p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
          {change && (
            <p className="text-xs text-green-500 flex items-center gap-1 mt-1">
              <TrendingUp className="h-3 w-3" />
              {change}
            </p>
          )}
        </div>
        <div className="p-2 rounded-lg bg-muted">{icon}</div>
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const t = useTranslations('dashboard');
  const [timeRange, setTimeRange] = useState<TimeRange>('7d');

  const getRequestData = () => {
    switch (timeRange) {
      case '7d':
        return requestData7Days;
      case '30d':
        return requestData30Days;
      case '90d':
        return requestData90Days;
      default:
        return requestData7Days;
    }
  };

  const getTimeRangeLabel = () => {
    switch (timeRange) {
      case '7d':
        return t('analyticsPage.last7Days');
      case '30d':
        return t('analyticsPage.last30Days');
      case '90d':
        return t('analyticsPage.last90Days');
      default:
        return t('analyticsPage.last7Days');
    }
  };

  // Calculate totals from current data
  const currentData = getRequestData();
  const totalRequests = currentData.reduce((sum, item) => sum + item.requests, 0);
  const totalTokens = currentData.reduce((sum, item) => sum + item.tokens, 0);
  const avgResponseTime = 245; // Mock average response time in ms

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(2)}M`;
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toLocaleString();
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold">{t('analyticsPage.title')}</h1>
        <p className="text-muted-foreground mt-1">{t('analyticsPage.subtitle')}</p>
      </div>

      {/* Time Range Selector */}
      <div className="flex gap-2">
        {(['7d', '30d', '90d'] as TimeRange[]).map((range) => (
          <button
            key={range}
            onClick={() => setTimeRange(range)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              timeRange === range
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-accent'
            }`}
          >
            {range === '7d'
              ? t('analyticsPage.last7Days')
              : range === '30d'
              ? t('analyticsPage.last30Days')
              : t('analyticsPage.last90Days')}
          </button>
        ))}
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          title={t('analyticsPage.requests')}
          value={formatNumber(totalRequests)}
          icon={<Activity className="h-5 w-5 text-blue-500" />}
          change="+12.5%"
        />
        <SummaryCard
          title={t('analyticsPage.tokens')}
          value={formatNumber(totalTokens)}
          icon={<Zap className="h-5 w-5 text-yellow-500" />}
          change="+8.3%"
        />
        <SummaryCard
          title={t('analyticsPage.responseTime')}
          value={`${avgResponseTime} ${t('analyticsPage.ms')}`}
          icon={<Clock className="h-5 w-5 text-green-500" />}
          change="-5.2%"
        />
        <SummaryCard
          title={t('stats.modelsAccessed')}
          value="5"
          icon={<TrendingUp className="h-5 w-5 text-purple-500" />}
        />
      </div>

      {/* Charts Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Request Volume Chart */}
        <div className="bg-card rounded-lg border border-border p-6">
          <h3 className="text-lg font-semibold mb-4">{t('analyticsPage.requestVolume')}</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={currentData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  className="text-muted-foreground"
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  className="text-muted-foreground"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="requests"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={false}
                  name={t('analyticsPage.requests')}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Token Usage by Model Chart */}
        <div className="bg-card rounded-lg border border-border p-6">
          <h3 className="text-lg font-semibold mb-4">{t('analyticsPage.tokenUsage')}</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={modelUsage} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value: number) => formatNumber(value)}
                />
                <YAxis
                  type="category"
                  dataKey="model"
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  width={80}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number) => [formatNumber(value), t('analyticsPage.tokens')]}
                />
                <Bar dataKey="tokens" radius={[0, 4, 4, 0]}>
                  {modelUsage.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Provider Distribution Pie Chart */}
        <div className="bg-card rounded-lg border border-border p-6">
          <h3 className="text-lg font-semibold mb-4">{t('analyticsPage.providerDistribution')}</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={providerData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, value }: { name: string; value: number }) => `${name}: ${value}%`}
                  labelLine={false}
                >
                  {providerData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number) => [`${value}%`, 'Usage']}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Token Trend Chart */}
        <div className="bg-card rounded-lg border border-border p-6">
          <h3 className="text-lg font-semibold mb-4">{t('analyticsPage.tokens')} Trend</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={currentData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value: number) => formatNumber(value)}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number) => [formatNumber(value), t('analyticsPage.tokens')]}
                />
                <Line
                  type="monotone"
                  dataKey="tokens"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={false}
                  name={t('analyticsPage.tokens')}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
