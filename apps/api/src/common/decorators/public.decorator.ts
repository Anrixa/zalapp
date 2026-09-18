import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'zal:isPublic';

/**
 * Opt a route out of authentication.
 *
 * Authentication is global and the exceptions are marked, rather than the other
 * way round: forgetting a decorator then means a route is locked, not open.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const IS_OPTIONAL_AUTH_KEY = 'zal:optionalAuth';

/**
 * Attach the user when a token is present, but do not require one.
 *
 * Used by venue listings, which show `isSaved` to a signed-in guest and work
 * perfectly well without anyone signed in.
 */
export const OptionalAuth = () => SetMetadata(IS_OPTIONAL_AUTH_KEY, true);
