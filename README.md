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
infra/
  docker-compose.yml   PostgreSQL, Redis, MinIO, Mailpit for local development
```

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

## Localisation and money

Three locales ship from the start — `hy` (default), `en`, `ru` — and three display
currencies, `AMD`, `USD`, `EUR`. Amounts are stored as **integer AMD minor units** on the
server; display conversion happens at the edge using the rate table in
`@zal/contracts/currency`. No float arithmetic touches money.

---

## License

UNLICENSED — © Anrixa. All rights reserved.
