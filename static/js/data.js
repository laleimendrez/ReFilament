// --- Mock Data for Spectral Graph (AS7265X Channels) ---
// In a real application, this data would be fetched from the backend (MySQL)
const mockSpectralData = {
    'PET': {
        // Mock data points for the 6 visible channels (450nm - 670nm) and beyond
        measured: [2.5, 3.8, 1.5, 4.2, 1.8, 2.0, 1.2, 0.9, 0.8, 0.7],
        reference: [2.8, 3.5, 1.2, 4.0, 2.0, 2.2, 1.5, 1.0, 0.7, 0.6],
        note: "Strong correlation with PET reference profile. Distinct peaks align perfectly, confirming a high certainty.",
        color: '#00BFFF'
    },
    'HDPE': {
        measured: [3.5, 2.8, 4.5, 1.2, 0.5, 0.3, 0.4, 0.9, 1.1, 1.3],
        reference: [3.8, 2.5, 4.2, 1.5, 0.7, 0.5, 0.3, 0.8, 1.0, 1.2],
        note: "Clear absorption profile characteristic of HDPE. Certainty is high due to unique peak at 500-550nm.",
        color: '#39FF14'
    },
    'PP': {
        measured: [1.1, 1.5, 1.8, 2.2, 2.5, 3.0, 4.0, 3.5, 2.0, 1.0],
        reference: [1.3, 1.7, 2.0, 2.5, 2.8, 3.2, 3.8, 3.2, 1.8, 0.8],
        note: "Spectral signature consistent with Polypropylene. Slightly lower certainty suggests minor additives may be present.",
        color: '#FFD700'
    }
};

let spectralChartInstance = null; // To hold the Chart.js instance

const setupSpectralChart = (materialType) => {
    // Destroy previous chart instance if it exists
    if (spectralChartInstance) {
        spectralChartInstance.destroy();
    }
    
    const data = mockSpectralData[materialType];
    const ctx = document.getElementById('spectralChart').getContext('2d');
    
    // X-axis labels representing the general wavelength range
    const labels = ['400nm', '450nm', '500nm', '550nm', '600nm', '650nm', '700nm', '800nm', '900nm', '950nm'];

    // Initialize the Chart.js instance (requires Chart.js library to be included in base.html)
    spectralChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Measured Spectrum',
                data: data.measured,
                borderColor: data.color, // Color coded based on material
                backgroundColor: 'transparent',
                borderWidth: 3,
                tension: 0.4,
                pointRadius: 5
            },
            {
                label: 'Reference Profile',
                data: data.reference,
                borderColor: '#94a3b8', // Gray for reference
                backgroundColor: 'transparent',
                borderWidth: 2,
                borderDash: [5, 5],
                tension: 0.4,
                pointRadius: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                title: { display: false }
            },
            scales: {
                x: {
                    title: { display: true, text: 'WAVELENGTH (nm)', color: '#94a3b8' },
                    grid: { color: 'rgba(51, 65, 85, 0.5)' },
                    ticks: { color: '#E2E8F0' }
                },
                y: {
                    title: { display: true, text: 'INTENSITY / ABSORBANCE', color: '#94a3b8' },
                    grid: { color: 'rgba(51, 65, 85, 0.5)' },
                    ticks: { color: '#E2E8F0' }
                }
            }
        }
    });
};


document.addEventListener("DOMContentLoaded", () => {
    // 1. Donut Chart Stacking Logic (KEEPING YOUR ORIGINAL LOGIC)
    const types = ["pet", "hdpe", "pp"];
    const radius = 14; 
    const circumference = 2 * Math.PI * radius; 

    let offset = 0;
    types.forEach((type) => {
        const circle = document.querySelector(`.circle.${type}`);
        if (circle) {
            const percent = parseFloat(circle.dataset.percent);
            const dash = (percent / 100) * circumference;
            circle.style.strokeDasharray = `${dash} ${circumference}`;
            circle.style.strokeDashoffset = offset; 
            offset -= dash;
        }
    });

    // 2. Modal Logic (NEW CODE)
    const modal = document.getElementById('spectralAnalysisModal');
    const closeButton = document.querySelector('.close-button');
    const confirmButton = document.querySelector('.modal-confirm-button');
    const spectrumButtons = document.querySelectorAll('.view-spectrum');
    

    // Function to open the modal and populate data
    const openModal = (dataId) => {
        // Find the row data corresponding to the button clicked (using Jinja data here)
        // NOTE: In a production app, you would fetch this specific data from the Flask API (MySQL)
        const row = document.querySelector(`button[data-id="${dataId}"]`).closest('tr');
        if (!row) return;

        const materialType = row.querySelector('.material-tag').textContent.trim();
        const confidence = row.querySelector('.confidence-text').textContent.trim();
        const timestamp = row.querySelector('td:nth-child(2)').textContent.trim();
        // const temp = row.querySelector('td:nth-child(5)').textContent.trim(); // Temp removed

        // Populate Modal Data Bar
        document.getElementById('modal-id').textContent = dataId;
        document.getElementById('modal-material').textContent = materialType;
        document.getElementById('modal-material').className = `material-tag ${materialType.toLowerCase()}`;
        document.getElementById('modal-confidence').textContent = confidence.replace('%', '') + '%';
        document.getElementById('modal-timestamp').textContent = timestamp;
        // document.getElementById('modal-temp').textContent = temp; // Temp removed

        // Populate Analysis Note
        document.getElementById('modal-analysis-note').textContent = mockSpectralData[materialType].note.replace('[Material]', materialType);
        
        // Setup the Chart
        setupSpectralChart(materialType);
        
        // Display the modal
        modal.style.display = "block";

        document.body.classList.add('modal-open');
    };

    // Event listeners for opening the modal
    spectrumButtons.forEach(button => {
        button.addEventListener('click', () => {
            const dataId = button.dataset.id;
            openModal(dataId);
        });
    });

    // Event listeners for closing the modal
    closeButton.onclick = function() {
        modal.style.display = "none";
    }
    confirmButton.onclick = function() {
        modal.style.display = "none";
    }

    // Close the modal if user clicks outside of it
    window.onclick = function(event) {
        if (event.target == modal) {
            modal.style.display = "none";
        }
    }
});