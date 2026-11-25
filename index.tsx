/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { isPluginEnabled } from "@api/PluginManager";
import { definePluginSettings } from "@api/Settings";
import { ZWSP } from "@utils/text";
import definePlugin, { OptionType } from "@utils/types";
import { Message } from "@vencord/discord-types";
import { ChannelStore, MessageActions, MessageStore, moment } from "@webpack/common";

const PATTERNS = {
    placeholder: /{(\w+)(?::([^}]+))?}/g,
    mention: /@/g,
    newline: /\n/g,
    quotedPlaceholder: /> ?{message}/g,
    referenceKey: "messageReference",
    messageLogger: "MessageLogger",
    defaultDateFormat: "DD/MM/YYYY HH:mm",
    dmGuild: "@me",
    maxLength: 2000,
    defaultTemplate: `{author_username} [said](https://discord.com/channels/{guild_id}/{channel_id}/{message_id}) <t:{sent_unix}:R>:
{message}

{reply}`
};

const settings = definePluginSettings({
    replyTemplate: {
        type: OptionType.STRING,
        default: PATTERNS.defaultTemplate,
        description: "Template used when replying to a deleted message. Variables: {sent:format}, {sent_unix}, {author_id}, {author_username}, {message_id}, {channel_id}, {guild_id}, {message} and {reply}.",
        multiline: true
    }
});

type LoggedMessage = Message & { deleted?: boolean; };
interface ReplyOptions { messageReference?: { message_id: string; }; }
type MessageContent = string | { content?: string; };
type SendMessage = (this: unknown, ...args: unknown[]) => unknown;

function isReplyOptions(value: unknown): value is ReplyOptions {
    return typeof value === "object" && value !== null && PATTERNS.referenceKey in value;
}

function quote(content: string, budget: number) {
    if (!content) return "";
    const safe = content.replace(PATTERNS.mention, `@${ZWSP}`);
    const cut = safe.length > budget ? safe.slice(0, Math.max(0, budget - 1)) + "…" : safe;
    return "> " + cut.replace(PATTERNS.newline, "\n> ");
}

function fill(template: string, message: LoggedMessage, reply: string, quoted: string) {
    return template.replace(PATTERNS.placeholder, (match, key: string, arg: string | undefined) => {
        switch (key) {
            case "sent": return moment(message.timestamp).format(arg || PATTERNS.defaultDateFormat);
            case "sent_unix": return String(Math.floor(new Date(message.timestamp).getTime() / 1000));
            case "author_id": return message.author.id;
            case "author_username": return message.author.username;
            case "message_id": return message.id;
            case "channel_id": return message.channel_id;
            case "guild_id": return ChannelStore.getChannel(message.channel_id)?.guild_id || PATTERNS.dmGuild;
            case "message": return quoted;
            case "reply": return reply;
            default: return match;
        }
    });
}

function rewrite(savedTemplate: string, message: LoggedMessage, reply: string) {
    const template = savedTemplate.replace(PATTERNS.quotedPlaceholder, "{message}");
    const withoutQuote = fill(template, message, reply, "");
    return fill(template, message, reply, quote(message.content, PATTERNS.maxLength - withoutQuote.length - 2));
}

let original: SendMessage | undefined;
let active = false;

const wrapper: SendMessage = function (...args) {
    const send = original as SendMessage;
    const optionsIndex = args.findIndex(isReplyOptions);
    if (!active || optionsIndex === -1 || !isPluginEnabled(PATTERNS.messageLogger)) return send.apply(this, args);

    const options = args[optionsIndex] as ReplyOptions;
    const refId = options.messageReference?.message_id;
    const message: LoggedMessage | undefined = refId ? MessageStore.getMessage(args[0] as string, refId) : undefined;
    if (!message?.deleted) return send.apply(this, args);

    const content = args[1] as MessageContent;
    const reply = typeof content === "string" ? content : content?.content ?? "";
    const text = rewrite(settings.store.replyTemplate, message, reply);
    args[1] = typeof content === "string" ? text : { ...content, content: text };

    const { messageReference, ...rest } = options;
    args[optionsIndex] = rest;
    return send.apply(this, args);
};

export default definePlugin({
    name: "ReplyDeleted",
    description: "Sends replies to messages deleted under MessageLogger as a quote instead of a broken reply.",
    authors: [
        { name: "Bluscream", id: 467777925790564352n },
        { name: "b1uscr34m", id: 896443818935713853n },
        { name: "Antigravity.AI", id: 0n }
    ],
    settings,

    start() {
        active = true;
        if (original) return;
        original = MessageActions.sendMessage;
        MessageActions.sendMessage = wrapper;
    },

    stop() {
        active = false;
        if (MessageActions.sendMessage !== wrapper || !original) return;
        MessageActions.sendMessage = original;
        original = undefined;
    }
});
