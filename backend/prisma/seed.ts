import { PrismaClient, Role, ClearanceStatus, AdmissionType, Category } from '@prisma/client';
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
  { name: 'TCS', email: 'hr@tcs.com', city: 'Mohali', type: 'IT Services' },
  { name: 'Infosys', email: 'careers@infosys.com', city: 'Chandigarh', type: 'IT Services' },
  { name: 'Maruti Suzuki', email: 'hr@maruti.co.in', city: 'Gurgaon', type: 'Automobile' },
  { name: 'L&T Constructions', email: 'jobs@lnt.com', city: 'Delhi', type: 'Construction' },
  { name: 'Havells', email: 'hr@havells.com', city: 'Noida', type: 'Electronics' },
];

const GRIEVANCE_TYPES = ['ACADEMIC', 'HOSTEL', 'INFRASTRUCTURE', 'HARASSMENT', 'OTHER'];
const TECHNICAL_QUERY_TYPES = ['LOGIN_ISSUE', 'PROFILE_UPDATE', 'DOCUMENT_UPLOAD', 'OTHER'];

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
    await prisma.user.create({
      data: {
        email: `principal@gp${inst.city.toLowerCase()}.edu.in`,
        password: defaultHashedPassword,
        name: `Principal ${inst.city}`,
        role: 'PRINCIPAL',
        active: true,
        institutionId: inst.id,
        designation: 'Principal',
      },
    });

    // Placement Officer
    await prisma.user.create({
      data: {
        email: `tpo@gp${inst.city.toLowerCase()}.edu.in`,
        password: defaultHashedPassword,
        name: `TPO ${inst.city}`,
        role: 'PLACEMENT_OFFICER',
        active: true,
        institutionId: inst.id,
        designation: 'Training & Placement Officer',
      },
    });

    // Accountant
    await prisma.user.create({
      data: {
        email: `accountant@gp${inst.city.toLowerCase()}.edu.in`,
        password: defaultHashedPassword,
        name: `Accountant ${inst.city}`,
        role: 'ACCOUNTANT',
        active: true,
        institutionId: inst.id,
        designation: 'Accountant',
      },
    });

    // Admission Officer
    await prisma.user.create({
      data: {
        email: `admission@gp${inst.city.toLowerCase()}.edu.in`,
        password: defaultHashedPassword,
        name: `Admission Officer ${inst.city}`,
        role: 'ADMISSION_OFFICER',
        active: true,
        institutionId: inst.id,
        designation: 'Admission Incharge',
      },
    });

    // Examination Officer
    await prisma.user.create({
      data: {
        email: `exam@gp${inst.city.toLowerCase()}.edu.in`,
        password: defaultHashedPassword,
        name: `Exam Officer ${inst.city}`,
        role: 'EXAMINATION_OFFICER',
        active: true,
        institutionId: inst.id,
        designation: 'Exam Superintendent',
      },
    });

    // Teachers (2 per branch)
    for (const branch of branchMap[inst.id]) {
      for (let k = 0; k < 2; k++) {
        const teacher = await prisma.user.create({
          data: {
            email: `teacher.${branch.shortName.toLowerCase()}.${k+1}@gp${inst.city.toLowerCase()}.edu.in`,
            password: defaultHashedPassword,
            name: `Prof. ${branch.shortName} ${k+1}`,
            role: 'TEACHER',
            active: true,
            institutionId: inst.id,
            designation: 'Lecturer',
          },
        });
        facultyMap[inst.id].push(teacher);
      }
    }
  }
  console.log('✅ Staff created.\n');

  // 7. INDUSTRIES & POSTED INTERNSHIPS
  console.log('🏭 Creating Industries & Internships...');
  const createdInternships: any[] = [];
  
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

    // Post 2 Internships per Industry
    for (let k = 0; k < 2; k++) {
      const internship = await prisma.internship.create({
        data: {
          industryId: industry.id,
          title: `${indData.type} Intern`,
          description: `Exciting opportunity at ${indData.name}`,
          fieldOfWork: indData.type,
          numberOfPositions: randomNumber(2, 5),
          duration: '6 Months',
          workLocation: indData.city,
          applicationDeadline: new Date(new Date().setDate(new Date().getDate() + 30)),
          isStipendProvided: true,
          stipendAmount: randomNumber(5000, 15000),
          eligibleBranches: ['CSE', 'IT', 'ECE'],
          eligibleSemesters: ['5', '6'],
          requiredSkills: ['Communication', 'Technical Basics'],
          preferredSkills: [],
          status: 'ACTIVE',
        },
      });
      createdInternships.push(internship);
    }
  }
  console.log('✅ Industries & Internships created.\n');

  // 8. STUDENTS & ACADEMIC DATA
  console.log('🎓 Creating Students & Academic Data...');
  const allStudents: any[] = [];

  for (const inst of institutions) {
    const branches = branchMap[inst.id];
    // Create ~10 students per branch
    for (const branch of branches) {
      for (let k = 0; k < 10; k++) {
        const rollNo = `${new Date().getFullYear()}${branch.shortName}${inst.code.substring(4)}${k.toString().padStart(3, '0')}`;
        
        // User
        const user = await prisma.user.create({
          data: {
            email: `${rollNo.toLowerCase()}@student.com`,
            password: defaultHashedPassword,
            name: `Student ${rollNo}`,
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
            name: user.name,
            email: user.email,
            contact: generatePhoneNumber(),
            gender: Math.random() > 0.5 ? 'Male' : 'Female',
            dob: '2003-01-01',
            address: 'Sample Address',
            city: inst.city,
            state: 'Punjab',
            institutionId: inst.id,
            branchId: branch.id,
            branchName: branch.name,
            batchId: batch.id,
            currentSemester: 6,
            admissionType: AdmissionType.FIRST_YEAR,
            category: Category.GENERAL,
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

  // 9. INTERNSHIP APPLICATIONS & MENTORSHIP
  console.log('📝 Creating Applications & Mentorships...');
  
  for (const { student, inst } of allStudents) {
    const rand = Math.random();
    
    // 40% Self-Identified
    if (rand < 0.4) {
      const app = await prisma.internshipApplication.create({
        data: {
          studentId: student.id,
          isSelfIdentified: true,
          companyName: 'Local Tech Solutions',
          companyAddress: 'Local Market',
          hrName: 'Mr. Local',
          hrContact: generatePhoneNumber(),
          hrEmail: 'hr@local.com',
          status: 'APPROVED',
          internshipStatus: 'ONGOING',
          startDate: new Date(),
          endDate: new Date(new Date().setMonth(new Date().getMonth() + 6)),
        },
      });

      // Assign Mentor
      const teachers = facultyMap[inst.id];
      if (teachers && teachers.length > 0) {
        const mentor = randomElement(teachers);
        await prisma.mentorAssignment.create({
          data: {
            studentId: student.id,
            mentorId: mentor.id,
            assignedBy: teachers[0].id, // Principal or first teacher
            assignmentDate: new Date(),
            isActive: true,
            academicYear: '2025-26',
            semester: '6',
          },
        });

        // Visit Log
        await prisma.facultyVisitLog.create({
          data: {
            applicationId: app.id,
            facultyId: mentor.id,
            visitDate: new Date(),
            visitType: 'PHYSICAL',
            studentPerformance: 'Good',
            visitDuration: '1 Hour',
          },
        });
      }
    } 
    // 30% Applied to Posted Internships
    else if (rand < 0.7 && createdInternships.length > 0) {
      const internship = randomElement(createdInternships);
      await prisma.internshipApplication.create({
        data: {
          studentId: student.id,
          internshipId: internship.id,
          isSelfIdentified: false,
          status: 'APPLIED',
          internshipStatus: 'APPLIED',
        },
      });
    }
    // 30% No Internship yet
  }
  console.log('✅ Applications created.\n');

  // 10. GRIEVANCES & QUERIES
  console.log('📫 Creating Grievances & Queries...');
  
  // Create some grievances
  for (let i = 0; i < 20; i++) {
    const { student } = randomElement(allStudents);
    await prisma.grievance.create({
      data: {
        studentId: student.id,
        title: 'Issue regarding ' + randomElement(['Hostel', 'Mess', 'Library', 'Wi-Fi']),
        description: 'Detailed description of the issue...',
        category: randomElement(['INTERNSHIP_RELATED', 'MENTOR_RELATED', 'WORK_ENVIRONMENT', 'OTHER']),
        status: 'PENDING',
        severity: 'MEDIUM',
      },
    });
  }

  // Create some technical queries
  for (let i = 0; i < 15; i++) {
    const { user } = randomElement(allStudents);
    await prisma.technicalQuery.create({
      data: {
        userId: user.id,
        title: 'Cannot access ' + randomElement(['Profile', 'Results', 'Fee Portal']),
        description: 'Error message 404...',
        status: 'OPEN',
        priority: 'HIGH',
      },
    });
  }
  console.log('✅ Grievances & Queries created.\n');

  // 11. NOTIFICATIONS
  console.log('🔔 Creating Notifications...');
  for (let i = 0; i < 50; i++) {
    const { user } = randomElement(allStudents);
    await prisma.notification.create({
      data: {
        userId: user.id,
        title: 'Important Notice',
        body: 'Please submit your documents by tomorrow.',
        type: 'INFO',
        read: false,
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
