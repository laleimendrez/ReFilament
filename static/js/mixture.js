const selectButtons = document.querySelectorAll(".select-btn");
const modals = document.querySelectorAll(".mixture-modal");
const okButtons = document.querySelectorAll(".ok-btn");

selectButtons.forEach((btn, index) => {
  btn.addEventListener("click", () => {
    modals[index].style.display = "flex";
  });
});

okButtons.forEach((ok, index) => {
  ok.addEventListener("click", () => {
    modals[index].style.display = "none";
  });
});

const selectDropdown = document.getElementById("sort-filter");
const mixtureGrid = document.querySelector(".mixture-grid");
const mixtureCards = Array.from(document.querySelectorAll(".mixture-card"));

selectDropdown.addEventListener("change", function () {
  const value = this.value;

  mixtureCards.forEach(card => card.style.display = "flex"); // reset all cards

  if (value === "default") {
    mixtureCards.forEach(card => card.style.display = "flex");
  } else if (value === "name-asc") {
    mixtureCards.sort((a, b) => a.querySelector("h3").textContent.localeCompare(b.querySelector("h3").textContent));
    mixtureCards.forEach(card => mixtureGrid.appendChild(card));
  } else if (value === "name-desc") {
    mixtureCards.sort((a, b) => b.querySelector("h3").textContent.localeCompare(a.querySelector("h3").textContent));
    mixtureCards.forEach(card => mixtureGrid.appendChild(card));
  } else if (value.startsWith("purpose-")) {
    const purposeText = {
      "purpose-standard": "Standard Prototyping",
      "purpose-lowstress": "Low-Stress Components",
      "purpose-functional": "Functional Parts",
      "purpose-general": "General Purpose",
      "purpose-multi": "Multi-Property",
      "purpose-flex": "Increased Flex",
      "purpose-durable": "High Durability"
    }[value];

    mixtureCards.forEach(card => {
      const purpose = card.querySelector(".mixture-info p").textContent;
      card.style.display = purpose === purposeText ? "flex" : "none";
    });
  }
});

