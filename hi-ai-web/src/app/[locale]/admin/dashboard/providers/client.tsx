'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import {
  Server,
  Edit,
  Check,
  X,
  Loader2,
  AlertCircle,
  ExternalLink,
  Eye,
  EyeOff,
} from 'lucide-react';
import {
  getProviders,
  updateProvider,
  maskApiKey,
  maskBaseUrl,
  PROVIDER_TEMPLATES,
  type Provider,
  type ProviderConfig,
  type UpdateProviderData,
} from '@/lib/api/providers';

interface EditFormData {
  api_key: string;
  base_url: string;
  priority: number;
  weight: number;
  enabled: boolean;
}

export default function AdminProvidersClient() {
  const t = useTranslations('admin');
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingProvider, setEditingProvider] = useState<Provider | null>(null);
  const [formData, setFormData] = useState<EditFormData>({
    api_key: '',
    base_url: '',
    priority: 0,
    weight: 1,
    enabled: true,
  });
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);

  const fetchProviders = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getProviders();
      setProviders(data);
    } catch (err) {
      setError(t('error'));
      console.error('Failed to fetch providers:', err);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const handleEdit = (provider: Provider) => {
    setEditingProvider(provider);
    const template = PROVIDER_TEMPLATES[provider.id];
    setFormData({
      api_key: '',
      base_url: provider.config?.base_url || template?.base_url || '',
      priority: provider.config?.priority ?? 0,
      weight: provider.config?.weight ?? 1,
      enabled: provider.config?.enabled ?? false,
    });
    setShowApiKey(false);
  };

  const handleSave = async () => {
    if (!editingProvider || saving) return;
    setSaving(true);
    setError(null);

    try {
      const data: UpdateProviderData = {
        enabled: formData.enabled,
        base_url: formData.base_url,
        priority: formData.priority,
        weight: formData.weight,
      };
      if (formData.api_key) {
        data.api_key = formData.api_key;
      }

      const updatedConfig = await updateProvider(editingProvider.id, data);
      setProviders((prev) =>
        prev.map((p) =>
          p.id === editingProvider.id
            ? { ...p, config: updatedConfig }
            : p
        )
      );
      setSuccessMessage(t('success'));
      setEditingProvider(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('error'));
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditingProvider(null);
    setError(null);
    setShowApiKey(false);
  };

  const applyTemplate = (providerId: string) => {
    const template = PROVIDER_TEMPLATES[providerId];
    if (template) {
      setFormData((prev) => ({ ...prev, base_url: template.base_url }));
    }
  };

  const getProviderInitial = (name: string) => {
    return name.charAt(0).toUpperCase();
  };

  const getProviderColor = (id: string): string => {
    const colors: Record<string, string> = {
      openai: 'bg-green-500',
      anthropic: 'bg-orange-500',
      google: 'bg-blue-500',
      qwen: 'bg-purple-500',
      zhipu: 'bg-cyan-500',
      moonshot: 'bg-yellow-500',
      minimax: 'bg-pink-500',
      ollama: 'bg-gray-500',
    };
    return colors[id] || 'bg-amber-500';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">{t('providerManagement')}</h2>
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

      {/* Providers Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
          </div>
        ) : providers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Server className="h-12 w-12 opacity-50" />
            <p className="text-muted-foreground">{t('noProviders')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">{t('providerName')}</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">{t('providerType')}</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">{t('baseUrl')}</th>
                  <th className="text-center px-4 py-3 text-sm font-medium text-muted-foreground">{t('priority')}</th>
                  <th className="text-center px-4 py-3 text-sm font-medium text-muted-foreground">{t('weight')}</th>
                  <th className="text-center px-4 py-3 text-sm font-medium text-muted-foreground">{t('status')}</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-muted-foreground">{t('actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {providers.map((provider) => (
                  <tr key={provider.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-lg ${getProviderColor(provider.id)} flex items-center justify-center text-white font-bold text-sm`}
                        >
                          {getProviderInitial(provider.name)}
                        </div>
                        <div>
                          <p className="font-medium">{provider.name}</p>
                          <a
                            href={provider.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-muted-foreground hover:text-amber-500 flex items-center gap-1"
                          >
                            {provider.website.replace('https://', '')}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-accent text-accent-foreground">
                        {provider.api_style}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-muted-foreground">
                        {maskBaseUrl(provider.config?.base_url)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="font-medium">{provider.config?.priority ?? 0}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="font-medium">{provider.config?.weight ?? 1}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        provider.config?.enabled
                          ? 'bg-green-500/10 text-green-500'
                          : 'bg-gray-500/10 text-gray-500'
                      }`}>
                        {provider.config?.enabled ? t('enabled') : t('disabled')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleEdit(provider)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 rounded-lg transition-colors"
                      >
                        <Edit className="h-3 w-3" />
                        {t('edit')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editingProvider && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-xl border border-border w-full max-w-md max-h-[90vh] overflow-y-auto shadow-xl">
            {/* Modal Header */}
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <div
                  className={`w-8 h-8 rounded-lg ${getProviderColor(editingProvider.id)} flex items-center justify-center text-white font-bold text-sm`}
                >
                  {getProviderInitial(editingProvider.name)}
                </div>
                {t('editProvider')} - {editingProvider.name}
              </h3>
              <button
                onClick={handleCancel}
                className="p-2 hover:bg-muted rounded-lg transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 space-y-4">
              {/* Quick template */}
              {PROVIDER_TEMPLATES[editingProvider.id] && (
                <div className="bg-accent/50 rounded-lg p-3">
                  <span className="text-sm text-muted-foreground">{t('applyTemplate')}:</span>
                  <button
                    onClick={() => applyTemplate(editingProvider.id)}
                    className="ml-2 text-sm text-amber-500 hover:underline"
                  >
                    {editingProvider.name}
                  </button>
                </div>
              )}

              {/* Enabled toggle */}
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">{t('status')}</label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setFormData((prev) => ({ ...prev, enabled: !prev.enabled }))}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      formData.enabled ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        formData.enabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                  <span className="text-sm">
                    {formData.enabled ? t('enabled') : t('disabled')}
                  </span>
                </div>
              </div>

              {/* API Key */}
              <div>
                <label className="block text-sm font-medium mb-2">{t('apiKey')}</label>
                <div className="relative">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={formData.api_key}
                    onChange={(e) => setFormData((prev) => ({ ...prev, api_key: e.target.value }))}
                    placeholder={editingProvider.config?.has_api_key ? '••••••••' : t('enterApiKey')}
                    className="w-full h-10 px-3 pr-10 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {editingProvider.config?.has_api_key ? t('leaveEmptyKeepKey') : t('requiredToEnable')}
                </p>
              </div>

              {/* Base URL */}
              <div>
                <label className="block text-sm font-medium mb-2">{t('baseUrl')}</label>
                <input
                  type="text"
                  value={formData.base_url}
                  onChange={(e) => setFormData((prev) => ({ ...prev, base_url: e.target.value }))}
                  placeholder="https://api.example.com/v1"
                  className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* Priority */}
              <div>
                <label className="block text-sm font-medium mb-2">{t('priority')} (0-100)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={formData.priority}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, priority: parseInt(e.target.value) || 0 }))
                  }
                  className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <p className="text-xs text-muted-foreground mt-1">{t('priorityHint')}</p>
              </div>

              {/* Weight */}
              <div>
                <label className="block text-sm font-medium mb-2">{t('weight')} (1-100)</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={formData.weight}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, weight: parseInt(e.target.value) || 1 }))
                  }
                  className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <p className="text-xs text-muted-foreground mt-1">{t('weightHint')}</p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-border flex gap-3">
              <button
                onClick={handleCancel}
                disabled={saving}
                className="flex-1 h-10 rounded-lg border border-input hover:bg-muted transition-colors"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 h-10 bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {t('save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
