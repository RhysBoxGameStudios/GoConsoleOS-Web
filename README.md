# GoConsoleOS Account Center (web)

The GoConsoleOS ACC (Account, Cloud & Community) web app. It is served two ways:

1. **From your console** — the GoConsoleOS server inside `GoConsole.exe` /
   `GoConsoleOS.exe` hosts this site at `http://<console-ip>:39210/` together
   with the `/api/acc/*` REST API and the `/api/goai` assistant.
2. **From GitHub Pages** — a static mirror for preview / marketing. Point it at a
   console with `?host=192.168.1.10`.

## Features

- Sign in / create account (password hashing, session tokens)
- Profile (display name, bio, email, locale, avatar)
- Devices (register / remove your USB consoles, Android, web)
- Security (two-factor toggle)
- Wallet (GoPoints)
- Subscriptions (GoConsole Game Pass: Pro / Plus / Premium / Ultimate) with
  day / month / year durations and stacking
- Gift cards (generate + redeem codes, e.g. `GC-XXXX-XXXX-XXXX`)
- Friends
- Activity log
- GoAI chat assistant (runs on the console, fully offline)

## API

All endpoints are `POST/GET/PATCH/DELETE` against `/api/acc/*` on port `39210`.
Authenticated calls send `{ "token": "<session>" }` in the JSON body.

- `POST /api/acc/register`  `{username, displayName, email, password}`
- `POST /api/acc/login`     `{username, password}` -> `{token, profile}`
- `POST /api/acc/logout`    `{token}`
- `GET/PATCH /api/acc/profile` `{token, ...fields}`
- `GET/POST/DELETE /api/acc/devices[/{id}]`
- `GET/POST /api/acc/subscriptions` `{token, plan, amount, unit}` (unit: days/months/years)
- `GET /api/acc/plans`              Game Pass tier catalog
- `POST /api/acc/giftcards/generate` `{token, plan, amount, unit, count}`
- `POST /api/acc/giftcards/redeem`  `{token, code}`
- `GET /api/acc/giftcards`
- `GET/POST /api/acc/wallet`
- `GET/POST /api/acc/friends`
- `GET /api/acc/activity`
- `POST /api/goai`          `{message}` -> `{reply, suggestions}`
- `GET /api/info`           console metadata

## Local preview

```powershell
# serve the site + API together
dotnet run --project src/GoConsole -- # then open http://localhost:39210
```
