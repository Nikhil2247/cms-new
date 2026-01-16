# Toast Notification Migration Checklist

## Overview
Replace all Ant Design `message` API usage with `react-hot-toast` for consistency across the application.

## Migration Pattern

### From (Ant Design):
```javascript
import { message } from 'antd';
message.success('Success message');
message.error('Error message');
message.warning('Warning message');
message.info('Info message');
```

### To (React Hot Toast):
```javascript
import { toast } from 'react-hot-toast';
toast.success('Success message');
toast.error('Error message');
toast('Warning message', { icon: '⚠️' });
toast('Info message', { icon: 'ℹ️' });
```

---

## Files Requiring Migration

### State Management Features

#### 1. **d:\New folder (2)\cms-new\frontend\src\features\state\dashboard\StateDashboard.jsx**
- [ ] Line 2: Remove `message` from antd import
- [ ] Line 186: `message.success` → `toast.success`
- [ ] Line 205: `message.success` → `toast.success`
- [ ] Line 207: `message.error` → `toast.error`
- [ ] Line 231: `message.info` → `toast`
- [ ] Line 241: `message.info` → `toast`
- [ ] Add: `import { toast } from 'react-hot-toast';`

#### 2. **d:\New folder (2)\cms-new\frontend\src\features\state\staff\StaffModal.jsx**
- [ ] Line 3: Remove `message` from antd import
- [ ] Replace all `message.*` calls with `toast.*`
- [ ] Add: `import { toast } from 'react-hot-toast';`

#### 3. **d:\New folder (2)\cms-new\frontend\src\features\state\staff\StaffList.jsx**
- [ ] Line 3: Remove `message` from antd import
- [ ] Replace all `message.*` calls with `toast.*`
- [ ] Add: `import { toast } from 'react-hot-toast';`

#### 4. **d:\New folder (2)\cms-new\frontend\src\features\state\principals\PrincipalModal.jsx**
- [ ] Line 3: Remove `message` from antd import
- [ ] Replace all `message.*` calls with `toast.*`
- [ ] Add: `import { toast } from 'react-hot-toast';`

#### 5. **d:\New folder (2)\cms-new\frontend\src\features\state\principals\PrincipalList.jsx**
- [ ] Line 3: Remove `message` from antd import
- [ ] Replace all `message.*` calls with `toast.*`
- [ ] Add: `import { toast } from 'react-hot-toast';`

#### 6. **d:\New folder (2)\cms-new\frontend\src\features\state\institutions\InstituteManagement.jsx**
- [ ] Check for `message` usage
- [ ] Replace with `toast` if present

---

### Faculty Features

#### 7. **d:\New folder (2)\cms-new\frontend\src\features\faculty\reports\MonthlyReportsPage.jsx**
- [ ] Remove `message` from imports
- [ ] Line 138: `message.success` → `toast.success`
- [ ] Line 140: `message.error` → `toast.error`
- [ ] Line 159: `message.error` → `toast.error`
- [ ] Line 170: `message.error` → `toast.error`
- [ ] Line 174: `message.error` → `toast.error`
- [ ] Line 182: `message.success` → `toast.success`
- [ ] Line 186: `message.error` → `toast.error`
- [ ] Line 199: `message.error` → `toast.error`
- [ ] Lines 226, 231, 237, 245, 259, 264: Replace all `message.*`
- [ ] Add: `import { toast } from 'react-hot-toast';`

#### 8. **d:\New folder (2)\cms-new\frontend\src\features\faculty\visits\VisitLogModal.jsx**
- [ ] Line 3: Remove `message` from antd import
- [ ] Lines 47, 171, 174, 179, 192: Replace all `message.*`
- [ ] Add: `import { toast } from 'react-hot-toast';`

#### 9. **d:\New folder (2)\cms-new\frontend\src\features\faculty\visits\VisitLogList.jsx**
- [ ] Replace all `message.*` calls (lines 61, 63, 84, 89)
- [ ] Add toast import

#### 10. **d:\New folder (2)\cms-new\frontend\src\features\faculty\visits\UnifiedVisitLogModal.jsx**
- [ ] Replace all `message.*` calls (lines 157, 172, 181, 185, 194, 195, 201, 202, 220, 233, 245, 268, 280, 285)
- [ ] Add toast import

#### 11. **d:\New folder (2)\cms-new\frontend\src\features\faculty\visits\QuickVisitModal.jsx**
- [ ] Replace all `message.*` calls (lines 105, 113, 131, 149, 180, 186, 200, 252, 257, 259)
- [ ] Add toast import

#### 12. **d:\New folder (2)\cms-new\frontend\src\features\faculty\students\AssignedStudents.jsx**
- [ ] Lines 57, 59: Replace `message.*`
- [ ] Add toast import

#### 13. **d:\New folder (2)\cms-new\frontend\src\features\faculty\students\FacultyStudentModal.jsx**
- [ ] Lines 181, 202, 233, 241, 249, 257: Replace `message.*`
- [ ] Add toast import

#### 14. **d:\New folder (2)\cms-new\frontend\src\features\faculty\students\AssignedStudentsList.jsx**
- [ ] Lines 234, 241, 245, 256, 285, 289, 297, 301, 309, 314, 320, 328, 341, 346, 357, 369, 376, 403, 409, 1120: Replace all `message.*`
- [ ] Add toast import

#### 15. **d:\New folder (2)\cms-new\frontend\src\features\faculty\joining-letters\JoiningLettersPage.jsx**
- [ ] Lines 86, 89, 99, 123, 132, 141, 146: Replace `message.*`
- [ ] Add toast import

#### 16. **d:\New folder (2)\cms-new\frontend\src\features\faculty\dashboard\FacultyDashboard.jsx**
- [ ] Line 2: Remove `message` from import
- [ ] Replace any `message.*` calls
- [ ] Add toast import

#### 17. **d:\New folder (2)\cms-new\frontend\src\features\faculty\dashboard\components\JoiningLettersCard.jsx**
- [ ] Line 3: Remove `message`
- [ ] Replace all `message.*`
- [ ] Add toast import

#### 18. **d:\New folder (2)\cms-new\frontend\src\features\faculty\dashboard\components\JoiningLettersOverviewModal.jsx**
- [ ] Line 3: Remove `message`
- [ ] Replace all `message.*`
- [ ] Add toast import

#### 19. **d:\New folder (2)\cms-new\frontend\src\features\faculty\dashboard\components\MonthlyReportsOverviewModal.jsx**
- [ ] Line 3: Remove `message`
- [ ] Replace all `message.*`
- [ ] Add toast import

#### 20. **d:\New folder (2)\cms-new\frontend\src\features\faculty\dashboard\components\MonthlyReportsCard.jsx**
- [ ] Line 3: Remove `message`
- [ ] Replace all `message.*`
- [ ] Add toast import

---

### Student Features

#### 21. **d:\New folder (2)\cms-new\frontend\src\features\student\reports\StudentReportSubmit.jsx**
- [ ] Lines 152, 170, 179, 201, 206, 212, 220, 257, 266, 276, 284: Replace all `message.*`
- [ ] Add toast import

#### 22. **d:\New folder (2)\cms-new\frontend\src\features\student\internships\SelfIdentifiedInternship.jsx**
- [ ] Lines 77, 479: Replace `message.*`
- [ ] Already has toast import ✓

#### 23. **d:\New folder (2)\cms-new\frontend\src\features\student\internships\InternshipList.jsx**
- [ ] Line 2: Remove `message` from import
- [ ] Lines 45, 48: Replace `message.*`
- [ ] Add toast import

#### 24. **d:\New folder (2)\cms-new\frontend\src\features\student\internships\InternshipDetails.jsx**
- [ ] Lines 193, 200: Replace `message.*`
- [ ] Already has toast import ✓

#### 25. **d:\New folder (2)\cms-new\frontend\src\features\student\dashboard\StudentDashboard.jsx**
- [ ] Lines 697, 703: Replace `message.*`
- [ ] Already has toast import ✓

#### 26. **d:\New folder (2)\cms-new\frontend\src\features\student\dashboard\components\JoiningLetterCard.jsx**
- [ ] Line 3: Remove `message`
- [ ] Replace all `message.*`
- [ ] Add toast import

#### 27. **d:\New folder (2)\cms-new\frontend\src\features\student\applications\components\ApplicationDetailsView.jsx**
- [ ] Line 3: Remove `message`
- [ ] Replace all `message.*`
- [ ] Add toast import

#### 28. **d:\New folder (2)\cms-new\frontend\src\features\student\applications\components\MonthlyFeedbackModal.jsx**
- [ ] Line 2: Remove `message`
- [ ] Replace all `message.*`
- [ ] Add toast import

---

### Principal Features

#### 29. **d:\New folder (2)\cms-new\frontend\src\features\principal\students\StudentList.jsx**
- [ ] Line 2: Remove `message`
- [ ] Replace all `message.*`
- [ ] Add toast import

#### 30. **d:\New folder (2)\cms-new\frontend\src\features\principal\students\StudentModal.jsx**
- [ ] Line 2: Remove `message`
- [ ] Replace all `message.*`
- [ ] Add toast import

#### 31. **d:\New folder (2)\cms-new\frontend\src\features\principal\staff\StaffModal.jsx**
- [ ] Line 2: Remove `message`
- [ ] Replace all `message.*`
- [ ] Add toast import

#### 32. **d:\New folder (2)\cms-new\frontend\src\features\principal\staff\StaffList.jsx**
- [ ] Line 2: Remove `message`
- [ ] Replace all `message.*`
- [ ] Add toast import

#### 33. **d:\New folder (2)\cms-new\frontend\src\features\principal\bulk\BulkUpload.jsx**
- [ ] Line 3: Remove `message`
- [ ] Replace all `message.*`
- [ ] Add toast import

---

### Admin Features

#### 34. **d:\New folder (2)\cms-new\frontend\src\features\admin\pages\FeatureFlags.jsx**
- [ ] Line 2: Remove `message`
- [ ] Replace all `message.*`
- [ ] Add toast import

---

## Migration Steps

1. **For each file:**
   - Remove `message` from antd imports
   - Add `import { toast } from 'react-hot-toast';`
   - Replace:
     - `message.success(...)` → `toast.success(...)`
     - `message.error(...)` → `toast.error(...)`
     - `message.warning(...)` → `toast('...', { icon: '⚠️' })`
     - `message.info(...)` → `toast('...', { icon: 'ℹ️' })`
     - `message.loading(...)` → `toast.loading(...)`

2. **Test each feature after migration**
3. **Verify toast appears correctly in UI**

---

## Notes

- Files already using `toast` (no changes needed):
  - ✅ AuditLogs.jsx
  - ✅ ReportBuilder.jsx
  - ✅ StudentProfile.jsx
  - ✅ StudentGrievance.jsx
  - ✅ Various other files

- Total files to migrate: **~34 files**
- Estimated time: 2-3 hours

---

## Testing Checklist

After migration, test:
- [ ] Success notifications display correctly
- [ ] Error notifications display correctly
- [ ] Warning notifications display correctly
- [ ] Info notifications display correctly
- [ ] Toast position and styling match design
- [ ] No console errors related to message/toast
- [ ] All user actions show appropriate feedback
