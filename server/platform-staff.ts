import { eq } from "drizzle-orm";
import { platformStaff } from "@shared/schema";
import { db } from "./db";

export type StaffGrant = typeof platformStaff.$inferSelect;
export interface PlatformStaffStore {
  get(userId: string): Promise<StaffGrant | undefined>;
  list(): Promise<StaffGrant[]>;
  setAccess(userId: string, active: boolean, ownerId: string): Promise<void>;
}
export function createPlatformStaffStore(database = db): PlatformStaffStore {
  return {
    async get(userId) {
      const [grant] = await database.select().from(platformStaff).where(eq(platformStaff.userId, userId));
      return grant;
    },
    async list() { return database.select().from(platformStaff); },
    async setAccess(userId, active, ownerId) {
      await database.insert(platformStaff).values({ userId, active, grantedBy: ownerId })
        .onConflictDoUpdate({ target: platformStaff.userId, set: { active, grantedBy: ownerId, updatedAt: new Date() } });
    },
  };
}
export const platformStaffStore = createPlatformStaffStore();
export function legacySupportIds() {
  return (process.env.SUPPORT_USER_IDS || "").split(",").map(id => id.trim()).filter(Boolean);
}
