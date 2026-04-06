"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isSuperAdmin = exports.roleMatchesPolicy = exports.ROLE_POLICIES = exports.USER_ROLE_MANAGEMENT_ROLES = exports.ADMIN_OR_SUPER_ADMIN_ROLES = void 0;
const ADMIN_OR_SUPER_ADMIN_ROLES = ['admin', 'super_admin'];
exports.ADMIN_OR_SUPER_ADMIN_ROLES = ADMIN_OR_SUPER_ADMIN_ROLES;
const USER_ROLE_MANAGEMENT_ROLES = ['admin', 'manager', 'super_admin'];
exports.USER_ROLE_MANAGEMENT_ROLES = USER_ROLE_MANAGEMENT_ROLES;
const ROLE_POLICIES = {
    userRoleManagement: USER_ROLE_MANAGEMENT_ROLES,
    memberFinanceManagement: ADMIN_OR_SUPER_ADMIN_ROLES,
    mealScheduleManagement: ADMIN_OR_SUPER_ADMIN_ROLES,
    mealDeadlineManagement: ADMIN_OR_SUPER_ADMIN_ROLES,
    expenseManagement: ADMIN_OR_SUPER_ADMIN_ROLES,
    depositManagement: ADMIN_OR_SUPER_ADMIN_ROLES,
    monthFinalizationManagement: ADMIN_OR_SUPER_ADMIN_ROLES,
    mealRegistrationOverride: ADMIN_OR_SUPER_ADMIN_ROLES
};
exports.ROLE_POLICIES = ROLE_POLICIES;
const roleMatchesPolicy = (currentRole, policyName) => {
    return ROLE_POLICIES[policyName].includes(currentRole);
};
exports.roleMatchesPolicy = roleMatchesPolicy;
const isSuperAdmin = (currentRole) => currentRole === 'super_admin';
exports.isSuperAdmin = isSuperAdmin;
