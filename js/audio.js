class AudioRecorder {
    constructor() {
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.isRecording = false;
        this.stream = null;
        
        // Detect iOS
        this.isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        
        // Best MIME types to try in order of preference
        this.mimeTypes = [
            'audio/webm',         // Best for Chrome, Firefox, etc.
            'audio/mp4',          // Better for iOS Safari
            'audio/mpeg',         // Fallback
            'audio/ogg;codecs=opus', // Another option
            '' // Empty string = browser's default
        ];
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
            if (this.isIOS) {
                // Lower bitrate for iOS (helps with compatibility)
                options.audioBitsPerSecond = 48000;
            }
            
            console.log(`Using audio format: ${mimeType || 'browser default'}`);
            this.mediaRecorder = new MediaRecorder(this.stream, options);
            
            this.mediaRecorder.addEventListener('dataavailable', event => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
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
                
                // For iOS, try to use a more compatible format if possible
                if (this.isIOS && this.audioChunks.length > 0) {
                    // If iOS recorded successfully but in a potentially problematic format,
                    // create the Blob with the most compatible MIME type
                    const firstChunkType = this.audioChunks[0].type;
                    const blobOptions = { 
                        type: firstChunkType && firstChunkType !== 'audio/webm' 
                              ? firstChunkType 
                              : 'audio/mp4' 
                    };
                    audioBlob = new Blob(this.audioChunks, blobOptions);
                    console.log(`Created iOS-compatible audio blob: ${audioBlob.type}, size: ${audioBlob.size}`);
                } else {
                    // Standard approach for other browsers
                    audioBlob = new Blob(this.audioChunks, { 
                        type: this.mediaRecorder.mimeType || 'audio/webm' 
                    });
                }
                
                this.isRecording = false;
                this.stopMediaTracks();
                resolve(audioBlob);
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
