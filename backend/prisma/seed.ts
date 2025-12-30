import { PrismaClient, Role, ClearanceStatus, AdmissionType, Category, ApplicationStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// ============================================
// CONFIGURATION & CONSTANTS
// ============================================

const DEFAULT_PASSWORD = 'password@1234';
const SYSTEM_ADMIN_EMAIL = 'nikhil97798@gmail.com';
const SYSTEM_ADMIN_PASSWORD = '@Nikhil123kumar';
const STATE_ADMIN_EMAIL = 'dtepunjab.internship@gmail.com';
const STATE_ADMIN_PASSWORD = 'Dtepunjab@directorate';

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

const SUBJECTS_BY_BRANCH: Record<string, string[]> = {
  'CSE': ['Data Structures', 'Operating Systems', 'Database Management', 'Computer Networks', 'Web Development'],
  'IT': ['Web Technologies', 'Java Programming', 'Software Engineering', 'Data Mining', 'Cloud Computing'],
  'ECE': ['Digital Electronics', 'Microprocessors', 'Signal Processing', 'Communication Systems', 'VLSI Design'],
  'ME': ['Thermodynamics', 'Fluid Mechanics', 'Machine Design', 'Manufacturing Processes', 'Automobile Engineering'],
  'CE': ['Structural Analysis', 'Concrete Technology', 'Surveying', 'Soil Mechanics', 'Transportation Engineering'],
  'EE': ['Power Systems', 'Electrical Machines', 'Control Systems', 'Power Electronics', 'Circuit Theory'],
};

const INDUSTRIES = [
  { name: 'TCS', email: 'hr@tcs.com', city: 'Mohali', type: 'INFORMATION_TECHNOLOGY' },
  { name: 'Infosys', email: 'careers@infosys.com', city: 'Chandigarh', type: 'SOFTWARE_DEVELOPMENT' },
  { name: 'Maruti Suzuki', email: 'hr@maruti.co.in', city: 'Gurgaon', type: 'AUTOMOTIVE' },
  { name: 'L&T Constructions', email: 'jobs@lnt.com', city: 'Delhi', type: 'CONSTRUCTION' },
  { name: 'Havells', email: 'hr@havells.com', city: 'Noida', type: 'ELECTRONICS' },
];

const GRIEVANCE_TYPES = ['ACADEMIC', 'HOSTEL', 'INFRASTRUCTURE', 'HARASSMENT', 'OTHER'];
const TECHNICAL_QUERY_TYPES = ['LOGIN_ISSUE', 'PROFILE_UPDATE', 'DOCUMENT_UPLOAD', 'OTHER'];

// Realistic Indian Names
const MALE_FIRST_NAMES = [
  'Aarav', 'Arjun', 'Aditya', 'Akash', 'Amit', 'Ankit', 'Aryan', 'Ashish', 'Bharat', 'Chirag',
  'Deepak', 'Dhruv', 'Gaurav', 'Harsh', 'Himanshu', 'Ishaan', 'Jaspreet', 'Karan', 'Kartik', 'Kunal',
  'Lakshay', 'Manish', 'Mohit', 'Nakul', 'Naveen', 'Nikhil', 'Pankaj', 'Parth', 'Pranav', 'Rahul',
  'Raj', 'Rajat', 'Raman', 'Rohit', 'Sahil', 'Sandeep', 'Sanjay', 'Shubham', 'Sukhpreet', 'Sumit',
  'Tarun', 'Tushar', 'Varun', 'Vikram', 'Vikas', 'Yash', 'Yogesh', 'Harpreet', 'Gurpreet', 'Manpreet'
];

const FEMALE_FIRST_NAMES = [
  'Aanya', 'Aditi', 'Aisha', 'Ananya', 'Anjali', 'Anushka', 'Bhavna', 'Deepika', 'Divya', 'Ekta',
  'Gauri', 'Harleen', 'Ishita', 'Jasleen', 'Kajal', 'Kavya', 'Khushi', 'Kritika', 'Mansi', 'Meera',
  'Navneet', 'Neha', 'Nidhi', 'Pallavi', 'Pooja', 'Priya', 'Radhika', 'Rashi', 'Ritika', 'Sakshi',
  'Saniya', 'Sanya', 'Simran', 'Sneha', 'Sonali', 'Tanvi', 'Tanya', 'Urvi', 'Vanshika', 'Vidhi',
  'Yamini', 'Yukti', 'Zara', 'Harmanpreet', 'Gurleen', 'Manleen', 'Komalpreet', 'Amandeep', 'Ravneet', 'Kirandeep'
];

const LAST_NAMES = [
  'Sharma', 'Singh', 'Kumar', 'Verma', 'Gupta', 'Patel', 'Mehta', 'Agarwal', 'Jain', 'Chopra',
  'Malhotra', 'Kapoor', 'Bansal', 'Garg', 'Bhatia', 'Khanna', 'Sethi', 'Arora', 'Dhawan', 'Rana',
  'Gill', 'Sidhu', 'Sandhu', 'Dhillon', 'Bajwa', 'Brar', 'Cheema', 'Grewal', 'Bhullar', 'Randhawa',
  'Thakur', 'Chauhan', 'Negi', 'Rawat', 'Bisht', 'Saini', 'Chadha', 'Kohli', 'Ahuja', 'Taneja'
];

const TEACHER_TITLES = ['Dr.', 'Prof.', 'Er.', 'Mr.', 'Mrs.', 'Ms.'];

// Realistic Company Data for Self-Identified Internships
const REALISTIC_COMPANIES = [
  // IT/Software Companies - Punjab/Chandigarh Region
  { name: 'Quark Software Pvt Ltd', type: 'Software Development', locations: ['Mohali', 'Chandigarh'] },
  { name: 'Net Solutions', type: 'Web Development', locations: ['Mohali', 'Chandigarh'] },
  { name: 'IDS Infotech Ltd', type: 'IT Services', locations: ['Mohali'] },
  { name: 'Smartdata Enterprises', type: 'Software Development', locations: ['Mohali'] },
  { name: 'Kellton Tech Solutions', type: 'IT Consulting', locations: ['Chandigarh'] },
  { name: 'Netsmartz LLC', type: 'Web Development', locations: ['Mohali', 'Chandigarh'] },
  { name: 'Softcrylic Technologies', type: 'Software Development', locations: ['Mohali'] },
  { name: 'iEnergizer IT Services', type: 'BPO/IT', locations: ['Mohali'] },
  { name: 'Techjini Solutions', type: 'Mobile App Development', locations: ['Chandigarh'] },
  { name: 'Cyntexa Labs Pvt Ltd', type: 'Salesforce Development', locations: ['Mohali'] },

  // Manufacturing/Industrial Companies
  { name: 'Hero Cycles Ltd', type: 'Manufacturing', locations: ['Ludhiana'] },
  { name: 'Vardhman Textiles Ltd', type: 'Textile Manufacturing', locations: ['Ludhiana'] },
  { name: 'Nahar Group of Industries', type: 'Textile & Spinning', locations: ['Ludhiana'] },
  { name: 'Trident Group', type: 'Textile & Paper', locations: ['Barnala', 'Ludhiana'] },
  { name: 'JCT Electronics Ltd', type: 'Electronics Manufacturing', locations: ['Mohali'] },
  { name: 'Punjab Tractors Ltd', type: 'Automobile', locations: ['Mohali'] },
  { name: 'Sukhjit Starch & Chemicals Ltd', type: 'Chemical Manufacturing', locations: ['Phagwara'] },
  { name: 'Metalman Auto Pvt Ltd', type: 'Auto Components', locations: ['Ludhiana'] },
  { name: 'Ceratizit India Pvt Ltd', type: 'Precision Tools', locations: ['Mohali'] },
  { name: 'Gabriel India Ltd', type: 'Auto Parts', locations: ['Ludhiana'] },

  // Construction/Civil Companies
  { name: 'Supertech Limited', type: 'Construction', locations: ['Mohali', 'Chandigarh'] },
  { name: 'Omaxe Ltd', type: 'Real Estate', locations: ['Ludhiana', 'Mohali'] },
  { name: 'IREO Pvt Ltd', type: 'Infrastructure', locations: ['Mohali'] },
  { name: 'DLF Universal Ltd', type: 'Real Estate', locations: ['Chandigarh'] },
  { name: 'Ambuja Cement Works', type: 'Cement Manufacturing', locations: ['Rupnagar'] },
  { name: 'ACC Limited', type: 'Cement & Building Materials', locations: ['Rupnagar'] },
  { name: 'NBCC India Ltd', type: 'Construction', locations: ['Chandigarh'] },
  { name: 'Punjab State Power Corporation', type: 'Power Sector', locations: ['Patiala'] },

  // Electronics/Electrical Companies
  { name: 'Exide Industries Ltd', type: 'Battery Manufacturing', locations: ['Ludhiana'] },
  { name: 'Schneider Electric India', type: 'Electrical Equipment', locations: ['Mohali'] },
  { name: 'Siemens Ltd', type: 'Electrical Engineering', locations: ['Chandigarh'] },
  { name: 'ABB India Ltd', type: 'Power & Automation', locations: ['Mohali'] },
  { name: 'Havells India Ltd', type: 'Electrical Products', locations: ['Mohali'] },
  { name: 'Orient Electric Ltd', type: 'Electrical Appliances', locations: ['Ludhiana'] },
  { name: 'Crompton Greaves', type: 'Electrical Equipment', locations: ['Chandigarh'] },
  { name: 'Finolex Cables Ltd', type: 'Cables & Wires', locations: ['Mohali'] },

  // Startups & Small Companies
  { name: 'TechMatrix Innovations', type: 'IoT Solutions', locations: ['Mohali', 'Jalandhar'] },
  { name: 'CloudNine Technologies', type: 'Cloud Services', locations: ['Chandigarh'] },
  { name: 'DataVerse Analytics', type: 'Data Science', locations: ['Mohali'] },
  { name: 'CodeCrafters Studio', type: 'App Development', locations: ['Ludhiana', 'Jalandhar'] },
  { name: 'NexGen Softwares', type: 'ERP Solutions', locations: ['Amritsar'] },
  { name: 'DigiPunjab Solutions', type: 'Digital Marketing', locations: ['Jalandhar'] },
  { name: 'InnovateHub Labs', type: 'Product Development', locations: ['Mohali'] },
  { name: 'TechBridge Solutions', type: 'IT Consulting', locations: ['Patiala'] },
  { name: 'CyberSecure India', type: 'Cybersecurity', locations: ['Chandigarh'] },
  { name: 'GreenTech Engineers', type: 'Renewable Energy', locations: ['Bathinda'] },

  // Regional IT Companies
  { name: 'Punjab Infotech', type: 'Government IT', locations: ['Mohali'] },
  { name: 'Sify Technologies', type: 'IT Infrastructure', locations: ['Chandigarh'] },
  { name: 'HCL Technologies', type: 'IT Services', locations: ['Mohali'] },
  { name: 'Wipro Ltd', type: 'IT Services', locations: ['Chandigarh'] },
  { name: 'Infosys BPM', type: 'BPO Services', locations: ['Mohali'] },
  { name: 'Tech Mahindra', type: 'IT Services', locations: ['Chandigarh'] },
];

const COMPANY_ADDRESS_TEMPLATES = [
  { area: 'Industrial Area Phase', suffix: ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'] },
  { area: 'IT Park, Sector', suffix: ['17', '22', '34', '67', '74', '82'] },
  { area: 'SAS Nagar, Sector', suffix: ['68', '74', '75', '76', '82', '83'] },
  { area: 'Focal Point', suffix: ['Phase I', 'Phase II', 'Phase III', 'Extension'] },
  { area: 'GIDC Industrial Estate', suffix: ['Block A', 'Block B', 'Block C'] },
  { area: 'Electronic Complex', suffix: ['', 'Phase I', 'Phase II'] },
  { area: 'Software Technology Park', suffix: ['Building A', 'Building B', 'Tower 1', 'Tower 2'] },
];

const HR_DESIGNATIONS = [
  'HR Manager', 'HR Executive', 'Talent Acquisition Manager', 'Recruitment Lead',
  'HR Business Partner', 'Campus Recruitment Manager', 'HR Coordinator',
  'Senior HR Executive', 'People Operations Manager', 'Training Manager'
];

const INTERNSHIP_ROLES_BY_BRANCH: Record<string, string[]> = {
  'CSE': [
    'Software Development Intern', 'Web Developer Intern', 'Full Stack Developer Intern',
    'Backend Developer Intern', 'Frontend Developer Intern', 'DevOps Intern',
    'QA/Testing Intern', 'Mobile App Developer Intern', 'Data Science Intern',
    'Machine Learning Intern', 'Cloud Computing Intern', 'Cybersecurity Intern'
  ],
  'IT': [
    'IT Support Intern', 'System Administrator Intern', 'Network Engineer Intern',
    'Database Administrator Intern', 'Technical Support Intern', 'IT Infrastructure Intern',
    'Application Support Intern', 'Business Analyst Intern', 'ERP Intern', 'Helpdesk Intern'
  ],
  'ECE': [
    'Embedded Systems Intern', 'VLSI Design Intern', 'PCB Design Intern',
    'IoT Developer Intern', 'Firmware Engineer Intern', 'Hardware Design Intern',
    'Signal Processing Intern', 'Telecom Engineer Intern', 'RF Engineer Intern',
    'Automation Intern', 'Electronics Testing Intern', 'Control Systems Intern'
  ],
  'ME': [
    'Mechanical Design Intern', 'CAD/CAM Intern', 'Production Engineering Intern',
    'Quality Control Intern', 'Manufacturing Intern', 'Maintenance Engineer Intern',
    'CNC Programmer Intern', 'AutoCAD Designer Intern', 'Process Engineer Intern',
    'Industrial Engineering Intern', 'R&D Intern', 'Tool Design Intern'
  ],
  'CE': [
    'Site Engineer Intern', 'Structural Design Intern', 'Construction Management Intern',
    'Quantity Surveyor Intern', 'AutoCAD Draftsman Intern', 'Project Coordinator Intern',
    'Quality Assurance Intern', 'Estimation Intern', 'Planning Engineer Intern',
    'Building Design Intern', 'Infrastructure Intern', 'Surveyor Intern'
  ],
  'EE': [
    'Electrical Design Intern', 'Power Systems Intern', 'Control Panel Intern',
    'Maintenance Engineer Intern', 'Testing & Commissioning Intern', 'PLC Programmer Intern',
    'Electrical CAD Intern', 'Energy Audit Intern', 'Switchgear Intern',
    'Substation Design Intern', 'Solar Power Intern', 'Instrumentation Intern'
  ],
};

// ============================================
// HELPER FUNCTIONS
// ============================================

function randomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function randomNumber(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generatePhoneNumber(): string {
  return `+91-${randomNumber(70, 99)}${randomNumber(10000000, 99999999)}`;
}

async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, 10);
}

function generateStudentName(gender: 'Male' | 'Female'): string {
  const firstName = gender === 'Male'
    ? randomElement(MALE_FIRST_NAMES)
    : randomElement(FEMALE_FIRST_NAMES);
  const lastName = randomElement(LAST_NAMES);
  return `${firstName} ${lastName}`;
}

function generateTeacherName(): { name: string; title: string; gender: 'Male' | 'Female' } {
  const gender = Math.random() > 0.4 ? 'Male' : 'Female';
  const title = gender === 'Male'
    ? randomElement(['Dr.', 'Prof.', 'Er.', 'Mr.'])
    : randomElement(['Dr.', 'Prof.', 'Mrs.', 'Ms.']);
  const firstName = gender === 'Male'
    ? randomElement(MALE_FIRST_NAMES)
    : randomElement(FEMALE_FIRST_NAMES);
  const lastName = randomElement(LAST_NAMES);
  return { name: `${title} ${firstName} ${lastName}`, title, gender };
}

function generateHRDetails(): { name: string; email: string; designation: string } {
  const gender = Math.random() > 0.5 ? 'Male' : 'Female';
  const title = gender === 'Male' ? 'Mr.' : 'Ms.';
  const firstName = gender === 'Male'
    ? randomElement(MALE_FIRST_NAMES)
    : randomElement(FEMALE_FIRST_NAMES);
  const lastName = randomElement(LAST_NAMES);
  const designation = randomElement(HR_DESIGNATIONS);
  const emailDomain = randomElement(['gmail.com', 'outlook.com', 'yahoo.com']);
  const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${emailDomain}`;
  return {
    name: `${title} ${firstName} ${lastName}`,
    email,
    designation
  };
}

function generateCompanyAddress(city: string): string {
  const template = randomElement(COMPANY_ADDRESS_TEMPLATES);
  const suffix = randomElement(template.suffix);
  const plotNo = randomNumber(1, 500);
  return `Plot No. ${plotNo}, ${template.area} ${suffix}, ${city}, Punjab`;
}

function generateRealisticDOB(): string {
  const year = randomNumber(2002, 2005);
  const month = randomNumber(1, 12).toString().padStart(2, '0');
  const day = randomNumber(1, 28).toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getCompanyForBranch(branchShortName: string): typeof REALISTIC_COMPANIES[0] {
  // Filter companies that match the branch type
  const branchCompanyTypes: Record<string, string[]> = {
    'CSE': ['Software Development', 'Web Development', 'IT Services', 'IT Consulting', 'Mobile App Development', 'Salesforce Development', 'BPO/IT', 'IoT Solutions', 'Cloud Services', 'Data Science', 'App Development', 'ERP Solutions', 'Digital Marketing', 'Product Development', 'Cybersecurity', 'Government IT', 'IT Infrastructure'],
    'IT': ['Software Development', 'Web Development', 'IT Services', 'IT Consulting', 'BPO/IT', 'Cloud Services', 'ERP Solutions', 'IT Infrastructure', 'Government IT'],
    'ECE': ['Electronics Manufacturing', 'IoT Solutions', 'Telecom', 'Power & Automation', 'Electrical Equipment', 'Battery Manufacturing'],
    'ME': ['Manufacturing', 'Textile Manufacturing', 'Textile & Spinning', 'Textile & Paper', 'Automobile', 'Chemical Manufacturing', 'Auto Components', 'Precision Tools', 'Auto Parts'],
    'CE': ['Construction', 'Real Estate', 'Infrastructure', 'Cement Manufacturing', 'Cement & Building Materials', 'Power Sector'],
    'EE': ['Power Sector', 'Electrical Equipment', 'Electrical Engineering', 'Power & Automation', 'Electrical Products', 'Electrical Appliances', 'Cables & Wires', 'Battery Manufacturing', 'Renewable Energy'],
  };

  const matchingTypes = branchCompanyTypes[branchShortName] || branchCompanyTypes['CSE'];
  const matchingCompanies = REALISTIC_COMPANIES.filter(c => matchingTypes.includes(c.type));

  return matchingCompanies.length > 0 ? randomElement(matchingCompanies) : randomElement(REALISTIC_COMPANIES);
}

// ============================================
// MAIN SEED FUNCTION
// ============================================

async function main() {
  console.log('🌱 Starting Comprehensive Seed...\n');

  if (process.env.NODE_ENV === 'production') {
    console.error('❌ ERROR: Cannot run seed in production!');
    process.exit(1);
  }

  // 1. CLEANUP
  console.log('🗑️  Cleaning database...');
  await prisma.completionFeedback.deleteMany({});
  await prisma.monthlyFeedback.deleteMany({});
  await prisma.complianceRecord.deleteMany({});
  await prisma.approvedReferral.deleteMany({});
  await prisma.referralApplication.deleteMany({});
  await prisma.placement.deleteMany({});
  await prisma.scholarship.deleteMany({});
  await prisma.calendar.deleteMany({});
  await prisma.notice.deleteMany({});
  await prisma.internshipPreference.deleteMany({});
  await prisma.technicalQuery.deleteMany({});
  await prisma.grievance.deleteMany({});
  await prisma.facultyVisitLog.deleteMany({});
  await prisma.monthlyReport.deleteMany({});
  await prisma.mentorAssignment.deleteMany({});
  await prisma.internshipApplication.deleteMany({});
  await prisma.internship.deleteMany({});
  await prisma.industryRequest.deleteMany({});
  await prisma.industry.deleteMany({});
  await prisma.examResult.deleteMany({});
  await prisma.fee.deleteMany({});
  await prisma.document.deleteMany({});
  await prisma.notification.deleteMany({});
  await prisma.auditLog.deleteMany({});
  await prisma.student.deleteMany({});
  await prisma.subject.deleteMany({});
  await prisma.branch.deleteMany({});
  await prisma.batch.deleteMany({});
  await prisma.semester.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.institution.deleteMany({});
  console.log('✅ Database cleaned.\n');

  const defaultHashedPassword = await hashPassword(DEFAULT_PASSWORD);

  // 2. SYSTEM ADMIN & STATE DIRECTORATE
  console.log('👑 Creating Admin Users...');
  
  await prisma.user.create({
    data: {
      email: SYSTEM_ADMIN_EMAIL,
      password: await hashPassword(SYSTEM_ADMIN_PASSWORD),
      name: 'System Administrator',
      role: 'SYSTEM_ADMIN',
      active: true,
      designation: 'System Admin',
      phoneNo: '+91-9876543210',
    },
  });

  const stateDirectorate = await prisma.user.create({
    data: {
      email: STATE_ADMIN_EMAIL,
      password: await hashPassword(STATE_ADMIN_PASSWORD),
      name: 'DTE Punjab',
      role: 'STATE_DIRECTORATE',
      active: true,
      designation: 'Director',
      phoneNo: '+91-172-2700123',
    },
  });
  console.log('✅ Admins created.\n');

  // 3. INSTITUTIONS
  console.log('🏛️  Creating Institutions...');
  const institutions = [];
  for (let i = 0; i < PUNJAB_CITIES.length; i++) {
    const city = PUNJAB_CITIES[i];
    const inst = await prisma.institution.create({
      data: {
        code: `INST${(i + 1).toString().padStart(3, '0')}`,
        name: `Government Polytechnic ${city.city}`,
        shortName: `GP ${city.city}`,
        type: 'POLYTECHNIC',
        address: city.address,
        city: city.city,
        state: 'Punjab',
        pinCode: city.pinCode,
        country: 'India',
        contactEmail: `contact@gp${city.city.toLowerCase()}.edu.in`,
        contactPhone: generatePhoneNumber(),
        isActive: true,
      },
    });
    institutions.push(inst);
  }
  console.log(`✅ ${institutions.length} Institutions created.\n`);

  // 4. BATCH & SEMESTERS
  console.log('📅 Creating Batch & Semesters...');
  const batch = await prisma.batch.create({
    data: { name: '2023-2026', isActive: true, institutionId: institutions[0].id },
  });

  const semesters = [];
  for (const inst of institutions) {
    const sem = await prisma.semester.create({
      data: { number: 6, isActive: true, institutionId: inst.id },
    });
    semesters.push(sem);
  }
  console.log('✅ Batch & Semesters created.\n');

  // 5. BRANCHES & SUBJECTS
  console.log('🌿 Creating Branches & Subjects...');
  const branchMap: Record<string, any[]> = {}; // instId -> branches
  
  for (const inst of institutions) {
    branchMap[inst.id] = [];
    // Pick 3-4 random branches for this institution
    const instBranches = BRANCHES.sort(() => 0.5 - Math.random()).slice(0, 4);
    
    for (const b of instBranches) {
      const branch = await prisma.branch.create({
        data: {
          name: b.name,
          shortName: b.shortName,
          code: `${inst.code}-${b.code}`,
          duration: 3,
          isActive: true,
          institutionId: inst.id,
        },
      });
      branchMap[inst.id].push(branch);

      // Create Subjects for this branch
      const subjects = SUBJECTS_BY_BRANCH[b.shortName] || [];
      for (const subName of subjects) {
        await prisma.subject.create({
          data: {
            subjectName: subName,
            subjectCode: `${b.shortName}-${randomNumber(100, 999)}`,
            syllabusYear: 2023,
            semesterNumber: '6',
            branchName: b.name,
            maxMarks: 100,
            subjectType: 'THEORY',
            branchId: branch.id,
            institutionId: inst.id,
          },
        });
      }
    }
  }
  console.log('✅ Branches & Subjects created.\n');

  // 6. INSTITUTION STAFF (Principal, HODs, Teachers, Officers)
  console.log('👥 Creating Institution Staff...');
  const facultyMap: Record<string, any[]> = {}; // instId -> teachers

  for (const inst of institutions) {
    facultyMap[inst.id] = [];

    // Principal
    const principalName = generateTeacherName();
    await prisma.user.create({
      data: {
        email: `principal@gp${(inst.city || 'unknown').toLowerCase()}.edu.in`,
        password: defaultHashedPassword,
        name: principalName.name,
        role: 'PRINCIPAL',
        active: true,
        institutionId: inst.id,
        designation: 'Principal',
      },
    });

    // Placement Officer
    const tpoName = generateTeacherName();
    await prisma.user.create({
      data: {
        email: `tpo@gp${(inst.city || 'unknown').toLowerCase()}.edu.in`,
        password: defaultHashedPassword,
        name: tpoName.name,
        role: 'PLACEMENT_OFFICER',
        active: true,
        institutionId: inst.id,
        designation: 'Training & Placement Officer',
      },
    });

    // Accountant
    const accountantGender = Math.random() > 0.5 ? 'Male' : 'Female';
    const accountantName = generateStudentName(accountantGender);
    await prisma.user.create({
      data: {
        email: `accountant@gp${(inst.city || 'unknown').toLowerCase()}.edu.in`,
        password: defaultHashedPassword,
        name: `${accountantGender === 'Male' ? 'Mr.' : 'Mrs.'} ${accountantName}`,
        role: 'ACCOUNTANT',
        active: true,
        institutionId: inst.id,
        designation: 'Senior Accountant',
      },
    });

    // Admission Officer
    const admissionName = generateTeacherName();
    await prisma.user.create({
      data: {
        email: `admission@gp${(inst.city || 'unknown').toLowerCase()}.edu.in`,
        password: defaultHashedPassword,
        name: admissionName.name,
        role: 'ADMISSION_OFFICER',
        active: true,
        institutionId: inst.id,
        designation: 'Admission Incharge',
      },
    });

    // Examination Officer
    const examName = generateTeacherName();
    await prisma.user.create({
      data: {
        email: `exam@gp${(inst.city || 'unknown').toLowerCase()}.edu.in`,
        password: defaultHashedPassword,
        name: examName.name,
        role: 'EXAMINATION_OFFICER',
        active: true,
        institutionId: inst.id,
        designation: 'Exam Superintendent',
      },
    });

    // Teachers (5 per branch to create 500+ mentors: 22 institutions × 5 branches × 5 teachers = 550)
    for (const branch of branchMap[inst.id]) {
      for (let k = 0; k < 5; k++) {
        const teacherDetails = generateTeacherName();
        const teacherFirstName = teacherDetails.name.split(' ')[1].toLowerCase();
        const teacher = await prisma.user.create({
          data: {
            email: `${teacherFirstName}.${branch.shortName.toLowerCase()}.${k + 1}@gp${(inst.city || 'unknown').toLowerCase()}.edu.in`,
            password: defaultHashedPassword,
            name: teacherDetails.name,
            role: 'TEACHER',
            active: true,
            institutionId: inst.id,
            designation: randomElement(['Lecturer', 'Senior Lecturer', 'Assistant Professor', 'Workshop Instructor']),
          },
        });
        facultyMap[inst.id].push(teacher);
      }
    }
  }
  console.log('✅ Staff created.\n');

  // 7. INDUSTRIES (No posted internships - all students have self-identified)
  console.log('🏭 Creating Industries...');
  
  for (const indData of INDUSTRIES) {
    // Industry User
    const indUser = await prisma.user.create({
      data: {
        email: indData.email,
        password: defaultHashedPassword,
        name: indData.name,
        role: 'INDUSTRY',
        active: true,
        designation: 'HR Manager',
      },
    });

    // Industry Profile
    const industry = await prisma.industry.create({
      data: {
        userId: indUser.id,
        companyName: indData.name,
        industryType: indData.type as any,
        companySize: 'LARGE',
        website: `www.${indData.name.toLowerCase().replace(/\s/g, '')}.com`,
        address: `${indData.city}, India`,
        city: indData.city,
        state: 'Punjab',
        pinCode: '140001',
        contactPersonName: 'HR Manager',
        contactPersonTitle: 'HR Manager',
        primaryEmail: indData.email,
        primaryPhone: generatePhoneNumber(),
        registrationNumber: `REG${randomNumber(10000, 99999)}`,
        panNumber: `PAN${randomNumber(1000, 9999)}`,
        isApproved: true,
      },
    });

    // Industry Supervisor
    await prisma.user.create({
      data: {
        email: `supervisor@${indData.name.toLowerCase().replace(/\s/g, '')}.com`,
        password: defaultHashedPassword,
        name: `Supervisor ${indData.name}`,
        role: 'INDUSTRY_SUPERVISOR',
        active: true,
        designation: 'Technical Lead',
      },
    });

    // Removed industry-posted internships - all students have self-identified internships
  }
  console.log('✅ Industries created (no posted internships).\n');

  // 8. STUDENTS & ACADEMIC DATA
  console.log('🎓 Creating Students & Academic Data...');
  const allStudents: any[] = [];

  // Punjab villages and localities for realistic addresses
  const LOCALITIES = [
    'Model Town', 'Civil Lines', 'Sadar Bazaar', 'New Colony', 'Old City',
    'Guru Nanak Nagar', 'Shastri Nagar', 'Rajpura Road', 'GT Road', 'Mall Road',
    'Prem Nagar', 'Adarsh Nagar', 'Vikas Nagar', 'Green Park', 'Lajpat Nagar',
    'Gandhi Nagar', 'Nehru Colony', 'Subhash Nagar', 'Tagore Nagar', 'Ranjit Avenue'
  ];

  for (const inst of institutions) {
    const branches = branchMap[inst.id];
    // Create ~18 students per branch (18 × 5 branches × 22 institutions ≈ 2000 students)
    for (const branch of branches) {
      for (let k = 0; k < 18; k++) {
        const rollNo = `${new Date().getFullYear()}${branch.shortName}${(inst.code || 'INST000').substring(4)}${k.toString().padStart(3, '0')}`;
        const gender: 'Male' | 'Female' = Math.random() > 0.45 ? 'Male' : 'Female';
        const studentName = generateStudentName(gender);
        const dob = generateRealisticDOB();
        const locality = randomElement(LOCALITIES);
        const houseNo = randomNumber(1, 500);
        const address = `H.No. ${houseNo}, ${locality}`;

        // User
        const user = await prisma.user.create({
          data: {
            email: `${rollNo.toLowerCase()}@student.com`,
            password: defaultHashedPassword,
            name: studentName,
            role: 'STUDENT',
            active: true,
            institutionId: inst.id,
            rollNumber: rollNo,
            branchName: branch.shortName,
          },
        });

        // Student Profile
        const student = await prisma.student.create({
          data: {
            userId: user.id,
            rollNumber: rollNo,
            admissionNumber: `ADM${rollNo}`,
            name: studentName,
            email: user.email,
            contact: generatePhoneNumber(),
            gender: gender,
            dob: dob,
            address: address,
            city: inst.city,
            state: 'Punjab',
            institutionId: inst.id,
            branchId: branch.id,
            branchName: branch.name,
            batchId: batch.id,
            currentSemester: 6,
            admissionType: randomElement([AdmissionType.FIRST_YEAR, AdmissionType.FIRST_YEAR, AdmissionType.FIRST_YEAR, AdmissionType.LEET]),
            category: randomElement([Category.GENERAL, Category.GENERAL, Category.SC, Category.ST, Category.OBC]),
            clearanceStatus: ClearanceStatus.CLEARED,
            isActive: true,
          },
        });
        allStudents.push({ student, user, branch, inst });

        // Exam Results (Mock) - Skip for now as it requires subjectId and semesterId
        // await prisma.examResult.create({
        //   data: {
        //     studentId: student.id,
        //     semesterId: semesters.find(s => s.institutionId === inst.id)?.id || '',
        //     subjectId: '', // Would need actual subject
        //     marks: randomNumber(60, 95),
        //     maxMarks: 100,
        //   },
        // });

        // Fees (Mock)
        await prisma.fee.create({
          data: {
            studentId: student.id,
            semesterId: semesters.find(s => s.institutionId === inst.id)?.id || '',
            amountDue: 25000,
            amountPaid: Math.random() > 0.2 ? 25000 : 0,
            dueDate: new Date(),
            status: Math.random() > 0.2 ? 'PAID' : 'PENDING',
            institutionId: inst.id,
          },
        });
      }
    }
  }
  console.log(`✅ ${allStudents.length} Students created.\n`);

  // 8A. INTERNSHIP PREFERENCES
  console.log('🎯 Creating Internship Preferences...');
  
  for (const { student } of allStudents) {
    if (Math.random() > 0.3) { // 70% of students have preferences
      await prisma.internshipPreference.create({
        data: {
          studentId: student.id,
          preferredFields: randomElement([
            ['Software Development', 'Web Development'],
            ['Data Science', 'Machine Learning'],
            ['Electronics', 'Embedded Systems'],
            ['Mechanical Design', 'Manufacturing'],
            ['Civil Engineering', 'Construction']
          ]),
          preferredLocations: randomElement([
            ['Mohali', 'Chandigarh'],
            ['Ludhiana', 'Jalandhar'],
            ['Delhi', 'Gurgaon', 'Noida'],
            ['Bangalore', 'Pune', 'Hyderabad']
          ]),
          preferredDurations: randomElement([
            ['6 Months', '8 Weeks'],
            ['12 Weeks', '6 Months'],
            ['6 Months']
          ]),
          minimumStipend: randomNumber(3000, 10000),
          isRemotePreferred: Math.random() > 0.6,
          additionalRequirements: randomElement([
            'Prefer companies with good learning environment',
            'Looking for hands-on technical work',
            'Interested in working with latest technologies',
            null
          ]),
        },
      });
    }
  }
  console.log('✅ Internship Preferences created.\n');

  // 9. INTERNSHIP APPLICATIONS & MENTORSHIP
  console.log('📝 Creating Applications & Mentorships...');
  
  const internshipStartDate = new Date('2025-12-15'); // December 15, 2025 start
  const internshipEndDate = new Date('2026-05-15'); // May 15, 2026 end
  
  const studentsWithInternships: any[] = [];
  
  // All students have self-identified internships (100%)
  for (const { student, inst, branch } of allStudents) {
    const startDate = new Date(internshipStartDate); // All start on Dec 15
    const endDate = new Date(internshipEndDate); // All end on May 15

    // Get a realistic company matching the student's branch
    const company = getCompanyForBranch(branch.shortName);
    const companyLocation = randomElement(company.locations);
    const companyAddress = generateCompanyAddress(companyLocation);
    const hrDetails = generateHRDetails();

    // Generate realistic company email domain
    const companyEmailDomain = company.name.toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .substring(0, 15) + '.com';

    // Get branch-specific internship role
    const internshipRoles = INTERNSHIP_ROLES_BY_BRANCH[branch.shortName] || INTERNSHIP_ROLES_BY_BRANCH['CSE'];
    const internshipRole = randomElement(internshipRoles);

    // Generate stipend based on company type
    const isLargeCompany = ['HCL Technologies', 'Wipro Ltd', 'Infosys BPM', 'Tech Mahindra', 'Schneider Electric India', 'Siemens Ltd', 'ABB India Ltd'].includes(company.name);
    const stipendAmount = isLargeCompany ? randomNumber(10000, 20000) : randomNumber(5000, 12000);

    const app = await prisma.internshipApplication.create({
      data: {
        studentId: student.id,
        isSelfIdentified: true,
        companyName: company.name,
        companyAddress: companyAddress,
        hrName: hrDetails.name,
        hrContact: generatePhoneNumber(),
        hrEmail: `hr@${companyEmailDomain}`,
        status: 'APPROVED',
        internshipStatus: 'ONGOING',
        startDate: startDate,
        endDate: endDate,
        joiningDate: startDate, // Joining report date
      },
    });

    studentsWithInternships.push({ student, app, startDate, endDate, inst, branch, company, internshipRole, stipendAmount });

    // Assign Mentor
    const teachers = facultyMap[inst.id];
    if (teachers && teachers.length > 0) {
      const mentor = randomElement(teachers);
      await prisma.mentorAssignment.create({
        data: {
          studentId: student.id,
          mentorId: mentor.id,
          assignedBy: teachers[0].id,
          assignmentDate: startDate,
          isActive: true,
          academicYear: '2025-26',
          semester: '6',
        },
      });

      // Create Multiple Faculty Visits (2-4 visits during internship)
      const numVisits = randomNumber(2, 4);
      for (let v = 0; v < numVisits; v++) {
        const visitDate = new Date(startDate);
        visitDate.setDate(visitDate.getDate() + (v * 30) + randomNumber(0, 15)); // Monthly visits

        if (visitDate <= new Date() && visitDate >= startDate) {
          const visitTypeOptions = ['PHYSICAL', 'VIRTUAL', 'TELEPHONIC'] as const;
          const visitType = randomElement([...visitTypeOptions]);

          // Realistic performance observations
          const performanceComments = [
            `${student.name} is actively contributing to the ${internshipRole} role. Showing good understanding of ${company.type} domain.`,
            `Student demonstrates strong technical aptitude. Currently working on live projects at ${company.name}.`,
            `Good progress observed. ${student.name} has developed skills in ${randomElement(['coding', 'testing', 'documentation', 'design', 'analysis'])}.`,
            `${student.name} is well-integrated with the team at ${company.name}. Supervisor feedback is positive.`,
            `Satisfactory performance. Student is learning ${company.type} specific tools and technologies.`,
          ];

          const workEnvironmentComments = [
            `${company.name} provides a professional work environment with modern infrastructure and equipment.`,
            `The company has dedicated mentorship program. ${student.name} is assigned to a senior ${randomElement(['engineer', 'developer', 'technician', 'manager'])}.`,
            `Good learning environment at ${company.name}. Company follows industry-standard practices.`,
            `Work culture is supportive. Team members are helpful and provide regular guidance to interns.`,
            `Infrastructure is adequate for practical training. ${company.name} has ${randomElement(['modern labs', 'well-equipped workshops', 'latest software tools', 'updated machinery'])}.`,
          ];

          const industrySupportComments = [
            `Industry supervisor is regularly monitoring student progress. Weekly review meetings are conducted.`,
            `${company.name} provides hands-on training with real projects. Student is getting exposure to ${company.type}.`,
            `Company offers stipend of Rs. ${stipendAmount}/month. ${randomElement(['Canteen facility available', 'Transport facility provided', 'Accommodation support given', 'Flexible timings allowed'])}.`,
            `Regular feedback sessions are conducted. Student receives constructive guidance from industry mentors.`,
            `Company assigns meaningful tasks aligned with academic curriculum. Good industry-academia collaboration.`,
          ];

          await prisma.facultyVisitLog.create({
            data: {
              applicationId: app.id,
              facultyId: mentor.id,
              visitDate: visitDate,
              visitType: visitType,
              studentPerformance: randomElement(performanceComments),
              visitDuration: randomElement(['30 Minutes', '45 Minutes', '1 Hour', '1.5 Hours', '2 Hours']),
              workEnvironment: randomElement(workEnvironmentComments),
              industrySupport: randomElement(industrySupportComments),
            },
          });
        }
      }
    }
  }
  console.log('✅ Applications created.\n');

  // 10. MONTHLY REPORTS
  console.log('📊 Creating Monthly Reports...');
  
  for (const { student, app, startDate, endDate, inst } of studentsWithInternships) {
    const currentDate = new Date();
    let reportMonth = new Date(startDate);
    
    // Generate monthly reports from start date to current date or end date
    while (reportMonth <= currentDate && reportMonth <= endDate) {
      const monthEnd = new Date(reportMonth);
      monthEnd.setMonth(monthEnd.getMonth() + 1);
      monthEnd.setDate(0); // Last day of month
      
      // Only create report if the month has passed
      if (monthEnd <= currentDate) {
        await prisma.monthlyReport.create({
          data: {
            applicationId: app.id,
            studentId: student.id,
            reportMonth: reportMonth.getMonth() + 1,
            reportYear: reportMonth.getFullYear(),
            reportFileUrl: `https://storage.example.com/monthly-reports/${student.rollNumber}_${reportMonth.getMonth() + 1}_${reportMonth.getFullYear()}.pdf`,
            status: 'SUBMITTED',
            submittedAt: monthEnd,
          },
        });
      }
      
      reportMonth.setMonth(reportMonth.getMonth() + 1);
      reportMonth.setDate(1); // First day of next month
    }
  }
  console.log('✅ Monthly Reports created.\n');

  // 10A. MONTHLY FEEDBACK (From Industry)
  console.log('📝 Creating Monthly Feedback from Industries...');
  
  for (const { student, app, startDate, endDate, inst } of studentsWithInternships) {
    if (!app.isSelfIdentified && app.internshipId) {
      const currentDate = new Date();
      let feedbackMonth = new Date(startDate);
      
      while (feedbackMonth <= currentDate && feedbackMonth <= endDate) {
        const monthEnd = new Date(feedbackMonth);
        monthEnd.setMonth(monthEnd.getMonth() + 1);
        
        if (monthEnd <= currentDate && Math.random() > 0.2) { // 80% feedback submission rate
          await prisma.monthlyFeedback.create({
            data: {
              applicationId: app.id,
              studentId: student.id,
              internshipId: app.internshipId,
              industryId: app.internship?.industryId,
              feedbackMonth: feedbackMonth,
              attendanceRating: randomNumber(3, 5),
              performanceRating: randomNumber(3, 5),
              punctualityRating: randomNumber(3, 5),
              technicalSkillsRating: randomNumber(3, 5),
              overallRating: randomNumber(3, 5),
              strengths: randomElement([
                'Good technical understanding',
                'Quick learner',
                'Excellent team player',
                'Strong problem-solving skills'
              ]),
              areasForImprovement: randomElement([
                'Time management',
                'Communication skills',
                'Technical depth',
                'Initiative taking'
              ]),
              tasksAssigned: `Module development, Testing, Documentation`,
              tasksCompleted: `Successfully completed ${randomNumber(4, 10)} tasks`,
              overallComments: 'Good performance overall',
              submittedBy: app.internship?.industryId || '',
            },
          });
        }
        
        feedbackMonth.setMonth(feedbackMonth.getMonth() + 1);
      }
    }
  }
  console.log('✅ Monthly Feedback created.\n');

  // 10B. COMPLETION FEEDBACK
  console.log('🏆 Creating Completion Feedback...');
  
  for (const { student, app } of studentsWithInternships) {
    if (app.endDate && app.endDate < new Date() && Math.random() > 0.3) {
      await prisma.completionFeedback.create({
        data: {
          applicationId: app.id,
          industryId: app.internship?.industryId,
          industryRating: randomNumber(7, 10),
          industryFeedback: randomElement([
            'Excellent intern, showed great potential',
            'Good performance throughout the internship',
            'Met all expectations successfully',
            'Hardworking and dedicated student'
          ]),
          finalPerformance: 'Good overall performance',
          recommendForHire: Math.random() > 0.4,
          skillsLearned: 'Technical skills, teamwork, communication',
          isCompleted: true,
          completionCertificate: `https://storage.example.com/certificates/${student.rollNumber}_completion.pdf`,
          industrySubmittedAt: app.endDate,
        },
      });
    }
  }
  console.log('✅ Completion Feedback created.\n');

  // 10C. COMPLIANCE RECORDS
  console.log('✅ Creating Compliance Records...');
  
  for (const { student, app, startDate } of studentsWithInternships) {
    const requiredVisits = 4;
    const completedVisits = await prisma.facultyVisitLog.count({
      where: { applicationId: app.id }
    });
    
    await prisma.complianceRecord.create({
      data: {
        studentId: student.id,
        complianceType: 'FACULTY_VISIT',
        status: completedVisits >= requiredVisits ? 'COMPLIANT' : 'PENDING_REVIEW',
        requiredVisits: requiredVisits,
        completedVisits: completedVisits,
        lastVisitDate: new Date(),
        nextVisitDue: new Date(new Date().setDate(new Date().getDate() + 30)),
        academicYear: '2025-26',
        semester: '6',
        remarks: completedVisits >= requiredVisits ? 'All visits completed' : 'Visits pending',
      },
    });
  }
  console.log('✅ Compliance Records created.\n');

  // 11. DOCUMENTS & JOINING REPORTS
  console.log('📄 Creating Documents & Joining Reports...');
  
  for (const { student, app, startDate, inst } of studentsWithInternships) {
    // Joining Report Document
    await prisma.document.create({
      data: {
        studentId: student.id,
        type: 'OTHER',
        fileName: `Joining_Report_${student.rollNumber}.pdf`,
        fileUrl: `https://storage.example.com/joining-reports/${student.rollNumber}.pdf`,
      },
    });

    // Internship Offer Letter
    await prisma.document.create({
      data: {
        studentId: student.id,
        type: 'OTHER',
        fileName: `Offer_Letter_${student.rollNumber}.pdf`,
        fileUrl: `https://storage.example.com/offers/${student.rollNumber}.pdf`,
      },
    });

    // Resume
    await prisma.document.create({
      data: {
        studentId: student.id,
        type: 'OTHER',
        fileName: `Resume_${student.rollNumber}.pdf`,
        fileUrl: `https://storage.example.com/resumes/${student.rollNumber}.pdf`,
      },
    });

    // ID Proof
    await prisma.document.create({
      data: {
        studentId: student.id,
        type: 'OTHER',
        fileName: `Aadhaar_${student.rollNumber}.pdf`,
        fileUrl: `https://storage.example.com/id-proofs/${student.rollNumber}.pdf`,
      },
    });

    // Completion Certificate (for internships that have ended)
    if (app.endDate && app.endDate < new Date()) {
      await prisma.document.create({
        data: {
          studentId: student.id,
          type: 'OTHER',
          fileName: `Completion_Certificate_${student.rollNumber}.pdf`,
          fileUrl: `https://storage.example.com/certificates/${student.rollNumber}.pdf`,
        },
      });
    }
  }
  console.log('✅ Documents created.\n');

  // 12. INDUSTRY REQUESTS
  console.log('🏢 Creating Industry Requests...');
  
  const industriesForRequests = await prisma.industry.findMany();
  for (const industry of industriesForRequests) {
    // Create 1-2 requests per industry for student placements
    const numRequests = randomNumber(1, 2);
    for (let i = 0; i < numRequests; i++) {
      await prisma.industryRequest.create({
        data: {
          industryId: industry.id,
          institutionId: institutions[0].id,
          requestedBy: stateDirectorate.id,
          requestType: randomElement(['INTERNSHIP_PARTNERSHIP', 'PLACEMENT_DRIVE', 'INDUSTRY_VISIT']),
          title: `Request for ${randomElement(['Engineering Students', 'Technical Interns', 'Final Year Students'])}`,
          description: `We are looking for talented students from ${randomElement(['CSE', 'IT', 'ECE', 'ME'])} branch for ${randomElement(['6 months internship', '1 year training', 'summer internship'])}`,
          status: randomElement(['SENT', 'UNDER_REVIEW', 'ACCEPTED', 'REJECTED', 'IN_PROGRESS']),
          priority: randomElement(['LOW', 'MEDIUM', 'HIGH']),
        },
      });
    }
  }
  console.log('✅ Industry Requests created.\n');

  // 12A. REFERRAL APPLICATIONS & APPROVED REFERRALS
  console.log('🤝 Creating Referral Applications...');
  
  const industriesForReferrals = await prisma.industry.findMany();
  for (let i = 0; i < 5; i++) {
    const industry = randomElement(industriesForReferrals);
    const statusVal = randomElement(['PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'] as const);
    
    const referralApp = await prisma.referralApplication.create({
      data: {
        industryId: industry.id,
        institutionId: institutions[0].id,
        title: `${industry.companyName} Partnership Application`,
        description: `Application for ${randomElement(['internship collaboration', 'placement partnership', 'guest lecture series'])}`,
        referralType: randomElement(['INDUSTRY_PARTNERSHIP', 'INTERNSHIP_PROVIDER', 'PLACEMENT_ASSISTANCE', 'GUEST_LECTURER']),
        targetAudience: ['STUDENTS', 'FACULTY'],
        qualifications: 'Established company with good track record',
        experienceDetails: `${randomNumber(5, 20)} years of experience in the industry`,
        proposedBenefits: 'Regular internships, placements, and industry exposure',
        status: statusVal,
        applicationDate: new Date(new Date().setDate(new Date().getDate() - randomNumber(10, 60))),
      },
    });

    // Create Approved Referral if status is APPROVED
    if (statusVal === 'APPROVED') {
      await prisma.approvedReferral.create({
        data: {
          applicationId: referralApp.id,
          industryId: industry.id,
          referralCode: `REF${randomNumber(1000, 9999)}`,
          displayName: `${industry.companyName} - Referral`,
          description: `Approved referral for ${industry.companyName}`,
          referralType: referralApp.referralType,
          isActive: true,
          usageCount: randomNumber(0, 5),
          maxUsageLimit: randomNumber(10, 50),
          tags: ['APPROVED', 'ACTIVE'],
          category: randomElement(['Premium', 'Standard']),
          priority: randomNumber(1, 10),
        },
      });
    }
  }
  console.log('✅ Referral Applications created.\n');

  // 12B. SCHOLARSHIPS
  console.log('🎓 Creating Scholarships...');
  
  for (let i = 0; i < 15; i++) {
    const { student, inst } = randomElement(allStudents);
    await prisma.scholarship.create({
      data: {
        institutionId: inst.id,
        type: randomElement(['CMS50', 'CMS60', 'CMS70', 'CMS80', 'PMS', 'FWS']),
        amount: randomNumber(5000, 50000),
        status: randomElement(['APPROVED', 'REJECTED', 'DISBURSED']),
      },
    });
  }
  console.log('✅ Scholarships created.\n');

  // 12C. PLACEMENTS - REMOVED (Only self-identified internships are used)
  console.log('⏭️  Skipping Placements (not used - self-identified internships only).\n');

  // 12D. CALENDAR EVENTS
  console.log('📅 Creating Calendar Events...');
  
  for (const inst of institutions) {
    await prisma.calendar.create({
      data: {
        institutionId: inst.id,
        title: 'Semester Start',
        startDate: new Date('2025-12-01'),
        endDate: new Date('2025-12-01'),
      },
    });
    
    await prisma.calendar.create({
      data: {
        institutionId: inst.id,
        title: 'Mid-Semester Exams',
        startDate: new Date('2026-02-15'),
        endDate: new Date('2026-02-28'),
      },
    });
    
    await prisma.calendar.create({
      data: {
        institutionId: inst.id,
        title: 'Semester End Exams',
        startDate: new Date('2026-05-01'),
        endDate: new Date('2026-05-20'),
      },
    });
  }
  console.log('✅ Calendar Events created.\n');

  // 12E. NOTICES
  console.log('📢 Creating Notices...');
  
  for (const inst of institutions) {
    await prisma.notice.create({
      data: {
        institutionId: inst.id,
        title: 'Important: Internship Registration Open',
        message: 'All 6th semester students must register for internships by January 15, 2026.',
      },
    });
    
    await prisma.notice.create({
      data: {
        institutionId: inst.id,
        title: 'Monthly Report Submission Reminder',
        message: 'Students currently doing internships must submit their monthly reports by the 5th of every month.',
      },
    });
    
    await prisma.notice.create({
      data: {
        institutionId: inst.id,
        title: 'Fee Payment Deadline',
        message: 'Last date to pay semester fees is December 31, 2025.',
      },
    });
  }
  console.log('✅ Notices created.\n');

  // 13. AUDIT LOGS
  console.log('📋 Creating Audit Logs...');
  
  const allUsers = await prisma.user.findMany({ take: 50 });
  const actions = [
    'USER_LOGIN',
    'USER_LOGOUT',
    'USER_PROFILE_UPDATE',
    'STUDENT_DOCUMENT_UPLOAD',
    'APPLICATION_SUBMIT',
    'APPLICATION_APPROVE',
    'MONTHLY_FEEDBACK_SUBMIT',
    'STUDENT_PROFILE_UPDATE',
    'INTERNSHIP_CREATE'
  ];
  
  for (let i = 0; i < 100; i++) {
    const user = randomElement(allUsers);
    const action = randomElement(actions);
    const timestamp = new Date();
    timestamp.setDate(timestamp.getDate() - randomNumber(0, 90));
    
    // Get a random student ID for entityId
    const randomStudent = randomElement(await prisma.student.findMany({ take: 50 }));
    
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: action as any,
        userRole: user.role || 'STUDENT',
        userName: user.name,
        entityType: randomElement(['User', 'Student', 'Application', 'Document', 'Report']),
        entityId: randomStudent?.id,
        oldValues: { status: 'pending' },
        newValues: { status: 'completed' },
        changedFields: ['status'],
        category: 'INTERNSHIP_WORKFLOW',
        severity: 'LOW',
        timestamp: timestamp,
      },
    });
  }
  console.log('✅ Audit Logs created.\n');

  // 14. GRIEVANCES & QUERIES
  console.log('📫 Creating Grievances & Queries...');
  
  // Realistic grievance templates
  const GRIEVANCE_TEMPLATES = [
    {
      category: 'INTERNSHIP_RELATED',
      titles: [
        'Internship company not providing proper training',
        'Stipend payment delayed by company',
        'Work hours exceeding agreed schedule',
        'No relevant work assigned during internship',
        'Safety concerns at workplace'
      ],
      descriptions: [
        'The assigned tasks are not related to my field of study. I am not getting proper technical exposure.',
        'My stipend for last month has not been credited. Company HR is not responding to queries.',
        'I am being asked to work beyond 8 hours daily including weekends without any overtime compensation.',
        'I have been assigned only clerical work instead of technical tasks related to my branch.',
        'The workshop area lacks proper safety equipment. There are no fire extinguishers in the production area.'
      ]
    },
    {
      category: 'MENTOR_RELATED',
      titles: [
        'Faculty mentor not responding to queries',
        'Mentor visit not conducted as per schedule',
        'Need change of faculty mentor',
        'Mentor not providing proper guidance',
        'Unable to contact assigned mentor'
      ],
      descriptions: [
        'My faculty mentor has not responded to my emails for the past 2 weeks. I need guidance on my monthly report.',
        'The scheduled mentor visit for this month was cancelled without any prior notice or rescheduling.',
        'Due to personal reasons, I request a change in my assigned faculty mentor.',
        'My mentor is not providing clear guidance on the internship requirements and documentation.',
        'The contact details provided for my mentor are incorrect. Unable to reach for important updates.'
      ]
    },
    {
      category: 'WORK_ENVIRONMENT',
      titles: [
        'Harassment at workplace',
        'Discrimination by supervisor',
        'Unhealthy working conditions',
        'Lack of basic amenities',
        'Hostile behavior from colleagues'
      ],
      descriptions: [
        'I am facing verbal harassment from a senior employee. This is affecting my mental health and work.',
        'I am being treated differently compared to other interns. Not being included in team meetings.',
        'The workplace has poor ventilation and lighting. This is affecting my health and productivity.',
        'There is no proper restroom facility or drinking water arrangement at the work site.',
        'Some colleagues are not cooperative and create obstacles in my learning and work.'
      ]
    },
    {
      category: 'OTHER',
      titles: [
        'Document verification pending',
        'Certificate not issued by company',
        'Leave application not approved',
        'Transport issue to workplace',
        'Accommodation problem near workplace'
      ],
      descriptions: [
        'My joining documents submitted 3 weeks ago are still pending verification. Need urgent clearance.',
        'Despite completing my internship, the company has not issued my experience certificate.',
        'I applied for medical leave 2 weeks ago but it is still pending approval from the company.',
        'The workplace is 40 km from my residence and there is no public transport available.',
        'Unable to find affordable accommodation near the workplace. Facing difficulty in commuting.'
      ]
    }
  ];

  // Create realistic grievances
  for (let i = 0; i < 30; i++) {
    const { student } = randomElement(allStudents);
    const template = randomElement(GRIEVANCE_TEMPLATES);
    const titleIndex = randomNumber(0, template.titles.length - 1);

    await prisma.grievance.create({
      data: {
        studentId: student.id,
        title: template.titles[titleIndex],
        description: template.descriptions[titleIndex],
        category: template.category as any,
        status: randomElement(['PENDING', 'IN_PROGRESS', 'RESOLVED', 'ESCALATED']),
        severity: randomElement(['LOW', 'MEDIUM', 'HIGH']),
      },
    });
  }

  // Realistic technical query templates
  const TECHNICAL_QUERY_TEMPLATES = [
    {
      title: 'Unable to login to portal',
      description: 'Getting "Invalid credentials" error even with correct password. Tried resetting password but same issue persists.'
    },
    {
      title: 'Monthly report upload failing',
      description: 'When trying to upload monthly report PDF, the system shows "Upload failed" error. File size is within limit.'
    },
    {
      title: 'Profile update not saving',
      description: 'Changes made to contact number and address are not being saved. Getting timeout error after clicking save.'
    },
    {
      title: 'Internship application stuck in pending',
      description: 'Submitted internship application 5 days ago but status still shows "Pending Review". No update received.'
    },
    {
      title: 'Cannot download joining report',
      description: 'Getting 404 error when trying to download the approved joining report from documents section.'
    },
    {
      title: 'OTP not received for verification',
      description: 'Not receiving OTP on registered mobile number for document verification. Tried multiple times.'
    },
    {
      title: 'Dashboard showing incorrect data',
      description: 'My attendance percentage and monthly report status showing incorrect information on the dashboard.'
    },
    {
      title: 'Session timeout issue',
      description: 'Getting logged out frequently even while actively working on the portal. Session expires within 2 minutes.'
    },
    {
      title: 'Certificate download not working',
      description: 'Completion certificate shows as approved but download button is greyed out and not clickable.'
    },
    {
      title: 'Notification not showing',
      description: 'Not receiving any email or portal notifications for important updates like mentor visit schedule.'
    }
  ];

  // Create realistic technical queries
  for (let i = 0; i < 20; i++) {
    const { user } = randomElement(allStudents);
    const template = randomElement(TECHNICAL_QUERY_TEMPLATES);

    await prisma.technicalQuery.create({
      data: {
        userId: user.id,
        title: template.title,
        description: template.description,
        status: randomElement(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']),
        priority: randomElement(['LOW', 'MEDIUM', 'HIGH']),
      },
    });
  }
  console.log('✅ Grievances & Queries created.\n');

  // 15. NOTIFICATIONS
  console.log('🔔 Creating Notifications...');

  const NOTIFICATION_TEMPLATES = [
    { title: 'Monthly Report Due', body: 'Your monthly internship report for this month is due in 3 days. Please submit before the deadline.', type: 'WARNING' },
    { title: 'Mentor Visit Scheduled', body: 'Your faculty mentor has scheduled a visit on the upcoming week. Please ensure your supervisor is available.', type: 'INFO' },
    { title: 'Report Approved', body: 'Your monthly report has been reviewed and approved by your faculty mentor.', type: 'SUCCESS' },
    { title: 'Document Verification Complete', body: 'Your internship documents have been verified successfully. You can now download your joining report.', type: 'SUCCESS' },
    { title: 'Stipend Update', body: 'Please update your bank details for stipend disbursement in your profile section.', type: 'INFO' },
    { title: 'Attendance Reminder', body: 'Please ensure regular attendance at your internship. Attendance below 75% may affect your grade.', type: 'WARNING' },
    { title: 'New Internship Opportunity', body: 'A new internship opportunity matching your profile is available. Check the internship section.', type: 'INFO' },
    { title: 'Profile Incomplete', body: 'Your profile is 80% complete. Please add your skills and certifications for better opportunities.', type: 'INFO' },
    { title: 'Feedback Requested', body: 'Your company supervisor has requested feedback about your internship experience. Please respond.', type: 'INFO' },
    { title: 'Certificate Available', body: 'Your internship completion certificate is now available for download in the documents section.', type: 'SUCCESS' },
    { title: 'Holiday Notice', body: 'Upcoming public holiday on next week. Internship work may be affected. Confirm with your company.', type: 'INFO' },
    { title: 'Emergency Contact Update', body: 'Please verify and update your emergency contact details in the profile section.', type: 'WARNING' },
    { title: 'Session Expiry Warning', body: 'Your login session will expire in 5 minutes. Please save your work.', type: 'WARNING' },
    { title: 'Welcome to Internship Portal', body: 'Welcome! Complete your profile setup to access all features of the internship management system.', type: 'INFO' },
    { title: 'Grievance Update', body: 'Your grievance has been reviewed. Check the grievance section for updates from the committee.', type: 'INFO' },
  ];

  for (let i = 0; i < 100; i++) {
    const { user } = randomElement(allStudents);
    const template = randomElement(NOTIFICATION_TEMPLATES);
    const createdAt = new Date();
    createdAt.setDate(createdAt.getDate() - randomNumber(0, 30));

    await prisma.notification.create({
      data: {
        userId: user.id,
        title: template.title,
        body: template.body,
        type: template.type as any,
        read: Math.random() > 0.4,
        createdAt: createdAt,
      },
    });
  }
  console.log('✅ Notifications created.\n');

  console.log('🎉 SEEDING COMPLETE!');
  console.log(`
  Credentials:
  - System Admin: ${SYSTEM_ADMIN_EMAIL} / ${SYSTEM_ADMIN_PASSWORD}
  - State Admin: ${STATE_ADMIN_EMAIL} / ${STATE_ADMIN_PASSWORD}
  - Principals: principal@gp[city].edu.in / ${DEFAULT_PASSWORD}
  - Teachers: teacher.[branch].1@gp[city].edu.in / ${DEFAULT_PASSWORD}
  - Students: [rollNo]@student.com / ${DEFAULT_PASSWORD}
  - Industry: [email from list] / ${DEFAULT_PASSWORD}
  `);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
