/**
 * 4-Week Cycle Utility
 *
 * Implements the compliance calculation specification:
 * - Reports are due every 4 weeks from internship startDate
 * - Deadline: 5 days after 4-week cycle ends
 * - Each student has DIFFERENT deadlines based on their start date
 * - Visits are aligned with report cycles (1 per 4-week cycle)
 *
 * Example:
 * Internship Start: Dec 15, 2025
 * Report 1 cycle: Dec 15 - Jan 11 (4 weeks) → Due by Jan 16 (5 days grace)
 * Report 2 cycle: Jan 12 - Feb 8 → Due by Feb 13
 * Report 3 cycle: Feb 9 - Mar 8 → Due by Mar 13
 */

// Constants
const CYCLE_DURATION_DAYS = 28; // 4 weeks = 28 days
const SUBMISSION_GRACE_DAYS = 5; // 5 days to submit after cycle ends
const MAX_CYCLES = 26; // Max ~2 years of internship

/**
 * Represents a 4-week reporting/visit cycle
 */
export interface FourWeekCycle {
  cycleNumber: number;
  cycleStartDate: Date;
  cycleEndDate: Date;
  submissionWindowStart: Date;
  submissionWindowEnd: Date;
  dueDate: Date;
  isFirstCycle: boolean;
  isFinalCycle: boolean;
  daysInCycle: number;
}

/**
 * Result of calculating expected cycles for an internship
 */
export interface CycleCalculationResult {
  totalExpectedCycles: number;
  cycles: FourWeekCycle[];
  currentCycleIndex: number | null;
  nextDueDate: Date | null;
  overdueCount: number;
}

/**
 * Calculate all 4-week cycles for an internship
 *
 * @param startDate - Internship start date
 * @param endDate - Internship end date (or expected end date)
 * @returns Array of 4-week cycles
 * @throws Error if dates are invalid
 */
export function calculateFourWeekCycles(startDate: Date, endDate: Date): FourWeekCycle[] {
  // Validate input types and values
  if (!startDate || !endDate) {
    throw new Error('Start date and end date are required');
  }

  const cycles: FourWeekCycle[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  // Validate dates are valid
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new Error('Invalid date provided');
  }

  // Normalize to start of day
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  // Validate date order - allow same day (will create one cycle)
  if (end < start) {
    return [];
  }

  // Handle same day edge case - create a single cycle for that day
  if (start.getTime() === end.getTime()) {
    const dueDate = new Date(end);
    dueDate.setDate(dueDate.getDate() + 1 + SUBMISSION_GRACE_DAYS);
    dueDate.setHours(23, 59, 59, 999);

    return [{
      cycleNumber: 1,
      cycleStartDate: new Date(start),
      cycleEndDate: new Date(end),
      submissionWindowStart: new Date(end.getTime() + 24 * 60 * 60 * 1000),
      submissionWindowEnd: dueDate,
      dueDate,
      isFirstCycle: true,
      isFinalCycle: true,
      daysInCycle: 1,
    }];
  }

  let cycleNumber = 1;
  let cycleStartDate = new Date(start);

  // Safety check: warn if internship is very long
  const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  if (totalDays > MAX_CYCLES * CYCLE_DURATION_DAYS) {
    console.warn(`Internship duration (${totalDays} days) exceeds maximum cycles limit (${MAX_CYCLES} cycles = ${MAX_CYCLES * CYCLE_DURATION_DAYS} days)`);
  }

  while (cycleStartDate <= end && cycleNumber <= MAX_CYCLES) {
    // Calculate cycle end date (28 days from start, or internship end, whichever is earlier)
    const naturalCycleEnd = new Date(cycleStartDate);
    naturalCycleEnd.setDate(naturalCycleEnd.getDate() + CYCLE_DURATION_DAYS - 1);
    naturalCycleEnd.setHours(23, 59, 59, 999);

    const cycleEndDate = naturalCycleEnd > end ? new Date(end) : naturalCycleEnd;
    const isFinalCycle = cycleEndDate >= end || naturalCycleEnd >= end;

    // Submission window: day after cycle ends + 5 days grace period
    const submissionWindowStart = new Date(cycleEndDate);
    submissionWindowStart.setDate(submissionWindowStart.getDate() + 1);
    submissionWindowStart.setHours(0, 0, 0, 0);

    const submissionWindowEnd = new Date(submissionWindowStart);
    submissionWindowEnd.setDate(submissionWindowEnd.getDate() + SUBMISSION_GRACE_DAYS - 1);
    submissionWindowEnd.setHours(23, 59, 59, 999);

    // Calculate actual days in this cycle
    const daysInCycle = Math.ceil(
      (cycleEndDate.getTime() - cycleStartDate.getTime()) / (1000 * 60 * 60 * 24)
    ) + 1;

    cycles.push({
      cycleNumber,
      cycleStartDate: new Date(cycleStartDate),
      cycleEndDate: new Date(cycleEndDate),
      submissionWindowStart,
      submissionWindowEnd,
      dueDate: new Date(submissionWindowEnd),
      isFirstCycle: cycleNumber === 1,
      isFinalCycle,
      daysInCycle,
    });

    if (isFinalCycle) {
      break;
    }

    // Move to next cycle
    cycleStartDate = new Date(cycleEndDate);
    cycleStartDate.setDate(cycleStartDate.getDate() + 1);
    cycleStartDate.setHours(0, 0, 0, 0);
    cycleNumber++;
  }

  return cycles;
}

/**
 * Get the total number of expected reports/visits for an internship
 * Optimized to calculate count without building full cycle objects
 */
export function getTotalExpectedCycles(startDate: Date, endDate: Date): number {
  // Validate inputs
  if (!startDate || !endDate) {
    return 0;
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  // Validate dates
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return 0;
  }

  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  if (end < start) {
    return 0;
  }

  // Optimized calculation: estimate cycles based on duration
  const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const estimatedCycles = Math.min(
    Math.ceil(totalDays / CYCLE_DURATION_DAYS),
    MAX_CYCLES
  );

  return estimatedCycles;
}

/**
 * Get current cycle information based on today's date
 */
export function getCurrentCycleInfo(startDate: Date, endDate: Date): {
  currentCycle: FourWeekCycle | null;
  cycleIndex: number;
  isInSubmissionWindow: boolean;
  daysUntilDue: number | null;
  isOverdue: boolean;
} {
  // Validate inputs
  if (!startDate || !endDate) {
    return {
      currentCycle: null,
      cycleIndex: -1,
      isInSubmissionWindow: false,
      daysUntilDue: null,
      isOverdue: false,
    };
  }

  const now = new Date();
  const cycles = calculateFourWeekCycles(startDate, endDate);

  for (let i = 0; i < cycles.length; i++) {
    const cycle = cycles[i];

    // Check if we're in this cycle's period or submission window
    if (now >= cycle.cycleStartDate && now <= cycle.submissionWindowEnd) {
      const isInSubmissionWindow = now >= cycle.submissionWindowStart;
      const daysUntilDue = Math.ceil(
        (cycle.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      return {
        currentCycle: cycle,
        cycleIndex: i,
        isInSubmissionWindow,
        daysUntilDue: daysUntilDue > 0 ? daysUntilDue : 0,
        isOverdue: now > cycle.dueDate,
      };
    }

    // Check if this cycle is overdue (past submission window)
    if (now > cycle.submissionWindowEnd) {
      continue; // Check next cycle
    }

    // We're before this cycle starts
    if (now < cycle.cycleStartDate) {
      const daysUntilStart = Math.ceil(
        (cycle.cycleStartDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      return {
        currentCycle: cycle,
        cycleIndex: i,
        isInSubmissionWindow: false,
        daysUntilDue: Math.ceil(
          (cycle.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        ),
        isOverdue: false,
      };
    }
  }

  // All cycles completed
  return {
    currentCycle: cycles.length > 0 ? cycles[cycles.length - 1] : null,
    cycleIndex: cycles.length - 1,
    isInSubmissionWindow: false,
    daysUntilDue: null,
    isOverdue: false,
  };
}

/**
 * Calculate cycle number for a specific date
 * Returns which cycle a given date falls into
 */
export function getCycleNumberForDate(startDate: Date, targetDate: Date): number {
  // Validate inputs
  if (!startDate || !targetDate) {
    return 0;
  }

  const start = new Date(startDate);
  const target = new Date(targetDate);

  // Validate dates
  if (isNaN(start.getTime()) || isNaN(target.getTime())) {
    return 0;
  }

  start.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);

  if (target < start) {
    return 0;
  }

  const daysDiff = Math.floor(
    (target.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
  );

  return Math.floor(daysDiff / CYCLE_DURATION_DAYS) + 1;
}

/**
 * Check if a submission is late
 */
export function isSubmissionLate(
  cycleNumber: number,
  startDate: Date,
  endDate: Date,
  submittedAt: Date | null
): { isLate: boolean; daysLate: number } {
  if (!submittedAt) {
    // Check if past due date
    const cycles = calculateFourWeekCycles(startDate, endDate);
    const cycle = cycles.find(c => c.cycleNumber === cycleNumber);

    if (!cycle) {
      return { isLate: false, daysLate: 0 };
    }

    const now = new Date();
    if (now > cycle.dueDate) {
      const daysLate = Math.floor(
        (now.getTime() - cycle.dueDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      return { isLate: true, daysLate };
    }

    return { isLate: false, daysLate: 0 };
  }

  // Check if submitted after due date
  const cycles = calculateFourWeekCycles(startDate, endDate);
  const cycle = cycles.find(c => c.cycleNumber === cycleNumber);

  if (!cycle) {
    return { isLate: false, daysLate: 0 };
  }

  const submitted = new Date(submittedAt);
  if (submitted > cycle.dueDate) {
    const daysLate = Math.floor(
      (submitted.getTime() - cycle.dueDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    return { isLate: true, daysLate };
  }

  return { isLate: false, daysLate: 0 };
}

/**
 * Get comprehensive cycle calculation result for an internship
 */
export function getInternshipCycleStatus(
  startDate: Date,
  endDate: Date,
  completedCycles: number[] = []
): CycleCalculationResult {
  const now = new Date();
  const cycles = calculateFourWeekCycles(startDate, endDate);

  let currentCycleIndex: number | null = null;
  let nextDueDate: Date | null = null;
  let overdueCount = 0;

  for (let i = 0; i < cycles.length; i++) {
    const cycle = cycles[i];
    const isCompleted = completedCycles.includes(cycle.cycleNumber);

    // Check if overdue (past due date and not completed)
    if (!isCompleted && now > cycle.dueDate) {
      overdueCount++;
    }

    // Find current cycle (first non-completed cycle that's not past its submission window)
    if (currentCycleIndex === null && !isCompleted) {
      if (now <= cycle.submissionWindowEnd || now <= cycle.cycleEndDate) {
        currentCycleIndex = i;
        nextDueDate = cycle.dueDate;
      }
    }
  }

  // If all cycles are either completed or overdue, find the next incomplete one
  if (currentCycleIndex === null) {
    for (let i = 0; i < cycles.length; i++) {
      if (!completedCycles.includes(cycles[i].cycleNumber)) {
        currentCycleIndex = i;
        nextDueDate = cycles[i].dueDate;
        break;
      }
    }
  }

  return {
    totalExpectedCycles: cycles.length,
    cycles,
    currentCycleIndex,
    nextDueDate,
    overdueCount,
  };
}

/**
 * Format cycle information for display
 */
export function formatCycleLabel(cycle: FourWeekCycle): string {
  const startStr = cycle.cycleStartDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
  const endStr = cycle.cycleEndDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return `Cycle ${cycle.cycleNumber}: ${startStr} - ${endStr}`;
}

/**
 * Get submission status for a cycle
 */
export function getCycleSubmissionStatus(
  cycle: FourWeekCycle,
  isCompleted: boolean
): {
  status: 'NOT_YET_DUE' | 'CAN_SUBMIT' | 'OVERDUE' | 'SUBMITTED' | 'COMPLETED';
  label: string;
  color: string;
  canSubmit: boolean;
  sublabel?: string;
} {
  const now = new Date();

  if (isCompleted) {
    return {
      status: 'COMPLETED',
      label: 'Completed',
      color: 'green',
      canSubmit: false,
    };
  }

  // Before cycle ends
  if (now < cycle.cycleEndDate) {
    const daysLeft = Math.ceil(
      (cycle.cycleEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
    return {
      status: 'NOT_YET_DUE',
      label: 'In Progress',
      color: 'blue',
      canSubmit: false,
      sublabel: `${daysLeft} day${daysLeft === 1 ? '' : 's'} until cycle ends`,
    };
  }

  // In submission window
  if (now >= cycle.submissionWindowStart && now <= cycle.dueDate) {
    const daysLeft = Math.ceil(
      (cycle.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
    return {
      status: 'CAN_SUBMIT',
      label: 'Due Soon',
      color: 'orange',
      canSubmit: true,
      sublabel: `${daysLeft} day${daysLeft === 1 ? '' : 's'} to submit`,
    };
  }

  // Past due date
  if (now > cycle.dueDate) {
    const daysOverdue = Math.floor(
      (now.getTime() - cycle.dueDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    return {
      status: 'OVERDUE',
      label: 'Overdue',
      color: 'red',
      canSubmit: true, // Still allow late submission
      sublabel: `${daysOverdue} day${daysOverdue === 1 ? '' : 's'} late`,
    };
  }

  // Between cycle end and submission window start
  return {
    status: 'CAN_SUBMIT',
    label: 'Ready to Submit',
    color: 'green',
    canSubmit: true,
    sublabel: `Due by ${cycle.dueDate.toLocaleDateString()}`,
  };
}

/**
 * Calculate expected reports count as of today
 * Returns how many reports should have been submitted by now
 * Optimized version without building full cycle objects
 */
export function getExpectedReportsAsOfToday(startDate: Date, endDate: Date): number {
  // Validate inputs
  if (!startDate || !endDate) {
    return 0;
  }

  const now = new Date();
  const start = new Date(startDate);
  const end = new Date(endDate);

  // Validate dates
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return 0;
  }

  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  if (end < start || now < start) {
    return 0;
  }

  // Optimized: Calculate without building full cycle objects
  let expectedCount = 0;
  let cycleStartDate = new Date(start);
  let cycleNumber = 1;

  while (cycleStartDate <= end && cycleNumber <= MAX_CYCLES) {
    // Calculate cycle end date
    const naturalCycleEnd = new Date(cycleStartDate);
    naturalCycleEnd.setDate(naturalCycleEnd.getDate() + CYCLE_DURATION_DAYS - 1);
    naturalCycleEnd.setHours(23, 59, 59, 999);

    const cycleEndDate = naturalCycleEnd > end ? new Date(end) : naturalCycleEnd;
    const isFinalCycle = cycleEndDate.getTime() >= end.getTime() || naturalCycleEnd.getTime() >= end.getTime();

    // Submission window starts the day after cycle ends
    const submissionWindowStart = new Date(cycleEndDate);
    submissionWindowStart.setDate(submissionWindowStart.getDate() + 1);
    submissionWindowStart.setHours(0, 0, 0, 0);

    // A report is expected if we're past the submission window start
    if (now >= submissionWindowStart) {
      expectedCount++;
    }

    if (isFinalCycle) {
      break;
    }

    // Move to next cycle
    cycleStartDate = new Date(cycleEndDate);
    cycleStartDate.setDate(cycleStartDate.getDate() + 1);
    cycleStartDate.setHours(0, 0, 0, 0);
    cycleNumber++;
  }

  return expectedCount;
}

/**
 * Calculate expected visits count as of today
 * Returns how many visits should have been completed by now
 * Optimized version without building full cycle objects
 */
export function getExpectedVisitsAsOfToday(startDate: Date, endDate: Date): number {
  // Validate inputs
  if (!startDate || !endDate) {
    return 0;
  }

  const now = new Date();
  const start = new Date(startDate);
  const end = new Date(endDate);

  // Validate dates
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return 0;
  }

  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  if (end < start || now < start) {
    return 0;
  }

  // Optimized: Calculate without building full cycle objects
  let expectedCount = 0;
  let cycleStartDate = new Date(start);
  let cycleNumber = 1;

  while (cycleStartDate <= end && cycleNumber <= MAX_CYCLES) {
    // Calculate cycle end date
    const naturalCycleEnd = new Date(cycleStartDate);
    naturalCycleEnd.setDate(naturalCycleEnd.getDate() + CYCLE_DURATION_DAYS - 1);
    naturalCycleEnd.setHours(23, 59, 59, 999);

    const cycleEndDate = naturalCycleEnd > end ? new Date(end) : naturalCycleEnd;
    const isFinalCycle = cycleEndDate.getTime() >= end.getTime() || naturalCycleEnd.getTime() >= end.getTime();

    // A visit is expected if we're past the cycle end date
    if (now > cycleEndDate) {
      expectedCount++;
    }

    if (isFinalCycle) {
      break;
    }

    // Move to next cycle
    cycleStartDate = new Date(cycleEndDate);
    cycleStartDate.setDate(cycleStartDate.getDate() + 1);
    cycleStartDate.setHours(0, 0, 0, 0);
    cycleNumber++;
  }

  return expectedCount;
}

// Export constants for external use
export const FOUR_WEEK_CYCLE = {
  DURATION_DAYS: CYCLE_DURATION_DAYS,
  GRACE_DAYS: SUBMISSION_GRACE_DAYS,
  MAX_CYCLES,
};
