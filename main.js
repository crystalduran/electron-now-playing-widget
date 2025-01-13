const { app, BrowserWindow } = require('electron');

const createWindow = () => {
  const win = new BrowserWindow({
    width: 401,
    height: 181,
    frame: false
  });

  win.loadFile('index.html');
}

app.whenReady().then(() => {
  createWindow();
})