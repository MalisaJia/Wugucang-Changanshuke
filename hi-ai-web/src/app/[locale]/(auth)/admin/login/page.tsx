import { setRequestLocale } from "next-intl/server";
import AdminLoginClient from "./client";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function AdminLoginPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <AdminLoginClient />;
}
