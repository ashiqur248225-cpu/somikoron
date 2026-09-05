
/**
 * @fileOverview Authoritative Meal Synchronization Service
 * Handles background syncing of missing meals for students in Auto Mode.
 * Ensures idempotency and respects admin global restrictions.
 */

import { Firestore, doc, getDoc, collection, query, where, getDocs, writeBatch, increment, serverTimestamp } from "firebase/firestore";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const getLocYMD = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export async function syncMissingAutoMeals(db: Firestore, branch: string, specificStudentId?: string) {
  if (!branch) return { success: false, msg: "Branch context missing" };

  console.log(`[AUTO_SYNC_STARTED] Branch: ${branch}, Target: ${specificStudentId || 'ALL'}`);

  try {
    // 1. Fetch Global Meal Config for the branch
    const configRef = doc(db, "configs", `mealConfig_${branch}`);
    const configSnap = await getDoc(configRef);
    const mealConfig = configSnap.exists() ? configSnap.data() : { breakfastAvailable: true, lunchAvailable: true, dinnerAvailable: true };

    // 2. Identify relevant students
    let students: any[] = [];
    if (specificStudentId) {
      const sSnap = await getDoc(doc(db, "students", specificStudentId));
      if (sSnap.exists()) students = [{ ...sSnap.data(), id: sSnap.id }];
    } else {
      const q = query(collection(db, "students"), where("branch", "==", branch), where("isActive", "==", true));
      const qSnap = await getDocs(q);
      students = qSnap.docs.map(d => ({ ...d.data(), id: d.id }));
    }

    const batch = writeBatch(db);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const yesterdayStr = getLocYMD(yesterday);
    
    let syncCount = 0;
    let totalMealsAdded = 0;

    for (const student of students) {
      if (!student.mealStatus?.autoMode || !student.lastMealUpdateDate) continue;
      
      const lastUpdateStr = student.lastMealUpdateDate;
      // If already updated up to or past yesterday, skip (Idempotency)
      if (lastUpdateStr >= yesterdayStr) continue;

      console.log(`[SYNCING_STUDENT] ${student.name} (${student.id})`);
      console.log(`- last_sync_date: ${lastUpdateStr}`);
      console.log(`- sync_until_date: ${yesterdayStr}`);

      syncCount++;
      const lastUpdate = new Date(lastUpdateStr);
      let checkDecisionDate = new Date(lastUpdate.getFullYear(), lastUpdate.getMonth(), lastUpdate.getDate());
      
      let currentMonthLabel = student.currentMonthLabel;
      let increments = { b: 0, l: 0, d: 0 };
      let missingDates: string[] = [];

      // Iterative check for missing days
      while (getLocYMD(checkDecisionDate) < yesterdayStr) {
        checkDecisionDate.setDate(checkDecisionDate.getDate() + 1);
        const decisionYMD = getLocYMD(checkDecisionDate);
        missingDates.push(decisionYMD);
        
        // The meal occurs on the day AFTER the decision handled by Auto Mode
        const mealDate = new Date(checkDecisionDate);
        mealDate.setDate(mealDate.getDate() + 1);
        const mealMonthLabel = `${MONTHS[mealDate.getMonth()]} ${mealDate.getFullYear()}`;
        
        // Month transition handling
        if (currentMonthLabel && currentMonthLabel !== mealMonthLabel) {
           currentMonthLabel = mealMonthLabel;
           // In background sync, we'll continue the increment on the student record
           // as the PHYSICAL count is what matters for the billing cycle.
        } else if (!currentMonthLabel) {
           currentMonthLabel = mealMonthLabel;
        }

        const dayName = WEEKDAYS[mealDate.getDay()];
        const sched = student.weeklySchedule?.[dayName] || { breakfast: true, lunch: true, dinner: true };
        
        // Respect Admin Global Settings (Hard Restriction)
        if (sched.breakfast && mealConfig.breakfastAvailable !== false) { increments.b += 1; totalMealsAdded++; }
        if (sched.lunch && mealConfig.lunchAvailable !== false) { increments.l += 1; totalMealsAdded++; }
        if (sched.dinner && mealConfig.dinnerAvailable !== false) { increments.d += 1; totalMealsAdded++; }
      }

      console.log(`- missing_dates: ${missingDates.join(', ')}`);
      console.log(`- meals_to_insert: B:${increments.b}, L:${increments.l}, D:${increments.d}`);

      if (totalMealsAdded > 0 || getLocYMD(checkDecisionDate) !== lastUpdateStr) {
        const updateData: any = {
          lastMealUpdateDate: getLocYMD(checkDecisionDate),
          currentMonthLabel,
          updatedAt: serverTimestamp()
        };

        // Protected Incremental Update (Does not overwrite manual entries)
        if (increments.b > 0) updateData.currentMonthBreakfast = increment(increments.b);
        if (increments.l > 0) updateData.currentMonthLunch = increment(increments.l);
        if (increments.d > 0) updateData.currentMonthDinner = increment(increments.d);

        batch.update(doc(db, "students", student.id), updateData);
      }
    }

    if (syncCount > 0) {
      await batch.commit();
      console.log(`[AUTO_SYNC_COMPLETED] Synced ${syncCount} students. Total meals added: ${totalMealsAdded}`);
    } else {
      console.log(`[AUTO_SYNC_COMPLETED] Everything already up to date.`);
    }

    return { success: true, syncedStudents: syncCount, mealsAdded: totalMealsAdded };
  } catch (error: any) {
    console.error("[AUTO_SYNC_ERROR] Details:", error);
    return { success: false, error: error.message };
  }
}

// Development simulation tool
if (typeof window !== 'undefined') {
  (window as any).simulateMealSync = async (studentId: string, fakeLastUpdate: string) => {
    console.warn(`[TEST_MODE] Simulating sync for ${studentId} from ${fakeLastUpdate}`);
    const db = (window as any).firebaseDb;
    if (!db) return "DB not accessible in window. Open a page that uses Firebase first.";
    try {
      const { updateDoc } = await import("firebase/firestore");
      await updateDoc(doc(db, "students", studentId), { lastMealUpdateDate: fakeLastUpdate });
      return `Simulated date set to ${fakeLastUpdate}. Refresh any meal page to trigger sync.`;
    } catch (e: any) { return e.message; }
  };
}
