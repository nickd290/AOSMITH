# Inventory Release App - Architecture

## Overview
Inventory release management system for JD Graphic <-> ePrint Group <-> AO Smith workflow.
- **JD Graphic**: Admin - manages inventory, production, parts
- **ePrint Group**: Customer - creates releases/orders
- **AO Smith**: Shipping destinations (facilities)

## Tech Stack
- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Database**: PostgreSQL via Prisma ORM
- **Storage**: AWS S3 (documents/PDFs)
- **Email**: SendGrid
- **Auth**: JWT (bcrypt for passwords)
- **PDF**: jspdf, jsbarcode, qrcode
- **Deployment**: Railway

---

## Route Registry

### API Routes (`app/api/`)

| Route | Methods | Purpose | Owner |
|-------|---------|---------|-------|
| `/api/auth/login` | POST | User authentication | auth |
| `/api/auth/me` | GET | Get current user | auth |
| `/api/releases` | GET, POST | List/create releases | releases |
| `/api/releases/[releaseId]` | GET, PUT, DELETE | Single release CRUD | releases |
| `/api/releases/[releaseId]/documents` | POST | Generate documents | documents |
| `/api/releases/[releaseId]/download/[docType]` | GET | Download generated docs | documents |
| `/api/parts` | GET, PUT | Parts management (GET list, PUT update) | inventory |
| `/api/shipping-locations` | GET, POST | AO Smith locations | inventory |
| `/api/production` | GET, POST | Production runs (add inventory) | inventory |
| `/api/cron/send-invoices` | GET | Automated invoice sending | cron |
| `/api/health` | GET | Health check | system |
| `/api/debug` | GET | Debug info | system |

### Pages (`app/`)

| Route | Purpose | Access |
|-------|---------|--------|
| `/` | Landing/home | Public |
| `/login` | Login page | Public |
| `/dashboard` | Main dashboard | Authenticated |
| `/release` | Create new release | Customer |
| `/history` | Release history | Authenticated |
| `/admin` | Admin panel | Admin only |

---

## Schema Summary

### Models

| Model | Key Fields | Relations |
|-------|------------|-----------|
| `User` | id, email, password, name, role | releases[], productions[] |
| `Part` | partNumber, description, unitsPerBox, pricePerUnit, currentPallets, currentBoxes | releases[], productions[] |
| `ShippingLocation` | name, address, city, state, zip | releases[] |
| `Release` | releaseNumber, partId, shippingLocationId, pallets, boxes, customerPONumber, status | part, shippingLocation, user |
| `Production` | partId, pallets, boxes, totalUnits | part, user |

### Enums
- `Role`: CUSTOMER, ADMIN
- `ReleaseStatus`: COMPLETED, SHIPPED

---

## File Ownership Map

| Directory | Purpose |
|-----------|---------|
| `app/api/auth/` | Authentication endpoints |
| `app/api/releases/` | Release CRUD + documents |
| `app/api/parts/` | Parts management |
| `app/api/shipping-locations/` | Location management |
| `app/api/production/` | Production runs |
| `app/api/cron/` | Scheduled jobs |
| `lib/auth.ts` | JWT utilities |
| `lib/db.ts` | Prisma client |
| `lib/storage.ts` | S3 utilities |
| `lib/documents/` | PDF generation (packing slips, labels, invoices) |
| `lib/email/` | SendGrid integration |
| `lib/integrations/` | External integrations |
| `contexts/` | React contexts |
| `prisma/` | Schema and migrations |

---

## Core Flows

### Release Creation Flow
1. Customer selects part, shipping location, quantities
2. System calculates totalUnits from pallets/boxes
3. Release created with COMPLETED status
4. Documents can be generated (packing slip, box labels, invoice)
5. Admin ships and updates status to SHIPPED

### Production Flow
1. Admin adds production run (pallets/boxes for a part)
2. System updates Part.currentPallets and currentBoxes
3. Inventory available for releases

### Document Generation
- Packing Slip: PDF with order details, shipping info
- Box Labels: Barcodes/QR codes for each box
- Invoice: Billing document for customer
