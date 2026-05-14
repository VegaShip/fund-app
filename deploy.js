// ========== GitHub 部署脚本 ==========
// 把基金筛选应用推送到 GitHub，然后可在 Render 部署
// 使用: node deploy.js <GitHub用户名> <GitHubToken>

const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const git = require('isomorphic-git');
const http = require('isomorphic-git/http/node');

const USERNAME = process.argv[2];
const TOKEN = process.argv[3];
const REPO_NAME = 'fund-app';
const PROJECT_DIR = __dirname;

if (!USERNAME || !TOKEN) {
  console.log('使用方法: node deploy.js <GitHub用户名> <GitHubToken>');
  console.log('');
  console.log('获取 GitHub Token:');
  console.log('  1. 打开 https://github.com/settings/tokens');
  console.log('  2. 点击 "Generate new token" → "Generate new token (classic)"');
  console.log('  3. 勾选 "repo" 权限');
  console.log('  4. 生成后复制 Token');
  process.exit(1);
}

async function run() {
  // 1. 创建 GitHub 仓库
  console.log('📦 正在创建 GitHub 仓库...');
  const createResp = await fetch('https://api.github.com/user/repos', {
    method: 'POST',
    headers: {
      'Authorization': `token ${TOKEN}`,
      'Content-Type': 'application/json',
      'User-Agent': 'fund-app-deploy'
    },
    body: JSON.stringify({
      name: REPO_NAME,
      description: '基金筛选应用 - 实时收益率计算',
      private: false,
      auto_init: false
    })
  });

  if (!createResp.ok) {
    const err = await createResp.json();
    if (createResp.status === 422 && err.errors?.[0]?.message?.includes('already exists')) {
      console.log('  仓库已存在，继续推送...');
    } else {
      console.error('❌ 创建仓库失败:', err.message || JSON.stringify(err));
      process.exit(1);
    }
  } else {
    console.log('✅ 仓库创建成功');
  }

  // 2. 本地初始化 git 仓库
  console.log('📁 初始化本地仓库...');
  const gitDir = path.join(PROJECT_DIR, '.git');
  if (fs.existsSync(gitDir)) {
    fs.rmSync(gitDir, { recursive: true, force: true });
  }

  await git.init({ fs, dir: PROJECT_DIR });

  // 3. 添加所有文件（排除 node_modules）
  console.log('📄 添加文件...');
  const files = [];
  function walk(dir, relativePath = '') {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;
      if (entry.name === 'node_modules' || entry.name === '.git' ||
          entry.name.startsWith('test_') || entry.name.endsWith('.txt') ||
          entry.name === '.ngrok-') continue;
      if (entry.isDirectory()) {
        walk(fullPath, relPath);
      } else {
        files.push(relPath);
      }
    }
  }
  walk(PROJECT_DIR);

  for (const file of files) {
    await git.add({ fs, dir: PROJECT_DIR, filepath: file });
  }
  console.log(`  ${files.length} 个文件已添加`);

  // 4. 创建提交
  await git.commit({
    fs,
    dir: PROJECT_DIR,
    author: { name: USERNAME, email: `${USERNAME}@users.noreply.github.com` },
    message: '初始提交 - 基金筛选应用'
  });
  console.log('✅ 提交创建成功');

  // 5. 推送到 GitHub
  console.log('📤 推送到 GitHub...');
  const remoteURL = `https://${USERNAME}:${TOKEN}@github.com/${USERNAME}/${REPO_NAME}.git`;

  try {
    await git.push({
      fs,
      http,
      dir: PROJECT_DIR,
      url: remoteURL,
      ref: 'main',
      onProgress: (p) => {
        if (p.phase === 'counting') console.log('  正在统计...');
        if (p.phase === 'pushing') console.log('  正在推送...');
      }
    });
    console.log('✅ 推送成功!');
  } catch (e) {
    // 可能 main 分支不存在，试试 master
    try {
      // 重命名分支
      await git.branch({ fs, dir: PROJECT_DIR, ref: 'main', checkout: true });
      await git.push({
        fs, http, dir: PROJECT_DIR, url: remoteURL, ref: 'main'
      });
      console.log('✅ 推送成功!');
    } catch (e2) {
      console.error('❌ 推送失败:', e2.message);
      process.exit(1);
    }
  }

  console.log(`\n========================================`);
  console.log(`  🎉 部署完成!`);
  console.log(`  GitHub 仓库: https://github.com/${USERNAME}/${REPO_NAME}`);
  console.log(`========================================`);
  console.log(`\n下一步：部署到 Render.com`);
  console.log(`  1. 打开 https://render.com 注册/登录（用 GitHub 账号）`);
  console.log(`  2. 点 "New +" → "Web Service"`);
  console.log(`  3. 选择仓库 "fund-app"`);
  console.log(`  4. 填写:`);
  console.log(`     - Name: fund-app`);
  console.log(`     - Region: Singapore`);
  console.log(`     - Build Command: npm install`);
  console.log(`     - Start Command: node server.js`);
  console.log(`     - Plan: Free`);
  console.log(`  5. 点 "Create Web Service"`);
  console.log(`  6. 等 2-3 分钟部署完成即可使用`);
}

run().catch(e => {
  console.error('❌ 错误:', e.message);
  process.exit(1);
});
