'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { websocketService, WebSocketMessage } from '@/services/websocket';
import {
    addIceCandidate,
    applyRemoteOffer,
    closePeerConnection,
    createPeerConnection,
} from '@/services/screenShare';

export function useScreenShareViewer() {
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
    const [isShareActive, setIsShareActive] = useState(false);
    const pcRef = useRef<RTCPeerConnection | null>(null);
    const sharerIdRef = useRef<string | null>(null);
    const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
    const requestedRef = useRef(false);

    const cleanupPeer = useCallback(() => {
        closePeerConnection(pcRef.current);
        pcRef.current = null;
        pendingCandidatesRef.current = [];
        requestedRef.current = false;
        setRemoteStream(null);
    }, []);

    const requestShare = useCallback((sharerId?: string | null) => {
        if (requestedRef.current) {
            return;
        }
        requestedRef.current = true;
        const payload: WebSocketMessage = { type: 'screen_share_request' };
        if (sharerId) {
            payload.targetClientId = sharerId;
        }
        websocketService.send(payload);
    }, []);

    const handleStopped = useCallback(() => {
        sharerIdRef.current = null;
        setIsShareActive(false);
        cleanupPeer();
    }, [cleanupPeer]);

    useEffect(() => {
        const unsubscribe = websocketService.addListener(
            async (data: WebSocketMessage) => {
                if (data.type === 'screen_share_started') {
                    const sharerId =
                        typeof data.fromClientId === 'string'
                            ? data.fromClientId
                            : null;
                    sharerIdRef.current = sharerId;
                    setIsShareActive(true);
                    // Allow a fresh request after reconnect / re-announce
                    requestedRef.current = false;
                    cleanupPeer();
                    requestShare(sharerId);
                    return;
                }

                if (data.type === 'screen_share_stopped') {
                    handleStopped();
                    return;
                }

                if (
                    data.type === 'screen_share_offer' &&
                    typeof data.fromClientId === 'string' &&
                    data.sdp
                ) {
                    sharerIdRef.current = data.fromClientId;
                    setIsShareActive(true);
                    closePeerConnection(pcRef.current);
                    pendingCandidatesRef.current = [];

                    const pc = createPeerConnection((candidate) => {
                        websocketService.send({
                            type: 'screen_share_ice',
                            targetClientId: data.fromClientId,
                            candidate,
                        });
                    });
                    pcRef.current = pc;

                    pc.ontrack = (event) => {
                        const [stream] = event.streams;
                        if (stream) {
                            setRemoteStream(stream);
                        } else if (event.track) {
                            setRemoteStream((prev) => {
                                const next = prev ?? new MediaStream();
                                next.addTrack(event.track);
                                return next;
                            });
                        }
                    };

                    pc.onconnectionstatechange = () => {
                        if (
                            pc.connectionState === 'failed' ||
                            pc.connectionState === 'closed'
                        ) {
                            cleanupPeer();
                        }
                    };

                    try {
                        const answer = await applyRemoteOffer(pc, data.sdp);
                        for (const candidate of pendingCandidatesRef.current) {
                            await addIceCandidate(pc, candidate);
                        }
                        pendingCandidatesRef.current = [];
                        websocketService.send({
                            type: 'screen_share_answer',
                            targetClientId: data.fromClientId,
                            sdp: answer,
                        });
                    } catch (error) {
                        console.error('Failed to answer screen-share offer:', error);
                        cleanupPeer();
                    }
                    return;
                }

                if (
                    data.type === 'screen_share_ice' &&
                    data.candidate !== undefined
                ) {
                    const candidate = data.candidate as RTCIceCandidateInit | null;
                    const pc = pcRef.current;
                    if (!pc || !pc.remoteDescription) {
                        if (candidate) {
                            pendingCandidatesRef.current.push(candidate);
                        }
                        return;
                    }
                    await addIceCandidate(pc, candidate);
                }
            },
        );

        return () => {
            unsubscribe();
            cleanupPeer();
        };
    }, [cleanupPeer, handleStopped, requestShare]);

    return {
        remoteStream,
        isShareActive,
    };
}
