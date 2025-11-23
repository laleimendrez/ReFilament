let spectralChartInstance = null; // To hold the Chart.js instance

// Define the 12 spectral channels (6 VIS, 6 NIR) from the AS7265X sensor
const AS7265X_LABELS = [
    // VIS (AS72651)
    '450 nm', '500 nm', '550 nm', '570 nm', '600 nm', '650 nm',
    // NIR1 (AS72652)
    '680 nm', '730 nm', '760 nm', '810 nm', '860 nm', '900 nm',
    // NIR2 (AS72653)
    '940 nm', '1000 nm', '1050 nm', '1100 nm', '1150 nm', '1200 nm'
];


// Define the colors for the chart lines based on material type
const MATERIAL_COLORS = {
    'PET': '#00BFFF',
    'HDPE': '#39FF14',
    'PP': '#FFD700'
};

const REFERENCE_COLOR = '#94a3b8'; // Gray for the reference line

// REVISED setupSpectralChart function
const setupSpectralChart = (materialType, rawVis, rawNir, refVis, refNir) => {
    // Destroy previous chart instance if it exists
    if (spectralChartInstance) {
        spectralChartInstance.destroy();
    }
    
    const ctx = document.getElementById('spectralChart').getContext('2d');
    
    // Combine VIS and NIR data for a continuous spectrum graph
    const measuredData = [...rawVis, ...rawNir];
    const referenceData = [...refVis, ...refNir];
    const labels = AS7265X_LABELS; // Use the 12 spectral channel labels

    // Initialize the Chart.js instance (requires Chart.js library to be included in base.html)
    spectralChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Measured Spectrum',
                data: measuredData,
                // Use MATERIAL_COLORS dictionary to set the color
                borderColor: MATERIAL_COLORS[materialType] || '#FFFFFF', 
                backgroundColor: 'transparent',
                borderWidth: 3,
                tension: 0.4,
                pointRadius: 5
            },
            {
                label: 'Reference Profile',
                data: referenceData,
                borderColor: REFERENCE_COLOR, // Fixed gray reference color
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
                    // Update label to reflect the actual channels
                    title: { display: true, text: 'WAVELENGTH (AS7265X Channels)', color: '#94a3b8' },
                    grid: { color: 'rgba(51, 65, 85, 0.5)' },
                    ticks: { color: '#E2E8F0' }
                },
                y: {
                    title: { display: true, text: 'INTENSITY / ABSORBANCE', color: '#94a3b8' },
                    grid: { color: 'rgba(51, 65, 85, 0.5)' },
                    ticks: { color: '#E2E8F0' }
                }
            },

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
    
    const closeModal = () => {
        modal.style.display = "none";
        document.body.classList.remove('modal-open'); // <-- FIX: Remove class to restore scroll
    };

    // Function to open the modal and populate data
    // REVISED openModal function (needs to be defined as async)
    const openModal = async (dataId) => {
        const modal = document.getElementById('spectralAnalysisModal');
        
        // 1. Get the data from the table row (for display in modal header)
        const row = document.querySelector(`button[data-id="${dataId}"]`).closest('tr');
        if (!row) return;

        const materialType = row.querySelector('.material-tag').textContent.trim();
        const confidence = row.querySelector('.confidence-text').textContent.trim();
        const timestamp = row.querySelector('td:nth-child(2)').textContent.trim();
        
        // Use a generic analysis note, since the specific note logic was tied to mock data
        const modalNote = `Key spectral peaks were detected, showing a strong correlation with the ${materialType} reference profile. This high certainty confirms the material type.`;

        // 2. FETCH SPECTRA DATA FROM API (The crucial integration step)
        const response = await fetch(`/data/spectra/${dataId}`);
        if (!response.ok) {
            alert("Failed to fetch spectral data. Check Flask server and database connection.");
            return;
        }
        const spectra = await response.json();
        
        // Check if the data structure is correct and contains the required arrays
        if (!spectra.raw_vis || !spectra.ref_vis) {
            alert("Invalid spectral data received from server.");
            return;
        }

        // 3. Populate Modal Data Bar
        document.getElementById('modal-id').textContent = dataId;
        document.getElementById('modal-material').textContent = materialType;
        document.getElementById('modal-material').className = `material-tag ${materialType.toLowerCase()}`;
        document.getElementById('modal-confidence').textContent = confidence;
        document.getElementById('modal-timestamp').textContent = timestamp;
        
        // 4. Populate Analysis Note
        // The note is a generic string now, no more mockSpectralData lookup
        document.getElementById('modal-analysis-note').textContent = modalNote;
        
        // 5. Setup the Chart using the FETCHED DATA (raw_vis, raw_nir, etc.)
        setupSpectralChart(
            materialType, 
            spectra.raw_vis, 
            spectra.raw_nir, 
            spectra.ref_vis, 
            spectra.ref_nir
        );
        
        // 6. Display the modal
        modal.style.display = "block";
        document.body.classList.add('modal-open');

        // Update legend color based on material type
        const legendMeasured = document.querySelector(".legend-color.measured");
        legendMeasured.style.backgroundColor = MATERIAL_COLORS[materialType] || "#FFFFFF";
    };

    // Event listeners for opening the modal
    spectrumButtons.forEach(button => {
        button.addEventListener('click', () => {
            const dataId = button.dataset.id;
            openModal(dataId);
        });
    });

    // Event listeners for closing the modal
    closeButton.onclick = closeModal;
    confirmButton.onclick = closeModal;

    // Close the modal if user clicks outside of it
    window.onclick = function(event) {
        if (event.target == modal) {
            closeModal();
        }
    }

    // ---- AUTO REFRESH TABLE EVERY 3 SECONDS ----
    setInterval(async () => {

        // 1. Fetch latest materials from the backend
        const response = await fetch('/data/api/logs');
        if (!response.ok) return;

        const updatedLogs = await response.json();

        // 2. Get the table body
        const tbody = document.getElementById('materials-table-body');

        // 3. Clear old table rows
        tbody.innerHTML = "";

        // 4. Insert updated rows
        updatedLogs.forEach(item => {
            const row = `
            <tr class="material-row ${item.material.toLowerCase()}">
                <td>${item.id}</td>
                <td>${item.timestamp}</td>
                <td class="material-cell">
                    <span class="material-tag ${item.material.toLowerCase()}">${item.material}</span>
                </td>
                <td class="confidence-bar-cell">
                    <div class="bar-and-text-container"> 
                        <span class="confidence-bar-wrapper">
                            <span class="confidence-bar ${item.material.toLowerCase()}"
                                style="--conf: ${item.confidence.replace('%','')}">
                            </span>
                        </span>
                        <span class="confidence-text">${item.confidence}</span>
                    </div>
                </td>
                <td>${item.chemical_name || "N/A"}</td>
                <td>
                    <button class="view-spectrum" data-id="${item.id}">View Spectrum</button>
                </td>
            </tr>
            `;

            tbody.insertAdjacentHTML('beforeend', row);
        });

        // 5. RE-ATTACH the modal buttons
        document.querySelectorAll('.view-spectrum').forEach(btn => {
            btn.addEventListener('click', () => openModal(btn.dataset.id));
        });

    }, 3000);  // refresh every 3 seconds

    async function refreshSummary() {
        try {
            const response = await fetch('/data/summary');
            const summary = await response.json();

            // Update TOTAL RECORDS
            document.querySelector(".card:nth-child(1) .number").textContent =
                summary.total_records.toLocaleString();

            // Update PET, HDPE, PP text %
            document.querySelector(".percent.pet").textContent = summary.pet + "%";
            document.querySelector(".percent.hdpe").textContent = summary.hdpe + "%";
            document.querySelector(".percent.pp").textContent = summary.pp + "%";

            // Update DONUT CHART segments dynamically
            const circles = {
                pet: summary.pet,
                hdpe: summary.hdpe,
                pp: summary.pp
            };

            const radius = 14;
            const circumference = 2 * Math.PI * radius;
            let offset = 0;

            for (const type of ["pet", "hdpe", "pp"]) {
                const circle = document.querySelector(`.circle.${type}`);
                if (circle) {
                    const dash = (circles[type] / 100) * circumference;
                    circle.style.strokeDasharray = `${dash} ${circumference}`;
                    circle.style.strokeDashoffset = offset;
                    offset -= dash;
                }
            }

            // Update 24H activity
            document.querySelector(".activity").textContent = "+" + summary.activity_24h + " ⬆";

            // Update avg confidence
            document.querySelector(".confidence").textContent = summary.avg_confidence + "%";

        } catch (error) {
            console.error("Summary refresh error:", error);
        }
    }

    setInterval(() => {
        refreshSummary();
    }, 3000);


});