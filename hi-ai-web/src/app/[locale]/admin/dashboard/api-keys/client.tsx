'use client';

import { useEffect, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  Key,
  Search,
  X,
} from 'lucide-react';
import {
  getAdminApiKeys,
  type AdminAPIKey,
  type AdminAPIKeysResponse,
} from '@/lib/api/admin';

export default function ApiKeysAuditClient() {
  const t = useTranslations('admin');
  const [keys, setKeys] = useState<AdminAPIKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const perPage = 20;

  // Filter state
  const [tenantFilter, setTenantFilter] = useState('');
  const [tenantInput, setTenantInput] = useState('');

  const fetchKeys = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data: AdminAPIKeysResponse = await getAdminApiKeys({
        page,
        per_page: perPage,
        tenant_id: tenantFilter || undefined,
      });

      setKeys(data.keys || []);
      setTotal(data.total);
      setTotalPages(Math.ceil(data.total / perPage));
    } catch (err) {
      setError(t('error'));
      console.error('Failed to fetch API keys:', err);
    } finally {
      setLoading(false);
    }
  }, [page, tenantFilter, t]);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatLastUsed = (dateStr?: string) => {
    if (!dateStr) return t('apiKeys.never');
    return formatDate(dateStr);
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return 'bg-green-500/10 text-green-500';
      case 'revoked':
        return 'bg-red-500/10 text-red-500';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const handleSearch = () => {
    setTenantFilter(tenantInput);
    setPage(1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const clearFilter = () => {
    setTenantFilter('');
    setTenantInput('');
    setPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Header with Search */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <h2 className="text-2xl font-bold">{t('apiKeys.title')}</h2>
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder={t('apiKeys.searchByTenant')}
              value={tenantInput}
              onChange={(e) => setTenantInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full sm:w-64 h-10 pl-9 pr-4 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <button
            onClick={handleSearch}
            className="px-4 h-10 bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors"
          >
            <Search className="h-4 w-4" />
          </button>
          {tenantFilter && (
            <button
              onClick={clearFilter}
              className="p-2 hover:bg-muted rounded-lg transition-colors"
              title={t('apiKeys.clearFilter')}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* API Keys Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <p className="text-destructive">{error}</p>
            <button
              onClick={fetchKeys}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors"
            >
              {t('confirm')}
            </button>
          </div>
        ) : keys.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-2">
            <Key className="h-12 w-12 text-muted-foreground/50" />
            <p className="text-muted-foreground">{t('apiKeys.noKeys')}</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">
                      {t('apiKeys.prefix')}
                    </th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">
                      {t('apiKeys.name')}
                    </th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">
                      {t('apiKeys.tenantId')}
                    </th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">
                      {t('apiKeys.status')}
                    </th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">
                      {t('apiKeys.createdAt')}
                    </th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">
                      {t('apiKeys.lastUsed')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {keys.map((key) => (
                    <tr key={key.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <code className="text-sm font-mono bg-muted px-2 py-0.5 rounded">
                          {key.prefix}...
                        </code>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {key.name || '-'}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-mono truncate max-w-[120px]">
                          {key.tenant_id}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block px-2 py-0.5 text-xs rounded-full ${getStatusColor(
                            key.status
                          )}`}
                        >
                          {t(`apiKeys.statuses.${key.status}`)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                        {formatDate(key.created_at)}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                        {formatLastUsed(key.last_used_at)}
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
