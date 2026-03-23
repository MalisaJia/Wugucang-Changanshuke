import { setRequestLocale } from "next-intl/server";
import LoginClient from "./client";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function LoginPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <LoginClient />;
}
