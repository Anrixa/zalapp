import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '@zal/contracts';

export const ROLES_KEY = 'zal:roles';

export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
