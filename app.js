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

// Global Variables
let deviceNames = ["SW 1", "SW 2", "SW 3", "SW 4", "SW 5", "SW 6"];
let activeTimers = {};
let lastSeenTime = 0;

// === EVENT LISTENERS (Safe Load) ===
document.addEventListener("DOMContentLoaded", () => {
    
    // Login
    const loginBtn = document.getElementById("loginBtn");
    if(loginBtn) {
        loginBtn.addEventListener("click", async () => {
            const email = document.getElementById("emailField").value;
            const pass = document.getElementById("passwordField").value;
            const msg = document.getElementById("authMsg");
            msg.textContent = "Logging in..."; msg.style.color = "#4fc3f7";
            try { await signInWithEmailAndPassword(auth, email, pass); } 
            catch (e) { msg.textContent = "Error: " + e.code; msg.style.color = "#ff1744"; }
        });
    }

    // Logout
    const logoutBtn = document.getElementById("logoutBtn");
    if(logoutBtn) logoutBtn.addEventListener("click", () => showDialog("Exit", "Logout system?", () => signOut(auth)));

    // Master Button
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

    // Add Schedule
    const addBtn = document.querySelector(".add-btn");
    if(addBtn) addBtn.addEventListener("click", addNewSchedule);

    // Initial Loads
    populateTimeSelects();
    loadTheme();
});

// === NAVIGATION ===
window.switchTab = function(tabName) {
    document.querySelectorAll('.page-content').forEach(p => p.classList.remove('active-page'));
    const target = document.getElementById(tabName + 'Page');
    if(target) target.classList.add('active-page');
    const radio = document.getElementById('tab-' + tabName);
    if(radio) radio.checked = true;
};

// === RENAME MODAL LOGIC ===
const renameModal = document.getElementById("renameModal");
window.openRenameModal = function() { renameModal.classList.add("active"); };
window.closeRenameModal = function() { renameModal.classList.remove("active"); };

window.saveNameManually = function(id) {
    const input = document.getElementById("rename" + id);
    const btn = input.nextElementSibling;
    if(input.value && input.value.trim() !== "") {
        set(ref(db, "/label" + id), input.value).then(() => {
            btn.style.background = "#00c853"; btn.innerHTML = "<i class='fas fa-check'></i>";
            setTimeout(() => { btn.style.background = "#4e54c8"; btn.innerHTML = "<i class='fas fa-save'></i>"; }, 1500);
        });
    }
};

// === AUTH STATE ===
onAuthStateChanged(auth, (user) => {
    const authBox = document.getElementById("authBox");
    const mainContent = document.getElementById("mainContent");
    const bottomNav = document.getElementById("bottomNav");
    const badge = document.getElementById("statusBadge");

    if (user) {
        authBox.style.display = "none";
        mainContent.style.display = "block";
        bottomNav.style.display = "flex";
        badge.textContent = "Connecting...";
        switchTab('home');
        startListeners();
    } else {
        authBox.style.display = "flex";
        mainContent.style.display = "none";
        bottomNav.style.display = "none";
    }
});

// === FIREBASE LISTENERS ===
function startListeners() {
    const badge = document.getElementById("statusBadge");
    
    // Heartbeat
    onValue(ref(db, "/lastSeen"), () => {
        lastSeenTime = Date.now();
        badge.className = "status-badge online"; badge.textContent = "Online";
    });
    setInterval(() => {
        if (Date.now() - lastSeenTime > 15000) {
            badge.className = "status-badge offline"; badge.textContent = "Offline";
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
            updateMasterButtonUI();
        });
        // Label
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
        // Timer
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

// === UTILS ===
function loadTheme() {
    const themeToggle = document.getElementById("themeToggle");
    if(!themeToggle) return;
    if(localStorage.getItem("theme") === "light") {
        document.body.classList.add("light-mode"); themeToggle.checked = false;
    } else {
        themeToggle.checked = true;
    }
    themeToggle.addEventListener("change", () => {
        if(!themeToggle.checked) { document.body.classList.add("light-mode"); localStorage.setItem("theme", "light"); }
        else { document.body.classList.remove("light-mode"); localStorage.setItem("theme", "dark"); }
    });
}

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

function formatTime12(time24) {
    if(!time24) return "";
    let [H, M] = time24.split(":"); H = parseInt(H);
    let ampm = H >= 12 ? "PM" : "AM";
    H = H % 12; H = H ? H : 12;
    return `${H < 10 ? "0"+H : H}:${M} ${ampm}`;
}

function renderList() {
    const c = document.getElementById("scheduleListContainer");
    if(!c) return;
    c.innerHTML = "";
    let has = false;
    for(let i=1; i<=6; i++) {
        let n = document.getElementById("name_gpio"+i)?.textContent || "SW "+i;
        if(activeTimers["timeOn"+i]) { addItem(c, i, "On", formatTime12(activeTimers["timeOn"+i]), n); has=true; }
        if(activeTimers["timeOff"+i]) { addItem(c, i, "Off", formatTime12(activeTimers["timeOff"+i]), n); has=true; }
    }
    if(!has) c.innerHTML = "<div style='color:#aaa;text-align:center;margin-top:20px;font-size:13px'>No active timers</div>";
}

function addItem(c, i, act, time, name) {
    c.innerHTML += `<div class="schedule-item"><div><b>${name}</b> <span style="font-size:12px;display:block;margin-top:2px">will turn <span style="color:${act=='On'?'#00e676':'#ff1744'};font-weight:bold">${act.toUpperCase()}</span> at ${time}</span></div><button onclick="window.delT(${i}, '${act}')" class="del-btn"><i class="fas fa-trash"></i></button></div>`;
}

function addNewSchedule() {
    let d = document.getElementById("schedDeviceSelect").value;
    let a = document.getElementById("schedActionSelect").value;
    let hh = document.getElementById("schedHour").value;
    let mm = document.getElementById("schedMinute").value;
    let ampm = document.getElementById("schedAmPm").value;
    let h = parseInt(hh);
    if(ampm === "PM" && h < 12) h = h + 12; if(ampm === "AM" && h === 12) h = 0;
    let t = (h<10?"0"+h:h) + ":" + mm;
    set(ref(db, "/time"+a+d), t).then(()=>alert("Timer Set!")).catch(e=>alert(e.message));
}

// Global scope
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
