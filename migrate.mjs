import { initializeApp, deleteApp } from "firebase/app";
import { getFirestore, collection, getDocs, setDoc, doc, terminate } from "firebase/firestore";

const oldConfig = {
  apiKey: "AIzaSyAQo54gxb6_lBe_QcEU66hCu0pf8b3N68Y",
  authDomain: "vetmsu-check.firebaseapp.com",
  projectId: "vetmsu-check",
  storageBucket: "vetmsu-check.firebasestorage.app",
  messagingSenderId: "503995050824",
  appId: "1:503995050824:web:8f85fc8e81b49579c9e17d",
};

const newConfig = {
  apiKey: "AIzaSyBq-W4Fr9z9BkIuW0w9I0NXmn-U4Nb3wVg",
  authDomain: "jibjoyvet.firebaseapp.com",
  projectId: "jibjoyvet",
  storageBucket: "jibjoyvet.firebasestorage.app",
  messagingSenderId: "782893625471",
  appId: "1:782893625471:web:ae3e988d6855ecdf04cf4a",
};

const COLLECTIONS = ["checkins", "enrollments", "locations", "sessions", "subjects", "users"];

async function migrateCollection(oldDb, newDb, collectionName) {
  process.stdout.write(`\n📦 [${collectionName}] กำลังอ่านข้อมูล...`);
  const querySnapshot = await getDocs(collection(oldDb, collectionName));
  const total = querySnapshot.size;

  if (total === 0) {
    console.log(` ไม่พบข้อมูล`);
    return 0;
  }

  console.log(` พบ ${total} รายการ กำลังคัดลอก...`);

  let count = 0;
  for (const document of querySnapshot.docs) {
    await setDoc(doc(newDb, collectionName, document.id), document.data());
    count++;
    if (count % 10 === 0 || count === total) {
      process.stdout.write(`\r   ↳ คัดลอก ${count}/${total} รายการ...`);
    }
  }
  console.log(`\n   ✅ [${collectionName}] เสร็จ ${count} รายการ`);
  return count;
}

async function migrate() {
  console.log("🚀 เริ่มต้น Migration: vetmsu-check → jibjoyvet");
  console.log("⚠️  READ-ONLY บนฐานข้อมูลเก่า");
  console.log("=".repeat(55));

  const oldApp = initializeApp(oldConfig, "oldApp");
  const newApp = initializeApp(newConfig, "newApp");
  const oldDb = getFirestore(oldApp);
  const newDb = getFirestore(newApp);

  let totalCount = 0;
  try {
    for (const col of COLLECTIONS) {
      const count = await migrateCollection(oldDb, newDb, col);
      totalCount += count;
    }

    // Set admin role
    console.log("\n🔑 กำลัง set role admin ให้ jirawat.s@msu.ac.th...");
    const usersSnap = await getDocs(collection(newDb, "users"));
    let adminSet = false;
    for (const userDoc of usersSnap.docs) {
      if (userDoc.data().email === "jirawat.s@msu.ac.th") {
        await setDoc(doc(newDb, "users", userDoc.id), { ...userDoc.data(), role: "admin" });
        console.log(`   ✅ set role admin สำเร็จ (ID: ${userDoc.id})`);
        adminSet = true;
        break;
      }
    }
    if (!adminSet) {
      await setDoc(doc(newDb, "users", "jirawat-admin"), {
        name: "Jirawat S",
        email: "jirawat.s@msu.ac.th",
        photoURL: "",
        role: "admin",
        createdAt: new Date().toLocaleString("th-TH"),
      });
      console.log("   ✅ สร้าง admin user ใหม่สำเร็จ");
    }

    console.log("\n" + "=".repeat(55));
    console.log(`🎉 Migration สำเร็จ! ย้ายข้อมูลทั้งหมด ${totalCount} รายการ`);
    console.log("=".repeat(55));

  } finally {
    // ปิด connections ทั้งหมดเพื่อให้โปรแกรมจบ
    console.log("\n🔒 กำลังปิด connection...");
    await terminate(oldDb);
    await terminate(newDb);
    await deleteApp(oldApp);
    await deleteApp(newApp);
    console.log("✅ ปิด connection เรียบร้อย");
    process.exit(0);
  }
}

migrate().catch((err) => {
  console.error("\n❌ Migration ล้มเหลว:", err.message);
  console.error(err);
  process.exit(1);
});
