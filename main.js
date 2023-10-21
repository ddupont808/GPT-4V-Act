const { app, BrowserWindow, ipcMain, webContents } = require('electron')
const { promisify } = require('util');
const path = require('node:path')
const fs = require('fs/promises');

const sleep = promisify(setTimeout);

const OpenAIChatController = require('./chatgpt');
let win;

const controller = new OpenAIChatController();

const prompt = (task, info) => `task: ${task}

type ClickAction = { action: "click", element: number }
type TypeAction = { action: "type", element: number, text: string }
type ScrollAction = { action: "scroll", direction: "up" | "down" }
type RequestInfoFromUser = { action: "request-info", prompt: string }
type RememberInfoFromSite = { action: "remember-info", info: string }
type Done = { action: "done" }

## response format
{
  briefExplanation: string,
  nextAction: ClickAction | TypeAction | ScrollAction | RequestInfoFromUser | RememberInfoFromSite | Done
}

## response examples
{
  "briefExplanation": "I'll type 'funny cat videos' into the search bar"
  "nextAction": { "action": "type", "element": 11, "text": "funny cat videos" }
}
{
  "briefExplanation": "Today's doodle looks interesting, I'll click it"
  "nextAction": { "action": "click", "element": 9 }
}
{
  "briefExplanation": "I have to login to create a post"
  "nextAction": { "action": "request-info", "prompt": "What is your login information?" }
}
{
  "briefExplanation": "Today's doodle is about Henrietta Lacks, I'll remember that for our blog post"
  "nextAction": { "action": "remember-info", "info": "Today's doodle is about Henrietta Lacks" }
}

## stored info
${JSON.stringify(info)}

## instructions
# observe the screenshot, and think about the next action
# output your response in a json markdown code block
`;

function extractJsonFromMarkdown(mdString) {
  const regex = /```json\s*([\s\S]+?)\s*```/; // This captures content between ```json and ```

  const match = mdString.match(regex);
  if (!match) return null;  // No JSON block found

  const jsonString = match[1].trim();

  try {
      return JSON.parse(jsonString);
  } catch (err) {
      console.error('Failed to parse JSON:', err);
      return null;  // Invalid JSON content
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
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  });

  let webviewId;
  let labelData;
  ipcMain.on('webview-ready', async (event, id) => {
    webviewId = id;
    console.log('Acquired webviewId ' + webviewId);
  });

  ipcMain.on('label-data', (event, data) => {
    labelData = JSON.parse(data);
  });

  async function screenshot() {
    const wc = webContents.fromId(webviewId);
    wc.send('observer', 'screenshot-start');
    await sleep(100);
    const image = await wc.capturePage();
    wc.send('observer', 'screenshot-end');
    await fs.writeFile('tmp/screenshot.png', image.toPNG());
    await controller.uploadImage('tmp/screenshot.png');
  }

  ipcMain.on('screenshot', async (event, id) => screenshot());

  let currentTask;
  
  ipcMain.on('send', async (event, text) => {
    currentTask = text;
    await screenshot();
    await controller.typeIntoPrompt(prompt(text, []));
    await controller.clickSendButton();
  });

  ipcMain.on('continue', async (event, text) => {
    await screenshot();
    await controller.typeIntoPrompt(prompt(currentTask, []));
    await controller.clickSendButton();
  });

  let action = () => {};
  ipcMain.on('execute', async (event, text) => {
    action();
  });

  controller.on('end_turn', (content) => {
    if (BrowserWindow.getAllWindows().length === 0) return;

    const data = extractJsonFromMarkdown(content);
    let msg = data === null ? content : data.briefExplanation;
    win.webContents.send('end_turn', msg);

    action = () => {
      const wc = webContents.fromId(webviewId);
      if(data != null) {
        switch(data.nextAction.action) {
          case "click":
            console.log(`clicking ${JSON.stringify(labelData[data.nextAction.element])}`);
            wc.sendInputEvent({
              type: 'mouseDown', 
              x: labelData[data.nextAction.element].x, 
              y: labelData[data.nextAction.element].y,
              clickCount: 1
            });
            wc.sendInputEvent({
              type: 'mouseUp', 
              x: labelData[data.nextAction.element].x, 
              y: labelData[data.nextAction.element].y,
              clickCount: 1
            });
            break;
          case "type":
            console.log(`typing ${data.nextAction.text} into ${JSON.stringify(labelData[data.nextAction.element])}`);
            wc.sendInputEvent({
              type: 'mouseDown', 
              x: labelData[data.nextAction.element].x, 
              y: labelData[data.nextAction.element].y,
              clickCount: 1
            });
            wc.sendInputEvent({
              type: 'mouseUp', 
              x: labelData[data.nextAction.element].x, 
              y: labelData[data.nextAction.element].y,
              clickCount: 1
            });

            for(let char of data.nextAction.text) {
              wc.sendInputEvent({
                type: 'char', 
                keyCode: char
              });
            }
            
            break;
          default:
            console.log(`unknown action ${JSON.stringify(data.nextAction)}`);
            break;
        }
      }
    };
  });

  await controller.initialize();
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})