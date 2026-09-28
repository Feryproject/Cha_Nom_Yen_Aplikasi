// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyASadYAooxipBNb17XqGaSjwZYwLQ-XtsA",
  authDomain: "teh-tarik-malaysia.firebaseapp.com",
  projectId: "teh-tarik-malaysia",
  storageBucket: "teh-tarik-malaysia.firebasestorage.app",
  messagingSenderId: "719998391719",
  appId: "1:719998391719:web:98af5f20df487f55fc1282",
  measurementId: "G-24CYTYPRNB"
};

if (typeof firebase !== 'undefined') {
  if (!firebase.apps || firebase.apps.length === 0) {
    firebase.initializeApp(firebaseConfig);
  }

  window.firebaseApp = firebase.apps[0];

  if (!window.db) {
    window.db = firebase.firestore(window.firebaseApp);
  }

  if (!window.firebaseAuth) {
    window.firebaseAuth = firebase.auth();
  }
} else {
  console.error('Firebase SDK tidak tersedia. Pastikan Firebase App SDK dimuat sebelum firebase.js.');
}