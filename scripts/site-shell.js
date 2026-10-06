(() => {
  const renderShell = () => {
    if (!document.getElementById('site-effects-script')) {
      const effectsScript = document.createElement('script');
      effectsScript.id = 'site-effects-script';
      effectsScript.src = '/scripts/site-effects.js';
      document.head.append(effectsScript);
    }

    if (!document.querySelector('link[href*="family=Newsreader"]')) {
      const fontLink = document.createElement('link');
      fontLink.rel = 'stylesheet';
      fontLink.href = 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600;6..72,700&display=swap';
      document.head.append(fontLink);
    }

    const header = document.querySelector('header');
    const footer = document.querySelector('footer');
    if (header) {
      header.id = 'site-header';
      header.innerHTML = '<div class="wrap nav"><a class="mark" href="/index.html">Tarheel Maker</a><nav aria-label="Main navigation"><a href="/pages/working-on.html">Working on</a><a href="/pages/about.html">About</a><a href="/pages/writings.html">Writings</a><a href="/pages/contact.html">Contact</a></nav><button class="menu" id="menu" type="button" aria-label="Open menu" aria-expanded="false">=</button></div>';
      const menu = header.querySelector('.menu');
      menu.addEventListener('click', () => {
        const open = header.classList.toggle('open');
        menu.setAttribute('aria-expanded', String(open));
        menu.textContent = open ? 'x' : '=';
      });
      header.querySelectorAll('nav a').forEach(link => link.addEventListener('click', () => {
        header.classList.remove('open');
        menu.setAttribute('aria-expanded', 'false');
        menu.textContent = '=';
      }));
    }

    if (footer) {
      footer.id = 'site-footer';
      footer.innerHTML = '<div class="wrap"><div class="footer-main"><div class="footer-brand"><strong>Tarheel Maker</strong><p>Wood-burned art, heritage woodworking, and thoughtful digital work.</p><p>Made in North Carolina.</p></div><div class="footer-column"><h3>Explore</h3><a href="/pages/working-on.html">What I’m working on</a><a href="/pages/about.html">About</a><a href="/pages/writings.html">Writings</a><a href="/pages/contact.html">Contact</a></div><div class="footer-column"><h3>Elsewhere</h3><a href="https://pin.it/8JbKgV1SU" target="_blank" rel="noopener noreferrer">Pinterest</a><a href="https://oldsouthwoodworks.com" target="_blank" rel="noopener noreferrer">Old South Woodworks</a></div></div><div class="footer-bottom"><span>© 2026 Tarheel Maker</span><span>Made with attention / North Carolina</span><a class="admin-login-link" href="https://app.pagescms.org" target="_blank" rel="noopener noreferrer">Admin login</a></div></div>';
    }

    if (!document.getElementById('shared-site-shell-styles')) {
      const style = document.createElement('style');
      style.id = 'shared-site-shell-styles';
      style.textContent = `
        #site-header { position: fixed; z-index: 10; top: 0; width: 100%; color: #f6f0e7; background: rgba(63,48,41,.94); border-bottom: 1px solid rgba(243,238,229,.2); box-shadow: 0 8px 24px rgba(63,48,41,.12); backdrop-filter: blur(10px); }
        #site-header .wrap, #site-footer .wrap { width: min(1240px, calc(100% - 72px)); margin: 0 auto; }
        #site-header .nav { display: flex; align-items: center; justify-content: space-between; min-height: 94px; }
        #site-header .mark { display: flex; align-items: center; color: inherit; font: 600 19px/1 'Newsreader', serif; letter-spacing: 0; text-decoration: none; }
        #site-header nav { display: flex; gap: 31px; font: 600 11px 'DM Sans', sans-serif; letter-spacing: 0; text-transform: uppercase; }
        #site-header nav a { display: inline-flex; align-items: center; min-height: 34px; padding: 0 10px; border: 1px solid transparent; color: inherit; text-decoration: none; opacity: .88; transition: background .2s, border-color .2s, color .2s; }
        #site-header nav a:hover { border-color: transparent; color: #efc8a5; opacity: 1; }
        #site-header .menu { display: none; width: 42px; height: 42px; border: 0; color: inherit; background: transparent; font: 600 22px 'DM Sans', sans-serif; cursor: pointer; }
        #site-footer { padding: 54px 0 20px; color: #e1d5c8; background: #302720; font: 400 16px/1.5 'DM Sans', sans-serif; letter-spacing: 0; text-transform: none; }
        #site-footer .footer-main { display: grid; grid-template-columns: minmax(230px,1.6fr) repeat(2,minmax(0,1fr)); gap: 40px; padding-bottom: 38px; }
        #site-footer .footer-brand { max-width: 300px; }
        #site-footer .footer-brand strong { display: block; margin-bottom: 14px; color: #f6f0e7; font: 600 24px/1.1 'Newsreader', serif; }
        #site-footer .footer-brand p { margin: 0 0 12px; color: #cfc5ba; font-size: 13px; line-height: 1.55; }
        #site-footer .footer-column h3 { margin: 4px 0 12px; color: #d5a17b; font: 600 11px 'DM Sans', sans-serif; letter-spacing: 0; text-transform: uppercase; }
        #site-footer .footer-column a { display: flex; width: fit-content; align-items: center; min-height: 30px; margin: 0; padding: 3px 0; border-bottom: 1px solid transparent; color: #e1d5c8; font-size: 13px; text-decoration: none; transition: border-color .2s, color .2s; }
        #site-footer .footer-column a:hover { border-bottom-color: #d5a17b; color: #f6f0e7; }
        #site-footer .footer-bottom { display: flex; align-items: center; justify-content: space-between; gap: 20px; border-top: 1px solid rgba(243,238,229,.2); padding-top: 16px; color: #c9b9aa; font: 500 11px 'DM Sans', sans-serif; }
        #site-footer .footer-bottom > span:first-child { color: #f6f0e7; }
        #site-footer .admin-login-link { color: inherit; text-decoration: none; }
        #site-footer .admin-login-link:hover { color: #f6f0e7; text-decoration: underline; }
        @media (max-width: 800px) {
          #site-header .wrap, #site-footer .wrap { width: calc(100% - 36px); }
          #site-header .nav { min-height: 78px; }
          #site-header nav { display: none; }
          #site-header .menu { display: block; }
          #site-header.open nav { position: absolute; top: 78px; left: 0; right: 0; display: flex; flex-direction: column; gap: 10px; padding: 20px 18px 24px; background: #3f3029; }
          #site-footer .footer-main { grid-template-columns: 1fr 1fr; gap: 28px 24px; padding-bottom: 32px; }
          #site-footer .footer-brand { grid-column: 1 / -1; }
          #site-footer .footer-bottom { display: flex; flex-wrap: wrap; line-height: 1.6; }
        }
      `;
      document.head.append(style);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderShell, { once: true });
  } else {
    renderShell();
  }
})();
