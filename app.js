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

// লং প্রেস ভেরিয়েবল
let pressTimer;
let isLongPress = false;

let deviceNames = ["Switch 1", "Switch 2", "Switch 3", "Switch 4", "Switch 5"];
let activeTimers = {};

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
    
    // Status Listener
    onValue(ref(db, "/gpio" + idx), (snap) => {
      const val = snap.val();
      const btn = document.getElementById("gpio" + idx + "Btn");
      const txt = btn ? btn.querySelector(".status") : null;
      if(btn) {
        if(val === 1) { btn.classList.add("on"); if(txt) txt.textContent="ON"; }
        else { btn.classList.remove("on"); if(txt) txt.textContent="OFF"; }
      }
    });

    // Label Listener
    onValue(ref(db, "/label" + idx), (snap) => {
      const name = snap.val();
      if(name) {
          deviceNames[idx-1] = name;
          const el = document.getElementById("name_gpio" + idx);
          if(el) el.textContent = name;
          updateDropdown();
          renderScheduleList();
      }
    });

    // Timer Listener
    onValue(ref(db, "/timeOn" + idx), (snap) => {
       activeTimers["timeOn" + idx] = snap.val();
       renderScheduleList();
    });
    onValue(ref(db, "/timeOff" + idx), (snap) => {
       activeTimers["timeOff" + idx] = snap.val();
       renderScheduleList();
    });
  }

  // --- বাটন ইভেন্ট হ্যান্ডলার (ক্লিক ও লং প্রেস) ---
  document.querySelectorAll(".gpio-button").forEach((btn) => {
    
    // ১. ক্লিক লজিক (Toggle)
    btn.onclick = (e) => {
        // যদি লং প্রেস হয়ে থাকে, তবে টোগল হবে না
        if(isLongPress) {
            isLongPress = false; // রিসেট
            return;
        }
        
        // টোগল কোড
        const key = btn.dataset.gpio;
        const newState = btn.classList.contains("on") ? 0 : 1;
        set(ref(db, "/" + key), newState);
    };

    // ২. লং প্রেস লজিক
    const handlePressStart = (e) => {
        isLongPress = false; // শুরুতে ফলস
        pressTimer = setTimeout(() => {
            isLongPress = true; // ৮০০ms পর লং প্রেস ডিটেক্ট হবে
            
            // ভাইব্রেশন (মোবাইলে ফিডব্যাকের জন্য)
            if(navigator.vibrate) navigator.vibrate(50);
            
            // নাম এডিট ফাংশন কল
            const labelKey = btn.dataset.label; // html এ data-label="label1" থাকতে হবে
            editName(labelKey);
            
        }, 800); // ৮০০ মিলিসেকেন্ড সময়
    };

    const handlePressEnd = (e) => {
        clearTimeout(pressTimer); // ৮০০ms এর আগে হাত উঠালে টাইমার বাতিল
    };

    // ইভেন্ট লিসেনার যোগ করা (মাউস এবং টাচ দুটোর জন্য)
    btn.addEventListener("mousedown", handlePressStart);
    btn.addEventListener("touchstart", handlePressStart);

    btn.addEventListener("mouseup", handlePressEnd);
    btn.addEventListener("mouseleave", handlePressEnd);
    btn.addEventListener("touchend", handlePressEnd);
    btn.addEventListener("touchmove", handlePressEnd); // স্ক্রল করলে বাতিল
    
    // রাইট ক্লিক মেনু বন্ধ করা
    btn.addEventListener("contextmenu", (e) => e.preventDefault());
  });
}

function updateDropdown() {
    const select = document.getElementById("schedDeviceSelect");
    if(!select) return;
    const currentVal = select.value;
    select.innerHTML = "";
    deviceNames.forEach((name, index) => {
        const option = document.createElement("option");
        option.value = index + 1;
        option.text = name;
        select.appendChild(option);
    });
    select.value = currentVal;
}

function renderScheduleList() {
    const container = document.getElementById("scheduleListContainer");
    if(!container) return;
    container.innerHTML = "";
    let hasTimer = false;
    for(let i=1; i<=5; i++) {
        if(activeTimers["timeOn"+i] && activeTimers["timeOn"+i] !== "") {
            createListItem(container, i, "On", activeTimers["timeOn"+i]);
            hasTimer = true;
        }
        if(activeTimers["timeOff"+i] && activeTimers["timeOff"+i] !== "") {
            createListItem(container, i, "Off", activeTimers["timeOff"+i]);
            hasTimer = true;
        }
    }
    if(!hasTimer) container.innerHTML = '<div class="empty-msg">No active timers set.</div>';
}

function createListItem(container, index, action, time) {
    const div = document.createElement("div");
    div.className = "schedule-item";
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

// নাম এডিট ফাংশন (লং প্রেস করলে এটি কল হবে)
window.editName = function(labelKey) {
  let newName = prompt("Enter new name for this switch:");
  if (newName && newName.trim() !== "") {
      set(ref(db, "/" + labelKey), newName)
      .then(() => console.log("Name updated"))
      .catch((err) => alert("Error: " + err.message));
  }
};

window.addNewSchedule = function() {
    const devId = document.getElementById("schedDeviceSelect").value;
    const action = document.getElementById("schedActionSelect").value;
    const time = document.getElementById("schedTimeInput").value;
    if(!time) { alert("Please select a time!"); return; }
    const dbKey = "/time" + action + devId;
    set(ref(db, dbKey), time)
    .then(() => alert("Schedule Added!"))
    .catch(err => alert("Error: " + err.message));
};

window.deleteTimer = function(index, action) {
    const dbKey = "/time" + action + index;
    if(confirm(`Remove timer?`)) {
        set(ref(db, dbKey), "");
    }
};
