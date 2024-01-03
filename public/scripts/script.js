// scroll-top btn
const scrollUpBtn = document.querySelector(".scroll-top-btn");
scrollUpBtn.addEventListener("click", () => {
  window.scrollTo({ top: 0, behavior: "smooth" });
});

document.addEventListener("scroll", (event) => {
  if (window.scrollY > 100) scrollUpBtn.style.opacity = 1;
  else scrollUpBtn.style.opacity = 0;
});

// menu navbar
const toggleBox = document.querySelector("#toggle");
const menu = document.querySelector("#menu");

toggleBox.addEventListener("change", () => {
  if (toggleBox.checked) menu.classList.add("toggle-menu");
  else menu.classList.remove("toggle-menu");
});
