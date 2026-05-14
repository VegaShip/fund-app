// ========== 内网穿透 - 外网访问 ==========
// 使用 localtunnel (不需要注册账号)
// 使用: node tunnel.js [端口号]

const http = require('http');
const PORT = process.argv[2] || 3000;

// 健康检查：等待本地服务启动
function waitForServer(maxWait = 15000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      const req = http.get(`http://127.0.0.1:${PORT}`, (res) => resolve());
      req.on('error', () => {
        if (Date.now() - start > maxWait) reject(new Error('服务启动超时'));
        else setTimeout(check, 500);
      });
      req.setTimeout(2000, () => { req.destroy(); setTimeout(check, 500); });
    };
    check();
  });
}

(async () => {
  try {
    console.log('⏳ 等待本地服务启动...');
    await waitForServer();
    console.log(`✅ 本地服务 http://127.0.0.1:${PORT} 已就绪\n`);

    // ========== 方式1: localtunnel ==========
    try {
      console.log('📡 正在创建外网隧道 (localtunnel)...');
      const localtunnel = require('localtunnel');
      const tunnel = await localtunnel({ port: PORT, subdomain: '' });

      console.log('\n========================================');
      console.log('  📡 外网访问地址:');
      console.log(`  ${tunnel.url}`);
      console.log('========================================');
      console.log('  手机浏览器打开上方地址即可访问');
      console.log('  注意: 每次启动 URL 会变化');
      console.log('  该链接有效期为当前进程运行期间');
      console.log('========================================\n');

      tunnel.on('close', () => {
        console.log('  隧道已关闭');
      });

      process.on('SIGINT', () => {
        console.log('\n正在关闭隧道...');
        tunnel.close();
        process.exit(0);
      });
      return;
    } catch (e) {
      console.error('  localtunnel 启动失败:', e.message);
    }

    // ========== 方式2: ngrok (如果安装了) ==========
    try {
      const ngrok = require('ngrok');
      console.log('📡 正在创建隧道 (ngrok)...');
      const url = await ngrok.connect({ addr: PORT });
      console.log(`\n  ✅ 外网访问地址: ${url}\n`);
      process.on('SIGINT', async () => { await ngrok.kill(); process.exit(0); });
      return;
    } catch {}

    // ========== 都不行 ==========
    console.error('\n❌ 无法创建外网隧道');
    console.log('\n替代方案:');
    console.log('  方案1 - VSCode Ports Forwarding:');
    console.log('    在 VSCode 终端底部点击"PORTS" → Forward a Port → 输入 3000');
    console.log('  方案2 - SSH 隧道 (需要一台公网服务器):');
    console.log('    ssh -R 80:localhost:3000 your-server.com');
    console.log('  方案3 - 使用 frp 内网穿透:');
    console.log('    https://github.com/fatedier/frp');
    console.log('  方案4 - 使用 Cloudflare Tunnel:');
    console.log('    https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/');
    process.exit(1);
  } catch (e) {
    console.error('\n❌ 错误:', e.message);
    process.exit(1);
  }
})();
