import type { HostProfile, User } from '@prisma/client';
import type { Host, User as UserDto } from '@zal/contracts';
import { initialsFrom } from '../../common/utils/text';

/**
 * Database row → wire shape.
 *
 * Mapping is explicit rather than a spread so a column added later — a password
 * hash, a Google id, an internal flag — cannot leak into a response simply
 * because someone added it to the schema.
 */
export function toUserDto(user: User): UserDto {
  return {
    id: user.id,
    fullName: user.fullName,
    phone: user.phone,
    email: user.email,
    avatarUrl: user.avatarUrl,
    role: user.role,
    locale: user.locale,
    currency: user.currency,
    phoneVerified: user.phoneVerifiedAt !== null,
    createdAt: user.createdAt.toISOString(),
  };
}

export function toHostDto(
  host: HostProfile & { user?: Pick<User, 'avatarUrl'> | null },
  extras: { venueCount: number; ratingAvg: number | null },
): Host {
  return {
    id: host.id,
    displayName: host.displayName,
    avatarUrl: host.user?.avatarUrl ?? null,
    initials: initialsFrom(host.displayName),
    bio: host.bio,
    respondsWithinMinutes: host.respondsWithinMinutes,
    memberSince: host.memberSince,
    venueCount: extras.venueCount,
    ratingAvg: extras.ratingAvg,
  };
}
