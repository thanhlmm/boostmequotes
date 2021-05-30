declare module 'promise-sequence';

type ITimeRange = 'workday' | 'weekend' | 'alltimes';

interface ISettings {
    time: ITimeRange;
    maxQuotes: number;
    receivedFromCommunity: boolean,
    pushToken?: string;
    tag: string[];
    enabled: boolean;
    timezone?: string;
}

interface IUserState {
    _id: string;
    remainingQuote: number;
    todayQuotes: string[];
    nextTrigger: number;
}

interface IQuotes {
    _id: string;
    body: string;
    author: string;
    url?: string;
    image?: string;
    tag: string[];
    icon?: string;
    timerange?: [string, string];
    source?: string;
}