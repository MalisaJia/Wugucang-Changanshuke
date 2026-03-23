"use client";

import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/lib/i18n/navigation";
import { useState } from "react";
import { useAuthStore } from "@/lib/stores/auth-store";
import { ShieldCheck } from "lucide-react";

export default function AdminLoginClient() {
  const t = useTranslations("login");
  const tAdmin = useTranslations("adminLogin");
  const tAuth = useTranslations("auth");
  const router = useRouter();
  const { login, logout, isLoading, error, clearError } = useAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [permissionError, setPermissionError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setPermissionError(null);

    try {
      await login(email, password);
      
      // Check user role from auth store
      const { user } = useAuthStore.getState();
      
      if (user?.role === "owner" || user?.role === "admin") {
        // User has admin privileges, redirect to admin dashboard
        router.push("/admin/dashboard");
      } else {
        // User doesn't have admin privileges
        setPermissionError(tAdmin("noPermission"));
        logout();
      }
    } catch {
      // Error is already set in the store
    }
  };

  return (
    <div className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-card p-8 shadow-sm">
      {/* Admin Badge */}
      <div className="flex justify-center mb-4">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-medium">
          <ShieldCheck className="w-3.5 h-3.5" />
          {tAdmin("badge")}
        </div>
      </div>

      {/* Header */}
      <div className="text-center mb-8">
        <div className="flex justify-center mb-4">
          <div className="w-14 h-14 rounded-xl bg-amber-500 flex items-center justify-center">
            <ShieldCheck className="w-7 h-7 text-white" />
          </div>
        </div>
        <h1 className="text-2xl font-bold">{tAdmin("title")}</h1>
        <p className="text-sm text-muted-foreground mt-2">{tAdmin("subtitle")}</p>
      </div>

      {/* Error Messages */}
      {(error || permissionError) && (
        <div className="mb-4 p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-sm">
          {permissionError || error}
        </div>
      )}

      {/* Login Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-medium">
            {t("email")}
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("emailPlaceholder")}
            required
            disabled={isLoading}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="text-sm font-medium">
              {t("password")}
            </label>
            <Link
              href="/"
              className="text-sm text-amber-600 dark:text-amber-400 hover:text-amber-500 dark:hover:text-amber-300 transition-colors"
            >
              {t("forgotPassword")}
            </Link>
          </div>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t("passwordPlaceholder")}
            required
            disabled={isLoading}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="inline-flex w-full items-center justify-center rounded-md bg-amber-500 hover:bg-amber-600 h-10 px-4 text-sm font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? tAuth("loading") : t("submit")}
        </button>
      </form>

      {/* Link to User Login */}
      <p className="mt-6 text-center text-sm text-muted-foreground">
        {tAdmin("notAdmin")}{" "}
        <Link
          href="/login"
          className="text-amber-600 dark:text-amber-400 hover:text-amber-500 dark:hover:text-amber-300 font-medium transition-colors"
        >
          {tAdmin("loginAsUser")}
        </Link>
      </p>
    </div>
  );
}
