import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getDatabase, ref, set, onValue } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT_ID.firebaseio.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "SENDER_ID",
  appId: "APP_ID"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth();
const db = getDatabase(app);

const ui = {
    authBox: document.getElementById("authBox"),
    controlBox: document.getElementById("controlBox"),
    scheduleBox: document.getElementById("scheduleBox"),
    statusBadge: document.getElementById("statusBadge")
};

let deviceNames = ["SW 1", "SW 2", "SW 3", "SW 4", "SW 5", "SW 6"];
let activeTimers = {};
let lastSeenTime = 0;

// Login Logic
document.getElementById("loginBtn").onclick = async () => {
    try { await signInWithEmailAndPassword(auth, document.getElementById("emailField").value, document.getElementById("passwordField").value); }
    catch (e) { document.getElementById("authMsg").textContent = e.message; }
};

// Logout with Custom Dialog
document.getElementById("logoutBtn").onclick = () => {
    showDialog("Exit System?", "Are you sure you want to log out?", () => signOut(auth));
};

// Master Button Logic
const masterBtn = document.getElementById("masterBtn");
const masterStatus = document.getElementById("masterStatus");

masterBtn.onclick = () => {
    let anyOn = false;
    for(let i=1; i<=6; i++) {
        const btn = document.getElementById("gpio" + i + "Btn");
        if(btn && btn.classList.contains("on")) { anyOn = true; break; }
    }
    const actionText = anyOn ? "Turn ALL OFF" : "Turn ALL ON";
    const newState = anyOn ? 0 : 1;
    
    showDialog("Master Control", `Are you sure you want to ${actionText}?`, () => {
        for(let i=1; i<=6; i++) set(ref(db, "/gpio" + i), newState);
    });
};

function updateMasterButton() {
    let anyOn = false;
    for(let i=1; i<=6; i++) {
        const btn = document.getElementById("gpio" + i + "Btn");
        if(btn && btn.classList.contains("on")) { anyOn = true; break; }
    }
    masterStatus.textContent = anyOn ? "ALL OFF" : "ALL ON";
}

// --- PREMIUM DIALOG LOGIC ---
const modal = document.getElementById("customModal");
const modalTitle = document.getElementById("modalTitle");
const modalMessage = document.getElementById("modalMessage");
const btnConfirm = document.getElementById("btnConfirm");
const btnCancel = document.getElementById("btnCancel");
let onConfirmAction = null;

function showDialog(title, msg, callback) {
    modalTitle.textContent = title;
    modalMessage.textContent = msg;
    onConfirmAction = callback;
    modal.classList.add("active");
}
function closeDialog() { modal.classList.remove("active"); onConfirmAction = null; }
btnCancel.onclick = closeDialog;
btnConfirm.onclick = () => { if(onConfirmAction) onConfirmAction(); closeDialog(); };

// Auth Listener
onAuthStateChanged(auth, (user) => {
    if (user) {
        ui.authBox.style.display = "none";
        ui.controlBox.style.display = "flex";
        ui.statusBadge.textContent = "Connecting...";
        startListeners();
    } else {
        ui.authBox.style.display = "flex";
        ui.controlBox.style.display = "none";
        ui.scheduleBox.style.display = "none";
    }
});

function startListeners() {
    // Heartbeat
    onValue(ref(db, "/lastSeen"), (snap) => {
        lastSeenTime = Date.now();
        ui.statusBadge.className = "status-badge online";
        ui.statusBadge.textContent = "System Online";
    });
    setInterval(() => {
        if (Date.now() - lastSeenTime > 15000) {
            ui.statusBadge.className = "status-badge offline";
            ui.statusBadge.textContent = "System Offline";
        }
    }, 1000);

    // GPIO & Timer Listeners
    for(let i=1; i<=6; i++) {
        const idx = i;
        onValue(ref(db, "/gpio" + idx), (snap) => {
            const val = snap.val();
            const btn = document.getElementById("gpio" + idx + "Btn");
            const txt = btn ? btn.querySelector(".status") : null;
            if(btn) {
                if(val === 1) { btn.classList.add("on"); if(txt) txt.textContent="ON"; }
                else { btn.classList.remove("on"); if(txt) txt.textContent="OFF"; }
            }
            updateMasterButton();
        });
        onValue(ref(db, "/label" + idx), (snap) => {
            if(snap.val()) {
                deviceNames[idx-1] = snap.val();
                document.getElementById("name_gpio" + idx).textContent = snap.val();
                updateDropdown();
                renderList();
            }
        });
        onValue(ref(db, "/timeOn" + idx), (snap) => { activeTimers["timeOn"+idx] = snap.val(); renderList(); });
        onValue(ref(db, "/timeOff" + idx), (snap) => { activeTimers["timeOff"+idx] = snap.val(); renderList(); });
    }

    // --- FIXED BUTTON LOGIC (Long Press vs Click) ---
    document.querySelectorAll(".gpio-button:not(.master-style)").forEach((btn) => {
        let pressTimer = null;
        let isLongPress = false;

        // প্রেস শুরু (Touch/Mouse)
        const startPress = (e) => {
            // শুধুমাত্র লেফট ক্লিক বা টাচ
            if (e.type === 'mousedown' && e.button !== 0) return;
            
            isLongPress = false;
            pressTimer = setTimeout(() => {
                isLongPress = true;
                // লং প্রেস ডিটেক্ট হলে ভাইব্রেশন হবে (মোবাইলে)
                if (navigator.vibrate) navigator.vibrate(50);
                editName(btn.dataset.label);
            }, 800); // ৮০০ মিলিসেকেন্ড চাপলে লং প্রেস হবে
        };

        // প্রেস শেষ বা বাতিল
        const cancelPress = (e) => {
            if (pressTimer) {
                clearTimeout(pressTimer);
                pressTimer = null;
            }
        };

        // ক্লিক অ্যাকশন
        const handleClick = (e) => {
            // যদি লং প্রেস হয়ে থাকে, তাহলে ক্লিক কাজ করবে না
            if (isLongPress) {
                e.preventDefault();
                isLongPress = false; // রিসেট
                return;
            }
            
            // সাধারণ ক্লিক (অন/অফ)
            const key = btn.dataset.gpio;
            const newState = btn.classList.contains("on") ? 0 : 1;
            set(ref(db, "/" + key), newState);
        };

        // ইভেন্ট লিসেনার যোগ করা
        btn.addEventListener("mousedown", startPress);
        btn.addEventListener("touchstart", startPress, {passive: true});

        btn.addEventListener("mouseup", cancelPress);
        btn.addEventListener("mouseleave", cancelPress);
        btn.addEventListener("touchend", cancelPress);
        
        btn.addEventListener("click", handleClick);
        
        // রাইট ক্লিক মেনু বন্ধ করা
        btn.addEventListener("contextmenu", e => {
            e.preventDefault();
            return false;
        });
    });
}

function populateTimeSelects() {
    const h = document.getElementById("schedHour");
    const m = document.getElementById("schedMinute");
    for(let i=1; i<=12; i++) { let v=i<10?"0"+i:i; let o=document.createElement("option"); o.value=v; o.text=v; h.add(o); }
    for(let i=0; i<60; i++) { let v=i<10?"0"+i:i; let o=document.createElement("option"); o.value=v; o.text=v; m.add(o); }
}
window.addEventListener('load', populateTimeSelects);

function updateDropdown() {
    const s = document.getElementById("schedDeviceSelect");
    const curr = s.value;
    s.innerHTML = "";
    deviceNames.forEach((n, i) => { let o = document.createElement("option"); o.value = i+1; o.text = n; s.add(o); });
    s.value = curr;
}

function formatTime12(time24) {
    if(!time24) return "";
    let [H, M] = time24.split(":");
    H = parseInt(H);
    let ampm = H >= 12 ? "PM" : "AM";
    H = H % 12; H = H ? H : 12; 
    let H_str = H < 10 ? "0" + H : H;
    return `${H_str}:${M} ${ampm}`;
}

function renderList() {
    const c = document.getElementById("scheduleListContainer");
    c.innerHTML = "";
    let has = false;
    for(let i=1; i<=6; i++) {
        if(activeTimers["timeOn"+i]) { addItem(c, i, "On", formatTime12(activeTimers["timeOn"+i])); has=true; }
        if(activeTimers["timeOff"+i]) { addItem(c, i, "Off", formatTime12(activeTimers["timeOff"+i])); has=true; }
    }
    if(!has) c.innerHTML = "<div style='color:#aaa;text-align:center;margin-top:20px'>No timers set</div>";
}

function addItem(c, i, act, time) {
    c.innerHTML += `
    <div class="schedule-item">
        <div><b>${deviceNames[i-1]}</b> <span style="font-size:12px">will turn <span class="${act=='On'?'on-text':'off-text'}">${act.toUpperCase()}</span> at ${time}</span></div>
        <button class="del-btn" onclick="window.delT(${i}, '${act}')"><i class="fas fa-trash"></i></button>
    </div>`;
}

window.editName = (k) => { 
    // ছোট একটি ডিলে দিয়ে প্রম্পট ওপেন করা যাতে ক্লিক ইভেন্ট শেষ হতে পারে
    setTimeout(() => {
        let n = prompt("Enter new name:"); 
        if(n) set(ref(db, "/"+k), n); 
    }, 10);
};

window.addNewSchedule = () => {
    let d = document.getElementById("schedDeviceSelect").value;
    let a = document.getElementById("schedActionSelect").value;
    let hh = document.getElementById("schedHour").value;
    let mm = document.getElementById("schedMinute").value;
    let ampm = document.getElementById("schedAmPm").value;
    let h = parseInt(hh);
    if(ampm === "PM" && h < 12) h = h + 12;
    if(ampm === "AM" && h === 12) h = 0;
    let h_str = h < 10 ? "0" + h : h;
    let t = h_str + ":" + mm;
    if(t) set(ref(db, "/time"+a+d), t);
};
window.delT = (i, a) => set(ref(db, "/time"+a+i), "");
