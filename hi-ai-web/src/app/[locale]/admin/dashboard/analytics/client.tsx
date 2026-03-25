'use client';

import { useEffect, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  Zap,
  Clock,
  DollarSign,
} from 'lucide-react';
import {
  getUsageSummary,
  getUsageLogs,
  type UsageSummary,
  type UsageLog,
  type UsageLogsResponse,
} from '@/lib/api/analytics';

export default function AnalyticsClient() {
  const t = useTranslations('admin');
  
  // Summary state
  const [summary, setSummary] = useState<UsageSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  // Usage logs state
  const [logs, setLogs] = useState<UsageLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const perPage = 20;

  const fetchSummary = useCallback(async () => {
    try {
      setSummaryLoading(true);
      setSummaryError(null);
      const data = await getUsageSummary(30);
      setSummary(data);
    } catch (err) {
      setSummaryError(t('error'));
      console.error('Failed to fetch usage summary:', err);
    } finally {
      setSummaryLoading(false);
    }
  }, [t]);

  const fetchLogs = useCallback(async () => {
    try {
      setLogsLoading(true);
      setLogsError(null);
      const data: UsageLogsResponse = await getUsageLogs(page, perPage);
      setLogs(data.logs || []);
      setTotal(data.total);
      setTotalPages(Math.ceil(data.total / perPage));
    } catch (err) {
      setLogsError(t('error'));
      console.error('Failed to fetch usage logs:', err);
    } finally {
      setLogsLoading(false);
    }
  }, [page, t]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const formatNumber = (num: number) => {
    return num.toLocaleString();
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCurrency = (cents: number) => {
    return (cents / 100).toFixed(2);
  };

  // Calculate total consumed from summary (if available)
  const totalTokens = summary ? summary.month_tokens_total : 0;
  const totalRequests = summary ? summary.month_requests : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <h2 className="text-2xl font-bold">{t('analytics.title')}</h2>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Tokens Card */}
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <Zap className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('analytics.totalTokens')}</p>
              <p className="text-2xl font-bold">
                {summaryLoading ? (
                  <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
                ) : summaryError ? (
                  '-'
                ) : (
                  formatNumber(totalTokens)
                )}
              </p>
            </div>
          </div>
          {summary && !summaryLoading && (
            <div className="text-xs text-muted-foreground">
              <span className="text-green-500">↑ {formatNumber(summary.today_tokens_total)}</span> {t('analytics.today')}
            </div>
          )}
        </div>

        {/* Total Requests Card */}
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Clock className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('analytics.totalRequests')}</p>
              <p className="text-2xl font-bold">
                {summaryLoading ? (
                  <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                ) : summaryError ? (
                  '-'
                ) : (
                  formatNumber(totalRequests)
                )}
              </p>
            </div>
          </div>
          {summary && !summaryLoading && (
            <div className="text-xs text-muted-foreground">
              <span className="text-green-500">↑ {formatNumber(summary.today_requests)}</span> {t('analytics.today')}
            </div>
          )}
        </div>

        {/* Token Breakdown Card */}
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <BarChart3 className="h-5 w-5 text-purple-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('analytics.tokenBreakdown')}</p>
            </div>
          </div>
          {summaryLoading ? (
            <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
          ) : summaryError ? (
            <p className="text-muted-foreground">-</p>
          ) : summary ? (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('analytics.promptTokens')}</span>
                <span className="font-medium">{formatNumber(summary.month_tokens_in)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('analytics.completionTokens')}</span>
                <span className="font-medium">{formatNumber(summary.month_tokens_out)}</span>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Usage Logs Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-lg font-semibold">{t('analytics.usageLogs')}</h3>
        </div>

        {logsLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
          </div>
        ) : logsError ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <p className="text-destructive">{logsError}</p>
            <button
              onClick={fetchLogs}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors"
            >
              {t('confirm')}
            </button>
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-2">
            <BarChart3 className="h-12 w-12 text-muted-foreground/50" />
            <p className="text-muted-foreground">{t('analytics.noLogs')}</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">
                      {t('analytics.time')}
                    </th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">
                      {t('analytics.model')}
                    </th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-muted-foreground">
                      {t('analytics.promptTokens')}
                    </th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-muted-foreground">
                      {t('analytics.completionTokens')}
                    </th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-muted-foreground">
                      {t('analytics.totalTokensCol')}
                    </th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-muted-foreground">
                      {t('analytics.latency')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 text-sm whitespace-nowrap">
                        {formatDate(log.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-block px-2 py-0.5 text-xs bg-muted rounded-full">
                          {log.model}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-mono">
                        {formatNumber(log.tokens_in)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-mono">
                        {formatNumber(log.tokens_out)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-mono font-medium">
                        {formatNumber(log.tokens_total)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-muted-foreground">
                        {log.latency_ms}ms
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                <p className="text-sm text-muted-foreground">
                  {(page - 1) * perPage + 1} - {Math.min(page * perPage, total)} of {total}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                    className="p-2 rounded-lg hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="text-sm font-medium">
                    {page} / {totalPages}
                  </span>
                  <button
                    onClick={() => setPage(Math.min(totalPages, page + 1))}
                    disabled={page === totalPages}
                    className="p-2 rounded-lg hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
