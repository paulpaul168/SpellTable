/** WebRTC helpers for admin → viewer screen share over the existing WS hub. */

const ICE_SERVERS: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
];

export function createPeerConnection(
    onIceCandidate: (candidate: RTCIceCandidateInit | null) => void,
): RTCPeerConnection {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    pc.onicecandidate = (event) => {
        if (event.candidate) {
            onIceCandidate(event.candidate.toJSON());
        } else {
            onIceCandidate(null);
        }
    };

    return pc;
}

export function attachLocalStream(
    pc: RTCPeerConnection,
    stream: MediaStream,
): void {
    for (const track of stream.getTracks()) {
        pc.addTrack(track, stream);
    }
}

export async function createOffer(
    pc: RTCPeerConnection,
): Promise<RTCSessionDescriptionInit> {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    return pc.localDescription ?? offer;
}

export async function applyRemoteOffer(
    pc: RTCPeerConnection,
    sdp: RTCSessionDescriptionInit,
): Promise<RTCSessionDescriptionInit> {
    await pc.setRemoteDescription(sdp);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    return pc.localDescription ?? answer;
}

export async function applyRemoteAnswer(
    pc: RTCPeerConnection,
    sdp: RTCSessionDescriptionInit,
): Promise<void> {
    await pc.setRemoteDescription(sdp);
}

export async function addIceCandidate(
    pc: RTCPeerConnection,
    candidate: RTCIceCandidateInit | null,
): Promise<void> {
    if (!candidate) {
        return;
    }
    try {
        await pc.addIceCandidate(candidate);
    } catch (error) {
        // Candidates can arrive before remote description is set; ignore benign failures.
        console.warn('Failed to add ICE candidate:', error);
    }
}

export function closePeerConnection(pc: RTCPeerConnection | null): void {
    if (!pc) return;
    try {
        pc.onicecandidate = null;
        pc.ontrack = null;
        pc.onconnectionstatechange = null;
        pc.close();
    } catch {
        // ignore
    }
}

export function stopMediaStream(stream: MediaStream | null): void {
    if (!stream) return;
    for (const track of stream.getTracks()) {
        track.stop();
    }
}

/**
 * Capture display with audio when possible; fall back to video-only.
 * Returns `{ stream, audioAvailable }`.
 */
export async function captureDisplay(): Promise<{
    stream: MediaStream;
    audioAvailable: boolean;
}> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getDisplayMedia) {
        throw new Error('Screen sharing is not supported in this browser');
    }

    try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: true,
        });
        const audioAvailable = stream.getAudioTracks().length > 0;
        return { stream, audioAvailable };
    } catch (error) {
        // User dismissed the picker — do not open a second prompt.
        if (error instanceof DOMException && error.name === 'AbortError') {
            throw error;
        }
        // Combined capture often fails on Linux; retry video-only.
        // NotAllowedError is also retried: some desktops reject audio that way.
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: false,
            });
            return { stream, audioAvailable: false };
        } catch {
            throw error;
        }
    }
}
