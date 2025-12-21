import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ============================================
// HELPER FUNCTIONS & DATA ARRAYS
// ============================================

const PASSWORD = 'password@1234';

const PUNJAB_CITIES = [
  { 
    city: 'Ludhiana', 
    district: 'Ludhiana', 
    pinCode: '141001',
    tehsil: 'Ludhiana',
    address: 'GT Road, Near Clock Tower',
    phone: '+91-161-2401234',
    alternatePhone: '+91-161-2401235',
    website: 'www.gpludhiana.edu.in'
  },
  { 
    city: 'Amritsar', 
    district: 'Amritsar', 
    pinCode: '143001',
    tehsil: 'Amritsar',
    address: 'GT Road, Near Golden Temple',
    phone: '+91-183-2220123',
    alternatePhone: '+91-183-2220124',
    website: 'www.gpamritsar.edu.in'
  },
  { 
    city: 'Jalandhar', 
    district: 'Jalandhar', 
    pinCode: '144001',
    tehsil: 'Jalandhar',
    address: 'Model Town Road, Near Bus Stand',
    phone: '+91-181-2220234',
    alternatePhone: '+91-181-2220235',
    website: 'www.gpjalandhar.edu.in'
  },
  { 
    city: 'Patiala', 
    district: 'Patiala', 
    pinCode: '147001',
    tehsil: 'Patiala',
    address: 'Near Baradari Gardens, Mall Road',
    phone: '+91-175-2300345',
    alternatePhone: '+91-175-2300346',
    website: 'www.gppatiala.edu.in'
  },
  { 
    city: 'Bathinda', 
    district: 'Bathinda', 
    pinCode: '151001',
    tehsil: 'Bathinda',
    address: 'Thermal Plant Road, Model Town',
    phone: '+91-164-2500456',
    alternatePhone: '+91-164-2500457',
    website: 'www.gpbathinda.edu.in'
  },
  { 
    city: 'Mohali', 
    district: 'Mohali', 
    pinCode: '160055',
    tehsil: 'Kharar',
    address: 'Sector 70, IT Park Road',
    phone: '+91-172-2200567',
    alternatePhone: '+91-172-2200568',
    website: 'www.gpmohali.edu.in'
  },
  { 
    city: 'Hoshiarpur', 
    district: 'Hoshiarpur', 
    pinCode: '146001',
    tehsil: 'Hoshiarpur',
    address: 'College Road, Near Circuit House',
    phone: '+91-188-2220678',
    alternatePhone: '+91-188-2220679',
    website: 'www.gphoshiarpur.edu.in'
  },
  { 
    city: 'Pathankot', 
    district: 'Pathankot', 
    pinCode: '145001',
    tehsil: 'Pathankot',
    address: 'Dhangu Road, Cantonment Area',
    phone: '+91-186-2220789',
    alternatePhone: '+91-186-2220790',
    website: 'www.gppathankot.edu.in'
  },
  { 
    city: 'Moga', 
    district: 'Moga', 
    pinCode: '142001',
    tehsil: 'Moga',
    address: 'GT Road, Near Bus Stand',
    phone: '+91-1636-220891',
    alternatePhone: '+91-1636-220892',
    website: 'www.gpmoga.edu.in'
  },
  { 
    city: 'Ferozepur', 
    district: 'Ferozepur', 
    pinCode: '152002',
    tehsil: 'Ferozepur',
    address: 'Hussainiwala Road',
    phone: '+91-1632-220901',
    alternatePhone: '+91-1632-220902',
    website: 'www.gpferozepur.edu.in'
  },
  { 
    city: 'Gurdaspur', 
    district: 'Gurdaspur', 
    pinCode: '143521',
    tehsil: 'Gurdaspur',
    address: 'Railway Road, Near Civil Lines',
    phone: '+91-1874-220101',
    alternatePhone: '+91-1874-220102',
    website: 'www.gpgurdaspur.edu.in'
  },
  { 
    city: 'Kapurthala', 
    district: 'Kapurthala', 
    pinCode: '144601',
    tehsil: 'Kapurthala',
    address: 'Jalandhar Road, Near Moorish Mosque',
    phone: '+91-1822-220201',
    alternatePhone: '+91-1822-220202',
    website: 'www.gpkapurthala.edu.in'
  },
  { 
    city: 'Sangrur', 
    district: 'Sangrur', 
    pinCode: '148001',
    tehsil: 'Sangrur',
    address: 'Patiala Road, Near Grain Market',
    phone: '+91-1672-220301',
    alternatePhone: '+91-1672-220302',
    website: 'www.gpsangrur.edu.in'
  },
  { 
    city: 'Barnala', 
    district: 'Barnala', 
    pinCode: '148101',
    tehsil: 'Barnala',
    address: 'Bathinda Road, Near City Center',
    phone: '+91-1679-220401',
    alternatePhone: '+91-1679-220402',
    website: 'www.gpbarnala.edu.in'
  },
  { 
    city: 'Mansa', 
    district: 'Mansa', 
    pinCode: '151505',
    tehsil: 'Mansa',
    address: 'Budhlada Road, Near Civil Hospital',
    phone: '+91-1652-220501',
    alternatePhone: '+91-1652-220502',
    website: 'www.gpmansa.edu.in'
  },
  { 
    city: 'Muktsar', 
    district: 'Muktsar', 
    pinCode: '152026',
    tehsil: 'Muktsar',
    address: 'Kotkapura Road, Near Stadium',
    phone: '+91-1633-220601',
    alternatePhone: '+91-1633-220602',
    website: 'www.gpmuktsar.edu.in'
  },
  { 
    city: 'Faridkot', 
    district: 'Faridkot', 
    pinCode: '151203',
    tehsil: 'Faridkot',
    address: 'Ferozepur Road, Near Maharaja Palace',
    phone: '+91-1639-220701',
    alternatePhone: '+91-1639-220702',
    website: 'www.gpfaridkot.edu.in'
  },
  { 
    city: 'Fazilka', 
    district: 'Fazilka', 
    pinCode: '152123',
    tehsil: 'Fazilka',
    address: 'Abohar Road, Near Border Area',
    phone: '+91-1638-220801',
    alternatePhone: '+91-1638-220802',
    website: 'www.gpfazilka.edu.in'
  },
  { 
    city: 'Nawanshahr', 
    district: 'Nawanshahr', 
    pinCode: '144514',
    tehsil: 'Nawanshahr',
    address: 'Banga Road, Near Court Complex',
    phone: '+91-1823-220901',
    alternatePhone: '+91-1823-220902',
    website: 'www.gpnawanshahr.edu.in'
  },
  { 
    city: 'Rupnagar', 
    district: 'Rupnagar', 
    pinCode: '140001',
    tehsil: 'Rupnagar',
    address: 'Chandigarh Road, Near Bhakra Dam',
    phone: '+91-1881-221001',
    alternatePhone: '+91-1881-221002',
    website: 'www.gprupnagar.edu.in'
  },
  { 
    city: 'Fatehgarh Sahib', 
    district: 'Fatehgarh Sahib', 
    pinCode: '140406',
    tehsil: 'Fatehgarh Sahib',
    address: 'Sirhind Road, Near Gurudwara',
    phone: '+91-1763-221101',
    alternatePhone: '+91-1763-221102',
    website: 'www.gpfatehgarhsahib.edu.in'
  },
  { 
    city: 'Tarn Taran', 
    district: 'Tarn Taran', 
    pinCode: '143401',
    tehsil: 'Tarn Taran',
    address: 'Amritsar Road, Near Golden Temple',
    phone: '+91-1852-221201',
    alternatePhone: '+91-1852-221202',
    website: 'www.gptarntaran.edu.in'
  },
  { 
    city: 'Khanna', 
    district: 'Ludhiana', 
    pinCode: '141401',
    tehsil: 'Khanna',
    address: 'GT Road, Grain Market Area',
    phone: '+91-1628-221301',
    alternatePhone: '+91-1628-221302',
    website: 'www.gpkhanna.edu.in'
  },
  { 
    city: 'Phagwara', 
    district: 'Kapurthala', 
    pinCode: '144401',
    tehsil: 'Phagwara',
    address: 'Jalandhar-Hoshiarpur Road',
    phone: '+91-1824-221401',
    alternatePhone: '+91-1824-221402',
    website: 'www.gpphagwara.edu.in'
  },
  { 
    city: 'Batala', 
    district: 'Gurdaspur', 
    pinCode: '143505',
    tehsil: 'Batala',
    address: 'Amritsar Road, Near Clock Tower',
    phone: '+91-1871-221501',
    alternatePhone: '+91-1871-221502',
    website: 'www.gpbatala.edu.in'
  },
  { 
    city: 'Abohar', 
    district: 'Fazilka', 
    pinCode: '152116',
    tehsil: 'Abohar',
    address: 'Sriganganagar Road, Near Fruit Market',
    phone: '+91-1634-221601',
    alternatePhone: '+91-1634-221602',
    website: 'www.gpabohar.edu.in'
  },
];

const ALL_BRANCHES = [
  { name: 'Computer Science & Engineering', shortName: 'CSE', code: 'CSE', duration: 3 },
  { name: 'Information Technology', shortName: 'IT', code: 'IT', duration: 3 },
  { name: 'Electronics & Communication Engineering', shortName: 'ECE', code: 'ECE', duration: 3 },
  { name: 'Mechanical Engineering', shortName: 'ME', code: 'ME', duration: 3 },
  { name: 'Civil Engineering', shortName: 'CE', code: 'CE', duration: 3 },
  { name: 'Electrical Engineering', shortName: 'EE', code: 'EE', duration: 3 },
];

const COMPANIES = [
  {
    name: 'TCS Ludhiana',
    address: 'IT Park, Focal Point, Ludhiana',
    city: 'Ludhiana',
    state: 'Punjab',
    pinCode: '141010',
    hrName: 'Rajesh Kumar',
    hrContact: '+91-9876543210',
    hrEmail: 'rajesh.kumar@tcs.com',
    fieldOfWork: 'Software Development & IT Services',
    jobProfile: 'Software Developer Trainee',
    stipend: '15000',
    duration: '16 weeks',
    supervisorName: 'Manish Verma',
    supervisorDesignation: 'Senior Project Manager',
  },
  {
    name: 'Infosys Mohali',
    address: 'Phase 8B, Industrial Area, Mohali',
    city: 'Mohali',
    state: 'Punjab',
    pinCode: '160071',
    hrName: 'Priya Sharma',
    hrContact: '+91-9876543211',
    hrEmail: 'priya.sharma@infosys.com',
    fieldOfWork: 'Enterprise Solutions & Cloud Computing',
    jobProfile: 'Systems Engineer Intern',
    stipend: '18000',
    duration: '16 weeks',
    supervisorName: 'Arvind Kumar',
    supervisorDesignation: 'Technical Lead',
  },
  {
    name: 'Wipro Technologies Chandigarh',
    address: 'Rajiv Gandhi Chandigarh Technology Park',
    city: 'Chandigarh',
    state: 'Punjab',
    pinCode: '160101',
    hrName: 'Amit Singh',
    hrContact: '+91-9876543212',
    hrEmail: 'amit.singh@wipro.com',
    fieldOfWork: 'Digital Transformation & Analytics',
    jobProfile: 'Project Engineer Trainee',
    stipend: '16000',
    duration: '16 weeks',
    supervisorName: 'Deepika Rao',
    supervisorDesignation: 'Module Lead',
  },
  {
    name: 'Tech Mahindra Jalandhar',
    address: 'IT City, BMC Chowk, Jalandhar',
    city: 'Jalandhar',
    state: 'Punjab',
    pinCode: '144004',
    hrName: 'Neha Verma',
    hrContact: '+91-9876543213',
    hrEmail: 'neha.verma@techmahindra.com',
    fieldOfWork: 'Telecommunications & Network Solutions',
    jobProfile: 'Network Engineer Intern',
    stipend: '14000',
    duration: '16 weeks',
    supervisorName: 'Sanjay Malhotra',
    supervisorDesignation: 'Senior Engineer',
  },
  {
    name: 'HCL Technologies Amritsar',
    address: 'Software Technology Park, Amritsar',
    city: 'Amritsar',
    state: 'Punjab',
    pinCode: '143005',
    hrName: 'Suresh Gupta',
    hrContact: '+91-9876543214',
    hrEmail: 'suresh.gupta@hcl.com',
    fieldOfWork: 'Application Development & Maintenance',
    jobProfile: 'Software Engineering Intern',
    stipend: '17000',
    duration: '16 weeks',
    supervisorName: 'Ritu Bhardwaj',
    supervisorDesignation: 'Delivery Manager',
  },
  {
    name: 'L&T Infotech Patiala',
    address: 'Industrial Area, Phase 1, Patiala',
    city: 'Patiala',
    state: 'Punjab',
    pinCode: '147003',
    hrName: 'Kavita Rani',
    hrContact: '+91-9876543215',
    hrEmail: 'kavita.rani@lntinfotech.com',
    fieldOfWork: 'Infrastructure Management Services',
    jobProfile: 'Infrastructure Support Intern',
    stipend: '13000',
    duration: '16 weeks',
    supervisorName: 'Vikram Bedi',
    supervisorDesignation: 'Operations Manager',
  },
  {
    name: 'Capgemini Bathinda',
    address: 'Tech Hub, VPO Bathinda',
    city: 'Bathinda',
    state: 'Punjab',
    pinCode: '151005',
    hrName: 'Manjeet Kaur',
    hrContact: '+91-9876543216',
    hrEmail: 'manjeet.kaur@capgemini.com',
    fieldOfWork: 'Business Process Management',
    jobProfile: 'Business Analyst Trainee',
    stipend: '15500',
    duration: '16 weeks',
    supervisorName: 'Harinder Singh',
    supervisorDesignation: 'Team Lead',
  },
  {
    name: 'Accenture Ludhiana',
    address: 'Corporate Office, Model Town, Ludhiana',
    city: 'Ludhiana',
    state: 'Punjab',
    pinCode: '141002',
    hrName: 'Vikram Singh',
    hrContact: '+91-9876543217',
    hrEmail: 'vikram.singh@accenture.com',
    fieldOfWork: 'Consulting & Digital Strategy',
    jobProfile: 'Associate Software Engineer',
    stipend: '20000',
    duration: '16 weeks',
    supervisorName: 'Nisha Agarwal',
    supervisorDesignation: 'Senior Consultant',
  },
  {
    name: 'Cognizant Mohali',
    address: 'DLF IT Park, Mohali',
    city: 'Mohali',
    state: 'Punjab',
    pinCode: '160062',
    hrName: 'Simran Dhillon',
    hrContact: '+91-9876543218',
    hrEmail: 'simran.dhillon@cognizant.com',
    fieldOfWork: 'AI & Machine Learning Solutions',
    jobProfile: 'AI/ML Developer Intern',
    stipend: '19000',
    duration: '16 weeks',
    supervisorName: 'Rahul Khanna',
    supervisorDesignation: 'AI Practice Lead',
  },
  {
    name: 'IBM India Chandigarh',
    address: 'Elante IT Park, Chandigarh',
    city: 'Chandigarh',
    state: 'Punjab',
    pinCode: '160012',
    hrName: 'Harpreet Bhatia',
    hrContact: '+91-9876543219',
    hrEmail: 'harpreet.bhatia@ibm.com',
    fieldOfWork: 'Cloud & Cognitive Software',
    jobProfile: 'Cloud Solutions Trainee',
    stipend: '21000',
    duration: '16 weeks',
    supervisorName: 'Sunil Kapoor',
    supervisorDesignation: 'Solution Architect',
  },
  {
    name: 'Persistent Systems Jalandhar',
    address: 'Nehru Garden Road, Jalandhar',
    city: 'Jalandhar',
    state: 'Punjab',
    pinCode: '144001',
    hrName: 'Gurpreet Kaur',
    hrContact: '+91-9876543220',
    hrEmail: 'gurpreet.kaur@persistent.com',
    fieldOfWork: 'Product Engineering Services',
    jobProfile: 'Product Development Intern',
    stipend: '16500',
    duration: '16 weeks',
    supervisorName: 'Amit Chopra',
    supervisorDesignation: 'Product Manager',
  },
  {
    name: 'Mphasis Amritsar',
    address: 'Ranjit Avenue, Amritsar',
    city: 'Amritsar',
    state: 'Punjab',
    pinCode: '143001',
    hrName: 'Ramesh Chawla',
    hrContact: '+91-9876543221',
    hrEmail: 'ramesh.chawla@mphasis.com',
    fieldOfWork: 'Application Services & BPO',
    jobProfile: 'Application Developer Trainee',
    stipend: '14500',
    duration: '16 weeks',
    supervisorName: 'Preeti Bansal',
    supervisorDesignation: 'Development Lead',
  },
];

const MALE_FIRST_NAMES = [
  'Rajesh', 'Amit', 'Suresh', 'Vikram', 'Rahul', 'Ravi', 'Ajay', 'Sanjay', 'Manoj', 'Vijay',
  'Ashok', 'Deepak', 'Anil', 'Pankaj', 'Sandeep', 'Naveen', 'Gaurav', 'Rohit', 'Nitin', 'Mohit',
  'Arjun', 'Karan', 'Varun', 'Aakash', 'Yash', 'Vishal', 'Harsh', 'Shubham', 'Ankit', 'Pranav',
  'Gurpreet', 'Jaspreet', 'Harpreet', 'Simranjeet', 'Manpreet', 'Kuldeep', 'Ramandeep',
  'Balwinder', 'Sukhwinder', 'Jatinder', 'Surinder', 'Harmeet', 'Sarabjeet', 'Parminder',
];

const FEMALE_FIRST_NAMES = [
  'Priya', 'Neha', 'Kavita', 'Anjali', 'Simran', 'Pooja', 'Aarti', 'Preeti', 'Reena', 'Seema',
  'Sunita', 'Rekha', 'Geeta', 'Meena', 'Divya', 'Nisha', 'Shruti', 'Sneha', 'Ritu', 'Sonia',
  'Anita', 'Savita', 'Kiran', 'Poonam', 'Manju', 'Rani', 'Shilpa', 'Vandana', 'Madhuri', 'Rashmi',
  'Gurpreet', 'Jaspreet', 'Harpreet', 'Simranjit', 'Manpreet', 'Kulwinder', 'Ramandeep', 'Amarjeet',
  'Paramjit', 'Surjit', 'Navpreet', 'Amandeep', 'Kirandeep', 'Parminder', 'Mandeep',
];

const LAST_NAMES = [
  'Kumar', 'Singh', 'Sharma', 'Verma', 'Gupta', 'Kaur', 'Patel', 'Rani', 'Mehta', 'Chopra',
  'Malhotra', 'Arora', 'Bhatia', 'Sethi', 'Dhillon', 'Sandhu', 'Gill', 'Sidhu', 'Bajwa', 'Grewal',
  'Khanna', 'Kapoor', 'Bedi', 'Chawla', 'Bansal', 'Mittal', 'Agarwal', 'Jain', 'Sood', 'Thakur',
];

function randomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function randomNumber(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateEmail(name: string, institutionCode: string): string {
  return `${name.toLowerCase().replace(/\s+/g, '.')}@${institutionCode.toLowerCase()}.edu.in`;
}

function generateStudentEmail(rollNumber: string): string {
  return `${rollNumber.toLowerCase()}@student.edu.in`;
}

function generatePhoneNumber(): string {
  return `+91-${randomNumber(70, 99)}${randomNumber(10000000, 99999999)}`;
}

function generateRollNumber(year: string, branchCode: string, sequence: number): string {
  return `${year}${branchCode}${sequence.toString().padStart(3, '0')}`;
}

function generateAdmissionNumber(instCode: string, year: string, sequence: number): string {
  return `${instCode}/${year}/${sequence.toString().padStart(4, '0')}`;
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function generateDOB(): string {
  const year = randomNumber(2003, 2005);
  const month = randomNumber(1, 12);
  const day = randomNumber(1, 28);
  return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
}

// ============================================
// MAIN SEED FUNCTION
// ============================================

async function main() {
  console.log('🌱 Starting seed...\n');

  // Safety check - prevent running in production
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ ERROR: Cannot run seed in production environment!');
    process.exit(1);
  }

  // Confirmation prompt for development
  console.log('⚠️  WARNING: This will DELETE ALL existing data!');
  console.log('📍 Environment:', process.env.NODE_ENV || 'development');
  console.log('💾 Database:', process.env.DATABASE_URL ? 'Connected' : 'Not configured');
  console.log('\n');

  // Clear existing data
  console.log('🗑️  Cleaning existing data...');
  
  // Delete in correct order to avoid foreign key violations
  await prisma.technicalQuery.deleteMany({});
  await prisma.grievance.deleteMany({});
  await prisma.completionFeedback.deleteMany({});
  await prisma.monthlyFeedback.deleteMany({});
  await prisma.monthlyReport.deleteMany({});
  await prisma.facultyVisitLog.deleteMany({});
  await prisma.mentorAssignment.deleteMany({});
  await prisma.internshipApplication.deleteMany({});
  await prisma.referralApplication.deleteMany({});
  await prisma.internship.deleteMany({});
  await prisma.examResult.deleteMany({});
  await prisma.fee.deleteMany({});
  await prisma.scholarship.deleteMany({});
  await prisma.placement.deleteMany({});
  await prisma.classAssignment.deleteMany({});
  await prisma.document.deleteMany({});
  await prisma.notification.deleteMany({});
  await prisma.auditLog.deleteMany({});
  await prisma.industryRequest.deleteMany({});
  await prisma.industry.deleteMany({});
  await prisma.notice.deleteMany({});
  await prisma.calendar.deleteMany({});
  await prisma.feeStructure.deleteMany({});
  await prisma.subject.deleteMany({});
  await prisma.student.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.branch.deleteMany({});
  await prisma.batch.deleteMany({});
  await prisma.semester.deleteMany({});
  await prisma.institution.deleteMany({});
  
  console.log('✅ Cleaned all existing data\n');

  // Declare counters for tracking created records
  let totalVisits = 0;
  let totalReports = 0;

  // ============================================
  // 1. CREATE 26 INSTITUTIONS
  // ============================================
  console.log('🏛️  Creating 26 Institutions...');
  const institutions: any[] = [];
  for (let i = 0; i < 26; i++) {
    const cityData = PUNJAB_CITIES[i];
    const institution = await prisma.institution.create({
      data: {
        code: `INST${(i + 1).toString().padStart(3, '0')}`,
        name: `Government Polytechnic ${cityData.city}`,
        shortName: `GP ${cityData.city}`,
        type: 'POLYTECHNIC',
        address: cityData.address,
        city: cityData.city,
        state: 'Punjab',
        pinCode: cityData.pinCode,
        country: 'India',
        contactEmail: `contact@gp${cityData.city.toLowerCase().replace(/\s+/g, '')}.edu.in`,
        contactPhone: cityData.phone,
        alternatePhone: cityData.alternatePhone,
        website: cityData.website,
        establishedYear: randomNumber(1985, 2010),
        affiliatedTo: 'Punjab State Board of Technical Education and Industrial Training (PSBTE&IT)',
        recognizedBy: 'All India Council for Technical Education (AICTE)',
        naacGrade: randomElement(['A', 'A+', 'B++', 'A++', 'B+']),
        autonomousStatus: false,
        totalStudentSeats: 300,
        totalStaffSeats: 30,
        isActive: true,
      },
    });
    institutions.push(institution);
  }
  console.log(`✅ Created ${institutions.length} institutions\n`);

  // ============================================
  // 2. CREATE SEMESTERS (Semester 6 for each institution)
  // ============================================
  console.log('📚 Creating Semester 6 for each institution...');
  const semesters: any[] = [];
  for (const institution of institutions) {
    const semester = await prisma.semester.create({
      data: {
        number: 6,
        isActive: true,
        institutionId: institution.id,
      },
    });
    semesters.push(semester);
  }
  console.log(`✅ Created ${semesters.length} semester records\n`);

  // ============================================
  // 3. CREATE BATCH (One shared batch "2023-26")
  // ============================================
  console.log('🎓 Creating Batch 2023-26...');
  const batch = await prisma.batch.create({
    data: {
      name: '2023-26',
      isActive: true,
      institutionId: institutions[0].id,
    },
  });
  console.log(`✅ Created batch: ${batch.name}\n`);

  // ============================================
  // 4. CREATE BRANCHES (4-5 random branches per institution)
  // ============================================
  console.log('🌿 Creating Branches for each institution...');
  const institutionBranches: { [key: string]: any[] } = {};
  
  for (const institution of institutions) {
    const numBranches = randomNumber(4, 5);
    const selectedBranches = shuffleArray(ALL_BRANCHES).slice(0, numBranches);
    const branches: any[] = [];
    
    for (const branchData of selectedBranches) {
      const branch = await prisma.branch.create({
        data: {
          name: branchData.name,
          shortName: branchData.shortName,
          code: `${institution.code}-${branchData.code}`,
          duration: 3,
          isActive: true,
          institutionId: institution.id,
        },
      });
      branches.push(branch);
    }
    institutionBranches[institution.id] = branches;
    console.log(`  ✓ Created ${branches.length} branches for ${institution.name}`);
  }
  console.log(`✅ Created branches for all institutions\n`);

  // ============================================
  // 5. CREATE FACULTY (1 Principal + 8-10 Teachers per institution)
  // ============================================
  console.log('👨‍🏫 Creating Faculty for each institution...');
  const institutionFaculty: { [key: string]: { principal: any; teachers: any[] } } = {};
  
  for (const institution of institutions) {
    const numTeachers = randomNumber(8, 10);
    
    // Create Principal
    const principalName = `Dr. ${randomElement(MALE_FIRST_NAMES)} ${randomElement(LAST_NAMES)}`;
    const principal = await prisma.user.create({
      data: {
        email: generateEmail(principalName, institution.code),
        password: PASSWORD,
        name: principalName,
        role: 'PRINCIPAL',
        active: true,
        institutionId: institution.id,
      },
    });
    
    // Create Teachers
    const teachers: any[] = [];
    for (let i = 0; i < numTeachers; i++) {
      const gender = Math.random() < 0.7 ? 'Male' : 'Female';
      const firstName = gender === 'Male' 
        ? randomElement(MALE_FIRST_NAMES) 
        : randomElement(FEMALE_FIRST_NAMES);
      const lastName = randomElement(LAST_NAMES);
      const teacherName = `${firstName} ${lastName}`;
      
      const teacher = await prisma.user.create({
        data: {
          email: generateEmail(teacherName, institution.code),
          password: PASSWORD,
          name: teacherName,
          role: 'TEACHER',
          active: true,
          institutionId: institution.id,
        },
      });
      teachers.push(teacher);
    }
    
    institutionFaculty[institution.id] = { principal, teachers };
    console.log(`  ✓ Created 1 Principal + ${teachers.length} Teachers for ${institution.name}`);
  }
  console.log(`✅ Created faculty for all institutions\n`);

  // ============================================
  // 6. CREATE STUDENTS (~2000 total across all institutions)
  // ============================================
  console.log('👨‍🎓 Creating ~2000 Students across all institutions...');
  const allStudents: any[] = [];
  let totalStudentCount = 0;
  const TOTAL_STUDENTS = 2000;
  const studentsPerInstitution = Math.floor(TOTAL_STUDENTS / institutions.length); // ~77 per institution
  const remainderStudents = TOTAL_STUDENTS % institutions.length;
  
  for (let instIndex = 0; instIndex < institutions.length; instIndex++) {
    const institution = institutions[instIndex];
    const branches = institutionBranches[institution.id];
    const students: any[] = [];
    
    // Add extra student to first few institutions to reach exactly 2000
    const numStudentsForThisInst = instIndex < remainderStudents 
      ? studentsPerInstitution + 1 
      : studentsPerInstitution;
    
    for (let i = 0; i < numStudentsForThisInst; i++) {
      const gender = Math.random() < 0.65 ? 'Male' : 'Female';
      const firstName = gender === 'Male' 
        ? randomElement(MALE_FIRST_NAMES) 
        : randomElement(FEMALE_FIRST_NAMES);
      const lastName = randomElement(LAST_NAMES);
      const studentName = `${firstName} ${lastName}`;
      
      const branch = randomElement(branches);
      const admissionType = Math.random() < 0.7 ? 'FIRST_YEAR' : 'LEET';
      const categories: ('GENERAL' | 'OBC' | 'SC' | 'ST')[] = ['GENERAL', 'GENERAL', 'OBC', 'SC', 'ST'];
      const category = randomElement(categories);
      
      const rollNumber = generateRollNumber('2023', branch.shortName, totalStudentCount + 1);
      const admissionNumber = generateAdmissionNumber(institution.code, '2023', i + 1);
      
      // Create User first
      const user = await prisma.user.create({
        data: {
          email: generateStudentEmail(rollNumber),
          password: PASSWORD,
          name: studentName,
          role: 'STUDENT',
          active: true,
          institutionId: institution.id,
        },
      });
      
      // Create Student
      const student = await prisma.student.create({
        data: {
          userId: user.id,
          rollNumber,
          admissionNumber,
          name: studentName,
          email: user.email,
          contact: generatePhoneNumber(),
          address: `House ${randomNumber(1, 999)}, Street ${randomNumber(1, 50)}`,
          pinCode: randomElement(PUNJAB_CITIES).pinCode,
          tehsil: randomElement(['Tehsil A', 'Tehsil B', 'Tehsil C']),
          district: institution.city,
          city: institution.city,
          state: 'Punjab',
          dob: generateDOB(),
          parentName: `${randomElement(MALE_FIRST_NAMES)} ${lastName}`,
          parentContact: generatePhoneNumber(),
          motherName: `${randomElement(FEMALE_FIRST_NAMES)} ${lastName}`,
          gender,
          currentYear: 3,
          currentSemester: 6,
          currentSemesterMarks: randomNumber(60, 90),
          tenthper: randomNumber(60, 95),
          twelthper: admissionType === 'FIRST_YEAR' ? randomNumber(60, 95) : null,
          diplomaPercentage: admissionType === 'LEET' ? randomNumber(65, 90) : null,
          totalBacklogs: randomNumber(0, 3),
          clearanceStatus: 'CLEARED',
          isActive: true,
          branchId: branch.id,
          branchName: branch.name,
          batchId: batch.id,
          admissionType,
          category,
          institutionId: institution.id,
          profileImage: `https://api.dicebear.com/7.x/avataaars/svg?seed=${rollNumber}`,
        },
      });
      
      students.push({ student, user, branch });
      totalStudentCount++;
    }
    
    allStudents.push(...students);
    console.log(`  ✓ Created ${numStudentsForThisInst} students for ${institution.name} (Total: ${totalStudentCount})`);
  }
  console.log(`✅ Created ${totalStudentCount} students total\n`);

  // ============================================
  // 7. CREATE INTERNSHIP APPLICATIONS (Starting November 2025)
  // ============================================
  console.log('💼 Creating Self-Identified Internship Applications (Starting Nov 2025)...');
  const internshipApplications: any[] = [];
  
  for (const { student, user, branch } of allStudents) {
    const company = randomElement(COMPANIES);
    // Internships start from November 2025
    const joiningDate = new Date(2025, 10, randomNumber(1, 15)); // November 2025
    const endDate = new Date(2026, 3, randomNumber(15, 30)); // April 2026 (6 months)
    
    const application = await prisma.internshipApplication.create({
      data: {
        studentId: student.id,
        internshipId: null,
        isSelfIdentified: true,
        status: 'APPROVED',
        hasJoined: true,
        joiningDate,
        startDate: joiningDate,
        endDate,
        internshipDuration: '24 weeks',
        companyName: company.name,
        companyAddress: company.address,
        hrName: company.hrName,
        hrContact: company.hrContact,
        hrEmail: company.hrEmail,
        internshipStatus: 'SELF_IDENTIFIED',
        jobProfile: randomElement([
          'Software Developer Intern',
          'Web Development Intern',
          'Data Analyst Intern',
          'Network Engineer Intern',
          'Quality Assurance Intern',
          'System Administrator Intern',
        ]),
        stipend: randomElement(['₹8,000/month', '₹10,000/month', '₹12,000/month', '₹15,000/month']),
        joiningLetterUrl: `https://storage.example.com/documents/joining-letters/${student.rollNumber}.pdf`,
        joiningLetterUploadedAt: new Date(2025, 9, randomNumber(25, 30)), // Late October 2025
        facultyMentorName: null,
        facultyMentorContact: null,
        facultyMentorEmail: null,
        facultyMentorDesignation: 'Assistant Professor',
        coverLetter: `I am interested in joining ${company.name} as an intern to enhance my practical skills.`,
        additionalInfo: 'Self-identified internship opportunity',
        appliedDate: new Date(2025, 9, randomNumber(1, 20)), // October 2025
        reviewedDate: new Date(2025, 9, randomNumber(21, 31)),
        notes: 'Approved by institution for self-identified internship',
      },
    });
    
    internshipApplications.push({
      application,
      student,
      user,
      branch,
    });
  }
  console.log(`✅ Created ${internshipApplications.length} internship applications\n`);

  // ============================================
  // 8. CREATE MENTOR ASSIGNMENTS
  // ============================================
  console.log('👥 Creating Mentor Assignments...');
  const mentorAssignments: any[] = [];
  
  for (const { application, student, user, branch } of internshipApplications) {
    const institution = institutions.find((i: any) => i.id === student.institutionId);
    const faculty = institutionFaculty[institution.id];
    
    const branchTeachers = faculty.teachers.filter(() => Math.random() < 0.5);
    const mentor = branchTeachers.length > 0 
      ? randomElement(branchTeachers) 
      : randomElement(faculty.teachers);
    
    const mentorAssignment = await prisma.mentorAssignment.create({
      data: {
        studentId: student.id,
        mentorId: mentor.id,
        assignedBy: faculty.principal.id,
        assignmentDate: new Date(2025, 10, randomNumber(1, 5)), // Early November 2025
        assignmentReason: 'Assigned for internship mentoring and supervision',
        isActive: true,
        academicYear: '2025-26',
        semester: '6',
        specialInstructions: 'Conduct regular visits and monitor student progress',
      },
    });
    
    // Update application with faculty mentor details
    await prisma.internshipApplication.update({
      where: { id: application.id },
      data: {
        mentorId: mentor.id,
        mentorAssignedAt: mentorAssignment.assignmentDate,
        mentorAssignedBy: faculty.principal.id,
        facultyMentorName: mentor.name,
        facultyMentorContact: generatePhoneNumber(),
        facultyMentorEmail: mentor.email,
      },
    });
    
    mentorAssignments.push({
      mentorAssignment,
      application,
      student,
      mentor,
    });
  }
  console.log(`✅ Created ${mentorAssignments.length} mentor assignments\n`);

  // ============================================
  // 9. CREATE FACULTY VISIT LOGS (Nov 2025 - Dec 2025)
  // ============================================
  console.log('🚗 Creating Faculty Visit Logs (Nov-Dec 2025)...');
  const visitTypes: ('PHYSICAL' | 'VIRTUAL' | 'TELEPHONIC')[] = ['PHYSICAL', 'VIRTUAL', 'TELEPHONIC'];
  
  for (const { mentorAssignment, application, student, mentor } of mentorAssignments) {
    // Create 1-2 visits (November and December 2025)
    const numVisits = randomNumber(1, 2);
    
    for (let visitNum = 1; visitNum <= numVisits; visitNum++) {
      // Visit 1 in November, Visit 2 in December
      const visitMonth = visitNum === 1 ? 10 : 11; // 10 = November, 11 = December
      const visitDate = new Date(2025, visitMonth, randomNumber(15, 28));
      
      await prisma.facultyVisitLog.create({
        data: {
          applicationId: application.id,
          internshipId: null,
          facultyId: mentor.id,
          visitNumber: visitNum,
          visitDate,
          visitDuration: randomElement(['1 hour', '2 hours', '3 hours', '1.5 hours']),
          visitType: randomElement(visitTypes),
          studentPerformance: randomElement([
            'Excellent performance, showing great progress',
            'Good performance, meets expectations',
            'Satisfactory performance, needs improvement in some areas',
            'Outstanding performance, exceeds expectations',
          ]),
          workEnvironment: randomElement([
            'Professional and conducive to learning',
            'Well-equipped with modern facilities',
            'Supportive team environment',
            'Excellent infrastructure and resources',
          ]),
          industrySupport: randomElement([
            'Company provides excellent mentorship',
            'Good support from supervisors',
            'Regular guidance provided by industry mentor',
            'Strong support system in place',
          ]),
          skillsDevelopment: randomElement([
            'Student learning new technical skills',
            'Significant improvement in practical knowledge',
            'Good exposure to industry practices',
            'Developing both technical and soft skills',
          ]),
          attendanceStatus: randomElement(['Regular', 'Excellent', 'Good']),
          workQuality: randomElement(['Excellent', 'Very Good', 'Good']),
          studentProgressRating: randomNumber(3, 5),
          industryCooperationRating: randomNumber(3, 5),
          workEnvironmentRating: randomNumber(3, 5),
          mentoringSupportRating: randomNumber(3, 5),
          overallSatisfactionRating: randomNumber(3, 5),
          issuesIdentified: Math.random() < 0.2 ? 'Minor communication gaps' : 'No major issues',
          recommendations: 'Continue with current learning path',
          actionRequired: 'None',
          visitPhotos: [],
          attendeesList: [
            student.name,
            mentor.name,
            randomElement(['HR Manager', 'Project Lead', 'Team Lead', 'Industry Supervisor'])
          ],
          followUpRequired: Math.random() < 0.15,
        },
      });
      totalVisits++;
    }
  }
  console.log(`✅ Created ${totalVisits} faculty visit logs\n`);

  // ============================================
  // 10. CREATE MONTHLY REPORTS (November & December 2025)
  // ============================================
  console.log('📄 Creating Monthly Reports (Nov-Dec 2025)...');
  const monthNames = ['November', 'December'];
  
  for (const { application, student } of internshipApplications) {
    // Create reports for November and December 2025
    for (let monthIndex = 0; monthIndex < 2; monthIndex++) {
      const month = monthIndex === 0 ? 10 : 11; // 10 = November, 11 = December
      const isPending = month === 11 && Math.random() < 0.3; // 30% December reports pending
      
      await prisma.monthlyReport.create({
        data: {
          applicationId: application.id,
          studentId: student.id,
          reportMonth: month + 1, // 1-indexed month
          reportYear: 2025,
          monthName: monthNames[monthIndex],
          reportFileUrl: isPending 
            ? null 
            : `https://storage.example.com/reports/${student.rollNumber}/month-${monthNames[monthIndex]}-2025.pdf`,
          status: isPending ? 'DRAFT' : randomElement(['SUBMITTED', 'APPROVED']),
          submittedAt: isPending ? null : new Date(2025, month, randomNumber(25, 30)),
          isApproved: isPending ? false : Math.random() < 0.8,
          approvedAt: isPending ? null : new Date(2025, month + 1, randomNumber(1, 5)),
        },
      });
      totalReports++;
    }
  }
  console.log(`✅ Created ${totalReports} monthly reports\n`);

  // ============================================
  // SUMMARY
  // ============================================
  console.log('\n📊 SEEDING SUMMARY:');
  console.log('═══════════════════════════════════════');
  console.log('🏛️  Institutions: 26');
  console.log('📚 Semesters: 26 (Semester 6 each)');
  console.log('🎓 Batch: 1 (2023-26)');
  console.log('🌿 Branches: 4-5 per institution');
  console.log('👨‍🏫 Faculty: 1 Principal + 8-10 Teachers per institution');
  console.log(`👨‍🎓 Students: ${totalStudentCount} (~77 per institution)`);
  console.log(`💼 Internship Applications: ${internshipApplications.length}`);
  console.log(`👥 Mentor Assignments: ${mentorAssignments.length}`);
  console.log(`🚗 Faculty Visits: ${totalVisits}`);
  console.log(`📄 Monthly Reports: ${totalReports}`);
  console.log('═══════════════════════════════════════');
  console.log('\n🎉 Seeding completed successfully!\n');
  console.log('📅 Timeline: Internships started November 2025');
  console.log('📅 Current reports/visits: November & December 2025\n');
}

// ============================================
// EXECUTE SEED
// ============================================

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
