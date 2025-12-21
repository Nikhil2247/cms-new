import dayjs from 'dayjs';

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export const formatDisplayDate = (dateString, showTime = false) => {
  if (!dateString) return 'Not specified';
  const date = new Date(dateString);
  const options = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...(showTime && { hour: '2-digit', minute: '2-digit' }),
  };
  return date.toLocaleDateString('en-IN', options);
};

export const formatCurrency = (value) => {
  if (!value) return 'Not specified';
  const numericValue = Number(value);
  if (isNaN(numericValue)) return 'Not specified';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(numericValue);
};

export const getStatusColor = (status) => {
  const colors = {
    APPLIED: 'blue',
    UNDER_REVIEW: 'orange',
    ACCEPTED: 'green',
    REJECTED: 'red',
    JOINED: 'cyan',
    COMPLETED: 'purple',
    WITHDRAWN: 'default',
  };
  return colors[status] || 'default';
};

export const getStatusIcon = (status, icons) => {
  const iconMap = {
    APPLIED: icons.clock,
    UNDER_REVIEW: icons.clock,
    ACCEPTED: icons.check,
    REJECTED: icons.close,
    JOINED: icons.check,
    COMPLETED: icons.star,
  };
  return iconMap[status] || icons.clock;
};

export const getReportMonthOptions = () => {
  return MONTH_NAMES.map((name, index) => ({
    value: index + 1,
    label: name,
  }));
};

export const getReportYearOptions = () => {
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let y = currentYear + 2; y >= currentYear - 6; y--) {
    years.push({ value: y, label: y.toString() });
  }
  return years;
};

export const getAllowedReportMonths = (application) => {
  if (!application) return [];

  const startDate = application.isSelfIdentified
    ? application.startDate
    : application.joiningDate || application.internship?.startDate;
  const endDate = application.isSelfIdentified
    ? application.endDate
    : application.internship?.endDate;

  if (!startDate) return [];

  const start = dayjs(startDate).startOf('month');
  const end = dayjs(endDate || dayjs().add(6, 'months')).endOf('month');

  const options = [];
  let current = start.clone();

  while (current.isBefore(end) || current.isSame(end, 'month')) {
    options.push({
      value: current.month() + 1,
      year: current.year(),
      label: `${MONTH_NAMES[current.month()]} ${current.year()}`,
    });
    current = current.add(1, 'month');
  }

  // Remove duplicates
  const unique = [];
  const seen = new Set();
  for (const m of options) {
    const key = `${m.year}-${m.value}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(m);
    }
  }

  return unique;
};

export const getRemainingDays = (dateString) => {
  if (!dateString) return null;
  const targetDate = new Date(dateString);
  const currentDate = new Date();
  return Math.ceil((targetDate - currentDate) / (1000 * 60 * 60 * 24));
};

export const hasInternshipStarted = (application) => {
  if (!application) return false;

  const startDate = application.isSelfIdentified
    ? application.startDate
    : application.joiningDate || application.internship?.startDate;

  if (!startDate) return false;

  return dayjs(startDate).isSameOrBefore(dayjs(), 'day');
};
