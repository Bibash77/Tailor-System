# Tailor Manager — MVP v1.0

A complete business management web app for tailoring shops.
Built with React, stored entirely in your browser using IndexedDB (no cloud, no login, no fees).

---

## Features

- **Orders** — Create customer orders, upload bill photos, track advance & remaining payments
- **Kaligadh Assignment** — Assign workers to each item, track making costs automatically
- **Kaligadh Dues** — Track worker payment dues, clear with date picker (every 15 days)
- **Dealers** — Record fabric purchases, track remaining payments, mark as paid
- **Activity Ledger** — Complete bookkeeping log of all revenue and expense events
- **Dashboard** — Financial summary: revenue, expenses, net profit, pending dues

---

## Quick Start

### Requirements
- Node.js v16 or higher — download from https://nodejs.org
- npm (comes with Node.js)

### Steps

```bash
# 1. Open terminal and go into the project folder
cd tailor-app

# 2. Install dependencies (only needed once)
npm install

# 3. Start the app
npm start
```

The app will open automatically at http://localhost:3000

---

## First Time Setup

1. Go to **Settings** first
2. Add your Kaligadh (workers) with their specialties
3. Set the making cost per item category (Shirt, Pant, Coat, Inner Coat)
4. Start creating orders!

---

## Data Storage

All data is stored in your browser's **IndexedDB** — completely local, no internet needed.

> ⚠️ Data lives in the browser. If you clear browser data/cache, you will lose all records.
> Use the same browser on the same device every time.

### Data stores:
| Store | Contents |
|---|---|
| `orders` | All customer orders |
| `kaligadhs` | Worker profiles and dues |
| `assignments` | Item-to-worker assignments |
| `dealers` | Fabric supplier purchases |
| `activity` | Full financial ledger |
| `settings` | Making costs and config |

---

## Project Structure

```
tailor-app/
├── public/
│   └── index.html
├── src/
│   ├── db/
│   │   └── index.js        ← IndexedDB layer (all read/write functions)
│   ├── utils/
│   │   └── index.js        ← Helper functions, constants, formatters
│   ├── components/
│   │   └── UI.jsx          ← Shared UI components (Modal, Badge, etc.)
│   ├── pages/
│   │   ├── Dashboard.jsx   ← Financial summary page
│   │   ├── NewOrder.jsx    ← Create order form
│   │   ├── AssignKaligadh.jsx ← Worker assignment flow
│   │   ├── Orders.jsx      ← Orders list with search & filter
│   │   ├── Kaligadh.jsx    ← Worker list and due clearance
│   │   ├── Dealers.jsx     ← Dealer purchase tracking
│   │   ├── Activity.jsx    ← Bookkeeping ledger
│   │   └── Settings.jsx    ← App configuration
│   ├── App.jsx             ← Main app shell and navigation
│   ├── index.css           ← Global design system styles
│   └── index.js            ← React entry point
└── package.json
```

---

## Financial Logic

| Event | Effect |
|---|---|
| Order created (advance > 0) | + Revenue: advance amount |
| Order marked Completed | + Revenue: remaining amount |
| Kaligadh assigned to item | − Expense: making cost (accrued) |
| Dealer entry created (paid > 0) | − Expense: paid amount |
| Dealer entry marked Paid | − Expense: remaining amount |

---

## Tech Stack

- **React 18** — UI framework
- **IndexedDB** — Browser-native database (no cloud)
- **Lucide React** — Icons
- **DM Serif Display + DM Sans** — Typography (Google Fonts)
- **Custom CSS** — Design system (no Tailwind dependency)

---

Built for Shree Tailoring Center, Bhaktapur 🧵
# Tailor-System
