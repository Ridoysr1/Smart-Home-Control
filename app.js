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

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth();
const db = getDatabase(app);

// Global Variables
let deviceNames = ["SW 1", "SW 2", "SW 3", "SW 4", "SW 5", "SW 6"];
let activeTimers = {};
let lastSeenTime = 0;
let tempSelection = { device: "1", action: "On", hour: "12", minute: "00", ampm: "AM" };

// === UI REFS ===
const ui = {
    authBox: document.getElementById("authBox"),
    mainContent: document.getElementById("mainContent"),
    bottomNav: document.getElementById("bottomNav"),
    statusBadge: document.getElementById("statusBadge"),
    authMsg: document.getElementById("authMsg")
};

// ==================================================
// 1. SETUP EVENT LISTENERS (সরাসরি রান হবে)
// ==================================================

// Login Button
const loginBtn = document.getElementById("loginBtn");
if (loginBtn) {
    loginBtn.addEventListener("click", () => {
        const email = document.getElementById("emailField").value;
        const pass = document.getElementById("passwordField").value;
        const msg = document.getElementById("authMsg");

        msg.textContent = "Checking...";
        msg.style.color = "#4fc3f7";

        signInWithEmailAndPassword(auth, email, pass)
            .catch((e) => {
                console.error(e);
                msg.style.color = "#ff1744";
                // ইউজারকে সহজ ভাষায় এরর দেখানো
                if (e.code === 'auth/invalid-email') msg.textContent = "Invalid Email";
                else if (e.code === 'auth/user-not-found') msg.textContent = "User Not Found";
                else if (e.code === 'auth/wrong-password') msg.textContent = "Wrong Password";
                else msg.textContent = "Login Failed";
                
                // মোবাইল ডিবাগিংয়ের জন্য এলার্ট (দরকার হলে আনকমেন্ট করুন)
                // alert(e.message);
            });
    });
}

// Logout Button
const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
        showDialog("Exit", "Logout system?", () => signOut(auth));
    });
}

// Master Button
const masterBtn = document.getElementById("masterBtn");
if (masterBtn) {
    masterBtn.addEventListener("click", () => {
        let anyOn = false;
        for (let i = 1; i <= 6; i++) {
            const btn = document.getElementById("gpio" + i + "Btn");
            if (btn && btn.classList.contains("on")) { anyOn = true; break; }
        }
        const action = anyOn ? "Turn OFF" : "Turn ON";
        const val = anyOn ? 0 : 1;
        showDialog("Master Control", `${action} All Switches?`, () => {
            for (let i = 1; i <= 6; i++) set(ref(db, "/gpio" + i), val);
        });
    });
}

// Modal Triggers
const openRenameBtn = document.getElementById("openRenameBtn");
if (openRenameBtn) openRenameBtn.addEventListener("click", () => document.getElementById("renameModal").classList.add("active"));

const openTimerBtn = document.getElementById("openTimerModalBtn");
if (openTimerBtn) openTimerBtn.addEventListener("click", () => document.getElementById("timerModal").classList.add("active"));

// Close Buttons
document.querySelectorAll(".close-icon").forEach(icon => {
    icon.addEventListener("click", function() {
        this.closest(".modal-overlay").classList.remove("active");
    });
});

// Add Schedule Button
const addBtn = document.querySelector(".add-btn");
if (addBtn) addBtn.addEventListener("click", addNewSchedule);

// Theme Toggle
const themeToggle = document.getElementById("themeToggle");
if (themeToggle) {
    if (localStorage.getItem("theme") === "light") {
        document.body.classList.add("light-mode");
        themeToggle.checked = false;
    } else {
        themeToggle.checked = true;
    }
    themeToggle.addEventListener("change", () => {
        if (!themeToggle.checked) {
            document.body.classList.add("light-mode");
            localStorage.setItem("theme", "light");
        } else {
            document.body.classList.remove("light-mode");
            localStorage.setItem("theme", "dark");
        }
    });
}

// Initialize Dropdowns
populateTimeSelects();


// ==================================================
// 2. AUTH STATE (অটোমেটিক রান হবে)
// ==================================================
onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById("authBox").style.display = "none";
        document.getElementById("mainContent").style.display = "block";
        document.getElementById("bottomNav").style.display = "flex";
        document.getElementById("statusBadge").textContent = "Connecting...";
        
        // Load Data
        window.switchTab('home');
        startListeners();
    } else {
        document.getElementById("authBox").style.display = "flex";
        document.getElementById("mainContent").style.display = "none";
        document.getElementById("bottomNav").style.display = "none";
        if (ui.authMsg) ui.authMsg.textContent = "";
    }
});


// ==================================================
// 3. FIREBASE LISTENERS
// ==================================================
function startListeners() {
    // Heartbeat
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

    // 6 Switch Loop
    for (let i = 1; i <= 6; i++) {
        const idx = i;
        onValue(ref(db, "/gpio" + idx), (snap) => {
            const val = snap.val();
            const btn = document.getElementById("gpio" + idx + "Btn");
            const txt = btn ? btn.querySelector(".status") : null;
            if (btn) {
                if (val === 1) { btn.classList.add("on"); if (txt) txt.textContent = "ON"; }
                else { btn.classList.remove("on"); if (txt) txt.textContent = "OFF"; }
            }
            updateMasterButtonUI();
        });
        onValue(ref(db, "/label" + idx), (snap) => {
            if (snap.val()) {
                deviceNames[idx - 1] = snap.val();
                document.getElementById("name_gpio" + idx).textContent = snap.val();
                let input = document.getElementById("rename" + idx);
                if (input && document.activeElement !== input) input.value = snap.val();
                if (tempSelection.device == idx) document.getElementById("displayDevice").textContent = snap.val();
                renderList();
            }
        });
        onValue(ref(db, "/timeOn" + idx), (snap) => { activeTimers["timeOn" + idx] = snap.val(); renderList(); });
        onValue(ref(db, "/timeOff" + idx), (snap) => { activeTimers["timeOff" + idx] = snap.val(); renderList(); });
    }

    // Button Clicks
    document.querySelectorAll(".gpio-button:not(.master-style)").forEach((btn) => {
        btn.onclick = () => {
            const key = btn.dataset.gpio;
            const newState = btn.classList.contains("on") ? 0 : 1;
            set(ref(db, "/" + key), newState);
        };
    });
}

function updateMasterButtonUI() {
    let anyOn = false;
    for (let i = 1; i <= 6; i++) if (document.getElementById("gpio" + i + "Btn").classList.contains("on")) anyOn = true;
    document.getElementById("masterStatus").textContent = anyOn ? "ALL OFF" : "ALL ON";
}


// ==================================================
// 4. GLOBAL FUNCTIONS & UTILS
// ==================================================

// Navigation
window.switchTab = function(tabName) {
    document.querySelectorAll('.page-content').forEach(p => p.classList.remove('active-page'));
    const target = document.getElementById(tabName + 'Page');
    if (target) target.classList.add('active-page');
    const radio = document.getElementById('tab-' + tabName);
    if (radio) radio.checked = true;
};

// Popup Selection Logic
window.openSelection = function(type) {
    const modal = document.getElementById("selectionModal");
    const container = document.getElementById("selectionListContainer");
    container.innerHTML = "";
    modal.classList.add("active");

    let options = [];
    if (type === 'device') options = deviceNames.map((n, i) => ({ val: (i + 1).toString(), text: n }));
    else if (type === 'action') options = [{ val: "On", text: "Turn ON" }, { val: "Off", text: "Turn OFF" }];
    else if (type === 'hour') for (let i = 1; i <= 12; i++) options.push({ val: (i < 10 ? "0" + i : i).toString(), text: (i < 10 ? "0" + i : i).toString() });
    else if (type === 'minute') for (let i = 0; i < 60; i++) options.push({ val: (i < 10 ? "0" + i : i).toString(), text: (i < 10 ? "0" + i : i).toString() });
    else if (type === 'ampm') options = [{ val: "AM", text: "AM" }, { val: "PM", text: "PM" }];

    options.forEach(opt => {
        const div = document.createElement("div");
        div.className = "select-item";
        if (tempSelection[type] == opt.val) div.classList.add("selected");
        div.textContent = opt.text;
        div.onclick = () => {
            tempSelection[type] = opt.val;
            if (type === 'device') document.getElementById("displayDevice").textContent = opt.text;
            else if (type === 'action') document.getElementById("displayAction").textContent = opt.text;
            else if (type === 'hour') document.getElementById("displayHour").textContent = opt.text;
            else if (type === 'minute') document.getElementById("displayMinute").textContent = opt.text;
            else if (type === 'ampm') document.getElementById("displayAmPm").textContent = opt.text;
            modal.classList.remove("active");
        };
        container.appendChild(div);
    });
};

window.addNewSchedule = function() {
    let d = tempSelection.device;
    let a = tempSelection.action;
    let h = parseInt(tempSelection.hour);
    let m = tempSelection.minute;
    let ap = tempSelection.ampm;

    if (ap === "PM" && h < 12) h += 12;
    if (ap === "AM" && h === 12) h = 0;

    let t = (h < 10 ? "0" + h : h) + ":" + m;
    set(ref(db, "/time" + a + d), t).then(() => {
        document.getElementById("timerModal").classList.remove("active");
        alert("Timer Set!");
    });
};

window.saveNameManually = function(id) {
    const val = document.getElementById("rename" + id).value;
    if (val) set(ref(db, "/label" + id), val);
};

window.closeModal = function(id) {
    document.getElementById(id).classList.remove("active");
};

function populateTimeSelects() {
    // Logic handled by custom divs now, keeping function if needed later
}

function updateDropdown() {
    // Handled by deviceNames array
}

function renderList() {
    const c = document.getElementById("scheduleListContainer");
    if (!c) return;
    c.innerHTML = "";
    for (let i = 1; i <= 6; i++) {
        let n = deviceNames[i - 1] || "SW " + i;
        if (activeTimers["timeOn" + i]) addItem(c, i, "On", activeTimers["timeOn" + i], n);
        if (activeTimers["timeOff" + i]) addItem(c, i, "Off", activeTimers["timeOff" + i], n);
    }
}

function addItem(c, i, act, time, name) {
    let [H, M] = time.split(":"); H = parseInt(H);
    let ampm = H >= 12 ? "PM" : "AM"; H = H % 12; H = H ? H : 12;
    let niceTime = (H < 10 ? "0" + H : H) + ":" + M + " " + ampm;
    let color = act === "On" ? "#00e676" : "#ff1744";

    c.innerHTML += `
    <div class="schedule-item">
        <div class="schedule-info">
            <b>${name}</b>
            <span>Will turn <span style="color:${color};font-weight:bold">${act.toUpperCase()}</span> at <b>${niceTime}</b></span>
        </div>
        <button onclick="window.delT(${i}, '${act}')" class="del-btn"><i class="fas fa-trash-alt"></i></button>
    </div>`;
}

window.delT = (i, a) => {
    if (confirm("Delete timer?")) set(ref(db, "/time" + a + i), "");
};

// Modal
const modal = document.getElementById("customModal");
let onConfirm = null;
function showDialog(t, m, cb) {
    document.getElementById("modalTitle").textContent = t;
    document.getElementById("modalMessage").textContent = m;
    onConfirm = cb;
    modal.classList.add("active");
}
document.getElementById("btnCancel").onclick = () => modal.classList.remove("active");
document.getElementById("btnConfirm").onclick = () => { if (onConfirm) onConfirm(); modal.classList.remove("active"); };
