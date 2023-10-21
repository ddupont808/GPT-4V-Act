const customCSS = `
    ::-webkit-scrollbar {
        width: 10px;
    }

    ::-webkit-scrollbar-track {
        background: #27272a;
    }

    ::-webkit-scrollbar-thumb {
        background: #888;
        border-radius: 0.375rem;
    }

    ::-webkit-scrollbar-thumb:hover {
        background: #555;
    }
`;

window.addEventListener('DOMContentLoaded', () => {
    const styleTag = document.createElement('style');
    styleTag.textContent = customCSS;
    document.head.append(styleTag);
});

const { ipcRenderer } = require('electron');

// Listen for messages from preload.js to navigate
ipcRenderer.on('navigate-webview', (event, action, payload) => {
    switch (action) {
        case 'goBack':
            if (window.history.length > 1) {
                window.history.back();
            }
            break;
        case 'goForward':
            if (window.history.length > 1) {
                window.history.forward();
            }
            break;
        case 'reload':
            window.location.reload();
            break;
        case 'loadURL':
            window.location.href = payload;
            break;
    }
});

// Send the current URL whenever it changes
window.addEventListener('load', () => {
    ipcRenderer.send('current-url', window.location.href);
    
    let oldHref = document.location.href;
    const body = document.querySelector("body");
    const observer = new MutationObserver(mutations => {
        if (oldHref !== document.location.href) {
            oldHref = document.location.href;
            ipcRenderer.send('current-url', window.location.href);
        }
    });
    observer.observe(body, { childList: true, subtree: true });
});

window.addEventListener('beforeunload', () => {
    ipcRenderer.send('current-url', window.location.href);
});

window.addEventListener('popstate', () => {
    ipcRenderer.send('current-url', window.location.href);
});


ipcRenderer.on('observer', (event, state, payload) => {
    switch (state) {
        case 'screenshot-start':
            markPage();
            break;
        case 'screenshot-end':
            unmarkPage();
            break;
    }
});

let labels = [];

function unmarkPage() {
  for(const label of labels) {
    document.body.removeChild(label);
  }

  labels = [];
}

function markPage() {
  unmarkPage();
  
  var bodyRect = document.body.getBoundingClientRect();

  var items = Array.prototype.slice.call(
    document.querySelectorAll('*')
  ).map(function(element) {
    var rect = element.getBoundingClientRect();
    return {
      element: element,
      include: (element.tagName === "INPUT" || element.tagName === "TEXTAREA" || element.tagName === "SELECT") ||
      (element.tagName === "BUTTON" || element.tagName === "A" || (element.onclick != null) || window.getComputedStyle(element).cursor == "pointer"),
      rect: {
        left: Math.max(rect.left - bodyRect.x, 0),
        top: Math.max(rect.top - bodyRect.y, 0),
        right: Math.min(rect.right - bodyRect.x, document.body.clientWidth),
        bottom: Math.min(rect.bottom - bodyRect.y, document.body.clientHeight)
      },
      text: element.textContent.trim().replace(/\s{2,}/g, ' ')
    };
  }).filter(item =>
    item.include && ((item.rect.right - item.rect.left) * (item.rect.bottom - item.rect.top) >= 20)
  );

  // Only keep inner clickable items
  items = items.filter(x => !items.some(y => x.element.contains(y.element) && !(x == y)))

  // Function to generate random colors
  function getRandomColor() {
    var letters = '0123456789ABCDEF';
    var color = '#';
    for (var i = 0; i < 6; i++) {
      color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
  }

  // Lets create a floating border on top of these elements that will always be visible
  items.forEach(function(item, index) {
    newElement = document.createElement("div");
    var borderColor = getRandomColor();
    newElement.style.outline = `2px dashed ${borderColor}`;
    newElement.style.position = "absolute";
    newElement.style.left = item.rect.left + "px";
    newElement.style.top = item.rect.top + "px";
    newElement.style.width = (item.rect.right - item.rect.left) + "px";
    newElement.style.height = (item.rect.bottom - item.rect.top) + "px";
    newElement.style.pointerEvents = "none";
    newElement.style.boxSizing = "border-box";
    newElement.style.zIndex = 2147483647;
    
    // Add floating label at the corner
    var label = document.createElement("span");
    label.textContent = index;
    label.style.position = "absolute";
    label.style.top = "-19px";
    label.style.left = "0px";
    label.style.background = borderColor;
    label.style.color = "white";
    label.style.padding = "2px 4px";
    label.style.fontSize = "12px";
    label.style.borderRadius = "2px";
    newElement.appendChild(label);
    
    document.body.appendChild(newElement);
    labels.push(newElement);
    // item.element.setAttribute("-ai-label", label.textContent);
  })

  ipcRenderer.send('label-data', JSON.stringify(items.map(item => {
    return {
        x: (item.rect.left + item.rect.right) / 2, 
        y: (item.rect.top + item.rect.bottom) / 2
    }
  })));
}