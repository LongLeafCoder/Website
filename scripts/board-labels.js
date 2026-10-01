document.addEventListener('DOMContentLoaded', () => {
  const labels = {
    'Pig CB.jpeg': { title: 'Pig-shaped cutting board', category: 'Cutting board' },
    'Pig CB2.jpg': { title: 'Pig-shaped cutting board', category: 'Cutting board' },
    'first_in_freedom.jpeg': { title: 'North Carolina cutting board', category: 'Cutting board' },
    'NC light house.jpg': { title: 'North Carolina lighthouse cutting board', category: 'Cutting board' },
    'Resized_20260203_164604.jpeg': { title: 'Pig-shaped cutting board', category: 'Cutting board' }
  };
  document.querySelectorAll('img').forEach(image => {
    const filename = decodeURIComponent(image.src).split('/').pop();
    const label = labels[filename];
    if (!label) return;
    const card = image.closest('.side-project, .card');
    if (!card) return;
    const title = card.querySelector('h3');
    const category = card.querySelector('.mono');
    if (title) title.textContent = label.title;
    if (category) category.textContent = label.category;
  });
});
