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

// --- DOM ELEMENTS ---
const ui = {
    authBox: document.getElementById("authBox"),
    mainContent: document.getElementById("mainContent"),
    bottomNav: document.getElementById("bottomNav"),
    statusBadge: document.getElementById("statusBadge"),
    authMsg: document.getElementById("authMsg")
};

let deviceNames = ["SW 1", "SW 2", "SW 3", "SW 4", "SW 5", "SW 6"];
let activeTimers = {};
let lastSeenTime = 0;

// --- LOGIN LOGIC ---
document.getElementById("loginBtn").addEventListener("click", () => {
    const email = document.getElementById("emailField").value;
    const pass = document.getElementById("passwordField").value;
    
    ui.authMsg.style.color = "#4fc3f7";
    ui.authMsg.textContent = "Logging in...";

    signInWithEmailAndPassword(auth, email, pass)
        .catch((error) => {
            console.error(error);
            ui.authMsg.style.color = "#ff1744";
            // ইউজারকে সঠিক কারণ দেখানো হবে
            if(error.code === 'auth/invalid-email') ui.authMsg.textContent = "Invalid Email!";
            else if(error.code === 'auth/wrong-password') ui.authMsg.textContent = "Wrong Password!";
            else if(error.code === 'auth/user-not-found') ui.authMsg.textContent = "User not found!";
            else ui.authMsg.textContent = "Login Failed!";
        });
});

document.getElementById("logoutBtn").onclick = () => {
    showDialog("Exit", "Logout?", () => signOut(auth));
};

// --- AUTH STATE ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        ui.authBox.style.display = "none";
        ui.mainContent.style.display = "block";
        ui.bottomNav.style.display = "flex";
        ui.statusBadge.textContent = "Connecting...";
        window.switchTab('home');
        startListeners();
    } else {
        ui.authBox.style.display = "flex";
        ui.mainContent.style.display = "none";
        ui.bottomNav.style.display = "none";
        ui.authMsg.textContent = "";
    }
});

// --- NAVIGATION ---
window.switchTab = function(tabName) {
    document.querySelectorAll('.page-content').forEach(p => p.classList.remove('active-page'));
    document.getElementById(tabName + 'Page').classList.add('active-page');
    document.getElementById('tab-' + tabName).checked = true;
};

// --- MASTER SWITCH ---
const masterBtn = document.getElementById("masterBtn");
const masterStatus = document.getElementById("masterStatus");

masterBtn.onclick = () => {
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
};

function updateMasterButton() {
    let anyOn = false;
    for(let i=1; i<=6; i++) {
        const btn = document.getElementById("gpio" + i + "Btn");
        if(btn && btn.classList.contains("on")) { anyOn = true; break; }
    }
    masterStatus.textContent = anyOn ? "ALL OFF" : "ALL ON";
}

// --- FIREBASE DATA ---
function startListeners() {
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

    document.querySelectorAll(".gpio-button:not(.master-style)").forEach((btn) => {
        btn.onclick = () => {
            const key = btn.dataset.gpio;
            const newState = btn.classList.contains("on") ? 0 : 1;
            set(ref(db, "/" + key), newState);
        };
    });
}

// --- SETTINGS ---
window.saveName = function(id, newName) {
    if(newName && newName.trim() !== "") set(ref(db, "/label" + id), newName);
};

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
    for(let i=1; i<=6; i++) {
        let n = document.getElementById("name_gpio"+i)?.textContent || "SW "+i;
        let o = document.createElement("option"); o.value = i; o.text = n; s.add(o);
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
    c.innerHTML += `<div class="schedule-item"><div><b>${name}</b> <span style="font-size:12px;display:block">will turn <span style="color:${act=='On'?'#00e676':'#ff1744'}">${act.toUpperCase()}</span> at ${time}</span></div><button onclick="window.delT(${i}, '${act}')" class="del-btn"><i class="fas fa-trash"></i></button></div>`;
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
    set(ref(db, "/time"+a+d), t).then(()=>alert("Timer set!")).catch(e=>alert(e.message));
};

window.delT = (i, a) => {
    if(confirm("Delete timer?")) set(ref(db, "/time"+a+i), "");
};

// --- MODAL LOGIC ---
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
