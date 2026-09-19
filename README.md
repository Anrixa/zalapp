# Zal

**Book the hall. Skip the phone calls.**

Zal is a venue-booking platform for the Armenian market — banquet halls, restaurants,
gardens, rooftops and corporate spaces, with real photos, real prices and real open dates.
This repository holds the whole product: one backend and three clients (web, iOS, Android)
that share a single API contract.

The UI is wired to the [Zal design canvas](https://claude.ai/artifact/4Cid8yh5oT42VqAqvqsB2r):
21 screens covering onboarding and auth, discovery and search, the three-step booking flow,
bookings, saved venues, alerts and account.

---

## Architecture

```
                      ┌──────────────────────────────────────────┐
                      │            @zal/contracts                │
                      │  Zod schemas · enums · pricing engine    │
                      │  The single source of truth for the API  │
                      └──────────────────────────────────────────┘
                            ▲                          ▲
             validates      │                          │   types + parses
             requests       │                          │   responses
                            │                          │
   ┌────────────────────────┴───────┐      ┌───────────┴─────────────────────┐
   │        apps/api (NestJS)       │      │      @zal/api-client            │
   │  Prisma · PostgreSQL · Redis   │◄─────┤  fetch + refresh + React Query  │
   │  REST /api/v1 · WS /realtime   │ HTTP │  platform-agnostic token store  │
   │  OpenAPI at /api/docs          │  WS  └───────────┬─────────────────────┘
   └────────────────────────────────┘                  │
                                                       │ same hooks
                                        ┌──────────────┴──────────────┐
                                        │                             │
                              ┌─────────┴─────────┐        ┌──────────┴──────────┐
                              │  apps/web         │        │  apps/mobile        │
                              │  Next.js 14       │        │  Expo / RN 0.76     │
                              │  App Router       │        │  Expo Router        │
                              │  cookie refresh   │        │  SecureStore refresh│
                              └───────────────────┘        └─────────────────────┘
                                                              iOS · Android
```

### Why this shape

- **One contract, three consumers.** `@zal/contracts` holds the Zod schemas. The API
  validates every request body against them and the clients parse every response with
  them, so a field that changes shape breaks the build rather than production.
- **One client, two platforms.** `@zal/api-client` owns transport, token refresh,
  error normalisation and the React Query hooks. `apps/web` and `apps/mobile` differ only
  in where the refresh token is stored and how screens are laid out.
- **Money is computed in one place.** `computeQuote()` in `@zal/contracts` is the only
  implementation of the pricing rules; the API calls it when it writes a booking and the
  clients call it to render the price breakdown before anything is written. The clients
  never invent a total.

### Pricing rules (from the design)

| Rule | Value |
| --- | --- |
| Service fee | 5% of (hall rental + add-ons) |
| Deposit due at booking | 20% of total |
| Balance due | 7 days before the event date |
| Free cancellation | up to 14 days before the event |
| Time slots | Afternoon 12:00–17:00 · Evening 18:00–23:59 |
| Booking reference | `ZAL-YYYYMMDD-NN` |

Worked example from the design: 420,000 rental + 60,000 DJ = 480,000, +5% service fee
(24,000) = **504,000 AMD** total, **100,800 AMD** due today, **403,200 AMD** balance.

---

## Repository layout

```
apps/
  api/        NestJS 10 · Prisma · PostgreSQL · Redis · WebSocket gateway
  web/        Next.js 14 (App Router, React 18) — responsive, SEO-visible venue pages
  mobile/     Expo SDK 52 (React Native 0.76) — iOS and Android from one codebase
packages/
  contracts/  Zod schemas, enums, API route map, pricing engine  (@zal/contracts)
  api-client/ Typed HTTP + WS client and React Query hooks       (@zal/api-client)
  tokens/     Zal design tokens: color, type, radii, spacing     (@zal/tokens)
  i18n/       Armenian, English and Russian UI copy              (@zal/i18n)
design/
  screens/{en,hy,ru}   the 19 screens as standalone HTML, in three languages
  design-tokens/       colors.json, typography.json, tokens.css
  assets/              the arch mark and app-icon lockups
infra/
  docker-compose.yml   PostgreSQL, Redis, MinIO, Mailpit for local development
```

`design/` is the hand-off pack the apps are wired to, vendored so the source of
truth travels with the code. `@zal/tokens` mirrors its token files; `@zal/i18n`
is extracted from its localised screens by
`pnpm --filter @zal/i18n extract`.

---

## Getting started

Requirements: Node 20.11+, pnpm 9, Docker (for Postgres/Redis/MinIO).

```bash
pnpm install
cp .env.example .env            # adjust if you are not using the compose defaults
pnpm db:up                      # Postgres + Redis + MinIO + Mailpit
pnpm --filter @zal/api exec prisma migrate dev
pnpm db:seed                    # venues, hosts, availability and a demo guest account
pnpm dev                        # api :4000 · web :3000 · expo :8081
```

The seeded demo guest is `+374 77 123 456`. In development `SMS_PROVIDER=console`,
so the OTP is printed in the API log instead of being sent — look for `[OtpService]`.

| Surface | URL |
| --- | --- |
| API | http://localhost:4000/api/v1 |
| OpenAPI / Swagger | http://localhost:4000/api/docs |
| Web | http://localhost:3000 |
| Expo dev tools | http://localhost:8081 |
| MinIO console | http://localhost:9001 |
| Mailpit inbox | http://localhost:8025 |

### Running one app

```bash
pnpm --filter @zal/api dev
pnpm --filter @zal/web dev
pnpm --filter @zal/mobile start      # then press i / a, or scan the QR
```

On a physical phone, point `EXPO_PUBLIC_API_URL` at your machine's LAN IP —
`localhost` inside the app means the phone itself.

---

## Authentication

Phone number plus a 6-digit SMS code is the primary path, matching the design; email and
password and Google sign-in are also supported.

1. `POST /auth/register` or `POST /auth/otp/request` sends a code and returns a
   short-lived `verificationId`.
2. `POST /auth/otp/verify` exchanges `{ verificationId, code }` for an access token and a
   refresh token.
3. The access token (15 min) travels as `Authorization: Bearer`. The refresh token
   (30 days) is **rotated on every use** and its family is revoked if an already-used
   token is replayed.
4. Web keeps the refresh token in an httpOnly, SameSite=Lax cookie; mobile keeps it in
   the OS keychain through `expo-secure-store`. Both go through the same
   `TokenStorage` interface in `@zal/api-client`, so the refresh logic is written once.

---

## Hosting a venue

Zal is self-serve. `POST /host/venues` creates a venue as a `DRAFT` and turns
the caller into a host — becoming one is a side effect of having a hall to
offer, not a separate sign-up. The host then sets prices, uploads photos and
publishes it themselves.

Publishing is refused while anything is missing. `publishBlockers` returns the
checklist — no photos, an unpriced slot, a description too short to tell one
hall from another — because a half-configured venue in search results is worse
for the host than not being listed.

| Endpoint | What |
| --- | --- |
| `POST/PATCH /host/venues[/:id]` | create and edit |
| `PATCH /host/venues/:id/status` | publish, pause, unpublish |
| `PUT /host/venues/:id/prices` | per-slot pricing, both slots at once |
| `PUT /host/venues/:id/add-ons` | the extras offered at checkout |
| `POST/DELETE /host/venues/:id/photos` | attach by storage key, reorder, remove |
| `POST/DELETE /host/venues/:id/blocks` | close a date range, or price it differently |
| `GET /host/bookings` | the host's work queue, soonest first |
| `DELETE /host/venues/:id` | archive — refused while dates are still held |

Two checks guard all of it: the `HOST` role says what kind of thing you may do,
and an ownership check on every call says which rows you may do it to. A host
with a valid token is still not allowed near another host's calendar. Closing a
date somebody has booked is refused and reported rather than silently skipped.

`VenueStatus` already carries the states a moderated flow would need, so
switching to "an admin publishes" later is a change to one guard rather than a
migration.

## Scheduled work

Four jobs, all idempotent, all in Asia/Yerevan — "the day after the event" has
to mean the venue's day, not the server's:

| Job | When | What |
| --- | --- | --- |
| `complete-past-bookings` | 00:15 daily | yesterday's confirmed bookings become completed, which unlocks reviewing them |
| `balance-reminders` | 10:00 daily | guests whose balance falls due in 3 days, once each |
| `expire-unpaid-holds` | every 30 min | releases dates held by a booking whose deposit never arrived |
| `prune-expired-tokens` | 03:30 Sunday | drops refresh tokens that can no longer authenticate anything |

`ENABLE_SCHEDULER=false` turns them off for a process. Exactly one instance in a
deployment should run them — two would send every reminder twice.

## Uploads

`POST /uploads/presign` returns a URL that permits one PUT, of one content type,
at one key, for fifteen minutes. The bytes go straight from the device to
storage: a 10 MB photo should not occupy a Node process for the length of its
upload, and a signature that expires is a permission that cannot be hoarded.

The content type and size are part of what gets signed, so a client that asked
to upload a 2 MB JPEG cannot then push a 40 MB video to the same URL. MinIO
serves this locally and S3 or R2 in production — only the endpoint changes.

## Real-time

`apps/api` exposes a Socket.IO gateway at `/realtime`. A client authenticates with its
access token and joins `user:{id}`. The server emits:

| Event | When |
| --- | --- |
| `booking.updated` | host confirms, declines or the status otherwise changes |
| `payment.updated` | a deposit or balance payment settles |
| `notification.created` | anything that lands in the Alerts tab |
| `message.created` | a new message in a booking thread |

`useRealtime()` in `@zal/api-client` subscribes and invalidates the matching React Query
keys, so screens refresh without polling.

---

## Scripts

| Command | Effect |
| --- | --- |
| `pnpm dev` | every app in watch mode |
| `pnpm build` | build all packages and apps |
| `pnpm typecheck` | `tsc --noEmit` across the workspace |
| `pnpm lint` | ESLint across the workspace |
| `pnpm test` | unit and e2e tests |
| `pnpm db:migrate` | create and apply a Prisma migration |
| `pnpm db:seed` | reseed the development database |
| `pnpm db:studio` | Prisma Studio |

---

## Languages

Three locales, Armenian first — the app is for the Armenian market and
defaulting to English would be a small daily insult to most of the people using
it. The 208 translated strings come from the design pack's own `hy/` and `ru/`
screens, so they are the designer's wording rather than a machine's.

Keys are the English strings themselves, so a missing translation degrades to
English rather than to `venue.detail.cta.primary`. Venue names, host names,
prices and booking references stay in Latin script in every locale.

The web app resolves the locale from the signed-in profile, then a cookie, then
Armenian; the phone app substitutes the device language for the cookie.

## Localisation and money

Three locales ship from the start — `hy` (default), `en`, `ru` — and three display
currencies, `AMD`, `USD`, `EUR`. Amounts are stored as **integer AMD minor units** on the
server; display conversion happens at the edge using the rate table in
`@zal/contracts/currency`. No float arithmetic touches money.

---

## Known constraints

- **Prisma needs network before the API can *run*.** `prisma generate` downloads
  a query engine from `binaries.prisma.sh`; where that host is blocked the
  failure is a checksum or 403 error rather than anything wrong with the schema.
  `pnpm --filter @zal/api typecheck` falls back to
  `scripts/generate-offline.mjs`, which writes the client's TypeScript from the
  schema and skips the engine, so type checking, linting and the unit tests all
  work with no network. `build` deliberately has no such fallback: a client
  generated that way has no engine to load and would fail at startup, so the
  build stays honest and demands the real thing.
- **Rate limiting needs Redis to hold across instances.** With `REDIS_URL` set
  the limits are shared; without it they are per process, which is correct for
  a single instance and wrong behind a load balancer. The API logs which mode
  it started in.
- **The workspace uses `node-linker=hoisted`.** React Native's tooling assumes a
  flat `node_modules`, and several packages in the Expo stack import
  dependencies they never declare. `.npmrc` explains the trade-off.
- **Signing out does not invalidate an access token already issued.** Revoking
  a refresh token ends the session's ability to renew, but the JWT in hand stays
  valid until it expires — up to `JWT_ACCESS_TTL`, 15 minutes by default. Closing
  that window needs a denylist keyed on the `sid` claim, which is a Redis
  dependency the API does not otherwise require.
- **The API refuses to start in production with development defaults.**
  `PAYMENTS_PROVIDER=mock`, `SMS_PROVIDER=console` and an unset `CORS_ORIGINS`
  all work silently and wrongly, so `loadEnv` treats them as fatal under
  `NODE_ENV=production` rather than letting a deploy discover them later.
- **`mcp.json` has a token in this repository's history.** It was replaced with
  an environment reference, but a later commit cannot remove it from history —
  that token should be treated as compromised and revoked.

## License

UNLICENSED — © Anrixa. All rights reserved.
