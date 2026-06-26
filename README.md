# Announcement Banner — Shopify App

A full-stack Shopify embedded app that lets merchants set a global announcement banner from their admin dashboard. The banner text is saved to both MongoDB (for an audit trail) and Shopify's Shop Metafields, and then displayed on the live storefront through a Theme App Extension.

Built as part of the **FutureBlink** Shopify App Developer assessment.

---

## Live Demo

| Resource | Link |
|----------|------|
| GitHub Repo | [github.com/Vibush01/MERN-shopify-app](https://github.com/Vibush01/MERN-shopify-app) |
| Deployed App | [futureblink-app on Render](https://your-render-url.onrender.com) |
| Video Walkthrough | [Loom / YouTube link](https://your-video-link) |

---

## What It Does

The task was to build a system where data flows from **Admin → Database → Shopify API → Storefront**. Here's how it works:

1. **Merchant opens the app** inside the Shopify Admin panel.
2. They type a message like _"Free Shipping on orders above ₹999!"_ and hit **Save & Update Storefront**.
3. Behind the scenes, the app does two things simultaneously:
   - Writes the text to **MongoDB Atlas** so every change is logged with a timestamp (audit trail).
   - Updates a **Shop Metafield** on Shopify via the GraphQL Admin API, making the text accessible to the storefront.
4. A **Theme App Extension** (App Embed Block) picks up the metafield value and renders a fixed announcement banner at the top of every page on the online store.
5. The admin dashboard also shows a **Modification Audit Trail** table — a history of every announcement that was ever set, pulled directly from MongoDB.

---

## Tech Stack

The app is built on the **MERN stack** (MongoDB, Express, React, Node.js) with Shopify-specific tooling:

| Layer | Technology |
|-------|------------|
| Frontend (Admin) | React, React Router v7, Shopify Polaris |
| Backend | Node.js, Shopify App React Router (server-side) |
| Database | MongoDB Atlas (via Mongoose) |
| Session Storage | `@shopify/shopify-app-session-storage-mongodb` |
| Storefront Extension | Liquid (Theme App Extension — App Embed Block) |
| API | Shopify GraphQL Admin API (2025-10) |
| Deployment | Render |
| Dev Tooling | Shopify CLI, Vite, ESLint, Prettier |

---

## Architecture

Here's how data flows through the app:

```
┌─────────────────────────────────────────────────────────────┐
│                    Shopify Admin (Embedded App)              │
│                                                             │
│   Merchant types announcement text → clicks "Save"          │
│                         │                                   │
│                         ▼                                   │
│               ┌─────────────────┐                           │
│               │  React Router   │                           │
│               │  Action Handler │                           │
│               └────────┬────────┘                           │
│                        │                                    │
│              ┌─────────┴─────────┐                          │
│              ▼                   ▼                           │
│     ┌────────────────┐  ┌───────────────────┐               │
│     │  MongoDB Atlas  │  │  Shopify GraphQL  │               │
│     │  (Audit Log)    │  │  metafieldsSet    │               │
│     └────────────────┘  └────────┬──────────┘               │
│                                  │                          │
└──────────────────────────────────┼──────────────────────────┘
                                   │
                                   ▼
                    ┌──────────────────────────┐
                    │   Shop Metafield         │
                    │   my_app.announcement    │
                    └────────────┬─────────────┘
                                 │
                                 ▼
                    ┌──────────────────────────┐
                    │  Theme App Extension     │
                    │  (App Embed Block)        │
                    │                          │
                    │  Reads the metafield     │
                    │  and renders a banner    │
                    │  on the storefront       │
                    └──────────────────────────┘
```

**Key design decisions:**

- **Shop-owned metafields** (not app-owned) are used because app-owned metafields aren't accessible in Liquid templates. The `metafieldsSet` mutation targets the Shop GID directly.
- **MongoDB stores the audit trail** separately from Shopify, giving us a reliable history that persists even if the metafield is overwritten.
- **Session storage also uses MongoDB**, so the entire app runs on a single database — no SQLite or Prisma needed.
- **No ScriptTags** — the storefront rendering is handled entirely through a Theme App Extension (App Embed Block), as ScriptTags are deprecated.

---

## Project Structure

```
futureblink-app/
├── app/
│   ├── db.server.js              # MongoDB connection (cached singleton)
│   ├── shopify.server.js         # Shopify app config, auth, session storage
│   ├── models/
│   │   └── AuditLog.js           # Mongoose schema for audit log entries
│   ├── routes/
│   │   ├── app.jsx               # Parent layout (App Bridge + Polaris providers)
│   │   ├── app._index.jsx        # Main dashboard — form, save logic, audit table
│   │   ├── auth.$.jsx            # Auth catch-all route
│   │   └── webhooks.*.jsx        # Webhook handlers (uninstall, scopes update)
│   ├── root.jsx                  # Root document component
│   └── entry.server.jsx          # Server-side rendering entry
│
├── extensions/
│   └── announcement-banner/
│       ├── shopify.extension.toml    # Extension config
│       └── blocks/
│           └── announcement-banner.liquid  # The storefront banner template
│
├── shopify.app.toml              # App config (scopes, metafield definitions, webhooks)
├── package.json
└── .env                          # MONGO_URI (not committed to git)
```

---

## Getting Started

### Prerequisites

- **Node.js** v20.19+ (or v22.12+)
- **npm** (comes with Node)
- A [Shopify Partner](https://partners.shopify.com) account with a development store
- A [MongoDB Atlas](https://www.mongodb.com/atlas) cluster (free tier works)
- **Shopify CLI** — install with `npm install -g @shopify/cli`

### 1. Clone the repo

```bash
git clone https://github.com/Vibush01/MERN-shopify-app.git
cd MERN-shopify-app
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

Create a `.env` file in the project root:

```env
MONGO_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/<dbname>
```

> **Note:** The Shopify-related env variables (`SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, etc.) are automatically injected by the Shopify CLI when you run `npm run dev`, so you don't need to add those manually.

### 4. Connect to your Shopify app

If this is your first time running the project, the CLI will walk you through linking it to your Partner account and development store:

```bash
npm run dev
```

It will ask you to:
- Select your Partner organization
- Select or create a Shopify app
- Choose a development store
- Enter the storefront password (found in Shopify Admin → Online Store → Preferences)

### 5. Enable the Announcement Banner on your storefront

Once the dev server is running:

1. Open your Shopify Admin → **Online Store** → **Themes**
2. Click **Customize** on your active theme
3. In the theme editor, click the **App embeds** icon (🧩 puzzle piece, in the left sidebar)
4. Toggle **Announcement Banner** to ON
5. Click **Save**

Now go back to the app in the Shopify Admin, type an announcement, and hit save. The banner should appear on your storefront.

---

## How It Works

### Saving an announcement

When the merchant submits the form, the React Router `action` function in `app._index.jsx` runs server-side:

1. **Validates** the input (non-empty text).
2. **Saves to MongoDB** — creates a new `AuditLog` document with the text and a timestamp.
3. **Queries the Shop GID** — runs a quick GraphQL query to get the shop's unique ID.
4. **Sets the metafield** — calls the `metafieldsSet` mutation with the shop GID as the owner, writing to namespace `my_app` and key `announcement`.

### Displaying on the storefront

The Theme App Extension is a Liquid block that runs on every page:

```liquid
{% assign announcement_text = shop.metafields.my_app.announcement.value %}

{% if announcement_text != blank %}
  <!-- renders the banner -->
{% endif %}
```

It's configured as an **App Embed** (target: `body`), so merchants don't need to manually place it in their theme. They just toggle it on in the theme customizer under App Embeds.

The banner supports merchant customization through the theme editor:
- **Background color** (default: `#1a1a2e`)
- **Text color** (default: `#ffffff`)
- **Font size** (range: 12–24px)

There's also a dismiss button that slides the banner off-screen.

### Metafield declaration

The metafield is declared in `shopify.app.toml` so Shopify knows about it ahead of time:

```toml
[shop.metafields.my_app.announcement]
type = "single_line_text_field"
name = "Announcement Banner Text"

  [shop.metafields.my_app.announcement.access]
  admin = "merchant_read_write"
  storefront = "public_read"
```

`storefront = "public_read"` is what makes the metafield readable in Liquid templates on the storefront.

---

## Deployment

The app is deployed on **Render** as a Node.js web service.

To deploy your own instance:

1. Push the repo to GitHub.
2. Create a new **Web Service** on [Render](https://render.com).
3. Connect your GitHub repo and set:
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm run start`
4. Add environment variables: `MONGO_URI`, `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `NODE_ENV=production`.
5. After deploying, update the `application_url` in `shopify.app.toml` with your Render URL.
6. Run `npm run deploy` locally to push the updated config and theme extension to Shopify.

---

## Useful Commands

| Command | What it does |
|---------|-------------|
| `npm run dev` | Start the dev server (Shopify CLI handles tunneling, env vars, etc.) |
| `npm run build` | Build for production |
| `npm run deploy` | Deploy the app config and extensions to Shopify |
| `npm run start` | Start the production server |
| `npm run lint` | Run ESLint |

---

## Built By

**Vivek Kumar** — [GitHub](https://github.com/Vibush01)
