'use client';

import { useEffect, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Filter,
  X,
} from 'lucide-react';
import {
  getAdminPayments,
  type AdminPayment,
  type AdminPaymentsResponse,
} from '@/lib/api/admin';

const TRANSACTION_TYPES = ['recharge', 'consume', 'adjustment', 'refund'] as const;

export default function PaymentsClient() {
  const t = useTranslations('admin');
  const [payments, setPayments] = useState<AdminPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const perPage = 20;

  // Filter state
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [showFilterMenu, setShowFilterMenu] = useState(false);

  const fetchPayments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data: AdminPaymentsResponse = await getAdminPayments({
        page,
        per_page: perPage,
      });

      // Apply client-side filter if type filter is set
      let filteredPayments = data.transactions || [];
      if (typeFilter) {
        filteredPayments = filteredPayments.filter(
          (p) => p.type.toLowerCase() === typeFilter.toLowerCase()
        );
      }

      setPayments(filteredPayments);
      setTotal(data.total);
      setTotalPages(Math.ceil(data.total / perPage));
    } catch (err) {
      setError(t('error'));
      console.error('Failed to fetch payments:', err);
    } finally {
      setLoading(false);
    }
  }, [page, typeFilter, t]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

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

  // Convert cents to yuan with 2 decimal places
  const formatAmount = (cents: number) => {
    const yuan = cents / 100;
    return yuan.toFixed(2);
  };

  const getAmountColor = (type: string, amount: number) => {
    // recharge is positive (green), consume/refund is negative (red)
    if (type === 'recharge' || amount > 0) {
      return 'text-green-500';
    }
    return 'text-red-500';
  };

  const getAmountPrefix = (type: string, amount: number) => {
    if (type === 'recharge' || amount > 0) {
      return '+';
    }
    return '';
  };

  const getTypeColor = (type: string) => {
    switch (type.toLowerCase()) {
      case 'recharge':
        return 'bg-green-500/10 text-green-500';
      case 'consume':
        return 'bg-red-500/10 text-red-500';
      case 'adjustment':
        return 'bg-amber-500/10 text-amber-500';
      case 'refund':
        return 'bg-blue-500/10 text-blue-500';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const handleFilterChange = (filter: string) => {
    setTypeFilter(filter);
    setPage(1);
    setShowFilterMenu(false);
  };

  const clearFilter = () => {
    setTypeFilter('');
    setPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <h2 className="text-2xl font-bold">{t('payments.title')}</h2>
        <div className="flex items-center gap-2">
          {/* Filter dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowFilterMenu(!showFilterMenu)}
              className={`inline-flex items-center gap-2 px-4 h-10 rounded-lg transition-colors ${
                typeFilter
                  ? 'bg-amber-500 text-white'
                  : 'bg-muted hover:bg-muted/80'
              }`}
            >
              <Filter className="h-4 w-4" />
              {typeFilter ? t(`payments.types.${typeFilter}`) : t('payments.filterByType')}
            </button>

            {showFilterMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-card border border-border rounded-lg shadow-lg z-10">
                <div className="p-2 space-y-1">
                  <button
                    onClick={() => handleFilterChange('')}
                    className={`w-full text-left px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors ${
                      !typeFilter ? 'bg-amber-500/10 text-amber-500' : ''
                    }`}
                  >
                    {t('payments.allTypes')}
                  </button>
                  {TRANSACTION_TYPES.map((type) => (
                    <button
                      key={type}
                      onClick={() => handleFilterChange(type)}
                      className={`w-full text-left px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors ${
                        typeFilter === type ? 'bg-amber-500/10 text-amber-500' : ''
                      }`}
                    >
                      {t(`payments.types.${type}`)}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {typeFilter && (
            <button
              onClick={clearFilter}
              className="p-2 hover:bg-muted rounded-lg transition-colors"
              title={t('payments.clearFilter')}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Payments Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <p className="text-destructive">{error}</p>
            <button
              onClick={fetchPayments}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors"
            >
              {t('confirm')}
            </button>
          </div>
        ) : payments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-2">
            <CreditCard className="h-12 w-12 text-muted-foreground/50" />
            <p className="text-muted-foreground">{t('payments.noPayments')}</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">
                      {t('payments.time')}
                    </th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">
                      {t('payments.tenantId')}
                    </th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">
                      {t('payments.type')}
                    </th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-muted-foreground">
                      {t('payments.amount')}
                    </th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-muted-foreground">
                      {t('payments.balanceAfter')}
                    </th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">
                      {t('payments.description')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {payments.map((payment) => (
                    <tr key={payment.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 text-sm whitespace-nowrap">
                        {formatDate(payment.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-mono truncate max-w-[120px]">
                          {payment.tenant_id}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block px-2 py-0.5 text-xs rounded-full ${getTypeColor(
                            payment.type
                          )}`}
                        >
                          {t(`payments.types.${payment.type}`)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={`text-sm font-medium ${getAmountColor(
                            payment.type,
                            payment.amount
                          )}`}
                        >
                          {getAmountPrefix(payment.type, payment.amount)}
                          ¥{formatAmount(Math.abs(payment.amount))}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm">¥{formatAmount(payment.balance_after)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-muted-foreground truncate max-w-[200px] block">
                          {payment.description || '-'}
                        </span>
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
