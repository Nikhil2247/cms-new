/**
 * MongoDB Initialization Script
 * Creates application database and user with proper permissions
 * Runs automatically when MongoDB container starts for the first time
 */

// Switch to admin database first
db = db.getSiblingDB('admin');

// Authenticate as root user
db.auth(
  process.env.MONGO_ROOT_USER || 'admin',
  process.env.MONGO_ROOT_PASSWORD || 'Admin@1234'
);

// Switch to application database
const dbName = process.env.MONGO_DATABASE || 'cms_db';
db = db.getSiblingDB(dbName);

// Create application user with read/write permissions
// Password is read from environment variable for security
const appUser = process.env.MONGO_APP_USER || 'cmsuser';
const appPassword = process.env.MONGO_APP_PASSWORD || process.env.MONGO_ROOT_PASSWORD || 'changeme';

try {
  db.createUser({
    user: appUser,
    pwd: appPassword,
    roles: [
      { role: 'readWrite', db: dbName },
      { role: 'dbAdmin', db: dbName },
    ],
  });
  print('User "' + appUser + '" created successfully');
} catch (error) {
  if (error.codeName === 'DuplicateKey') {
    print('User "cmsuser" already exists, skipping creation');
  } else {
    print('Error creating user: ' + error.message);
  }
}

// Create indexes for better performance
print('Creating indexes...');

// Users collection
try {
  db.users.createIndex({ email: 1 }, { unique: true, sparse: true });
  db.users.createIndex({ rollNumber: 1 }, { sparse: true });
  db.users.createIndex({ role: 1 });
  db.users.createIndex({ institutionId: 1 });
  db.users.createIndex({ createdAt: -1 });
  db.users.createIndex({ active: 1 });
  print('Users indexes created');
} catch (e) {
  print('Users indexes may already exist: ' + e.message);
}

// Students collection
try {
  db.students.createIndex({ userId: 1 });
  db.students.createIndex({ rollNumber: 1 }, { unique: true, sparse: true });
  db.students.createIndex({ branchId: 1 });
  db.students.createIndex({ institutionId: 1 });
  print('Students indexes created');
} catch (e) {
  print('Students indexes may already exist: ' + e.message);
}

// Internships collection
try {
  db.internships.createIndex({ studentId: 1 });
  db.internships.createIndex({ status: 1 });
  db.internships.createIndex({ createdAt: -1 });
  print('Internships indexes created');
} catch (e) {
  print('Internships indexes may already exist: ' + e.message);
}

print('=================================');
print('MongoDB initialization completed!');
print('Database: ' + dbName);
print('User: ' + appUser + ' (readWrite, dbAdmin)');
print('=================================');
