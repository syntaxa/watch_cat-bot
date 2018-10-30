const Telegraf = require('telegraf');
const Extra = require('telegraf/extra');
const https = require('https');
const cheerio = require('cheerio');
const request = require('request');
const Markup = require('telegraf/markup')

const { OGRN } = process.env;
const { TELEGRAM_BOT_TOKEN } = process.env;
const { MAIN_FORM_URL } = process.env;
const { FORM_POST_URL } = process.env;
const { BOT_MASTER_ID } = process.env;


const bot = new Telegraf(TELEGRAM_BOT_TOKEN);

var myState = 'none';
var captchaToken = '';

bot.command('init', (ctx) => {
  doInit(ctx);  
  ctx.reply('/init', Extra.markup(Markup.removeKeyboard()));
})

bot.on('callback_query', (ctx) => {
  showCaptcha(ctx);
  ctx.answerCbQuery('Ещёёёё!');
  
})

bot.on('message', (ctx) => {
  if (ctx.from.id == BOT_MASTER_ID) {
    switch (myState) {
      case 'none':
        showCaptcha(ctx);      
        break;
      case 'captcha_shown':
        requestDataWithCaptcha(ctx);
        break;
      default:
        ctx.reply('Error: strange state = ' + myState).then();
    }
  }
})

function doInit(ctx) {
  myState = 'none'
}


function requestDataWithCaptcha(ctx) {
  var captcha = ctx.message.text;
  if (!captcha || captcha.length == 0 || captcha.length != 6) {
    ctx.reply('This was not captcha. Enter captcha for the image above.').then();
  } else {

    request({
      url: FORM_POST_URL,
      method: 'POST',
      form: {
          nptype: 'ul',
          ogrnUl: OGRN,
          captcha: captcha,
          captchaToken: captchaToken
      }
    }, function(error, response, body){
      if(error) {
          ctx.reply(error).then();
      } else {
        try {
          var resp = JSON.parse(body);
          if (resp && resp.ERRORS) {
            ctx.reply(resp.ERRORS.captcha[0]).then();
            showCaptcha(ctx);
          } else {
            showResult(ctx, resp);
            doInit(ctx);
          }
        } catch(e) {
          ctx.reply("Couldn't parse response. " + e).then();
        }
      }
    });        
  }
}

function showResult(ctx, resp) {
  var row = resp.rows[0];
  var responseMarkdown = `\`Последние поданные документы на регистрацию\`

*Дата представления:* ${row.DT}
*Вид изменений:* ${row.IZM}
*Форма заявления:* ${row.FR}
*Дата готовности документов:* ${row.DTGOTOV}
*ГРН внесенной записи:* ${row.GRN}
*Способ представления:* ${row.PREDST}
`;  
  
  ctx.replyWithMarkdown(responseMarkdown,
    Markup.inlineKeyboard([
      Markup.callbackButton('Заново!', 'again')
    ]).extra()
  ).then(); 
}

function showCaptcha(ctx) {
  https.get(MAIN_FORM_URL, (res) => {
  
    let rawData = '';
    res.on('data', (chunk) => { rawData += chunk; });
    res.on('end', () => {
      var $ = cheerio.load(rawData);
      captchaToken = $('input[name=captchaToken]').attr('value');
      if(captchaToken && (captchaToken !== '')) {
        var timeStamp = new Date().getTime();
        var captchaImgUrlBase = `https://service.nalog.ru/static/captcha.html?r=${timeStamp}&a=${captchaToken}&version=2`;

        ctx.replyWithPhoto({url: captchaImgUrlBase}).then();
        myState = 'captcha_shown';
      } else {
        ctx.reply('Error: no captcha token found...').then();  
      }
    });
  }).on('error', (e) => {
    ctx.reply('Error while loading Main Form: ' + e).then();
  });
}

bot.startPolling();