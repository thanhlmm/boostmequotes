/// <reference types="@sveltejs/kit" />

type ITimeRange = 'workday' | 'weekend' | 'alltimes';
type IShift = 'morning' | 'afternoon' | 'night';

interface ISettings {
    time: ITimeRange;
    maxQuotes: number;
    receivedFromCommunity: boolean,
    pushToken?: string;
    tag: string[];
    enabled: boolean;
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
}

interface IMessage {
    name: string;
    type: "invoke" | "reply"
    args: any;
}