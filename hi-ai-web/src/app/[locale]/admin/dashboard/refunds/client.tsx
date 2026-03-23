'use client';

import { useEffect, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  DollarSign,
} from 'lucide-react';
import {
  getRefundRequests,
  processRefund,
  getAdminUsers,
  type Transaction,
  type RefundTransactionsResponse,
  type AdminUser,
} from '@/lib/api/admin';

export default function AdminRefundsClient() {
  const t = useTranslations('admin');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const perPage = 20;

  // Refund modal state
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const [searchUser, setSearchUser] = useState('');
  const [loadingUsers, setLoadingUsers] = useState(false);

  const fetchTransactions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data: RefundTransactionsResponse = await getRefundRequests({
        page,
        per_page: perPage,
      });
      setTransactions(data.transactions || []);
      setTotal(data.total);
    } catch (err) {
      setError(t('error'));
      console.error('Failed to fetch refund transactions:', err);
    } finally {
      setLoading(false);
    }
  }, [page, t]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const searchUsers = async () => {
    if (!searchUser.trim()) return;
    
    try {
      setLoadingUsers(true);
      const data = await getAdminUsers({
        page: 1,
        per_page: 10,
        search: searchUser,
      });
      setUsers(data.users || []);
    } catch (err) {
      console.error('Failed to search users:', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleProcessRefund = async () => {
    if (!selectedTenantId || !refundAmount || !refundReason) return;

    try {
      setProcessing(true);
      await processRefund({
        user_id: selectedTenantId,
        amount: parseInt(refundAmount, 10),
        reason: refundReason,
      });
      setShowRefundModal(false);
      setSelectedTenantId('');
      setRefundAmount('');
      setRefundReason('');
      setUsers([]);
      setSearchUser('');
      fetchTransactions(); // Refresh the list
    } catch (err) {
      console.error('Failed to process refund:', err);
    } finally {
      setProcessing(false);
    }
  };

  const openRefundModal = () => {
    setShowRefundModal(true);
    setSelectedTenantId('');
    setRefundAmount('');
    setRefundReason('');
    setUsers([]);
    setSearchUser('');
  };

  const formatNumber = (num: number) => {
    return num.toLocaleString();
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'refund':
        return 'bg-green-500/10 text-green-500';
      case 'admin_adjustment':
        return 'bg-amber-500/10 text-amber-500';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const totalPages = Math.ceil(total / perPage);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <h2 className="text-2xl font-bold">{t('refunds')}</h2>
        <button
          onClick={openRefundModal}
          className="inline-flex items-center gap-2 px-4 h-10 bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors"
        >
          <Plus className="h-4 w-4" />
          {t('processRefund')}
        </button>
      </div>

      {/* Transactions Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <p className="text-destructive">{error}</p>
            <button
              onClick={fetchTransactions}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors"
            >
              {t('confirm')}
            </button>
          </div>
        ) : transactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-2">
            <DollarSign className="h-12 w-12 text-muted-foreground/50" />
            <p className="text-muted-foreground">{t('noRefunds')}</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">{t('type')}</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">{t('tenantId')}</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-muted-foreground">{t('amount')}</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">{t('description')}</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">{t('date')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 text-xs rounded-full capitalize ${getTypeColor(tx.type)}`}>
                          {tx.type.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-mono truncate max-w-[150px]">{tx.tenant_id}</p>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-medium text-sm ${tx.amount >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {tx.amount >= 0 ? '+' : ''}{formatNumber(tx.amount)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-muted-foreground truncate max-w-[200px]">{tx.description || '-'}</p>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {formatDate(tx.created_at)}
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
                  {((page - 1) * perPage) + 1} - {Math.min(page * perPage, total)} of {total}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                    className="p-2 rounded-lg hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="text-sm font-medium">{page} / {totalPages}</span>
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

      {/* Process Refund Modal */}
      {showRefundModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-xl border border-border w-full max-w-md p-6 shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">{t('processRefund')}</h3>
              <button
                onClick={() => setShowRefundModal(false)}
                className="p-2 hover:bg-muted rounded-lg transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              {/* User Search */}
              <div>
                <label className="block text-sm font-medium mb-2">{t('selectUser')}</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={searchUser}
                    onChange={(e) => setSearchUser(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && searchUsers()}
                    placeholder={t('search')}
                    className="flex-1 h-10 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <button
                    onClick={searchUsers}
                    disabled={loadingUsers}
                    className="px-4 h-10 bg-muted hover:bg-muted/80 rounded-lg transition-colors"
                  >
                    {loadingUsers ? <Loader2 className="h-4 w-4 animate-spin" /> : t('confirm')}
                  </button>
                </div>

                {/* User results */}
                {users.length > 0 && (
                  <div className="mt-2 max-h-40 overflow-y-auto border border-border rounded-lg">
                    {users.map((user) => (
                      <button
                        key={user.id}
                        onClick={() => {
                          setSelectedTenantId(user.tenant_id);
                          setUsers([]);
                          setSearchUser(user.email);
                        }}
                        className={`w-full text-left px-3 py-2 hover:bg-muted transition-colors ${
                          selectedTenantId === user.tenant_id ? 'bg-amber-500/10' : ''
                        }`}
                      >
                        <p className="text-sm font-medium">{user.email}</p>
                        <p className="text-xs text-muted-foreground">{user.display_name} - {formatNumber(user.balance)} {t('tokens')}</p>
                      </button>
                    ))}
                  </div>
                )}

                {selectedTenantId && (
                  <p className="text-xs text-amber-500 mt-2">
                    Selected: {selectedTenantId}
                  </p>
                )}
              </div>

              {/* Refund Amount */}
              <div>
                <label className="block text-sm font-medium mb-2">{t('refundAmount')}</label>
                <input
                  type="number"
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  placeholder={t('enterAmount')}
                  min="1"
                  className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* Reason */}
              <div>
                <label className="block text-sm font-medium mb-2">{t('refundReason')}</label>
                <textarea
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  placeholder={t('enterReason')}
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowRefundModal(false)}
                className="flex-1 h-10 rounded-lg border border-input hover:bg-muted transition-colors"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleProcessRefund}
                disabled={!selectedTenantId || !refundAmount || !refundReason || processing}
                className="flex-1 h-10 bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {processing && <Loader2 className="h-4 w-4 animate-spin" />}
                {t('confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
