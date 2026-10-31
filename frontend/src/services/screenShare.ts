/** WebRTC helpers for admin → viewer screen share over the existing WS hub. */

const ICE_SERVERS: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
];

/** Pi 5–friendly capture/encode caps (decode happens on the table viewer). */
const DISPLAY_VIDEO_CONSTRAINTS: MediaTrackConstraints = {
    width: { max: 1920 },
    height: { max: 1080 },
    frameRate: { max: 24 },
};

const MAX_SHARE_FRAMERATE = 24;
const MAX_SHARE_BITRATE = 2_500_000;
const MAX_SHARE_HEIGHT = 1080;

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

/**
 * Cap outbound video encode for weaker table viewers (e.g. Raspberry Pi 5).
 * Best-effort: browsers may ignore some encodings fields.
 */
export async function configureScreenShareSender(
    pc: RTCPeerConnection,
    stream: MediaStream,
): Promise<void> {
    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack) {
        return;
    }

    const settings = videoTrack.getSettings();
    const height = settings.height ?? 0;
    const scaleResolutionDownBy =
        height > MAX_SHARE_HEIGHT ? height / MAX_SHARE_HEIGHT : 1;

    for (const sender of pc.getSenders()) {
        if (sender.track?.kind !== 'video') {
            continue;
        }
        try {
            const params = sender.getParameters();
            if (!params.encodings || params.encodings.length === 0) {
                params.encodings = [{}];
            }
            for (const encoding of params.encodings) {
                encoding.maxFramerate = MAX_SHARE_FRAMERATE;
                encoding.maxBitrate = MAX_SHARE_BITRATE;
                encoding.scaleResolutionDownBy = scaleResolutionDownBy;
            }
            await sender.setParameters(params);
        } catch (error) {
            console.warn('Failed to configure screen-share sender:', error);
        }
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

function applyVideoTrackHints(stream: MediaStream): void {
    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack) {
        return;
    }
    try {
        videoTrack.contentHint = 'detail';
    } catch {
        // contentHint is best-effort
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
            video: DISPLAY_VIDEO_CONSTRAINTS,
            audio: true,
        });
        applyVideoTrackHints(stream);
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
                video: DISPLAY_VIDEO_CONSTRAINTS,
                audio: false,
            });
            applyVideoTrackHints(stream);
            return { stream, audioAvailable: false };
        } catch {
            throw error;
        }
    }
}
