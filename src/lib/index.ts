import type firebase from 'firebase';
const lazyApp = import('firebase/app');
const lazyMessaging = import('firebase/messaging');
const lazyFunction = import('firebase/functions');
// import 'firebase/analytics';

let firebaseInstance;
let firebaseMessaging;
let firebaseFunction;
let isInited = false;

const firebaseConfig = {
    apiKey: 'AIzaSyBK5XaWLple3MeGuzp1GfU7HKKRe2T03KI',
    authDomain: 'boost-me-quotes.firebaseapp.com',
    projectId: 'boost-me-quotes',
    storageBucket: 'boost-me-quotes.appspot.com',
    messagingSenderId: '477870834608',
    appId: '1:477870834608:web:7eff0a5b9b9c92a3b84c75',
    measurementId: 'G-JWPT4FLD4Y'
};

const init = () => Promise.all([lazyApp, lazyMessaging, lazyFunction]).then(([firebase]) => {
    if (firebase.default.apps.length <= 0) {
        firebase.default.initializeApp(firebaseConfig);
    }

    firebaseInstance = firebase.default.app();
    firebaseMessaging = firebase.default.messaging();
    firebaseFunction = firebase.default.functions();
    isInited = true;
});


export const Messaging = (): Promise<firebase.messaging.Messaging> => {
    return init().then(() => firebaseMessaging);
}

export const Functions = (): Promise<firebase.functions.Functions> => {
    return init().then(() => firebaseFunction);
}