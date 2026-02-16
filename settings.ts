import { definePluginSettings } from "@api/Settings";
import { OptionType } from "@utils/types";

const DEFAULT_TEMPLATE = `<@{author_id}> [said](https://discord.com/channels/{guild_id}/{channel_id}/{message_id}) <t:{sent_unix}:R>:
> {message}

{reply}`;

export const settings = definePluginSettings({
    replyTemplate: {
        type: OptionType.STRING,
        default: DEFAULT_TEMPLATE,
        description: "Template for replying to deleted messages",
        multiline: true,
        restartNeeded: false,
    },
    templateReference: {
        type: OptionType.STRING,
        description: "Template variables reference (Calculated field)",
        default: "{sent:format} {sent_unix} {author_id} {author_username} {message_id} {channel_id} {guild_id} {message} {reply}",
        readonly: true,
        restartNeeded: false,
        onChange() {
            settings.store.templateReference = settings.def.templateReference.default;
        },
    }
});
