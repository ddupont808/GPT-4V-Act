const Anthropic = require('@anthropic-ai/sdk');
const EventEmitter = require('events');
const fs = require('node:fs/promises');
const path = require('path');


const prompt = (task, info) => `task: ${task}

type ClickAction = { action: "click", element: number }
type TypeAction = { action: "type", element: number, text: string }
type ScrollAction = { action: "scroll", direction: "up" | "down" }
type RequestInfoFromUser = { action: "request-info", prompt: string }
type RememberInfoFromSite = { action: "remember-info", info: string }
type Done = { action: "done" }

## response format
{
  thought: string,
  nextAction: ClickAction | TypeAction | ScrollAction | RequestInfoFromUser | RememberInfoFromSite | Done
}

## response examples
{
  "thought": "Typing 'funny cat videos' into the search bar"
  "nextAction": { "action": "type", "element": 11, "text": "funny cat videos" }
}
{
  "thought": "Today's doodle looks interesting, clicking it"
  "nextAction": { "action": "click", "element": 9 }
}
{
  "thought": "I have to login to create a post"
  "nextAction": { "action": "request-info", "prompt": "What is your login information?" }
}
{
  "thought": "Today's doodle is about Henrietta Lacks, remembering that for our blog post"
  "nextAction": { "action": "remember-info", "info": "Today's doodle is about Henrietta Lacks" }
}

## stored info
${JSON.stringify(info)}

## instructions
# observe the screenshot, and think about the next action
# output your response in a json markdown code block
`;

class ClaudeChatController extends EventEmitter {
    async initialize() {
        let apiKey = process.env.ANTHROPIC_API_KEY;
        
        if (!apiKey) {
            try {
                apiKey = await fs.readFile(path.join(__dirname, '../keys/anthropic.txt'), 'utf8');
            } catch (error) {
                console.error('Failed to read API key from file:', error);
            }
        }
        
        if (!apiKey) {
            throw new Error('Anthropic API key not found in environment variable or file');
        }
        
        this.anthropic = new Anthropic({ apiKey });
    }

    async uploadImageData(imageData) {
        this.rawImage = imageData;
        this.lastImage = `data:image/png;base64,${imageData.toString('base64')}`;
    }

    async send(text) {
        let userPrompt = prompt(text, []);

        let ep = Date.now();
        console.log('Episode #' + ep);
        await fs.writeFile('tmp/screenshot_' + ep + '.png', this.rawImage);
        await fs.writeFile('tmp/prompt_' + ep + '.txt', userPrompt);

        const message = await this.anthropic.messages.create({
            model: 'claude-3-opus-20240229',
            messages: [{
                role: 'user',
                content: [
                    { type: 'text', text: userPrompt },
                    { type: 'image', source: { type: 'base64', data: this.lastImage } }
                ]
            }],
            max_tokens: 500,
        });
        
        let result = message.content[0].text;
        
        await fs.writeFile('tmp/response_' + ep + '.txt', result);
        console.log(result);
        this.emit('end_turn', result);
    }
}

module.exports = ClaudeChatController;