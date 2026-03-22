'use client';

export const runtime = 'edge';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { getProfile, updateProfile, changePassword, type UserProfile } from '@/lib/api/user';
import { ApiClientError } from '@/lib/api/client';
import { useAuthStore } from '@/lib/stores/auth-store';
import { User, Lock, Check, AlertCircle } from 'lucide-react';

export default function SettingsPage() {
  const t = useTranslations('dashboard');
  const { user: authUser } = useAuthStore();

  // Profile state
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setProfileLoading(true);
      setProfileError(null);
      const data = await getProfile();
      setProfile(data);
      setDisplayName(data.display_name);
      setEmail(data.email);
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : 'Failed to load profile';
      setProfileError(message);
      // Fallback to auth store data if API fails
      if (authUser) {
        setDisplayName(authUser.display_name || '');
        setEmail(authUser.email || '');
      }
    } finally {
      setProfileLoading(false);
    }
  };

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError(null);
    setProfileSuccess(false);

    try {
      setProfileSaving(true);
      const updated = await updateProfile({
        display_name: displayName,
        email: email,
      });
      setProfile(updated);
      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 3000);
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : 'Failed to update profile';
      setProfileError(message);
    } finally {
      setProfileSaving(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);

    // Client-side validation
    if (newPassword.length < 8) {
      setPasswordError(t('settingsPage.password.minLength'));
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError(t('settingsPage.password.mismatch'));
      return;
    }

    try {
      setPasswordSaving(true);
      await changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      setPasswordSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSuccess(false), 3000);
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : 'Failed to change password';
      setPasswordError(message);
    } finally {
      setPasswordSaving(false);
    }
  };

  const getRoleBadge = (role: string) => {
    const roleColors: Record<string, string> = {
      admin: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
      owner: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      member: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
    };
    const colorClass = roleColors[role.toLowerCase()] || roleColors.member;
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
        {role}
      </span>
    );
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">{t('settingsPage.title')}</h1>
        <p className="text-muted-foreground mt-1">{t('settingsPage.subtitle')}</p>
      </div>

      {/* Profile Section */}
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
            <User className="h-5 w-5 text-primary" />
          </div>
          <h2 className="text-lg font-semibold">{t('settingsPage.profile.title')}</h2>
        </div>

        {profileLoading ? (
          <div className="py-8 text-center text-muted-foreground">
            <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2" />
            Loading...
          </div>
        ) : (
          <form onSubmit={handleProfileSave} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">{t('settingsPage.profile.displayName')}</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">{t('settingsPage.profile.email')}</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">{t('settingsPage.profile.role')}</label>
              <div className="h-10 flex items-center">
                {getRoleBadge(profile?.role || authUser?.role || 'member')}
              </div>
            </div>

            {profileError && (
              <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {profileError}
              </div>
            )}

            {profileSuccess && (
              <div className="flex items-center gap-2 p-3 rounded-md bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-sm">
                <Check className="h-4 w-4 shrink-0" />
                {t('settingsPage.profile.saved')}
              </div>
            )}

            <div className="pt-2">
              <button
                type="submit"
                disabled={profileSaving}
                className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {profileSaving ? 'Saving...' : t('settingsPage.profile.save')}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Change Password Section */}
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
            <Lock className="h-5 w-5 text-primary" />
          </div>
          <h2 className="text-lg font-semibold">{t('settingsPage.password.title')}</h2>
        </div>

        <form onSubmit={handlePasswordChange} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">{t('settingsPage.password.current')}</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">{t('settingsPage.password.new')}</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">{t('settingsPage.password.confirm')}</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>

          {passwordError && (
            <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {passwordError}
            </div>
          )}

          {passwordSuccess && (
            <div className="flex items-center gap-2 p-3 rounded-md bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-sm">
              <Check className="h-4 w-4 shrink-0" />
              {t('settingsPage.password.changed')}
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={passwordSaving || !currentPassword || !newPassword || !confirmPassword}
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {passwordSaving ? 'Changing...' : t('settingsPage.password.change')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
