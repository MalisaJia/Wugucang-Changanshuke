'use client';

import { useEffect, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import {
  Loader2,
  Shield,
  Check,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import {
  getGuardrailConfig,
  updateGuardrailConfig,
  type PIIRule,
  type GuardrailConfig,
} from '@/lib/api/admin';

type GuardrailMode = 'block' | 'mask' | 'off';

export default function SecurityClient() {
  const t = useTranslations('admin');
  const [config, setConfig] = useState<GuardrailConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Local state for editable config
  const [mode, setMode] = useState<GuardrailMode>('off');
  const [rules, setRules] = useState<PIIRule[]>([]);

  const fetchConfig = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getGuardrailConfig();
      setConfig(data);
      setMode(data.mode);
      setRules(data.rules);
    } catch (err) {
      setError(t('error'));
      console.error('Failed to fetch guardrail config:', err);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const handleModeChange = (newMode: GuardrailMode) => {
    setMode(newMode);
  };

  const handleRuleToggle = (ruleName: string) => {
    setRules((prev) =>
      prev.map((rule) =>
        rule.name === ruleName ? { ...rule, enabled: !rule.enabled } : rule
      )
    );
  };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);

    try {
      await updateGuardrailConfig({ mode, rules });
      setSuccessMessage(t('success'));
      setConfig({ mode, rules });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('error'));
    } finally {
      setSaving(false);
    }
  };

  const getModeButtonClass = (buttonMode: GuardrailMode) => {
    const isActive = mode === buttonMode;
    const baseClass = 'px-4 py-2 text-sm font-medium rounded-lg transition-colors';
    
    if (isActive) {
      switch (buttonMode) {
        case 'block':
          return `${baseClass} bg-red-500 text-white`;
        case 'mask':
          return `${baseClass} bg-amber-500 text-white`;
        case 'off':
          return `${baseClass} bg-gray-500 text-white`;
      }
    }
    return `${baseClass} bg-muted hover:bg-muted/80`;
  };

  const getRuleDisplayName = (name: string) => {
    const names: Record<string, string> = {
      email: t('security.ruleEmail'),
      phone: t('security.rulePhone'),
      ssn_id: t('security.ruleSsnId'),
      credit_card: t('security.ruleCreditCard'),
      ip_address: t('security.ruleIpAddress'),
    };
    return names[name] || name;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">{t('security.title')}</h2>
        <button
          onClick={fetchConfig}
          disabled={loading}
          className="p-2 hover:bg-muted rounded-lg transition-colors disabled:opacity-50"
          title={t('security.refresh')}
        >
          <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
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
      ) : (
        <>
          {/* Mode Selection Card */}
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-center gap-3 mb-4">
              <Shield className="h-5 w-5 text-amber-500" />
              <h3 className="text-lg font-semibold">{t('security.guardrailMode')}</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              {t('security.guardrailModeDesc')}
            </p>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => handleModeChange('block')}
                className={getModeButtonClass('block')}
              >
                {t('security.modeBlock')}
              </button>
              <button
                onClick={() => handleModeChange('mask')}
                className={getModeButtonClass('mask')}
              >
                {t('security.modeMask')}
              </button>
              <button
                onClick={() => handleModeChange('off')}
                className={getModeButtonClass('off')}
              >
                {t('security.modeOff')}
              </button>
            </div>
            <p className="text-sm text-muted-foreground mt-3">
              {mode === 'block' && t('security.modeBlockDesc')}
              {mode === 'mask' && t('security.modeMaskDesc')}
              {mode === 'off' && t('security.modeOffDesc')}
            </p>
          </div>

          {/* PII Rules Table */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="p-4 border-b border-border">
              <h3 className="text-lg font-semibold">{t('security.piiRules')}</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {t('security.piiRulesDesc')}
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">
                      {t('security.ruleName')}
                    </th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">
                      {t('security.rulePattern')}
                    </th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">
                      {t('security.ruleReplacement')}
                    </th>
                    <th className="text-center px-4 py-3 text-sm font-medium text-muted-foreground">
                      {t('security.ruleEnabled')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rules.map((rule) => (
                    <tr key={rule.name} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium">{getRuleDisplayName(rule.name)}</p>
                          <p className="text-xs text-muted-foreground">{rule.description}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <code className="text-xs bg-muted px-2 py-1 rounded font-mono break-all max-w-[300px] block">
                          {rule.pattern.length > 60 ? rule.pattern.slice(0, 60) + '...' : rule.pattern}
                        </code>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-mono text-amber-500">
                          {rule.replacement}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleRuleToggle(rule.name)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            rule.enabled ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              rule.enabled ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('save')}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
