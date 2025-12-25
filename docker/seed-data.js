// MongoDB Seed Script - Direct mongosh seeding
// Run with: mongosh -u admin -p admin123 --authenticationDatabase admin < seed-data.js

db = db.getSiblingDB('cms');

print('🌱 Starting Comprehensive Seed via mongosh...\n');

// Password hashes (generated with bcryptjs)
// IMPORTANT: These hashes are bcryptjs-compatible ($2b$ prefix)
const DEFAULT_HASH = '$2b$10$qULXSklquZk5qLPRjWsPpOp4hN8/EoKqh.uh8BSKI/kpaA4qdWuUy'; // password@1234
const SYSTEM_ADMIN_HASH = '$2b$10$z/s976lFCX5CbJ2bB63zNeTxHozjxUEp1XET4RpGecYOqMjH5/xT2'; // @Nikhil123kumar
const STATE_ADMIN_HASH = '$2b$10$qHQjsmgqtf0bu0AEAjVpKeiqyZA/a3kzYSMkYlFmYZ2FFww2Ugcre'; // Dtepunjab@directorate

// Punjab Cities
const PUNJAB_CITIES = [
  { city: 'Ludhiana', district: 'Ludhiana', pinCode: '141001', address: 'GT Road, Near Clock Tower' },
  { city: 'Amritsar', district: 'Amritsar', pinCode: '143001', address: 'GT Road, Near Golden Temple' },
  { city: 'Jalandhar', district: 'Jalandhar', pinCode: '144001', address: 'Model Town Road' },
  { city: 'Patiala', district: 'Patiala', pinCode: '147001', address: 'Mall Road' },
  { city: 'Bathinda', district: 'Bathinda', pinCode: '151001', address: 'Thermal Plant Road' },
  { city: 'Mohali', district: 'Mohali', pinCode: '160055', address: 'Sector 70' },
  { city: 'Hoshiarpur', district: 'Hoshiarpur', pinCode: '146001', address: 'College Road' },
  { city: 'Pathankot', district: 'Pathankot', pinCode: '145001', address: 'Dhangu Road' },
  { city: 'Moga', district: 'Moga', pinCode: '142001', address: 'GT Road' },
  { city: 'Ferozepur', district: 'Ferozepur', pinCode: '152002', address: 'Hussainiwala Road' },
  { city: 'Gurdaspur', district: 'Gurdaspur', pinCode: '143521', address: 'Batala Road' },
  { city: 'Kapurthala', district: 'Kapurthala', pinCode: '144601', address: 'Jalandhar Road' },
  { city: 'Sangrur', district: 'Sangrur', pinCode: '148001', address: 'Patiala Road' },
  { city: 'Rupnagar', district: 'Rupnagar', pinCode: '140001', address: 'Chandigarh Road' },
  { city: 'Muktsar', district: 'Muktsar', pinCode: '152026', address: 'Abohar Road' },
  { city: 'Fazilka', district: 'Fazilka', pinCode: '152123', address: 'Ferozepur Road' },
  { city: 'Faridkot', district: 'Faridkot', pinCode: '151203', address: 'Bathinda Road' },
  { city: 'Barnala', district: 'Barnala', pinCode: '148101', address: 'Sangrur Road' },
  { city: 'Tarn Taran', district: 'Tarn Taran', pinCode: '143401', address: 'Amritsar Road' },
  { city: 'Nawanshahr', district: 'Nawanshahr', pinCode: '144514', address: 'Hoshiarpur Road' },
  { city: 'Mansa', district: 'Mansa', pinCode: '151505', address: 'Bathinda Road' },
  { city: 'Fatehgarh Sahib', district: 'Fatehgarh Sahib', pinCode: '140406', address: 'Sirhind Road' },
];

const BRANCHES = [
  { name: 'Computer Science & Engineering', shortName: 'CSE', code: 'CSE' },
  { name: 'Information Technology', shortName: 'IT', code: 'IT' },
  { name: 'Electronics & Communication Engineering', shortName: 'ECE', code: 'ECE' },
  { name: 'Mechanical Engineering', shortName: 'ME', code: 'ME' },
  { name: 'Civil Engineering', shortName: 'CE', code: 'CE' },
  { name: 'Electrical Engineering', shortName: 'EE', code: 'EE' },
];

const MALE_NAMES = ['Aarav', 'Arjun', 'Aditya', 'Akash', 'Amit', 'Ankit', 'Aryan', 'Bharat', 'Chirag', 'Deepak', 'Dhruv', 'Gaurav', 'Harsh', 'Karan', 'Kunal', 'Manish', 'Mohit', 'Naveen', 'Nikhil', 'Pankaj', 'Rahul', 'Raj', 'Rohit', 'Sahil', 'Shubham', 'Tarun', 'Varun', 'Vikram', 'Yash'];
const FEMALE_NAMES = ['Aanya', 'Aditi', 'Ananya', 'Anjali', 'Divya', 'Kajal', 'Kavya', 'Khushi', 'Kritika', 'Mansi', 'Neha', 'Nidhi', 'Pooja', 'Priya', 'Radhika', 'Sakshi', 'Simran', 'Sneha', 'Tanvi', 'Tanya'];
const LAST_NAMES = ['Sharma', 'Singh', 'Kumar', 'Verma', 'Gupta', 'Patel', 'Mehta', 'Chopra', 'Malhotra', 'Kapoor', 'Arora', 'Gill', 'Sidhu', 'Sandhu', 'Dhillon', 'Brar', 'Grewal', 'Thakur', 'Chauhan', 'Saini'];

function randomElement(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randomNumber(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function generatePhone() { return '+91-' + randomNumber(70, 99) + randomNumber(10000000, 99999999); }
function generateName(gender) {
  const first = gender === 'Male' ? randomElement(MALE_NAMES) : randomElement(FEMALE_NAMES);
  return first + ' ' + randomElement(LAST_NAMES);
}

// 1. CLEANUP
// Note: Prisma uses PascalCase collection names (User, Student, Institution, Branch, Batch, Semester)
// Other collections with @@map keep their lowercase names
print('🗑️  Cleaning database...');
db.completion_feedback.deleteMany({});
db.monthly_feedback.deleteMany({});
db.compliance_records.deleteMany({});
db.approved_referrals.deleteMany({});
db.referral_applications.deleteMany({});
db.placements.deleteMany({});
db.scholarships.deleteMany({});
db.calendars.deleteMany({});
db.notices.deleteMany({});
db.internship_preferences.deleteMany({});
db.technical_queries.deleteMany({});
db.grievances.deleteMany({});
db.faculty_visit_logs.deleteMany({});
db.monthly_reports.deleteMany({});
db.mentor_assignments.deleteMany({});
db.internship_applications.deleteMany({});
db.internships.deleteMany({});
db.industry_requests.deleteMany({});
db.industries.deleteMany({});
db.exam_results.deleteMany({});
db.fees.deleteMany({});
db.documents.deleteMany({});
db.notifications.deleteMany({});
db.audit_logs.deleteMany({});
db.Student.deleteMany({});
db.subjects.deleteMany({});
db.Branch.deleteMany({});
db.Batch.deleteMany({});
db.Semester.deleteMany({});
db.User.deleteMany({});
db.Institution.deleteMany({});
print('✅ Database cleaned.\n');

// 2. ADMIN USERS
print('👑 Creating Admin Users...');
db.User.insertOne({
  email: 'nikhil97798@gmail.com',
  password: SYSTEM_ADMIN_HASH,
  name: 'System Administrator',
  role: 'SYSTEM_ADMIN',
  active: true,
  designation: 'System Admin',
  phoneNo: '+91-9876543210',
  createdAt: new Date(),
  loginCount: 0,
  hasChangedDefaultPassword: false
});

const stateDirectorate = db.User.insertOne({
  email: 'dtepunjab.internship@gmail.com',
  password: STATE_ADMIN_HASH,
  name: 'DTE Punjab',
  role: 'STATE_DIRECTORATE',
  active: true,
  designation: 'Director',
  phoneNo: '+91-172-2700123',
  createdAt: new Date(),
  loginCount: 0,
  hasChangedDefaultPassword: false
});
print('✅ Admins created.\n');

// 3. INSTITUTIONS
print('🏛️  Creating Institutions...');
const institutionIds = [];
for (let i = 0; i < PUNJAB_CITIES.length; i++) {
  const city = PUNJAB_CITIES[i];
  const result = db.Institution.insertOne({
    code: 'INST' + String(i + 1).padStart(3, '0'),
    name: 'Government Polytechnic ' + city.city,
    shortName: 'GP ' + city.city,
    type: 'POLYTECHNIC',
    address: city.address,
    city: city.city,
    state: 'Punjab',
    pinCode: city.pinCode,
    country: 'India',
    contactEmail: 'contact@gp' + city.city.toLowerCase() + '.edu.in',
    contactPhone: generatePhone(),
    isActive: true,
    createdAt: new Date()
  });
  institutionIds.push(result.insertedId);
}
print('✅ ' + institutionIds.length + ' Institutions created.\n');

// 4. BATCH
print('📅 Creating Batch...');
const batchResult = db.Batch.insertOne({
  name: '2023-2026',
  isActive: true,
  institutionId: institutionIds[0],
  createdAt: new Date()
});
const batchId = batchResult.insertedId;
print('✅ Batch created.\n');

// 5. SEMESTERS & BRANCHES
print('🌿 Creating Semesters & Branches...');
const semesterIds = {};
const branchMap = {};

for (let i = 0; i < institutionIds.length; i++) {
  const instId = institutionIds[i];

  // Create semester
  const semResult = db.Semester.insertOne({
    number: 6,
    isActive: true,
    institutionId: instId,
    createdAt: new Date()
  });
  semesterIds[instId.toString()] = semResult.insertedId;

  // Create 4 branches per institution
  branchMap[instId.toString()] = [];
  const shuffledBranches = BRANCHES.sort(() => 0.5 - Math.random()).slice(0, 4);

  for (const b of shuffledBranches) {
    const branchResult = db.Branch.insertOne({
      name: b.name,
      shortName: b.shortName,
      code: 'INST' + String(i + 1).padStart(3, '0') + '-' + b.code,
      duration: 3,
      isActive: true,
      institutionId: instId,
      createdAt: new Date()
    });
    branchMap[instId.toString()].push({
      id: branchResult.insertedId,
      name: b.name,
      shortName: b.shortName
    });
  }
}
print('✅ Semesters & Branches created.\n');

// 6. INSTITUTION STAFF
print('👥 Creating Institution Staff...');
const facultyMap = {};
let staffCount = 0;

for (let i = 0; i < institutionIds.length; i++) {
  const instId = institutionIds[i];
  const city = PUNJAB_CITIES[i];
  const cityLower = city.city.toLowerCase();
  facultyMap[instId.toString()] = [];

  // Principal
  db.User.insertOne({
    email: 'principal@gp' + cityLower + '.edu.in',
    password: DEFAULT_HASH,
    name: 'Dr. ' + generateName('Male'),
    role: 'PRINCIPAL',
    active: true,
    institutionId: instId,
    designation: 'Principal',
    createdAt: new Date(),
    loginCount: 0,
    hasChangedDefaultPassword: false
  });
  staffCount++;

  // Placement Officer
  db.User.insertOne({
    email: 'tpo@gp' + cityLower + '.edu.in',
    password: DEFAULT_HASH,
    name: 'Prof. ' + generateName('Male'),
    role: 'PLACEMENT_OFFICER',
    active: true,
    institutionId: instId,
    designation: 'Training & Placement Officer',
    createdAt: new Date(),
    loginCount: 0,
    hasChangedDefaultPassword: false
  });
  staffCount++;

  // Accountant
  db.User.insertOne({
    email: 'accountant@gp' + cityLower + '.edu.in',
    password: DEFAULT_HASH,
    name: 'Mr. ' + generateName('Male'),
    role: 'ACCOUNTANT',
    active: true,
    institutionId: instId,
    designation: 'Senior Accountant',
    createdAt: new Date(),
    loginCount: 0,
    hasChangedDefaultPassword: false
  });
  staffCount++;

  // Admission Officer
  db.User.insertOne({
    email: 'admission@gp' + cityLower + '.edu.in',
    password: DEFAULT_HASH,
    name: 'Dr. ' + generateName('Female'),
    role: 'ADMISSION_OFFICER',
    active: true,
    institutionId: instId,
    designation: 'Admission Incharge',
    createdAt: new Date(),
    loginCount: 0,
    hasChangedDefaultPassword: false
  });
  staffCount++;

  // Examination Officer
  db.User.insertOne({
    email: 'exam@gp' + cityLower + '.edu.in',
    password: DEFAULT_HASH,
    name: 'Prof. ' + generateName('Male'),
    role: 'EXAMINATION_OFFICER',
    active: true,
    institutionId: instId,
    designation: 'Exam Superintendent',
    createdAt: new Date(),
    loginCount: 0,
    hasChangedDefaultPassword: false
  });
  staffCount++;

  // Teachers (5 per branch)
  const branches = branchMap[instId.toString()];
  for (const branch of branches) {
    for (let k = 0; k < 5; k++) {
      const gender = Math.random() > 0.4 ? 'Male' : 'Female';
      const title = gender === 'Male' ? randomElement(['Dr.', 'Prof.', 'Er.', 'Mr.']) : randomElement(['Dr.', 'Prof.', 'Mrs.', 'Ms.']);
      const name = generateName(gender);
      const firstName = name.split(' ')[0].toLowerCase();

      const teacherResult = db.User.insertOne({
        email: firstName + '.' + branch.shortName.toLowerCase() + '.' + (k + 1) + '@gp' + cityLower + '.edu.in',
        password: DEFAULT_HASH,
        name: title + ' ' + name,
        role: 'TEACHER',
        active: true,
        institutionId: instId,
        designation: randomElement(['Lecturer', 'Senior Lecturer', 'Assistant Professor', 'Workshop Instructor']),
        createdAt: new Date(),
        loginCount: 0,
        hasChangedDefaultPassword: false
      });
      facultyMap[instId.toString()].push(teacherResult.insertedId);
      staffCount++;
    }
  }
}
print('✅ ' + staffCount + ' Staff members created.\n');

// 7. INDUSTRIES
print('🏭 Creating Industries...');
const INDUSTRIES = [
  { name: 'TCS', email: 'hr@tcs.com', city: 'Mohali', type: 'INFORMATION_TECHNOLOGY' },
  { name: 'Infosys', email: 'careers@infosys.com', city: 'Chandigarh', type: 'SOFTWARE_DEVELOPMENT' },
  { name: 'Maruti Suzuki', email: 'hr@maruti.co.in', city: 'Gurgaon', type: 'AUTOMOTIVE' },
  { name: 'L&T Constructions', email: 'jobs@lnt.com', city: 'Delhi', type: 'CONSTRUCTION' },
  { name: 'Havells', email: 'hr@havells.com', city: 'Noida', type: 'ELECTRONICS' },
];

for (const ind of INDUSTRIES) {
  const userResult = db.User.insertOne({
    email: ind.email,
    password: DEFAULT_HASH,
    name: ind.name,
    role: 'INDUSTRY',
    active: true,
    designation: 'HR Manager',
    createdAt: new Date(),
    loginCount: 0,
    hasChangedDefaultPassword: false
  });

  db.industries.insertOne({
    userId: userResult.insertedId,
    companyName: ind.name,
    industryType: ind.type,
    companySize: 'LARGE',
    website: 'www.' + ind.name.toLowerCase().replace(/\s/g, '') + '.com',
    address: ind.city + ', India',
    city: ind.city,
    state: 'Punjab',
    pinCode: '140001',
    contactPersonName: 'HR Manager',
    contactPersonTitle: 'HR Manager',
    primaryEmail: ind.email,
    primaryPhone: generatePhone(),
    registrationNumber: 'REG' + randomNumber(10000, 99999),
    panNumber: 'PAN' + randomNumber(1000, 9999),
    isApproved: true,
    createdAt: new Date()
  });

  // Industry Supervisor
  db.User.insertOne({
    email: 'supervisor@' + ind.name.toLowerCase().replace(/\s/g, '') + '.com',
    password: DEFAULT_HASH,
    name: 'Supervisor ' + ind.name,
    role: 'INDUSTRY_SUPERVISOR',
    active: true,
    designation: 'Technical Lead',
    createdAt: new Date(),
    loginCount: 0,
    hasChangedDefaultPassword: false
  });
}
print('✅ Industries created.\n');

// 8. STUDENTS
print('🎓 Creating Students...');
let studentCount = 0;
const allStudents = [];
const LOCALITIES = ['Model Town', 'Civil Lines', 'Sadar Bazaar', 'New Colony', 'Guru Nanak Nagar', 'Shastri Nagar', 'Rajpura Road', 'GT Road', 'Mall Road', 'Prem Nagar'];
const COMPANIES = [
  { name: 'Quark Software', type: 'Software Development', location: 'Mohali' },
  { name: 'Net Solutions', type: 'Web Development', location: 'Chandigarh' },
  { name: 'HCL Technologies', type: 'IT Services', location: 'Mohali' },
  { name: 'Tech Mahindra', type: 'IT Services', location: 'Chandigarh' },
  { name: 'Wipro Ltd', type: 'IT Services', location: 'Mohali' },
  { name: 'Hero Cycles', type: 'Manufacturing', location: 'Ludhiana' },
  { name: 'Vardhman Textiles', type: 'Textile', location: 'Ludhiana' },
  { name: 'Schneider Electric', type: 'Electrical', location: 'Mohali' },
];

for (let i = 0; i < institutionIds.length; i++) {
  const instId = institutionIds[i];
  const city = PUNJAB_CITIES[i];
  const branches = branchMap[instId.toString()];
  const semId = semesterIds[instId.toString()];

  // 18 students per branch
  for (const branch of branches) {
    for (let k = 0; k < 18; k++) {
      const rollNo = '2025' + branch.shortName + 'INST' + String(i + 1).padStart(3, '0').substring(4) + String(k).padStart(3, '0');
      const gender = Math.random() > 0.45 ? 'Male' : 'Female';
      const studentName = generateName(gender);
      const dob = (2002 + randomNumber(0, 3)) + '-' + String(randomNumber(1, 12)).padStart(2, '0') + '-' + String(randomNumber(1, 28)).padStart(2, '0');

      // User
      const userResult = db.User.insertOne({
        email: rollNo.toLowerCase() + '@student.com',
        password: DEFAULT_HASH,
        name: studentName,
        role: 'STUDENT',
        active: true,
        institutionId: instId,
        rollNumber: rollNo,
        branchName: branch.shortName,
        createdAt: new Date(),
        loginCount: 0,
        hasChangedDefaultPassword: false
      });

      // Student Profile
      const studentResult = db.Student.insertOne({
        userId: userResult.insertedId,
        rollNumber: rollNo,
        admissionNumber: 'ADM' + rollNo,
        name: studentName,
        email: rollNo.toLowerCase() + '@student.com',
        contact: generatePhone(),
        gender: gender,
        dob: dob,
        address: 'H.No. ' + randomNumber(1, 500) + ', ' + randomElement(LOCALITIES),
        city: city.city,
        state: 'Punjab',
        institutionId: instId,
        branchId: branch.id,
        branchName: branch.name,
        batchId: batchId,
        currentSemester: 6,
        admissionType: randomElement(['FIRST_YEAR', 'FIRST_YEAR', 'FIRST_YEAR', 'LEET']),
        category: randomElement(['GENERAL', 'GENERAL', 'SC', 'ST', 'OBC']),
        clearanceStatus: 'CLEARED',
        isActive: true,
        createdAt: new Date()
      });

      allStudents.push({
        id: studentResult.insertedId,
        userId: userResult.insertedId,
        rollNo: rollNo,
        name: studentName,
        instId: instId,
        branchId: branch.id,
        branchShortName: branch.shortName
      });
      studentCount++;

      // Fee Record
      db.fees.insertOne({
        studentId: studentResult.insertedId,
        semesterId: semId,
        amountDue: 25000,
        amountPaid: Math.random() > 0.2 ? 25000 : 0,
        dueDate: new Date(),
        status: Math.random() > 0.2 ? 'PAID' : 'PENDING',
        institutionId: instId,
        createdAt: new Date()
      });
    }
  }
}
print('✅ ' + studentCount + ' Students created.\n');

// 9. INTERNSHIP APPLICATIONS
print('📝 Creating Internship Applications...');
const internshipStartDate = new Date('2025-12-15');
const internshipEndDate = new Date('2026-05-15');

for (const student of allStudents) {
  const company = randomElement(COMPANIES);
  const hrName = (Math.random() > 0.5 ? 'Mr.' : 'Ms.') + ' ' + generateName(Math.random() > 0.5 ? 'Male' : 'Female');

  const appResult = db.internship_applications.insertOne({
    studentId: student.id,
    isSelfIdentified: true,
    companyName: company.name,
    companyAddress: 'Plot No. ' + randomNumber(1, 500) + ', Industrial Area, ' + company.location + ', Punjab',
    hrName: hrName,
    hrContact: generatePhone(),
    hrEmail: 'hr@' + company.name.toLowerCase().replace(/\s/g, '') + '.com',
    status: 'APPROVED',
    internshipStatus: 'ONGOING',
    startDate: internshipStartDate,
    endDate: internshipEndDate,
    joiningDate: internshipStartDate,
    createdAt: new Date()
  });

  // Mentor Assignment
  const faculty = facultyMap[student.instId.toString()];
  if (faculty && faculty.length > 0) {
    const mentorId = randomElement(faculty);
    db.mentor_assignments.insertOne({
      studentId: student.id,
      mentorId: mentorId,
      assignedBy: faculty[0],
      assignmentDate: internshipStartDate,
      isActive: true,
      academicYear: '2025-26',
      semester: '6',
      createdAt: new Date()
    });
  }

  // Documents
  db.documents.insertOne({
    studentId: student.id,
    type: 'OTHER',
    fileName: 'Joining_Report_' + student.rollNo + '.pdf',
    fileUrl: 'https://storage.example.com/joining-reports/' + student.rollNo + '.pdf',
    createdAt: new Date()
  });

  db.documents.insertOne({
    studentId: student.id,
    type: 'OTHER',
    fileName: 'Resume_' + student.rollNo + '.pdf',
    fileUrl: 'https://storage.example.com/resumes/' + student.rollNo + '.pdf',
    createdAt: new Date()
  });
}
print('✅ Internship Applications created.\n');

// 10. NOTICES & CALENDAR
print('📢 Creating Notices & Calendar...');
for (let i = 0; i < institutionIds.length; i++) {
  const instId = institutionIds[i];

  db.notices.insertOne({
    institutionId: instId,
    title: 'Important: Internship Registration Open',
    message: 'All 6th semester students must register for internships by January 15, 2026.',
    createdAt: new Date()
  });

  db.notices.insertOne({
    institutionId: instId,
    title: 'Monthly Report Submission Reminder',
    message: 'Students currently doing internships must submit their monthly reports by the 5th of every month.',
    createdAt: new Date()
  });

  db.calendars.insertOne({
    institutionId: instId,
    title: 'Semester Start',
    startDate: new Date('2025-12-01'),
    endDate: new Date('2025-12-01'),
    createdAt: new Date()
  });

  db.calendars.insertOne({
    institutionId: instId,
    title: 'Semester End Exams',
    startDate: new Date('2026-05-01'),
    endDate: new Date('2026-05-20'),
    createdAt: new Date()
  });
}
print('✅ Notices & Calendar created.\n');

// 11. GRIEVANCES & TECHNICAL QUERIES
print('📫 Creating Grievances & Technical Queries...');
const GRIEVANCE_TITLES = [
  'Internship company not providing proper training',
  'Stipend payment delayed by company',
  'Faculty mentor not responding to queries',
  'Work hours exceeding agreed schedule',
  'Need change of faculty mentor'
];

for (let i = 0; i < 30; i++) {
  const student = randomElement(allStudents);
  db.grievances.insertOne({
    studentId: student.id,
    title: randomElement(GRIEVANCE_TITLES),
    description: 'Detailed description of the grievance issue faced during internship.',
    category: randomElement(['INTERNSHIP_RELATED', 'MENTOR_RELATED', 'WORK_ENVIRONMENT', 'OTHER']),
    status: randomElement(['PENDING', 'IN_PROGRESS', 'RESOLVED', 'ESCALATED']),
    severity: randomElement(['LOW', 'MEDIUM', 'HIGH']),
    createdAt: new Date()
  });
}

const QUERY_TITLES = [
  'Unable to login to portal',
  'Monthly report upload failing',
  'Profile update not saving',
  'Internship application stuck in pending',
  'Cannot download joining report'
];

for (let i = 0; i < 20; i++) {
  const student = randomElement(allStudents);
  db.technical_queries.insertOne({
    userId: student.userId,
    title: randomElement(QUERY_TITLES),
    description: 'Technical issue description requiring support team assistance.',
    status: randomElement(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']),
    priority: randomElement(['LOW', 'MEDIUM', 'HIGH']),
    createdAt: new Date()
  });
}
print('✅ Grievances & Technical Queries created.\n');

// 12. NOTIFICATIONS
print('🔔 Creating Notifications...');
const NOTIFICATION_TITLES = [
  { title: 'Monthly Report Due', body: 'Your monthly internship report is due in 3 days.', type: 'WARNING' },
  { title: 'Mentor Visit Scheduled', body: 'Your faculty mentor has scheduled a visit next week.', type: 'INFO' },
  { title: 'Report Approved', body: 'Your monthly report has been approved.', type: 'SUCCESS' },
  { title: 'Document Verification Complete', body: 'Your documents have been verified successfully.', type: 'SUCCESS' },
  { title: 'Attendance Reminder', body: 'Please ensure regular attendance at your internship.', type: 'WARNING' },
];

for (let i = 0; i < 100; i++) {
  const student = randomElement(allStudents);
  const notif = randomElement(NOTIFICATION_TITLES);
  db.notifications.insertOne({
    userId: student.userId,
    title: notif.title,
    body: notif.body,
    type: notif.type,
    read: Math.random() > 0.4,
    createdAt: new Date(Date.now() - randomNumber(0, 30) * 24 * 60 * 60 * 1000)
  });
}
print('✅ Notifications created.\n');

// Summary
print('🎉 SEEDING COMPLETE!\n');
print('=== Statistics ===');
print('Users: ' + db.User.countDocuments());
print('Students: ' + db.Student.countDocuments());
print('Institutions: ' + db.Institution.countDocuments());
print('Branches: ' + db.Branch.countDocuments());
print('Internship Applications: ' + db.internship_applications.countDocuments());
print('');
print('=== Credentials ===');
print('System Admin: nikhil97798@gmail.com / @Nikhil123kumar');
print('State Admin: dtepunjab.internship@gmail.com / Dtepunjab@directorate');
print('Principals: principal@gp[city].edu.in / password@1234');
print('Teachers: [name].[branch].1@gp[city].edu.in / password@1234');
print('Students: [rollNo]@student.com / password@1234');
