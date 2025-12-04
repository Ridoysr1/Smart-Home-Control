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

// ... Global Vars ...
let deviceNames = ["SW 1", "SW 2", "SW 3", "SW 4", "SW 5", "SW 6"];
let activeTimers = {};
let lastSeenTime = 0;

// ... DOM Loaded ...
document.addEventListener("DOMContentLoaded", () => {
    // LOGIN
    const loginBtn = document.getElementById("loginBtn");
    if(loginBtn) {
        loginBtn.addEventListener("click", async () => {
            const email = document.getElementById("emailField").value;
            const pass = document.getElementById("passwordField").value;
            try { await signInWithEmailAndPassword(auth, email, pass); } catch (e) { alert(e.message); }
        });
    }

    // LOGOUT
    const logoutBtn = document.getElementById("logoutBtn");
    if(logoutBtn) logoutBtn.addEventListener("click", () => showDialog("Exit", "Logout system?", () => signOut(auth)));

    // RENAME MODAL TRIGGER (Settings Page)
    const openRenameBtn = document.getElementById("openRenameBtn");
    if(openRenameBtn) openRenameBtn.addEventListener("click", () => document.getElementById("renameModal").classList.add("active"));

    // TIMER MODAL TRIGGER (Timer Page)
    const openTimerModalBtn = document.getElementById("openTimerModalBtn");
    if(openTimerModalBtn) openTimerModalBtn.addEventListener("click", () => document.getElementById("timerModal").classList.add("active"));

    // Theme Toggle
    const themeToggle = document.getElementById("themeToggle");
    if(themeToggle) {
        if(localStorage.getItem("theme") === "light") { document.body.classList.add("light-mode"); themeToggle.checked = false; }
        else { themeToggle.checked = true; }
        themeToggle.addEventListener("change", () => {
            if(!themeToggle.checked) { document.body.classList.add("light-mode"); localStorage.setItem("theme", "light"); }
            else { document.body.classList.remove("light-mode"); localStorage.setItem("theme", "dark"); }
        });
    }

    // Utils
    populateTimeSelects();
});

// ... SHARED FUNCTIONS ...
window.switchTab = function(tabName) {
    document.querySelectorAll('.page-content').forEach(p => p.classList.remove('active-page'));
    document.getElementById(tabName + 'Page').classList.add('active-page');
    document.getElementById('tab-' + tabName).checked = true;
};

// ... MODAL CLOSE HELPER ...
window.closeModal = function(id) {
    document.getElementById(id).classList.remove("active");
};

// ... FIREBASE LISTENERS & LOGIC (Same as before) ...
// (এই অংশটি অপরিবর্তিত থাকবে)
onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById("authBox").style.display = "none";
        document.getElementById("mainContent").style.display = "block";
        document.getElementById("bottomNav").style.display = "flex";
        window.switchTab('home'); startListeners();
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
    // ... Other listeners ...
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
        });
        onValue(ref(db, "/label" + idx), (snap) => {
            if(snap.val()) {
                document.getElementById("name_gpio" + idx).textContent = snap.val();
                let input = document.getElementById("rename" + idx);
                if(input && document.activeElement !== input) input.value = snap.val();
                updateDropdown();
                renderList();
            }
        });
        onValue(ref(db, "/timeOn" + idx), (snap) => { activeTimers["timeOn"+idx] = snap.val(); renderList(); });
        onValue(ref(db, "/timeOff" + idx), (snap) => { activeTimers["timeOff"+idx] = snap.val(); renderList(); });
    }
    // Button Clicks
    document.querySelectorAll(".gpio-button:not(.master-style)").forEach((btn) => {
        btn.onclick = () => {
            const key = btn.dataset.gpio;
            const newState = btn.classList.contains("on") ? 0 : 1;
            set(ref(db, "/" + key), newState);
        };
    });
    // Master
    document.getElementById("masterBtn").onclick = () => {
        let anyOn = false;
        for(let i=1; i<=6; i++) if(document.getElementById("gpio"+i+"Btn").classList.contains("on")) anyOn = true;
        const val = anyOn ? 0 : 1;
        showDialog("Master", anyOn?"Turn OFF All?":"Turn ON All?", () => { for(let i=1; i<=6; i++) set(ref(db, "/gpio"+i), val); });
    };
}

// ... UTILS (Time, Dropdown, Rename) ...
window.saveNameManually = function(id) {
    const val = document.getElementById("rename" + id).value;
    if(val) set(ref(db, "/label" + id), val);
};

window.addNewSchedule = function() {
    let d = document.getElementById("schedDeviceSelect").value;
    let a = document.getElementById("schedActionSelect").value;
    let hh = document.getElementById("schedHour").value;
    let mm = document.getElementById("schedMinute").value;
    let ampm = document.getElementById("schedAmPm").value;
    let h = parseInt(hh);
    if(ampm === "PM" && h < 12) h += 12; if(ampm === "AM" && h === 12) h = 0;
    set(ref(db, "/time"+a+d), (h<10?"0"+h:h)+":"+mm).then(()=>{ window.closeModal('timerModal'); alert("Timer Set!"); });
};

// ... DIALOG ...
const modal = document.getElementById("customModal");
let onConfirm = null;
function showDialog(t, m, cb) { 
    document.getElementById("modalTitle").textContent=t; document.getElementById("modalMessage").textContent=m; onConfirm=cb; modal.classList.add("active"); 
}
document.getElementById("btnCancel").onclick = () => modal.classList.remove("active");
document.getElementById("btnConfirm").onclick = () => { if(onConfirm) onConfirm(); modal.classList.remove("active"); };

function populateTimeSelects() {
    const h = document.getElementById("schedHour"), m = document.getElementById("schedMinute");
    for(let i=1; i<=12; i++) { let o=document.createElement("option"); o.value=(i<10?"0"+i:i); o.text=o.value; h.add(o); }
    for(let i=0; i<60; i++) { let o=document.createElement("option"); o.value=(i<10?"0"+i:i); o.text=o.value; m.add(o); }
}
function updateDropdown() {
    const s = document.getElementById("schedDeviceSelect"); s.innerHTML = "";
    for(let i=1; i<=6; i++) { let o=document.createElement("option"); o.value=i; o.text=document.getElementById("name_gpio"+i).textContent; s.add(o); }
}
function renderList() {
    const c = document.getElementById("scheduleListContainer"); c.innerHTML = "";
    for(let i=1; i<=6; i++) {
        let n = document.getElementById("name_gpio"+i).textContent;
        if(activeTimers["timeOn"+i]) c.innerHTML += getItem(i, "On", activeTimers["timeOn"+i], n);
        if(activeTimers["timeOff"+i]) c.innerHTML += getItem(i, "Off", activeTimers["timeOff"+i], n);
    }
}
function getItem(i, a, t, n) { return `<div class="schedule-item"><div><b>${n}</b> ${a} at ${t}</div><button class="del-btn" onclick="delT(${i},'${a}')"><i class="fas fa-trash"></i></button></div>`; }
window.delT = (i, a) => { if(confirm("Delete?")) set(ref(db, "/time"+a+i), ""); };
