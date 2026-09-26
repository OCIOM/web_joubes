// Galerie de la fiche fauteuil : clic sur une vignette = change la grande photo.
(function () {
  var principale = document.getElementById('photo-principale');
  var boutons = document.querySelectorAll('.vignettes button');
  if (!principale || !boutons.length) return;
  boutons.forEach(function (b) {
    b.addEventListener('click', function () {
      principale.src = b.dataset.src;
      principale.alt = b.dataset.alt || principale.alt;
      boutons.forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
    });
  });
})();
