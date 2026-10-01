# Tarheel Maker

## Hosting on Cloudflare Pages

1. Push this repository to GitHub, then create a Cloudflare Pages project connected to `LongLeafCoder/Website`.
2. Select the `main` production branch, choose the `None` framework preset, leave the build command blank, and use `.` as the build output directory.
3. Cloudflare Pages will publish each commit pushed to `main`.

## Editing the site

The site uses [Pages CMS](https://pagescms.org/) for GitHub-backed editing. Sign in at [app.pagescms.org](https://app.pagescms.org) with GitHub and select this repository. The `.pages.yml` configuration exposes the site pages as code editors and the writing posts as structured entries. Saving in Pages CMS commits to GitHub; Cloudflare Pages then deploys that commit.

The footer's **Admin login** link opens Pages CMS. The login is handled by GitHub, so no site password or GitHub token is stored in the website files.

The `content/posts.json` data powers the home page journal, writings index, and the detail page for new posts. Add a post in the CMS Posts editor; use a unique URL slug, enter the summary and body, and leave the optional existing-article path blank for a new post.
