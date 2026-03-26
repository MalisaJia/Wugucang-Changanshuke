'use client';

import { useState, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter, useParams } from 'next/navigation';
import {
  getTeamMembers,
  inviteMember,
  updateMemberRole,
  deleteMember,
  ROLE_HIERARCHY,
  type TeamMember,
  type InviteMemberData,
} from '@/lib/api/team';
import { ApiClientError } from '@/lib/api/client';
import { useAuthStore } from '@/lib/stores/auth-store';
import {
  Users,
  UserPlus,
  Shield,
  Trash2,
  Search,
  X,
  Loader2,
  ChevronDown,
} from 'lucide-react';

type Role = 'owner' | 'admin' | 'member' | 'viewer';

const ROLES: Role[] = ['owner', 'admin', 'member', 'viewer'];
const INVITABLE_ROLES: Role[] = ['admin', 'member', 'viewer'];

const ROLE_COLORS: Record<Role, string> = {
  owner: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  admin: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  member: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  viewer: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
};

export default function TeamClient() {
  const t = useTranslations('team');
  const { user } = useAuthStore();
  const router = useRouter();
  const params = useParams();
  const locale = (params.locale as string) || 'en';
  
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<Role | 'all'>('all');

  // Modal state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<TeamMember | null>(null);

  // Invite form state
  const [inviteForm, setInviteForm] = useState<InviteMemberData>({
    email: '',
    password: '',
    display_name: '',
    role: 'member',
  });
  const [inviteLoading, setInviteLoading] = useState(false);

  // Role update loading state
  const [updatingRoleId, setUpdatingRoleId] = useState<string | null>(null);

  // Delete loading state
  const [deleteLoading, setDeleteLoading] = useState(false);

  const currentUserRole = (user?.role as Role) || 'viewer';
  const currentUserRoleLevel = ROLE_HIERARCHY[currentUserRole] || 1;

  // Admin route guard
  useEffect(() => {
    if (user && !user.is_platform_admin) {
      router.replace(`/${locale}/dashboard`);
    }
  }, [user, locale, router]);

  // If not admin, don't render content
  if (!user || !user.is_platform_admin) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  useEffect(() => {
    fetchMembers();
  }, []);

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const fetchMembers = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getTeamMembers();
      setMembers(data);
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : 'Failed to load team members';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const filteredMembers = useMemo(() => {
    return members.filter((member) => {
      // Search filter
      const matchesSearch =
        searchQuery === '' ||
        member.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        member.email.toLowerCase().includes(searchQuery.toLowerCase());

      // Role filter
      const matchesRole = roleFilter === 'all' || member.role === roleFilter;

      return matchesSearch && matchesRole;
    });
  }, [members, searchQuery, roleFilter]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setInviteLoading(true);
      setError(null);
      await inviteMember(inviteForm);
      setSuccessMessage(t('inviteSuccess'));
      setShowInviteModal(false);
      setInviteForm({ email: '', password: '', display_name: '', role: 'member' });
      await fetchMembers();
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : 'Failed to invite member';
      setError(message);
    } finally {
      setInviteLoading(false);
    }
  };

  const handleRoleChange = async (memberId: string, newRole: string) => {
    try {
      setUpdatingRoleId(memberId);
      setError(null);
      await updateMemberRole(memberId, newRole);
      setSuccessMessage(t('updateSuccess'));
      await fetchMembers();
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : 'Failed to update role';
      setError(message);
    } finally {
      setUpdatingRoleId(null);
    }
  };

  const handleDeleteClick = (member: TeamMember) => {
    setMemberToDelete(member);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!memberToDelete) return;
    try {
      setDeleteLoading(true);
      setError(null);
      await deleteMember(memberToDelete.id);
      setSuccessMessage(t('deleteSuccess'));
      setShowDeleteModal(false);
      setMemberToDelete(null);
      await fetchMembers();
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : 'Failed to delete member';
      setError(message);
    } finally {
      setDeleteLoading(false);
    }
  };

  const canManageRole = (member: TeamMember): boolean => {
    // Can't manage own role
    if (member.id === user?.id) return false;
    // Can only manage roles lower than own
    const memberRoleLevel = ROLE_HIERARCHY[member.role] || 1;
    return currentUserRoleLevel > memberRoleLevel && currentUserRoleLevel >= 3;
  };

  const canDeleteMember = (member: TeamMember): boolean => {
    // Can't delete self
    if (member.id === user?.id) return false;
    // Can only delete members with lower role
    const memberRoleLevel = ROLE_HIERARCHY[member.role] || 1;
    return currentUserRoleLevel > memberRoleLevel && currentUserRoleLevel >= 3;
  };

  const getAvailableRoles = (): Role[] => {
    // Return roles that are lower than current user's role
    return ROLES.filter((role) => ROLE_HIERARCHY[role] < currentUserRoleLevel);
  };

  const getInvitableRoles = (): Role[] => {
    return INVITABLE_ROLES.filter((role) => ROLE_HIERARCHY[role] < currentUserRoleLevel);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getUserInitials = (name: string) => {
    if (!name) return '?';
    const names = name.split(' ');
    if (names.length >= 2) {
      return `${names[0][0]}${names[1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6" />
            {t('title')}
          </h1>
        </div>
        {currentUserRoleLevel >= 3 && (
          <button
            onClick={() => setShowInviteModal(true)}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <UserPlus className="h-4 w-4" />
            {t('invite')}
          </button>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="p-4 rounded-lg bg-destructive/10 text-destructive border border-destructive/20">
          {error}
        </div>
      )}

      {/* Success message */}
      {successMessage && (
        <div className="p-4 rounded-lg bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20">
          {successMessage}
        </div>
      )}

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder={t('search')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>
        <div className="relative">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as Role | 'all')}
            className="appearance-none pl-4 pr-10 py-2 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary cursor-pointer"
          >
            <option value="all">{t('allRoles')}</option>
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {t(role)}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        </div>
      </div>

      {/* Members Table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">
                  {t('name')}
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">
                  {t('email')}
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">
                  {t('role')}
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">
                  {t('joinedAt')}
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">
                  {t('actions')}
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredMembers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    {t('noMembers')}
                  </td>
                </tr>
              ) : (
                filteredMembers.map((member) => (
                  <tr key={member.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0">
                          <span className="text-primary-foreground text-sm font-medium">
                            {getUserInitials(member.display_name)}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium truncate">
                            {member.display_name}
                            {member.id === user?.id && (
                              <span className="ml-2 text-muted-foreground text-sm">{t('you')}</span>
                            )}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{member.email}</td>
                    <td className="px-4 py-3">
                      {canManageRole(member) ? (
                        <div className="relative inline-block">
                          <select
                            value={member.role}
                            onChange={(e) => handleRoleChange(member.id, e.target.value)}
                            disabled={updatingRoleId === member.id}
                            className={`appearance-none px-3 py-1 pr-8 rounded-full text-xs font-medium cursor-pointer ${ROLE_COLORS[member.role]} border-0 focus:outline-none focus:ring-2 focus:ring-primary/20`}
                          >
                            {getAvailableRoles().map((role) => (
                              <option key={role} value={role}>
                                {t(role)}
                              </option>
                            ))}
                          </select>
                          {updatingRoleId === member.id ? (
                            <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 animate-spin" />
                          ) : (
                            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 pointer-events-none" />
                          )}
                        </div>
                      ) : (
                        <span
                          className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${ROLE_COLORS[member.role]}`}
                        >
                          <Shield className="h-3 w-3" />
                          {t(member.role)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {formatDate(member.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      {canDeleteMember(member) && (
                        <button
                          onClick={() => handleDeleteClick(member)}
                          className="p-2 rounded-md text-red-500 hover:bg-red-500/10 transition-colors"
                          title={t('delete')}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-lg w-full max-w-md mx-4 shadow-xl">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <UserPlus className="h-5 w-5" />
                {t('inviteTitle')}
              </h2>
              <button
                onClick={() => setShowInviteModal(false)}
                className="p-1 rounded-md hover:bg-accent transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleInvite} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">{t('email')}</label>
                <input
                  type="email"
                  required
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                  className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  placeholder="user@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('displayName')}</label>
                <input
                  type="text"
                  required
                  value={inviteForm.display_name}
                  onChange={(e) => setInviteForm({ ...inviteForm, display_name: e.target.value })}
                  className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  placeholder="John Doe"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('password')}</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={inviteForm.password}
                  onChange={(e) => setInviteForm({ ...inviteForm, password: e.target.value })}
                  className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  placeholder="********"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('selectRole')}</label>
                <select
                  value={inviteForm.role}
                  onChange={(e) =>
                    setInviteForm({ ...inviteForm, role: e.target.value as 'admin' | 'member' | 'viewer' })
                  }
                  className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                >
                  {getInvitableRoles().map((role) => (
                    <option key={role} value={role}>
                      {t(role)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="flex-1 px-4 py-2 rounded-md border border-border text-sm font-medium hover:bg-accent transition-colors"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={inviteLoading}
                  className="flex-1 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {inviteLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {t('confirm')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && memberToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-lg w-full max-w-md mx-4 shadow-xl">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="text-lg font-semibold text-red-500 flex items-center gap-2">
                <Trash2 className="h-5 w-5" />
                {t('deleteTitle')}
              </h2>
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setMemberToDelete(null);
                }}
                className="p-1 rounded-md hover:bg-accent transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4">
              <p className="text-muted-foreground mb-4">{t('deleteConfirm')}</p>
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg mb-4">
                <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
                  <span className="text-primary-foreground text-sm font-medium">
                    {getUserInitials(memberToDelete.display_name)}
                  </span>
                </div>
                <div>
                  <p className="font-medium">{memberToDelete.display_name}</p>
                  <p className="text-sm text-muted-foreground">{memberToDelete.email}</p>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setMemberToDelete(null);
                  }}
                  className="flex-1 px-4 py-2 rounded-md border border-border text-sm font-medium hover:bg-accent transition-colors"
                >
                  {t('cancel')}
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  disabled={deleteLoading}
                  className="flex-1 px-4 py-2 rounded-md bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {deleteLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {t('delete')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
