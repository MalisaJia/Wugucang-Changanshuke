'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/lib/i18n/navigation';
import {
  getBalance,
  getPackages,
  createRecharge,
  type Balance,
  type RechargePackage,
} from '@/lib/api/billing';
import { getUsageSummary, type UsageSummary } from '@/lib/api/analytics';
import { ApiClientError } from '@/lib/api/client';
import {
  Wallet,
  CreditCard,
  AlertTriangle,
  Check,
  ArrowRight,
  Loader2,
  TrendingDown,
  Activity,
  Coins,
} from 'lucide-react';

// Payment method icons as SVG components
const AlipayIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
    <path d="M21.422 15.358c-3.27-1.345-5.685-2.467-7.238-3.366a.5.5 0 0 0-.658.18c-.768 1.17-2.014 1.828-3.526 1.828-2.206 0-4-1.794-4-4s1.794-4 4-4c1.512 0 2.758.658 3.526 1.828a.5.5 0 0 0 .658.18c1.553-.899 3.968-2.021 7.238-3.366A.5.5 0 0 0 21.75 4c0-2.206-1.794-4-4-4H6.25C4.044 0 2.25 1.794 2.25 4v16c0 2.206 1.794 4 4 4h11.5c2.206 0 4-1.794 4-4a.5.5 0 0 0-.328-.642z"/>
  </svg>
);

const WechatIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
    <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178A1.17 1.17 0 0 1 4.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178 1.17 1.17 0 0 1-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.622-.12 2.361-.336a.722.722 0 0 1 .598.082l1.584.926a.272.272 0 0 0 .14.047c.134 0 .24-.111.24-.247 0-.06-.023-.12-.038-.177l-.327-1.233a.582.582 0 0 1-.023-.156.49.49 0 0 1 .201-.398C23.024 18.48 24 16.82 24 14.98c0-3.21-2.931-5.837-6.656-6.088l-.406-.035zM14.401 14.54a.96.96 0 0 1 .96.967.96.96 0 0 1-.96.966.96.96 0 0 1-.96-.966.96.96 0 0 1 .96-.967zm4.79 0a.96.96 0 0 1 .96.967.96.96 0 0 1-.96.966.96.96 0 0 1-.96-.966.96.96 0 0 1 .96-.967z"/>
  </svg>
);

type PaymentMethod = 'stripe' | 'alipay' | 'wechat';

// 金额格式化工具函数：分 → 元
function formatCurrency(cents: number): string {
  return `¥${(cents / 100).toFixed(2)}`;
}

export default function BillingClient() {
  const t = useTranslations('billing');
  const [balance, setBalance] = useState<Balance | null>(null);
  const [packages, setPackages] = useState<RechargePackage[]>([]);
  const [usageSummary, setUsageSummary] = useState<UsageSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selection state
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('stripe');

  // Processing state
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [balanceData, packagesData, usageData] = await Promise.all([
        getBalance(),
        getPackages(),
        getUsageSummary(30).catch(() => null),
      ]);
      setBalance(balanceData);
      setPackages(packagesData);
      setUsageSummary(usageData);
      // Auto-select first package
      if (packagesData.length > 0) {
        setSelectedPackage(packagesData[0].id);
      }
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : 'Failed to load billing data';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleRecharge = async () => {
    if (!selectedPackage || selectedMethod !== 'stripe') return;

    try {
      setProcessing(true);
      setError(null);
      const response = await createRecharge(selectedPackage, selectedMethod);
      if (response.checkout_url) {
        window.location.href = response.checkout_url;
      }
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : 'Failed to create recharge order';
      setError(message);
      setProcessing(false);
    }
  };

  // 低余额判断：余额小于 ¥10.00（1000分）
  const isLowBalance = balance && balance.amount_balance < 1000;

  // 获取选中套餐的金额
  const selectedPkg = packages.find(p => p.id === selectedPackage);
  const selectedAmount = selectedPkg ? selectedPkg.amount_cents : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground mt-1">{t('subtitle')}</p>
        </div>
        <Link
          href="/dashboard/billing/transactions"
          className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
        >
          {t('viewTransactions')}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {/* Error message */}
      {error && (
        <div className="p-4 rounded-lg bg-destructive/10 text-destructive border border-destructive/20">
          {error}
        </div>
      )}

      {/* Account Stats Card - 熵流风格蓝色渐变背景 */}
      {balance && (
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-400 p-6 text-white shadow-lg">
          {/* 背景装饰 */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
            <div className="absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
          </div>
          
          <div className="relative">
            <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              {t('accountStats')}
            </h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {/* 当前余额 */}
              <div className="flex flex-col">
                <div className="flex items-center gap-2 text-white/80 text-sm mb-2">
                  <Coins className="h-4 w-4" />
                  {t('balance')}
                </div>
                <p className="text-3xl font-bold">
                  {formatCurrency(balance.amount_balance)}
                </p>
              </div>
              
              {/* 历史消耗 */}
              <div className="flex flex-col">
                <div className="flex items-center gap-2 text-white/80 text-sm mb-2">
                  <TrendingDown className="h-4 w-4" />
                  {t('totalConsumed')}
                </div>
                <p className="text-3xl font-bold">
                  {formatCurrency(balance.total_consumed)}
                </p>
              </div>
              
              {/* 请求次数 */}
              <div className="flex flex-col">
                <div className="flex items-center gap-2 text-white/80 text-sm mb-2">
                  <Activity className="h-4 w-4" />
                  {t('requestCount')}
                </div>
                <p className="text-3xl font-bold">
                  {usageSummary ? usageSummary.month_requests.toLocaleString() : '—'}
                </p>
              </div>
            </div>
          </div>

          {/* Low balance warning */}
          {isLowBalance && (
            <div className="relative mt-4 p-3 rounded-lg bg-white/20 backdrop-blur-sm flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <p className="text-sm">{t('lowBalance')}</p>
            </div>
          )}
        </div>
      )}

      {/* Recharge Section */}
      <div className="grid gap-8 lg:grid-cols-3">
        {/* Left: Package Selection */}
        <div className="lg:col-span-2 space-y-6">
          {/* Packages Grid */}
          <div>
            <h2 className="text-lg font-semibold mb-4">{t('selectAmount')}</h2>
            <div className="grid gap-4 grid-cols-2 sm:grid-cols-3">
              {packages.map((pkg) => (
                <button
                  key={pkg.id}
                  onClick={() => setSelectedPackage(pkg.id)}
                  className={`
                    relative p-5 rounded-xl border-2 text-center transition-all
                    ${
                      selectedPackage === pkg.id
                        ? 'border-primary bg-primary/5 shadow-md'
                        : 'border-border hover:border-primary/50 bg-card'
                    }
                  `}
                >
                  {selectedPackage === pkg.id && (
                    <div className="absolute top-2 right-2">
                      <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                        <Check className="h-3 w-3 text-primary-foreground" />
                      </div>
                    </div>
                  )}
                  
                  {/* 硬币图标 */}
                  <div className="flex justify-center mb-3">
                    <div className={`p-2 rounded-lg ${selectedPackage === pkg.id ? 'bg-primary/20' : 'bg-muted'}`}>
                      <Coins className={`h-5 w-5 ${selectedPackage === pkg.id ? 'text-primary' : 'text-muted-foreground'}`} />
                    </div>
                  </div>
                  
                  {/* 金额 */}
                  <p className={`text-2xl font-bold ${selectedPackage === pkg.id ? 'text-primary' : ''}`}>
                    {(pkg.amount_cents / 100).toFixed(0)} ¥
                  </p>
                  
                  {/* 实付金额 */}
                  <p className="text-xs text-muted-foreground mt-2">
                    {t('actualPay')} {formatCurrency(pkg.amount_cents)}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Payment Methods */}
          <div>
            <h2 className="text-lg font-semibold mb-4">{t('selectPayment')}</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              {/* Credit Card (Stripe) */}
              <button
                onClick={() => setSelectedMethod('stripe')}
                className={`
                  flex items-center gap-3 p-4 rounded-lg border-2 transition-all
                  ${
                    selectedMethod === 'stripe'
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50 bg-card'
                  }
                `}
              >
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <CreditCard className="h-5 w-5 text-blue-500" />
                </div>
                <div className="text-left">
                  <p className="font-medium">{t('creditCard')}</p>
                </div>
                {selectedMethod === 'stripe' && (
                  <Check className="h-5 w-5 text-primary ml-auto" />
                )}
              </button>

              {/* Alipay - Disabled */}
              <div
                className="flex items-center gap-3 p-4 rounded-lg border-2 border-border bg-card opacity-50 cursor-not-allowed"
              >
                <div className="p-2 rounded-lg bg-blue-600/10">
                  <AlipayIcon />
                </div>
                <div className="text-left">
                  <p className="font-medium">{t('alipay')}</p>
                  <p className="text-xs text-muted-foreground">{t('comingSoon')}</p>
                </div>
              </div>

              {/* WeChat Pay - Disabled */}
              <div
                className="flex items-center gap-3 p-4 rounded-lg border-2 border-border bg-card opacity-50 cursor-not-allowed"
              >
                <div className="p-2 rounded-lg bg-green-500/10">
                  <WechatIcon />
                </div>
                <div className="text-left">
                  <p className="font-medium">{t('wechat')}</p>
                  <p className="text-xs text-muted-foreground">{t('comingSoon')}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Summary & Checkout */}
        <div className="lg:col-span-1">
          <div className="sticky top-4 bg-card border border-border rounded-xl p-6 space-y-6">
            <h2 className="text-lg font-semibold">{t('orderSummary')}</h2>
            
            <div className="space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t('rechargeAmount')}</span>
                <span className="font-medium">{formatCurrency(selectedAmount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t('discount')}</span>
                <span className="font-medium text-green-500">-¥0.00</span>
              </div>
              <div className="border-t border-border pt-4">
                <div className="flex justify-between items-center">
                  <span className="font-medium">{t('actualPay')}</span>
                  <span className="text-2xl font-bold text-primary">{formatCurrency(selectedAmount)}</span>
                </div>
              </div>
            </div>

            {/* Recharge Button */}
            <button
              onClick={handleRecharge}
              disabled={!selectedPackage || selectedMethod !== 'stripe' || processing}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 text-base font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {processing ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  {t('processing')}
                </>
              ) : (
                <>
                  <CreditCard className="h-5 w-5" />
                  {t('rechargeNow')}
                </>
              )}
            </button>

            <p className="text-xs text-center text-muted-foreground">
              {t('paymentSecure')}
            </p>
          </div>
        </div>
      </div>

      {/* Processing overlay */}
      {processing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-card p-8 rounded-lg border border-border text-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
            <p className="text-lg font-medium">{t('redirecting')}</p>
          </div>
        </div>
      )}
    </div>
  );
}
