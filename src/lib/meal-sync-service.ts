
/**
 * @fileOverview Authoritative Meal & Utility Synchronization Service
 * Handles background syncing of missing meals for students in Auto Mode
 * and automatic monthly charging of Utility Bills (Cooking Bill).
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

  console.log(`[SYNC_STARTED] Branch: ${branch}, Target: ${specificStudentId || 'ALL'}`);

  try {
    // 1. Fetch Global Configs
    const mealConfigRef = doc(db, "configs", `mealConfig_${branch}`);
    const billingConfigRef = doc(db, "configs", `billingConfig_${branch}`);
    
    const [mealConfigSnap, billingConfigSnap] = await Promise.all([
      getDoc(mealConfigRef),
      getDoc(billingConfigRef)
    ]);

    const mealConfig = mealConfigSnap.exists() ? mealConfigSnap.data() : { breakfastAvailable: true, lunchAvailable: true, dinnerAvailable: true };
    const billingConfig = billingConfigSnap.exists() ? billingConfigSnap.data() : { cookingBill: 500 };

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
    
    const currentMonthLabel = `${MONTHS[today.getMonth()]} ${today.getFullYear()}`;
    
    let syncCount = 0;
    let totalMealsAdded = 0;
    let utilityChargesCount = 0;

    for (const student of students) {
      let studentUpdateData: any = {};
      let needsUpdate = false;

      // --- LOGIC A: AUTOMATIC MONTHLY COOKING BILL CHARGE ---
      // If student hasn't been charged for current month yet
      if (student.lastCookingBillMonth !== currentMonthLabel) {
        const chargeAmount = Number(billingConfig.cookingBill || 0);
        if (chargeAmount > 0) {
          studentUpdateData.cookingDueAmount = increment(-chargeAmount);
          studentUpdateData.lastCookingBillMonth = currentMonthLabel;
          needsUpdate = true;
          utilityChargesCount++;
          console.log(`[UTILITY_CHARGE] Charged ৳${chargeAmount} to ${student.name} for ${currentMonthLabel}`);
        }
      }

      // --- LOGIC B: MISSING MEAL SYNC (AUTO MODE ONLY) ---
      if (student.mealStatus?.autoMode && student.lastMealUpdateDate) {
        const lastUpdateStr = student.lastMealUpdateDate;
        
        // If already updated up to or past yesterday, skip meal part
        if (lastUpdateStr < yesterdayStr) {
          syncCount++;
          const lastUpdate = new Date(lastUpdateStr);
          let checkDecisionDate = new Date(lastUpdate.getFullYear(), lastUpdate.getMonth(), lastUpdate.getDate());
          
          let targetMonthLabel = student.currentMonthLabel || currentMonthLabel;
          let increments = { b: 0, l: 0, d: 0 };

          // Iterative check for missing days
          while (getLocYMD(checkDecisionDate) < yesterdayStr) {
            checkDecisionDate.setDate(checkDecisionDate.getDate() + 1);
            
            // The meal occurs on the day AFTER the decision handled by Auto Mode
            const mealDate = new Date(checkDecisionDate);
            mealDate.setDate(mealDate.getDate() + 1);
            const mealMonthLabel = `${MONTHS[mealDate.getMonth()]} ${mealDate.getFullYear()}`;
            
            // Month transition handling for meals
            if (targetMonthLabel && targetMonthLabel !== mealMonthLabel) {
               targetMonthLabel = mealMonthLabel;
            }

            const dayName = WEEKDAYS[mealDate.getDay()];
            const sched = student.weeklySchedule?.[dayName] || { breakfast: true, lunch: true, dinner: true };
            
            if (sched.breakfast && mealConfig.breakfastAvailable !== false) { increments.b += 1; totalMealsAdded++; }
            if (sched.lunch && mealConfig.lunchAvailable !== false) { increments.l += 1; totalMealsAdded++; }
            if (sched.dinner && mealConfig.dinnerAvailable !== false) { increments.d += 1; totalMealsAdded++; }
          }

          studentUpdateData.lastMealUpdateDate = getLocYMD(checkDecisionDate);
          studentUpdateData.currentMonthLabel = targetMonthLabel;
          if (increments.b > 0) studentUpdateData.currentMonthBreakfast = increment(increments.b);
          if (increments.l > 0) studentUpdateData.currentMonthLunch = increment(increments.l);
          if (increments.d > 0) studentUpdateData.currentMonthDinner = increment(increments.d);
          
          needsUpdate = true;
        }
      }

      if (needsUpdate) {
        studentUpdateData.updatedAt = serverTimestamp();
        batch.update(doc(db, "students", student.id), studentUpdateData);
      }
    }

    if (syncCount > 0 || utilityChargesCount > 0) {
      await batch.commit();
      console.log(`[SYNC_COMPLETED] Synced ${syncCount} students. Meals: ${totalMealsAdded}, Utility Charges: ${utilityChargesCount}`);
    }

    return { success: true, syncedStudents: syncCount, mealsAdded: totalMealsAdded, utilityCharges: utilityChargesCount };
  } catch (error: any) {
    console.error("[SYNC_ERROR] Details:", error);
    return { success: false, error: error.message };
  }
}
