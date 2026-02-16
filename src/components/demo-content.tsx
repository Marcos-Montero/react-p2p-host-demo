"use client";

import { useEffect, useRef, useState } from "react";
import {
  useP2PLink,
  useSharedState,
  useP2PContext,
  RoomLinkQR,
  AnswerQR,
} from "react-p2p-host";
import { Share, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

type Message = {
  id: string;
  text: string;
  sender: string;
  timestamp: number;
};

function getRoomLink(offerLink: string | null): string {
  if (!offerLink || typeof window === "undefined") return "";
  if (offerLink.startsWith("http")) return offerLink;
  return `${window.location.origin}${window.location.pathname}?offer=${offerLink}`;
}

function extractOfferFromInput(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (trimmed.includes("offer=")) {
    const query = trimmed.includes("?") ? trimmed.split("?")[1] ?? "" : trimmed;
    return new URLSearchParams(query).get("offer") ?? trimmed;
  }
  return trimmed;
}

function normalizePastedCode(raw: string): string {
  return raw.trim().replace(/\s+/g, "");
}

function copyToClipboardSafe(text: string): boolean {
  if (typeof window === "undefined" || !text) return false;
  try {
    if (navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(text);
      return true;
    }
    const el = document.createElement("textarea");
    el.value = text;
    el.setAttribute("readonly", "");
    el.style.position = "absolute";
    el.style.left = "-9999px";
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
}

function isLocalOrInsecureContext(): boolean {
  if (typeof window === "undefined") return false;
  const { protocol, hostname } = window.location;
  const isSecure = protocol === "https:";
  const isLocalhost =
    hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
  return !isSecure && !isLocalhost;
}

export function DemoContent() {
  const {
    status,
    isHost,
    connectedPeers,
    offerLink,
    answerToSend,
    startAsHost,
    inviteNextPeer,
    joinAsPeer,
    applyAnswerAsHost,
    disconnect,
    recoveredSession,
  } = useP2PLink();
  const { connectionRef, lastMessage } = useP2PContext();
  const [messages, setMessages] = useSharedState<{ messages: Message[] }>({
    messages: [],
  });
  const [answerInput, setAnswerInput] = useState("");
  const [joinInput, setJoinInput] = useState("");
  const [showLinkCopiedModal, setShowLinkCopiedModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinStep, setJoinStep] = useState<"paste" | "send-code">("paste");
  const [createdRoomLink, setCreatedRoomLink] = useState<string | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [connectingInProgress, setConnectingInProgress] = useState(false);
  const hasJoinedFromUrl = useRef(false);
  const hasRecoveredRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined" || hasJoinedFromUrl.current) return;
    const params = new URLSearchParams(window.location.search);
    const offer = params.get("offer");
    if (offer && status === "idle") {
      hasJoinedFromUrl.current = true;
      setShowJoinModal(true);
      setJoinStep("send-code");
      joinAsPeer(offer).catch(() => {
        hasJoinedFromUrl.current = false;
        setJoinStep("paste");
      });
    }
  }, [joinAsPeer, status]);

  useEffect(() => {
    if (!recoveredSession || hasRecoveredRef.current || hasJoinedFromUrl.current) return;
    if (isHost && status === "idle") {
      hasRecoveredRef.current = true;
      toast.info("Session recovered", {
        description: "Your previous chat was restored. Share a new link to reconnect players.",
      });
      startAsHost().then((link) => {
        copyToClipboardSafe(link);
        setCreatedRoomLink(link);
        setShowLinkCopiedModal(true);
      });
    }
  }, [recoveredSession, isHost, status, startAsHost]);

  const connected = status === "connected";

  const lastProcessedMsg = useRef<string | null>(null);
  useEffect(() => {
    if (!isHost || !lastMessage || lastMessage === lastProcessedMsg.current) return;
    lastProcessedMsg.current = lastMessage;
    try {
      const parsed = JSON.parse(lastMessage);
      if (parsed.id && parsed.text && parsed.sender && parsed.timestamp) {
        const msg = parsed as Message;
        setMessages((prev) => {
          if (prev.messages.some((m) => m.id === msg.id)) return prev;
          return { messages: [...prev.messages, msg] };
        });
      }
    } catch {
      // ignore non-chat messages
    }
  }, [isHost, lastMessage, setMessages]);

  const handleCreateRoom = async () => {
    toast.loading("Creating room...", { id: "create-room" });
    const offer = await startAsHost();
    const link =
      typeof window !== "undefined"
        ? offer.startsWith("http")
          ? offer
          : `${window.location.origin}${window.location.pathname}?offer=${offer}`
        : "";
    if (link) copyToClipboardSafe(link);
    setCreatedRoomLink(link);
    setShowLinkCopiedModal(true);
    toast.success("Room created", {
      id: "create-room",
      description: "Link copied. Share it, then paste the code when you get it.",
    });
  };

  const handleInviteAnother = async () => {
    toast.loading("Generating invite link...", { id: "invite" });
    const link = await inviteNextPeer();
    if (link) copyToClipboardSafe(link);
    setCreatedRoomLink(link);
    setAnswerInput("");
    setConnectError(null);
    setConnectingInProgress(false);
    setShowLinkCopiedModal(true);
    toast.success("New invite link copied", {
      id: "invite",
      description: "Share this link with the next player.",
    });
  };

  const roomLink = createdRoomLink || getRoomLink(offerLink);

  const handleShareLink = async () => {
    if (!roomLink) return;
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({
          title: "P2P room",
          url: roomLink,
        });
      } else {
        copyToClipboardSafe(roomLink);
      }
    } catch {
      copyToClipboardSafe(roomLink);
    }
  };

  const handleShareCode = async () => {
    if (!answerToSend) return;
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({
          title: "Connection code",
          url: answerToSend,
        });
      } else {
        copyToClipboardSafe(answerToSend);
      }
    } catch {
      copyToClipboardSafe(answerToSend);
    }
  };

  const handleJoinSubmit = () => {
    const offer = extractOfferFromInput(joinInput);
    if (!offer) {
      toast.warning("No link", { description: "Paste the room link first." });
      return;
    }
    setJoinStep("send-code");
    toast.loading("Joining room...", { id: "join" });
    joinAsPeer(offer)
      .then(() => {
        toast.success("Code ready", {
          id: "join",
          description: "Send this code to the host. When they paste it and connect, chat will open.",
        });
      })
      .catch((err) => {
        setJoinStep("paste");
        toast.error("Join failed", { id: "join", description: String(err?.message ?? err) });
      });
  };

  const normalizedAnswer = normalizePastedCode(answerInput);

  const handleHostPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData?.getData("text") ?? "";
    const code = normalizePastedCode(pasted);
    if (code) {
      setAnswerInput(code);
      setConnectError(null);
    }
  };

  const handleHostConnect = async () => {
    if (!normalizedAnswer) {
      toast.warning("No code", { description: "Paste the code first." });
      return;
    }
    setConnectError(null);
    setConnectingInProgress(true);
    toast.loading("Connecting...", { id: "connect" });
    try {
      await applyAnswerAsHost(normalizedAnswer);
      toast.success("Connected", { id: "connect" });
      setAnswerInput("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Connection failed";
      setConnectError(msg);
      toast.error("Connection failed", { id: "connect", description: msg });
    } finally {
      setConnectingInProgress(false);
    }
  };

  const handleSendMessage = () => {
    const text = chatInput.trim();
    if (!text) return;
    const msg: Message = {
      id: crypto.randomUUID(),
      text,
      sender: isHost ? "host" : "peer",
      timestamp: Date.now(),
    };
    if (isHost) {
      setMessages((prev) => ({ messages: [...prev.messages, msg] }));
    } else if (connectionRef.current) {
      connectionRef.current.send(JSON.stringify(msg));
    }
    setChatInput("");
  };

  const [chatInput, setChatInput] = useState("");

  useEffect(() => {
    if (connected) {
      setShowLinkCopiedModal(false);
      setShowJoinModal(false);
      setJoinStep("paste");
      setConnectError(null);
      setConnectingInProgress(false);
    }
  }, [connected]);

  const prevStatus = useRef(status);
  const connectingSince = useRef<number | null>(null);
  useEffect(() => {
    if (prevStatus.current !== status) {
      if (status === "connecting") connectingSince.current = Date.now();
      else connectingSince.current = null;
      toast.info(`Status: ${status}`, {
        description:
          status === "offer-ready"
            ? "Share the link. When you get the code, paste it and click Connect."
            : status === "connecting"
              ? "WebRTC is negotiating. This may take a few seconds."
              : status === "connected"
                ? "Connected! Chat is ready."
                : status === "error"
                  ? "Connection failed. Try again or check the code."
                  : undefined,
      });
      prevStatus.current = status;
    }
  }, [status]);

  useEffect(() => {
    if (status !== "connecting") return;
    const t = setTimeout(() => {
      const elapsed = connectingSince.current
        ? (Date.now() - connectingSince.current) / 1000
        : 0;
      if (elapsed >= 12) {
        toast.warning("Still connecting?", {
          description:
            "Try two tabs on the same device (same URL). If that works, the issue is network/NAT; some networks need a TURN relay.",
          duration: 10000,
        });
      }
    }, 15000);
    return () => clearTimeout(t);
  }, [status]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b px-4 py-8 text-center md:px-8">
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
          react-p2p-host
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground text-sm leading-relaxed md:text-base">
          Connect multiple players in a P2P room in the browser, no server.
          Create the room and share the link, or join by pasting the one you
          receive.
        </p>
        {isLocalOrInsecureContext() && (
          <div className="bg-amber-500/10 border-amber-500/30 mx-auto mt-4 max-w-xl rounded-lg border px-4 py-3 text-left text-sm">
            <p className="font-medium text-amber-800 dark:text-amber-200">
              Running over HTTP (e.g. LAN IP). WebRTC may not connect.
            </p>
            <p className="mt-1 text-amber-700 dark:text-amber-300">
              For PC + phone, use the{" "}
              <a
                href="https://react-p2p-host.vercel.app"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                deployed demo (HTTPS)
              </a>
              . To test locally, open two tabs on the same machine (localhost).
            </p>
          </div>
        )}
      </header>

      <main className="mx-auto max-w-2xl space-y-6 px-4 py-8 md:px-8">
        {!connected && status === "idle" && (
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button
              size="lg"
              onClick={handleCreateRoom}
              disabled={status !== "idle"}
            >
              Create room
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => {
                setShowJoinModal(true);
                setJoinStep("paste");
                setJoinInput("");
              }}
            >
              Join room
            </Button>
          </div>
        )}

        {!connected && status !== "idle" && status !== "offer-ready" && (
          <p className="text-muted-foreground text-center text-sm">
            {status === "creating-offer" && "Creating room…"}
            {(status === "joining" || status === "connecting") && "Connecting…"}
            {status === "error" && (
              <span className="text-destructive text-xs">
                Invalid code or connection failed. Copy the code again without
                extra spaces.
              </span>
            )}
            {(status === "disconnected" || status === "error") && (
              <>
                <Button variant="link" className="p-0 h-auto" onClick={disconnect}>
                  Back
                </Button>
              </>
            )}
          </p>
        )}

        {status === "offer-ready" && !showLinkCopiedModal && (
          <div className="flex justify-center">
            <Button variant="outline" onClick={() => setShowLinkCopiedModal(true)}>
              Show link and code
            </Button>
          </div>
        )}

        <Dialog open={showLinkCopiedModal} onOpenChange={setShowLinkCopiedModal}>
          <DialogContent showCloseButton={true}>
            <DialogHeader>
              <DialogTitle>
                {connectedPeers > 0 ? "Invite another player" : "Room link copied"}
              </DialogTitle>
              <DialogDescription>
                {connectedPeers > 0
                  ? "Share this new link with the next player. When they join, paste their code below."
                  : "The link has been copied to your clipboard. Share it via WhatsApp, Telegram, or any app. When the other player joins, they will send you a code; paste it below to open the chat for both."}
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4 py-2">
              <Button
                variant="outline"
                className="w-full"
                onClick={handleShareLink}
              >
                <Share className="mr-2 size-4" />
                Share link (WhatsApp, Telegram…)
              </Button>
              {roomLink ? (
                <div className="flex flex-col items-center gap-2">
                  <p className="text-muted-foreground text-sm">
                    Or scan to join the room
                  </p>
                  <div className="rounded-lg border bg-white p-2">
                    <RoomLinkQR link={roomLink} size={180} />
                  </div>
                </div>
              ) : null}
              <div className="space-y-2">
                <label className="text-muted-foreground text-sm">
                  Paste the code the other player sends you:
                </label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Paste only the code (no extra text)"
                    value={answerInput}
                    onChange={(e) => {
                      setAnswerInput(e.target.value);
                      setConnectError(null);
                    }}
                    onPaste={handleHostPaste}
                    className="font-mono text-sm"
                    disabled={connectingInProgress}
                  />
                  <Button
                    onClick={handleHostConnect}
                    disabled={!normalizedAnswer || connectingInProgress}
                  >
                    {connectingInProgress ? "Connecting…" : "Connect"}
                  </Button>
                </div>
                {connectingInProgress && (
                  <p className="text-muted-foreground text-sm">
                    Connecting… Make sure you pasted the full code from the other
                    player.
                  </p>
                )}
                {connectError && (
                  <p className="text-destructive text-sm">{connectError}</p>
                )}
              </div>
            </div>
            <DialogFooter showCloseButton={false} />
          </DialogContent>
        </Dialog>

        <Dialog open={showJoinModal} onOpenChange={setShowJoinModal}>
          <DialogContent showCloseButton={true}>
            {joinStep === "paste" ? (
              <>
                <DialogHeader>
                  <DialogTitle>Join room</DialogTitle>
                  <DialogDescription>
                    Paste the link or code you received. After joining, you will
                    get a code to send to the host; when they paste it and click
                    Connect, the chat will open for both.
                  </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col gap-2 py-2">
                  <Input
                    placeholder="Paste room link here"
                    value={joinInput}
                    onChange={(e) => setJoinInput(e.target.value)}
                    onKeyDown={(e) =>
                      e.key === "Enter" && (e.preventDefault(), handleJoinSubmit())
                    }
                    className="font-mono text-sm"
                    autoFocus
                  />
                  <Button
                    onClick={handleJoinSubmit}
                    disabled={!joinInput.trim() || status === "joining"}
                  >
                    Join
                  </Button>
                </div>
              </>
            ) : (
              <>
                <DialogHeader>
                  <DialogTitle>Code for the host</DialogTitle>
                  <DialogDescription>
                    Send this code to the host (via WhatsApp, Telegram, or by
                    copying). When they paste it and click Connect, the chat
                    will open here and on their screen automatically.
                  </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col gap-2 py-2">
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={answerToSend ?? ""}
                      className="font-mono text-xs"
                    />
                    <Button
                      variant="outline"
                      onClick={() =>
                        answerToSend && copyToClipboardSafe(answerToSend)
                      }
                    >
                      Copy
                    </Button>
                  </div>
                  <Button variant="outline" onClick={handleShareCode}>
                    <Share className="mr-2 size-4" />
                    Share (WhatsApp, Telegram…)
                  </Button>
                  {answerToSend ? (
                    <div className="flex flex-col items-center gap-2">
                      <p className="text-muted-foreground text-sm">
                        Or host can scan this QR to get the code
                      </p>
                      <div className="rounded-lg border bg-white p-2">
                        <AnswerQR answer={answerToSend} size={200} />
                      </div>
                    </div>
                  ) : null}
                  {(status === "joining" || status === "connecting") && (
                    <p className="text-muted-foreground text-sm">
                      Waiting for the host to paste your code and click
                      Connect…
                    </p>
                  )}
                </div>
              </>
            )}
            <DialogFooter showCloseButton={false} />
          </DialogContent>
        </Dialog>

        {connected && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-muted-foreground text-sm">
                {connectedPeers} player{connectedPeers !== 1 ? "s" : ""} connected
              </p>
              <div className="flex gap-2">
                {isHost && (
                  <Button variant="outline" size="sm" onClick={handleInviteAnother}>
                    <UserPlus className="mr-2 size-4" />
                    Invite another
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={disconnect}>
                  Disconnect
                </Button>
              </div>
            </div>
            <Card>
              <CardHeader>
                <CardTitle>Chat</CardTitle>
                <CardDescription>
                  Real-time messages between all connected players.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ScrollArea className="h-[280px] rounded-md border p-3">
                  <div className="space-y-2">
                    {messages.messages.length === 0 ? (
                      <p className="text-muted-foreground text-sm">
                        No messages yet. Type something.
                      </p>
                    ) : (
                      messages.messages.map((msg) => (
                        <div
                          key={msg.id}
                          className={`rounded-lg px-3 py-1.5 text-sm ${
                            msg.sender === "host"
                              ? "bg-primary/10 ml-4"
                              : "bg-muted mr-4"
                          }`}
                        >
                          <span className="text-muted-foreground font-medium text-xs">
                            {msg.sender === "host" ? "Host" : "Player"}:
                          </span>{" "}
                          {msg.text}
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
                <div className="flex gap-2">
                  <Input
                    placeholder="Type a message..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) =>
                      e.key === "Enter" &&
                      (e.preventDefault(), handleSendMessage())
                    }
                  />
                  <Button onClick={handleSendMessage}>Send</Button>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </main>

      <footer className="border-t px-4 py-6 text-center text-muted-foreground text-sm md:px-8">
        <code className="rounded bg-muted px-2 py-0.5">
          npm install react-p2p-host
        </code>
        <span className="mx-2">·</span>
        <a
          href="https://github.com/Marcos-Montero/react-lobby"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-foreground"
        >
          Repository
        </a>
      </footer>
    </div>
  );
}
