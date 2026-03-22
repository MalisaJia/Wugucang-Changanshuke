'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { listKeys, createKey, revokeKey, type APIKey } from '@/lib/api/keys';
import { ApiClientError } from '@/lib/api/client';
import { Copy, Plus, Trash2, Key, AlertTriangle, Check, X } from 'lucide-react';

export default function APIKeysPage() {
  const t = useTranslations('dashboard');
  const [keys, setKeys] = useState<APIKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create key dialog state
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createExpiry, setCreateExpiry] = useState('');
  const [creating, setCreating] = useState(false);

  // New key dialog state (shows full key after creation)
  const [newKey, setNewKey] = useState<{ key: string; name: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // Revoke confirmation state
  const [revokeTarget, setRevokeTarget] = useState<APIKey | null>(null);
  const [revoking, setRevoking] = useState(false);

  useEffect(() => {
    fetchKeys();
  }, []);

  const fetchKeys = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await listKeys();
      setKeys(data);
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : 'Failed to load API keys';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!createName.trim()) return;

    try {
      setCreating(true);
      const expiryDays = createExpiry ? parseInt(createExpiry, 10) : undefined;
      const response = await createKey({
        name: createName.trim(),
        expires_in_days: expiryDays,
      });
      setNewKey({ key: response.key, name: response.name });
      setShowCreateDialog(false);
      setCreateName('');
      setCreateExpiry('');
      fetchKeys();
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : 'Failed to create key';
      setError(message);
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async () => {
    if (!revokeTarget) return;

    try {
      setRevoking(true);
      await revokeKey(revokeTarget.id);
      setRevokeTarget(null);
      fetchKeys();
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : 'Failed to revoke key';
      setError(message);
    } finally {
      setRevoking(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return t('keys.never');
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusBadge = (status: string) => {
    const statusLower = status.toLowerCase();
    if (statusLower === 'active') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
          {t('keys.active')}
        </span>
      );
    }
    if (statusLower === 'revoked') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
          {t('keys.revoked')}
        </span>
      );
    }
    if (statusLower === 'expired') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
          {t('keys.expired')}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t('keys.title')}</h1>
          <p className="text-muted-foreground mt-1">{t('keys.subtitle')}</p>
        </div>
        <button
          onClick={() => setShowCreateDialog(true)}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          {t('keys.createKey')}
        </button>
      </div>

      {/* Error message */}
      {error && (
        <div className="p-4 rounded-lg bg-destructive/10 text-destructive border border-destructive/20">
          {error}
        </div>
      )}

      {/* Keys table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">
            <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4" />
            Loading...
          </div>
        ) : keys.length === 0 ? (
          <div className="p-8 text-center">
            <Key className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">{t('keys.noKeys')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">{t('keys.name')}</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">{t('keys.keyPrefix')}</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">{t('keys.status')}</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">{t('keys.created')}</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">{t('keys.lastUsed')}</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">{t('keys.expires')}</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-muted-foreground">{t('keys.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {keys.map((key) => (
                  <tr key={key.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium">{key.name}</td>
                    <td className="px-4 py-3 text-sm font-mono text-muted-foreground">{key.key_prefix}...</td>
                    <td className="px-4 py-3">{getStatusBadge(key.status)}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{formatDate(key.created_at)}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{formatDate(key.last_used_at)}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {key.expires_at ? formatDate(key.expires_at) : t('keys.noExpiry')}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {key.status.toLowerCase() === 'active' && (
                        <button
                          onClick={() => setRevokeTarget(key)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                          {t('keys.revoke')}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Key Dialog */}
      {showCreateDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowCreateDialog(false)} />
          <div className="relative bg-card border border-border rounded-lg shadow-lg w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">{t('keys.createDialog.title')}</h2>
              <button
                onClick={() => setShowCreateDialog(false)}
                className="p-1 hover:bg-accent rounded-md transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">{t('keys.createDialog.nameLabel')}</label>
                <input
                  type="text"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder={t('keys.createDialog.namePlaceholder')}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">{t('keys.createDialog.expiryLabel')}</label>
                <input
                  type="number"
                  value={createExpiry}
                  onChange={(e) => setCreateExpiry(e.target.value)}
                  placeholder={t('keys.createDialog.expiryPlaceholder')}
                  min="1"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowCreateDialog(false)}
                className="px-4 py-2 text-sm font-medium rounded-md border border-border hover:bg-accent transition-colors"
              >
                {t('keys.createDialog.cancel')}
              </button>
              <button
                onClick={handleCreate}
                disabled={!createName.trim() || creating}
                className="px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating ? 'Creating...' : t('keys.createDialog.create')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Key Dialog (shows full key) */}
      {newKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
          <div className="relative bg-card border border-border rounded-lg shadow-lg w-full max-w-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30">
                <Check className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">{t('keys.newKeyDialog.title')}</h2>
                <p className="text-sm text-muted-foreground">{newKey.name}</p>
              </div>
            </div>

            <div className="mb-4 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
              <div className="flex gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-500 shrink-0 mt-0.5" />
                <p className="text-sm text-yellow-800 dark:text-yellow-200">{t('keys.copyWarning')}</p>
              </div>
            </div>

            <div className="relative">
              <div className="p-3 rounded-md bg-muted font-mono text-sm break-all pr-12">
                {newKey.key}
              </div>
              <button
                onClick={() => copyToClipboard(newKey.key)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 hover:bg-accent rounded-md transition-colors"
                title={t('keys.copySuccess')}
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </button>
            </div>

            {copied && (
              <p className="mt-2 text-sm text-green-600 dark:text-green-400">{t('keys.copySuccess')}</p>
            )}

            <div className="flex justify-end mt-6">
              <button
                onClick={() => setNewKey(null)}
                className="px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                {t('keys.newKeyDialog.done')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Revoke Confirmation Dialog */}
      {revokeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setRevokeTarget(null)} />
          <div className="relative bg-card border border-border rounded-lg shadow-lg w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-destructive/10">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <h2 className="text-lg font-semibold">{t('keys.revoke')} &quot;{revokeTarget.name}&quot;</h2>
            </div>
            <p className="text-muted-foreground mb-6">{t('keys.revokeConfirm')}</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setRevokeTarget(null)}
                className="px-4 py-2 text-sm font-medium rounded-md border border-border hover:bg-accent transition-colors"
              >
                {t('keys.createDialog.cancel')}
              </button>
              <button
                onClick={handleRevoke}
                disabled={revoking}
                className="px-4 py-2 text-sm font-medium rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50"
              >
                {revoking ? 'Revoking...' : t('keys.revoke')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
