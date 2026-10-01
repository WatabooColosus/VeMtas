export type BusinessRole = "BUSINESS_OWNER" | "BUSINESS_ADMIN" | "BRANCH_MANAGER" | "CASHIER" | "ANALYST";
export type Permission = "business:read" | "business:manage" | "branch:operate" | "terminal:manage" | "credential:block";
const rolePermissions: Record<BusinessRole, Permission[]> = { BUSINESS_OWNER: ["business:read","business:manage","branch:operate","terminal:manage","credential:block"], BUSINESS_ADMIN: ["business:read","business:manage","terminal:manage"], BRANCH_MANAGER: ["business:read","branch:operate","terminal:manage"], CASHIER: ["business:read","branch:operate"], ANALYST: ["business:read"] };
export function allows(role: BusinessRole, permission: Permission): boolean { return rolePermissions[role]?.includes(permission) ?? false; }
export function sameBusiness(actorBusinessId: string, resourceBusinessId: string): boolean { return actorBusinessId === resourceBusinessId; }
