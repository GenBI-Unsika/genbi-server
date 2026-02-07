# Database Migration: UUID to Integer IDs & Role System Expansion

## Overview

This document describes the major database changes implemented for GenBI Unsika platform.

## Changes Summary

### 1. ID Type Change: UUID → Integer Auto-increment

**Before:**

```prisma
model User {
  id String @id @default(uuid())
  // ...
}
```

**After:**

```prisma
model User {
  id Int @id @default(autoincrement())
  // ...
}
```

All models now use simple integer IDs (1, 2, 3, ...) instead of UUIDs.

### 2. Database Naming Convention: snake_case

Using Prisma's `@map` and `@@map` directives, all database tables and columns use snake_case:

**Example:**

```prisma
model TeamMember {
  id         Int     @id @default(autoincrement())
  divisionId Int     @map("division_id")
  createdAt  DateTime @default(now()) @map("created_at")

  @@map("team_members")
}
```

- Code uses camelCase: `divisionId`, `createdAt`
- Database uses snake_case: `division_id`, `created_at`

### 3. Expanded Role System

**Before (2 roles):**

- `admin`
- `member`

**After (6 roles):**
| Role | Level | Description |
|------|-------|-------------|
| `super_admin` | 6 | Full system access |
| `admin` | 5 | Administrative access |
| `koordinator` | 4 | Division coordinator |
| `awardee` | 3 | Active scholarship recipient |
| `member` | 2 | Regular member |
| `alumni` | 1 | Former member |

**Admin Panel Access:**

- `super_admin`, `admin`, `koordinator` can access admin panel

### 4. TeamMember Division Relation

**Before:** Division as string field

```prisma
model TeamMember {
  division String
}
```

**After:** Proper foreign key relation

```prisma
model TeamMember {
  divisionId Int
  division   Division @relation(fields: [divisionId], references: [id])
}
```

### 5. MemberPoint & TreasuryEntry Relations

Added required user relations for auditing:

```prisma
model MemberPoint {
  awardedBy Int   // User who awarded the points
  awarder   User  @relation(fields: [awardedBy], references: [id])
}

model TreasuryEntry {
  recordedBy Int   // User who recorded the entry
  recorder   User  @relation(fields: [recordedBy], references: [id])
}
```

## Migration Steps

### Step 1: Backup Current Database

```bash
# Create database backup
mysqldump -u root -p genbi_db > backup_before_migration.sql
```

### Step 2: Reset Database (Development Only)

For development, drop and recreate the database:

```bash
# Using MySQL
mysql -u root -p -e "DROP DATABASE genbi_db; CREATE DATABASE genbi_db;"
```

### Step 3: Run Prisma Migration

```bash
cd genbi-server

# Generate Prisma client
npx prisma generate

# Create and apply migration
npx prisma migrate dev --name snake_case_int_ids

# Or for production (no prompt)
npx prisma migrate deploy
```

### Step 4: Seed the Database

```bash
# Set environment variables
export SEED_ADMIN_EMAIL="admin@genbi.id"
export SEED_ADMIN_PASSWORD="yourSecurePassword123"
export ADMIN_ROLE="super_admin"

# Run seed
npx prisma db seed
```

## API Changes

### ID Parameters

All route parameters that accept IDs now expect integers:

```javascript
// Before
GET / api / v1 / teams / abc123 - uuid - string;

// After
GET / api / v1 / teams / 1;
```

### Role-Based Authorization

New middleware functions:

```javascript
// Require admin panel access (super_admin, admin, koordinator)
requireAdminAccess;

// Require minimum role level
requireMinRole('awardee'); // Allows awardee, koordinator, admin, super_admin
```

### Response Format

TeamMember responses include division name for backward compatibility:

```json
{
  "id": 1,
  "name": "John Doe",
  "divisionId": 1,
  "division": "Divisi Komunikasi"
  // ...
}
```

## Updated Files

### Schema

- `prisma/schema.prisma` - Complete schema rewrite

### Middleware

- `src/middleware/auth.js` - Added ADMIN_ROLES, requireAdminAccess, requireMinRole

### Routes (all updated for parseInt and new auth)

- `src/routes/teams.routes.js`
- `src/routes/divisions.routes.js`
- `src/routes/treasury.routes.js`
- `src/routes/leaderboard.routes.js`
- `src/routes/articles.routes.js`
- `src/routes/activities.routes.js`
- `src/routes/events.routes.js`
- `src/routes/files.routes.js`
- `src/routes/scholarships.routes.js`
- `src/routes/dispensations.routes.js`
- `src/routes/master-data.routes.js`
- `src/routes/google-calendar.routes.js`
- `src/routes/me.routes.js`
- `src/routes/auth.routes.js`

### Scripts

- `scripts/create-admin.mjs` - Updated for new role system
- `prisma/seed.mjs` - Updated for new schema

## Frontend Updates Required

### Handle Integer IDs

```javascript
// Before
const memberId = member.id; // "uuid-string"

// After
const memberId = member.id; // 1 (number)
```

### API Calls

Ensure ID parameters are passed as integers or will be parsed correctly:

```javascript
// These all work
fetch(`/api/v1/teams/${1}`);
fetch(`/api/v1/teams/${'1'}`); // String "1" is parsed to int on server
```

## Rollback Plan

If issues occur:

1. Restore database from backup
2. Revert to previous schema.prisma
3. Run `npx prisma generate`
4. Revert route changes

## Testing Checklist

- [ ] Create admin user with seed
- [ ] Login with new admin
- [ ] CRUD operations on all entities
- [ ] Role-based access control
- [ ] Division relations working
- [ ] Leaderboard points display
- [ ] Treasury entries display
