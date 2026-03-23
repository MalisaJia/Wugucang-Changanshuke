import { setRequestLocale } from "next-intl/server";
import RegisterClient from "./client";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function RegisterPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <RegisterClient />;
}
