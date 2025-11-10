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
