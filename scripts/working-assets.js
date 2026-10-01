document.addEventListener('DOMContentLoaded', () => {
  const movedImages = new Set([
    '20260501_170708.jpg',
    'Pig CB.jpeg',
    'Pig CB2.jpg',
    'Tabbaco Stick Flag.jpeg',
    'first_in_freedom.jpeg',
    'Resized_20260203_164604.jpeg',
    'NC light house.jpg'
  ]);
  document.querySelectorAll('img').forEach(image => {
    const filename = decodeURIComponent(image.getAttribute('src') || '').split('/').pop();
    if (movedImages.has(filename)) image.src = `wood working/${filename}`;
  });
});
