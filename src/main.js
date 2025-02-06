const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

let win;

// Handle deep linking on Windows
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('spotify-desktop-controller', process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  app.setAsDefaultProtocolClient('spotify-desktop-controller');
}

const createWindow = () => {
  win = new BrowserWindow({
    width: 401,
    height: 181,
    frame: false,
    resizable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  win.webContents.on('dom-ready', () => {
    win.webContents.insertCSS('body { overflow: hidden; margin: 0; padding: 0;}');
  });

  // escuchar el evento 'close' de la ventana para eliminar el token
  win.on('close', () => {
    // ejecución del script para borrar el token en el almacenamiento
    win.webContents.executeJavaScript('localStorage.removeItem("spotify_access_token");');
  });

  win.setPosition(50, 500);

  win.loadFile('index.html');
};

// handle the URL on Windows
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine) => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();

      // handle the URL from command line
      const url = commandLine.pop();
      if (url) handleUrl(url);
    }
  });
}

// URL handler function
function handleUrl(url) {
  const urlObj = new URL(url);
  const hash = urlObj.hash.substring(1); 
  const params = new URLSearchParams(hash);
  win.webContents.send('auth-callback', Object.fromEntries(params));
}

// Handle URLs on macOS
app.on('open-url', (event, url) => {
  event.preventDefault();
  handleUrl(url);
});

app.whenReady().then(() => {
  createWindow();

  // handle URLs passed on app launch
  const args = process.argv;
  if (args.length > 1) {
    const url = args[args.length - 1];
    if (url.startsWith('spotify-desktop-controller://')) {
      handleUrl(url);
    }
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

ipcMain.on('close-app', () => {
  if (win) {
    win.close();
  }
});