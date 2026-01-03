import { Router } from 'express';
import { db } from '../db';
import { workoutPlans, coachClients, users } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { isAuthenticated } from '../replitAuth';

const router = Router();

// ✅ 1. 創建訓練計劃
router.post('/workout-plans', isAuthenticated, async (req: any, res: any) => {
  try {
    const {
      clientId,
      name,
      description,
      exercises,
      weekDays,
      duration,
      notes,
    } = req.body;

    const coachId = req.user?.claims?.sub || req.user?.id;

    if (!coachId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // 驗證是教練
    const coachResult = await db
      .select()
      .from(users)
      .where(eq(users.id, coachId))
      .limit(1);

    const coach = coachResult[0];

    if (coach?.role !== 'coach') {
      return res.status(403).json({ error: 'Only coaches can create plans' });
    }

    // 驗證權限 - 教練已添加該學生
    const relationshipResult = await db
      .select()
      .from(coachClients)
      .where(
        and(
          eq(coachClients.coachId, coachId),
          eq(coachClients.clientId, clientId)
        )
      )
      .limit(1);

    if (relationshipResult.length === 0) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // 驗證必要字段
    if (!name || !exercises || !weekDays || !duration) {
      return res.status(400).json({
        error: 'Missing required fields: name, exercises, weekDays, duration',
      });
    }

    const plan = await db
      .insert(workoutPlans)
      .values({
        coachId,
        clientId,
        name,
        description: description || null,
        exercises: JSON.stringify(exercises),
        weekDays: JSON.stringify(weekDays),
        duration: parseInt(duration.toString()),
        notes: notes || null,
        status: 'draft',
      })
      .returning();

    res.json({ success: true, plan: plan[0] });
  } catch (error) {
    console.error('Error creating workout plan:', error);
    res.status(500).json({ error: 'Failed to create workout plan' });
  }
});

// ✅ 2. 獲取學生的訓練計劃
router.get('/workout-plans/client/:clientId', isAuthenticated, async (req: any, res: any) => {
  try {
    const { clientId } = req.params;
    const userId = req.user?.claims?.sub || req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // 驗證權限 - 是教練或是學生本人
    if (userId !== clientId) {
      const relationshipResult = await db
        .select()
        .from(coachClients)
        .where(
          and(
            eq(coachClients.coachId, userId),
            eq(coachClients.clientId, clientId)
          )
        )
        .limit(1);

      if (relationshipResult.length === 0) {
        return res.status(403).json({ error: 'Not authorized' });
      }
    }

    const plans = await db
      .select()
      .from(workoutPlans)
      .where(eq(workoutPlans.clientId, clientId));

    // 解析 JSON 字段
    const parsedPlans = plans.map((p) => {
      let exercises = null;
      let weekDays = null;
      
      try {
        exercises = p.exercises ? JSON.parse(p.exercises) : null;
      } catch (e) {
        console.error('Error parsing exercises JSON:', e);
        exercises = null;
      }
      
      try {
        weekDays = p.weekDays ? JSON.parse(p.weekDays) : null;
      } catch (e) {
        console.error('Error parsing weekDays JSON:', e);
        weekDays = null;
      }
      
      return {
        ...p,
        exercises,
        weekDays,
      };
    });

    res.json(parsedPlans);
  } catch (error) {
    console.error('Error fetching workout plans:', error);
    res.status(500).json({ error: 'Failed to fetch workout plans' });
  }
});

// ✅ 3. 獲取單個訓練計劃
router.get('/workout-plans/:id', isAuthenticated, async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const userId = req.user?.claims?.sub || req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const planResult = await db
      .select()
      .from(workoutPlans)
      .where(eq(workoutPlans.id, id))
      .limit(1);

    if (planResult.length === 0) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    const plan = planResult[0];

    // 驗證權限
    if (userId !== plan.coachId && userId !== plan.clientId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    let exercises = null;
    let weekDays = null;
    
    try {
      exercises = plan.exercises ? JSON.parse(plan.exercises) : null;
    } catch (e) {
      console.error('Error parsing exercises JSON:', e);
      exercises = null;
    }
    
    try {
      weekDays = plan.weekDays ? JSON.parse(plan.weekDays) : null;
    } catch (e) {
      console.error('Error parsing weekDays JSON:', e);
      weekDays = null;
    }
    
    const result = {
      ...plan,
      exercises,
      weekDays,
    };

    res.json(result);
  } catch (error) {
    console.error('Error fetching workout plan:', error);
    res.status(500).json({ error: 'Failed to fetch workout plan' });
  }
});

// ✅ 4. 更新訓練計劃
router.put('/workout-plans/:id', isAuthenticated, async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const { name, description, exercises, weekDays, duration, notes, status } = req.body;
    const coachId = req.user?.claims?.sub || req.user?.id;

    if (!coachId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // 驗證權限 - 只有教練能編輯
    const planResult = await db
      .select()
      .from(workoutPlans)
      .where(eq(workoutPlans.id, id))
      .limit(1);

    if (planResult.length === 0) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    const plan = planResult[0];

    if (plan.coachId !== coachId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const updated = await db
      .update(workoutPlans)
      .set({
        name: name || plan.name,
        description: description !== undefined ? description : plan.description,
        exercises: exercises ? JSON.stringify(exercises) : plan.exercises,
        weekDays: weekDays ? JSON.stringify(weekDays) : plan.weekDays,
        duration: duration ? parseInt(duration.toString()) : plan.duration,
        notes: notes !== undefined ? notes : plan.notes,
        status: status || plan.status,
        updatedAt: new Date(),
      })
      .where(eq(workoutPlans.id, id))
      .returning();

    let parsedExercises = null;
    let parsedWeekDays = null;
    
    try {
      parsedExercises = updated[0].exercises ? JSON.parse(updated[0].exercises) : null;
    } catch (e) {
      console.error('Error parsing exercises JSON:', e);
      parsedExercises = null;
    }
    
    try {
      parsedWeekDays = updated[0].weekDays ? JSON.parse(updated[0].weekDays) : null;
    } catch (e) {
      console.error('Error parsing weekDays JSON:', e);
      parsedWeekDays = null;
    }
    
    const result = {
      ...updated[0],
      exercises: parsedExercises,
      weekDays: parsedWeekDays,
    };

    res.json({ success: true, result });
  } catch (error) {
    console.error('Error updating workout plan:', error);
    res.status(500).json({ error: 'Failed to update workout plan' });
  }
});

// ✅ 5. 刪除訓練計劃
router.delete('/workout-plans/:id', isAuthenticated, async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const coachId = req.user?.claims?.sub || req.user?.id;

    if (!coachId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // 驗證權限
    const planResult = await db
      .select()
      .from(workoutPlans)
      .where(eq(workoutPlans.id, id))
      .limit(1);

    if (planResult.length === 0) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    const plan = planResult[0];

    if (plan.coachId !== coachId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await db.delete(workoutPlans).where(eq(workoutPlans.id, id));

    res.json({ success: true, message: 'Workout plan deleted' });
  } catch (error) {
    console.error('Error deleting workout plan:', error);
    res.status(500).json({ error: 'Failed to delete workout plan' });
  }
});

// ✅ 6. 更新計劃狀態（發布、完成等）
router.put('/workout-plans/:id/status', isAuthenticated, async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const { status, startDate, endDate } = req.body;
    const coachId = req.user?.claims?.sub || req.user?.id;

    if (!coachId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    if (!['draft', 'active', 'completed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const planResult = await db
      .select()
      .from(workoutPlans)
      .where(eq(workoutPlans.id, id))
      .limit(1);

    if (planResult.length === 0) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    const plan = planResult[0];

    if (plan.coachId !== coachId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const updated = await db
      .update(workoutPlans)
      .set({
        status,
        startDate: startDate ? new Date(startDate) : plan.startDate,
        endDate: endDate ? new Date(endDate) : plan.endDate,
      })
      .where(eq(workoutPlans.id, id))
      .returning();

    res.json({ success: true, updated: updated[0] });
  } catch (error) {
    console.error('Error updating plan status:', error);
    res.status(500).json({ error: 'Failed to update plan status' });
  }
});

export default router;

