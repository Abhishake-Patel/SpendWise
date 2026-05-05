// ============================================================
// FIREBASE CONFIGURATION — See SETUP.md for instructions
// ============================================================

const firebaseConfig = {
  apiKey: "AIzaSyDpVZ_WXpg7COANQ2_-x0Jts7iDABgxYlI",
  authDomain: "spendwise-cfa10.firebaseapp.com",
  databaseURL: "https://spendwise-cfa10-default-rtdb.firebaseio.com",
  projectId: "spendwise-cfa10",
  storageBucket: "spendwise-cfa10.firebasestorage.app",
  messagingSenderId: "276327666223",
  appId: "1:276327666223:web:0e86cc0c1b1f347d066cda",
  measurementId: "G-60R5N9808S"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();

// Force HTTP long-polling so Firestore works from file:// and all environments
// (Firestore's default gRPC-Web transport requires an http:// origin)
db.settings({ experimentalForceLongPolling: true, merge: true });

const googleProvider = new firebase.auth.GoogleAuthProvider();
