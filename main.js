// ========== KAMAONOW USER APP WITH SETTINGS ==========
console.log("🚀 KamaoNow Loading...");

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    doc, 
    setDoc, 
    getDoc, 
    getDocs, 
    query, 
    where, 
    updateDoc, 
    increment, 
    arrayUnion, 
    onSnapshot, 
    addDoc 
} from "https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyBsny5xLAKyeFWBf1De4WKTfuNuzy5UIoA",
    authDomain: "kamaonow-bf070.firebaseapp.com",
    projectId: "kamaonow-bf070",
    storageBucket: "kamaonow-bf070.firebasestorage.app",
    messagingSenderId: "107731628902",
    appId: "1:107731628902:web:b9d36a0698995385124ea7"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let currentUser = null;
let selectedMethod = null;
let currentFilter = 'all';
let allWithdrawals = [];

// ========== APP SETTINGS (FROM ADMIN) ==========
let appSettings = {
    minWithdrawal: 200,
    dailyTaskLimit: 20,
    referralCommission: 15,
    welcomeBonus: 100
};

async function loadSettings() {
    try {
        const settingsRef = doc(db, 'settings', 'app');
        const settingsSnap = await getDoc(settingsRef);
        
        if (settingsSnap.exists()) {
            const data = settingsSnap.data();
            appSettings.minWithdrawal = data.minWithdrawal || 200;
            appSettings.dailyTaskLimit = data.dailyTaskLimit || 20;
            appSettings.referralCommission = data.referralCommission || 15;
            appSettings.welcomeBonus = data.welcomeBonus || 100;
        }
        console.log("✅ Settings loaded:", appSettings);
        
        // 🔥 UPDATE WITHDRAW PAGE MIN AMOUNT DISPLAY
        updateWithdrawPageSettings();
    } catch (error) {
        console.error("Error loading settings:", error);
    }
}

// 🔥 NEW FUNCTION: Update withdraw page with current settings
function updateWithdrawPageSettings() {
    const minWithdrawLabel = document.querySelector('.withdraw-input label');
    if (minWithdrawLabel) {
        minWithdrawLabel.innerHTML = `Amount (Min ₨${appSettings.minWithdrawal})`;
    }
    const withdrawAmountInput = document.getElementById('withdrawAmount');
    if (withdrawAmountInput) {
        withdrawAmountInput.placeholder = `Min ₨${appSettings.minWithdrawal}`;
        withdrawAmountInput.min = appSettings.minWithdrawal;
    }
}

let appData = {
    balance: 0,
    completedTasks: [],
    referrals: 0,
    streak: 1,
    activities: [],
    tasks: []
};

function showToast(msg, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.className = `toast show ${type}`;
    setTimeout(() => toast.classList.remove('show'), 3000);
}

function showLoading(msg) {
    const loader = document.createElement('div');
    loader.id = 'loadingOverlay';
    loader.className = 'loading';
    loader.innerHTML = `<div class="loader"></div><div>${msg}</div>`;
    document.body.appendChild(loader);
}

function hideLoading() {
    const loader = document.getElementById('loadingOverlay');
    if (loader) loader.remove();
}

async function loadTasks() {
    try {
        const snapshot = await getDocs(collection(db, 'tasks'));
        appData.tasks = [];
        snapshot.forEach(doc => {
            const task = doc.data();
            task.id = parseInt(doc.id);
            task.completed = appData.completedTasks?.includes(task.id) || false;
            if (task.active !== false) appData.tasks.push(task);
        });
        renderTasks();
    } catch (error) {
        console.error(error);
        appData.tasks = [];
        renderTasks();
    }
}

function renderTasks() {
    const container = document.getElementById('tasksList');
    if (!container) return;
    
    container.innerHTML = '';
    if (appData.tasks.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:40px;">No tasks available yet.</div>';
        return;
    }
    
    for (let task of appData.tasks) {
        const isCompleted = appData.completedTasks?.includes(task.id);
        const hasLink = task.link && task.link !== "";
        const div = document.createElement('div');
        div.className = `task-item ${isCompleted ? 'completed' : ''}`;
        
        let buttonsHtml = '';
        if (!isCompleted) {
            if (hasLink) {
                buttonsHtml = `
                    <div style="display: flex; gap: 8px;">
                        <a href="${task.link}" target="_blank" style="background: #f59e0b; color: white; text-decoration: none; padding: 8px 15px; border-radius: 20px; font-size: 12px;">Start Offer</a>
                        <button class="task-btn" onclick="completeTask(${task.id}, '${task.name}', ${task.reward})">Complete</button>
                    </div>
                `;
            } else {
                buttonsHtml = `<button class="task-btn" onclick="completeTask(${task.id}, '${task.name}', ${task.reward})">Complete</button>`;
            }
        } else {
            buttonsHtml = '<span style="color:#10b981;"><i class="fas fa-check-circle"></i> Completed</span>';
        }
        
        div.innerHTML = `
            <div style="display: flex; gap: 12px; align-items: center; flex: 1;">
                <i class="fas ${task.icon || 'fa-tasks'}" style="font-size: 24px; color: #667eea;"></i>
                <div style="flex: 1;">
                    <strong>${task.name}</strong>
                    <div style="color:#10b981; font-weight:bold;">+₨ ${task.reward}</div>
                    <small style="color:#666;">${task.description || ''}</small>
                </div>
            </div>
            <div>${buttonsHtml}</div>
        `;
        container.appendChild(div);
    }
}

window.completeTask = async function(taskId, taskName, reward) {
    if (!currentUser) { showToast("Please login first!", "error"); return; }
    if (appData.completedTasks.includes(taskId)) { showToast("Task already completed!", "error"); return; }
    
    const task = appData.tasks.find(t => t.id === taskId);
    const taskLink = task?.link || null;
    
    if (taskLink && taskLink !== "") {
        if (confirm(`Open offer page to complete?`)) {
            window.open(taskLink, '_blank');
            showToast("Complete the offer, then come back and click Complete", "info");
            return;
        }
    }
    
    const proof = prompt(`📸 Task: ${taskName}\n\nPaste your proof:`);
    if (!proof) { showToast("Proof required!", "error"); return; }
    
    showLoading("Submitting...");
    try {
        await addDoc(collection(db, 'task_requests'), {
            userId: currentUser.userId, userName: currentUser.name, taskId, taskName, reward, proof, taskLink,
            status: 'pending', submittedAt: new Date().toISOString()
        });
        showToast("✅ Task submitted! Admin will verify.", "success");
        addActivity(`📝 Submitted "${taskName}" for verification`);
    } catch (error) { showToast("Failed!", "error"); }
    hideLoading();
};

// ========== WITHDRAWAL REQUEST WITH BALANCE DEDUCTION ==========
window.requestWithdrawal = async function() {
    if (!currentUser) { showToast("Please login first!", "error"); return; }
    
    const amount = parseInt(document.getElementById('withdrawAmount')?.value);
    const account = document.getElementById('accountNumber')?.value;
    const method = selectedMethod;
    
    if (!method) { showToast("Select method!", "error"); return; }
    if (!amount || amount < appSettings.minWithdrawal) { 
        showToast(`Minimum withdrawal is ₨${appSettings.minWithdrawal}!`, "error"); 
        return; 
    }
    if (!account) { showToast("Enter account!", "error"); return; }
    if (amount > appData.balance) { showToast("Insufficient balance!", "error"); return; }
    
    showLoading("Submitting...");
    try {
        let methodDisplay = method === 'jazzcash' ? "JazzCash" : method === 'easypaisa' ? "EasyPaisa" : "UPaisa";
        
        // 🔥 SAVE WITHDRAWAL REQUEST
        await addDoc(collection(db, 'withdrawal_requests'), {
            userId: currentUser.userId, userName: currentUser.name, amount, method, methodDisplay, accountNumber: account,
            status: 'pending', requestedAt: new Date().toISOString()
        });
        
        // 🔥 DEDUCT BALANCE IMMEDIATELY
        const userRef = doc(db, 'users', currentUser.userId);
        await updateDoc(userRef, {
            balance: increment(-amount)
        });
        
        // 🔥 UPDATE LOCAL BALANCE
        appData.balance -= amount;
        updateUI();
        
        showToast(`✅ Withdrawal request of ₨${amount} submitted! Balance updated.`, "success");
        addActivity(`💰 Withdrawal request of ₨${amount} submitted. New balance: ₨${appData.balance}`);
        
        // Clear form
        document.getElementById('withdrawAmount').value = '';
        document.getElementById('accountNumber').value = '';
        document.querySelectorAll('.method-option').forEach(opt => opt.classList.remove('selected'));
        selectedMethod = null;
        
        // Refresh withdrawal history if open
        if (document.getElementById('withdrawHistoryScreen').classList.contains('active')) {
            loadWithdrawalHistory();
        }
        
    } catch (error) { 
        console.error(error);
        showToast("Failed to submit request!", "error"); 
    }
    hideLoading();
};

window.selectWithdrawalMethod = function(method) {
    selectedMethod = method;
    document.querySelectorAll('.method-option').forEach(opt => opt.classList.remove('selected'));
    event.currentTarget.classList.add('selected');
};

async function loadWithdrawalHistory() {
    if (!currentUser) return;
    try {
        const q = query(collection(db, 'withdrawal_requests'), where('userId', '==', currentUser.userId));
        const snapshot = await getDocs(q);
        allWithdrawals = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            allWithdrawals.push({
                id: doc.id, amount: data.amount, method: data.method, methodDisplay: data.methodDisplay,
                accountNumber: data.accountNumber, status: data.status || 'pending',
                requestedAt: data.requestedAt, date: data.requestedAt ? new Date(data.requestedAt).toLocaleDateString() : '-'
            });
        });
        allWithdrawals.sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt));
        renderWithdrawals();
    } catch (error) { console.error(error); }
}

window.filterWithdrawals = function(status) {
    currentFilter = status;
    document.querySelectorAll('.history-tab').forEach(tab => {
        tab.classList.remove('active');
        if (tab.textContent.toLowerCase() === status) tab.classList.add('active');
    });
    renderWithdrawals();
};

function renderWithdrawals() {
    const container = document.getElementById('withdrawalsList');
    if (!container) return;
    let filtered = allWithdrawals;
    if (currentFilter !== 'all') filtered = allWithdrawals.filter(w => w.status === currentFilter);
    if (filtered.length === 0) {
        container.innerHTML = '<div class="empty-state">No withdrawal requests found</div>';
        return;
    }
    container.innerHTML = filtered.map(w => `
        <div class="withdrawal-card ${w.status}">
            <div class="withdrawal-header">
                <span class="withdrawal-amount">₨ ${w.amount}</span>
                <span class="withdrawal-status status-${w.status}">${w.status}</span>
            </div>
            <div class="withdrawal-details">
                <p><i class="fas fa-credit-card"></i> ${w.methodDisplay || w.method}</p>
                <p><i class="fas fa-user"></i> Account: ${w.accountNumber}</p>
                <p><i class="fas fa-calendar"></i> ${w.date}</p>
            </div>
        </div>
    `).join('');
}

window.claimDailyBonus = async function() {
    if (!currentUser) return;
    const lastBonus = localStorage.getItem('lastBonus_' + currentUser.userId);
    const today = new Date().toDateString();
    if (lastBonus === today) { showToast("Already claimed today!", "error"); return; }
    const bonus = 20 + (appData.streak * 2);
    showLoading("Claiming...");
    await new Promise(r => setTimeout(r, 1000));
    try {
        const userRef = doc(db, 'users', currentUser.userId);
        await updateDoc(userRef, { balance: increment(bonus), streak: increment(1) });
        appData.balance += bonus; appData.streak++;
        localStorage.setItem('lastBonus_' + currentUser.userId, today);
        updateUI(); addActivity(`🎁 Claimed daily bonus of ₨${bonus}`);
        showToast(`🎁 +₨${bonus} bonus!`, "success");
    } catch (error) { showToast("Failed!", "error"); }
    hideLoading();
};

window.watchAd = async function(type) {
    if (!currentUser) { showToast("Please login first!", "error"); return; }
    showToast("Ad system coming soon!", "info");
};

async function checkPendingItems() {
    if (!currentUser) return;
    try {
        const q = query(collection(db, 'task_requests'), where('userId', '==', currentUser.userId), where('status', '==', 'approved'));
        const snapshot = await getDocs(q);
        for (const docSnap of snapshot.docs) {
            const data = docSnap.data();
            if (!appData.completedTasks.includes(data.taskId)) {
                const userRef = doc(db, 'users', currentUser.userId);
                await updateDoc(userRef, {
                    balance: increment(data.reward),
                    completedTasks: arrayUnion(data.taskId)
                });
                appData.balance += data.reward;
                appData.completedTasks.push(data.taskId);
                addActivity(`✅ Task "${data.taskName}" approved! +₨${data.reward}`);
                updateUI(); loadTasks();
            }
        }
    } catch (error) { console.error(error); }
}

function updateUI() {
    document.getElementById('mainBalance').innerText = appData.balance;
    document.getElementById('withdrawBalance').innerText = appData.balance;
    document.getElementById('streakDays').innerText = appData.streak;
    document.getElementById('referralsCount').innerText = appData.referrals;
    document.getElementById('todayTasks').innerText = appData.completedTasks.length;
    document.getElementById('referTotal').innerText = appData.referrals;
    document.getElementById('referEarned').innerText = `₨ ${appData.referrals * 25}`;
}

function addActivity(message) {
    const activity = { id: Date.now(), message, time: new Date().toLocaleTimeString() };
    appData.activities.unshift(activity);
    if (appData.activities.length > 20) appData.activities.pop();
    updateActivities();
}

function updateActivities() {
    const container = document.getElementById('activityList');
    if (!container) return;
    if (appData.activities.length === 0) { container.innerHTML = '<div style="text-align:center; padding:20px;">No activities yet</div>'; return; }
    container.innerHTML = appData.activities.map(a => `<div class="activity-item"><i class="fas fa-history"></i><div><div>${a.message}</div><small>${a.time}</small></div></div>`).join('');
}

// ========== LOAD USER DATA WITH SETTINGS ==========
async function loadUserData(userId) {
    try {
        // 🔥 LOAD SETTINGS FIRST
        await loadSettings();
        
        const userRef = doc(db, 'users', userId);
        const docSnap = await getDoc(userRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            appData.balance = data.balance || 0;
            appData.completedTasks = data.completedTasks || [];
            appData.referrals = data.referrals || 0;
            appData.streak = data.streak || 1;
        }
        updateUI(); await loadTasks(); checkPendingItems();
    } catch (error) { console.error(error); }
}

window.loginUser = async function() {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    if (!email || !password) { showToast("Please fill all fields!", "error"); return; }
    showLoading("Logging in...");
    try {
        const q = query(collection(db, 'users'), where('email', '==', email));
        const snapshot = await getDocs(q);
        if (snapshot.empty) { showToast("User not found!", "error"); hideLoading(); return; }
        let userData = null;
        snapshot.forEach(doc => { userData = doc.data(); });
        if (btoa(password) !== userData.password) { showToast("Wrong password!", "error"); hideLoading(); return; }
        currentUser = userData;
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        await loadUserData(currentUser.userId);
        document.getElementById('authModal').style.display = 'none';
        document.getElementById('appContainer').style.display = 'block';
        document.getElementById('userName').innerText = currentUser.name;
        document.getElementById('referralLink').innerText = `https://kamaonow.com/ref/${currentUser.userId}`;
        showToast(`✅ Welcome back, ${currentUser.name}!`, "success");
    } catch (error) { showToast("Login failed!", "error"); }
    hideLoading();
};

// ========== REGISTER WITH WELCOME BONUS FROM SETTINGS ==========
window.registerUser = async function() {
    const name = document.getElementById('regName').value;
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regPassword').value;
    const confirm = document.getElementById('regConfirmPassword').value;
    if (!name || !email || !password) { showToast("Please fill all fields!", "error"); return; }
    if (password !== confirm) { showToast("Passwords do not match!", "error"); return; }
    if (password.length < 6) { showToast("Password must be at least 6 characters!", "error"); return; }
    showLoading("Creating account...");
    try {
        // Load settings first to get welcome bonus
        await loadSettings();
        
        const q = query(collection(db, 'users'), where('email', '==', email));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) { showToast("Email already registered!", "error"); hideLoading(); return; }
        const userId = 'user_' + Date.now();
        // 🔥 USING appSettings.welcomeBonus
        await setDoc(doc(db, 'users', userId), {
            userId, name, email, password: btoa(password), 
            balance: appSettings.welcomeBonus, 
            completedTasks: [],
            referrals: 0, streak: 1, createdAt: new Date().toISOString(), status: 'active'
        });
        showToast(`✅ Registration successful! Welcome bonus: ₨${appSettings.welcomeBonus}`, "success");
        switchAuthTab('login');
        document.getElementById('regName').value = '';
        document.getElementById('regEmail').value = '';
        document.getElementById('regPassword').value = '';
        document.getElementById('regConfirmPassword').value = '';
    } catch (error) { showToast("Registration failed!", "error"); }
    hideLoading();
};

window.logoutUser = function() {
    localStorage.removeItem('currentUser');
    currentUser = null;
    document.getElementById('authModal').style.display = 'flex';
    document.getElementById('appContainer').style.display = 'none';
    showToast("Logged out successfully!", "success");
};

window.navigateTo = function(screen) {
    const screens = ['home', 'tasks', 'earn', 'withdraw', 'withdrawHistory', 'refer'];
    screens.forEach(s => { const el = document.getElementById(`${s}Screen`); if (el) el.classList.remove('active'); });
    document.getElementById(`${screen}Screen`).classList.add('active');
    if (screen === 'withdrawHistory') loadWithdrawalHistory();
    if (screen === 'withdraw') updateWithdrawPageSettings(); // 🔥 Update withdraw page settings
    const navItems = document.querySelectorAll('.nav-item');
    const map = { home: 0, tasks: 1, earn: 2, withdraw: 3, withdrawHistory: 4, refer: 5 };
    navItems.forEach((item, i) => { if (i === map[screen]) item.classList.add('active'); else item.classList.remove('active'); });
};

window.switchAuthTab = function(tab) {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const tabs = document.querySelectorAll('.tab-btn');
    if (tab === 'login') {
        loginForm.classList.add('active'); registerForm.classList.remove('active');
        tabs[0].classList.add('active'); tabs[1].classList.remove('active');
    } else {
        loginForm.classList.remove('active'); registerForm.classList.add('active');
        tabs[0].classList.remove('active'); tabs[1].classList.add('active');
    }
};

window.copyReferralLink = function() {
    if (!currentUser) { showToast("Please login first!", "error"); return; }
    navigator.clipboard.writeText(`https://kamaonow.com/ref/${currentUser.userId}`);
    showToast("Referral link copied!", "success");
};

const savedUser = localStorage.getItem('currentUser');
if (savedUser) {
    currentUser = JSON.parse(savedUser);
    document.getElementById('authModal').style.display = 'none';
    document.getElementById('appContainer').style.display = 'block';
    document.getElementById('userName').innerText = currentUser.name;
    loadUserData(currentUser.userId);
}

setInterval(() => { if (currentUser) checkPendingItems(); }, 30000);
console.log("✅ KamaoNow Ready with Settings Support!");