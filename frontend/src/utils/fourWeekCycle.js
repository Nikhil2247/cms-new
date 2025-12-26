/**
 * 4-Week Cycle Utility for Frontend
 *
 * Implements the compliance calculation specification:
 * - Reports are due every 4 weeks from internship startDate
 * - Deadline: 5 days after 4-week cycle ends
 * - Each student has DIFFERENT deadlines based on their start date
 * - Visits are aligned with report cycles (1 per 4-week cycle)
 *
 * @see COMPLIANCE_CALCULATION_ANALYSIS.md Section V (Q47-49)
 *
 * Example:
 * Internship Start: Dec 15, 2025
 * Report 1 cycle: Dec 15 - Jan 11 (4 weeks) -> Due by Jan 16 (5 days grace)
 * Report 2 cycle: Jan 12 - Feb 8 -> Due by Feb 13
 * Report 3 cycle: Feb 9 - Mar 8 -> Due by Mar 13
 */

// Constants
export const CYCLE_DURATION_DAYS = 28; // 4 weeks = 28 days
export const SUBMISSION_GRACE_DAYS = 5; // 5 days to submit after cycle ends
export const MAX_CYCLES = 26; // Max ~2 years of internship

/**
 * Calculate all 4-week cycles for an internship
 *
 * @param {Date|string} startDate - Internship start date
 * @param {Date|string} endDate - Internship end date (or expected end date)
 * @returns {Array} Array of 4-week cycles
 * @throws {Error} If dates are invalid
 */
export function calculateFourWeekCycles(startDate, endDate) {
  // Validate input types and values
  if (!startDate || !endDate) {
    throw new Error('Start date and end date are required');
  }

  const cycles = [];
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
 *
 * @param {Date|string} startDate - Internship start date
 * @param {Date|string} endDate - Internship end date
 * @returns {number} Total expected cycles
 */
export function getTotalExpectedCycles(startDate, endDate) {
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
 * Calculate expected reports count as of today
 * Returns how many reports should have been submitted by now
 * Optimized version without building full cycle objects
 *
 * @param {Date|string} startDate - Internship start date
 * @param {Date|string} endDate - Internship end date
 * @returns {number} Expected reports count
 */
export function getExpectedReportsAsOfToday(startDate, endDate) {
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
 *
 * @param {Date|string} startDate - Internship start date
 * @param {Date|string} endDate - Internship end date
 * @returns {number} Expected visits count
 */
export function getExpectedVisitsAsOfToday(startDate, endDate) {
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

/**
 * Get current cycle information based on today's date
 *
 * @param {Date|string} startDate - Internship start date
 * @param {Date|string} endDate - Internship end date
 * @returns {Object} Current cycle information
 */
export function getCurrentCycleInfo(startDate, endDate) {
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

    // Check if we're before this cycle starts
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
        daysUntilCycleStarts: daysUntilStart,
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
    allCyclesCompleted: true,
  };
}

/**
 * Format cycle label for display
 *
 * @param {Object} cycle - Cycle object from calculateFourWeekCycles
 * @returns {string} Formatted label
 */
export function formatCycleLabel(cycle) {
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
 *
 * @param {Object} cycle - Cycle object from calculateFourWeekCycles
 * @param {boolean} isCompleted - Whether the report/visit for this cycle is completed
 * @returns {Object} Status object with label, color, and canSubmit flag
 */
export function getCycleSubmissionStatus(cycle, isCompleted) {
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
 * Check if a submission is late
 *
 * @param {number} cycleNumber - The cycle number
 * @param {Date|string} startDate - Internship start date
 * @param {Date|string} endDate - Internship end date
 * @param {Date|string|null} submittedAt - When the submission was made (null if not submitted)
 * @returns {Object} { isLate: boolean, daysLate: number }
 */
export function isSubmissionLate(cycleNumber, startDate, endDate, submittedAt) {
  const cycles = calculateFourWeekCycles(startDate, endDate);
  const cycle = cycles.find(c => c.cycleNumber === cycleNumber);

  if (!cycle) {
    return { isLate: false, daysLate: 0 };
  }

  if (!submittedAt) {
    // Check if past due date
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
  const submitted = new Date(submittedAt);
  if (submitted > cycle.dueDate) {
    const daysLate = Math.floor(
      (submitted.getTime() - cycle.dueDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    return { isLate: true, daysLate };
  }

  return { isLate: false, daysLate: 0 };
}

export default {
  CYCLE_DURATION_DAYS,
  SUBMISSION_GRACE_DAYS,
  MAX_CYCLES,
  calculateFourWeekCycles,
  getTotalExpectedCycles,
  getExpectedReportsAsOfToday,
  getExpectedVisitsAsOfToday,
  getCurrentCycleInfo,
  formatCycleLabel,
  getCycleSubmissionStatus,
  isSubmissionLate,
};
