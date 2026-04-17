// ========== KAMAONOW USER APP - WITH GOOGLE AUTH & REWARD FIX ==========
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
    addDoc 
} from "https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js";
import { getAuth, signInWithPopup, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js";

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
const auth = getAuth(app);

let currentUser = null;
let selectedMethod = null;
let currentFilter = 'all';
let allWithdrawals = [];
let currentOffer = null;
let isAdPlaying = false;

let appSettings = {
    minWithdrawal: 200,
    dailyTaskLimit: 20,
    referralCommission: 15,
    welcomeBonus: 100,
    adReward: 0.10,
    adCooldown: 30,
    adDailyLimit: 20
};

let appData = {
    balance: 0,
    completedTasks: [],
    referrals: 0,
    streak: 1,
    activities: [],
    tasks: []
};

const ADSTERRA_AD_URL = 'https://www.profitablecpmratenetwork.com/pkkm08akfn?key=ed49d6365e5b18d88893b4e8c985dfe7';

// ========== HELPER FUNCTIONS ==========
function showToast(msg, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.className = `toast show ${type}`;
    setTimeout(() => toast.classList.remove('show'), 3000);
}

function showLoading(msg) {
    let loader = document.getElementById('loadingOverlay');
    if (loader) loader.remove();
    loader = document.createElement('div');
    loader.id = 'loadingOverlay';
    loader.className = 'loading';
    loader.innerHTML = `<div class="loader"></div><div>${msg}</div>`;
    document.body.appendChild(loader);
}

function hideLoading() {
    const loader = document.getElementById('loadingOverlay');
    if (loader) loader.remove();
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
    if (appData.activities.length === 0) { 
        container.innerHTML = '<div>No activities</div>'; 
        return; 
    }
    container.innerHTML = appData.activities.map(a => `<div class="activity-item"><i class="fas fa-history"></i><div><div>${a.message}</div><small>${a.time}</small></div></div>`).join('');
}

function updateUI() {
    const balanceEl = document.getElementById('mainBalance');
    if (balanceEl) balanceEl.innerText = appData.balance.toFixed(2);
    const withdrawBalance = document.getElementById('withdrawBalance');
    if (withdrawBalance) withdrawBalance.innerText = appData.balance.toFixed(2);
    const streakDays = document.getElementById('streakDays');
    if (streakDays) streakDays.innerText = appData.streak;
    const referralsCount = document.getElementById('referralsCount');
    if (referralsCount) referralsCount.innerText = appData.referrals;
    const todayTasks = document.getElementById('todayTasks');
    if (todayTasks) todayTasks.innerText = appData.completedTasks.length;
    const referTotal = document.getElementById('referTotal');
    if (referTotal) referTotal.innerText = appData.referrals;
    updateReferralDisplay();
    updateAdLimitDisplay();
}

function updateReferralDisplay() {
    const commissionSpan = document.getElementById('referCommissionDisplay');
    if (commissionSpan) commissionSpan.innerText = appSettings.referralCommission;
    const referEarnedEl = document.getElementById('referEarned');
    if (referEarnedEl && currentUser) {
        const commissionPerReferral = 25 * (appSettings.referralCommission / 15);
        const totalCommission = appData.referrals * commissionPerReferral;
        referEarnedEl.innerText = `₨ ${Math.floor(totalCommission)}`;
    }
}

function updateAdLimitDisplay() {
    if (!currentUser) return;
    const today = new Date().toDateString();
    const count = parseInt(localStorage.getItem('dailyAdCount_' + currentUser.userId + '_' + today) || 0);
    const limitDisplay = document.getElementById('adLimitInfo');
    if (limitDisplay) {
        limitDisplay.innerText = `Today: ${count}/${appSettings.adDailyLimit} ads | ₨${appSettings.adReward.toFixed(2)} each`;
    }
}

function getTodayAdCount() {
    if (!currentUser) return 0;
    const today = new Date().toDateString();
    return parseInt(localStorage.getItem('dailyAdCount_' + currentUser.userId + '_' + today) || 0);
}

function updateAdCount() {
    if (!currentUser) return;
    const today = new Date().toDateString();
    const current = getTodayAdCount();
    localStorage.setItem('dailyAdCount_' + currentUser.userId + '_' + today, current + 1);
    updateAdLimitDisplay();
}

function updateUISettings() {
    const minWithdrawLabel = document.querySelector('.withdraw-input label');
    if (minWithdrawLabel) minWithdrawLabel.innerHTML = `Amount (Min ₨${appSettings.minWithdrawal})`;
    const withdrawAmountInput = document.getElementById('withdrawAmount');
    if (withdrawAmountInput) {
        withdrawAmountInput.placeholder = `Min ₨${appSettings.minWithdrawal}`;
        withdrawAmountInput.min = appSettings.minWithdrawal;
    }
    updateReferralDisplay();
    updateAdLimitDisplay();
    const adRewardSpan = document.getElementById('adRewardAmount');
    if (adRewardSpan) adRewardSpan.innerText = appSettings.adReward.toFixed(2);
}

// ========== LOAD SETTINGS ==========
async function loadSettings() {
    try {
        const settingsRef = doc(db, 'settings', 'app');
        const settingsSnap = await getDoc(settingsRef);
        if (settingsSnap.exists()) {
            const data = settingsSnap.data();
            appSettings.minWithdrawal = data.minWithdrawal !== undefined ? data.minWithdrawal : 200;
            appSettings.dailyTaskLimit = data.dailyTaskLimit !== undefined ? data.dailyTaskLimit : 20;
            appSettings.referralCommission = data.referralCommission !== undefined ? data.referralCommission : 15;
            appSettings.welcomeBonus = data.welcomeBonus !== undefined ? data.welcomeBonus : 100;
            appSettings.adReward = data.adReward !== undefined ? data.adReward : 0.10;
            appSettings.adCooldown = data.adCooldown !== undefined ? data.adCooldown : 30;
            appSettings.adDailyLimit = data.adDailyLimit !== undefined ? data.adDailyLimit : 20;
        }
        updateUISettings();
    } catch (error) { console.error("Settings load error:", error); }
}

// ========== AD REWARD FUNCTION - FIXED (NO DUPLICATES) ==========
async function completeAdWatchReward(reward) {
    if (!currentUser) {
        console.log("No current user");
        isAdPlaying = false;
        return;
    }
    
    console.log("Adding reward:", reward, "to user:", currentUser.userId);
    
    try {
        const userRef = doc(db, 'users', currentUser.userId);
        
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) {
            console.error("User document not found!");
            showToast("User data error! Please re-login.", "error");
            isAdPlaying = false;
            return;
        }
        
        const currentBalance = userSnap.data()?.balance || 0;
        console.log("Current balance before update:", currentBalance);
        
        const newBalance = currentBalance + reward;
        
        // Direct set value - no increment() to avoid issues
        await updateDoc(userRef, { balance: newBalance });
        
        console.log("Balance updated to:", newBalance);
        
        appData.balance = newBalance;
        localStorage.setItem('lastAd_' + currentUser.userId, Date.now().toString());
        updateAdCount();
        updateUI();
        addActivity(`🎬 Watched ad and earned ₨${reward.toFixed(2)}`);
        showToast(`🎬 +₨${reward.toFixed(2)} earned! Balance: ₨${newBalance.toFixed(2)}`, "success");
        
        console.log("Reward added successfully!");
        
    } catch (error) {
        console.error("Error details:", error);
        showToast("Error adding reward: " + error.message, "error");
    }
    
    isAdPlaying = false;
}

function showAdTimerWithReward(duration, reward, currentCount) {
    let timeLeft = duration;
    const startTime = Date.now();
    let rewardGiven = false;
    
    const overlay = document.createElement('div');
    overlay.id = 'adTimerOverlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: linear-gradient(135deg, #1e293b, #0f172a);
        z-index: 20000;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        color: white;
    `;
    
    overlay.innerHTML = `
        <div style="background: rgba(0,0,0,0.5); border-radius: 20px; padding: 30px; text-align: center; width: 80%; max-width: 300px;">
            <i class="fas fa-play-circle" style="font-size: 60px; color: #f59e0b; margin-bottom: 20px;"></i>
            <h3>Watching Ad</h3>
            <div style="font-size: 48px; font-weight: bold; margin: 20px;" id="adTimerDisplay">${timeLeft}</div>
            <div style="width: 100%; height: 8px; background: rgba(255,255,255,0.2); border-radius: 10px; overflow: hidden;">
                <div id="adProgress" style="width: 0%; height: 100%; background: #10b981;"></div>
            </div>
            <p style="margin-top: 15px;">You'll earn <span style="color: #f59e0b; font-weight: bold;">₨${reward.toFixed(2)}</span> after ad completes</p>
            <p style="margin-top: 5px; font-size: 12px;">Today: ${currentCount + 1}/${appSettings.adDailyLimit} ads watched</p>
        </div>
    `;
    
    document.body.appendChild(overlay);
    
    const timerDisplay = overlay.querySelector('#adTimerDisplay');
    const progressFill = overlay.querySelector('#adProgress');
    
    const interval = setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000;
        timeLeft = Math.max(0, duration - elapsed);
        
        if (timerDisplay) timerDisplay.innerText = Math.ceil(timeLeft);
        if (progressFill) progressFill.style.width = `${(elapsed / duration) * 100}%`;
        
        if (timeLeft <= 0 && !rewardGiven) {
            clearInterval(interval);
            rewardGiven = true;
            overlay.remove();
            completeAdWatchReward(reward);
        }
    }, 100);
}

// ========== WATCH AD FUNCTION ==========
window.watchAd = async function() {
    if (!currentUser) {
        showToast("Please login first!", "error");
        return;
    }
    
    if (isAdPlaying) {
        showToast("Ad is already playing! Please wait.", "error");
        return;
    }
    
    const lastAd = localStorage.getItem('lastAd_' + currentUser.userId);
    const now = Date.now();
    
    if (lastAd && (now - parseInt(lastAd)) < appSettings.adCooldown * 1000) {
        const waitTime = Math.ceil((appSettings.adCooldown * 1000 - (now - parseInt(lastAd))) / 1000);
        showToast(`Wait ${waitTime} seconds before next ad!`, "error");
        return;
    }
    
    const currentCount = getTodayAdCount();
    if (currentCount >= appSettings.adDailyLimit) {
        showToast(`Daily limit reached (${appSettings.adDailyLimit} ads). Come back tomorrow!`, "error");
        return;
    }
    
    const reward = appSettings.adReward;
    isAdPlaying = true;
    
    showAdTimerWithReward(30, reward, currentCount);
    
    try {
        const adWindow = window.open(ADSTERRA_AD_URL, '_blank');
        if (adWindow) {
            showToast("Ad opened! Complete watching to earn reward.", "info");
        } else {
            showToast("Popup blocked! Please allow popups.", "error");
            isAdPlaying = false;
        }
    } catch (error) {
        console.error("Ad error:", error);
        showToast("Failed to open ad.", "error");
        isAdPlaying = false;
    }
};

// ========== GOOGLE SIGN-IN ==========
window.signInWithGoogle = async function() {
    showLoading("Signing in with Google...");
    
    try {
        const provider = new GoogleAuthProvider();
        provider.addScope('profile');
        provider.addScope('email');
        
        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        
        console.log("Google user:", user);
        
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        
        if (!userSnap.exists()) {
            await setDoc(userRef, {
                userId: user.uid,
                name: user.displayName || user.email.split('@')[0],
                email: user.email,
                balance: appSettings.welcomeBonus,
                tasksCompletedToday: 0,
                completedTasks: [],
                referrals: 0,
                streak: 1,
                createdAt: new Date().toISOString(),
                status: 'active',
                authProvider: 'google'
            });
            showToast(`✅ Welcome! Welcome bonus: ₨${appSettings.welcomeBonus}`, "success");
            addActivity(`🎉 New user joined via Google Sign-In`);
        } else {
            showToast(`✅ Welcome back, ${user.displayName || user.email}!`, "success");
        }
        
        currentUser = {
            userId: user.uid,
            name: user.displayName || user.email.split('@')[0],
            email: user.email
        };
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        
        await loadUserData(currentUser.userId);
        
        document.getElementById('authModal').style.display = 'none';
        document.getElementById('appContainer').style.display = 'block';
        document.getElementById('userName').innerText = currentUser.name;
        document.getElementById('referralLink').innerText = `https://kamaonow.dpdns.org/ref/${currentUser.userId}`;
        
    } catch (error) {
        console.error("Google Sign-In Error:", error);
        showToast("Google Sign-In failed: " + error.message, "error");
    }
    
    hideLoading();
};

// ========== LOAD USER DATA ==========
async function loadUserData(userId) {
    try {
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
        updateUI(); 
        await loadTasks(); 
        checkPendingItems();
    } catch (error) { console.error(error); }
}

// ========== LOAD TASKS ==========
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
        renderTasksList();
    } catch (error) {
        console.error(error);
        appData.tasks = [];
        renderTasksList();
    }
}

function renderTasksList() {
    const container = document.getElementById('tasksList');
    if (!container) return;
    
    container.innerHTML = '';
    if (appData.tasks.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:40px;">No offers available yet.</div>';
        return;
    }
    
    for (let task of appData.tasks) {
        const isCompleted = appData.completedTasks?.includes(task.id);
        const div = document.createElement('div');
        div.className = `task-item ${isCompleted ? 'completed' : ''}`;
        div.style.cursor = 'pointer';
        div.onclick = () => {
            if (!isCompleted) showOfferDetails(task);
            else showToast("Offer already completed!", "info");
        };
        
        div.innerHTML = `
            <div style="display: flex; gap: 12px; align-items: center; flex: 1;">
                <i class="fas ${task.icon || 'fa-gift'}" style="font-size: 24px; color: #667eea;"></i>
                <div>
                    <strong>${task.name}</strong>
                    <div style="color:#10b981;">+₨ ${task.reward}</div>
                    <small>${task.description || ''}</small>
                </div>
            </div>
            <div>
                ${!isCompleted ? '<span style="background:#f59e0b; color:white; padding:5px 12px; border-radius:20px;">View Offer</span>' : '<span style="color:#10b981;">✓ Completed</span>'}
            </div>
        `;
        container.appendChild(div);
    }
}

function showOfferDetails(task) {
    currentOffer = task;
    const offerDetailsScreen = document.getElementById('offerDetailsScreen');
    const container = document.getElementById('offerDetailsContainer');
    
    let instructionsHtml = '<p>Complete this offer to earn rewards.</p>';
    if (task.instructions) {
        const steps = task.instructions.split('\n');
        instructionsHtml = '<ol>';
        steps.forEach(step => { if (step.trim()) instructionsHtml += `<li>${step.trim()}</li>`; });
        instructionsHtml += '</ol>';
    }
    
    localStorage.setItem(`offer_${task.id}_startTime`, Date.now().toString());
    
    container.innerHTML = `
        <div class="offer-detail-card">
            <div class="offer-detail-header">
                <i class="fas ${task.icon || 'fa-gift'}"></i>
                <h2>${task.name}</h2>
                <div class="offer-reward">+₨ ${task.reward}</div>
            </div>
            <div class="offer-detail-body">
                <div class="offer-instructions">
                    <h3>How to complete:</h3>
                    ${instructionsHtml}
                </div>
                ${task.link ? `<button class="start-offer-btn" onclick="window.openOfferInNewTab('${task.link}', ${task.id})">Start Offer</button>` : ''}
                <div class="offer-note">After completing the offer, click "I've Completed" to get your verification code.</div>
            </div>
        </div>
    `;
    
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    offerDetailsScreen.classList.add('active');
}

window.openOfferInNewTab = function(link, taskId) {
    localStorage.setItem(`offer_${taskId}_opened`, 'true');
    localStorage.setItem(`offer_${taskId}_startTime`, Date.now().toString());
    window.open(link, '_blank');
    showToast("Complete the offer, then come back to claim your reward.", "info");
};

// ========== DAILY BONUS ==========
window.claimDailyBonus = async function() {
    if (!currentUser) return;
    const lastBonus = localStorage.getItem('lastBonus_' + currentUser.userId);
    const today = new Date().toDateString();
    if (lastBonus === today) { 
        showToast("Already claimed today's check-in bonus!", "error"); 
        return; 
    }
    
    const bonus = 1;
    
    showLoading("Claiming check-in bonus...");
    await new Promise(r => setTimeout(r, 1000));
    try {
        const userRef = doc(db, 'users', currentUser.userId);
        const userSnap = await getDoc(userRef);
        const newBalance = (userSnap.data()?.balance || 0) + bonus;
        
        await updateDoc(userRef, { 
            balance: newBalance,
            streak: (userSnap.data()?.streak || 1) + 1
        });
        appData.balance = newBalance; 
        appData.streak++;
        localStorage.setItem('lastBonus_' + currentUser.userId, today);
        updateUI(); 
        addActivity(`📅 Daily check-in bonus: ₨${bonus}`);
        showToast(`📅 +₨${bonus} check-in bonus!`, "success");
    } catch (error) { 
        console.error(error);
        showToast("Failed to claim bonus!", "error"); 
    }
    hideLoading();
};

// ========== WITHDRAWAL FUNCTIONS ==========
window.requestWithdrawal = async function() {
    if (!currentUser) return;
    const amount = parseInt(document.getElementById('withdrawAmount')?.value);
    const account = document.getElementById('accountNumber')?.value;
    const method = selectedMethod;
    
    if (!method) { showToast("Select method!", "error"); return; }
    if (!amount || amount < appSettings.minWithdrawal) { 
        showToast(`Min ₨${appSettings.minWithdrawal}!`, "error"); 
        return; 
    }
    if (!account) { showToast("Enter account!", "error"); return; }
    if (amount > appData.balance) { showToast("Insufficient balance!", "error"); return; }
    
    showLoading("Submitting...");
    try {
        let methodDisplay = method === 'jazzcash' ? "JazzCash" : method === 'easypaisa' ? "EasyPaisa" : "UPaisa";
        await addDoc(collection(db, 'withdrawal_requests'), {
            userId: currentUser.userId, userName: currentUser.name, amount, method, methodDisplay, accountNumber: account,
            status: 'pending', requestedAt: new Date().toISOString()
        });
        
        const userRef = doc(db, 'users', currentUser.userId);
        const userSnap = await getDoc(userRef);
        const newBalance = (userSnap.data()?.balance || 0) - amount;
        await updateDoc(userRef, { balance: newBalance });
        appData.balance = newBalance;
        updateUI();
        
        showToast(`✅ Withdrawal request submitted!`, "success");
        addActivity(`💰 Withdrawal request of ₨${amount}`);
        
        document.getElementById('withdrawAmount').value = '';
        document.getElementById('accountNumber').value = '';
        document.querySelectorAll('.method-option').forEach(opt => opt.classList.remove('selected'));
        selectedMethod = null;
        if (document.getElementById('withdrawHistoryScreen').classList.contains('active')) loadWithdrawalHistory();
    } catch (error) { showToast("Failed!", "error"); }
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
        container.innerHTML = '<div class="empty-state">No withdrawals</div>';
        return;
    }
    container.innerHTML = filtered.map(w => `
        <div class="withdrawal-card ${w.status}">
            <div class="withdrawal-header">
                <span class="withdrawal-amount">₨ ${w.amount}</span>
                <span class="withdrawal-status status-${w.status}">${w.status}</span>
            </div>
            <div class="withdrawal-details">
                <p>${w.methodDisplay}</p>
                <p>Account: ${w.accountNumber}</p>
                <p>${w.date}</p>
            </div>
        </div>
    `).join('');
}

async function checkPendingItems() {
    if (!currentUser) return;
    try {
        const q = query(collection(db, 'task_requests'), where('userId', '==', currentUser.userId), where('status', '==', 'approved'));
        const snapshot = await getDocs(q);
        for (const docSnap of snapshot.docs) {
            const data = docSnap.data();
            if (!appData.completedTasks.includes(data.taskId)) {
                const userRef = doc(db, 'users', currentUser.userId);
                const userSnap = await getDoc(userRef);
                await updateDoc(userRef, {
                    balance: (userSnap.data()?.balance || 0) + data.reward,
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

// ========== NAVIGATION ==========
window.navigateTo = function(screen) {
    const screens = ['home', 'tasks', 'earn', 'withdraw', 'withdrawHistory', 'refer'];
    screens.forEach(s => { const el = document.getElementById(`${s}Screen`); if (el) el.classList.remove('active'); });
    document.getElementById(`${screen}Screen`).classList.add('active');
    if (screen === 'withdrawHistory') loadWithdrawalHistory();
    if (screen === 'withdraw') updateUISettings();
    if (screen === 'earn') updateAdLimitDisplay();
    const navItems = document.querySelectorAll('.nav-item');
    const map = { home: 0, tasks: 1, earn: 2, withdraw: 3, withdrawHistory: 4, refer: 5 };
    navItems.forEach((item, i) => { if (i === map[screen]) item.classList.add('active'); else item.classList.remove('active'); });
};

window.logoutUser = function() {
    localStorage.removeItem('currentUser');
    currentUser = null;
    document.getElementById('authModal').style.display = 'flex';
    document.getElementById('appContainer').style.display = 'none';
    showToast("Logged out!", "success");
};

window.copyReferralLink = function() {
    if (!currentUser) { showToast("Login first!", "error"); return; }
    const link = `https://kamaonow.dpdns.org/ref/${currentUser.userId}`;
    navigator.clipboard.writeText(link);
    showToast("Referral link copied!", "success");
};

// ========== AUTH FUNCTIONS ==========
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

window.loginUser = async function() {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    if (!email || !password) { showToast("Enter email & password!", "error"); return; }
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
        document.getElementById('referralLink').innerText = `https://kamaonow.dpdns.org/ref/${currentUser.userId}`;
        showToast(`✅ Welcome back, ${currentUser.name}!`, "success");
    } catch (error) { showToast("Login failed!", "error"); }
    hideLoading();
};

window.registerUser = async function() {
    const name = document.getElementById('regName').value;
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regPassword').value;
    const confirm = document.getElementById('regConfirmPassword').value;
    if (!name || !email || !password) { showToast("Fill all fields!", "error"); return; }
    if (password !== confirm) { showToast("Passwords don't match!", "error"); return; }
    if (password.length < 6) { showToast("Password too short!", "error"); return; }
    showLoading("Creating account...");
    try {
        await loadSettings();
        const q = query(collection(db, 'users'), where('email', '==', email));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) { showToast("Email already registered!", "error"); hideLoading(); return; }
        const userId = 'user_' + Date.now();
        await setDoc(doc(db, 'users', userId), {
            userId, name, email, password: btoa(password), 
            balance: appSettings.welcomeBonus, 
            tasksCompletedToday: 0,
            completedTasks: [],
            referrals: 0, streak: 1, createdAt: new Date().toISOString(), status: 'active'
        });
        showToast(`✅ Registered! Welcome bonus: ₨${appSettings.welcomeBonus}`, "success");
        switchAuthTab('login');
        document.getElementById('regName').value = '';
        document.getElementById('regEmail').value = '';
        document.getElementById('regPassword').value = '';
        document.getElementById('regConfirmPassword').value = '';
    } catch (error) { showToast("Registration failed!", "error"); }
    hideLoading();
};

// ========== INIT ==========
const savedUser = localStorage.getItem('currentUser');
if (savedUser) {
    currentUser = JSON.parse(savedUser);
    document.getElementById('authModal').style.display = 'none';
    document.getElementById('appContainer').style.display = 'block';
    document.getElementById('userName').innerText = currentUser.name;
    loadUserData(currentUser.userId);
}

setInterval(() => { if (currentUser) checkPendingItems(); }, 30000);
console.log("✅ KamaoNow Ready! Ad Reward: ₨0.10 | Daily Bonus: ₨1");