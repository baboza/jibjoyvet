import { initializeApp, deleteApp } from "firebase/app";
import { getFirestore, collection, getDocs, setDoc, doc, query, where, terminate } from "firebase/firestore";

const newConfig = {
  apiKey: "AIzaSyBq-W4Fr9z9BkIuW0w9I0NXmn-U4Nb3wVg",
  authDomain: "jibjoyvet.firebaseapp.com",
  projectId: "jibjoyvet",
  storageBucket: "jibjoyvet.firebasestorage.app",
  messagingSenderId: "782893625471",
  appId: "1:782893625471:web:ae3e988d6855ecdf04cf4a",
};

async function setAdmin() {
  console.log("🔑 กำลัง set role admin ให้ jirawat.s@msu.ac.th...");

  const app = initializeApp(newConfig, "newApp");
  const db = getFirestore(app);

  try {
    // ค้นหา document ที่มี email = jirawat.s@msu.ac.th
    const q = query(collection(db, "users"), where("email", "==", "jirawat.s@msu.ac.th"));
    const snap = await getDocs(q);

    if (!snap.empty) {
      for (const d of snap.docs) {
        await setDoc(doc(db, "users", d.id), { ...d.data(), role: "admin" });
        console.log(`✅ อัปเดต role = admin สำเร็จ! (Document ID: ${d.id})`);
      }
    } else {
      // ไม่มีในระบบ → สร้างใหม่
      await setDoc(doc(db, "users", "jirawat-admin"), {
        name: "จิรวัฒน์ สุราสา",
        email: "jirawat.s@msu.ac.th",
        photoURL: "",
        role: "admin",
        createdAt: new Date().toLocaleString("th-TH"),
      });
      console.log("✅ สร้าง admin user ใหม่สำเร็จ!");
    }

    console.log("\n✅ เสร็จเรียบร้อย! ลองออกจากระบบแล้ว login ใหม่อีกครั้งนะครับ");

  } finally {
    await terminate(db);
    await deleteApp(app);
    process.exit(0);
  }
}

setAdmin().catch((err) => {
  console.error("❌ Error:", err.message);
  process.exit(1);
});
