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

// UI Refs
const authBox = document.getElementById("authBox");
const controlBox = document.getElementById("controlBox");
const scheduleBox = document.getElementById("scheduleBox");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const authMsg = document.getElementById("authMsg");
const badge = document.getElementById("statusBadge");

// ভেরিয়েবল নাম স্টোর করার জন্য
let deviceNames = ["Switch 1", "Switch 2", "Switch 3", "Switch 4", "Switch 5"];
let activeTimers = {}; // ডেটাবেসের টাইমার ভ্যালু এখানে জমা থাকবে

// Login
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
    const idx = i;
    
    // ১. GPIO Status Listener
    onValue(ref(db, "/gpio" + idx), (snap) => {
      const val = snap.val();
      const btn = document.getElementById("gpio" + idx + "Btn");
      const txt = btn ? btn.querySelector(".status") : null;
      if(btn) {
        if(val === 1) { btn.classList.add("on"); if(txt) txt.textContent="ON"; }
        else { btn.classList.remove("on"); if(txt) txt.textContent="OFF"; }
      }
    });

    // ২. Labels (Names) Listener - ড্রপডাউন এবং বাটন আপডেট করার জন্য
    onValue(ref(db, "/label" + idx), (snap) => {
      const name = snap.val();
      if(name) {
          deviceNames[idx-1] = name; // অ্যারে আপডেট
          const el = document.getElementById("name_gpio" + idx);
          if(el) el.textContent = name;
          updateDropdown(); // ড্রপডাউনে নাম আপডেট
          renderScheduleList(); // লিস্টেও নাম আপডেট হবে
      }
    });

    // ৩. Timers Listener (ডেটাবেস থেকে টাইমার রিড করা)
    onValue(ref(db, "/timeOn" + idx), (snap) => {
       activeTimers["timeOn" + idx] = snap.val();
       renderScheduleList();
    });
    onValue(ref(db, "/timeOff" + idx), (snap) => {
       activeTimers["timeOff" + idx] = snap.val();
       renderScheduleList();
    });
  }

  // বাটন ক্লিক হ্যান্ডলার
  document.querySelectorAll(".gpio-button").forEach((btn) => {
    btn.onclick = () => {
      const key = btn.dataset.gpio;
      const newState = btn.classList.contains("on") ? 0 : 1;
      set(ref(db, "/" + key), newState);
    };
  });
}

// সিলেক্ট ড্রপডাউন আপডেট করা (যাতে রিয়েল নাম দেখায়)
function updateDropdown() {
    const select = document.getElementById("schedDeviceSelect");
    if(!select) return;
    // বর্তমান সিলেকশন মনে রাখা
    const currentVal = select.value;
    select.innerHTML = "";
    
    deviceNames.forEach((name, index) => {
        const option = document.createElement("option");
        option.value = index + 1;
        option.text = name;
        select.appendChild(option);
    });
    // আগের সিলেকশন সেট করা
    select.value = currentVal;
}

// শিডিউল লিস্ট রেন্ডার করা (তৈরি করা)
function renderScheduleList() {
    const container = document.getElementById("scheduleListContainer");
    if(!container) return;
    container.innerHTML = "";

    let hasTimer = false;

    // ১ থেকে ৫ পর্যন্ত লুপ চালিয়ে চেক করা
    for(let i=1; i<=5; i++) {
        // ON টাইমার আছে কিনা
        if(activeTimers["timeOn"+i] && activeTimers["timeOn"+i] !== "") {
            createListItem(container, i, "On", activeTimers["timeOn"+i]);
            hasTimer = true;
        }
        // OFF টাইমার আছে কিনা
        if(activeTimers["timeOff"+i] && activeTimers["timeOff"+i] !== "") {
            createListItem(container, i, "Off", activeTimers["timeOff"+i]);
            hasTimer = true;
        }
    }

    if(!hasTimer) {
        container.innerHTML = '<div class="empty-msg">No active timers found.</div>';
    }
}

// লিস্ট আইটেম HTML তৈরি
function createListItem(container, index, action, time) {
    const div = document.createElement("div");
    div.className = "schedule-item";
    
    // কালার স্টাইল
    const actionClass = action === "On" ? "on-text" : "off-text";
    const actionText = action.toUpperCase();
    const deviceName = deviceNames[index-1] || "Switch "+index;

    div.innerHTML = `
        <div class="item-info">
            <div class="item-name">${deviceName}</div>
            <div class="item-action">Will turn <span class="${actionClass}">${actionText}</span> at <b>${time}</b></div>
        </div>
        <button class="delete-btn" onclick="deleteTimer(${index}, '${action}')">
            <i class="fas fa-trash"></i>
        </button>
    `;
    container.appendChild(div);
}

// --- GLOBAL FUNCTIONS ---

// নাম এডিট
window.editName = function(labelKey, event) {
  event.stopPropagation(); 
  let newName = prompt("Enter new name:");
  if (newName && newName.trim() !== "") set(ref(db, "/" + labelKey), newName);
};

// নতুন সিডিউল যোগ করা
window.addNewSchedule = function() {
    const devId = document.getElementById("schedDeviceSelect").value;
    const action = document.getElementById("schedActionSelect").value; // On or Off
    const time = document.getElementById("schedTimeInput").value;

    if(!time) {
        alert("Please select a time!");
        return;
    }

    const dbKey = "/time" + action + devId; // Ex: /timeOn1 or /timeOff2
    
    set(ref(db, dbKey), time)
    .then(() => {
        alert("Schedule Added!");
        // ইনপুট রিসেট না করলেও চলে, ইউজার চাইলে করতে পারে
    })
    .catch(err => alert("Error: " + err.message));
};

// টাইমার ডিলিট করা
window.deleteTimer = function(index, action) { // action = 'On' or 'Off'
    const dbKey = "/time" + action + index;
    if(confirm(`Delete auto ${action.toUpperCase()} for ${deviceNames[index-1]}?`)) {
        set(ref(db, dbKey), ""); // খালি স্ট্রিং দিয়ে ডিলিট
    }
};
