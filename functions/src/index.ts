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

export const getQuotes = functions.https.onRequest((request, response) => {
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
        body: stringToEmoji(quote.body),
        _id: `${chunk.id}_${index}`
      }))
    });
  });
});

export const getRandomImage = functions.https.onRequest((request, response) => {
  cors(request, response, async () => {
    const topics = request.query.topics;

    return fetch(
      'https://api.unsplash.com/photos/random?client_id=mofCb02A6mHMmxL0BQ_T25vUYbAOH4hDFUApVfyHpfs&topics=' + topics,
      { method: 'GET' }
    )
      .then((response) => response.json())
      .then((result) => {
        response.send(result);
      })
      .catch((error) => console.log('error', error));
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
          en: stringToEmoji(quote.body),
        },
        // big_picture: '',
        url: encodeURI(`https://boostmequotes.vercel.app/quote/?body=${quote.body}&author=${quote.author}&tag=${quote.tag.join(',')}`),
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

function stringToEmoji(input: string) {
  const emojis = getEmojiJson();

  const originalLowerCase = input.toLowerCase();

  const originalTokenized = input.split(" ");
  const tokenized = originalLowerCase.split(" ");

  tokenized.forEach((token, index) => {
    if (emojis[token]) {
      originalTokenized[index] = `${token} ${emojis[token]}`;
    }
  });

  return originalTokenized.join(" ");
}

function getEmojiJson(): Record<string, string> {
  return {
    "100": "💯",
    "1234": "🔢",
    "grinning": "😀",
    "smiley": "😃",
    "smile": "😄",
    "grin": "😁",
    "laughing": "😆",
    "satisfied": "😆",
    "rofl": "🤣",
    "joy": "😂",
    "wink": "😉",
    "blush": "😊",
    "innocent": "😇",
    "kissing": "😗",
    "relaxed": "☺️",
    "yum": "😋",
    "hugs": "🤗",
    "thinking": "🤔",
    "expressionless": "😑",
    "smirk": "😏",
    "unamused": "😒",
    "grimacing": "😬",
    "relieved": "😌",
    "pensive": "😔",
    "sleepy": "😪",
    "sleeping": "😴",
    "mask": "😷",
    "sunglasses": "😎",
    "confused": "😕",
    "worried": "😟",
    "hushed": "😯",
    "astonished": "😲",
    "flushed": "😳",
    "frowning": "😦",
    "anguished": "😧",
    "fearful": "😨",
    "cry": "😢",
    "sob": "😭",
    "scream": "😱",
    "confounded": "😖",
    "persevere": "😣",
    "disappointed": "😞",
    "sweat": "😓",
    "weary": "😩",
    "triumph": "😤",
    "rage": "😡",
    "pout": "😡",
    "angry": "😠",
    "imp": "👿",
    "skull": "💀",
    "hankey": "💩",
    "poop": "💩",
    "shit": "💩",
    "ghost": "👻",
    "alien": "👽",
    "robot": "🤖",
    "kiss": "💋",
    "cupid": "💘",
    "heartpulse": "💗",
    "heartbeat": "💓",
    "heart": "❤️",
    "anger": "💢",
    "boom": "💥",
    "collision": "💥",
    "dizzy": "💫",
    "dash": "💨",
    "hole": "🕳️",
    "bomb": "💣",
    "zzz": "💤",
    "wave": "👋",
    "hand": "✋",
    "v": "✌️",
    "metal": "🤘",
    "fu": "🖕",
    "+1": "👍",
    "thumbsup": "👍",
    "-1": "👎",
    "thumbsdown": "👎",
    "fist": "✊",
    "facepunch": "👊",
    "punch": "👊",
    "clap": "👏",
    "handshake": "🤝",
    "pray": "🙏",
    "selfie": "🤳",
    "muscle": "💪",
    "leg": "🦵",
    "foot": "🦶",
    "ear": "👂",
    "nose": "👃",
    "brain": "🧠",
    "lungs": "🫁",
    "tooth": "🦷",
    "bone": "🦴",
    "eyes": "👀",
    "eye": "👁️",
    "tongue": "👅",
    "lips": "👄",
    "baby": "👶",
    "child": "🧒",
    "boy": "👦",
    "girl": "👧",
    "adult": "🧑",
    "man": "👨",
    "woman": "👩",
    "bow": "🙇",
    "facepalm": "🤦",
    "shrug": "🤷",
    "student": "🧑‍🎓",
    "teacher": "🧑‍🏫",
    "judge": "🧑‍⚖️",
    "farmer": "🧑‍🌾",
    "cook": "🧑‍🍳",
    "mechanic": "🧑‍🔧",
    "scientist": "🧑‍🔬",
    "technologist": "🧑‍💻",
    "singer": "🧑‍🎤",
    "artist": "🧑‍🎨",
    "pilot": "🧑‍✈️",
    "astronaut": "🧑‍🚀",
    "firefighter": "🧑‍🚒",
    "cop": "👮",
    "policeman": "👮‍♂️",
    "policewoman": "👮‍♀️",
    "detective": "🕵️",
    "guard": "💂",
    "guardsman": "💂‍♂️",
    "guardswoman": "💂‍♀️",
    "ninja": "🥷",
    "prince": "🤴",
    "princess": "👸",
    "angel": "👼",
    "santa": "🎅",
    "superhero": "🦸",
    "supervillain": "🦹",
    "mage": "🧙",
    "fairy": "🧚",
    "vampire": "🧛",
    "merperson": "🧜",
    "merman": "🧜‍♂️",
    "mermaid": "🧜‍♀️",
    "elf": "🧝",
    "genie": "🧞",
    "zombie": "🧟",
    "massage": "💆",
    "haircut": "💇",
    "walking": "🚶",
    "runner": "🏃",
    "running": "🏃",
    "dancer": "💃",
    "dancers": "👯",
    "climbing": "🧗",
    "skier": "⛷️",
    "snowboarder": "🏂",
    "golfing": "🏌️",
    "surfer": "🏄",
    "rowboat": "🚣",
    "swimmer": "🏊",
    "bicyclist": "🚴",
    "cartwheeling": "🤸",
    "wrestling": "🤼",
    "bath": "🛀",
    "couple": "👫",
    "couplekiss": "💏",
    "family": "👪",
    "footprints": "👣",
    "monkey": "🐒",
    "gorilla": "🦍",
    "orangutan": "🦧",
    "dog": "🐶",
    "dog2": "🐕",
    "poodle": "🐩",
    "wolf": "🐺",
    "raccoon": "🦝",
    "cat": "🐱",
    "cat2": "🐈",
    "lion": "🦁",
    "tiger": "🐯",
    "tiger2": "🐅",
    "leopard": "🐆",
    "horse": "🐴",
    "racehorse": "🐎",
    "unicorn": "🦄",
    "zebra": "🦓",
    "deer": "🦌",
    "bison": "🦬",
    "cow": "🐮",
    "ox": "🐂",
    "cow2": "🐄",
    "pig": "🐷",
    "pig2": "🐖",
    "boar": "🐗",
    "ram": "🐏",
    "sheep": "🐑",
    "goat": "🐐",
    "camel": "🐫",
    "llama": "🦙",
    "giraffe": "🦒",
    "elephant": "🐘",
    "mammoth": "🦣",
    "rhinoceros": "🦏",
    "hippopotamus": "🦛",
    "mouse": "🐭",
    "mouse2": "🐁",
    "rat": "🐀",
    "hamster": "🐹",
    "rabbit": "🐰",
    "rabbit2": "🐇",
    "chipmunk": "🐿️",
    "beaver": "🦫",
    "hedgehog": "🦔",
    "bat": "🦇",
    "bear": "🐻",
    "koala": "🐨",
    "sloth": "🦥",
    "otter": "🦦",
    "skunk": "🦨",
    "kangaroo": "🦘",
    "badger": "🦡",
    "feet": "🐾",
    "turkey": "🦃",
    "chicken": "🐔",
    "rooster": "🐓",
    "bird": "🐦",
    "penguin": "🐧",
    "dove": "🕊️",
    "eagle": "🦅",
    "duck": "🦆",
    "swan": "🦢",
    "owl": "🦉",
    "dodo": "🦤",
    "feather": "🪶",
    "flamingo": "🦩",
    "peacock": "🦚",
    "parrot": "🦜",
    "frog": "🐸",
    "crocodile": "🐊",
    "turtle": "🐢",
    "lizard": "🦎",
    "snake": "🐍",
    "dragon": "🐉",
    "sauropod": "🦕",
    "t-rex": "🦖",
    "whale": "🐳",
    "whale2": "🐋",
    "dolphin": "🐬",
    "flipper": "🐬",
    "seal": "🦭",
    "fish": "🐟",
    "blowfish": "🐡",
    "shark": "🦈",
    "octopus": "🐙",
    "shell": "🐚",
    "snail": "🐌",
    "butterfly": "🦋",
    "bug": "🐛",
    "ant": "🐜",
    "bee": "🐝",
    "honeybee": "🐝",
    "beetle": "🪲",
    "cricket": "🦗",
    "cockroach": "🪳",
    "spider": "🕷️",
    "scorpion": "🦂",
    "mosquito": "🦟",
    "fly": "🪰",
    "worm": "🪱",
    "microbe": "🦠",
    "bouquet": "💐",
    "rosette": "🏵️",
    "rose": "🌹",
    "hibiscus": "🌺",
    "sunflower": "🌻",
    "blossom": "🌼",
    "tulip": "🌷",
    "seedling": "🌱",
    "cactus": "🌵",
    "herb": "🌿",
    "shamrock": "☘️",
    "leaves": "🍃",
    "grapes": "🍇",
    "melon": "🍈",
    "watermelon": "🍉",
    "tangerine": "🍊",
    "orange": "🍊",
    "mandarin": "🍊",
    "lemon": "🍋",
    "banana": "🍌",
    "pineapple": "🍍",
    "mango": "🥭",
    "apple": "🍎",
    "pear": "🍐",
    "peach": "🍑",
    "cherries": "🍒",
    "strawberry": "🍓",
    "blueberries": "🫐",
    "tomato": "🍅",
    "olive": "🫒",
    "coconut": "🥥",
    "avocado": "🥑",
    "eggplant": "🍆",
    "potato": "🥔",
    "carrot": "🥕",
    "corn": "🌽",
    "cucumber": "🥒",
    "broccoli": "🥦",
    "garlic": "🧄",
    "onion": "🧅",
    "mushroom": "🍄",
    "peanuts": "🥜",
    "chestnut": "🌰",
    "bread": "🍞",
    "croissant": "🥐",
    "flatbread": "🫓",
    "pretzel": "🥨",
    "bagel": "🥯",
    "pancakes": "🥞",
    "waffle": "🧇",
    "cheese": "🧀",
    "bacon": "🥓",
    "hamburger": "🍔",
    "fries": "🍟",
    "pizza": "🍕",
    "hotdog": "🌭",
    "sandwich": "🥪",
    "taco": "🌮",
    "burrito": "🌯",
    "tamale": "🫔",
    "falafel": "🧆",
    "egg": "🥚",
    "stew": "🍲",
    "fondue": "🫕",
    "popcorn": "🍿",
    "butter": "🧈",
    "salt": "🧂",
    "bento": "🍱",
    "rice": "🍚",
    "curry": "🍛",
    "ramen": "🍜",
    "spaghetti": "🍝",
    "oden": "🍢",
    "sushi": "🍣",
    "dango": "🍡",
    "dumpling": "🥟",
    "crab": "🦀",
    "lobster": "🦞",
    "shrimp": "🦐",
    "squid": "🦑",
    "oyster": "🦪",
    "icecream": "🍦",
    "doughnut": "🍩",
    "cookie": "🍪",
    "birthday": "🎂",
    "cake": "🍰",
    "cupcake": "🧁",
    "pie": "🥧",
    "candy": "🍬",
    "lollipop": "🍭",
    "custard": "🍮",
    "coffee": "☕",
    "teapot": "🫖",
    "tea": "🍵",
    "sake": "🍶",
    "champagne": "🍾",
    "cocktail": "🍸",
    "beer": "🍺",
    "beers": "🍻",
    "mate": "🧉",
    "chopsticks": "🥢",
    "spoon": "🥄",
    "hocho": "🔪",
    "knife": "🔪",
    "amphora": "🏺",
    "japan": "🗾",
    "compass": "🧭",
    "mountain": "⛰️",
    "volcano": "🌋",
    "camping": "🏕️",
    "desert": "🏜️",
    "stadium": "🏟️",
    "bricks": "🧱",
    "rock": "🪨",
    "wood": "🪵",
    "hut": "🛖",
    "houses": "🏘️",
    "house": "🏠",
    "office": "🏢",
    "hospital": "🏥",
    "bank": "🏦",
    "hotel": "🏨",
    "school": "🏫",
    "factory": "🏭",
    "wedding": "💒",
    "church": "⛪",
    "mosque": "🕌",
    "synagogue": "🕍",
    "kaaba": "🕋",
    "fountain": "⛲",
    "tent": "⛺",
    "foggy": "🌁",
    "cityscape": "🏙️",
    "sunrise": "🌅",
    "hotsprings": "♨️",
    "barber": "💈",
    "train2": "🚆",
    "metro": "🚇",
    "station": "🚉",
    "tram": "🚊",
    "monorail": "🚝",
    "train": "🚋",
    "bus": "🚌",
    "trolleybus": "🚎",
    "minibus": "🚐",
    "ambulance": "🚑",
    "taxi": "🚕",
    "car": "🚗",
    "truck": "🚚",
    "tractor": "🚜",
    "motorcycle": "🏍️",
    "bike": "🚲",
    "skateboard": "🛹",
    "busstop": "🚏",
    "motorway": "🛣️",
    "fuelpump": "⛽",
    "construction": "🚧",
    "anchor": "⚓",
    "boat": "⛵",
    "sailboat": "⛵",
    "canoe": "🛶",
    "speedboat": "🚤",
    "ferry": "⛴️",
    "ship": "🚢",
    "airplane": "✈️",
    "parachute": "🪂",
    "seat": "💺",
    "helicopter": "🚁",
    "rocket": "🚀",
    "luggage": "🧳",
    "hourglass": "⌛",
    "watch": "⌚",
    "stopwatch": "⏱️",
    "clock12": "🕛",
    "clock1230": "🕧",
    "clock1": "🕐",
    "clock130": "🕜",
    "clock2": "🕑",
    "clock230": "🕝",
    "clock3": "🕒",
    "clock330": "🕞",
    "clock4": "🕓",
    "clock430": "🕟",
    "clock5": "🕔",
    "clock530": "🕠",
    "clock6": "🕕",
    "clock630": "🕡",
    "clock7": "🕖",
    "clock730": "🕢",
    "clock8": "🕗",
    "clock830": "🕣",
    "clock9": "🕘",
    "clock930": "🕤",
    "clock10": "🕙",
    "clock1030": "🕥",
    "clock11": "🕚",
    "clock1130": "🕦",
    "moon": "🌔",
    "thermometer": "🌡️",
    "sunny": "☀️",
    "star": "⭐",
    "star2": "🌟",
    "stars": "🌠",
    "cloud": "☁️",
    "tornado": "🌪️",
    "fog": "🌫️",
    "cyclone": "🌀",
    "rainbow": "🌈",
    "umbrella": "☔",
    "zap": "⚡",
    "snowflake": "❄️",
    "snowman": "⛄",
    "comet": "☄️",
    "fire": "🔥",
    "droplet": "💧",
    "ocean": "🌊",
    "fireworks": "🎆",
    "sparkler": "🎇",
    "firecracker": "🧨",
    "sparkles": "✨",
    "balloon": "🎈",
    "tada": "🎉",
    "bamboo": "🎍",
    "dolls": "🎎",
    "flags": "🎏",
    "ribbon": "🎀",
    "gift": "🎁",
    "tickets": "🎟️",
    "ticket": "🎫",
    "trophy": "🏆",
    "soccer": "⚽",
    "baseball": "⚾",
    "softball": "🥎",
    "basketball": "🏀",
    "volleyball": "🏐",
    "football": "🏈",
    "tennis": "🎾",
    "bowling": "🎳",
    "lacrosse": "🥍",
    "badminton": "🏸",
    "golf": "⛳",
    "ski": "🎿",
    "sled": "🛷",
    "dart": "🎯",
    "kite": "🪁",
    "8ball": "🎱",
    "joystick": "🕹️",
    "jigsaw": "🧩",
    "pinata": "🪅",
    "spades": "♠️",
    "hearts": "♥️",
    "diamonds": "♦️",
    "clubs": "♣️",
    "mahjong": "🀄",
    "art": "🎨",
    "thread": "🧵",
    "yarn": "🧶",
    "knot": "🪢",
    "eyeglasses": "👓",
    "goggles": "🥽",
    "necktie": "👔",
    "shirt": "👕",
    "tshirt": "👕",
    "jeans": "👖",
    "scarf": "🧣",
    "gloves": "🧤",
    "coat": "🧥",
    "socks": "🧦",
    "dress": "👗",
    "kimono": "👘",
    "sari": "🥻",
    "shorts": "🩳",
    "bikini": "👙",
    "purse": "👛",
    "handbag": "👜",
    "pouch": "👝",
    "shopping": "🛍️",
    "shoe": "👞",
    "sandal": "👡",
    "boot": "👢",
    "crown": "👑",
    "tophat": "🎩",
    "lipstick": "💄",
    "ring": "💍",
    "gem": "💎",
    "mute": "🔇",
    "speaker": "🔈",
    "sound": "🔉",
    "loudspeaker": "📢",
    "mega": "📣",
    "bell": "🔔",
    "notes": "🎶",
    "microphone": "🎤",
    "headphones": "🎧",
    "radio": "📻",
    "saxophone": "🎷",
    "accordion": "🪗",
    "guitar": "🎸",
    "trumpet": "🎺",
    "violin": "🎻",
    "banjo": "🪕",
    "drum": "🥁",
    "iphone": "📱",
    "calling": "📲",
    "phone": "☎️",
    "telephone": "☎️",
    "pager": "📟",
    "fax": "📠",
    "battery": "🔋",
    "computer": "💻",
    "printer": "🖨️",
    "keyboard": "⌨️",
    "trackball": "🖲️",
    "minidisc": "💽",
    "cd": "💿",
    "dvd": "📀",
    "abacus": "🧮",
    "clapper": "🎬",
    "tv": "📺",
    "camera": "📷",
    "vhs": "📼",
    "mag": "🔍",
    "candle": "🕯️",
    "bulb": "💡",
    "flashlight": "🔦",
    "lantern": "🏮",
    "book": "📖",
    "books": "📚",
    "notebook": "📓",
    "ledger": "📒",
    "scroll": "📜",
    "newspaper": "📰",
    "bookmark": "🔖",
    "label": "🏷️",
    "moneybag": "💰",
    "coin": "🪙",
    "yen": "💴",
    "dollar": "💵",
    "euro": "💶",
    "pound": "💷",
    "receipt": "🧾",
    "chart": "💹",
    "envelope": "✉️",
    "email": "📧",
    "e-mail": "📧",
    "package": "📦",
    "mailbox": "📫",
    "postbox": "📮",
    "pencil2": "✏️",
    "pen": "🖊️",
    "paintbrush": "🖌️",
    "crayon": "🖍️",
    "memo": "📝",
    "pencil": "📝",
    "briefcase": "💼",
    "date": "📅",
    "calendar": "📆",
    "clipboard": "📋",
    "pushpin": "📌",
    "paperclip": "📎",
    "paperclips": "🖇️",
    "scissors": "✂️",
    "wastebasket": "🗑️",
    "lock": "🔒",
    "unlock": "🔓",
    "key": "🔑",
    "hammer": "🔨",
    "axe": "🪓",
    "pick": "⛏️",
    "dagger": "🗡️",
    "gun": "🔫",
    "boomerang": "🪃",
    "shield": "🛡️",
    "wrench": "🔧",
    "screwdriver": "🪛",
    "gear": "⚙️",
    "clamp": "🗜️",
    "link": "🔗",
    "chains": "⛓️",
    "hook": "🪝",
    "toolbox": "🧰",
    "magnet": "🧲",
    "ladder": "🪜",
    "alembic": "⚗️",
    "dna": "🧬",
    "microscope": "🔬",
    "telescope": "🔭",
    "satellite": "📡",
    "syringe": "💉",
    "pill": "💊",
    "stethoscope": "🩺",
    "door": "🚪",
    "elevator": "🛗",
    "mirror": "🪞",
    "window": "🪟",
    "bed": "🛏️",
    "chair": "🪑",
    "toilet": "🚽",
    "plunger": "🪠",
    "shower": "🚿",
    "bathtub": "🛁",
    "razor": "🪒",
    "broom": "🧹",
    "basket": "🧺",
    "bucket": "🪣",
    "soap": "🧼",
    "toothbrush": "🪥",
    "sponge": "🧽",
    "smoking": "🚬",
    "coffin": "⚰️",
    "headstone": "🪦",
    "moyai": "🗿",
    "placard": "🪧",
    "atm": "🏧",
    "wheelchair": "♿",
    "mens": "🚹",
    "womens": "🚺",
    "restroom": "🚻",
    "wc": "🚾",
    "customs": "🛃",
    "warning": "⚠️",
    "underage": "🔞",
    "radioactive": "☢️",
    "biohazard": "☣️",
    "back": "🔙",
    "end": "🔚",
    "on": "🔛",
    "soon": "🔜",
    "top": "🔝",
    "om": "🕉️",
    "menorah": "🕎",
    "aries": "♈",
    "taurus": "♉",
    "gemini": "♊",
    "cancer": "♋",
    "leo": "♌",
    "virgo": "♍",
    "libra": "♎",
    "scorpius": "♏",
    "sagittarius": "♐",
    "capricorn": "♑",
    "aquarius": "♒",
    "pisces": "♓",
    "ophiuchus": "⛎",
    "repeat": "🔁",
    "rewind": "⏪",
    "cinema": "🎦",
    "infinity": "♾️",
    "bangbang": "‼️",
    "interrobang": "⁉️",
    "question": "❓",
    "exclamation": "❗",
    "recycle": "♻️",
    "trident": "🔱",
    "beginner": "🔰",
    "o": "⭕",
    "emojis": "❌",
    "loop": "➿",
    "sparkle": "❇️",
    "copyright": "©️",
    "registered": "®️",
    "tm": "™️",
    "hash": "#️⃣",
    "asterisk": "*️⃣",
    "zero": "0️⃣",
    "one": "1️⃣",
    "two": "2️⃣",
    "three": "3️⃣",
    "four": "4️⃣",
    "five": "5️⃣",
    "six": "6️⃣",
    "seven": "7️⃣",
    "eight": "8️⃣",
    "nine": "9️⃣",
    "abcd": "🔡",
    "symbols": "🔣",
    "abc": "🔤",
    "u6708": "🈷️",
    "u6709": "🈶",
    "u6307": "🈯",
    "u5272": "🈹",
    "u7121": "🈚",
    "u7981": "🈲",
    "accept": "🉑",
    "u7533": "🈸",
    "u5408": "🈴",
    "u7a7a": "🈳",
    "congratulations": "㊗️",
    "secret": "㊙️",
    "u55b6": "🈺",
    "u6e80": "🈵"
  }
}