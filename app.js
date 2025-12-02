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

const ui = {
    authBox: document.getElementById("authBox"),
    controlBox: document.getElementById("controlBox"),
    scheduleBox: document.getElementById("scheduleBox"),
    statusBadge: document.getElementById("statusBadge")
};

let deviceNames = ["SW 1", "SW 2", "SW 3", "SW 4", "SW 5", "SW 6"];
let activeTimers = {};
let pressTimer;

document.getElementById("loginBtn").onclick = async () => {
    try { await signInWithEmailAndPassword(auth, document.getElementById("emailField").value, document.getElementById("passwordField").value); }
    catch (e) { document.getElementById("authMsg").textContent = e.message; }
};

document.getElementById("logoutBtn").onclick = () => {
    if(confirm("Are you sure you want to Exit?")) {
        signOut(auth);
    }
};

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
    if (confirm(`Are you sure you want to ${actionText}?`)) {
        for(let i=1; i<=6; i++) set(ref(db, "/gpio" + i), newState);
    }
};

function updateMasterButton() {
    let anyOn = false;
    for(let i=1; i<=6; i++) {
        const btn = document.getElementById("gpio" + i + "Btn");
        if(btn && btn.classList.contains("on")) { anyOn = true; break; }
    }
    masterStatus.textContent = anyOn ? "ALL OFF" : "ALL ON";
}

onAuthStateChanged(auth, (user) => {
    if (user) {
        ui.authBox.style.display = "none";
        ui.controlBox.style.display = "flex";
        ui.statusBadge.className = "status-badge online";
        ui.statusBadge.textContent = "System Online";
        startListeners();
    } else {
        ui.authBox.style.display = "flex";
        ui.controlBox.style.display = "none";
        ui.scheduleBox.style.display = "none";
        ui.statusBadge.className = "status-badge offline";
        ui.statusBadge.textContent = "System Offline";
    }
});

function startListeners() {
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
                const el = document.getElementById("name_gpio" + idx);
                if(el) el.textContent = snap.val();
                updateDropdown();
                renderList();
            }
        });
        onValue(ref(db, "/timeOn" + idx), (snap) => { activeTimers["timeOn"+idx] = snap.val(); renderList(); });
        onValue(ref(db, "/timeOff" + idx), (snap) => { activeTimers["timeOff"+idx] = snap.val(); renderList(); });
    }

    document.querySelectorAll(".gpio-button:not(.master-style)").forEach((btn) => {
        let isLong = false;
        const start = () => { isLong = false; pressTimer = setTimeout(() => { isLong = true; editName(btn.dataset.label); }, 800); };
        const end = () => clearTimeout(pressTimer);
        
        btn.addEventListener("mousedown", start); btn.addEventListener("touchstart", start);
        btn.addEventListener("mouseup", end); btn.addEventListener("touchend", end);
        btn.addEventListener("click", () => {
            if(!isLong) {
                const key = btn.dataset.gpio;
                const newState = btn.classList.contains("on") ? 0 : 1;
                set(ref(db, "/" + key), newState);
            }
        });
        btn.addEventListener("contextmenu", e => e.preventDefault());
    });
}

// 12-Hour Dropdown Population
function populateTimeSelects() {
    const h = document.getElementById("schedHour");
    const m = document.getElementById("schedMinute");
    
    // Hours 01-12
    for(let i=1; i<=12; i++) { 
        let val = i < 10 ? "0" + i : i; 
        let o = document.createElement("option"); 
        o.value = val; o.text = val; h.add(o); 
    }
    // Minutes 00-59
    for(let i=0; i<60; i++) { 
        let val = i < 10 ? "0" + i : i; 
        let o = document.createElement("option"); 
        o.value = val; o.text = val; m.add(o); 
    }
}
window.addEventListener('load', populateTimeSelects);

function updateDropdown() {
    const s = document.getElementById("schedDeviceSelect");
    const curr = s.value;
    s.innerHTML = "";
    deviceNames.forEach((n, i) => { let o = document.createElement("option"); o.value = i+1; o.text = n; s.add(o); });
    s.value = curr;
}

// Helper: Convert 24h (from DB) to 12h (for UI)
function formatTime12(time24) {
    if(!time24) return "";
    let [H, M] = time24.split(":");
    H = parseInt(H);
    let ampm = H >= 12 ? "PM" : "AM";
    H = H % 12;
    H = H ? H : 12; // 0 should be 12
    let H_str = H < 10 ? "0" + H : H;
    return `${H_str}:${M} ${ampm}`;
}

function renderList() {
    const c = document.getElementById("scheduleListContainer");
    c.innerHTML = "";
    let has = false;
    for(let i=1; i<=6; i++) {
        if(activeTimers["timeOn"+i]) { 
            // Display formatted 12h time
            addItem(c, i, "On", formatTime12(activeTimers["timeOn"+i])); 
            has=true; 
        }
        if(activeTimers["timeOff"+i]) { 
            addItem(c, i, "Off", formatTime12(activeTimers["timeOff"+i])); 
            has=true; 
        }
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

window.editName = (k) => { let n = prompt("Name:"); if(n) set(ref(db, "/"+k), n); };

// Add Schedule: Convert 12h (UI) -> 24h (DB)
window.addNewSchedule = () => {
    let d = document.getElementById("schedDeviceSelect").value;
    let a = document.getElementById("schedActionSelect").value;
    let hh = document.getElementById("schedHour").value;
    let mm = document.getElementById("schedMinute").value;
    let ampm = document.getElementById("schedAmPm").value;

    // Logic to convert to 24 Hour format for ESP32
    let h = parseInt(hh);
    if(ampm === "PM" && h < 12) h = h + 12;
    if(ampm === "AM" && h === 12) h = 0;
    
    // Format to HH:MM (Example: 08:30 or 20:30)
    let h_str = h < 10 ? "0" + h : h;
    let t = h_str + ":" + mm;

    if(t) set(ref(db, "/time"+a+d), t);
};
window.delT = (i, a) => set(ref(db, "/time"+a+i), "");
