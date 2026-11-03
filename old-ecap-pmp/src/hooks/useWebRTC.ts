import { useState, useEffect, useRef, useCallback } from "react";
import Peer, { MediaConnection } from "peerjs";

export type CallState = "idle" | "incoming" | "outgoing" | "connecting" | "active" | "ended";

export const useWebRTC = (userId: string | undefined) => {
  const [state, setState] = useState<CallState>("idle");
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  const peerRef = useRef<Peer | null>(null);
  const callRef = useRef<MediaConnection | null>(null);
  const cameraVideoTrackRef = useRef<MediaStreamTrack | null>(null);

  const cleanup = useCallback(() => {
    if (callRef.current) {
      callRef.current.close();
      callRef.current = null;
    }
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    setLocalStream(null);
    setRemoteStream(null);
    setState("idle");
    setPartnerId(null);
    setIsScreenSharing(false);
    cameraVideoTrackRef.current = null;
  }, [localStream]);

  // Initialize PeerJS
  useEffect(() => {
    if (!userId) return;

    const peer = new Peer(userId, {
      debug: 2
    });

    peer.on("open", (id) => {
      console.log("PeerJS: Connected with ID", id);
    });

    peer.on("call", (incomingCall) => {
      console.log("PeerJS: Incoming call from", incomingCall.peer);
      setPartnerId(incomingCall.peer);
      setState("incoming");
      callRef.current = incomingCall;

      incomingCall.on("stream", (remoteStream) => {
        console.log("PeerJS: Received remote stream");
        setRemoteStream(remoteStream);
        setState("active");
      });

      incomingCall.on("close", () => {
        console.log("PeerJS: Call closed by remote");
        cleanup();
      });

      incomingCall.on("error", (err) => {
        console.error("PeerJS: Call error", err);
        cleanup();
      });
    });

    peer.on("error", (err) => {
      console.error("PeerJS: Peer error", err);
    });

    peerRef.current = peer;

    return () => {
      peer.destroy();
    };
  }, [userId]);

  const startCall = async (targetId: string, type: "audio" | "video") => {
    if (!peerRef.current) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: type === "video",
        audio: true,
      });
      setLocalStream(stream);
      const videoTrack = stream.getVideoTracks()[0] || null;
      cameraVideoTrackRef.current = videoTrack;
      setPartnerId(targetId);
      setState("outgoing");

      const call = peerRef.current.call(targetId, stream);
      callRef.current = call;

      call.on("stream", (remoteStream) => {
        console.log("PeerJS: Received remote stream (outgoing)");
        setRemoteStream(remoteStream);
        setState("active");
      });

      call.on("close", () => {
        console.log("PeerJS: Outgoing call closed");
        cleanup();
      });

      call.on("error", (err) => {
        console.error("PeerJS: Outgoing call error", err);
        cleanup();
      });

    } catch (err) {
      console.error("PeerJS: Failed to start call", err);
      cleanup();
    }
  };

  const acceptCall = async () => {
    if (!callRef.current) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      setLocalStream(stream);
      const videoTrack = stream.getVideoTracks()[0] || null;
      cameraVideoTrackRef.current = videoTrack;
      setState("connecting");

      console.log("PeerJS: Answering call with local stream");
      callRef.current.answer(stream);
      // Wait for 'stream' event to set state to active
    } catch (err) {
      console.error("PeerJS: Failed to accept call", err);
      cleanup();
    }
  };

  const endCall = useCallback(async () => {
    cleanup();
  }, [cleanup]);

  const startScreenShare = async () => {
    if (!callRef.current) return;
    try {
      const screenStream = await (navigator.mediaDevices as any).getDisplayMedia({
        video: true,
        audio: false,
      });

      const screenTrack: MediaStreamTrack | undefined = screenStream.getVideoTracks()[0];
      if (!screenTrack) {
        return;
      }

      // Preserve original camera track for later
      if (!cameraVideoTrackRef.current && localStream) {
        cameraVideoTrackRef.current = localStream.getVideoTracks()[0] || null;
      }

      const connection: any = callRef.current;
      const sender = connection?.peerConnection
        ?.getSenders()
        ?.find((s: RTCRtpSender) => s.track && s.track.kind === "video");

      if (sender && screenTrack) {
        await sender.replaceTrack(screenTrack);

        const audioTracks = localStream?.getAudioTracks() || [];
        const combined = new MediaStream([screenTrack, ...audioTracks]);
        setLocalStream(combined);
        setIsScreenSharing(true);

        screenTrack.onended = () => {
          // When user stops share from browser UI
          stopScreenShare();
        };
      }
    } catch (err) {
      console.error("PeerJS: Failed to start screen share", err);
    }
  };

  const stopScreenShare = async () => {
    if (!callRef.current || !cameraVideoTrackRef.current) {
      setIsScreenSharing(false);
      return;
    }
    try {
      const cameraTrack = cameraVideoTrackRef.current;

      const connection: any = callRef.current;
      const sender = connection?.peerConnection
        ?.getSenders()
        ?.find((s: RTCRtpSender) => s.track && s.track.kind === "video");

      if (sender && cameraTrack) {
        await sender.replaceTrack(cameraTrack);

        const audioTracks = localStream?.getAudioTracks() || [];
        const combined = new MediaStream([cameraTrack, ...audioTracks]);
        setLocalStream(combined);
      }
    } catch (err) {
      console.error("PeerJS: Failed to stop screen share", err);
    } finally {
      setIsScreenSharing(false);
    }
  };

  return {
    state,
    localStream,
    remoteStream,
    partnerId,
    startCall,
    acceptCall,
    endCall,
    startScreenShare,
    stopScreenShare,
    isScreenSharing,
  };
};
