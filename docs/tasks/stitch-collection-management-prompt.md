# Google Stitch prompt — Collection Management UI

App: **Librune**, a local-first EPUB reader PWA. Design language is "The Bound Folio" — a physical-book metaphor: warm cream/parchment paper tones, an ink-black architectural chrome, and a single gold accent reserved for the reading experience. Calm, minimal, reading-focused — not a database-style organization tool.

## What to design

Screens/components for **user-managed Collections** (distinct from auto-detected Series, which are read-only). Users need to:

1. **View all collections** — a grid or list of collection "shelves," each showing a name, book count, and a stack/cover preview of 1–4 books inside it (similar to how a physical shelf label + spines would read). Entry point from the main library screen.
2. **Create a collection** — a lightweight bottom sheet or dialog with a single name field. No icon pickers, no colors, no descriptions — keep it to the one input the feature actually needs.
3. **Rename a collection** — same lightweight bottom sheet/dialog pattern as create, pre-filled.
4. **Delete a collection** — a confirmation step that makes it unmistakable this deletes the _collection_ (the grouping), not the books inside it. Copy should explicitly reassure that books remain in the library.
5. **Add books to a collection** — from a book's detail/context menu, a picker showing existing collections as a checklist (multi-select, a book can belong to multiple collections) plus a "New collection" affordance inline.
6. **Remove a book from a collection** — from within a collection's book grid, a lightweight per-book removal affordance (e.g. swipe action, overflow menu, or long-press) that does not read as "delete this book."
7. **Empty states**: (a) no collections created yet — an inviting first-run empty state on the collections entry point, and (b) a collection with zero books in it.
8. **A single collection's detail view** — header with the collection name, edit/delete affordance, a book count, and the same book grid component used on the main library screen (reuse, don't reinvent the card).

## Visual system to follow exactly

- **Palette**: warm parchment/cream backgrounds (`#fff9ee` light / `#141210` dark), ink-black primary (`#040505` light / near-white dark — always the ink-on-paper inversion, never a fixed mid-tone), Antique Gold (`#a67c00` bg / `#1a1200` fg) reserved _only_ for the reading-focused CTAs (continue-reading banner, import FAB) — do not use gold for collection actions, that would blur the meaning of the accent. Use the Selected amber tone (`#9c7226` light / `#e0ac52` dark) for the one "this is the active/checked item" state (e.g. a checked collection in the add-to-collection picker).
- **Typography**: Cinzel (serif, wide letterspacing) for screen titles and collection names as headers; Literata is reserved for in-book reading text, not UI; Plus Jakarta Sans for all UI chrome — buttons, labels, meta text, book counts.
- **Shape**: controls (buttons, menus, dialogs) get a small, disciplined radius (`rounded-sm`, reads as a precise tool). Content objects — book covers, collection "shelf" cards, bottom sheets — get a larger radius (`rounded-xl`/`rounded-3xl`, reads as a rounded paper object). Never fully sharp, never a single uniform radius everywhere.
- **Depth**: a consistent soft ambient shadow at rest on every card-like surface (collection cards, book covers, sheets), not just on hover — reinforces layered-paper depth.
- **Borders**: decorative hairlines (`border-mist`) for card edges and dividers only; a distinct, higher-contrast `control-edge` tone for anything actually interactive (button outlines, input underlines) — never reuse the decorative border color on a clickable boundary.

## Constraints

- Mobile-first, responsive up to desktop — this is a PWA used on phones and tablets primarily.
- Touch targets ≥44×44px (WCAG 2.2 AA); icon-only buttons must have a real hit area, not just the glyph size.
- Dark mode is a first-class second theme, not an afterthought — design both.
- No accounts, no sharing, no cloud iconography — this is explicitly single-device/local-only, don't imply sync.
- Deliberately _not_ a tag/label/smart-filter system — no color-coding per collection, no nested folders, no rules. One flat list of named collections a user creates by hand.

## Deliverable

Provide the 8 screens/components above as a cohesion flow (collections list → create → collection detail → add-to-collection picker → delete confirmation → empty states), consistent in spacing, type scale, and component reuse with a bound-folio / warm-paper-and-ink book app, not a generic SaaS dashboard.
