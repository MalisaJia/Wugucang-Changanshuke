import { apiClient } from './client';

// Team member interface
export interface TeamMember {
  id: string;
  email: string;
  display_name: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  created_at: string;
}

// Invite member data interface
export interface InviteMemberData {
  email: string;
  password: string;
  display_name: string;
  role: 'admin' | 'member' | 'viewer';
}

// Role hierarchy: owner(4) > admin(3) > member(2) > viewer(1)
export const ROLE_HIERARCHY: Record<string, number> = {
  owner: 4,
  admin: 3,
  member: 2,
  viewer: 1,
};

// Get team members list
export async function getTeamMembers(): Promise<TeamMember[]> {
  return apiClient.get<TeamMember[]>('/api/profile/others');
}

// Invite new member
export async function inviteMember(data: InviteMemberData): Promise<TeamMember> {
  return apiClient.post<TeamMember>('/api/profile/others', data);
}

// Update member role
export async function updateMemberRole(id: string, role: string): Promise<void> {
  return apiClient.patch<void>(`/api/profile/others/${id}`, { role });
}

// Delete member
export async function deleteMember(id: string): Promise<void> {
  return apiClient.delete<void>(`/api/profile/others/${id}`);
}
