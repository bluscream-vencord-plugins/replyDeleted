//// Plugin originally written for Equicord at 2026-02-16 by https://github.com/Bluscream, https://antigravity.google
// region Imports
import { findByProps } from "@webpack";
import { ChannelStore, MessageActions, MessageStore } from "@webpack/common";
import { Logger } from "@utils/Logger";
import definePlugin from "@utils/types";

import { settings } from "./settings";
// endregion Imports

// region PluginInfo
export const pluginInfo = {
    id: "replyDeleted",
    name: "ReplyDeleted",
    description: "Intercepts replies to deleted messages and sends them as quoted text",
    color: "#7289da",
    authors: [
        { name: "Bluscream", id: 467777925790564352n },
        { name: "Assistant", id: 0n }
    ],
};
// endregion PluginInfo

// region Variables
const logger = new Logger(pluginInfo.id, pluginInfo.color);
let unpatch: () => void;
// endregion Variables

// region Utils
function formatTimestamp(date: Date, format: string): string {
    try {
        const moment = findByProps("moment")?.moment || (window as any).moment;
        if (moment) return moment(date).format(format);
    } catch { }
    return date.toLocaleString();
}

function processTemplate(template: string, message: any, replyContent: string): string {
    return template.replace(/{(\w+)(?::([^}]+))?}/g, (match, key, arg) => {
        switch (key) {
            case "sent":
                return formatTimestamp(new Date(message.timestamp), arg || "dd/MM/yyyy HH:mm");
            case "sent_unix":
                return Math.floor(new Date(message.timestamp).getTime() / 1000).toString();
            case "author_id":
                return message.author.id;
            case "author_username":
                return message.author.username;
            case "message_id":
                return message.id;
            case "channel_id":
                return message.channel_id;
            case "guild_id":
                return ChannelStore.getChannel(message.channel_id)?.guild_id || "";
            case "message":
                return message.content;
            case "reply":
                return replyContent;
            default:
                return match;
        }
    });
}

function checkAndPatch(MessageActionCreators: any, funcName: string) {
    const original = MessageActionCreators[funcName];

    MessageActionCreators[funcName] = async function (...args: any[]) {
        const optionsIndex = args.findIndex(a => a && typeof a === "object" && "messageReference" in a);

        if (optionsIndex !== -1) {
            const options = args[optionsIndex];
            const refId = options.messageReference.message_id;
            const channelId = args[0];
            const message = MessageStore.getMessage(channelId, refId);

            if (!message) {
                const { showToast, Toasts } = findByProps("showToast");
                showToast("Cannot reply: Original message not found (potentially deleted).", Toasts.Type.FAILURE);
                return Promise.reject(new Error("MessageLoggerReply blocked: Message not found"));
            }

            if (message.deleted) {
                const contentIndex = 1;
                const contentArg = args[contentIndex];
                const rawContent = typeof contentArg === "string" ? contentArg : contentArg?.content || "";

                const newContentStr = processTemplate(settings.store.replyTemplate, message, rawContent);

                if (typeof contentArg === "string") {
                    args[contentIndex] = newContentStr;
                } else if (typeof contentArg === "object") {
                    args[contentIndex] = { ...contentArg, content: newContentStr };
                }

                const newOptions = { ...options };
                delete newOptions.messageReference;
                args[optionsIndex] = newOptions;

                return original.apply(this, args);
            }
        }

        try {
            return await original.apply(this, args);
        } catch (err: any) {
            if (optionsIndex !== -1 && (err?.body?.code === 10008 || err?.status === 404)) {
                const options = args[optionsIndex];
                const refId = options.messageReference.message_id;
                const channelId = args[0];
                const message = MessageStore.getMessage(channelId, refId);

                if (message) {
                    const contentIndex = 1;
                    const contentArg = args[contentIndex];
                    const rawContent = typeof contentArg === "string" ? contentArg : contentArg?.content || "";

                    const newContentStr = processTemplate(settings.store.replyTemplate, message, rawContent);

                    if (typeof contentArg === "string") {
                        args[contentIndex] = newContentStr;
                    } else {
                        args[contentIndex] = { ...contentArg, content: newContentStr };
                    }

                    const newOptions = { ...options };
                    delete newOptions.messageReference;
                    args[optionsIndex] = newOptions;

                    return original.apply(this, args);
                }
            }
            throw err;
        }
    };

    return () => {
        MessageActionCreators[funcName] = original;
    };
}
// endregion Utils

// region Definition
export default definePlugin({
    name: pluginInfo.name,
    description: pluginInfo.description,
    authors: pluginInfo.authors,
    settings,

    start() {
        if (!MessageActions) {
            logger.error("MessageActions not found");
            return;
        }

        unpatch = checkAndPatch(MessageActions, "sendMessage");
    },

    stop() {
        if (unpatch) unpatch();
    }
});
// endregion Definition
