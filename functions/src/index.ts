import * as admin from 'firebase-admin';
import * as functions from "firebase-functions";
const cors = require('cors')({ origin: true });
import * as cheerio from 'cheerio';
import fetch from 'node-fetch';
import sequence from 'promise-sequence';
import { chunk } from 'lodash';


admin.initializeApp();

// Start writing Firebase Functions
// https://firebase.google.com/docs/functions/typescript

export const getQuotes = functions.runWith({ timeoutSeconds: 120, memory: "512MB" }).https.onRequest((request, response) => {
  cors(request, response, async () => {
    const chunk = await admin.firestore().collection('quotes').doc(String(request.query.page) || "0").get();

    if (!chunk.exists) {
      response.send({
        quotes: []
      });
    }

    response.send({
      quotes: (chunk.data()?.data || [] as any[]).map((quote: any, index: number) => ({
        ...quote,
        _id: `${chunk.id}_${index}`
      }))
    });
  });
});

interface IQuoteURL {
  url: string; total: number
}

interface IQuotes {
  body: string;
  author: string;
  tag: string[];
  source?: string;
}

export const crawlBrainyquote = functions.runWith({ timeoutSeconds: 300, memory: "2GB" }).https.onRequest((request, response) => {
  const rootURL = 'https://www.brainyquote.com';
  const quotesUrl: IQuoteURL[] = [];
  const quotes: IQuotes[] = []
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