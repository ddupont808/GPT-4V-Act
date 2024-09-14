# GPT-4V-Act: Chromium Copilot

> 🔥 **Update (September 14, 2024)**: Check out [Windows Agent Arena (WAA)](https://github.com/microsoft/windowsagentarena)! This project incorporates all the features previously planned for GPT-4V-Act, including AI labeling to enable set-of-marks prompting in desktop UI environments. 


GPT-4V-Act serves as an eloquent multimodal AI assistant that harmoniously combines GPT-4V(ision) with a web browser. It's designed to mirror the input and output of a human operator—primarily screen feedback and low-level mouse/keyboard interaction. The objective is to foster a smooth transition between human-computer operations, facilitating the creation of tools that considerably boost the accessibility of any user interface (UI), aid workflow automation, and enable automated UI testing.


## How it works

GPT-4V-Act leverages both [GPT-4V(ision)](https://openai.com/research/gpt-4v-system-card) and [Set-of-Mark Prompting](https://arxiv.org/abs/2310.11441), together with a tailored auto-labeler. This auto-labeler assigns a unique numerical ID to each interactable UI element.

By incorporating a task and a screenshot as input, GPT-4V-Act can deduce the subsequent action required to accomplish a task. For mouse/keyboard output, it can refer to the numerical labels for exact pixel coordinates.


**Get Started!**
```bash
# Clone the repo
git clone https://github.com/ddupont808/GPT-4V-Act ai-browser
# Navigate to the repo directory
cd ai-browser
# Install the required packages
npm install
# Start the demo
npm start
```

## Features

- 🔄 Vision (Partial) 
   - ✅ JS DOM auto-labeler (w/ COCO export)  
   - ❌ AI auto-labeler
- ✅ Clicking 
- 🔄 Typing (Partial) 
   - ✅ Typing characters (letters, numbers, strings) 
   - ❌ Typing special keycodes (enter, pgup, pgdown)
- ❌ Scrolling
- ❌ Prompting user for more information
- ❌ Remembering information relevant to task

If you have ideas, feedback, or want to contribute, feel free to create an Issue or reach out to ddupont@mit.edu

## Demonstration Prompt

Below is an example of using the user-interface to instruct the agent to "play a random song for me"

![](demo1.png)

This is the prompt seen by GPT-4V and the corresponding output

### User
![](demo2.png)
```markdown
task: play a random song for me

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

## instructions
# observe the screenshot, and think about the next action
# output your response in a json markdown code block
```

### Assistant
```json
{
  "briefExplanation": "I'll type 'random song' into the search bar to find a song for you.",
  "nextAction": { "action": "type", "element": 7, "text": "random song" }
}
```
