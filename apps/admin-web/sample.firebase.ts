// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDAcXwkCO1mVZR5o8K-xwpDsXL-PXpaoho",
  authDomain: "marzi-society-os.firebaseapp.com",
  projectId: "marzi-society-os",
  storageBucket: "marzi-society-os.firebasestorage.app",
  messagingSenderId: "436474565320",
  appId: "1:436474565320:web:05061be54493c8669f8bfd",
  measurementId: "G-WQCSQJY1ZJ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);