# Prompt for react-p2p-host: add optional QR components

Add optional QR code components to **react-p2p-host** so any project using the library can show a QR for the room link and for the answer without depending on a QR library themselves. This should live in the library and be reusable.

## Requirements

1. **Room link QR (host)**  
   A component that receives the room URL (the shareable link with `?offer=...`) and renders a QR code. When someone scans it, they open that URL and can join the room.  
   - Props: `link: string`, optional `size?: number` (e.g. 180), optional `className?: string`.  
   - Example usage: `<RoomLinkQR link={roomLink} size={180} />`

2. **Answer QR (peer)**  
   A component that receives the answer string (`answerToSend`) and renders a QR code. When the host scans it, they get the code (as text) to paste and connect.  
   - Props: `answer: string`, optional `size?: number` (answer can be long, so a bit larger or higher error correction), optional `className?: string`.  
   - Example usage: `<AnswerQR answer={answerToSend ?? ''} size={200} />`

3. **Implementation**  
   - Use **qrcode.react** (or similar) inside the library. Add it as a **dependency** (not peer) so consumers don’t have to install it unless they use the QR components.  
   - Export two components, e.g. `RoomLinkQR` and `AnswerQR`, that render an SVG (e.g. `QRCodeSVG` from qrcode.react) with the given value.  
   - Keep them unstyled (no extra wrapper/background) or accept a minimal `className` so each app can style the container.  
   - For the answer QR, use a higher error correction level (e.g. `level="H"`) because the string is long.

4. **Exports**  
   - Export from the main entry: `export { RoomLinkQR, AnswerQR } from './components/room-link-qr'` (or similar paths).  
   - Document in the README: optional QR components for room link and answer, so users can show “scan to join” and “scan to get the code” in their UI.

5. **No breaking changes**  
   - Purely additive: new exports. Existing apps keep working without using the QR components.

Once this is in the library, the demo (react-p2p-host-demo) will use these components to show the room link QR in the host modal and the answer QR in the peer modal.
