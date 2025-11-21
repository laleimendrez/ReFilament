// static/js/temp.js

// --- CONFIGURATION ---
const TARGET_MIN = 30;
const TARGET_MAX = 40;
const TARGET_DISPLAY_TEXT = `${TARGET_MIN}°C - ${TARGET_MAX}°C`;

let tempGaugeChart = null;
let tempHistoryChartInstance = null;

// Flags to track modal states
let isCriticalModalOpen = false; 
let isWarningModalOpen = false;

// Chart Timing
let lastChartUpdateTime = 0; 
const CHART_UPDATE_INTERVAL = 60000; // 60 Seconds

// --- 1. State Logic ---
function getTempState(temp) {
    if (temp > 75.0) {
        return { label: 'CRITICAL', color: '#ff3f3fff', cssClass: 'text-critical', priority: 2 };
    } else if (temp > 70.0) {
        return { label: 'WARNING', color: '#FFD700', cssClass: 'text-warning', priority: 1 };
    } else if (temp >= 15.0) {
        return { label: 'STABLE', color: '#39FF14', cssClass: 'text-stable', priority: 0 };
    } else if (temp > 10.0) {
        return { label: 'COLD', color: '#2196F3', cssClass: 'text-cold', priority: 0 };
    } else {
        return { label: 'LOW LIMIT', color: '#ADD8E6', cssClass: 'text-low', priority: 0 };
    }
}

// --- 2. Gauge Creation ---
function createTempGauge(temperature, colorHex) {
    const MAX_TEMP = 80; 
    const MIN_TEMP = -40;
    const RANGE = MAX_TEMP - MIN_TEMP;

    const normalizedTemp = Math.min(Math.max(temperature, MIN_TEMP), MAX_TEMP) - MIN_TEMP;
    const gaugeValue = normalizedTemp;
    const gaugeRemainder = RANGE - normalizedTemp;

    const gaugeCtx = document.getElementById('tempGauge');

    if (tempGaugeChart) {
        tempGaugeChart.data.datasets[0].data = [gaugeValue, gaugeRemainder];
        tempGaugeChart.data.datasets[0].backgroundColor = [colorHex, '#3a3a5a'];
        tempGaugeChart.update();
        return;
    }

    tempGaugeChart = new Chart(gaugeCtx, {
        type: 'doughnut',
        data: {
            datasets: [{
                data: [gaugeValue, gaugeRemainder],
                backgroundColor: [colorHex, '#3a3a5a'],
                borderWidth: 0,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 2,
            cutout: '70%',
            circumference: 180, 
            rotation: -90, 
            plugins: { tooltip: { enabled: false }, legend: { display: false } }
        }
    });
}

// --- 3. Display Logic (Visuals Only) ---
function updateTemperatureDisplay(temperature, backendStatus, lastUpdateString) {
    const stateConfig = getTempState(temperature);

    // A. Update Visuals
    createTempGauge(temperature, stateConfig.color);
    document.querySelector('.gauge-value').textContent = `${temperature}°C`;
    
    const targetElement = document.querySelector('.target-temp');
    if(targetElement) {
        targetElement.textContent = TARGET_DISPLAY_TEXT;
    }

    const statusElement = document.querySelector('.gauge-status');
    statusElement.textContent = stateConfig.label;
    statusElement.className = 'gauge-status ' + stateConfig.cssClass;
    statusElement.style.color = stateConfig.color;

    document.querySelector('.last-update').textContent = `Last Update: ${lastUpdateString}`;

    // C. Modal Triggers (Immediate)
    if (stateConfig.label === 'CRITICAL') {
        closeWarningModal(); 
        showCriticalModal(temperature, lastUpdateString);
    } else if (stateConfig.label === 'WARNING') {
        if (!isCriticalModalOpen) {
            showWarningModal(temperature, lastUpdateString);
        }
    }
}

// --- NEW: Permanent Warning Logic ---
function updatePersistentWarning(logs) {
    // 1. Find the most recent log that was Warning or Critical (> 70.0)
    const lastAlertLog = logs.find(log => log.temperature > 70.0);

    if (lastAlertLog) {
        const warningPanelText = document.querySelector('.last-warning span');
        
        // Get config for that specific historical log
        const stateConfig = getTempState(lastAlertLog.temperature);
        const alertTime = new Date(lastAlertLog.timestamp).toLocaleString();

        // Style it
        warningPanelText.style.display = 'flex';
        warningPanelText.style.flexDirection = 'row';
        warningPanelText.style.alignItems = 'center';
        warningPanelText.style.gap = '8px'; 
        warningPanelText.style.flexWrap = 'wrap'; 
        warningPanelText.style.margin = '0'; 

        warningPanelText.innerHTML = `
            <div style="color: ${stateConfig.color}; font-weight: 700; white-space: nowrap; line-height: 1.2;">
                ${stateConfig.label} ALERT
            </div>
            <div style="color: #ffffff; font-weight: 600;">|</div>
            <div style="color: #ffffff; font-weight: 600; font-size: 1rem; white-space: nowrap; line-height: 1.2;">
                ${alertTime}
            </div>
        `;
    }
    // If no alert found in history, it stays "None" (HTML default)
}


// --- Critical Modal Functions ---
function showCriticalModal(temp, fullDateTime) {
    if (isCriticalModalOpen) return;
    const modal = document.getElementById('criticalModal');
    document.getElementById('modalActualTemp').textContent = `${temp}°C`;
    document.getElementById('modalTime').textContent = fullDateTime;
    
    const subTemp = modal.querySelector('.sub-temp span');
    if(subTemp) subTemp.textContent = TARGET_DISPLAY_TEXT;
    
    modal.style.display = 'flex';
    isCriticalModalOpen = true;
}

function closeModal() {
    document.getElementById('criticalModal').style.display = 'none';
    setTimeout(() => { isCriticalModalOpen = false; }, 10000);
}

// --- Warning Modal Functions ---
function showWarningModal(temp, fullDateTime) {
    if (isWarningModalOpen) return;
    const modal = document.getElementById('warningModal');
    document.getElementById('warnActualTemp').textContent = `${temp}°C`;
    document.getElementById('warnTime').textContent = fullDateTime;
    
    const subTemp = modal.querySelector('.sub-temp span');
    if(subTemp) subTemp.textContent = TARGET_DISPLAY_TEXT;

    modal.style.display = 'flex';
    isWarningModalOpen = true;
}

function closeWarningModal() {
    const modal = document.getElementById('warningModal');
    if (modal) {
        modal.style.display = 'none';
        setTimeout(() => { isWarningModalOpen = false; }, 10000);
    }
}

// --- 4. History Chart ---
function updateHistoryChart(logs) {
    if (tempHistoryChartInstance) {
        tempHistoryChartInstance.destroy();
    }

    if (!logs || logs.length === 0) return;

    // Static Data Compatible Filter
    const latestLogTime = new Date(logs[0].timestamp).getTime();
    const thirtyMinutesAgo = latestLogTime - (30 * 60 * 1000);
    
    const recentLogs = logs.filter(log => {
        const logTime = new Date(log.timestamp).getTime();
        return logTime > thirtyMinutesAgo;
    });

    const reversedLogs = recentLogs.slice().reverse(); 
    const labels = reversedLogs.map(log => log.timestamp.split(' ')[1]); 
    const data = reversedLogs.map(log => log.temperature);
    const targetData = labels.map(() => TARGET_MAX);
    
    const historyCtx = document.getElementById('tempHistoryChart');
    if (!historyCtx) return;

    tempHistoryChartInstance = new Chart(historyCtx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'System Temperature (°C)', 
                    data: data, 
                    borderColor: '#00bbff', 
                    backgroundColor: 'rgba(63, 81, 181, 0.1)',
                    fill: true,
                    tension: 0.3 
                },
                {
                    label: 'Target Temperature (°C)', 
                    data: targetData, 
                    borderColor: '#ff000d', 
                    borderDash: [5, 5], 
                    fill: false,
                    pointRadius: 0 
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { 
                legend: { 
                    display: true, 
                    position: 'bottom', 
                    align: 'end',       
                    labels: { color: '#e0e0e0', padding: 20 } 
                } 
            },
            scales: {
                x: { ticks: { color: '#c0c0c0' }, grid: { color: '#3a3a5a' } },
                y: { 
                    beginAtZero: true,
                    ticks: { color: '#c0c0c0' }, 
                    grid: { color: '#3a3a5a' } 
                }
            }
        }
    });
}

// --- 5. Data Fetching ---
async function fetchTemperatureData() {
    try {
        const response = await fetch('/temperature/data'); 
        if (!response.ok) throw new Error('API Failed');
        const logs = await response.json();
        
        if (logs.length > 0) {
            const latestLog = logs[0]; 
            const fullDateTime = new Date(latestLog.timestamp).toLocaleString();
            
            // 1. Update Real-Time Visuals
            updateTemperatureDisplay(latestLog.temperature, latestLog.status, fullDateTime);
            
            // 2. Update Permanent Warning (Scans history)
            updatePersistentWarning(logs);

            // 3. Update Chart (Every 60s)
            const currentTime = Date.now();
            if (currentTime - lastChartUpdateTime > CHART_UPDATE_INTERVAL || lastChartUpdateTime === 0) {
                updateHistoryChart(logs);
                lastChartUpdateTime = currentTime; 
            }
        }
    } catch (error) { console.error('Fetch error:', error); }
}

document.addEventListener('DOMContentLoaded', function () {
    createTempGauge(25.0, '#39ff14'); 
    fetchTemperatureData();
    setInterval(fetchTemperatureData, 3000); 
});