# Zal — venue booking app design pack

Zal (զալ) is the Armenian word for a banquet hall — the app is a venue-booking product for the Armenian market, covering the full journey from registration to profile. This repo is a static design hand-off pack: every screen exported as dependency-free HTML, in three languages, plus the underlying design tokens and brand assets.

Open `index.html` in a browser to browse the whole pack with a language switcher, or open any file under `screens/` directly.

## What's in here

```
index.html              gallery / table of contents with an EN · HY · RU switch
screens/
  en/                    19 app screens in English
  hy/                    the same 19 screens in Armenian (Հայերեն)
  ru/                    the same 19 screens in Russian (Русский)
  Brand.html             brand & UI kit (shared, not localized — see below)
components/
  BottomNav.html         reference render of the shared bottom-nav partial
  VenueCard.html         reference render of the shared venue-card partial
design-tokens/
  colors.json            palette with role annotations
  typography.json        type families, weights, scale
  tokens.css             the same tokens as CSS custom properties
assets/
  mark.svg               the arch mark alone
  app-icon-*.svg         app-icon lockups (pomegranate / ink background)
  wordmark-lockup.svg    mark + "Zal" wordmark
```

Every screen is a single self-contained `.html` file — no build step, no framework, no external JS. They're flattened exports of an interactive Claude-made prototype (an artboard-based design canvas); the shared bottom-nav and venue-card components were inlined into each screen that uses them.

## Screen map

**Onboarding & auth** — Splash (`Main.html`) → Onboarding → Create account → Verify phone (OTP) → Log in

**Discover & search** — Home → Search results → Filters

**Booking flow** — Venue detail → Choose date & time → Review & pay → Payment (card, Idram, Telcell Wallet, bank transfer) → Booking confirmed

**Bookings, saved & alerts** — My bookings → Booking detail → Saved venues → Notifications

**Account** — Profile → Settings

Screens link to each other with real `<a href>`s, so clicking through `screens/en/Main.html` walks the whole flow like a clickable prototype.

## Languages

Armenian and Russian versions translate all UI chrome, labels, body copy and form placeholders. Left as-is in every language, deliberately:

- Proper nouns — venue names (*Dvin Hall*, *Zvartnots Garden*, …), host names, the brand name **Zal** itself
- Numbers, prices (`AMD` amounts), phone numbers, booking reference codes
- The three language-picker chips on the Settings screen (`Հայերեն` / `English` / `Русский`), which name themselves in their own script regardless of the active locale

The **Brand & UI kit** page is designer-facing reference material, not user-facing app copy, so it's kept single (English) and shared across locales rather than tripled.

## Design system, in short

- **Color** — a warm ivory ground with two accents that share chroma and lightness: pomegranate (primary, `#A32638`) and apricot (secondary, `#E8933A`) — both real Armenian symbols (pomegranate for abundance/marriage, apricot as the country's namesake fruit), not the flag palette.
- **Type** — Fraunces (display) + Plus Jakarta Sans (UI). No Inter/Roboto/Arial.
- **Shape** — pill radius reserved for primary buttons only; 20px for cards/photos; 14px for inputs/chips — so the one shape you're meant to press always reads differently from the shapes you're meant to look at.
- **Logo** — an abstract doorway/arch, standing in for both "entering a venue" and the crown of a pomegranate.

Full detail, swatches and a live specimen are in `screens/Brand.html`. Machine-readable tokens are in `design-tokens/`.

## Known scope cuts

- Venue photography is a styled placeholder (gradient + icon), not real photos — there were none to use.
- Interactive states (filter-chip toggles, the saved-heart on venue cards) are real, working JS in the source prototype; the flattened export keeps those specific bits static at a representative state.
