const institutionName = "Government Polytechnic College, Amritsar";

async function deleteOrphanedUser() {
  const { MongoClient } = require("mongodb");
  const client = new MongoClient("mongodb://localhost:27017");
  
  try {
    await client.connect();
    const db = client.db("cms");
    
    // Get institution
    const institution = await db.collection("Institution").findOne({ name: institutionName });
    if (\!institution) {
      console.log("Institution not found");
      return;
    }
    
    // Get all STUDENT users in this institution
    const studentUsers = await db.collection("User").find({
      institutionId: institution._id,
      roles: "STUDENT"
    }).toArray();
    
    // Get all Student records in this institution
    const students = await db.collection("Student").find({
      institutionId: institution._id
    }).toArray();
    
    const studentUserIds = new Set(students.map(s => s.userId.toString()));
    
    // Find orphaned users
    const orphanedUsers = studentUsers.filter(u => \!studentUserIds.has(u._id.toString()));
    
    console.log("=== ORPHANED USER DETAILS ===");
    for (const user of orphanedUsers) {
      console.log("ID:", user._id.toString());
      console.log("Name:", user.name || "(no name)");
      console.log("Email:", user.email || "(no email)");
      console.log("Created:", user.createdAt);
      console.log("");
    }
    
    if (orphanedUsers.length > 0) {
      const ids = orphanedUsers.map(u => u._id);
      const result = await db.collection("User").deleteMany({ _id: { $in: ids } });
      console.log("DELETED:", result.deletedCount, "orphaned user(s)");
    }
    
    // Verify
    const remainingUsers = await db.collection("User").countDocuments({
      institutionId: institution._id,
      roles: "STUDENT"
    });
    const remainingStudents = await db.collection("Student").countDocuments({
      institutionId: institution._id
    });
    
    console.log("\n=== VERIFICATION ===");
    console.log("STUDENT users now:", remainingUsers);
    console.log("Student records:", remainingStudents);
    console.log("Match:", remainingUsers === remainingStudents ? "YES" : "NO");
    
  } finally {
    await client.close();
  }
}

deleteOrphanedUser();
