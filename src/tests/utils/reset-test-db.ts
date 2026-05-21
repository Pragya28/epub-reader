import { db } from "@/services/storage/db";

export async function resetTestDb() {
  await db.delete();
  await db.open();
}
