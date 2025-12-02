import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getDatabase, ref, set, onValue } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

// Your web app's Firebase configuration
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
const scheduleBox = document.getElementById("scheduleBox");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const authMsg = document.getElementById("authMsg");
const badge = document.getElementById("statusBadge");

loginBtn.onclick = async () => {
  authMsg.textContent = "Logging in...";
  try {
    await signInWithEmailAndPassword(auth, document.getElementById("emailField").value, document.getElementById("passwordField").value);
  } catch (e) { authMsg.textContent = e.message; }
};

logoutBtn.onclick = () => signOut(auth);

onAuthStateChanged(auth, (user) => {
  if (user) {
    authBox.style.display = "none";
    controlBox.style.display = "block";
    scheduleBox.style.display = "none";
    badge.className = "status-badge online";
    badge.textContent = "System Online";
    startListeners();
  } else {
    authBox.style.display = "block";
    controlBox.style.display = "none";
    scheduleBox.style.display = "none";
    badge.className = "status-badge offline";
    badge.textContent = "System Offline";
  }
});

function startListeners() {
  for(let i=1; i<=5; i++) {
    // GPIO & Button
    const key = "gpio" + i;
    onValue(ref(db, "/" + key), (snap) => {
      const val = snap.val();
      const btn = document.getElementById(key + "Btn");
      const txt = btn ? btn.querySelector(".status") : null;
      if(btn) {
        if(val === 1) { btn.classList.add("on"); if(txt) txt.textContent="ON"; }
        else { btn.classList.remove("on"); if(txt) txt.textContent="OFF"; }
      }
    });

    // Label
    const lblKey = "label" + i;
    onValue(ref(db, "/" + lblKey), (snap) => {
      const name = snap.val();
      const el1 = document.getElementById("name_" + key);
      const el2 = document.getElementById("sched_name_" + i);
      if(el1) el1.textContent = name;
      if(el2) el2.textContent = name;
    });

    // Timers
    onValue(ref(db, "/timeOn" + i), (snap) => {
        const el = document.getElementById("timeOn" + i);
        if(el) el.value = snap.val() || "";
    });
    onValue(ref(db, "/timeOff" + i), (snap) => {
        const el = document.getElementById("timeOff" + i);
        if(el) el.value = snap.val() || "";
    });
  }

  document.querySelectorAll(".gpio-button").forEach((btn) => {
    btn.onclick = () => {
      const key = btn.dataset.gpio;
      const newState = btn.classList.contains("on") ? 0 : 1;
      set(ref(db, "/" + key), newState);
    };
  });
}

window.editName = function(labelKey, event) {
  event.stopPropagation(); 
  let newName = prompt("Enter new name:");
  if (newName && newName.trim() !== "") set(ref(db, "/" + labelKey), newName);
};

window.setTimer = function(key, value) {
    set(ref(db, "/" + key), value);
};
