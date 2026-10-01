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

  const postUrl = post => {
    if (post.path) return `${root}${post.path}`;
    return `${root}pages/writing.html?slug=${encodeURIComponent(post.slug)}`;
  };

  const createCard = (post, compact) => {
    const article = document.createElement('article');
    article.className = 'post';

    const imageLink = document.createElement('a');
    imageLink.className = 'post-image';
    imageLink.href = postUrl(post);
    imageLink.style.display = 'block';

    if (post.image) {
      const image = document.createElement('img');
      image.src = post.image;
      image.alt = post.imageAlt || '';
      image.loading = 'lazy';
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
    link.href = postUrl(post);
    link.textContent = 'Read note ↗';
    article.append(link);
    return article;
  };

  if (homeGrid) {
    homeGrid.replaceChildren(...posts.slice(0, 3).map(post => createCard(post, true)));
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
  const body = document.querySelector('[data-writing-body]');
  const paragraphs = String(post.body || '').split(/\n\s*\n/).filter(paragraph => paragraph.trim());
  body.replaceChildren(...paragraphs.map(text => {
    const paragraph = document.createElement('p');
    paragraph.textContent = text;
    return paragraph;
  }));
});
