'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUnreadCount } from '@zal/api-client';
import { BellIcon, HeartIcon, HallIcon, SearchIcon, UserIcon } from './icons';

const TABS = [
  { href: '/', label: 'Home', Icon: HallIcon },
  { href: '/search', label: 'Search', Icon: SearchIcon },
  { href: '/saved', label: 'Saved', Icon: HeartIcon },
  { href: '/notifications', label: 'Alerts', Icon: BellIcon },
  { href: '/profile', label: 'Profile', Icon: UserIcon },
] as const;

/**
 * The five-tab bar from the design.
 *
 * `aria-current="page"` rather than a colour alone carries the active state, so
 * the tab a guest is on is announced and not merely tinted. The unread badge
 * comes from the same query the realtime socket updates, so it reacts within a
 * second of a host confirming a booking.
 */
export function BottomNav() {
  const pathname = usePathname();
  const { data: unread } = useUnreadCount();

  return (
    <nav className="bottom-nav" aria-label="Main">
      {TABS.map(({ href, label, Icon }) => {
        const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
        const badge = href === '/notifications' ? (unread?.unread ?? 0) : 0;

        return (
          <Link key={href} href={href} aria-current={active ? 'page' : undefined}>
            <span style={{ position: 'relative', display: 'inline-flex' }}>
              <Icon size={22} />
              {badge > 0 && (
                <span
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    top: -3,
                    right: -7,
                    minWidth: 16,
                    height: 16,
                    padding: '0 4px',
                    borderRadius: 999,
                    background: 'var(--zal-pomegranate)',
                    color: 'var(--zal-ivory)',
                    fontSize: 9.5,
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1.5px solid var(--zal-white)',
                  }}
                >
                  {badge > 9 ? '9+' : badge}
                </span>
              )}
            </span>
            {label}
            {badge > 0 && <span className="sr-only">, {badge} unread</span>}
          </Link>
        );
      })}
    </nav>
  );
}
