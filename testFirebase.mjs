import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCzAmlFZZMVekL0liy5G6j-tlRLngvh-RM",
  authDomain: "unicalendar-ab47d.firebaseapp.com",
  projectId: "unicalendar-ab47d",
  storageBucket: "unicalendar-ab47d.firebasestorage.app",
  messagingSenderId: "642789450408",
  appId: "1:642789450408:web:4ce0c624b2717c8184189d"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function test() {
  console.log("Checking Firestore...");
  const usersRef = collection(db, "users");
  const snapshot = await getDocs(usersRef);
  if (snapshot.empty) {
    console.log("NO USERS FOUND IN FIRESTORE.");
  } else {
    snapshot.forEach(doc => {
      const data = doc.data();
      console.log(`User: ${doc.id}`);
      console.log(`- Events: ${data.events?.length || 0}`);
      console.log(`- Tasks: ${data.tasks?.length || 0}`);
      console.log(`- Courses: ${data.courses?.length || 0}`);
    });
  }
  process.exit(0);
}

test().catch(console.error);
