import { doublePrecision, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const campusPlacesTable = pgTable("campus_places", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
  note: text("note").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type CampusPlaceRecord = typeof campusPlacesTable.$inferSelect;
