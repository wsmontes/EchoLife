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
        
        // Flag to indicate if browser transcription might be more reliable than Whisper
        this.preferBrowserTranscription = this.isIOS && (this.iosVersion >= 16);
        
        console.log(`Device detection: iOS: ${this.isIOS}, version: ${this.iosVersion || 'unknown'}, problem device: ${this.isIOSProblem}, prefer browser transcription: ${this.preferBrowserTranscription}`);
        
        // Set recording interval for iOS (ms) - shorter for iOS to avoid buffer issues
        this.recordingInterval = this.isIOS ? 1000 : 3000;
        
        // Best MIME types to try in order of preference - updated for Apple compatibility
        this.mimeTypes = [
            'audio/mp4;codecs=mp4a.40.2', // AAC-LC codec, best for Apple
            'audio/aac',                  // Another Apple-compatible option
            'audio/webm',                 // Best for Chrome, Firefox, etc.
            'audio/mpeg',                 // Fallback
            'audio/ogg;codecs=opus',      // Will work on most browsers except Safari
            '' // Empty string = browser's default
        ];

        // If on iOS, prioritize formats that work better there
        if (this.isIOS) {
            this.mimeTypes = [
                'audio/mp4;codecs=mp4a.40.2', // Explicit AAC-LC codec, Apple standard
                'audio/mp4',                  // MP4 container, generally uses AAC on Apple
                'audio/aac',                  // AAC audio
                'audio/m4a',                  // Apple format
                'audio/mpeg',                 // MP3 format, widely supported
                ''                            // Browser default
            ];
        }
        
        // Enhanced debug logging for iOS devices
        if (this.isIOS) {
            console.log(`iOS ${this.iosVersion} detected - applying optimized audio recording settings`);
        }
        
        // Additional MIME types to try for iOS WebKit - more comprehensive list
        if (this.isIOS) {
            this.mimeTypes = [
                'audio/mp4;codecs=mp4a.40.2', // Explicit AAC-LC codec, best for Apple
                'audio/mp4',                  // MP4 container, generally uses AAC on Apple
                'audio/aac',                  // AAC audio
                'audio/m4a',                  // Apple format
                'audio/mpeg',                 // MP3 format, widely supported
                'audio/x-m4a',                // Alternate M4A MIME type
                'audio/wav',                  // Uncompressed but widely supported
                ''                            // Browser default
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
            
            // More specific options for Apple compatibility
            if (this.isIOS) {
                // Set preferred audio settings for Apple compatibility
                options.audioBitsPerSecond = 128000; // 128 kbps for AAC
                options.audioSampleRate = 44100;     // 44.1 kHz - Apple standard
                
                // Special handling for iOS versions
                if (this.iosVersion >= 15) {
                    console.log("Using optimized settings for iOS 15+");
                }
                
                // Lower bitrate for iOS (helps with compatibility)
                options.audioBitsPerSecond = 48000;
                
                // Special handling for iOS 18
                if (this.iosVersion >= 18) {
                    options.audioBitsPerSecond = 64000;
                }
                
                // For iOS 17+, use smaller timeslice to get multiple chunks
                if (this.isIOSProblem) {
                    this.recordingInterval = 500; // Very short intervals for problematic iOS
                    console.log(`Using reduced recording interval (${this.recordingInterval}ms) for iOS 17+`);
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
                
                // For iOS, we need special handling to ensure proper format and encoding
                if (this.isIOS && this.audioChunks.length > 0) {
                    console.log(`Processing ${this.audioChunks.length} audio chunks for iOS`);
                    
                    // Check the type of the first chunk
                    const firstChunkType = this.audioChunks[0].type;
                    console.log(`First chunk type: "${firstChunkType}"`);
                    
                    // Determine the best MIME type to use - more iOS-specific and optimized for Whisper
                    if (firstChunkType && firstChunkType !== '') {
                        // Use the browser's chosen type, since it's likely compatible with the hardware
                        audioType = firstChunkType;
                        console.log(`Using browser's native MIME type: ${audioType}`);
                    } else if (this.iosVersion >= 18) {
                        // iOS 18 prefers mp4 over m4a
                        audioType = 'audio/mp4';
                    } else if (this.iosVersion >= 15) {
                        // For newer iOS versions - explicit AAC codec
                        audioType = 'audio/mp4;codecs=mp4a.40.2';
                    } else {
                        // For older iOS versions
                        audioType = 'audio/mp4';
                    }
                    
                    console.log(`Creating iOS audio blob with type: ${audioType}`);
                    
                    // Two different approaches for iOS blob creation:
                    
                    // 1. Standard approach - often works in newer iOS
                    try {
                        audioBlob = new Blob(this.audioChunks, { type: audioType });
                        console.log(`Standard blob creation: ${audioBlob.size} bytes`);
                        
                        // Verify blob size is reasonable - if not, we'll try alternate method
                        if (audioBlob.size < 1000 && this.audioChunks.length > 1) {
                            console.warn("Blob is suspiciously small, trying alternative approach");
                            throw new Error("Small blob, forcing alternate method");
                        }
                    } catch (e) {
                        console.warn("Standard blob creation failed, trying alternative approach:", e);
                        
                        // 2. Alternative approach for older iOS or when standard fails
                        try {
                            // First try to convert the chunks to ArrayBuffers
                            const bufferPromises = this.audioChunks.map(chunk => 
                                new Promise(resolve => {
                                    const reader = new FileReader();
                                    reader.onloadend = () => resolve(reader.result);
                                    reader.readAsArrayBuffer(chunk);
                                })
                            );
                            
                            // Wait for all buffer conversions
                            Promise.all(bufferPromises).then(buffers => {
                                // Concatenate all buffers
                                const totalLength = buffers.reduce((sum, buffer) => sum + buffer.byteLength, 0);
                                const combined = new Uint8Array(totalLength);
                                
                                let offset = 0;
                                buffers.forEach(buffer => {
                                    combined.set(new Uint8Array(buffer), offset);
                                    offset += buffer.byteLength;
                                });
                                
                                // Create blob with the combined data - explicitly set for Whisper compatibility
                                audioBlob = new Blob([combined], { type: 'audio/mp4' });
                                
                                // Use a filename that clearly indicates this is iOS audio
                                const filename = `ios${this.iosVersion}_recording.m4a`;
                                
                                // Resolve with metadata for better diagnostics
                                resolve({
                                    blob: audioBlob,
                                    type: 'audio/mp4',
                                    isIOS: true,
                                    iosVersion: this.iosVersion,
                                    chunks: this.audioChunks.length,
                                    chunkSizes: this.audioChunks.map(c => c.size),
                                    filename: filename,
                                    alternateMethod: true,
                                    codecInfo: this.mediaRecorder.mimeType || 'unknown'
                                });
                            }).catch(error => {
                                console.error("Alternative blob creation failed:", error);
                                // Fall back to the first chunk if everything else failed
                                audioBlob = this.audioChunks[0];
                                audioType = audioBlob.type || 'audio/mp4';
                                resolve(this.createFinalResult(audioBlob, audioType));
                            });
                            
                            // Return early since we're handling async resolution
                            return;
                        } catch (e2) {
                            console.error("Both blob creation methods failed:", e2);
                            // Last resort - just use the first chunk
                            audioBlob = this.audioChunks[0];
                            audioType = audioBlob.type || 'audio/mp4'; 
                        }
                    }
                } else {
                    // Standard approach for other browsers
                    audioType = this.mediaRecorder.mimeType || 'audio/webm';
                    audioBlob = new Blob(this.audioChunks, { type: audioType });
                }
                
                console.log(`Created final audio blob: ${audioBlob.type}, size: ${audioBlob.size} bytes`);
                
                this.isRecording = false;
                this.stopMediaTracks();
                
                // Create the result object with enhanced diagnostics
                const result = this.createFinalResult(audioBlob, audioType);
                resolve(result);
            });
            
            try {
                this.mediaRecorder.stop();
            } catch (e) {
                console.error("Error stopping MediaRecorder:", e);
                resolve(null);
            }
        });
    }
    
    // New method to create a standardized result object
    createFinalResult(blob, type) {
        // Determine if this is likely a format that works well with Whisper API
        const isLikelyWhisperCompatible = 
            type.includes('mp3') || 
            type.includes('mp4') || 
            type.includes('m4a') || 
            type.includes('wav') ||
            type.includes('webm') || 
            type.includes('ogg');
        
        // For iOS, we need to provide more guidance to the transcription service
        const preferredFormatForWhisper = this.isIOS ? 'audio/mp4' : type;
        
        // Generate a useful debug-friendly filename
        const timestamp = Date.now();
        const ext = this.isIOS ? 'm4a' : 
                  (type.includes('webm') ? 'webm' : 
                  (type.includes('mp3') ? 'mp3' : 
                  (type.includes('mp4') || type.includes('m4a') ? 'm4a' : 'audio')));
        
        const filename = `recording_${this.isIOS ? 'ios' + this.iosVersion + '_' : ''}${timestamp}.${ext}`;
        
        return {
            blob: blob,
            type: type,
            isIOS: this.isIOS,
            iosVersion: this.iosVersion,
            chunks: this.audioChunks.length,
            chunkSizes: this.audioChunks.map(c => c.size),
            codecInfo: this.mediaRecorder.mimeType || 'unknown',
            filename: filename,
            preferredFormatForWhisper: preferredFormatForWhisper,
            likelyCompatible: isLikelyWhisperCompatible
        };
    }
    
    // New method to check if browser transcription should be preferred
    shouldPreferBrowserTranscription() {
        // For iOS devices with known audio format problems with Whisper,
        // return true to encourage using browser SpeechRecognition
        return this.preferBrowserTranscription;
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
