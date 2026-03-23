'use client';

import { useEffect, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import {
  Search,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Settings,
  X,
} from 'lucide-react';
import {
  getAdminUsers,
  adjustUserBalance,
  type AdminUser,
  type AdminUsersResponse,
} from '@/lib/api/admin';

export default function AdminUsersClient() {
  const t = useTranslations('admin');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const perPage = 20;

  // Modal state
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [adjusting, setAdjusting] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data: AdminUsersResponse = await getAdminUsers({
        page,
        per_page: perPage,
        search: search || undefined,
      });
      setUsers(data.users || []);
      setTotal(data.total);
    } catch (err) {
      setError(t('error'));
      console.error('Failed to fetch users:', err);
    } finally {
      setLoading(false);
    }
  }, [page, search, t]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleSearch = () => {
    setPage(1);
    setSearch(searchInput);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const openAdjustModal = (user: AdminUser) => {
    setSelectedUser(user);
    setAdjustAmount('');
    setAdjustReason('');
    setShowAdjustModal(true);
  };

  const handleAdjustBalance = async () => {
    if (!selectedUser || !adjustAmount || !adjustReason) return;

    try {
      setAdjusting(true);
      await adjustUserBalance(selectedUser.tenant_id, {
        adjustment: parseInt(adjustAmount, 10),
        reason: adjustReason,
      });
      setShowAdjustModal(false);
      fetchUsers(); // Refresh the list
    } catch (err) {
      console.error('Failed to adjust balance:', err);
    } finally {
      setAdjusting(false);
    }
  };

  const formatNumber = (num: number) => {
    return num.toLocaleString();
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const totalPages = Math.ceil(total / perPage);

  return (
    <div className="space-y-6">
      {/* Header with Search */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <h2 className="text-2xl font-bold">{t('userManagement')}</h2>
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder={t('search')}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
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
        </div>
      </div>

      {/* Users Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <p className="text-destructive">{error}</p>
            <button
              onClick={fetchUsers}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors"
            >
              {t('confirm')}
            </button>
          </div>
        ) : users.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <p className="text-muted-foreground">{t('noUsers')}</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">{t('email')}</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">{t('name')}</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">{t('role')}</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-muted-foreground">{t('balance')}</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">{t('joinedAt')}</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-muted-foreground">{t('actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-sm">{user.email}</p>
                        <p className="text-xs text-muted-foreground truncate max-w-[150px]">
                          {user.tenant_id}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-sm">{user.display_name || '-'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 text-xs rounded-full ${
                          user.role === 'owner' || user.role === 'admin'
                            ? 'bg-amber-500/10 text-amber-500'
                            : 'bg-muted text-muted-foreground'
                        }`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-medium">
                        {formatNumber(user.balance)} <span className="text-muted-foreground">{t('tokens')}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {formatDate(user.created_at)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => openAdjustModal(user)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 rounded-lg transition-colors"
                        >
                          <Settings className="h-3 w-3" />
                          {t('adjust')}
                        </button>
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

      {/* Adjust Balance Modal */}
      {showAdjustModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-xl border border-border w-full max-w-md p-6 shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">{t('adjustBalance')}</h3>
              <button
                onClick={() => setShowAdjustModal(false)}
                className="p-2 hover:bg-muted rounded-lg transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">{t('email')}</p>
                <p className="font-medium">{selectedUser.email}</p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-1">{t('balance')}</p>
                <p className="font-medium">{formatNumber(selectedUser.balance)} {t('tokens')}</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">{t('adjustment')}</label>
                <input
                  type="number"
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(e.target.value)}
                  placeholder={t('enterAmount')}
                  className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <p className="text-xs text-muted-foreground mt-1">{t('positiveAdd')}</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">{t('reason')}</label>
                <textarea
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder={t('enterReason')}
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowAdjustModal(false)}
                className="flex-1 h-10 rounded-lg border border-input hover:bg-muted transition-colors"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleAdjustBalance}
                disabled={!adjustAmount || !adjustReason || adjusting}
                className="flex-1 h-10 bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {adjusting && <Loader2 className="h-4 w-4 animate-spin" />}
                {t('confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
