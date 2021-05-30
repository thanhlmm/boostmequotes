/// <reference lib="WebWorker" />
// export empty type because of tsc --isolatedModules flag
export type { };
declare const self: ServiceWorkerGlobalScope;

import firebase from 'firebase/app';
import 'firebase/messaging';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
dayjs.extend(isBetween)
import { PouchDB } from '@svouch/pouchdb';
let db = new PouchDB('quotes');
const channel = new BroadcastChannel('boostmequotes');
const settingsDb = new PouchDB('boostmequotes_settings');

const firebaseConfig = {
  apiKey: 'AIzaSyBK5XaWLple3MeGuzp1GfU7HKKRe2T03KI',
  authDomain: 'boost-me-quotes.firebaseapp.com',
  projectId: 'boost-me-quotes',
  storageBucket: 'boost-me-quotes.appspot.com',
  messagingSenderId: '477870834608',
  appId: '1:477870834608:web:7eff0a5b9b9c92a3b84c75',
  measurementId: 'G-JWPT4FLD4Y'
};

if (firebase.apps.length <= 0) {
  firebase.initializeApp(firebaseConfig);
}

// Retrieve an instance of Firebase Messaging so that it can handle background
// messages.
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
});

messaging.setBackgroundMessageHandler((payload) => {
  console.log('Set background');
  return self.registration.showNotification(payload.data.title, {
    body: payload.data.body,
    icon: payload.data.icon,
    tag: payload.data.tag,
    data: payload.data.link
  });
})

self.addEventListener('notificationclick', function (event) {
  // TODO: What should we do when user click on notification?
  // Show action is a good option
  event.notification.close();
});

let quoteRunnner;
let enableQuoteRunner = false;

// Users action
const totalTimePerDay: Record<ITimeRange, number> = {
  'workday': 8,
  'alltimes': 12,
  'weekend': 12
}

const TIME_VOLALITY = 20; // Randomly minute
let lastDay = dayjs();
let totalToday = 0;
let todayQuotes: string[] = []

const tagPrefer: Record<IShift, string[]> = {
  morning: ['goal', 'productive', 'inspired'],
  afternoon: ['productive', 'inspired', 'funny', 'life'],
  night: ['love', 'funny', 'life', 'fact']
}

channel.onmessage = ((ev: MessageEvent<IMessage>) => {
  if (ev.data.type === 'reply') {
    return;
  }

  switch (ev.data.name) {
    case 'saveSettings':
      saveSettings(ev.data.args);
      return;
    case 'getSettings':
      getSettings();
      return;
    case 'boostMe':
      boostMe();
  }
});

function saveSettings(data: ISettings): Promise<boolean> {
  return settingsDb.get('settings').then(doc => {
    return settingsDb.put({
      _id: 'settings',
      _rev: doc._rev,
      ...data
    });
  }).catch((error) => {
    return settingsDb.put({
      _id: 'settings',
      ...data
    });
  }).then(() => {
    return true;
  }).catch((error) => {
    console.log('saveSettings error')
    console.log(error);
  })
}

function getSettings() {
  settingsDb.get('settings').then(doc => {
    channel.postMessage({
      name: 'getSettings',
      type: 'reply',
      args: doc
    });
  }).catch(() => {
    channel.postMessage({
      name: 'getSettings',
      type: 'reply',
      args: null
    });
  });
}

function getAppSettings(): Promise<ISettings> {
  return settingsDb.get('settings').then(doc => {
    return doc;
  }).catch(() => {
    return {
      time: 'alltimes',
      maxQuotes: '5',
      receivedFromCommunity: true,
      tag: ["Time", 'Relationship', 'Motivational'],
      enabled: false,
    }
  });
}

// Automatically quotes

function getShift(): IShift {
  const hour = dayjs().hour();

  if (hour < 12) {
    return 'morning';
  } else if (hour < 18) {
    return 'afternoon'
  } else {
    return 'night'
  }
}

function getRandom<T>(input: T[]): T {
  return input[Math.floor(Math.random() * input.length)];
}

function shouldSendQuotesToday(settings: ISettings): boolean {
  const weekday = dayjs().day();
  if (settings.time === 'alltimes') {
    return true;
  }

  if (settings.time === 'workday') {
    return weekday > 0 && weekday < 6;
  }

  if (settings.time === 'weekend') {
    return weekday === 0 || weekday === 6;
  }

  return true;
}

function getAllQuotes(): Promise<IQuotes[]> {
  return db.allDocs<IQuotes>({ include_docs: true }).then(response => response.rows.map(row => row.doc));
}

async function syncQuotesToDb(): Promise<boolean> {
  console.log("Start sync quotes")
  if (!navigator.onLine) {
    console.warn("Devide is offline, delay the sync");
    return false;
  }

  console.log("Fetch new quotes");
  let data: IQuotes[] = [];
  let page = 0;
  while (true) {
    const pageData = await fetch(`https://us-central1-boost-me-quotes.cloudfunctions.net/getQuotes?page=${page}`)
      .then(response => response.json())
      .then(async data => {
        return data.quotes as IQuotes[];
      }).catch((error) => {
        console.log("Failed to get quotes from API")
        console.log(error);
        return [];
      });

    if (pageData.length <= 0) {
      break;
    }

    data = [...data, ...pageData];

    page++;
  }

  await db.destroy();
  db = new PouchDB('quotes');
  db.bulkDocs(data);

  return true;
}

setInterval(() => {
  syncQuotesToDb();
}, 12 * 24 * 60 * 60 * 1000); // Sync quotes each half day

async function getSuitableQuote(): Promise<IQuotes | null> {
  const quotes = await getAllQuotes();

  console.log("Current shift", getShift());

  const tagTime = tagPrefer[getShift()];

  const quotesSuitable = quotes
    .filter(quote => !todayQuotes.includes(quote._id))
    .map(quote => {
      let rank = 0;

      if (quote.timerange) {
        const [start, end] = quote.timerange;
        if (dayjs().isBetween(dayjs(start, 'HH:mm'), dayjs(end, 'HH:mm'), 'hour')) {
          rank++;
        }
      }

      if (quote.tag.some(quote => tagTime.includes(quote))) {
        rank++;
      }
      return {
        ...quote,
        rank,
      };
    })
    .sort((a, b) => a.rank - b.rank);

  const shiftQuotes = quotesSuitable.filter(quote => quote.rank === 1);

  const bestQuote = shiftQuotes.length > 3 ? getRandom(shiftQuotes) : getRandom(quotesSuitable);

  return bestQuote;
}

setTimeout(async () => {
  // In case the new background is up and running
  sendTodayNotification(15 * 1000);
}, 5 * 60 * 1000); // 5mins

function sendTodayNotification(timeout: number) {
  console.log(`Schedule quotes for next ${timeout} ms`);
  if (quoteRunnner) {
    // Make sure we only have 1 runner
    clearTimeout(quoteRunnner);
  }
  quoteRunnner = setTimeout(async () => {
    // Day reseter
    if (dayjs().isAfter(lastDay, 'd')) {
      lastDay = dayjs();
      totalToday = 0;
      todayQuotes = [];
    }
    console.log("Start checking for new quotes");

    const settings = await getAppSettings();

    let shouldStopSendNotification = !settings.enabled || !shouldSendQuotesToday(settings);
    const timePerNotification = totalTimePerDay[settings.time] / settings.maxQuotes;

    if (totalToday > settings.maxQuotes) {
      // Max quotes exec
      shouldStopSendNotification = true;
      return;
    }

    if (shouldStopSendNotification) {
      sendTodayNotification(timePerNotification * 60 * 60 * 1000 + (Math.random() > 0.5 ? 1 : -1) * Math.random() * TIME_VOLALITY * 60 * 100);
      return;
    }

    totalToday++;

    console.log("Getting suitable quotes");
    const notification = await getSuitableQuote();
    if (notification) {
      todayQuotes.push(notification._id);
      self.registration.showNotification('Boost me Quotes', notification as any as NotificationOptions);
    }

    sendTodayNotification(timePerNotification * 60 * 60 * 1000 + (Math.random() > 0.5 ? 1 : -1) * Math.random() * 20 * 60 * 100)
  }, timeout)
}

function boostMe() {
  syncQuotesToDb();
  self.registration.showNotification('Boost me Quotes', {
    body: 'Setup complete 🚀'
  });

  if (quoteRunnner) {
    clearTimeout(quoteRunnner);
  }

  sendTodayNotification(15 * 1000); // 15 secs
}