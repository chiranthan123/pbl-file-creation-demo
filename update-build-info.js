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

function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();
  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    fs.readdirSync(src).forEach((childItemName) => {
      copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
    });
  } else if (exists) {
    fs.copyFileSync(src, dest);
  }
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

  // Synchronize build assets into "public" output directory for Vercel
  const publicDir = path.join(__dirname, 'public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  // Copy files
  ['index.html', 'sw.js', 'manifest.json'].forEach((file) => {
    const src = path.join(__dirname, file);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(publicDir, file));
    }
  });

  // Copy demo folder if exists
  const demoFolder = path.join(__dirname, 'PWA_Demo_Folder');
  if (fs.existsSync(demoFolder)) {
    copyRecursiveSync(demoFolder, path.join(publicDir, 'PWA_Demo_Folder'));
  }

  console.log('[build] Successfully synced static assets into "public/" directory for deployment');
}

injectBuildInfo();
