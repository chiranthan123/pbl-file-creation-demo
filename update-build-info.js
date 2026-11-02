const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function getGitCommit() {
  // Check Vercel commit SHA environment variable first
  if (process.env.VERCEL_GIT_COMMIT_SHA) {
    return process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7);
  }
  // Check GitHub Actions SHA if available
  if (process.env.GITHUB_SHA) {
    return process.env.GITHUB_SHA.slice(0, 7);
  }
  // Fallback to git CLI
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  } catch (err) {
    console.warn('[build] Could not determine commit hash via git CLI:', err.message);
    return 'main';
  }
}

function getFormattedTimestamp() {
  const now = new Date();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[now.getMonth()];
  const day = now.getDate();
  const year = now.getFullYear();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${month} ${day}, ${year}, ${hours}:${minutes}`;
}

function injectBuildInfo() {
  const commit = getGitCommit();
  const timestamp = getFormattedTimestamp();
  const buildString = `Build: ${commit} | ${timestamp}`;

  const indexPath = path.join(__dirname, 'index.html');
  if (!fs.existsSync(indexPath)) {
    console.error('[build] Error: index.html not found at', indexPath);
    process.exit(1);
  }

  let html = fs.readFileSync(indexPath, 'utf8');

  // Replace version text inside element with id="buildVersionText"
  const versionTextRegex = /<span id="buildVersionText">[\s\S]*?<\/span>/;
  if (versionTextRegex.test(html)) {
    html = html.replace(versionTextRegex, `<span id="buildVersionText">${buildString}</span>`);
  }

  // Replace or inject window.__BUILD_INFO__ script
  const buildMetaRegex = /<script id="build-meta">[\s\S]*?<\/script>/;
  const buildInfoScript = `window.__BUILD_INFO__ = { commit: "${commit}", timestamp: "${timestamp}", full: "${buildString}" };`;
  if (buildMetaRegex.test(html)) {
    html = html.replace(buildMetaRegex, `<script id="build-meta">${buildInfoScript}</script>`);
  }

  fs.writeFileSync(indexPath, html, 'utf8');
  console.log(`[build] Successfully injected build info into index.html: "${buildString}"`);
}

injectBuildInfo();

