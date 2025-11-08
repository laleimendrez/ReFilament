document.addEventListener("DOMContentLoaded", () => {
    // 1. Donut Chart Stacking Logic
    const types = ["pet", "hdpe", "pp"];
    // The radius 'r' is 14 in the SVG circle elements (cx=18, cy=18, r=14)
    const radius = 14; 
    const circumference = 2 * Math.PI * radius; 

    let offset = 0;
    types.forEach((type) => {
        // Note: Now selecting <circle> elements
        const circle = document.querySelector(`.circle.${type}`);
        if (circle) {
            const percent = parseFloat(circle.dataset.percent);
            // Calculate the length of the dash for the percentage
            const dash = (percent / 100) * circumference;

            // Setting the stroke-dasharray (visible length, gap length)
            circle.style.strokeDasharray = `${dash} ${circumference}`;

            // Stacking logic (Keep the logic that worked for stacking)
            circle.style.strokeDashoffset = offset; 
            offset -= dash;
        }
    });
});