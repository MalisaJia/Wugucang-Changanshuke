'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { 
  Activity, 
  Zap, 
  Calendar, 
  DollarSign,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  BarChart3
} from 'lucide-react';
import {
  getUsageSummary,
  getUsageLogs,
  type UsageSummary,
  type UsageLog,
  type DailyStats,
  type ModelStats,
} from '@/lib/api/analytics';
import { ApiClientError } from '@/lib/api/client';

type TimeRange = 'today' | '7d' | '30d' | 'month';

// Model colors for pie chart
const MODEL_COLORS = [
  '#10a37f', // OpenAI green
  '#d4a574', // Anthropic tan
  '#4285f4', // Google blue
  '#6366f1', // Indigo
  '#f59e0b', // Amber
  '#ec4899', // Pink
  '#8b5cf6', // Purple
  '#94a3b8', // Slate
];

// Summary Card Component
function SummaryCard({ 
  title, 
  value, 
  icon, 
  subtext 
}: { 
  title: string; 
  value: string | number; 
  icon: React.ReactNode;
  subtext?: string;
}) {
  return (
    <div className="bg-card rounded-lg border border-border p-5">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
          {subtext && (
            <p className="text-xs text-muted-foreground mt-1">{subtext}</p>
          )}
        </div>
        <div className="p-3 rounded-lg bg-muted shrink-0">{icon}</div>
      </div>
    </div>
  );
}

// CSS Bar Chart Component
function BarChart({ 
  data, 
  labelKey, 
  valueKey,
  formatValue,
  formatLabel,
}: { 
  data: Record<string, unknown>[];
  labelKey: string;
  valueKey: string;
  formatValue?: (v: number) => string;
  formatLabel?: (v: string) => string;
}) {
  if (!data || data.length === 0) {
    return (
      <div className="h-[200px] flex items-center justify-center text-muted-foreground">
        <BarChart3 className="h-8 w-8 mr-2 opacity-50" />
        No data available
      </div>
    );
  }

  const maxValue = Math.max(...data.map(d => Number(d[valueKey]) || 0));
  const normalizedMax = maxValue || 1;

  return (
    <div className="flex items-end gap-2 h-[200px] pt-4">
      {data.map((item, index) => {
        const value = Number(item[valueKey]) || 0;
        const height = (value / normalizedMax) * 100;
        const label = String(item[labelKey]);
        const displayLabel = formatLabel ? formatLabel(label) : label;
        const displayValue = formatValue ? formatValue(value) : value.toLocaleString();
        
        return (
          <div 
            key={index} 
            className="flex-1 flex flex-col items-center gap-1 group"
          >
            <div className="relative w-full flex justify-center">
              {/* Tooltip on hover */}
              <div className="absolute -top-8 opacity-0 group-hover:opacity-100 transition-opacity bg-popover border border-border rounded px-2 py-1 text-xs whitespace-nowrap z-10">
                {displayValue}
              </div>
              <div 
                className="w-full max-w-[40px] bg-primary/80 hover:bg-primary rounded-t transition-all duration-300"
                style={{ height: `${Math.max(height, 2)}%` }}
              />
            </div>
            <span className="text-[10px] text-muted-foreground truncate w-full text-center">
              {displayLabel}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// SVG Donut Chart Component
function DonutChart({ 
  data,
  labelKey,
  valueKey,
}: { 
  data: Record<string, unknown>[];
  labelKey: string;
  valueKey: string;
}) {
  if (!data || data.length === 0) {
    return (
      <div className="h-[200px] flex items-center justify-center text-muted-foreground">
        No data available
      </div>
    );
  }

  const total = data.reduce((sum, d) => sum + (Number(d[valueKey]) || 0), 0);
  if (total === 0) {
    return (
      <div className="h-[200px] flex items-center justify-center text-muted-foreground">
        No data available
      </div>
    );
  }

  // Calculate segments
  const segments: { color: string; percentage: number; label: string; value: number; offset: number }[] = [];
  let cumulativeOffset = 0;

  data.forEach((item, index) => {
    const value = Number(item[valueKey]) || 0;
    const percentage = (value / total) * 100;
    segments.push({
      color: MODEL_COLORS[index % MODEL_COLORS.length],
      percentage,
      label: String(item[labelKey]),
      value,
      offset: cumulativeOffset,
    });
    cumulativeOffset += percentage;
  });

  const radius = 70;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="flex items-center gap-4">
      {/* SVG Donut */}
      <div className="relative">
        <svg width="180" height="180" viewBox="0 0 180 180">
          {segments.map((segment, index) => {
            const strokeDasharray = `${(segment.percentage / 100) * circumference} ${circumference}`;
            const strokeDashoffset = -(segment.offset / 100) * circumference;
            
            return (
              <circle
                key={index}
                cx="90"
                cy="90"
                r={radius}
                fill="none"
                stroke={segment.color}
                strokeWidth="20"
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
                transform="rotate(-90 90 90)"
                className="transition-all duration-300"
              />
            );
          })}
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <p className="text-2xl font-bold">{formatNumber(total)}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-col gap-2 flex-1">
        {segments.slice(0, 5).map((segment, index) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <div 
              className="w-3 h-3 rounded-full shrink-0" 
              style={{ backgroundColor: segment.color }}
            />
            <span className="truncate flex-1">{segment.label}</span>
            <span className="text-muted-foreground">{segment.percentage.toFixed(1)}%</span>
          </div>
        ))}
        {segments.length > 5 && (
          <p className="text-xs text-muted-foreground">+{segments.length - 5} more</p>
        )}
      </div>
    </div>
  );
}

// Format number helper
function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(2)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toLocaleString();
}

// Format date helper
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// Format time helper
function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString(undefined, { 
    month: 'short', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Estimate cost (simplified: $0.002 per 1K tokens)
function estimateCost(tokens: number): string {
  const cost = (tokens / 1000) * 0.002;
  return `$${cost.toFixed(2)}`;
}

export default function AnalyticsClient() {
  const t = useTranslations('analytics');
  const [timeRange, setTimeRange] = useState<TimeRange>('7d');
  const [summary, setSummary] = useState<UsageSummary | null>(null);
  const [usageLogs, setUsageLogs] = useState<UsageLog[]>([]);
  const [logsPage, setLogsPage] = useState(1);
  const [logsTotal, setLogsTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getDaysForRange = (range: TimeRange): number => {
    switch (range) {
      case 'today': return 1;
      case '7d': return 7;
      case '30d': return 30;
      case 'month': return 30;
      default: return 7;
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const days = getDaysForRange(timeRange);
      const [summaryData, logsData] = await Promise.all([
        getUsageSummary(days),
        getUsageLogs(logsPage, 10),
      ]);
      
      setSummary(summaryData);
      setUsageLogs(logsData.logs || []);
      setLogsTotal(logsData.total || 0);
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : 'Failed to load analytics data';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [timeRange, logsPage]);

  // Prepare chart data
  const dailyChartData = summary?.daily_stats
    ? [...summary.daily_stats].reverse().slice(-7)
    : [];

  const modelChartData = summary?.model_stats || [];

  // Check if there's any data
  const hasData = summary && (summary.month_tokens_total > 0 || summary.today_tokens_total > 0);

  if (loading && !summary) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-muted-foreground">{t('loading')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <p className="text-destructive">{error}</p>
        <button
          onClick={fetchData}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <RefreshCw className="h-4 w-4" />
          {t('retry')}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground mt-1">{t('subtitle')}</p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border hover:bg-accent disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          {t('retry')}
        </button>
      </div>

      {/* Time Range Selector */}
      <div className="flex flex-wrap gap-2">
        {(['today', '7d', '30d', 'month'] as TimeRange[]).map((range) => (
          <button
            key={range}
            onClick={() => setTimeRange(range)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              timeRange === range
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-accent'
            }`}
          >
            {range === 'today'
              ? t('today')
              : range === '7d'
              ? t('last7Days')
              : range === '30d'
              ? t('last30Days')
              : t('thisMonth')}
          </button>
        ))}
      </div>

      {!hasData ? (
        /* Empty State */
        <div className="flex flex-col items-center justify-center py-16 px-4 bg-card rounded-lg border border-border">
          <BarChart3 className="h-16 w-16 text-muted-foreground/30 mb-4" />
          <p className="text-lg text-muted-foreground text-center">{t('noData')}</p>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard
              title={t('todayTokens')}
              value={formatNumber(summary?.today_tokens_total || 0)}
              icon={<Zap className="h-5 w-5 text-yellow-500" />}
              subtext={`${t('requests')}: ${summary?.today_requests || 0}`}
            />
            <SummaryCard
              title={t('todayRequests')}
              value={formatNumber(summary?.today_requests || 0)}
              icon={<Activity className="h-5 w-5 text-blue-500" />}
            />
            <SummaryCard
              title={t('monthTokens')}
              value={formatNumber(summary?.month_tokens_total || 0)}
              icon={<Calendar className="h-5 w-5 text-green-500" />}
              subtext={`${t('requests')}: ${summary?.month_requests || 0}`}
            />
            <SummaryCard
              title={t('monthCost')}
              value={estimateCost(summary?.month_tokens_total || 0)}
              icon={<DollarSign className="h-5 w-5 text-purple-500" />}
              subtext="Based on average pricing"
            />
          </div>

          {/* Charts Row */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Usage Trend Chart */}
            <div className="bg-card rounded-lg border border-border p-6">
              <h3 className="text-lg font-semibold mb-4">{t('usageTrend')} ({t('last7Days')})</h3>
              <BarChart
                data={dailyChartData as unknown as Record<string, unknown>[]}
                labelKey="date"
                valueKey="tokens_total"
                formatValue={formatNumber}
                formatLabel={formatDate}
              />
            </div>

            {/* Model Distribution Chart */}
            <div className="bg-card rounded-lg border border-border p-6">
              <h3 className="text-lg font-semibold mb-4">{t('modelDistribution')}</h3>
              <DonutChart
                data={modelChartData as unknown as Record<string, unknown>[]}
                labelKey="model"
                valueKey="tokens_total"
              />
            </div>
          </div>

          {/* Recent Usage Table */}
          <div className="bg-card rounded-lg border border-border">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="text-lg font-semibold">{t('recentUsage')}</h3>
              <span className="text-sm text-muted-foreground">
                {logsTotal} {t('requests')}
              </span>
            </div>
            
            {usageLogs.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                {t('noRecentLogs')}
              </div>
            ) : (
              <>
                {/* Table */}
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border bg-muted/50">
                        <th className="text-left p-3 text-sm font-medium text-muted-foreground">{t('time')}</th>
                        <th className="text-left p-3 text-sm font-medium text-muted-foreground">{t('model')}</th>
                        <th className="text-right p-3 text-sm font-medium text-muted-foreground">{t('inputTokens')}</th>
                        <th className="text-right p-3 text-sm font-medium text-muted-foreground">{t('outputTokens')}</th>
                        <th className="text-right p-3 text-sm font-medium text-muted-foreground">{t('totalTokens')}</th>
                        <th className="text-right p-3 text-sm font-medium text-muted-foreground">{t('latency')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usageLogs.map((log) => (
                        <tr key={log.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                          <td className="p-3 text-sm">{formatTime(log.created_at)}</td>
                          <td className="p-3">
                            <span className="inline-flex items-center px-2 py-1 rounded-md bg-primary/10 text-primary text-xs font-medium">
                              {log.model}
                            </span>
                          </td>
                          <td className="p-3 text-sm text-right">{log.tokens_in.toLocaleString()}</td>
                          <td className="p-3 text-sm text-right">{log.tokens_out.toLocaleString()}</td>
                          <td className="p-3 text-sm text-right font-medium">{log.tokens_total.toLocaleString()}</td>
                          <td className="p-3 text-sm text-right text-muted-foreground">{log.latency_ms} {t('ms')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {logsTotal > 10 && (
                  <div className="p-4 border-t border-border flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      Page {logsPage} of {Math.ceil(logsTotal / 10)}
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setLogsPage(p => Math.max(1, p - 1))}
                        disabled={logsPage <= 1}
                        className="p-2 rounded-lg border border-border hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setLogsPage(p => p + 1)}
                        disabled={logsPage >= Math.ceil(logsTotal / 10)}
                        className="p-2 rounded-lg border border-border hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
