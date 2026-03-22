"use client";

import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/lib/i18n/navigation";
import { ThemeToggle } from "./theme-toggle";
import { LocaleSwitcher } from "./locale-switcher";
import { useState, useEffect, useRef } from "react";
import { useAuthStore } from "@/lib/stores/auth-store";

export function SiteHeader() {
  const t = useTranslations("nav");
  const tAuth = useTranslations("auth");
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Handle hydration mismatch - read auth state on client only
  const [mounted, setMounted] = useState(false);
  const { user, isAuthenticated, logout } = useAuthStore();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Close user menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    setUserMenuOpen(false);
    router.push("/");
  };

  // Get user initials for avatar
  const getUserInitials = () => {
    if (!user?.display_name) return "U";
    const names = user.display_name.split(" ");
    if (names.length >= 2) {
      return `${names[0][0]}${names[1][0]}`.toUpperCase();
    }
    return user.display_name.substring(0, 2).toUpperCase();
  };

  // Render auth buttons based on authentication state
  const renderAuthButtons = () => {
    // During SSR or before hydration, show nothing to avoid mismatch
    if (!mounted) {
      return (
        <>
          <div className="hidden md:block w-[70px] h-9" />
          <div className="hidden md:block w-[100px] h-9" />
        </>
      );
    }

    if (isAuthenticated && user) {
      return (
        <>
          <Link
            href="/dashboard"
            className="hidden md:inline-flex items-center justify-center rounded-md px-4 h-9 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            {t("dashboard")}
          </Link>
          <div className="relative hidden md:block" ref={userMenuRef}>
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center justify-center w-9 h-9 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              {getUserInitials()}
            </button>
            {userMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 rounded-md border border-border bg-popover shadow-lg z-50">
                <div className="px-4 py-3 border-b border-border">
                  <p className="text-sm font-medium">{user.display_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                </div>
                <div className="py-1">
                  <Link
                    href="/dashboard/settings"
                    className="block px-4 py-2 text-sm text-foreground hover:bg-accent transition-colors"
                    onClick={() => setUserMenuOpen(false)}
                  >
                    {tAuth("profile")}
                  </Link>
                  <Link
                    href="/dashboard/settings"
                    className="block px-4 py-2 text-sm text-foreground hover:bg-accent transition-colors"
                    onClick={() => setUserMenuOpen(false)}
                  >
                    {tAuth("settings")}
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="block w-full text-left px-4 py-2 text-sm text-destructive hover:bg-accent transition-colors"
                  >
                    {tAuth("logout")}
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      );
    }

    return (
      <>
        <Link
          href="/login"
          className="hidden md:inline-flex items-center justify-center rounded-md px-4 h-9 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          {t("signIn")}
        </Link>
        <Link
          href="/register"
          className="hidden md:inline-flex items-center justify-center rounded-md bg-primary px-4 h-9 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          {t("getStarted")}
        </Link>
      </>
    );
  };

  // Render mobile auth links
  const renderMobileAuthLinks = () => {
    if (!mounted) return null;

    if (isAuthenticated && user) {
      return (
        <>
          <Link href="/dashboard" className="text-sm font-medium text-muted-foreground hover:text-foreground" onClick={() => setMobileOpen(false)}>{t("dashboard")}</Link>
          <Link href="/dashboard/settings" className="text-sm font-medium text-muted-foreground hover:text-foreground" onClick={() => setMobileOpen(false)}>{tAuth("profile")}</Link>
          <Link href="/dashboard/settings" className="text-sm font-medium text-muted-foreground hover:text-foreground" onClick={() => setMobileOpen(false)}>{tAuth("settings")}</Link>
          <button onClick={() => { handleLogout(); setMobileOpen(false); }} className="text-left text-sm font-medium text-destructive hover:text-destructive/80">{tAuth("logout")}</button>
        </>
      );
    }

    return (
      <>
        <Link href="/login" className="text-sm font-medium text-muted-foreground hover:text-foreground" onClick={() => setMobileOpen(false)}>{t("signIn")}</Link>
        <Link href="/register" className="inline-flex items-center justify-center rounded-md bg-primary px-4 h-9 text-sm font-medium text-primary-foreground" onClick={() => setMobileOpen(false)}>{t("getStarted")}</Link>
      </>
    );
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">W</span>
            </div>
            <span className="font-bold text-xl">WuguHub</span>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-6">
          <Link href="/models" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            {t("models")}
          </Link>
          <Link href="/pricing" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            {t("pricing")}
          </Link>
          <Link href="/docs" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            {t("docs")}
          </Link>
        </nav>

        {/* Right cluster */}
        <div className="flex items-center gap-2">
          <LocaleSwitcher />
          <ThemeToggle />
          {renderAuthButtons()}

          {/* Mobile menu button */}
          <button
            className="md:hidden inline-flex items-center justify-center rounded-md w-9 h-9 text-muted-foreground hover:bg-accent"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>
          </button>
        </div>
      </div>

      {/* Mobile Navigation */}
      {mobileOpen && (
        <div className="md:hidden border-t border-border">
          <nav className="container py-4 flex flex-col gap-3">
            <Link href="/models" className="text-sm font-medium text-muted-foreground hover:text-foreground" onClick={() => setMobileOpen(false)}>{t("models")}</Link>
            <Link href="/pricing" className="text-sm font-medium text-muted-foreground hover:text-foreground" onClick={() => setMobileOpen(false)}>{t("pricing")}</Link>
            <Link href="/docs" className="text-sm font-medium text-muted-foreground hover:text-foreground" onClick={() => setMobileOpen(false)}>{t("docs")}</Link>
            {renderMobileAuthLinks()}
          </nav>
        </div>
      )}
    </header>
  );
}
