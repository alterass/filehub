import { bigint, index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role').notNull().default('admin'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const nodes = pgTable(
  'nodes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    parentId: uuid('parent_id'),
    ownerId: uuid('owner_id').notNull(),
    name: text('name').notNull(),
    // 'folder' | 'file'
    type: text('type').notNull(),
    size: bigint('size', { mode: 'number' }).notNull().default(0),
    mimeType: text('mime_type'),
    storageKey: text('storage_key'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_nodes_parent').on(t.parentId),
    index('idx_nodes_owner').on(t.ownerId),
    index('idx_nodes_name').on(t.name),
    uniqueIndex('idx_nodes_unique_name').on(t.parentId, t.ownerId, t.name),
  ],
);

export type UserRow = typeof users.$inferSelect;
export type NodeRow = typeof nodes.$inferSelect;
