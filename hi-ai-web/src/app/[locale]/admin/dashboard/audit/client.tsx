'use client';

import { useEffect, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  FileText,
  Filter,
  X,
} from 'lucide-react';
import { getAuditLogs, type AuditLog, type AuditLogsResponse } from '@/lib/api/audit';

const ACTION_TYPES = ['login', 'logout', 'create', 'update', 'delete', 'view'] as const;

export default function AuditLogsClient() {
  const t = useTranslations('admin');
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const perPage = 20;

  // Filter state
  const [actionFilter, setActionFilter] = useState<string>('');
  const [showFilterMenu, setShowFilterMenu] = useState(false);

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data: AuditLogsResponse = await getAuditLogs(page, perPage);
      
      // Apply client-side filter if action filter is set
      let filteredLogs = data.data || [];
      if (actionFilter) {
        filteredLogs = filteredLogs.filter(log => 
          log.action.toLowerCase().includes(actionFilter.toLowerCase())
        );
      }
      
      setLogs(filteredLogs);
      setTotal(data.pagination.total);
      setTotalPages(data.pagination.total_pages);
    } catch (err) {
      setError(t('error'));
      console.error('Failed to fetch audit logs:', err);
    } finally {
      setLoading(false);
    }
  }, [page, actionFilter, t]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getActionColor = (action: string) => {
    const lowerAction = action.toLowerCase();
    if (lowerAction.includes('login') || lowerAction.includes('logout')) {
      return 'bg-blue-500/10 text-blue-500';
    }
    if (lowerAction.includes('create')) {
      return 'bg-green-500/10 text-green-500';
    }
    if (lowerAction.includes('update')) {
      return 'bg-amber-500/10 text-amber-500';
    }
    if (lowerAction.includes('delete')) {
      return 'bg-red-500/10 text-red-500';
    }
    return 'bg-muted text-muted-foreground';
  };

  const handleFilterChange = (filter: string) => {
    setActionFilter(filter);
    setPage(1);
    setShowFilterMenu(false);
  };

  const clearFilter = () => {
    setActionFilter('');
    setPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <h2 className="text-2xl font-bold">{t('audit.title')}</h2>
        <div className="flex items-center gap-2">
          {/* Filter dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowFilterMenu(!showFilterMenu)}
              className={`inline-flex items-center gap-2 px-4 h-10 rounded-lg transition-colors ${
                actionFilter
                  ? 'bg-amber-500 text-white'
                  : 'bg-muted hover:bg-muted/80'
              }`}
            >
              <Filter className="h-4 w-4" />
              {actionFilter || t('audit.filterByAction')}
            </button>

            {showFilterMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-card border border-border rounded-lg shadow-lg z-10">
                <div className="p-2 space-y-1">
                  <button
                    onClick={() => handleFilterChange('')}
                    className={`w-full text-left px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors ${
                      !actionFilter ? 'bg-amber-500/10 text-amber-500' : ''
                    }`}
                  >
                    {t('audit.allActions')}
                  </button>
                  {ACTION_TYPES.map((action) => (
                    <button
                      key={action}
                      onClick={() => handleFilterChange(action)}
                      className={`w-full text-left px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors capitalize ${
                        actionFilter === action ? 'bg-amber-500/10 text-amber-500' : ''
                      }`}
                    >
                      {action}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {actionFilter && (
            <button
              onClick={clearFilter}
              className="p-2 hover:bg-muted rounded-lg transition-colors"
              title={t('audit.clearFilter')}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Audit Logs Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <p className="text-destructive">{error}</p>
            <button
              onClick={fetchLogs}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors"
            >
              {t('confirm')}
            </button>
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-2">
            <FileText className="h-12 w-12 text-muted-foreground/50" />
            <p className="text-muted-foreground">{t('audit.noLogs')}</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">
                      {t('audit.time')}
                    </th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">
                      {t('audit.userId')}
                    </th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">
                      {t('audit.action')}
                    </th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">
                      {t('audit.resourceType')}
                    </th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">
                      {t('audit.ipAddress')}
                    </th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">
                      {t('audit.details')}
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
                        <p className="text-sm font-mono truncate max-w-[120px]">
                          {log.user_id || '-'}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block px-2 py-0.5 text-xs rounded-full capitalize ${getActionColor(
                            log.action
                          )}`}
                        >
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm capitalize">
                          {log.resource_type || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-mono">
                          {log.ip_address || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {log.request_summary ? (
                          <span className="text-sm text-muted-foreground truncate max-w-[150px] block">
                            {JSON.stringify(log.request_summary).slice(0, 50)}
                            {JSON.stringify(log.request_summary).length > 50 ? '...' : ''}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
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
