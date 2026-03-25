'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import {
  Settings,
  Loader2,
  Check,
  AlertCircle,
  Building2,
  Gauge,
  Shield,
  Save,
} from 'lucide-react';
import { apiClient } from '@/lib/api/client';

// Tenant response type based on backend handler
interface TenantResponse {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
  settings: Record<string, unknown>;
  rate_limit_rpm: number;
  rate_limit_tpm: number;
  max_keys: number;
  created_at: string;
  updated_at: string;
}

interface UpdateTenantData {
  name?: string;
  settings?: Record<string, unknown>;
}

export default function AdminSettingsClient() {
  const t = useTranslations('admin');
  const [tenant, setTenant] = useState<TenantResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
  });

  const fetchTenant = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiClient.get<TenantResponse>('/api/tenant');
      setTenant(data);
      setFormData({
        name: data.name || '',
      });
    } catch (err) {
      setError(t('error'));
      console.error('Failed to fetch tenant:', err);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchTenant();
  }, [fetchTenant]);

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);

    try {
      const data: UpdateTenantData = {
        name: formData.name,
      };

      const updatedTenant = await apiClient.put<TenantResponse>('/api/tenant', data);
      setTenant(updatedTenant);
      setSuccessMessage(t('success'));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('error'));
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatNumber = (num: number) => {
    return num.toLocaleString();
  };

  const getPlanBadgeColor = (plan: string) => {
    const colors: Record<string, string> = {
      free: 'bg-gray-500/10 text-gray-500',
      starter: 'bg-blue-500/10 text-blue-500',
      pro: 'bg-purple-500/10 text-purple-500',
      enterprise: 'bg-amber-500/10 text-amber-500',
    };
    return colors[plan.toLowerCase()] || 'bg-muted text-muted-foreground';
  };

  const getStatusBadgeColor = (status: string) => {
    const colors: Record<string, string> = {
      active: 'bg-green-500/10 text-green-500',
      suspended: 'bg-red-500/10 text-red-500',
      pending: 'bg-yellow-500/10 text-yellow-500',
    };
    return colors[status.toLowerCase()] || 'bg-muted text-muted-foreground';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">{t('systemSettings')}</h2>
        <button
          onClick={handleSave}
          disabled={loading || saving}
          className="inline-flex items-center gap-2 px-4 h-10 bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {t('save')}
        </button>
      </div>

      {/* Success message */}
      {successMessage && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 px-4 py-3 rounded-lg flex items-center gap-2">
          <Check className="h-5 w-5" />
          {successMessage}
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
        </div>
      ) : tenant ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Basic Information Section */}
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-center gap-2 mb-6">
              <Building2 className="h-5 w-5 text-amber-500" />
              <h3 className="text-lg font-semibold">{t('basicInfo')}</h3>
            </div>

            <div className="space-y-4">
              {/* Tenant Name */}
              <div>
                <label className="block text-sm font-medium mb-2">{t('tenantName')}</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder={t('enterTenantName')}
                  className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* Tenant ID (read-only) */}
              <div>
                <label className="block text-sm font-medium mb-2">{t('tenantId')}</label>
                <div className="h-10 px-3 flex items-center rounded-lg border border-input bg-muted/50 text-sm text-muted-foreground font-mono">
                  {tenant.id}
                </div>
              </div>

              {/* Slug (read-only) */}
              <div>
                <label className="block text-sm font-medium mb-2">{t('tenantSlug')}</label>
                <div className="h-10 px-3 flex items-center rounded-lg border border-input bg-muted/50 text-sm text-muted-foreground">
                  {tenant.slug}
                </div>
              </div>

              {/* Plan (read-only) */}
              <div>
                <label className="block text-sm font-medium mb-2">{t('plan')}</label>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getPlanBadgeColor(tenant.plan)}`}>
                    {tenant.plan.charAt(0).toUpperCase() + tenant.plan.slice(1)}
                  </span>
                </div>
              </div>

              {/* Status (read-only) */}
              <div>
                <label className="block text-sm font-medium mb-2">{t('status')}</label>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusBadgeColor(tenant.status)}`}>
                    {tenant.status.charAt(0).toUpperCase() + tenant.status.slice(1)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Rate Limiting Section */}
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-center gap-2 mb-6">
              <Gauge className="h-5 w-5 text-amber-500" />
              <h3 className="text-lg font-semibold">{t('rateLimiting')}</h3>
            </div>

            <div className="space-y-4">
              {/* RPM */}
              <div>
                <label className="block text-sm font-medium mb-2">{t('requestsPerMinute')} (RPM)</label>
                <div className="h-10 px-3 flex items-center justify-between rounded-lg border border-input bg-muted/50">
                  <span className="text-2xl font-bold text-amber-500">{formatNumber(tenant.rate_limit_rpm)}</span>
                  <span className="text-sm text-muted-foreground">{t('requestsMin')}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{t('rpmHint')}</p>
              </div>

              {/* TPM */}
              <div>
                <label className="block text-sm font-medium mb-2">{t('tokensPerMinute')} (TPM)</label>
                <div className="h-10 px-3 flex items-center justify-between rounded-lg border border-input bg-muted/50">
                  <span className="text-2xl font-bold text-amber-500">{formatNumber(tenant.rate_limit_tpm)}</span>
                  <span className="text-sm text-muted-foreground">{t('tokensMin')}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{t('tpmHint')}</p>
              </div>

              {/* Max API Keys */}
              <div>
                <label className="block text-sm font-medium mb-2">{t('maxApiKeys')}</label>
                <div className="h-10 px-3 flex items-center justify-between rounded-lg border border-input bg-muted/50">
                  <span className="text-2xl font-bold text-amber-500">{formatNumber(tenant.max_keys)}</span>
                  <span className="text-sm text-muted-foreground">{t('keys')}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{t('maxKeysHint')}</p>
              </div>
            </div>
          </div>

          {/* Advanced Settings Section */}
          <div className="rounded-xl border border-border bg-card p-6 lg:col-span-2">
            <div className="flex items-center gap-2 mb-6">
              <Shield className="h-5 w-5 text-amber-500" />
              <h3 className="text-lg font-semibold">{t('advancedSettings')}</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Created At */}
              <div>
                <label className="block text-sm font-medium mb-2">{t('createdAt')}</label>
                <div className="h-10 px-3 flex items-center rounded-lg border border-input bg-muted/50 text-sm text-muted-foreground">
                  {formatDate(tenant.created_at)}
                </div>
              </div>

              {/* Updated At */}
              <div>
                <label className="block text-sm font-medium mb-2">{t('updatedAt')}</label>
                <div className="h-10 px-3 flex items-center rounded-lg border border-input bg-muted/50 text-sm text-muted-foreground">
                  {formatDate(tenant.updated_at)}
                </div>
              </div>

              {/* Custom Settings */}
              {tenant.settings && Object.keys(tenant.settings).length > 0 && (
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-2">{t('customSettings')}</label>
                  <div className="p-3 rounded-lg border border-input bg-muted/50">
                    <pre className="text-xs text-muted-foreground overflow-x-auto">
                      {JSON.stringify(tenant.settings, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Settings className="h-12 w-12 opacity-50" />
          <p className="text-muted-foreground">{t('noData')}</p>
        </div>
      )}
    </div>
  );
}
