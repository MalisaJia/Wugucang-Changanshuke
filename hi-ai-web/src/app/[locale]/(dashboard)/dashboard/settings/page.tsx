import { setRequestLocale } from "next-intl/server";
import SettingsClient from "./client";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function SettingsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <SettingsClient />;
}
