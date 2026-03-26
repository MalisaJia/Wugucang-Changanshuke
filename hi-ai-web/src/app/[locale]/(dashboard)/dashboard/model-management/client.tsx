'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter, useParams } from 'next/navigation';
import {
  Cpu,
  RefreshCw,
  Edit,
  Eye,
  EyeOff,
  Search,
  Check,
  X,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { useAuthStore } from '@/lib/stores/auth-store';
import {
  getAdminModels,
  updateModel,
  toggleModelVisibility,
  syncModels,
  type ModelConfig,
  type UpdateModelData,
} from '@/lib/api/models';

type FilterTab = 'all' | 'online' | 'hidden';

interface EditFormData {
  display_name: string;
  description: string;
  priority: number;
  tags: string;
  price_input: number;
  price_output: number;
  max_context: number;
  visible: boolean;
}

export default function ModelManagementPage() {
  const t = useTranslations('model-management');
  const { user } = useAuthStore();
  const router = useRouter();
  const params = useParams();
  const locale = (params.locale as string) || 'en';

  const [models, setModels] = useState<ModelConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingModel, setEditingModel] = useState<ModelConfig | null>(null);
  const [formData, setFormData] = useState<EditFormData>({
    display_name: '',
    description: '',
    priority: 0,
    tags: '',
    price_input: 0,
    price_output: 0,
    max_context: 0,
    visible: true,
  });
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Admin route guard
  useEffect(() => {
    if (user && !user.is_platform_admin) {
      router.replace(`/${locale}/dashboard`);
    }
  }, [user, locale, router]);

  // If not admin, don't render content
  if (!user || !user.is_platform_admin) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const fetchModels = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getAdminModels();
      setModels(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load models');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const handleSync = async () => {
    if (syncing) return;
    setSyncing(true);
    setError(null);
    try {
      const result = await syncModels();
      setSuccessMessage(t('syncSuccess', { count: result.synced }));
      await fetchModels();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sync models');
    } finally {
      setSyncing(false);
    }
  };

  const handleToggle = async (model: ModelConfig) => {
    if (togglingId) return;
    const newVisible = !model.visible;
    setTogglingId(model.id);
    try {
      await toggleModelVisibility(model.id, newVisible);
      setModels((prev) =>
        prev.map((m) =>
          m.id === model.id ? { ...m, visible: newVisible } : m
        )
      );
      setSuccessMessage(t('updateSuccess'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle model');
    } finally {
      setTogglingId(null);
    }
  };

  const handleEdit = (model: ModelConfig) => {
    setEditingModel(model);
    setFormData({
      display_name: model.display_name || '',
      description: model.description || '',
      priority: model.priority ?? 0,
      tags: model.tags || '',
      price_input: model.price_input ?? 0,
      price_output: model.price_output ?? 0,
      max_context: model.max_context ?? 0,
      visible: model.visible ?? true,
    });
  };

  const handleSave = async () => {
    if (!editingModel || saving) return;
    setSaving(true);
    setError(null);

    try {
      const data: UpdateModelData = {
        display_name: formData.display_name,
        description: formData.description,
        priority: formData.priority,
        tags: formData.tags,
        price_input: formData.price_input,
        price_output: formData.price_output,
        max_context: formData.max_context,
        visible: formData.visible,
      };

      const updatedModel = await updateModel(editingModel.id, data);
      setModels((prev) =>
        prev.map((m) => (m.id === editingModel.id ? updatedModel : m))
      );
      setSuccessMessage(t('updateSuccess'));
      setEditingModel(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save model');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditingModel(null);
    setError(null);
  };

  // Filter models based on tab and search query
  const filteredModels = models.filter((model) => {
    // Filter by tab
    if (filterTab === 'online' && !model.visible) return false;
    if (filterTab === 'hidden' && model.visible) return false;

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        model.model_id.toLowerCase().includes(query) ||
        model.display_name?.toLowerCase().includes(query)
      );
    }
    return true;
  });

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
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Cpu className="h-6 w-6" />
            {t('title')}
          </h1>
          <p className="text-muted-foreground mt-1">{t('description')}</p>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? t('syncing') : t('syncModels')}
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

      {/* Filter tabs and search */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        {/* Tabs */}
        <div className="flex gap-1 bg-accent/50 p-1 rounded-lg">
          <button
            onClick={() => setFilterTab('all')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              filterTab === 'all'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t('all')} ({models.length})
          </button>
          <button
            onClick={() => setFilterTab('online')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              filterTab === 'online'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t('online')} ({models.filter((m) => m.visible).length})
          </button>
          <button
            onClick={() => setFilterTab('hidden')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              filterTab === 'hidden'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t('hidden')} ({models.filter((m) => !m.visible).length})
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="w-full pl-9 pr-4 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm"
          />
        </div>
      </div>

      {/* Models table */}
      {filteredModels.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Cpu className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>{t('noModels')}</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-accent/50 border-b border-border">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">{t('modelId')}</th>
                  <th className="text-left px-4 py-3 font-medium">{t('displayName')}</th>
                  <th className="text-left px-4 py-3 font-medium">{t('provider')}</th>
                  <th className="text-center px-4 py-3 font-medium">{t('priority')}</th>
                  <th className="text-center px-4 py-3 font-medium">{t('visibility')}</th>
                  <th className="text-center px-4 py-3 font-medium">{t('actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredModels.map((model) => (
                  <tr key={model.id} className="hover:bg-accent/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs">{model.model_id}</td>
                    <td className="px-4 py-3">{model.display_name || '-'}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-accent text-accent-foreground">
                        {model.provider_name}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">{model.priority}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-center">
                        <button
                          onClick={() => handleToggle(model)}
                          disabled={togglingId === model.id}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            model.visible
                              ? 'bg-green-500'
                              : 'bg-gray-300 dark:bg-gray-600'
                          } cursor-pointer`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              model.visible ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                          {togglingId === model.id && (
                            <Loader2 className="absolute inset-0 m-auto h-4 w-4 animate-spin text-white" />
                          )}
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-center">
                        <button
                          onClick={() => handleEdit(model)}
                          className="p-2 hover:bg-accent rounded-lg transition-colors"
                          title={t('edit')}
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingModel && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Cpu className="h-5 w-5" />
                {t('edit')} - {editingModel.model_id}
              </h2>
              <button
                onClick={handleCancel}
                className="p-1 hover:bg-accent rounded"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Display Name */}
              <div>
                <label className="block text-sm font-medium mb-1">{t('displayName')}</label>
                <input
                  type="text"
                  value={formData.display_name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, display_name: e.target.value }))}
                  placeholder={editingModel.model_id}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium mb-1">{t('description_field')}</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                />
              </div>

              {/* Priority */}
              <div>
                <label className="block text-sm font-medium mb-1">{t('priority')} (0-999)</label>
                <input
                  type="number"
                  min={0}
                  max={999}
                  value={formData.priority}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, priority: parseInt(e.target.value) || 0 }))
                  }
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Tags */}
              <div>
                <label className="block text-sm font-medium mb-1">{t('tags')}</label>
                <input
                  type="text"
                  value={formData.tags}
                  onChange={(e) => setFormData((prev) => ({ ...prev, tags: e.target.value }))}
                  placeholder="chat, vision, reasoning"
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Price Input */}
              <div>
                <label className="block text-sm font-medium mb-1">{t('priceInput')}</label>
                <input
                  type="number"
                  step="0.0001"
                  min={0}
                  value={formData.price_input}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, price_input: parseFloat(e.target.value) || 0 }))
                  }
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Price Output */}
              <div>
                <label className="block text-sm font-medium mb-1">{t('priceOutput')}</label>
                <input
                  type="number"
                  step="0.0001"
                  min={0}
                  value={formData.price_output}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, price_output: parseFloat(e.target.value) || 0 }))
                  }
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Max Context */}
              <div>
                <label className="block text-sm font-medium mb-1">{t('maxContext')}</label>
                <input
                  type="number"
                  min={0}
                  value={formData.max_context}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, max_context: parseInt(e.target.value) || 0 }))
                  }
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Visible toggle */}
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">{t('visibility')}</label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setFormData((prev) => ({ ...prev, visible: !prev.visible }))}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      formData.visible ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        formData.visible ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                  <span className="text-sm flex items-center gap-1">
                    {formData.visible ? (
                      <>
                        <Eye className="h-4 w-4" />
                        {t('visible')}
                      </>
                    ) : (
                      <>
                        <EyeOff className="h-4 w-4" />
                        {t('hiddenStatus')}
                      </>
                    )}
                  </span>
                </div>
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
