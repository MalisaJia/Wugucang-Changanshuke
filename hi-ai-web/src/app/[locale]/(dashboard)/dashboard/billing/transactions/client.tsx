'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/lib/i18n/navigation';
import { getTransactions, type Transaction, type TransactionList } from '@/lib/api/billing';
import { ApiClientError } from '@/lib/api/client';
import {
  ArrowUpRight,
  ArrowDownRight,
  RotateCcw,
  FileText,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
} from 'lucide-react';

export default function TransactionsClient() {
  const t = useTranslations('billing');
  const [data, setData] = useState<TransactionList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const perPage = 20;

  useEffect(() => {
    fetchTransactions();
  }, [page]);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await getTransactions(page, perPage);
      setData(result);
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : 'Failed to load transactions';
      setError(message);
    } finally {
      setLoading(false);
    }
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

  const formatAmount = (amount: number, type: string) => {
    const formatted = Math.abs(amount).toLocaleString();
    if (type === 'consume') {
      return `-${formatted}`;
    }
    return `+${formatted}`;
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'recharge':
        return <ArrowUpRight className="h-4 w-4" />;
      case 'consume':
        return <ArrowDownRight className="h-4 w-4" />;
      case 'refund':
        return <RotateCcw className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getTypeBadge = (type: string) => {
    const baseClasses = "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium";
    switch (type) {
      case 'recharge':
        return (
          <span className={`${baseClasses} bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400`}>
            {getTypeIcon(type)}
            {t('typeRecharge')}
          </span>
        );
      case 'consume':
        return (
          <span className={`${baseClasses} bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400`}>
            {getTypeIcon(type)}
            {t('typeConsume')}
          </span>
        );
      case 'refund':
        return (
          <span className={`${baseClasses} bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400`}>
            {getTypeIcon(type)}
            {t('typeRefund')}
          </span>
        );
      default:
        return (
          <span className={`${baseClasses} bg-muted text-muted-foreground`}>
            {getTypeIcon(type)}
            {type}
          </span>
        );
    }
  };

  const getAmountClass = (type: string) => {
    switch (type) {
      case 'recharge':
      case 'refund':
        return 'text-green-600 dark:text-green-400';
      case 'consume':
        return 'text-red-600 dark:text-red-400';
      default:
        return '';
    }
  };

  const totalPages = data ? Math.ceil(data.total / perPage) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link
              href="/dashboard/billing"
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              {t('title')}
            </Link>
          </div>
          <h1 className="text-2xl font-bold">{t('transactions')}</h1>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="p-4 rounded-lg bg-destructive/10 text-destructive border border-destructive/20">
          {error}
        </div>
      )}

      {/* Transactions Table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">
            <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4" />
            Loading...
          </div>
        ) : !data || data.transactions.length === 0 ? (
          <div className="p-8 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">{t('noTransactions')}</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">
                      {t('time')}
                    </th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">
                      {t('type')}
                    </th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-muted-foreground">
                      {t('amount')}
                    </th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-muted-foreground">
                      {t('balanceAfter')}
                    </th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">
                      {t('description')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.transactions.map((tx: Transaction) => (
                    <tr key={tx.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                        {formatDate(tx.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        {getTypeBadge(tx.type)}
                      </td>
                      <td className={`px-4 py-3 text-sm font-medium text-right ${getAmountClass(tx.type)}`}>
                        {formatAmount(tx.amount, tx.type)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-muted-foreground">
                        {tx.balance_after.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground max-w-xs truncate">
                        {tx.description}
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
                  {t('page')} {page} {t('of')} {totalPages}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-md border border-border hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    {t('previous')}
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-md border border-border hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {t('next')}
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
