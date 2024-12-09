const { app, BrowserWindow, ipcMain, webContents } = require('electron')
const { promisify } = require('util');
const path = require('node:path')
const fs = require('fs/promises');

const sleep = promisify(setTimeout);

let win;

const { GPT4V } = require('./agents');
const controller = new GPT4V();

function extractJsonFromMarkdown(mdString) {
  const regex = /```json\s*([\s\S]+?)\s*```/;
  const match = mdString.match(regex);
  if (!match) return null;
  const jsonString = match[1].trim();
  try {
      return JSON.parse(jsonString);
  } catch (err) {
      console.error('Failed to parse JSON:', err);
      return null;
  }
}

async function ensureTmpFolder() {
  try {
    await fs.access('tmp');
  } catch {
    await fs.mkdir('tmp');
  }
}

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 720,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#18181b',
      symbolColor: '#74b1be'
    },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      webviewTag: true,
      contextIsolation: false
    }
  })

  ipcMain.on('current-url', (event, url) => {
    win.webContents.send('update-url', url);
  });

  win.loadFile('index.html')
}

app.whenReady().then(async () => {
  await ensureTmpFolder();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  });

  let webview;
  let labelData;
  ipcMain.on('webview-ready', async (event, id) => {
    webview = webContents.fromId(id);
    console.log(`Acquired webviewId ${id}`);
  });

  ipcMain.on('label-data', (event, data) => {
    labelData = JSON.parse(data);
  });

  async function screenshot() {
    webview.send('observer', 'screenshot-start');
    await sleep(100);
    const image = await webview.capturePage();
    webview.send('observer', 'screenshot-end');

    const imageData = image.toPNG();
    await controller.uploadImageData(imageData);
  }

  ipcMain.on('screenshot', async (event, id) => screenshot());

  let currentTask;
  let executing = false;
  
  async function executeAction(data) {
    if (!data || data.nextAction.action === 'done') return false;
    
    let label;
    if (data.nextAction.element) {
      label = labelData.find(i => i.id == data.nextAction.element);
    }

    switch(data.nextAction.action) {
      case "click":
        console.log(`clicking ${JSON.stringify(label)}`);
        if(label === undefined)
          return false;
        let { x, y } = label;
        webview.sendInputEvent({
          type: 'mouseDown', 
          x, y,
          clickCount: 1
        });
        webview.sendInputEvent({
          type: 'mouseUp', 
          x, y,
          clickCount: 1
        });
        break;
      case "type": {
        console.log(`typing ${data.nextAction.text} into ${JSON.stringify(labelData[data.nextAction.element])}`);
        let { x, y } = label;
        webview.sendInputEvent({
          type: 'mouseDown', 
          x, y,
          clickCount: 1
        });
        webview.sendInputEvent({
          type: 'mouseUp', 
          x, y,
          clickCount: 1
        });

        for(let char of data.nextAction.text) {
          webview.sendInputEvent({
            type: 'char', 
            keyCode: char
          });
        }
        break;
      }
      default:
        console.log(`unknown action ${JSON.stringify(data.nextAction)}`);
        return false;
    }
    return true;
  }

  ipcMain.on('send', async (event, text) => {
    currentTask = text;
    executing = true;
    win.webContents.send('thinking', true);
    await screenshot();
    await controller.send(text);
  });

  ipcMain.on('continue', async (event, text) => {
    if (!executing) return;
    win.webContents.send('thinking', true);
    await screenshot();
    await controller.send(currentTask);
  });

  ipcMain.on('execute', async (event, text) => {
    if (!executing) return;
    const success = await executeAction(lastData);
    if (success) {
      await sleep(500);
      ipcRenderer.send('continue');
    }
  });

  let lastData;
  controller.on('end_turn', async (content) => {
    if (BrowserWindow.getAllWindows().length === 0) return;

    lastData = extractJsonFromMarkdown(content);
    let msg = lastData === null ? content : lastData.thought;
    win.webContents.send('end_turn', msg);
    win.webContents.send('thinking', false);

    if (!lastData || !executing) return;
    
    if (lastData.nextAction.action === 'done') {
      executing = false;
      return;
    } else {
      win.webContents.send('thinking', true);
    }

    const success = await executeAction(lastData);
    if (success) {
      await sleep(500);
      await screenshot();
      await controller.send(currentTask);
    }
  });

  await controller.initialize();
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})