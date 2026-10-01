document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('img').forEach(image => {
    const source = image.getAttribute('src') || '';
    if (source.startsWith('background/') || source.startsWith('wood working/') || source === 'image000000.jpg') {
      image.src = `assets/images/${source}`;
    }
  });
  document.querySelectorAll('a[href]').forEach(link => {
    const target = link.getAttribute('href');
    if (/^(about|contact|writings|working-on)\.html$/.test(target)) link.href = `pages/${target}`;
  });
});
