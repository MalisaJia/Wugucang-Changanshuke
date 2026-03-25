'use client';

import { useEffect, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import {
  Loader2,
  RefreshCw,
  Router,
  AlertCircle,
  Settings2,
  Repeat,
  Activity,
  GitBranch,
} from 'lucide-react';
import {
  getRoutingConfig,
  getBreakerStatus,
  getRoutingRules,
  type RoutingConfig,
  type BreakerStatus,
  type RoutingRulesResponse,
} from '@/lib/api/admin';

export default function RoutingClient() {
  const t = useTranslations('admin');
  const [routingConfig, setRoutingConfig] = useState<RoutingConfig | null>(null);
  const [breakers, setBreakers] = useState<BreakerStatus[]>([]);
  const [rules, setRules] = useState<RoutingRulesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [breakersLoading, setBreakersLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchConfig = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [configData, breakersData, rulesData] = await Promise.all([
        getRoutingConfig(),
        getBreakerStatus(),
        getRoutingRules(),
      ]);
      setRoutingConfig(configData);
      setBreakers(breakersData.breakers || []);
      setRules(rulesData);
    } catch (err) {
      setError(t('error'));
      console.error('Failed to fetch routing config:', err);
    } finally {
      setLoading(false);
    }
  }, [t]);

  const refreshBreakers = useCallback(async () => {
    try {
      setBreakersLoading(true);
      const breakersData = await getBreakerStatus();
      setBreakers(breakersData.breakers || []);
    } catch (err) {
      console.error('Failed to refresh breakers:', err);
    } finally {
      setBreakersLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const getModeLabel = (mode: string) => {
    const labels: Record<string, string> = {
      single: t('routing.modeSingle'),
      fallback: t('routing.modeFallback'),
      loadbalance: t('routing.modeLoadBalance'),
      conditional: t('routing.modeConditional'),
    };
    return labels[mode] || mode;
  };

  const getModeColor = (mode: string) => {
    const colors: Record<string, string> = {
      single: 'bg-blue-500/10 text-blue-500',
      fallback: 'bg-amber-500/10 text-amber-500',
      loadbalance: 'bg-green-500/10 text-green-500',
      conditional: 'bg-purple-500/10 text-purple-500',
    };
    return colors[mode] || 'bg-muted text-muted-foreground';
  };

  const getBreakerStateColor = (state: string) => {
    switch (state.toLowerCase()) {
      case 'closed':
        return 'bg-green-500/10 text-green-500';
      case 'half-open':
        return 'bg-yellow-500/10 text-yellow-500';
      case 'open':
        return 'bg-red-500/10 text-red-500';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getBreakerStateLabel = (state: string) => {
    const labels: Record<string, string> = {
      closed: t('routing.stateClosed'),
      'half-open': t('routing.stateHalfOpen'),
      open: t('routing.stateOpen'),
    };
    return labels[state.toLowerCase()] || state;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">{t('routing.title')}</h2>
        <button
          onClick={fetchConfig}
          disabled={loading}
          className="p-2 hover:bg-muted rounded-lg transition-colors disabled:opacity-50"
          title={t('routing.refresh')}
        >
          <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

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
          {/* Routing Configuration Card */}
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-center gap-3 mb-4">
              <Router className="h-5 w-5 text-amber-500" />
              <h3 className="text-lg font-semibold">{t('routing.routingConfig')}</h3>
            </div>
            {routingConfig && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{t('routing.currentMode')}</span>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${getModeColor(routingConfig.routing.mode)}`}>
                    {getModeLabel(routingConfig.routing.mode)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{t('routing.healthCheckWindow')}</span>
                  <span className="text-sm font-mono">{routingConfig.routing.health_check.window}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{t('routing.errorThreshold')}</span>
                  <span className="text-sm font-mono">{routingConfig.routing.health_check.error_threshold}</span>
                </div>
                <p className="text-xs text-muted-foreground pt-2 border-t border-border">
                  {t('routing.readOnlyNote')}
                </p>
              </div>
            )}
          </div>

          {/* Retry Configuration Card */}
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-center gap-3 mb-4">
              <Repeat className="h-5 w-5 text-amber-500" />
              <h3 className="text-lg font-semibold">{t('routing.retryConfig')}</h3>
            </div>
            {routingConfig && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <span className="text-sm text-muted-foreground">{t('routing.maxAttempts')}</span>
                  <span className="text-sm font-mono font-semibold">{routingConfig.retry.max_attempts}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <span className="text-sm text-muted-foreground">{t('routing.initialBackoff')}</span>
                  <span className="text-sm font-mono font-semibold">{routingConfig.retry.initial_backoff}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <span className="text-sm text-muted-foreground">{t('routing.maxBackoff')}</span>
                  <span className="text-sm font-mono font-semibold">{routingConfig.retry.max_backoff}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <span className="text-sm text-muted-foreground">{t('routing.backoffMultiplier')}</span>
                  <span className="text-sm font-mono font-semibold">{routingConfig.retry.backoff_multiplier}x</span>
                </div>
              </div>
            )}
          </div>

          {/* Circuit Breakers Card */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Activity className="h-5 w-5 text-amber-500" />
                <h3 className="text-lg font-semibold">{t('routing.circuitBreakers')}</h3>
              </div>
              <button
                onClick={refreshBreakers}
                disabled={breakersLoading}
                className="p-2 hover:bg-muted rounded-lg transition-colors disabled:opacity-50"
                title={t('routing.refresh')}
              >
                <RefreshCw className={`h-4 w-4 ${breakersLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
            {routingConfig && (
              <div className="p-4 bg-muted/30 border-b border-border">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">{t('routing.failureThreshold')}:</span>
                    <span className="ml-2 font-mono">{routingConfig.circuit_breaker.failure_threshold}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t('routing.successThreshold')}:</span>
                    <span className="ml-2 font-mono">{routingConfig.circuit_breaker.success_threshold}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t('routing.timeout')}:</span>
                    <span className="ml-2 font-mono">{routingConfig.circuit_breaker.timeout}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t('routing.window')}:</span>
                    <span className="ml-2 font-mono">{routingConfig.circuit_breaker.window}</span>
                  </div>
                </div>
              </div>
            )}
            {breakers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <Settings2 className="h-12 w-12 text-muted-foreground/50" />
                <p className="text-muted-foreground">{t('routing.noBreakers')}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">
                        {t('routing.breakerKey')}
                      </th>
                      <th className="text-center px-4 py-3 text-sm font-medium text-muted-foreground">
                        {t('routing.breakerState')}
                      </th>
                      <th className="text-center px-4 py-3 text-sm font-medium text-muted-foreground">
                        {t('routing.consecutiveFailures')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {breakers.map((breaker) => (
                      <tr key={breaker.key} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3">
                          <span className="font-mono text-sm">{breaker.key}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getBreakerStateColor(breaker.state)}`}>
                            {getBreakerStateLabel(breaker.state)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`font-mono text-sm ${breaker.failures > 0 ? 'text-red-500' : ''}`}>
                            {breaker.failures}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Conditional Routing Rules Card */}
          {rules && rules.mode === 'conditional' && (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="p-4 border-b border-border">
                <div className="flex items-center gap-3">
                  <GitBranch className="h-5 w-5 text-amber-500" />
                  <h3 className="text-lg font-semibold">{t('routing.conditionalRules')}</h3>
                </div>
              </div>
              {rules.rules.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2">
                  <GitBranch className="h-12 w-12 text-muted-foreground/50" />
                  <p className="text-muted-foreground">{t('routing.noRules')}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">
                          {t('routing.rulePriority')}
                        </th>
                        <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">
                          {t('routing.ruleConditions')}
                        </th>
                        <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">
                          {t('routing.ruleTargets')}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {rules.rules.map((rule, index) => (
                        <tr key={index} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3">
                            <span className="font-mono text-sm">{rule.priority}</span>
                          </td>
                          <td className="px-4 py-3">
                            <code className="text-xs bg-muted px-2 py-1 rounded">
                              {JSON.stringify(rule.conditions)}
                            </code>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-1">
                              {rule.targets.map((target, i) => (
                                <span key={i} className="text-xs font-mono">
                                  {target.provider_id}:{target.model_id}
                                </span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
