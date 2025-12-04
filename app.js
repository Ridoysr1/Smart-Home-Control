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

let deviceNames = ["SW 1", "SW 2", "SW 3", "SW 4", "SW 5", "SW 6"];
let activeTimers = {};
let lastSeenTime = 0;

// DOM Loaded
document.addEventListener("DOMContentLoaded", () => {
    
    // Login
    const loginBtn = document.getElementById("loginBtn");
    if(loginBtn) {
        loginBtn.addEventListener("click", async () => {
            const email = document.getElementById("emailField").value;
            const pass = document.getElementById("passwordField").value;
            const msg = document.getElementById("authMsg");
            msg.textContent = "Logging in..."; msg.style.color = "#4fc3f7";
            try { await signInWithEmailAndPassword(auth, email, pass); } catch (e) { msg.textContent = "Error: " + e.code; msg.style.color = "#ff1744"; }
        });
    }

    // Logout
    const logoutBtn = document.getElementById("logoutBtn");
    if(logoutBtn) logoutBtn.addEventListener("click", () => showDialog("Exit", "Logout system?", () => signOut(auth)));

    // Modals
    const openRenameBtn = document.getElementById("openRenameBtn");
    if(openRenameBtn) openRenameBtn.addEventListener("click", () => document.getElementById("renameModal").classList.add("active"));
    
    const openTimerBtn = document.getElementById("openTimerModalBtn");
    if(openTimerBtn) openTimerBtn.addEventListener("click", () => document.getElementById("timerModal").classList.add("active"));

    // Close Modals
    document.querySelectorAll(".close-icon").forEach(icon => {
        icon.addEventListener("click", function() {
            this.closest(".modal-overlay").classList.remove("active");
        });
    });

    // Theme
    const themeToggle = document.getElementById("themeToggle");
    if(themeToggle) {
        if(localStorage.getItem("theme") === "light") { document.body.classList.add("light-mode"); themeToggle.checked = false; }
        else { themeToggle.checked = true; }
        themeToggle.addEventListener("change", () => {
            if(!themeToggle.checked) { document.body.classList.add("light-mode"); localStorage.setItem("theme", "light"); }
            else { document.body.classList.remove("light-mode"); localStorage.setItem("theme", "dark"); }
        });
    }

    // Master
    const masterBtn = document.getElementById("masterBtn");
    if(masterBtn) {
        masterBtn.addEventListener("click", () => {
            let anyOn = false;
            for(let i=1; i<=6; i++) {
                const btn = document.getElementById("gpio" + i + "Btn");
                if(btn && btn.classList.contains("on")) { anyOn = true; break; }
            }
            const action = anyOn ? "Turn OFF" : "Turn ON";
            const val = anyOn ? 0 : 1;
            showDialog("Master Control", `${action} All Switches?`, () => {
                for(let i=1; i<=6; i++) set(ref(db, "/gpio" + i), val);
            });
        });
    }

    populateTimeSelects();
});

// Navigation
window.switchTab = function(tabName) {
    document.querySelectorAll('.page-content').forEach(p => p.classList.remove('active-page'));
    const target = document.getElementById(tabName + 'Page');
    if(target) target.classList.add('active-page');
    const radio = document.getElementById('tab-' + tabName);
    if(radio) radio.checked = true;
};

// Auth State
onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById("authBox").style.display = "none";
        document.getElementById("mainContent").style.display = "block";
        document.getElementById("bottomNav").style.display = "flex";
        document.getElementById("statusBadge").textContent = "Connecting...";
        switchTab('home');
        startListeners();
    } else {
        document.getElementById("authBox").style.display = "flex";
        document.getElementById("mainContent").style.display = "none";
        document.getElementById("bottomNav").style.display = "none";
    }
});

function startListeners() {
    onValue(ref(db, "/lastSeen"), () => {
        lastSeenTime = Date.now();
        document.getElementById("statusBadge").className = "status-badge online";
        document.getElementById("statusBadge").textContent = "Online";
    });
    setInterval(() => {
        if (Date.now() - lastSeenTime > 15000) {
            document.getElementById("statusBadge").className = "status-badge offline";
            document.getElementById("statusBadge").textContent = "Offline";
        }
    }, 1000);

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
            updateMasterButtonUI();
        });
        onValue(ref(db, "/label" + idx), (snap) => {
            if(snap.val()) {
                const el = document.getElementById("name_gpio" + idx);
                const input = document.getElementById("rename" + idx);
                if(el) el.textContent = snap.val();
                if(input && document.activeElement !== input) input.value = snap.val();
                updateDropdown();
                renderList();
            }
        });
        onValue(ref(db, "/timeOn" + idx), (snap) => { activeTimers["timeOn"+idx] = snap.val(); renderList(); });
        onValue(ref(db, "/timeOff" + idx), (snap) => { activeTimers["timeOff"+idx] = snap.val(); renderList(); });
    }

    document.querySelectorAll(".gpio-button:not(.master-style)").forEach((btn) => {
        btn.onclick = () => {
            const key = btn.dataset.gpio;
            const newState = btn.classList.contains("on") ? 0 : 1;
            set(ref(db, "/" + key), newState);
        };
    });
}

function updateMasterButtonUI() {
    const masterStatus = document.getElementById("masterStatus");
    if(!masterStatus) return;
    let anyOn = false;
    for(let i=1; i<=6; i++) {
        const btn = document.getElementById("gpio" + i + "Btn");
        if(btn && btn.classList.contains("on")) { anyOn = true; break; }
    }
    masterStatus.textContent = anyOn ? "ALL OFF" : "ALL ON";
}

// Utils
window.saveNameManually = function(id) {
    const input = document.getElementById("rename" + id);
    if(input.value && input.value.trim() !== "") set(ref(db, "/label" + id), input.value);
};

function populateTimeSelects() {
    const h = document.getElementById("schedHour");
    const m = document.getElementById("schedMinute");
    if(!h || !m) return;
    for(let i=1; i<=12; i++) { let v=i<10?"0"+i:i; let o=document.createElement("option"); o.value=v; o.text=v; h.add(o); }
    for(let i=0; i<60; i++) { let v=i<10?"0"+i:i; let o=document.createElement("option"); o.value=v; o.text=v; m.add(o); }
}

function updateDropdown() {
    const s = document.getElementById("schedDeviceSelect");
    if(!s) return;
    const curr = s.value; s.innerHTML = "";
    for(let i=1; i<=6; i++) {
        let name = document.getElementById("name_gpio"+i)?.textContent || "SW "+i;
        let o = document.createElement("option"); o.value = i; o.text = name; s.add(o);
    }
    s.value = curr;
}

function addItem(c, i, act, time, name) {
    const color = act === 'On' ? '#00e676' : '#ff1744';
    c.innerHTML += `
    <div class="schedule-item">
        <button onclick="window.delT(${i}, '${act}')" class="del-btn"><i class="fas fa-trash"></i></button>
        <i class="fas fa-clock" style="font-size: 24px; color: ${color}; margin-bottom: 5px;"></i>
        <b>${name}</b>
        <div class="schedule-info">
            Will turn <span style="color:${color};font-weight:bold;">${act.toUpperCase()}</span><br>at <b>${time}</b>
        </div>
    </div>`;
}

function formatTime12(time24) {
    if(!time24) return "";
    let [H, M] = time24.split(":"); H = parseInt(H);
    let ampm = H >= 12 ? "PM" : "AM"; H = H % 12; H = H ? H : 12;
    return `${H < 10 ? "0"+H : H}:${M} ${ampm}`;
}

function renderList() {
    const c = document.getElementById("scheduleListContainer"); if(!c) return;
    c.innerHTML = "";
    for(let i=1; i<=6; i++) {
        let n = document.getElementById("name_gpio"+i)?.textContent || "SW "+i;
        if(activeTimers["timeOn"+i]) addItem(c, i, "On", formatTime12(activeTimers["timeOn"+i]), n);
        if(activeTimers["timeOff"+i]) addItem(c, i, "Off", formatTime12(activeTimers["timeOff"+i]), n);
    }
}

window.addNewSchedule = function() {
    let d = document.getElementById("schedDeviceSelect").value;
    let a = document.getElementById("schedActionSelect").value;
    let hh = document.getElementById("schedHour").value;
    let mm = document.getElementById("schedMinute").value;
    let ampm = document.getElementById("schedAmPm").value;
    let h = parseInt(hh);
    if(ampm === "PM" && h < 12) h += 12; if(ampm === "AM" && h === 12) h = 0;
    let t = (h<10?"0"+h:h) + ":" + mm;
    set(ref(db, "/time"+a+d), t).then(() => {
        document.getElementById("timerModal").classList.remove("active");
        alert("Timer Set!");
    });
};

window.delT = (i, a) => {
    if(confirm("Delete timer?")) set(ref(db, "/time"+a+i), "");
};

// Modal
const modal = document.getElementById("customModal");
let onConfirm = null;
function showDialog(t, m, cb) { 
    document.getElementById("modalTitle").textContent=t; 
    document.getElementById("modalMessage").textContent=m; 
    onConfirm=cb; 
    modal.classList.add("active"); 
}
document.getElementById("btnCancel").onclick = () => modal.classList.remove("active");
document.getElementById("btnConfirm").onclick = () => { if(onConfirm) onConfirm(); modal.classList.remove("active"); };
