"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/navigation";
import {
  Check,
  Plus,
  Minus,
  CreditCard,
  Coins,
  Sparkles,
  Zap,
  ArrowRight,
} from "lucide-react";

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

interface FAQItem {
  question: string;
  answer: string;
}

interface ModelPrice {
  name: string;
  provider: string;
  inputPrice: string;
  outputPrice: string;
}

// Static recharge packages for display
const rechargePackages = [
  { id: "pkg_50", amount: 50 },
  { id: "pkg_100", amount: 100 },
  { id: "pkg_500", amount: 500 },
  { id: "pkg_1000", amount: 1000 },
  { id: "pkg_5000", amount: 5000 },
  { id: "pkg_10000", amount: 10000 },
];

// Model pricing data (per million tokens)
const modelPrices: ModelPrice[] = [
  { name: "GPT-4o", provider: "OpenAI", inputPrice: "¥15.00", outputPrice: "¥60.00" },
  { name: "GPT-4o-mini", provider: "OpenAI", inputPrice: "¥0.75", outputPrice: "¥3.00" },
  { name: "Claude 3.5 Sonnet", provider: "Anthropic", inputPrice: "¥15.00", outputPrice: "¥75.00" },
  { name: "Claude 3 Haiku", provider: "Anthropic", inputPrice: "¥1.25", outputPrice: "¥6.25" },
  { name: "Gemini 1.5 Pro", provider: "Google", inputPrice: "¥17.50", outputPrice: "¥52.50" },
  { name: "Gemini 1.5 Flash", provider: "Google", inputPrice: "¥0.38", outputPrice: "¥1.50" },
  { name: "Qwen-Plus", provider: "Alibaba", inputPrice: "¥2.00", outputPrice: "¥6.00" },
  { name: "DeepSeek V3", provider: "DeepSeek", inputPrice: "¥1.00", outputPrice: "¥2.00" },
  { name: "Llama 3.1 70B", provider: "Meta", inputPrice: "Free", outputPrice: "Free" },
];

export default function PricingClient() {
  const t = useTranslations("pricing");
  const [selectedPackage, setSelectedPackage] = useState<string>("pkg_100");
  const [selectedMethod, setSelectedMethod] = useState<string>("stripe");
  const [openFAQ, setOpenFAQ] = useState<number | null>(null);

  const faqItems = t.raw("faq.items") as FAQItem[];

  const toggleFAQ = (index: number) => {
    setOpenFAQ(openFAQ === index ? null : index);
  };

  const selectedPkg = rechargePackages.find(p => p.id === selectedPackage);
  const selectedAmount = selectedPkg ? selectedPkg.amount : 0;

  return (
    <div className="min-h-screen">
      {/* Hero Section with Gradient Background */}
      <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-400 py-16 md:py-24">
        {/* Background decorations */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -right-20 -top-20 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-20 -left-20 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
        </div>
        
        <div className="container relative">
          <div className="text-center max-w-3xl mx-auto text-white">
            <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-full px-4 py-2 mb-6">
              <Sparkles className="h-4 w-4" />
              <span className="text-sm font-medium">{t("badge")}</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
              {t("title")}
            </h1>
            <p className="mt-4 text-lg text-white/80">
              {t("subtitle")}
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-white dark:bg-[#0a0a0f] py-16 md:py-20">
        <div className="container">
          {/* Recharge Section */}
          <div className="max-w-6xl mx-auto">
            <div className="grid gap-8 lg:grid-cols-3">
              {/* Left: Package Selection */}
              <div className="lg:col-span-2 space-y-8">
                {/* Packages Grid */}
                <div>
                  <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                    <Coins className="h-5 w-5 text-primary" />
                    {t("selectAmount")}
                  </h2>
                  <div className="grid gap-4 grid-cols-2 sm:grid-cols-3">
                    {rechargePackages.map((pkg) => (
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
                        
                        {/* Coin icon */}
                        <div className="flex justify-center mb-3">
                          <div className={`p-2 rounded-lg ${selectedPackage === pkg.id ? 'bg-primary/20' : 'bg-muted'}`}>
                            <Coins className={`h-5 w-5 ${selectedPackage === pkg.id ? 'text-primary' : 'text-muted-foreground'}`} />
                          </div>
                        </div>
                        
                        {/* Amount */}
                        <p className={`text-2xl font-bold ${selectedPackage === pkg.id ? 'text-primary' : ''}`}>
                          {pkg.amount} ¥
                        </p>
                        
                        {/* Actual pay */}
                        <p className="text-xs text-muted-foreground mt-2">
                          {t("actualPay")} ¥{pkg.amount.toFixed(2)}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Payment Methods */}
                <div>
                  <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-primary" />
                    {t("selectPayment")}
                  </h2>
                  <div className="grid gap-4 sm:grid-cols-3">
                    {/* Credit Card (Stripe) */}
                    <button
                      onClick={() => setSelectedMethod('stripe')}
                      className={`
                        flex items-center gap-3 p-4 rounded-xl border-2 transition-all
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
                        <p className="font-medium">{t("creditCard")}</p>
                      </div>
                      {selectedMethod === 'stripe' && (
                        <Check className="h-5 w-5 text-primary ml-auto" />
                      )}
                    </button>

                    {/* Alipay */}
                    <button
                      onClick={() => setSelectedMethod('alipay')}
                      className={`
                        flex items-center gap-3 p-4 rounded-xl border-2 transition-all
                        ${
                          selectedMethod === 'alipay'
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/50 bg-card'
                        }
                      `}
                    >
                      <div className="p-2 rounded-lg bg-blue-600/10">
                        <AlipayIcon />
                      </div>
                      <div className="text-left">
                        <p className="font-medium">{t("alipay")}</p>
                      </div>
                      {selectedMethod === 'alipay' && (
                        <Check className="h-5 w-5 text-primary ml-auto" />
                      )}
                    </button>

                    {/* WeChat Pay */}
                    <button
                      onClick={() => setSelectedMethod('wechat')}
                      className={`
                        flex items-center gap-3 p-4 rounded-xl border-2 transition-all
                        ${
                          selectedMethod === 'wechat'
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/50 bg-card'
                        }
                      `}
                    >
                      <div className="p-2 rounded-lg bg-green-500/10">
                        <WechatIcon />
                      </div>
                      <div className="text-left">
                        <p className="font-medium">{t("wechat")}</p>
                      </div>
                      {selectedMethod === 'wechat' && (
                        <Check className="h-5 w-5 text-primary ml-auto" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Right: Summary & CTA */}
              <div className="lg:col-span-1">
                <div className="sticky top-4 bg-card border border-border rounded-xl p-6 space-y-6">
                  <h2 className="text-lg font-semibold">{t("orderSummary")}</h2>
                  
                  <div className="space-y-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{t("rechargeAmount")}</span>
                      <span className="font-medium">¥{selectedAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{t("discount")}</span>
                      <span className="font-medium text-green-500">-¥0.00</span>
                    </div>
                    <div className="border-t border-border pt-4">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">{t("actualPay")}</span>
                        <span className="text-2xl font-bold text-primary">¥{selectedAmount.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  {/* CTA Button - Redirect to Login */}
                  <Link
                    href="/login"
                    className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 text-base font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    <Zap className="h-5 w-5" />
                    {t("startNow")}
                  </Link>

                  <p className="text-xs text-center text-muted-foreground">
                    {t("loginToRecharge")}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Model Pricing Section */}
      <div className="bg-gray-50 dark:bg-muted/30 py-16 md:py-20">
        <div className="container">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-foreground mb-4">
                {t("modelPricing.title")}
              </h2>
              <p className="text-muted-foreground">
                {t("modelPricing.subtitle")}
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-left p-4 font-semibold text-foreground rounded-tl-lg">
                      {t("modelPricing.model")}
                    </th>
                    <th className="text-left p-4 font-semibold text-foreground">
                      {t("modelPricing.provider")}
                    </th>
                    <th className="text-right p-4 font-semibold text-foreground">
                      {t("modelPricing.input")}
                    </th>
                    <th className="text-right p-4 font-semibold text-foreground rounded-tr-lg">
                      {t("modelPricing.output")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {modelPrices.map((model, index) => (
                    <tr 
                      key={model.name}
                      className={`border-b border-border ${index % 2 === 0 ? 'bg-card' : 'bg-muted/20'}`}
                    >
                      <td className="p-4">
                        <span className="font-medium text-foreground">{model.name}</span>
                      </td>
                      <td className="p-4 text-muted-foreground">{model.provider}</td>
                      <td className="p-4 text-right">
                        <span className={model.inputPrice === "Free" ? "text-green-500 font-medium" : ""}>
                          {model.inputPrice}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <span className={model.outputPrice === "Free" ? "text-green-500 font-medium" : ""}>
                          {model.outputPrice}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-center text-sm text-muted-foreground mt-6">
              {t("modelPricing.note")}
            </p>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-white dark:bg-[#0a0a0f] py-16 md:py-20">
        <div className="container">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl font-bold text-foreground mb-4">
              {t("cta.title")}
            </h2>
            <p className="text-lg text-muted-foreground mb-8">
              {t("cta.subtitle")}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/register"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-8 py-3 text-base font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                {t("cta.register")}
                <ArrowRight className="h-5 w-5" />
              </Link>
              <Link
                href="/docs"
                className="inline-flex items-center justify-center rounded-lg border border-border px-8 py-3 text-base font-medium text-foreground hover:bg-muted transition-colors"
              >
                {t("cta.docs")}
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="bg-gray-50 dark:bg-muted/30 py-16 md:py-20">
        <div className="container">
          <div className="max-w-5xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-12">
              {/* FAQ Title - Left Side */}
              <div className="lg:col-span-2">
                <h2 className="text-3xl md:text-4xl font-bold text-foreground">
                  {t("faq.title")}
                </h2>
                <p className="mt-4 text-muted-foreground">
                  {t("faq.subtitle")}
                </p>
              </div>

              {/* FAQ Items - Right Side */}
              <div className="lg:col-span-3 space-y-4">
                {faqItems.map((item, index) => (
                  <div
                    key={index}
                    className="border-b border-border pb-4 last:border-b-0"
                  >
                    <button
                      onClick={() => toggleFAQ(index)}
                      className="flex items-center justify-between w-full text-left py-2 group"
                    >
                      <span className="font-medium text-foreground pr-4">
                        {item.question}
                      </span>
                      <span
                        className={`flex items-center justify-center w-8 h-8 rounded-full border-2 transition-colors shrink-0 ${
                          openFAQ === index
                            ? "bg-primary border-primary text-white"
                            : "border-primary text-primary group-hover:bg-primary/10"
                        }`}
                      >
                        {openFAQ === index ? (
                          <Minus className="w-4 h-4" />
                        ) : (
                          <Plus className="w-4 h-4" />
                        )}
                      </span>
                    </button>
                    {openFAQ === index && (
                      <div className="pt-2 pb-2 text-muted-foreground animate-in fade-in slide-in-from-top-2 duration-200">
                        {item.answer}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
