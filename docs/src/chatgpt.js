const puppeteer = require('puppeteer-extra');
const EventEmitter = require('events');

// add stealth plugin and use defaults (all evasion techniques) 
const StealthPlugin = require('puppeteer-extra-plugin-stealth') 
puppeteer.use(StealthPlugin()) 

const {executablePath} = require('puppeteer') 

class OpenAIChatController extends EventEmitter {
    constructor() {
        super();
        this.browser = null;
        this.page = null;
    }

    async initialize() {
        this.browser = await puppeteer.launch({
            headless: false, // Launch browser in non-headless mode so you can see what's happening
            userDataDir: "./user_data", // Persist user data so you can login
            executablePath: executablePath()
        });
        this.page = await this.browser.newPage();
        await this.page.exposeFunction('emitEndTurn', (data) => this.emit('end_turn', data));

        await this.page.goto('https://chat.openai.com/?model=gpt-4');
        await this.preparePage();
    }

    async preparePage() {
        await this.page.waitForSelector('input[type="file"]');
        await this.page.evaluate(() => {
            const {fetch: origFetch} = window;
            window.fetch = async (...args) => {
              const response = await origFetch(...args);
            
              if(args[0] === "https://chat.openai.com/backend-api/conversation") {
                console.log("intercepting conversation...");
                
                const { body } = response.clone();
                const raw = await new Response(body).text();
                const chunks = raw.split('\ndata: ');
                for(let chunk of chunks) {
                    chunk = chunk.trim();
                    if(chunk.startsWith('{')) {
                        console.log(chunk);
                        try { 
                            let msg = JSON.parse(chunk);
                            if(msg.message && msg.message.end_turn) {
                                console.log(msg.message.content.parts);
                                window.emitEndTurn(msg.message.content.parts.join(''));
                                break;
                            }
                        } catch( ex ) { }
                    }
                }
              }
            
              return response;
            };
        });
    }

    async typeIntoPrompt(text) {
        if (!this.page) {
            throw new Error('You need to initialize first');
        }
        await this.page.type('#prompt-textarea', text.split('\n').join(';'));
    }

    async clickSendButton() {
        if (!this.page) {
            throw new Error('You need to initialize first');
        }
        await this.page.waitForSelector('button[data-testid="send-button"]:not([disabled])');
        await this.page.click('[data-testid="send-button"]');
    }

    async uploadImage(filePath) {
        if (!this.page) {
            throw new Error('You need to initialize first');
        }
        await this.page.reload();
        await this.preparePage();

        const input = await this.page.$('input[type="file"]');
        await input.uploadFile(filePath);
        // wait until upload is complete
        await this.page.waitForSelector('button[data-testid="send-button"]:not([disabled])');
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
        }
    }
}


module.exports = OpenAIChatController;