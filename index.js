const axios = require("axios");
const cheerio = require("cheerio");
require("dotenv").config();
const options = require("./options");
const server = require("./server.js");
const pupeteer = require("puppeteer");

let numberOfExecutions = 0;

// bot set up
const TelegramBot = require("node-telegram-bot-api");

// replace the value below with the Telegram token you receive from @BotFather
const token = options.telegram.token;

// Create a bot that uses 'polling' to fetch new updates
const bot = new TelegramBot(token, { polling: true });

// set the chat ID so it is only for one group
const chatId = options.telegram.chatId;

// Any kind of message
const pattern = /./;
bot.onText(pattern, (msg) => {
  // 'msg' is the received Message from Telegram
  // 'match' is the result of executing the regexp above on the text content
  // of the message

  const welcomeMsg =
    "Welcome. This bot will scan the Rugby Wold Cup ticket page every 60 seconds. It is specifically targeting the Irish matches. Once tickets are up for resale, we should be the first to know ";
  const currentChatId = msg.chat.id;
  console.log(currentChatId);
  bot.sendMessage(chatId, welcomeMsg);
});

async function checkForTickets() {
  try {
    for (var match in options.urlObject) {
      const currentURL = options.urlObject[match];

      const { data } = await axios({
        method: "GET",
        url: currentURL,
      });
      // set cheerio to $
      const $ = cheerio.load(data);

      // set no tickets marker
      const noTicketDiv = ".product-not-on-sale-info";

      if ($(noTicketDiv).length === 0) {
        let msg = `Tickets available for ${match}. Run RUN RUN!!!! ${options.urlObject[match]}`;
        bot.sendMessage(chatId, msg);
      }
    }
  } catch (e) {
    console.error(e);
  }
}

async function checkForFinalTickets() {
  try {
    
    const currentURL = options.urlObject.FINAL;

    const browser = await pupeteer.launch({ headless: true });
    const page = await browser.newPage();

    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, "platform", { get: () => "Win32" });
      Object.defineProperty(navigator, "productSub", { get: () => undefined });
      Object.defineProperty(navigator, "vendor", { get: () => '' });
      Object.defineProperty(navigator, "cpuClass", { get: () => 'x86' });
    })

    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; WOW64; Trident/7.0; rv:11.0) like Gecko');
    
    await page.goto(currentURL);
    const res = await page.content();
    await browser.close();

    // set cheerio to $
    const $ = cheerio.load(res);


    // Get fieldset with classes "match-day js-form-item form-item js-form-wrapper form-group" which has
    // a legend child with span child with span text Saturday
    const matches = Array.from($("fieldset.match-day.js-form-item.form-item.js-form-wrapper.form-group > div.fieldset-wrapper > div.light.list.vignette"));
    const finalFieldset = matches.find((fieldset) => {
      let span = $(fieldset).find("div.list-ticket-content > div.match-info-wrapper > div.d-lg-none.match-info-mobile > span.competition-additional");
      if (span.length === 0) {
        return false;
      }
      span = span[0];
      return span.children[0].data.trim().toLowerCase() == "final";
    })
    


    const actionsWrappers = $(finalFieldset).find("div.actions-wrapper");

    if (actionsWrappers.length === 0) {
      throw new Error("No actions wrapper found");
    }

    const actionsWrapper = actionsWrappers[0];

    // If has a child div with class js-show-offers then tickets are available
    if ($(actionsWrapper).find("div.js-show-offers").length > 0) {
      let msg = `Tickets available for FINAL. Run RUN RUN!!!! ${options.urlObject.FINAL}`;
      bot.sendMessage(chatId, msg);
    }

  } catch (e) {
    console.error(e);
    bot.sendMessage(chatId, "There has been an error checking for tickets: " + e.message + ". Feel free to contact the developer at wayotawebs@gmail.com");
  }

  if (numberOfExecutions % options.pulseEvery === 0) {
    bot.sendMessage(chatId, "I'm still alive");
  }
  
  numberOfExecutions++;
}

// call the check web function with specified time as per options.js
setInterval(checkForFinalTickets, options.delay);
// checkForFinalTickets();
