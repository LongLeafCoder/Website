document.addEventListener('DOMContentLoaded', () => {
  const footer = document.querySelector('footer');
  if (!footer) return;

  const elsewhere = [...footer.querySelectorAll('.footer-column')].find(column =>
    column.querySelector('h3')?.textContent.trim().toLowerCase() === 'elsewhere'
  );
  const footerTarget = elsewhere || footer.querySelector('.footer-bottom, .footer-row, .wrap');
  if (footerTarget && !footer.querySelector('a[href="https://pin.it/8JbKgV1SU"]')) {
    const pinterestLink = document.createElement('a');
    pinterestLink.href = 'https://pin.it/8JbKgV1SU';
    pinterestLink.target = '_blank';
    pinterestLink.rel = 'noopener noreferrer';
    pinterestLink.textContent = 'Pinterest';
    footerTarget.append(pinterestLink);
  }

  const target = footer.querySelector('.footer-bottom, .footer-row, .wrap');
  if (!target || target.querySelector('.admin-login-link')) return;

  const link = document.createElement('a');
  link.className = 'admin-login-link';
  link.href = 'https://app.pagescms.org';
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = 'Admin login';
  link.style.color = 'inherit';
  link.style.marginInlineStart = '16px';
  target.append(link);
});
