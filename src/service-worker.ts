/// <reference lib="WebWorker" />
// export empty type because of tsc --isolatedModules flag
export type { };
declare const self: ServiceWorkerGlobalScope;

import firebase from 'firebase/app';
import 'firebase/messaging';

self.addEventListener('install', event => {
  console.log(`SW: Event fired: ${event.type}`);

  console.dir(event);
  // force service worker activation
  self.skipWaiting();
});


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
