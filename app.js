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

// UI References
const ui = {
    authBox: document.getElementById("authBox"),
    mainContent: document.getElementById("mainContent"),
    bottomNav: document.getElementById("bottomNav"),
    statusBadge: document.getElementById("statusBadge")
};

let activeTimers = {};
let lastSeenTime = 0;

// --- NAVIGATION LOGIC ---
window.switchTab = function(tabName) {
    // Hide all pages
    document.querySelectorAll('.page-content').forEach(p => p.classList.remove('active-page'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

    // Show selected
    document.getElementById(tabName + 'Page').classList.add('active-page');
    
    // Update Nav Icon
    const navIndex = tabName === 'home' ? 0 : tabName === 'timer' ? 1 : 2;
    document.querySelectorAll('.nav-item')[navIndex].classList.add('active');
};

// --- AUTH LOGIC ---
document.getElementById("loginBtn").onclick = async () => {
    try { await signInWithEmailAndPassword(auth, document.getElementById("emailField").value, document.getElementById("passwordField").value); }
    catch (e) { document.getElementById("authMsg").textContent = e.message; }
};

document.getElementById("logoutBtn").onclick = () => {
    showDialog("Logout", "Exit app?", () => signOut(auth));
};

onAuthStateChanged(auth, (user) => {
    if (user) {
        ui.authBox.style.display = "none";
        ui.mainContent.style.display = "block";
        ui.bottomNav.style.display = "flex";
        ui.statusBadge.textContent = "Connecting...";
        startListeners();
    } else {
        ui.authBox.style.display = "flex";
        ui.mainContent.style.display = "none";
        ui.bottomNav.style.display = "none";
    }
});

// --- SETTINGS: THEME TOGGLE ---
const themeToggle = document.getElementById("themeToggle");
// Check saved theme
if(localStorage.getItem("theme") === "light") {
    document.body.classList.add("light-mode");
    themeToggle.checked = false;
} else {
    themeToggle.checked = true; // Dark is default
}

themeToggle.addEventListener("change", () => {
    if(!themeToggle.checked) {
        document.body.classList.add("light-mode");
        localStorage.setItem("theme", "light");
    } else {
        document.body.classList.remove("light-mode");
        localStorage.setItem("theme", "dark");
    }
});

// --- SETTINGS: RENAME LOGIC ---
window.saveName = function(id, newName) {
    if(newName && newName.trim() !== "") {
        set(ref(db, "/label" + id), newName);
    }
};

// --- MASTER BUTTON ---
const masterBtn = document.getElementById("masterBtn");
const masterStatus = document.getElementById("masterStatus");
masterBtn.onclick = () => {
    let anyOn = false;
    for(let i=1; i<=6; i++) {
        const btn = document.getElementById("gpio" + i + "Btn");
        if(btn && btn.classList.contains("on")) { anyOn = true; break; }
    }
    const actionText = anyOn ? "Turn OFF" : "Turn ON";
    const newState = anyOn ? 0 : 1;
    showDialog("Master Control", `${actionText} All Switches?`, () => {
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

// --- FIREBASE LISTENERS ---
function startListeners() {
    // Heartbeat
    onValue(ref(db, "/lastSeen"), () => {
        lastSeenTime = Date.now();
        ui.statusBadge.className = "status-badge online"; ui.statusBadge.textContent = "Online";
    });
    setInterval(() => {
        if (Date.now() - lastSeenTime > 15000) {
            ui.statusBadge.className = "status-badge offline"; ui.statusBadge.textContent = "Offline";
        }
    }, 1000);

    for(let i=1; i<=6; i++) {
        const idx = i;
        // GPIO
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
        // Label (Update Home & Settings Input)
        onValue(ref(db, "/label" + idx), (snap) => {
            if(snap.val()) {
                document.getElementById("name_gpio" + idx).textContent = snap.val();
                document.getElementById("rename" + idx).value = snap.val(); // Update Input
                updateDropdown();
                renderList();
            }
        });
        // Timers
        onValue(ref(db, "/timeOn" + idx), (snap) => { activeTimers["timeOn"+idx] = snap.val(); renderList(); });
        onValue(ref(db, "/timeOff" + idx), (snap) => { activeTimers["timeOff"+idx] = snap.val(); renderList(); });
    }

    // Button Click (Toggle Only)
    document.querySelectorAll(".gpio-button:not(.master-style)").forEach((btn) => {
        btn.onclick = () => {
            const key = btn.dataset.gpio;
            const newState = btn.classList.contains("on") ? 0 : 1;
            set(ref(db, "/" + key), newState);
        };
    });
}

// --- MODAL ---
const modal = document.getElementById("customModal");
let onConfirm = null;
function showDialog(t, m, cb) { 
    document.getElementById("modalTitle").textContent=t; document.getElementById("modalMessage").textContent=m; 
    onConfirm=cb; modal.classList.add("active"); 
}
document.getElementById("btnCancel").onclick = () => modal.classList.remove("active");
document.getElementById("btnConfirm").onclick = () => { if(onConfirm) onConfirm(); modal.classList.remove("active"); };

// --- TIMER UTILS ---
function populateTimeSelects() {
    const h = document.getElementById("schedHour");
    const m = document.getElementById("schedMinute");
    for(let i=1; i<=12; i++) { let v=i<10?"0"+i:i; let o=document.createElement("option"); o.value=v; o.text=v; h.add(o); }
    for(let i=0; i<60; i++) { let v=i<10?"0"+i:i; let o=document.createElement("option"); o.value=v; o.text=v; m.add(o); }
}
window.addEventListener('load', populateTimeSelects);

function updateDropdown() {
    const s = document.getElementById("schedDeviceSelect");
    const curr = s.value; s.innerHTML = "";
    ["SW 1", "SW 2", "SW 3", "SW 4", "SW 5", "SW 6"].forEach((n, i) => { // Use real names if stored in array, here simplified
        let name = document.getElementById("name_gpio"+(i+1)).textContent || n;
        let o = document.createElement("option"); o.value = i+1; o.text = name; s.add(o); 
    });
    s.value = curr;
}

function formatTime12(time24) {
    if(!time24) return "";
    let [H, M] = time24.split(":"); H = parseInt(H);
    let ampm = H >= 12 ? "PM" : "AM";
    H = H % 12; H = H ? H : 12;
    return `${H < 10 ? "0"+H : H}:${M} ${ampm}`;
}

function renderList() {
    const c = document.getElementById("scheduleListContainer"); c.innerHTML = "";
    for(let i=1; i<=6; i++) {
        let n = document.getElementById("name_gpio"+i).textContent;
        if(activeTimers["timeOn"+i]) addItem(c, i, "On", formatTime12(activeTimers["timeOn"+i]), n);
        if(activeTimers["timeOff"+i]) addItem(c, i, "Off", formatTime12(activeTimers["timeOff"+i]), n);
    }
}

function addItem(c, i, act, time, name) {
    c.innerHTML += `<div class="schedule-item"><div><b>${name}</b> <span style="font-size:12px">will turn <span style="color:${act=='On'?'#00e676':'#ff1744'}">${act.toUpperCase()}</span> at ${time}</span></div><button onclick="window.delT(${i}, '${act}')" style="background:none;border:none;color:#ff1744;cursor:pointer"><i class="fas fa-trash"></i></button></div>`;
}

window.addNewSchedule = () => {
    let d = document.getElementById("schedDeviceSelect").value;
    let a = document.getElementById("schedActionSelect").value;
    let hh = document.getElementById("schedHour").value;
    let mm = document.getElementById("schedMinute").value;
    let ampm = document.getElementById("schedAmPm").value;
    let h = parseInt(hh);
    if(ampm === "PM" && h < 12) h = h + 12; if(ampm === "AM" && h === 12) h = 0;
    let t = (h<10?"0"+h:h) + ":" + mm;
    set(ref(db, "/time"+a+d), t);
};
window.delT = (i, a) => set(ref(db, "/time"+a+i), "");
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


