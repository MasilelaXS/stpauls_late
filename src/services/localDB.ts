import Dexie, { type Table } from "dexie";

// Define types for our database tables matching PHP backend structure
export interface Learner {
  id?: number;
  student_number: string;
  last_name: string;
  first_name: string;
  gender: "M" | "F";
  grade: string;
  phone_home: string;
  phone_emergency: string;
  academic_year_id: number;
}

export interface LateQueueItem {
  id?: number;
  learner_id: number;
  academic_year_id: number;
  user_id: number;
  late_date: string; // ISO date string for consistency
  recorded_at?: string; // ISO date string, optional for offline records
}

export interface User {
  id?: number;
  username: string;
  password_hash: string;
}

export interface AcademicYear {
  id?: number;
  year_label: string;
  is_current: boolean;
}

// Create the database class
class StPaulsDatabase extends Dexie {
  // Define tables
  learners!: Table<Learner, number>;
  lateQueue!: Table<LateQueueItem, number>;
  users!: Table<User, number>;
  academicYears!: Table<AcademicYear, number>;

  constructor() {
    super("StPaulsDB"); // Define schema version
    this.version(1).stores({
      learners:
        "++id, student_number, last_name, first_name, gender, grade, academic_year_id",
      lateQueue:
        "++id, learner_id, academic_year_id, user_id, late_date, recorded_at",
      users: "++id, username",
      academicYears: "++id, year_label, is_current",
    });
  }
}

// Create and export a database instance
const db = new StPaulsDatabase();

export default db;

// Helper functions for common database operations

// Learner operations
export async function addLearner(
  learner: Omit<Learner, "id">
): Promise<number> {
  return await db.learners.add(learner as Learner);
}

export async function getLearners(): Promise<Learner[]> {
  return await db.learners.toArray();
}

export async function getLearnerById(id: number): Promise<Learner | undefined> {
  return await db.learners.get(id);
}

export async function updateLearner(
  id: number,
  changes: Partial<Learner>
): Promise<number> {
  return await db.learners.update(id, changes);
}

/**
 * Cache learners from API response
 * @param learners Array of learners to cache
 */
export async function cacheLearners(learners: Learner[]): Promise<void> {
  try {
    // Clear existing learners for the current academic year
    await db.learners.clear();

    // Add all learners to cache
    await db.learners.bulkAdd(learners);

    console.log(`[LocalDB] Cached ${learners.length} learners`);
  } catch (error) {
    console.error("[LocalDB] Failed to cache learners:", error);
    throw error;
  }
}

// Late queue operations
/**
 * Add a late record to the offline queue
 * @param lateRecord Late record data
 */
export async function addLateRecord(lateRecord: {
  learner_id: number;
  academic_year_id: number;
  user_id: number;
  late_date?: string;
}): Promise<number> {
  const record: Omit<LateQueueItem, "id"> = {
    learner_id: lateRecord.learner_id,
    academic_year_id: lateRecord.academic_year_id,
    user_id: lateRecord.user_id,
    late_date: lateRecord.late_date || new Date().toISOString(),
    recorded_at: new Date().toISOString(),
  };

  try {
    const id = await db.lateQueue.add(record as LateQueueItem);
    console.log(
      `[LocalDB] Added late record to queue: learner_id=${record.learner_id}`
    );
    return id;
  } catch (error) {
    console.error("[LocalDB] Failed to add late record:", error);
    throw error;
  }
}

/**
 * Get all late records from the queue
 */
export async function getLateQueue(): Promise<LateQueueItem[]> {
  try {
    return await db.lateQueue.toArray();
  } catch (error) {
    console.error("[LocalDB] Failed to get late queue:", error);
    throw error;
  }
}

/**
 * Clear all late records from the queue
 */
export async function clearLateQueue(): Promise<void> {
  try {
    await db.lateQueue.clear();
    console.log("[LocalDB] Cleared late queue");
  } catch (error) {
    console.error("[LocalDB] Failed to clear late queue:", error);
    throw error;
  }
}

/**
 * Remove specific late record from queue (used after successful sync)
 */
export async function removeLateQueueItem(id: number): Promise<void> {
  try {
    await db.lateQueue.delete(id);
    console.log(`[LocalDB] Removed late record ${id} from queue`);
  } catch (error) {
    console.error(`[LocalDB] Failed to remove late record ${id}:`, error);
    throw error;
  }
}

// Legacy function - keeping for backward compatibility
export async function addToLateQueue(lateItem: {
  learner_id: number;
  academic_year_id: number;
  user_id: number;
}): Promise<number> {
  return await addLateRecord(lateItem);
}

// User operations
export async function addUser(user: Omit<User, "id">): Promise<number> {
  return await db.users.add(user as User);
}

export async function getUserByUsername(
  username: string
): Promise<User | undefined> {
  return await db.users.where("username").equals(username).first();
}

// Academic Year operations
export async function addAcademicYear(
  year: Omit<AcademicYear, "id">
): Promise<number> {
  return await db.academicYears.add(year as AcademicYear);
}

export async function getCurrentAcademicYear(): Promise<
  AcademicYear | undefined
> {
  return await db.academicYears.where("is_current").equals(1).first();
}

export async function getAcademicYears(): Promise<AcademicYear[]> {
  return await db.academicYears.toArray();
}
