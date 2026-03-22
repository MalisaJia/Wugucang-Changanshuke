"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/navigation";
import { Check, Plus, Minus } from "lucide-react";

interface PlanData {
  name: string;
  price: string;
  period: string;
  badge?: string;
  description: string;
  features: string[];
  cta: string;
}

interface FAQItem {
  question: string;
  answer: string;
}

export default function PricingPage() {
  const t = useTranslations("pricing");
  const [openFAQ, setOpenFAQ] = useState<number | null>(null);

  const individualPlans: { key: string; highlighted?: boolean }[] = [
    { key: "free" },
    { key: "proMonthly", highlighted: true },
    { key: "proYearly" },
  ];

  const enterprisePlans: { key: string; highlighted?: boolean }[] = [
    { key: "enterprise", highlighted: true },
    { key: "custom" },
  ];

  const faqItems = t.raw("faq.items") as FAQItem[];

  const getPeriodLabel = (period: string) => {
    switch (period) {
      case "month":
        return t("perMonth");
      case "year":
        return t("perYear");
      case "seat":
        return t("perSeat");
      default:
        return "";
    }
  };

  const getBadgeLabel = (badge: string) => {
    switch (badge) {
      case "recommended":
        return t("recommended");
      case "save":
        return t("save");
      default:
        return "";
    }
  };

  const renderPlanCard = (
    planKey: string,
    highlighted: boolean = false,
    isCustomPlan: boolean = false
  ) => {
    // Access each field individually for reliability with next-intl
    const plan: PlanData = {
      name: t(`${planKey}.name`),
      price: t(`${planKey}.price`),
      period: t(`${planKey}.period`),
      badge: t.has(`${planKey}.badge`) ? t(`${planKey}.badge`) : undefined,
      description: t(`${planKey}.description`),
      features: (t.raw(`${planKey}.features`) as string[]) || [],
      cta: t(`${planKey}.cta`),
    };
    const isContactUs = plan.period === "custom";

    return (
      <div
        className={`relative rounded-xl border p-6 flex flex-col h-full ${
          highlighted
            ? "border-green-500/50 bg-white shadow-md dark:border-green-500/30 dark:bg-card dark:shadow-none"
            : "border-gray-200 bg-white shadow-sm dark:border-green-500/30 dark:bg-card dark:shadow-none"
        } transition-all duration-300`}
      >
        {/* Plan Name & Badge */}
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-xl font-semibold text-foreground">{plan.name}</h3>
          {plan.badge && (
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                plan.badge === "recommended"
                  ? "bg-green-500/20 text-green-400"
                  : "bg-green-500/20 text-green-400"
              }`}
            >
              {getBadgeLabel(plan.badge)}
            </span>
          )}
        </div>

        {/* Price */}
        <div className="mb-4">
          {isContactUs ? (
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-bold text-foreground">
                {plan.price}
              </span>
            </div>
          ) : (
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-bold text-foreground">
                ¥{plan.price}
              </span>
              <span className="text-muted-foreground text-sm">
                {getPeriodLabel(plan.period)}
              </span>
            </div>
          )}
        </div>

        {/* Description */}
        <p className="text-sm text-muted-foreground mb-6">{plan.description}</p>

        {/* Features */}
        <ul className="space-y-3 mb-8 flex-1">
          {plan.features.map((feature: string, idx: number) => (
            <li key={idx} className="flex items-start gap-3 text-sm">
              <Check className="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
              <span className="text-foreground">{feature}</span>
            </li>
          ))}
        </ul>

        {/* CTA Button */}
        {isCustomPlan ? (
          <Link
            href="/contact"
            className="inline-flex items-center justify-center rounded-full px-6 h-11 text-sm font-medium transition-colors bg-green-500 hover:bg-green-600 text-white w-full"
          >
            {plan.cta}
          </Link>
        ) : highlighted ? (
          <Link
            href="/register"
            className="inline-flex items-center justify-center rounded-full px-6 h-11 text-sm font-medium transition-colors bg-green-500 hover:bg-green-600 text-white w-full"
          >
            {plan.cta}
          </Link>
        ) : (
          <Link
            href="/register"
            className="inline-flex items-center justify-center rounded-full px-6 h-11 text-sm font-medium transition-colors bg-muted hover:bg-muted/80 text-foreground w-full"
          >
            {plan.cta}
          </Link>
        )}
      </div>
    );
  };

  const toggleFAQ = (index: number) => {
    setOpenFAQ(openFAQ === index ? null : index);
  };

  return (
    <div className="min-h-screen">
      {/* Pricing Cards Section */}
      <div className="bg-white dark:bg-[#0a0a0f] py-20 md:py-28">
        <div className="container">
          {/* Header */}
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-gray-900 dark:text-white">
              {t("title")}
            </h1>
            <p className="mt-4 text-lg text-gray-500 dark:text-gray-400">
              {t("subtitle")}
            </p>
          </div>

          {/* For Individuals Section */}
          <div className="max-w-6xl mx-auto mb-20">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-8">
              {t("forIndividuals")}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {individualPlans.map((plan) => (
                <div key={plan.key}>
                  {renderPlanCard(plan.key, plan.highlighted)}
                </div>
              ))}
            </div>
          </div>

          {/* For Enterprise Section */}
          <div className="max-w-4xl mx-auto">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-8">
              {t("forEnterprise")}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {enterprisePlans.map((plan) => (
                <div key={plan.key}>
                  {renderPlanCard(
                    plan.key,
                    plan.highlighted,
                    plan.key === "custom"
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Note */}
          <div className="text-center mt-12">
            <p className="text-sm text-gray-400 dark:text-gray-500">
              {t("note")}
            </p>
          </div>
        </div>
      </div>

      {/* Light Section - FAQ */}
      <div className="bg-gray-50 dark:bg-muted/30 py-20 md:py-28">
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
                            ? "bg-green-500 border-green-500 text-white"
                            : "border-green-500 text-green-500 group-hover:bg-green-500/10"
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
