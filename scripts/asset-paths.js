document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('a[href]').forEach(link => {
    const target = link.getAttribute('href');
    if (/^(about|contact|writings|working-on)\.html$/.test(target)) link.href = `pages/${target}`;
  });
});
