document.addEventListener('DOMContentLoaded', () => {
  const target = document.querySelector('footer .footer-bottom, footer .footer-row, footer .wrap');
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
