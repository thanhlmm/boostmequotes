import * as admin from 'firebase-admin';
import * as functions from "firebase-functions";
const cors = require('cors')({ origin: true });
import * as cheerio from 'cheerio';
import fetch from 'node-fetch';
import sequence from 'promise-sequence';
import { chunk, random } from 'lodash';
import * as dayjs from 'dayjs';
import * as isBetween from 'dayjs/plugin/isBetween';
import * as OneSignal from 'onesignal-node';
dayjs.extend(isBetween)


admin.initializeApp();
const db = admin.firestore();

const totalQuotesPage = 73;
const maxPerPage = 1000;

// Start writing Firebase Functions
// https://firebase.google.com/docs/functions/typescript

export const getQuotes = functions.runWith({ timeoutSeconds: 120, memory: "512MB" }).https.onRequest((request, response) => {
  cors(request, response, async () => {
    const limit = Number(request.query.page) || 200;
    const chunk = await admin.firestore().collection('quotes').doc(String(random(1, totalQuotesPage))).get();

    if (!chunk.exists) {
      response.send({
        quotes: []
      });
    }

    response.send({

      quotes: (chunk.data()?.data || [] as any[]).slice(random(maxPerPage - limit, limit)).map((quote: any, index: number) => ({
        ...quote,
        _id: `${chunk.id}_${index}`
      }))
    });
  });
});

export const saveSettings = functions.https.onCall(async (data: ISettings) => {
  if (data.pushToken) {
    await admin.firestore().collection('users').doc(data.pushToken).set({
      ...data,
      remainingQuote: data.maxQuotes,
      todayQuotes: [],
      nextTrigger: dayjs().unix() + 30
    });

    return true;
  }

  // if (data.pushToken) {
  //   data.tag.forEach(async topic => {
  //     await admin.messaging().subscribeToTopic(data.pushToken as string, topic);
  //   })
  // }

  return false;
});

export const getSettings = functions.https.onCall(async (token: string): Promise<ISettings | null> => {
  const userSettings = await admin.firestore().collection('users').where('pushToken', '==', token).limit(1).get()

  if (userSettings.docs[0]) {
    return {
      ...userSettings.docs[0].data(),
      _id: userSettings.docs[0].id
    } as any as ISettings
  }

  return null;
});

export const sendQuotes = functions.pubsub.schedule('every 10 minutes').onRun(async (context) => {
  // export const sendQuotes = functions.runWith({ timeoutSeconds: 120 }).https.onRequest(async (request, response) => {
  const shard = random(0, 73);
  const quotes = (await (await db.doc(`quotes/${shard}`).get()).data()?.data || []).map((quote: any, index: number) => ({
    ...quote,
    _id: `${shard}_${index}`
  }));

  const users = await db.collection('users')
    .where('nextTrigger', "<=", dayjs().unix()).get()
    .then(data => data.docs.map(doc => ({ ...doc.data(), _id: doc.id })));

  functions.logger.info(`Prepare to send to`);
  functions.logger.info(users);

  const oneSignalClient = new OneSignal.Client(functions.config().one_signal.key, functions.config().one_signal.secret);

  await Promise.all(users.map(async (user) => {
    const userData = user as any as IUserState & ISettings;
    const quote = getSuitableQuote(quotes, user as unknown as IUserState);
    if (quote && userData.pushToken) {

      functions.logger.info(`Start send quote to ${userData.pushToken}`);
      // TODO: Refactor to send by topic
      // TODO: Use `delivery_time_of_day` to deliver based on prefer time
      await oneSignalClient.createNotification({
        headings: {
          en: quote.author
        },
        contents: {
          en: quote.body,
        },
        url: "https://boostmequotes.vercel.app",
        chrome_web_image: '',
        chrome_big_picture: '',
        include_player_ids: [userData.pushToken]
      })

      functions.logger.info(`Save next trigger time`)
      await saveUserState(userData._id, {
        _id: userData._id,
        remainingQuote: userData.remainingQuote - 1,
        todayQuotes: [...(userData.todayQuotes || []), quote._id],
        nextTrigger: getNextTrigger(userData)
      });

      return true;
    }

    return false;
  }))

  return true;
});

function getNextTrigger(setting: IUserState & ISettings): number {
  if (setting.remainingQuote === 0) {
    return dayjs().add(1, 'd').hour(7).unix();
  }

  return dayjs().add(1, 'h').unix();
}


function getRandomItem<T>(input: T[]): T {
  return input[Math.floor(Math.random() * input.length)];
}

function getSuitableQuote(quotes: IQuotes[], userState: IUserState): IQuotes | null {
  const quotesSuitable = quotes
    .filter(quote => !userState.todayQuotes.includes(quote._id))
    .filter(quote => quote.body.length <= 300) // Filter some long quote to make sure MacOS dont cut the string
    .map(quote => {
      let rank = 0;

      if (quote.timerange) {

        const [start, end] = quote.timerange;
        if (dayjs().isBetween(dayjs(start, 'HH:mm'), dayjs(end, 'HH:mm'), 'hour')) {
          rank++;
        }
      }

      return {
        ...quote,
        rank,
      };
    })
    .sort((a, b) => a.rank - b.rank);

  const shiftQuotes = quotesSuitable.filter(quote => quote.rank >= 1);
  const bestQuote = shiftQuotes.length > 3 ? getRandomItem(shiftQuotes) : getRandomItem(quotesSuitable);
  return bestQuote;
}

function saveUserState(uid: string, state: IUserState): Promise<boolean> {
  functions.logger.info(`Saving user state`);
  functions.logger.info(state);
  return db.doc(`users/${uid}`).update(state).then(() => true);
}

interface IQuoteURL {
  url: string; total: number
}


export const crawlBrainyquote = functions.runWith({ timeoutSeconds: 300, memory: "1GB" }).https.onRequest((request, response) => {
  const rootURL = 'https://www.brainyquote.com';
  const quotesUrl: IQuoteURL[] = [];
  const quotes: Partial<IQuotes>[] = []
  return fetch('https://www.brainyquote.com/topics')
    .then(response => response.text())
    .then(async data => {
      functions.logger.log('Crawl topic');
      const $ = cheerio.load(data);

      return $('.topicIndexChicklet').toArray().map((ele) => rootURL + $(ele).attr('href'));
    })
    .then(topics => {
      functions.logger.log('Crawl all topic page');
      return Promise.all(topics.map(topicUrl => {
        return fetch(topicUrl)
          .then(response => response.text())
          .then(html => {
            const $ = cheerio.load(html);
            const totalPage = $('.pagination li:nth-last-child(2)').text();
            quotesUrl.push({
              url: topicUrl,
              total: Number(totalPage) || 0
            });
          })
      }))
    })
    .then(() => {
      functions.logger.log('Crawl quotes');

      return Promise.all(quotesUrl.map(data => {
        const allPage = [data.url];

        for (let i = 1; i <= data.total; i++) {
          allPage.push(`${data.url}_${i}`);
        }

        return sequence(allPage.map(url => fetch(url)
          .then(response => response.text())
          .then(html => {
            const $ = cheerio.load(html);
            $('.bqQt').toArray().map((ele) => {
              const elem = $(ele);

              quotes.push({
                body: elem.find('.oncl_q').text(),
                author: elem.find('.oncl_a').text(),
                tag: elem.find('.oncl_klc').toArray().map((ele) => {
                  return $(ele).text()
                }),
                source: 'Brainyquote',
              })
            })
          }).catch(error => {
            functions.logger.error(error);
          })))
      }))
    })
    .then(() => {
      functions.logger.log('Store to DB');
      functions.logger.log(`Total ${quotes.length} quotes`);
      const db = admin.firestore();

      return sequence(chunk(quotes, 1000).map((quoteChunk, index) => {
        const batch = db.batch();
        batch.create(
          db.collection('quotes').doc(String(index)),
          { data: quoteChunk }
        );

        return batch.commit();
      }))
    })
    .then(() => {
      response.send('Done');
    })
});