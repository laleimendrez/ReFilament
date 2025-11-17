// static/js/temp.js

let tempGaugeChart = null; // Store chart instance for updates
let tempHistoryChartInstance = null; // Store chart instance for history

// --- 1. Utility Functions ---

// Function to create/update the temperature gauge
function createTempGauge(temperature) {
    // Range is -40°C to 80°C (total range = 120)
    const MAX_TEMP = 80;
    const MIN_TEMP = -40;
    const RANGE = MAX_TEMP - MIN_TEMP;

    const normalizedTemp = Math.min(Math.max(temperature, MIN_TEMP), MAX_TEMP) - MIN_TEMP;
    const gaugeValue = normalizedTemp;
    const gaugeRemainder = RANGE - normalizedTemp;

    const gaugeCtx = document.getElementById('tempGauge');

    // If chart exists, update it
    if (tempGaugeChart) {
        tempGaugeChart.data.datasets[0].data = [gaugeValue, gaugeRemainder];
        tempGaugeChart.update();
        return tempGaugeChart;
    }

    // Create new chart
    tempGaugeChart = new Chart(gaugeCtx, {
        type: 'doughnut',
        data: {
            datasets: [{
                data: [gaugeValue, gaugeRemainder],
                backgroundColor: [
                    '#39ff14', // Green value
                    '#3a3a5a'  // Dark gray/blue background
                ],
                borderWidth: 0,
            }]
        },
        options: {
            // ... (Keep your existing options for gauge chart) ...
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 2,
            cutout: '70%',
            circumference: 180, 
            rotation: -90, 
            plugins: {
                tooltip: { enabled: true }, 
                legend: { display: true } 
            }
        }
    });
}

// Function to update temperature display and status text
function updateTemperatureDisplay(temperature, status, lastUpdate) {
    // Update gauge
    createTempGauge(temperature);
    
    // Update temperature text
    document.querySelector('.gauge-value').textContent = `${temperature}°C`;
    
    // Update status color based on temperature (DHT is ambient, so limits are low)
    const statusElement = document.querySelector('.gauge-status');
    if (temperature < 15) {
        statusElement.textContent = 'Cold';
        statusElement.style.color = '#2196F3'; // Blue for cold
    } else if (temperature > 30) {
        statusElement.textContent = 'Warm';
        statusElement.style.color = '#FFD700'; // Yellow for warm
    } else {
        statusElement.textContent = 'Stable';
        statusElement.style.color = '#39ff14'; // Green for stable
    }

    // Update last refresh time
    document.querySelector('.last-update').textContent = `Last Update: ${lastUpdate}`;
}

// --- 2. History Chart Integration ---
function updateHistoryChart(logs) {
    if (tempHistoryChartInstance) {
        tempHistoryChartInstance.destroy();
    }
    
    // Logs are DESCENDING (newest first) from API. Reverse them for time-series chart.
    const reversedLogs = logs.slice().reverse(); 
    
    const labels = reversedLogs.map(log => log.timestamp.split(' ')[1]); // Time only
    const data = reversedLogs.map(log => log.temperature);

    const targetData = labels.map(() => 80);
    
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
                    borderColor: '#00bbff', // Blue line
                    backgroundColor: 'rgba(63, 81, 181, 0.1)',
                    fill: true,
                    tension: 0.3 
                },
                {
                    // Dataset 2: Target Setpoint (Dotted Line)
                    label: 'Extruder Target', 
                    data: targetData, // Uses the static 180°C array
                    borderColor: '#ff000d', 
                    backgroundColor: 'transparent',
                    borderDash: [5, 5], // <--- THIS RESTORES THE DOTTED LINE
                    fill: false,
                    tension: 0.1,
                    pointRadius: 0 // No dots on the target line
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false, 
            // ... (Keep your existing options for history chart scales/plugins) ...
            plugins: {
                legend: {
                    display: true, // <--- SET THIS TO TRUE
                    position: 'bottom',
                    align: 'end', 
                    labels: { 
                        color: '#e0e0e0',
                        boxWidth: 20, 
                        usePointStyle: false 
                    }
                }
            },
            scales: {
                x: {
                    title: { display: true, text: 'Time', color: '#c0c0c0' },
                    ticks: { color: '#c0c0c0' },
                    grid: { color: '#3a3a5a' }
                },
                y: {
                    beginAtZero: false,
                    title: { display: true, text: 'Temperature (°C)', color: '#c0c0c0' },
                    ticks: { color: '#c0c0c0' },
                    grid: { color: '#3a3a5a' }
                }
            }
        }
    });
}

// --- 3. Database Fetch Logic ---s

async function fetchTemperatureData() {
    try {
        // Fetch data from the new integrated Flask API endpoint
        const response = await fetch('/temperature/data'); 
        if (!response.ok) throw new Error('Failed to fetch temperature data from API');
        
        const logs = await response.json();
        
        if (logs.length > 0) {
            // The latest log is the first element (due to ORDER BY DESC)
            const latestLog = logs[0]; 
            const currentTime = new Date(latestLog.timestamp).toLocaleTimeString();
            
            // 1. Update the Gauge Status and Text
            updateTemperatureDisplay(latestLog.temperature, latestLog.status, currentTime);
            
            // 2. Update the History Chart
            updateHistoryChart(logs);
        }
    } catch (error) {
        console.error('Error fetching temperature data:', error);
        document.querySelector('.gauge-status').textContent = 'Error: API Fetch Failed';
        document.querySelector('.gauge-status').style.color = '#ff000d';
    }
}


// --- DOM Content Loaded ---
document.addEventListener('DOMContentLoaded', function () {
    // Initial gauge creation (to show something while loading)
    const initialTemp = 28.5; // Use a reasonable default
    createTempGauge(initialTemp);
    
    // Start fetching data from the database
    fetchTemperatureData();

    // Optional: Refresh data every 30 seconds
    setInterval(fetchTemperatureData, 30000); 
});