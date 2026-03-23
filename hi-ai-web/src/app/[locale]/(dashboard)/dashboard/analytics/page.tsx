import { setRequestLocale } from "next-intl/server";
import AnalyticsClient from "./client";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function AnalyticsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <AnalyticsClient />;
}
