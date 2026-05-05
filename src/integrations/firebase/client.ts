import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyB6dsgG2B7lOy5tBlG150jlHpfBzSTxSNA",
  authDomain: "samovyvoz-685ae.firebaseapp.com",
  projectId: "samovyvoz-685ae",
  storageBucket: "samovyvoz-685ae.firebasestorage.app",
  messagingSenderId: "743001586840",
  appId: "1:743001586840:web:0d25f79ab83f4924dfa4ed",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
