import { setRequestLocale } from "next-intl/server";
import { ModelsPageClient } from "@/components/models/models-page-client";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function ModelsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <ModelsPageClient />;
}
