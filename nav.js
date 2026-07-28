// Mobile hamburger nav — toggles the dropdown menu on small screens.
// Desktop shows the links inline (this is a no-op there).
function toggleNav(btn) {
  const links = document.getElementById("nav-links");
  if (!links) return;
  const open = links.classList.toggle("open");
  if (btn) btn.setAttribute("aria-expanded", open ? "true" : "false");
}

// Close the dropdown when tapping anywhere outside it.
document.addEventListener("click", function (e) {
  const links = document.getElementById("nav-links");
  if (!links || !links.classList.contains("open")) return;
  if (e.target.closest("#nav-links") || e.target.closest(".nav-toggle")) return;
  links.classList.remove("open");
  const btn = document.querySelector(".nav-toggle");
  if (btn) btn.setAttribute("aria-expanded", "false");
});
