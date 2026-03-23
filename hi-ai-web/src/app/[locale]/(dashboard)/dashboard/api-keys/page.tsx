import { setRequestLocale } from "next-intl/server";
import ApiKeysClient from "./client";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function ApiKeysPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <ApiKeysClient />;
}
