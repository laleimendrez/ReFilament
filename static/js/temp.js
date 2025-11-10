document.addEventListener('DOMContentLoaded', function () {
  let tempGaugeChart = null; // Store chart instance for updates

  // --- 1. Temperature Gauge Chart ---
  const gaugeCtx = document.getElementById('tempGauge');
  if (gaugeCtx) {
    // Initialize the gauge with current temperature
    tempGaugeChart = createTempGauge(50); // Start with default 60°C
  }

  // Function to create/update the temperature gauge
  function createTempGauge(temperature) {
    // Convert temperature to gauge value
    // Range is -40°C to 80°C (total range = 120)
    const normalizedTemp = temperature - (-40); // Shift range to start at 0
    const gaugeValue = normalizedTemp;
    const gaugeRemainder = 120 - normalizedTemp;

    // If chart exists, update it
    if (tempGaugeChart) {
      tempGaugeChart.data.datasets[0].data = [gaugeValue, gaugeRemainder];
      tempGaugeChart.update();
      return tempGaugeChart;
    }

    // Create new chart
    return new Chart(gaugeCtx, {
      type: 'doughnut',
      data: {
        datasets: [{
          data: [gaugeValue, gaugeRemainder],
          backgroundColor: [
            '#39ff14', // Green value
            '#3a3a5a'  // Dark gray/blue background for the rest of the arc
          ],
          borderWidth: 0,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        aspectRatio: 2,
        cutout: '70%',
        circumference: 180, // Makes it a semi-circle
        rotation: -90,      // Starts it from the left
        plugins: {
          tooltip: {
            enabled: false // Disable tooltips
          },
          legend: {
            display: false // Hide legend
          }
        }
      }
    });
  }

  // Function to update temperature display
  function updateTemperatureDisplay(temperature) {
    // Update gauge
    createTempGauge(temperature);
    
    // Update temperature text
    document.querySelector('.gauge-value').textContent = `${temperature}°C`;
    
    // Update status color based on temperature
    const statusElement = document.querySelector('.gauge-status');
    if (temperature < 0) {
      statusElement.textContent = 'Cold';
      statusElement.style.color = '#2196F3'; // Blue for cold
    } else if (temperature > 70) {
      statusElement.textContent = 'Hot';
      statusElement.style.color = '#ff000d'; // Red for hot
    } else {
      statusElement.textContent = 'Stable';
      statusElement.style.color = '#39ff14'; // Green for stable
    }
  }

  // Function to fetch temperature from server
  async function fetchTemperature() {
    try {
      const response = await fetch('/api/temperature');
      if (!response.ok) throw new Error('Failed to fetch temperature');
      const data = await response.json();
      updateTemperatureDisplay(data.temperature);
    } catch (error) {
      console.error('Error fetching temperature:', error);
    }
  }

  // Commented out: Temperature auto-update
  // Update temperature every 5 seconds
  // setInterval(fetchTemperature, 5000);
  // Initial fetch
  // fetchTemperature();

  // --- 2. Temperature History Line Chart ---
  const historyCtx = document.getElementById('tempHistoryChart');
  if (historyCtx) {
    new Chart(historyCtx, {
      type: 'line',
      data: {
        // Using dummy labels to match the image's density
        labels: [
          '10:00 AM',
          '10:04 AM',
          '10:08 AM',
          '10:12 AM',
          '10:16 AM',
          '10:20 AM',
          '10:24 AM',
          '10:28 AM'
        ],
        datasets: [
          {
            // Updated label to match image
            label: 'Extruder Actual', 
            data: [90, 95, 94, 100, 110, 115, 120, 140, 150, 152, 160], 
            borderColor: '#00bbff', // Blue line
            backgroundColor: 'rgba(63, 81, 181, 0.1)',
            fill: true,
            tension: 0.3 
          },
          {
            // Updated label to match image
            label: 'Extruder Target', 
            data: [90, 98, 106, 114, 122, 130, 138, 146, 154, 162], 
            borderColor: '#ff000d', // Red line
            borderDash: [5, 5], // Makes it a dashed line
            fill: false,
            tension: 0.1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false, 
        plugins: {
          legend: {
            // Positioned exactly as in the image
            position: 'bottom',
            align: 'end', 
            labels: {
              color: '#e0e0e0', // Legend text color
              boxWidth: 20, // Width of the colored line
              usePointStyle: false // Ensures it uses a line, not a point
            }
          }
        },
        scales: {
          x: {
            title: {
              display: true,
              text: 'Time',
              color: '#c0c0c0'
            },
            ticks: {
              color: '#c0c0c0'
            },
            grid: {
              color: '#3a3a5a' // X-axis grid lines
            }
          },
          y: {
            beginAtZero: false, // Don't start at 0
            min: 80, // Set a min to match the chart's zoomed-in look
            title: {
              display: true,
              text: 'Temperature (°C)', // Image text is 'Thoaseaetmpe PLO' but that seems like a typo
              color: '#c0c0c0'
            },
            ticks: {
              color: '#c0c0c0'
            },
            grid: {
              color: '#3a3a5a' // Y-axis grid lines
            }
          }
        }
      }
    });
  }
});