const selectButtons = document.querySelectorAll(".select-btn");
const modals = document.querySelectorAll(".mixture-modal");
const okButtons = document.querySelectorAll(".ok-btn");

// show correct modal
selectButtons.forEach((btn, index) => {
  btn.addEventListener("click", () => {
    modals[index].style.display = "flex";
  });
});

// close modal when OK is pressed
okButtons.forEach((ok, index) => {
  ok.addEventListener("click", () => {
    modals[index].style.display = "none";
  });
});
