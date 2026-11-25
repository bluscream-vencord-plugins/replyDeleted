# ReplyDeleted

Equicord user plugin: when you reply to a message that MessageLogger kept after it was deleted, the reply is sent as a quote of that message instead of a reply that Discord would reject.

It only acts while MessageLogger is enabled and the message you reply to is marked as deleted. Every other reply is sent unchanged.

## Template

The **Reply template** setting decides what gets sent. These variables are filled in:

| Variable | Meaning |
| --- | --- |
| `{message}` | The deleted message, quoted. Mentions in it are defused so they don't ping anyone again, and it's shortened to fit Discord's 2000 character limit. |
| `{reply}` | What you typed. |
| `{author_username}`, `{author_id}` | Who wrote the deleted message. `<@{author_id}>` pings them. |
| `{sent:format}`, `{sent_unix}` | When it was sent. The format uses moment syntax, `DD/MM/YYYY HH:mm` by default. |
| `{message_id}`, `{channel_id}`, `{guild_id}` | For building a link. `{guild_id}` is `@me` in DMs. |

The default no longer pings the author. A template you saved earlier is kept as is.

## Install

```sh
cd src/userplugins
git clone https://github.com/bluscream-vencord-plugins/replyDeleted
```

Rebuild Equicord and enable ReplyDeleted and MessageLogger. Update with `git pull`.
