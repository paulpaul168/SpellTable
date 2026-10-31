'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { websocketService, WebSocketMessage } from '@/services/websocket';
import {
    addIceCandidate,
    applyRemoteAnswer,
    attachLocalStream,
    captureDisplay,
    closePeerConnection,
    configureScreenShareSender,
    createOffer,
    createPeerConnection,
    stopMediaStream,
} from '@/services/screenShare';

type PeerEntry = {
    pc: RTCPeerConnection;
    pendingCandidates: RTCIceCandidateInit[];
};

export function useScreenSharePublisher() {
    const [isSharing, setIsSharing] = useState(false);
    const localStreamRef = useRef<MediaStream | null>(null);
    const peersRef = useRef<Map<string, PeerEntry>>(new Map());
    const isSharingRef = useRef(false);

    const cleanupPeer = useCallback((viewerId: string) => {
        const entry = peersRef.current.get(viewerId);
        if (!entry) return;
        closePeerConnection(entry.pc);
        peersRef.current.delete(viewerId);
    }, []);

    const stopSharing = useCallback(() => {
        for (const viewerId of [...peersRef.current.keys()]) {
            cleanupPeer(viewerId);
        }
        stopMediaStream(localStreamRef.current);
        localStreamRef.current = null;
        isSharingRef.current = false;
        setIsSharing(false);
        websocketService.send({ type: 'screen_share_stopped' });
    }, [cleanupPeer]);

    const ensurePeer = useCallback(async (viewerId: string) => {
        const stream = localStreamRef.current;
        if (!stream || !isSharingRef.current) {
            return;
        }

        // Replace existing peer for this viewer (renegotiation / re-request)
        cleanupPeer(viewerId);

        const pc = createPeerConnection((candidate) => {
            websocketService.send({
                type: 'screen_share_ice',
                targetClientId: viewerId,
                candidate,
            });
        });

        attachLocalStream(pc, stream);
        await configureScreenShareSender(pc, stream);

        const entry: PeerEntry = { pc, pendingCandidates: [] };
        peersRef.current.set(viewerId, entry);

        pc.onconnectionstatechange = () => {
            if (
                pc.connectionState === 'failed' ||
                pc.connectionState === 'closed' ||
                pc.connectionState === 'disconnected'
            ) {
                // Keep peer around on disconnected briefly; clean failed/closed
                if (
                    pc.connectionState === 'failed' ||
                    pc.connectionState === 'closed'
                ) {
                    cleanupPeer(viewerId);
                }
            }
        };

        const offer = await createOffer(pc);
        websocketService.send({
            type: 'screen_share_offer',
            targetClientId: viewerId,
            sdp: offer,
        });
    }, [cleanupPeer]);

    useEffect(() => {
        const unsubscribe = websocketService.addListener(
            async (data: WebSocketMessage) => {
                // After WS reconnect, re-announce so viewers re-request offers
                if (
                    data.type === 'connection_status' &&
                    data.status === 'connected' &&
                    isSharingRef.current
                ) {
                    for (const viewerId of [...peersRef.current.keys()]) {
                        cleanupPeer(viewerId);
                    }
                    websocketService.send({ type: 'screen_share_started' });
                    return;
                }

                if (!isSharingRef.current) {
                    return;
                }

                if (
                    data.type === 'screen_share_request' &&
                    typeof data.fromClientId === 'string'
                ) {
                    try {
                        await ensurePeer(data.fromClientId);
                    } catch (error) {
                        console.error('Failed to create screen-share offer:', error);
                    }
                    return;
                }

                if (
                    data.type === 'screen_share_answer' &&
                    typeof data.fromClientId === 'string' &&
                    data.sdp
                ) {
                    const entry = peersRef.current.get(data.fromClientId);
                    if (!entry) return;
                    try {
                        await applyRemoteAnswer(entry.pc, data.sdp);
                        for (const candidate of entry.pendingCandidates) {
                            await addIceCandidate(entry.pc, candidate);
                        }
                        entry.pendingCandidates = [];
                    } catch (error) {
                        console.error('Failed to apply screen-share answer:', error);
                    }
                    return;
                }

                if (
                    data.type === 'screen_share_ice' &&
                    typeof data.fromClientId === 'string' &&
                    data.candidate !== undefined
                ) {
                    const entry = peersRef.current.get(data.fromClientId);
                    if (!entry) return;
                    const candidate = data.candidate as RTCIceCandidateInit | null;
                    if (!entry.pc.remoteDescription) {
                        if (candidate) {
                            entry.pendingCandidates.push(candidate);
                        }
                        return;
                    }
                    await addIceCandidate(entry.pc, candidate);
                }
            },
        );

        return unsubscribe;
    }, [cleanupPeer, ensurePeer]);

    const startSharing = useCallback(async (): Promise<{ audioAvailable: boolean }> => {
        if (isSharingRef.current) {
            return {
                audioAvailable:
                    (localStreamRef.current?.getAudioTracks().length ?? 0) > 0,
            };
        }

        const { stream, audioAvailable } = await captureDisplay();
        localStreamRef.current = stream;
        isSharingRef.current = true;
        setIsSharing(true);

        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
            videoTrack.addEventListener('ended', () => {
                stopSharing();
            });
        }

        websocketService.send({ type: 'screen_share_started' });
        return { audioAvailable };
    }, [stopSharing]);

    useEffect(() => {
        const peers = peersRef.current;
        return () => {
            if (isSharingRef.current) {
                for (const viewerId of [...peers.keys()]) {
                    closePeerConnection(peers.get(viewerId)?.pc ?? null);
                }
                peers.clear();
                stopMediaStream(localStreamRef.current);
                localStreamRef.current = null;
                isSharingRef.current = false;
                websocketService.send({ type: 'screen_share_stopped' });
            }
        };
    }, []);

    return {
        isSharing,
        startSharing,
        stopSharing,
    };
}
