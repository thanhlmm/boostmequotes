/// <reference types="@sveltejs/kit" />

type ITimeRange = 'workday' | 'weekend' | 'alltimes'
type IShift = 'morning' | 'afternoon' | 'night';

interface ISettings {
    time: ITimeRange;
    maxQuotes: number;
    receivedFromCommunity: boolean,
    pushToken?: string;
    tag: string[]
}

interface IQuotes {
    body: string;
    author: string;
    url?: string;
    image?: string;
    tag: string[];
    icon?: string;
    timerange: [string, string];
}