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
    const lastAlertLog = logs.find(log => log.temperature > 70.0);

    if (lastAlertLog) {
        const warningPanelText = document.querySelector('.last-warning span');
        const stateConfig = getTempState(lastAlertLog.temperature);
        const alertTime = new Date(lastAlertLog.timestamp).toLocaleString();

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
            
            updateTemperatureDisplay(latestLog.temperature, latestLog.status, fullDateTime);
            updatePersistentWarning(logs);

            const currentTime = Date.now();
            if (currentTime - lastChartUpdateTime > CHART_UPDATE_INTERVAL || lastChartUpdateTime === 0) {
                updateHistoryChart(logs);
                lastChartUpdateTime = currentTime; 
            }
        }
    } catch (error) { console.error('Fetch error:', error); }
}

// ============================================================
// 6. CSV DOWNLOAD MODAL LOGIC (mirrors Tab 1 / data.js)
// ============================================================
document.addEventListener('DOMContentLoaded', function () {
    // --- Gauge + data polling ---
    createTempGauge(25.0, '#39ff14'); 
    fetchTemperatureData();
    setInterval(fetchTemperatureData, 3000);

    // --- Element references ---
    const downloadModal  = document.getElementById('temp-download-modal');
    const noDataModal    = document.getElementById('temp-no-data-modal');
    const openBtn        = document.getElementById('open-temp-modal-btn');
    const closeDownloadX = document.getElementById('close-temp-download-x');
    const closeNoDataX   = document.querySelector('.close-temp-no-data');
    const closeNoDataBtn = document.getElementById('close-temp-no-data-btn');
    const rangeBtn       = document.getElementById('temp-download-range-btn');
    const allBtn         = document.getElementById('temp-download-all-btn');
    const startInput     = document.getElementById('temp-modal-start');
    const endInput       = document.getElementById('temp-modal-end');

    // --- Helpers ---
    function showModal(modal)  { if (modal) modal.style.display = 'flex'; }
    function hideModal(modal)  { if (modal) modal.style.display = 'none'; }

    function triggerDownload(blob, filename) {
        const url  = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href  = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
    }

    // --- Open / close listeners ---
    if (openBtn)        openBtn.addEventListener('click',        () => showModal(downloadModal));
    if (closeDownloadX) closeDownloadX.addEventListener('click', () => hideModal(downloadModal));
    if (closeNoDataX)   closeNoDataX.addEventListener('click',   () => hideModal(noDataModal));
    if (closeNoDataBtn) closeNoDataBtn.addEventListener('click', () => hideModal(noDataModal));

    // --- Download Range ---
    if (rangeBtn) {
        rangeBtn.addEventListener('click', async () => {
            const start = startInput.value;
            const end   = endInput.value;

            if (!start || !end) {
                alert('Please select both start and end dates.');
                return;
            }

            try {
                const response = await fetch(
                    `/temperature/download?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`
                );

                if (response.status === 404) {
                    hideModal(downloadModal);
                    showModal(noDataModal);
                    return;
                }

                if (!response.ok) {
                    try {
                        const err = await response.json();
                        alert('Error: ' + err.error);
                    } catch {
                        alert('Error: ' + response.statusText);
                    }
                    return;
                }

                const blob = await response.blob();
                triggerDownload(blob, `temperature_logs_${start}_to_${end}.csv`);
                hideModal(downloadModal);

            } catch (error) {
                console.error('Download error:', error);
                alert('Error downloading file: ' + error.message);
            }
        });
    }

    // --- Download All ---
    if (allBtn) {
        allBtn.addEventListener('click', async () => {
            try {
                const response = await fetch('/temperature/download?all=true');

                if (!response.ok) {
                    try {
                        const err = await response.json();
                        alert('Error: ' + err.error);
                    } catch {
                        alert('Error: ' + response.statusText);
                    }
                    return;
                }

                const blob = await response.blob();
                triggerDownload(blob, 'temperature_logs_all.csv');
                hideModal(downloadModal);

            } catch (error) {
                console.error('Download error:', error);
                alert('Error downloading file: ' + error.message);
            }
        });
    }

    // --- Close on backdrop click ---
    window.addEventListener('click', function (event) {
        if (event.target === downloadModal) hideModal(downloadModal);
        if (event.target === noDataModal)   hideModal(noDataModal);
    });
});