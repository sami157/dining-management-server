import type { UserRole } from './validation';

const ADMIN_OR_SUPER_ADMIN_ROLES: UserRole[] = ['admin', 'super_admin'];
const USER_ROLE_MANAGEMENT_ROLES: UserRole[] = ['admin', 'manager', 'super_admin'];

const ROLE_POLICIES = {
  userRoleManagement: USER_ROLE_MANAGEMENT_ROLES,
  memberFinanceManagement: ADMIN_OR_SUPER_ADMIN_ROLES,
  mealScheduleManagement: ADMIN_OR_SUPER_ADMIN_ROLES,
  mealDeadlineManagement: ADMIN_OR_SUPER_ADMIN_ROLES,
  expenseManagement: ADMIN_OR_SUPER_ADMIN_ROLES,
  depositManagement: ADMIN_OR_SUPER_ADMIN_ROLES,
  monthFinalizationManagement: ADMIN_OR_SUPER_ADMIN_ROLES,
  mealRegistrationOverride: ADMIN_OR_SUPER_ADMIN_ROLES
} as const;

type RolePolicyName = keyof typeof ROLE_POLICIES;

const roleMatchesPolicy = (currentRole: string | undefined, policyName: RolePolicyName) => {
  return ROLE_POLICIES[policyName].includes(currentRole as UserRole);
};

const isSuperAdmin = (currentRole: string | undefined) => currentRole === 'super_admin';

export {
  ADMIN_OR_SUPER_ADMIN_ROLES,
  USER_ROLE_MANAGEMENT_ROLES,
  ROLE_POLICIES,
  roleMatchesPolicy,
  isSuperAdmin,
  type RolePolicyName
};
