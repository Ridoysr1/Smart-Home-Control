import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getDatabase, ref, set, onValue } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

// --------------------------------------------------------------
//
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

// অ্যাপ ইনিশিয়ালাইজ
const app = initializeApp(firebaseConfig);
const auth = getAuth();
const db = getDatabase(app);

// UI এলিমেন্ট রেফারেন্স
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

// --------------------------------------------------------------
// ২. নেভিগেশন লজিক (ট্যাব চেঞ্জ)
// --------------------------------------------------------------
window.switchTab = function(tabName) {
    // সব পেজ লুকাও
    document.querySelectorAll('.page-content').forEach(p => p.classList.remove('active-page'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

    // সিলেক্ট করা পেজ দেখাও
    const selectedPage = document.getElementById(tabName + 'Page');
    if(selectedPage) selectedPage.classList.add('active-page');
    
    // আইকন কালার আপডেট করো
    const navIndex = tabName === 'home' ? 0 : tabName === 'timer' ? 1 : 2;
    const navItems = document.querySelectorAll('.nav-item');
    if(navItems[navIndex]) navItems[navIndex].classList.add('active');
};

// --------------------------------------------------------------
// ৩. অথেনটিকেশন (লগইন/লগআউট)
// --------------------------------------------------------------
document.getElementById("loginBtn").onclick = async () => {
    const email = document.getElementById("emailField").value;
    const pass = document.getElementById("passwordField").value;
    
    ui.authMsg.style.color = "#4fc3f7";
    ui.authMsg.textContent = "Checking credentials...";

    try { 
        await signInWithEmailAndPassword(auth, email, pass); 
        // সফল হলে onAuthStateChanged হ্যান্ডেল করবে
    }
    catch (e) { 
        ui.authMsg.style.color = "#ff1744";
        ui.authMsg.textContent = "Error: " + e.code; // এরর কোড দেখাবে (যেমন: user-not-found)
        console.error("Login Failed:", e);
    }
};

document.getElementById("logoutBtn").onclick = () => {
    showDialog("Exit System?", "Are you sure you want to log out?", () => signOut(auth));
};

// লগইন স্ট্যাটাস চেক
onAuthStateChanged(auth, (user) => {
    if (user) {
        // লগইন থাকলে
        ui.authBox.style.display = "none";
        ui.mainContent.style.display = "block";
        ui.bottomNav.style.display = "flex";
        ui.statusBadge.textContent = "Connecting...";
        
        window.switchTab('home'); // হোম পেজে নিয়ে যাবে
        startListeners(); // ডেটা লোড শুরু হবে
    } else {
        // লগআউট থাকলে
        ui.authBox.style.display = "flex";
        ui.mainContent.style.display = "none";
        ui.bottomNav.style.display = "none";
        ui.authMsg.textContent = "";
    }
});

// --------------------------------------------------------------
// ৪. সেটিংস (থিম এবং নাম পরিবর্তন)
// --------------------------------------------------------------
const themeToggle = document.getElementById("themeToggle");

// আগের সেভ করা থিম লোড করা
if(localStorage.getItem("theme") === "light") {
    document.body.classList.add("light-mode");
    if(themeToggle) themeToggle.checked = false;
} else {
    if(themeToggle) themeToggle.checked = true; // ডার্ক ডিফল্ট
}

if(themeToggle) {
    themeToggle.addEventListener("change", () => {
        if(!themeToggle.checked) {
            document.body.classList.add("light-mode");
            localStorage.setItem("theme", "light");
        } else {
            document.body.classList.remove("light-mode");
            localStorage.setItem("theme", "dark");
        }
    });
}

// নাম সেভ করার গ্লোবাল ফাংশন
window.saveName = function(id, newName) {
    if(newName && newName.trim() !== "") {
        set(ref(db, "/label" + id), newName);
    }
};

// --------------------------------------------------------------
// ৫. হোম পেজ কন্ট্রোল (বাটন এবং মাস্টার সুইচ)
// --------------------------------------------------------------
const masterBtn = document.getElementById("masterBtn");
const masterStatus = document.getElementById("masterStatus");

if(masterBtn) {
    masterBtn.onclick = () => {
        let anyOn = false;
        // চেক করি কোনো লাইট অন আছে কিনা
        for(let i=1; i<=6; i++) {
            const btn = document.getElementById("gpio" + i + "Btn");
            if(btn && btn.classList.contains("on")) { anyOn = true; break; }
        }
        
        const actionText = anyOn ? "Turn OFF" : "Turn ON";
        const newState = anyOn ? 0 : 1;
        
        showDialog("Master Control", `Are you sure you want to ${actionText} All?`, () => {
            for(let i=1; i<=6; i++) set(ref(db, "/gpio" + i), newState);
        });
    };
}

function updateMasterButton() {
    if(!masterBtn || !masterStatus) return;
    let anyOn = false;
    for(let i=1; i<=6; i++) {
        const btn = document.getElementById("gpio" + i + "Btn");
        if(btn && btn.classList.contains("on")) { anyOn = true; break; }
    }
    masterStatus.textContent = anyOn ? "ALL OFF" : "ALL ON";
}

// --------------------------------------------------------------
// ৬. ফায়ারবেস লিসেনার (লাইভ আপডেট)
// --------------------------------------------------------------
function startListeners() {
    // হার্টবিট চেক (সিস্টেম অনলাইন/অফলাইন)
    onValue(ref(db, "/lastSeen"), () => {
        lastSeenTime = Date.now();
        ui.statusBadge.className = "status-badge online"; 
        ui.statusBadge.textContent = "Online";
    });
    
    // প্রতি ১ সেকেন্ডে অফলাইন চেক
    setInterval(() => {
        if (Date.now() - lastSeenTime > 15000) { // ১৫ সেকেন্ড টাইমআউট
            ui.statusBadge.className = "status-badge offline"; 
            ui.statusBadge.textContent = "Offline";
        }
    }, 1000);

    // ৬টি চ্যানেলের লুপ
    for(let i=1; i<=6; i++) {
        const idx = i;
        
        // ১. সুইচ স্ট্যাটাস (ON/OFF)
        onValue(ref(db, "/gpio" + idx), (snap) => {
            const val = snap.val();
            const btn = document.getElementById("gpio" + idx + "Btn");
            const txt = btn ? btn.querySelector(".status") : null;
            if(btn) {
                if(val === 1) { 
                    btn.classList.add("on"); 
                    if(txt) txt.textContent="ON"; 
                } else { 
                    btn.classList.remove("on"); 
                    if(txt) txt.textContent="OFF"; 
                }
            }
            updateMasterButton();
        });

        // ২. নাম পরিবর্তন (লেবেল)
        onValue(ref(db, "/label" + idx), (snap) => {
            if(snap.val()) {
                // হোম পেজের নাম আপডেট
                const el = document.getElementById("name_gpio" + idx);
                if(el) el.textContent = snap.val();
                
                // সেটিংস পেজের ইনপুট আপডেট
                const input = document.getElementById("rename" + idx);
                if(input && document.activeElement !== input) { // টাইপ করার সময় যেন পরিবর্তন না হয়
                    input.value = snap.val();
                }
                
                updateDropdown();
                renderList();
            }
        });

        // ৩. টাইমার ডেটা
        onValue(ref(db, "/timeOn" + idx), (snap) => { activeTimers["timeOn"+idx] = snap.val(); renderList(); });
        onValue(ref(db, "/timeOff" + idx), (snap) => { activeTimers["timeOff"+idx] = snap.val(); renderList(); });
    }

    // বাটন ক্লিক ইভেন্ট (Home Page)
    document.querySelectorAll(".gpio-button:not(.master-style)").forEach((btn) => {
        btn.onclick = () => {
            const key = btn.dataset.gpio;
            const newState = btn.classList.contains("on") ? 0 : 1;
            set(ref(db, "/" + key), newState);
        };
    });
}

// --------------------------------------------------------------
// ৭. প্রিমিয়াম ডায়লগ বক্স
// --------------------------------------------------------------
const modal = document.getElementById("customModal");
let onConfirm = null;

function showDialog(t, m, cb) { 
    document.getElementById("modalTitle").textContent = t; 
    document.getElementById("modalMessage").textContent = m; 
    onConfirm = cb; 
    modal.classList.add("active"); 
}

// ক্লোজ বাটন লজিক (HTML এ onclick নেই, তাই এখানে অ্যাড করা হলো)
document.getElementById("btnCancel").onclick = () => modal.classList.remove("active");
document.getElementById("btnConfirm").onclick = () => { 
    if(onConfirm) onConfirm(); 
    modal.classList.remove("active"); 
};

// --------------------------------------------------------------
// ৮. টাইমার ফাংশন (ডিজিটাল ক্লক)
// --------------------------------------------------------------
function populateTimeSelects() {
    const h = document.getElementById("schedHour");
    const m = document.getElementById("schedMinute");
    if(!h || !m) return;
    
    // ঘণ্টা ১-১২
    for(let i=1; i<=12; i++) { 
        let v = i < 10 ? "0"+i : i; 
        let o = document.createElement("option"); o.value=v; o.text=v; h.add(o); 
    }
    // মিনিট ০০-৫৯
    for(let i=0; i<60; i++) { 
        let v = i < 10 ? "0"+i : i; 
        let o = document.createElement("option"); o.value=v; o.text=v; m.add(o); 
    }
}
window.addEventListener('load', populateTimeSelects);

function updateDropdown() {
    const s = document.getElementById("schedDeviceSelect");
    if(!s) return;
    const curr = s.value; s.innerHTML = "";
    
    for(let i=1; i<=6; i++) {
        // হোম পেজের নাম থেকে নিয়ে ড্রপডাউন ফিল করা
        let nameEl = document.getElementById("name_gpio"+i);
        let name = nameEl ? nameEl.textContent : "Switch "+i;
        let o = document.createElement("option"); o.value = i; o.text = name; s.add(o); 
    }
    s.value = curr;
}

// 24h থেকে 12h কনভার্টার
function formatTime12(time24) {
    if(!time24) return "";
    let [H, M] = time24.split(":"); H = parseInt(H);
    let ampm = H >= 12 ? "PM" : "AM";
    H = H % 12; H = H ? H : 12;
    return `${H < 10 ? "0"+H : H}:${M} ${ampm}`;
}

// টাইমার লিস্ট তৈরি
function renderList() {
    const c = document.getElementById("scheduleListContainer"); 
    if(!c) return;
    c.innerHTML = "";
    
    let has = false;
    for(let i=1; i<=6; i++) {
        let nameEl = document.getElementById("name_gpio"+i);
        let n = nameEl ? nameEl.textContent : "Switch "+i;
        
        if(activeTimers["timeOn"+i]) { addItem(c, i, "On", formatTime12(activeTimers["timeOn"+i]), n); has=true; }
        if(activeTimers["timeOff"+i]) { addItem(c, i, "Off", formatTime12(activeTimers["timeOff"+i]), n); has=true; }
    }
    if(!has) c.innerHTML = "<div style='color:#aaa;text-align:center;margin-top:20px;font-style:italic;'>No active timers</div>";
}

function addItem(c, i, act, time, name) {
    c.innerHTML += `
    <div class="schedule-item">
        <div>
            <b>${name}</b> 
            <span style="font-size:12px; display:block; margin-top:2px;">
                will turn <span style="color:${act=='On'?'#00e676':'#ff1744'}; font-weight:bold;">${act.toUpperCase()}</span> at ${time}
            </span>
        </div>
        <button onclick="window.delT(${i}, '${act}')" class="del-btn">
            <i class="fas fa-trash"></i>
        </button>
    </div>`;
}

// নতুন টাইমার যোগ করা
window.addNewSchedule = () => {
    let d = document.getElementById("schedDeviceSelect").value;
    let a = document.getElementById("schedActionSelect").value;
    let hh = document.getElementById("schedHour").value;
    let mm = document.getElementById("schedMinute").value;
    let ampm = document.getElementById("schedAmPm").value;
    
    // কনভার্ট টু 24H (ESP32 এর জন্য)
    let h = parseInt(hh);
    if(ampm === "PM" && h < 12) h = h + 12;
    if(ampm === "AM" && h === 12) h = 0;
    
    let t = (h<10 ? "0"+h : h) + ":" + mm;
    
    set(ref(db, "/time"+a+d), t)
    .then(() => alert("Timer set successfully!"))
    .catch(e => alert("Error: " + e.message));
};

// টাইমার ডিলিট করা
window.delT = (i, a) => {
    if(confirm("Delete this timer?")) {
        set(ref(db, "/time"+a+i), "");
    }
};
