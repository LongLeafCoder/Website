document.addEventListener('DOMContentLoaded', () => {
  const home = location.pathname.includes('/pages/') ? '../index.html' : 'index.html';
  const header = document.querySelector('header');
  const footer = document.querySelector('footer');
  if (header) {
    header.innerHTML = `<div class="wrap nav"><a class="mark" href="${home}">Tarheel Maker</a><nav aria-label="Main navigation"><a href="working-on.html">Working on</a><a href="about.html">About</a><a href="writings.html">Writings</a><a href="contact.html">Contact</a></nav><button class="menu" type="button" aria-label="Open menu">=</button></div>`;
    const menu = header.querySelector('.menu');
    menu.addEventListener('click', () => header.classList.toggle('open'));
  }
  if (footer) {
    footer.innerHTML = '<div class="wrap"><div class="footer-main"><div class="footer-brand"><strong>Tarheel Maker</strong><p>Wood-burned art, heritage woodworking, and thoughtful digital work.</p><p>Made in North Carolina.</p></div><div class="footer-column"><h3>Explore</h3><a href="working-on.html">Working on</a><a href="about.html">About</a><a href="writings.html">Writings</a></div><div class="footer-column"><h3>Connect</h3><a href="contact.html">Contact</a><a href="mailto:hello@alexmorgan.studio">Email</a></div><div class="footer-column"><h3>Elsewhere</h3><a href="https://www.instagram.com/">Instagram</a><a href="https://github.com/">GitHub</a></div></div><div class="footer-bottom"><span>© 2026 Tarheel Maker</span><span>Made with attention / North Carolina</span></div></div>';
    const adminLink = document.createElement('a');
    adminLink.className = 'admin-login-link';
    adminLink.href = 'https://app.pagescms.org';
    adminLink.target = '_blank';
    adminLink.rel = 'noopener noreferrer';
    adminLink.textContent = 'Admin login';
    adminLink.style.color = 'inherit';
    adminLink.style.marginInlineStart = '16px';
    footer.querySelector('.footer-bottom').append(adminLink);
  }
  const style = document.createElement('style');
  style.textContent = 'header .mark{display:flex;align-items:center;font:800 18px/1 Manrope,sans-serif;letter-spacing:-.05em}header nav a{display:inline-flex;align-items:center;min-height:34px;padding:0 10px;border:1px solid transparent;transition:.2s}header nav a:hover{border-color:rgba(243,238,229,.45);color:var(--sun)}header.open nav{display:flex;position:absolute;top:78px;left:0;right:0;flex-direction:column;gap:20px;padding:23px 18px 28px;background:var(--night)}footer{padding:62px 0 21px;color:#cfc5ba;background:#0f0d0c}footer .footer-main{display:grid;grid-template-columns:1.7fr repeat(3,1fr);gap:34px;padding-bottom:48px}footer .footer-brand{max-width:260px}footer .footer-brand strong{display:block;margin-bottom:13px;color:var(--linen);font-size:18px}footer .footer-brand p{margin:0 0 12px;color:#cfc5ba;font-size:13px}footer .footer-column h3{margin:4px 0 18px;color:#c98a66;font:500 11px DM Mono,monospace;letter-spacing:.1em;text-transform:uppercase}footer .footer-column a{display:inline-flex;align-items:center;min-height:32px;margin:0 5px 9px 0;padding:0 9px;border:1px solid transparent;color:#cfc5ba;font-size:13px}footer .footer-column a:hover{border-color:rgba(243,238,229,.35);color:var(--linen);background:rgba(169,88,53,.24)}footer .footer-bottom{display:flex;justify-content:space-between;gap:25px;border-top:1px solid rgba(243,238,229,.2);padding-top:19px;color:#998f85;font:10px DM Mono,monospace;letter-spacing:.07em;text-transform:uppercase}footer .footer-bottom span:first-child{color:var(--linen)}@media(max-width:800px){footer .footer-main{grid-template-columns:1fr 1fr;gap:32px 24px;padding-bottom:37px}footer .footer-brand{grid-column:1/-1}footer .footer-bottom{display:block;line-height:2}footer .footer-bottom span{display:block}}';
  document.head.appendChild(style);
});
