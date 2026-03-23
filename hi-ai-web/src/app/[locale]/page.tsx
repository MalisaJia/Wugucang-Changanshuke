import { setRequestLocale } from "next-intl/server";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { HeroSection } from "@/components/landing/hero-section";
import { StatsSection } from "@/components/landing/stats-section";
import { FeaturesSection } from "@/components/landing/features-section";
import { ProvidersSection } from "@/components/landing/providers-section";
import { CTASection } from "@/components/landing/cta-section";
import { ParticleBackground } from "@/components/landing/particle-background";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="relative flex min-h-screen flex-col">
      <ParticleBackground />
      <SiteHeader />
      <main className="flex-1 relative z-10">
        <HeroSection />
        <StatsSection />
        <FeaturesSection />
        <ProvidersSection />
        <CTASection />
      </main>
      <SiteFooter />
    </div>
  );
}
