class AudioRecorder {
    constructor() {
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.isRecording = false;
        this.stream = null;
        
        // Enhanced iOS detection with iOS 18-specific compatibility
        this.isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        this.iosVersion = this.getIOSVersion();
        this.isIOSProblem = this.isIOS && (this.iosVersion >= 17); // iOS 17+ has specific audio issues
        
        console.log(`Device detection: iOS: ${this.isIOS}, version: ${this.iosVersion || 'unknown'}, problem device: ${this.isIOSProblem}`);
        
        // Set recording interval for iOS (ms) - shorter for iOS to avoid buffer issues
        this.recordingInterval = this.isIOS ? 1000 : 3000;
        
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
            this.stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    // Specific constraints that help on iOS
                    echoCancellation: true,
                    noiseSuppression: true,
                    // Lower sample rate for better iOS compatibility
                    sampleRate: this.isIOS ? 44100 : 48000
                }
            });
            
            // Find the best supported MIME type
            let mimeType = '';
            for (const type of this.mimeTypes) {
                if (type && MediaRecorder.isTypeSupported(type)) {
                    mimeType = type;
                    console.log(`Found supported MIME type: ${mimeType}`);
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
                
                // Special handling for iOS 18
                if (this.iosVersion >= 18) {
                    options.audioBitsPerSecond = 64000;
                }
                
                // For iOS 17+, use smaller timeslice to get multiple chunks
                if (this.isIOSProblem) {
                    this.recordingInterval = 500; // Very short intervals for problematic iOS
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
            
            // For iOS 17+, request data more frequently to avoid buffer issues
            if (this.isIOSProblem) {
                console.log(`Starting MediaRecorder with timeslice ${this.recordingInterval}ms for iOS compatibility`);
                this.mediaRecorder.start(this.recordingInterval);
            } else {
                this.mediaRecorder.start();
            }
            
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
                    console.log(`Processing ${this.audioChunks.length} audio chunks for iOS`);
                    
                    // Check the type of the first chunk
                    const firstChunkType = this.audioChunks[0].type;
                    console.log(`First chunk type: "${firstChunkType}"`);
                    
                    // Determine the best MIME type to use - more iOS-specific
                    if (firstChunkType && firstChunkType !== '') {
                        audioType = firstChunkType;
                    } else if (this.iosVersion >= 18) {
                        // iOS 18 prefers mp4 over m4a
                        audioType = 'audio/mp4';
                    } else if (this.iosVersion >= 15) {
                        // For newer iOS versions
                        audioType = 'audio/m4a';
                    } else {
                        // For older iOS versions
                        audioType = 'audio/mp4';
                    }
                    
                    console.log(`Creating iOS audio blob with type: ${audioType}`);
                    
                    // Create the blob with explicit type
                    try {
                        audioBlob = new Blob(this.audioChunks, { type: audioType });
                        
                        // Check if blob is valid
                        if (audioBlob.size < 100 && this.audioChunks.length > 1) {
                            console.warn("Blob creation may have failed, trying alternative approach");
                            
                            // Try creating blobs differently for iOS
                            const combinedChunks = new Uint8Array(
                                this.audioChunks.reduce((acc, chunk) => {
                                    const reader = new FileReader();
                                    reader.readAsArrayBuffer(chunk);
                                    return [...acc, new Uint8Array(reader.result)];
                                }, [])
                            );
                            
                            audioBlob = new Blob([combinedChunks], { type: audioType });
                        }
                    } catch (e) {
                        console.error("Error creating audio blob:", e);
                        // Fallback to basic blob with any content
                        audioBlob = new Blob(this.audioChunks, { type: 'audio/mp4' });
                    }
                } else {
                    // Standard approach for other browsers
                    audioType = this.mediaRecorder.mimeType || 'audio/webm';
                    audioBlob = new Blob(this.audioChunks, { type: audioType });
                }
                
                console.log(`Created final audio blob: ${audioBlob.type}, size: ${audioBlob.size} bytes`);
                
                this.isRecording = false;
                this.stopMediaTracks();
                
                // Resolve with extended information for debugging
                resolve({
                    blob: audioBlob,
                    type: audioType,
                    isIOS: this.isIOS,
                    iosVersion: this.iosVersion,
                    chunks: this.audioChunks.length,
                    chunkSizes: this.audioChunks.map(c => c.size)
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
