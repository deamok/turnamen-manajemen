import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAe-XfgFMyOnp5qXRVVyr5oJlc1Vmkva0o",
  authDomain: "turnamen-tenismeja.firebaseapp.com",
  projectId: "turnamen-tenismeja",
  storageBucket: "turnamen-tenismeja.firebasestorage.app",
  messagingSenderId: "646046487291",
  appId: "1:646046487291:web:5152de0356e54dab40165e",
  measurementId: "G-2MR8RYC85B"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});
