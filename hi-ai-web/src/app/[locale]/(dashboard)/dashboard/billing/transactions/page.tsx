import { setRequestLocale } from "next-intl/server";
import TransactionsClient from "./client";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function TransactionsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <TransactionsClient />;
}
