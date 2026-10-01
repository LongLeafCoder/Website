document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('img').forEach(image => {
    const source = image.getAttribute('src') || '';
    if (source.startsWith('wood working/')) image.src = `../assets/${source}`;
  });
});
