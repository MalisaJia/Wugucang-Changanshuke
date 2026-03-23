'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import {
  Server,
  Plus,
  Edit,
  Shield,
  ExternalLink,
  Check,
  X,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { useAuthStore } from '@/lib/stores/auth-store';
import {
  getProviders,
  updateProvider,
  toggleProvider,
  maskApiKey,
  maskBaseUrl,
  PROVIDER_TEMPLATES,
  type Provider,
  type UpdateProviderData,
} from '@/lib/api/providers';

interface EditFormData {
  api_key: string;
  base_url: string;
  priority: number;
  weight: number;
  enabled: boolean;
}

export default function ProvidersPage() {
  const t = useTranslations('providers');
  const { user } = useAuthStore();
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
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const isOwnerOrAdmin = user?.role === 'owner' || user?.role === 'admin';

  const fetchProviders = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getProviders();
      setProviders(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load providers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const handleToggle = async (provider: Provider) => {
    if (!isOwnerOrAdmin || togglingId) return;
    const newEnabled = !provider.config?.enabled;
    setTogglingId(provider.id);
    try {
      await toggleProvider(provider.id, newEnabled);
      setProviders((prev) =>
        prev.map((p) =>
          p.id === provider.id
            ? {
                ...p,
                config: p.config
                  ? { ...p.config, enabled: newEnabled }
                  : {
                      id: '',
                      provider_id: provider.id,
                      enabled: newEnabled,
                      priority: 0,
                      weight: 1,
                      has_api_key: false,
                      settings: {},
                      created_at: new Date().toISOString(),
                      updated_at: new Date().toISOString(),
                    },
              }
            : p
        )
      );
      setSuccessMessage(t('updateSuccess'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle provider');
    } finally {
      setTogglingId(null);
    }
  };

  const handleEdit = (provider: Provider) => {
    setEditingProvider(provider);
    const template = PROVIDER_TEMPLATES[provider.id];
    setFormData({
      api_key: '',
      base_url: provider.config?.base_url || template?.base_url || '',
      priority: provider.config?.priority ?? 0,
      weight: provider.config?.weight ?? 1,
      enabled: provider.config?.enabled ?? true,
    });
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
      setSuccessMessage(t('updateSuccess'));
      setEditingProvider(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save provider');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditingProvider(null);
    setError(null);
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
    return colors[id] || 'bg-primary';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground mt-1">
            {!isOwnerOrAdmin && (
              <span className="flex items-center gap-1 text-amber-600">
                <Shield className="h-4 w-4" />
                {t('ownerOnly')}
              </span>
            )}
          </p>
        </div>
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

      {/* Providers grid */}
      {providers.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Server className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>{t('noProviders')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {providers.map((provider) => (
            <div
              key={provider.id}
              className="bg-card border border-border rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              {/* Provider header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-lg ${getProviderColor(provider.id)} flex items-center justify-center text-white font-bold`}
                  >
                    {getProviderInitial(provider.name)}
                  </div>
                  <div>
                    <h3 className="font-semibold">{provider.name}</h3>
                    <a
                      href={provider.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
                    >
                      {provider.website.replace('https://', '')}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
                {/* Status toggle */}
                <button
                  onClick={() => handleToggle(provider)}
                  disabled={!isOwnerOrAdmin || togglingId === provider.id}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    provider.config?.enabled
                      ? 'bg-green-500'
                      : 'bg-gray-300 dark:bg-gray-600'
                  } ${!isOwnerOrAdmin ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      provider.config?.enabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                  {togglingId === provider.id && (
                    <Loader2 className="absolute inset-0 m-auto h-4 w-4 animate-spin text-white" />
                  )}
                </button>
              </div>

              {/* Description */}
              <p className="text-sm text-muted-foreground mb-3">{provider.description}</p>

              {/* Config info */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('apiKey')}:</span>
                  <span className="font-mono">{maskApiKey(provider.config?.has_api_key ?? false)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('baseUrl')}:</span>
                  <span className="font-mono text-xs truncate max-w-[150px]">
                    {maskBaseUrl(provider.config?.base_url)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('priority')}:</span>
                  <span>{provider.config?.priority ?? 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('weight')}:</span>
                  <span>{provider.config?.weight ?? 1}</span>
                </div>
              </div>

              {/* Models */}
              <div className="mt-3">
                <span className="text-xs text-muted-foreground">{t('models')}:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {provider.models.slice(0, 3).map((model) => (
                    <span
                      key={model}
                      className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-accent text-accent-foreground"
                    >
                      {model}
                    </span>
                  ))}
                  {provider.models.length > 3 && (
                    <span className="text-xs text-muted-foreground">
                      +{provider.models.length - 3}
                    </span>
                  )}
                </div>
              </div>

              {/* Edit button */}
              {isOwnerOrAdmin && (
                <button
                  onClick={() => handleEdit(provider)}
                  className="mt-4 w-full flex items-center justify-center gap-2 px-3 py-2 text-sm border border-border rounded-lg hover:bg-accent transition-colors"
                >
                  <Edit className="h-4 w-4" />
                  {t('edit')}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Edit Modal */}
      {editingProvider && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <div
                  className={`w-8 h-8 rounded-lg ${getProviderColor(editingProvider.id)} flex items-center justify-center text-white font-bold text-sm`}
                >
                  {getProviderInitial(editingProvider.name)}
                </div>
                {t('edit')} - {editingProvider.name}
              </h2>
              <button
                onClick={handleCancel}
                className="p-1 hover:bg-accent rounded"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Quick template */}
              {PROVIDER_TEMPLATES[editingProvider.id] && (
                <div className="bg-accent/50 rounded-lg p-3">
                  <span className="text-sm text-muted-foreground">{t('templates')}:</span>
                  <button
                    onClick={() => applyTemplate(editingProvider.id)}
                    className="ml-2 text-sm text-primary hover:underline"
                  >
                    {editingProvider.name}
                  </button>
                </div>
              )}

              {/* API Key */}
              <div>
                <label className="block text-sm font-medium mb-1">{t('apiKey')}</label>
                <input
                  type="password"
                  value={formData.api_key}
                  onChange={(e) => setFormData((prev) => ({ ...prev, api_key: e.target.value }))}
                  placeholder={editingProvider.config?.has_api_key ? '••••••••' : 'Enter API key'}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {editingProvider.config?.has_api_key
                    ? 'Leave empty to keep existing key'
                    : 'Required to enable this provider'}
                </p>
              </div>

              {/* Base URL */}
              <div>
                <label className="block text-sm font-medium mb-1">{t('baseUrl')}</label>
                <input
                  type="text"
                  value={formData.base_url}
                  onChange={(e) => setFormData((prev) => ({ ...prev, base_url: e.target.value }))}
                  placeholder="https://api.example.com/v1"
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Priority */}
              <div>
                <label className="block text-sm font-medium mb-1">{t('priority')} (0-100)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={formData.priority}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, priority: parseInt(e.target.value) || 0 }))
                  }
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Weight */}
              <div>
                <label className="block text-sm font-medium mb-1">{t('weight')} (1-100)</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={formData.weight}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, weight: parseInt(e.target.value) || 1 }))
                  }
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Enabled toggle */}
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">{t('status')}</label>
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
                <span className="text-sm ml-2">
                  {formData.enabled ? t('active') : t('inactive')}
                </span>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-border flex justify-end gap-3">
              <button
                onClick={handleCancel}
                disabled={saving}
                className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-accent transition-colors"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-2"
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
