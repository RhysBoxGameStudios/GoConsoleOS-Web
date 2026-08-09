# GoConsoleOS-Web

**GoConsoleOS Account Center (ACC)** — the web home of the GoConsoleOS account system.

Hosted on GitHub Pages at <https://rhysboxgamestudios.github.io/GoConsoleOS-Web/>

## What it does

A full account dashboard in the style of a modern Microsoft account page:

- **Sign in / Create account** (tabs)
- **Profile** — display name, bio, email, locale
- **Devices** — register and remove consoles (USB, Android, web)
- **Security** — two-factor authentication toggle
- **Wallet** — GoPoints balance, add points
- **Subscriptions** — Free / Basic / Plus / Pro tiers
- **Friends** — add by username
- **Activity** — recent account events
- **GoAI** — the gaming assistant, chat right in the browser

## How it connects

The site is a client for the GoConsoleOS server REST API (`/api/acc/*`, `/api/goai`, `/api/info`)
that runs **inside** every GoConsoleOS console on port `39210`:

- `http://localhost:39210/` — open on the console itself (served by the console)
- `http://<console-ip>:39210/` — from any browser on the LAN
- On GitHub Pages, pass `?host=<console-ip>` to point the page at a console

If no console is reachable the UI still renders and explains how to connect.

## Files

| File        | Purpose                              |
|-------------|--------------------------------------|
| `index.html`| Single-page dashboard markup        |
| `acc.css`   | Styling (dark console theme)         |
| `acc.js`    | API client, auth flow and rendering  |

## Repos

- **GoConsoleOS** — desktop USB gaming console (GoConsole.exe / GoConsoleOS.exe) with the built-in server
- **GoConsoleOS-Android** — portable companion app with an on-device server too
- **GoConsoleOS-Web** — this site
