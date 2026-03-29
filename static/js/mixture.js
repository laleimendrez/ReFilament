// mixture.js

const selectButtons = document.querySelectorAll(".select-btn");
const modals        = document.querySelectorAll(".mixture-modal");
const okButtons     = document.querySelectorAll(".ok-btn");

// Open modal on SELECT click
selectButtons.forEach((btn, index) => {
  btn.addEventListener("click", () => {
    modals[index].style.display = "flex";
  });
});

// Close modal on CLOSE click
okButtons.forEach((ok, index) => {
  ok.addEventListener("click", () => {
    modals[index].style.display = "none";
  });
});

// Close modal on backdrop click
modals.forEach((modal) => {
  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      modal.style.display = "none";
    }
  });
});