import { setRequestLocale } from "next-intl/server";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { ParticleBackground } from "@/components/landing/particle-background";

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function MarketingLayout({ children, params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="relative flex min-h-screen flex-col">
      <ParticleBackground />
      <SiteHeader />
      <main className="flex-1 relative z-10">{children}</main>
      <SiteFooter />
    </div>
  );
}
