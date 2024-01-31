const { ipcRenderer } = require('electron');

document.addEventListener("DOMContentLoaded", function () {
    // mini-browser setup

    const urlInput = document.getElementById('urlInput');
    const webview = document.getElementById('webview');

    document.getElementById('backButton').addEventListener('click', () => {
        webview.send('navigate-webview', 'goBack');
    });

    document.getElementById('forwardButton').addEventListener('click', () => {
        webview.send('navigate-webview', 'goForward');
    });

    document.getElementById('reloadButton').addEventListener('click', () => {
        webview.send('navigate-webview', 'reload');
    });

    urlInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            webview.send('navigate-webview', 'loadURL', urlInput.value);
        }
    });

    webview.addEventListener('will-navigate', (event) => {
        console.log(event);
        urlInput.value = event.url;
    });

    ipcRenderer.on('update-url', (event, url) => {
        urlInput.value = url;
    });
    
    webview.addEventListener('dom-ready', () => {
        console.log(webview.getWebContentsId());
        ipcRenderer.send('webview-ready', webview.getWebContentsId());
    });
    
    // Agent stuff

    const inputElement = document.querySelector('input[type="text"]');
    const sendButton = document.querySelector('button#send');
    const chatContainer = document.querySelector('#chat-container');

    document.querySelector('#screenshot').addEventListener('click', () => ipcRenderer.send('screenshot'));
    document.querySelector('#continue').addEventListener('click', () => ipcRenderer.send('continue'));
    document.querySelector('#execute').addEventListener('click', () => ipcRenderer.send('execute'));

    document.querySelector('#mark').addEventListener('click', () => webview.send('observer', 'screenshot-start'));
    document.querySelector('#unmark').addEventListener('click', () => webview.send('observer', 'screenshot-end'));
    document.querySelector('#export').addEventListener('click', () => ipcRenderer.send('export'));
    document.querySelector('#randomize').addEventListener('click', () => ipcRenderer.send('randomize'));
    
    ipcRenderer.on('end_turn', (event, content) => {
        // Create the message div and its container
        const messageDiv = document.createElement('div');
        messageDiv.className = "py-2 px-3 bg-indigo-700 text-indigo-200 rounded-lg shadow-md break-words";
        messageDiv.textContent = content; // This ensures no HTML or scripts in `content` are executed
    
        const containerDiv = document.createElement('div');
        containerDiv.className = "mb-2 mr-8";
        containerDiv.appendChild(messageDiv);
    
        // Append the message to the chat container
        chatContainer.appendChild(containerDiv);
        
        // Scroll to the bottom to show the newest messages
        chatContainer.scrollTop = chatContainer.scrollHeight;
    });

    function sendMessage() {
        const userMessage = inputElement.value;
        if (!userMessage.trim()) return;

        // Append user's message
        chatContainer.innerHTML += `
          <div class="mb-2 ml-8">
              <div class="py-2 px-3 bg-zinc-200 text-zinc-700 rounded-lg shadow-md break-words">
                  ${userMessage}
              </div>
          </div>
      `;

        // Clear the input after sending the message
        inputElement.value = '';

        // Scroll to the bottom to show the newest messages
        chatContainer.scrollTop = chatContainer.scrollHeight;

        ipcRenderer.send('send', userMessage);
    }

    inputElement.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });

    sendButton.addEventListener('click', sendMessage);
});
