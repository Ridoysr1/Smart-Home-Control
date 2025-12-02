import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getDatabase, ref, set, onValue } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

// --- আপনার কনফিগারেশন ---
const firebaseConfig = {
  apiKey: "AIzaSyDxkigmr_aFKfkcA40tYxkJ7uNFxtmg34s",
  authDomain: "smart-home-control-85131.firebaseapp.com",
  databaseURL: "https://smart-home-control-85131-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "smart-home-control-85131",
  storageBucket: "smart-home-control-85131.firebasestorage.app",
  messagingSenderId: "1088125775954",
  appId: "1:1088125775954:web:743b9899cbcb7011966f8b"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth();
const db = getDatabase(app);

const authBox = document.getElementById("authBox");
const controlBox = document.getElementById("controlBox");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const authMsg = document.getElementById("authMsg");
const badge = document.getElementById("statusBadge");

// লিসেনার লিস্ট
const gpioKeys = ["gpio1", "gpio2", "gpio3", "gpio4", "gpio5"];
const labelKeys = ["label1", "label2", "label3", "label4", "label5"];

loginBtn.onclick = async () => {
  authMsg.textContent = "Logging in...";
  try {
    await signInWithEmailAndPassword(auth, 
      document.getElementById("emailField").value, 
      document.getElementById("passwordField").value
    );
  } catch (e) { authMsg.textContent = e.message; }
};

logoutBtn.onclick = () => signOut(auth);

onAuthStateChanged(auth, (user) => {
  if (user) {
    authBox.style.display = "none";
    controlBox.style.display = "block";
    badge.className = "status-badge online";
    badge.textContent = "System Online";
    startListeners();
  } else {
    authBox.style.display = "block";
    controlBox.style.display = "none";
    badge.className = "status-badge offline";
    badge.textContent = "System Offline";
  }
});

function startListeners() {
  // ১. GPIO স্ট্যাটাস শোনা
  gpioKeys.forEach((key) => {
    onValue(ref(db, "/" + key), (snapshot) => {
      updateButtonVisuals(key, snapshot.val());
    });
  });

  // ২. নামের পরিবর্তন শোনা (Label Listeners)
  labelKeys.forEach((key, index) => {
    onValue(ref(db, "/" + key), (snapshot) => {
      const name = snapshot.val();
      const gpioKey = "gpio" + (index + 1);
      const nameSpan = document.getElementById("name_" + gpioKey);
      if(nameSpan) nameSpan.textContent = name;
    });
  });

  // ৩. বাটন ক্লিক হ্যান্ডলার (অন/অফ)
  document.querySelectorAll(".gpio-button").forEach((btn) => {
    btn.onclick = () => {
      const key = btn.dataset.gpio;
      const newState = btn.classList.contains("on") ? 0 : 1;
      set(ref(db, "/" + key), newState);
    };
  });
}

function updateButtonVisuals(key, value) {
  const btn = document.getElementById(key + "Btn");
  const statusText = btn ? btn.querySelector(".status") : null;
  
  if (btn) {
    if (value === 1) {
      btn.classList.add("on");
      if (statusText) statusText.textContent = "ON";
    } else {
      btn.classList.remove("on");
      if (statusText) statusText.textContent = "OFF";
    }
  }
}

// ৪. নাম এডিট করার ফাংশন (গ্লোবাল স্কোপে দেওয়া হয়েছে)
window.editName = function(labelKey, event) {
  // বাটন ক্লিকের কারণে যেন লাইট অন/অফ না হয়, তাই এটা থামানো হলো
  event.stopPropagation(); 
  
  let newName = prompt("Enter new name:");
  
  if (newName && newName.trim() !== "") {
    // ফায়ারবেসে নাম সেভ করা
    set(ref(db, "/" + labelKey), newName)
      .then(() => {
        console.log("Name updated!");
      })
      .catch((error) => {
        alert("Error saving name: " + error.message);
      });
  }
};


