class AudioRecorder {
    constructor() {
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.isRecording = false;
        this.stream = null;
        
        // Enhanced iOS detection
        this.isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        this.iosVersion = this.getIOSVersion();
        
        console.log(`Device detection: iOS: ${this.isIOS}, version: ${this.iosVersion || 'unknown'}`);
        
        // Best MIME types to try in order of preference
        this.mimeTypes = [
            'audio/mp4',          // Best for iOS (especially iOS 18)
            'audio/aac',          // Another iOS option
            'audio/webm',         // Best for Chrome, Firefox, etc.
            'audio/mpeg',         // Fallback
            'audio/ogg;codecs=opus', // Another option
            '' // Empty string = browser's default
        ];

        // If on iOS, prioritize formats that work better there
        if (this.isIOS) {
            this.mimeTypes = [
                'audio/mp4',
                'audio/aac',
                'audio/m4a',
                'audio/mpeg',
                'audio/webm',
                ''
            ];
        }
    }

    // Get iOS version number if available
    getIOSVersion() {
        if (this.isIOS) {
            const match = navigator.userAgent.match(/OS (\d+)_(\d+)_?(\d+)?/);
            return match ? parseInt(match[1], 10) : null;
        }
        return null;
    }

    async startRecording() {
        try {
            this.audioChunks = [];
            this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            // Find the best supported MIME type
            let mimeType = '';
            for (const type of this.mimeTypes) {
                if (type && MediaRecorder.isTypeSupported(type)) {
                    mimeType = type;
                    break;
                }
            }
            
            // iOS-specific options
            const options = {};
            if (mimeType) {
                options.mimeType = mimeType;
            }
            
            // More specific options for iOS
            if (this.isIOS) {
                // Lower bitrate for iOS (helps with compatibility)
                options.audioBitsPerSecond = 48000;
                
                // Different bitrate for iOS 18
                if (this.iosVersion >= 18) {
                    options.audioBitsPerSecond = 64000;
                }
            }
            
            console.log(`Using audio format: ${mimeType || 'browser default'} with options:`, options);
            this.mediaRecorder = new MediaRecorder(this.stream, options);
            
            this.mediaRecorder.addEventListener('dataavailable', event => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                    console.log(`Received audio chunk: ${event.data.size} bytes, type: ${event.data.type}`);
                }
            });
            
            this.mediaRecorder.start();
            this.isRecording = true;
            
            return true;
        } catch (error) {
            console.error('Error starting recording:', error);
            
            // User-friendly error message for permission issues
            if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
                alert('Microphone access denied. Please enable microphone permissions in your browser settings.');
            } else if (this.isIOS && (error.name === 'NotSupportedError' || error.message.includes('MIME'))) {
                alert('Your iOS device is having trouble with audio recording. Try using the audio upload option instead.');
            }
            
            return false;
        }
    }

    stopRecording() {
        return new Promise((resolve) => {
            if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
                resolve(null);
                return;
            }
            
            this.mediaRecorder.addEventListener('stop', () => {
                let audioBlob;
                let audioType;
                
                // For iOS, we need special handling
                if (this.isIOS && this.audioChunks.length > 0) {
                    // Check the type of the first chunk
                    const firstChunkType = this.audioChunks[0].type;
                    
                    // Determine the best MIME type to use
                    if (firstChunkType && firstChunkType !== '') {
                        audioType = firstChunkType;
                    } else if (this.iosVersion >= 18) {
                        // For iOS 18, use m4a which is better supported
                        audioType = 'audio/m4a';
                    } else {
                        // For older iOS versions
                        audioType = 'audio/mp4';
                    }
                    
                    console.log(`Creating iOS audio blob with type: ${audioType}`);
                    audioBlob = new Blob(this.audioChunks, { type: audioType });
                } else {
                    // Standard approach for other browsers
                    audioType = this.mediaRecorder.mimeType || 'audio/webm';
                    audioBlob = new Blob(this.audioChunks, { type: audioType });
                }
                
                console.log(`Created final audio blob: ${audioBlob.type}, size: ${audioBlob.size} bytes`);
                
                this.isRecording = false;
                this.stopMediaTracks();
                resolve({
                    blob: audioBlob,
                    type: audioType,
                    isIOS: this.isIOS,
                    iosVersion: this.iosVersion
                });
            });
            
            this.mediaRecorder.stop();
        });
    }
    
    stopMediaTracks() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
    }
}

// Create a global instance of the audio recorder
const audioRecorder = new AudioRecorder();
