// Ash Mountain Shrine: desktop wrapper. Serves the bundled game from an app:// scheme so modules,
// models and fonts load fully offline, and keeps the window from reaching the network.
const { app, BrowserWindow, protocol, net, session, Menu } = require('electron');
const path = require('path'); const { pathToFileURL } = require('url');
protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);
const ROOT = path.join(__dirname, 'game');
app.whenReady().then(() => {
  protocol.handle('app', req => {
    const u = new URL(req.url); const rel = decodeURIComponent(u.pathname).replace(/^\/+/, '') || 'index.html';
    const file = path.normalize(path.join(ROOT, rel));
    if (!file.startsWith(ROOT)) return new Response('no', { status: 403 });
    return net.fetch(pathToFileURL(file).toString());
  });
  session.defaultSession.webRequest.onBeforeRequest((d, cb) => cb({ cancel: !/^(app|file|devtools|data|blob):/.test(d.url) }));
  Menu.setApplicationMenu(null);
  const win = new BrowserWindow({ width: 1280, height: 800, title: 'Ash Mountain Shrine', backgroundColor: '#1d1a2b', autoHideMenuBar: true, webPreferences: { contextIsolation: true, sandbox: true } });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('before-input-event', (e, i) => { if (i.type === 'keyDown' && i.key === 'F11') win.setFullScreen(!win.isFullScreen()); });
  if (process.env.ASH_SHOT) win.webContents.once('did-finish-load', () => setTimeout(async () => { require('fs').writeFileSync(process.env.ASH_SHOT, (await win.webContents.capturePage()).toPNG()); const r = await win.webContents.executeJavaScript('JSON.stringify({protos:Object.keys(window.__shrine?.vrmProto||{}), fonts:document.fonts.check("16px \'Zen Maru Gothic\'")})'); console.log('ASHCHECK', r); app.quit(); }, +process.env.ASH_WAIT || 15000));
  win.loadURL('app://game/index.html');
});
app.on('window-all-closed', () => app.quit());
