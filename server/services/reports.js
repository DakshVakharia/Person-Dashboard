import { db } from '../db.js';

export function generateSimpleWeeklyReport() {
  try {
    const today = new Date();
    const endStr = today.toISOString().split('T')[0];
    
    const start = new Date(today);
    start.setDate(today.getDate() - 7);
    const startStr = start.toISOString().split('T')[0];

    // Gather basic stats for the past 7 days
    let totalProtein = 0;
    let totalWorkouts = 0;
    let habitsCompleted = 0;
    let habitsTotal = 0;

    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i + 1); // up to today
      const dateStr = d.toISOString().split('T')[0];

      const rings = db.prepare('SELECT * FROM daily_rings WHERE date = ?').get(dateStr);
      if (rings) {
        totalProtein += (rings.protein_intake || 0);
        if (rings.workout_done) totalWorkouts++;
      }

      const hLogs = db.prepare('SELECT completed FROM habit_logs WHERE date = ? AND completed = 1').all(dateStr);
      habitsCompleted += hLogs.length;
      
      const allHabitsCount = db.prepare('SELECT count(*) as c FROM habits WHERE is_active = 1').get().c;
      habitsTotal += allHabitsCount;
    }

    const reportData = JSON.stringify({
      totalProtein,
      totalWorkouts,
      habitsCompleted,
      habitsTotal,
      summary: `You had ${totalWorkouts} workouts, consumed ${totalProtein}g of protein, and completed ${habitsCompleted} out of ${habitsTotal} habit goals.`
    });

    db.prepare(`
      INSERT INTO weekly_reports (week_start, week_end, report_data)
      VALUES (?, ?, ?)
    `).run(startStr, endStr, reportData);

    console.log('[Reports] Weekly report generated successfully.');
  } catch (e) {
    console.error('[Reports] Error generating weekly report:', e.message);
  }
}
