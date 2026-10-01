document.addEventListener('DOMContentLoaded', async () => {
  const inPages = location.pathname.includes('/pages/');
  const root = inPages ? '../' : '';
  const response = await fetch(`${root}content/posts.json`, { cache: 'no-cache' });
  if (!response.ok) return;

  const data = await response.json();
  const posts = Array.isArray(data.posts) ? data.posts : [];
  const detail = document.querySelector('[data-writing-detail]');
  const homeGrid = document.querySelector('.journal-grid');
  const writingsGrid = document.querySelector('.posts');

  const postTimestamp = post => {
    const value = String(post.date || '').trim();
    const monthFirst = value.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
    if (monthFirst) {
      const month = Number(monthFirst[1]);
      const day = Number(monthFirst[2]);
      const shortYear = Number(monthFirst[3]);
      const year = shortYear < 100 ? shortYear + (shortYear < 70 ? 2000 : 1900) : shortYear;
      return Date.UTC(year, month - 1, day);
    }

    const timestamp = Date.parse(value);
    return Number.isNaN(timestamp) ? 0 : timestamp;
  };

  const postUrl = post => `${root}pages/writing.html?slug=${encodeURIComponent(post.slug)}`;
  const articleHref = post => (post && post.path) ? `${root}${post.path}` : postUrl(post);

  const createCard = (post, compact) => {
    const article = document.createElement('article');
    article.className = 'post';

    const imageLink = document.createElement('a');
    imageLink.className = 'post-image';
    imageLink.href = articleHref(post);
    imageLink.style.display = 'block';

    if (post.image) {
      const image = document.createElement('img');
      const positionPortrait = () => {
        if (image.naturalHeight > image.naturalWidth) image.style.objectPosition = 'center top';
      };
      image.addEventListener('load', positionPortrait, { once: true });
      image.src = post.image;
      image.alt = post.imageAlt || '';
      image.loading = 'lazy';
      if (image.complete) positionPortrait();
      imageLink.append(image);
    }
    article.append(imageLink);

    const meta = document.createElement('div');
    meta.className = 'post-meta mono';
    const category = document.createElement('span');
    category.textContent = post.category || 'Note';
    const date = document.createElement('span');
    date.textContent = post.date || '';
    meta.append(category, date);
    article.append(meta);

    const title = document.createElement(compact ? 'h3' : 'h2');
    title.textContent = post.title || 'Untitled';
    article.append(title);

    const summary = document.createElement('p');
    summary.textContent = post.summary || '';
    article.append(summary);

    const link = document.createElement('a');
    link.className = compact ? 'post-link' : 'read';
    link.href = articleHref(post);
    link.textContent = 'Read more ↗';
    article.append(link);
    return article;
  };

  if (homeGrid) {
    const latestPosts = [...posts].sort((first, second) => postTimestamp(second) - postTimestamp(first));
    homeGrid.replaceChildren(...latestPosts.slice(0, 3).map(post => createCard(post, true)));
  }
  if (writingsGrid) {
    writingsGrid.replaceChildren(...posts.map(post => createCard(post, false)));
  }

  if (!detail) return;
  const slug = new URLSearchParams(location.search).get('slug');
  const post = posts.find(entry => entry.slug === slug);
  if (!post) {
    document.querySelector('[data-writing-title]').textContent = 'Writing not found';
    return;
  }

  document.title = `${post.title} — Tarheel Maker`;
  document.querySelector('[data-writing-meta]').textContent = `${post.category || 'Writing'} / ${post.date || ''}`;
  document.querySelector('[data-writing-title]').textContent = post.title;
  document.querySelector('[data-writing-summary]').textContent = post.summary || '';
  const cover = document.querySelector('[data-writing-cover]');
  const coverImage = document.querySelector('[data-writing-image]');
  if (post.image && cover && coverImage) {
    coverImage.src = post.image;
    coverImage.alt = post.imageAlt || '';
    cover.hidden = false;
  }
  const body = document.querySelector('[data-writing-body]');
  const paragraphs = String(post.body || '').split(/\n\s*\n/).filter(paragraph => paragraph.trim());
  body.replaceChildren(...paragraphs.map(text => {
    const paragraph = document.createElement('p');
    paragraph.textContent = text;
    return paragraph;
  }));
});
