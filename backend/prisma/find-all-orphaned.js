async function findAllOrphaned() {
  require('dotenv').config();
  const { MongoClient } = require("mongodb");
  // Use SSH tunnel: plink -ssh -i "c:\Users\sukee\Downloads\gunjan.privatekey (1).ppk" -L 27018:localhost:27017 root@144.208.66.222 -N
  const client = new MongoClient(process.env.SOURCE_MONGODB_URL || "mongodb://admin:Admin1234@127.0.0.1:27018/internship?authSource=admin&directConnection=true");
  
  try {
    await client.connect();
    const db = client.db("internship");
    
    // Get all institutions
    const institutions = await db.collection("Institution").find({}).toArray();
    
    console.log("=== ALL ORPHANED STUDENT USERS ===\n");
    
    let totalOrphaned = 0;
    const allOrphaned = [];
    
    for (const inst of institutions) {
      const studentUsers = await db.collection("User").find({
        institutionId: inst._id,
        roles: "STUDENT"
      }).toArray();
      
      const students = await db.collection("Student").find({
        institutionId: inst._id
      }).toArray();
      
      const studentUserIds = new Set(students.map(s => s.userId.toString()));
      const orphaned = studentUsers.filter(u => !studentUserIds.has(u._id.toString()));
      
      if (orphaned.length > 0) {
        console.log("Institution:", inst.name);
        console.log("STUDENT users:", studentUsers.length);
        console.log("Student records:", students.length);
        console.log("Orphaned:", orphaned.length);
        console.log("");
        
        for (const user of orphaned) {
          console.log("  - ID:", user._id.toString());
          console.log("    Name:", user.name || "(no name)");
          console.log("    Email:", user.email || "(no email)");
          console.log("    Created:", user.createdAt);
          console.log("");
          allOrphaned.push({ institution: inst.name, user });
        }
        
        totalOrphaned += orphaned.length;
        console.log("---");
      }
    }
    
    console.log("\n=== SUMMARY ===");
    console.log("Total orphaned STUDENT users:", totalOrphaned);
    console.log("Institutions with orphaned users:", allOrphaned.length > 0 ? [...new Set(allOrphaned.map(o => o.institution))].join(", ") : "None");
    
  } finally {
    await client.close();
  }
}

findAllOrphaned();
