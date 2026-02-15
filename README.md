# react-p2p-host — Demo

Official demo of [react-p2p-host](https://www.npmjs.com/package/react-p2p-host): P2P room in the browser with no server and real-time chat.

## Development

```bash
npm install
npm run dev
```

## Local server + LAN (e.g. PC + phone)

WebRTC often **does not work** when one device opens the app over HTTP via LAN (e.g. `http://192.168.1.x:3000`). Browsers treat this as a non-secure context and may block or limit WebRTC.

- **To test with two devices:** use the [deployed demo](https://react-p2p-host.vercel.app) (HTTPS).
- **To test locally:** open two tabs on the same machine at `http://localhost:3000` (Create room in one, paste the link in the other).

The app shows a notice when it detects it is running over HTTP (non-localhost) and suggests these options.

## Static build

```bash
npm run build
```

This produces the `out/` folder, ready to host as static files.

## Deploy on Vercel

Connect this repo in [Vercel](https://vercel.com) and deploy. To get a URL like `react-p2p-host.vercel.app`, create the project with that name in the Vercel dashboard.
