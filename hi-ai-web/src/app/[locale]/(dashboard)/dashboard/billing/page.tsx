import { setRequestLocale } from "next-intl/server";
import BillingClient from "./client";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function BillingPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <BillingClient />;
}
