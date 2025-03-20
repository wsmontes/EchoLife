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
        
        // Flag to indicate whether we should use iOS native speech recognition
        this.useIOSSpeech = this.isIOS && window.iosSpeechService && window.iosSpeechService.isAvailable;
        
        console.log(`Device detection: iOS: ${this.isIOS}, version: ${this.iosVersion || 'unknown'}, problem device: ${this.isIOSProblem}, prefer browser transcription: ${this.preferBrowserTranscription}, use iOS speech: ${this.useIOSSpeech}`);
        
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
        
        // Add properties for continuous recording
        this.continuousRecorder = null;
        this.continuousChunks = [];
        this.isContinuousRecording = false;
        this.continuousStream = null;
        this.recordingStartTime = null;
        this.recordingStopTime = null;
    }

    // Get iOS version number if available; fallback to 0 to avoid null issues.
    getIOSVersion() {
        if (this.isIOS) {
            const match = navigator.userAgent.match(/OS (\d+)_(\d+)_?(\d+)?/);
            return match ? parseInt(match[1], 10) : 0;
        }
        return 0;
    }

    async startRecording() {
        try {
            this.audioChunks = [];
            
            // Get audio stream if we don't already have one
            if (!this.stream) {
                this.stream = await navigator.mediaDevices.getUserMedia({ 
                    audio: {
                        // Specific constraints that help on iOS
                        echoCancellation: true,
                        noiseSuppression: true,
                        // Use appropriate sample rate based on device
                        sampleRate: this.isIOS ? 44100 : 48000
                    }
                });
            }
            
            // Start continuous recording if not already running
            this.ensureContinuousRecording();
            
            // Find the best supported MIME type - simplified approach
            let mimeType = '';
            const browserBasedMimeType = navigator.userAgent.includes('Firefox') ? 
                'audio/ogg' : 'audio/webm';
            
            // For non-iOS devices, use a simplified reliable approach
            if (!this.isIOS) {
                if (MediaRecorder.isTypeSupported(browserBasedMimeType)) {
                    mimeType = browserBasedMimeType;
                    console.log(`Using standard ${mimeType} for this browser`);
                } else if (MediaRecorder.isTypeSupported('audio/mp3')) {
                    mimeType = 'audio/mp3';
                }
            } else {
                // Existing iOS-specific code with MIME type detection
                for (const type of this.mimeTypes) {
                    if (type && MediaRecorder.isTypeSupported(type)) {
                        mimeType = type;
                        console.log(`Found supported MIME type for iOS: ${mimeType}`);
                        break;
                    }
                }
            }
            
            // Create recorder options
            const options = {};
            if (mimeType) {
                options.mimeType = mimeType;
            }
            
            // Additional browser-specific settings
            if (!this.isIOS) {
                options.audioBitsPerSecond = 128000; // 128kbps for good quality
            } else {
                // iOS-specific options
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
            
            console.log("Creating MediaRecorder with options:", options);
            this.mediaRecorder = new MediaRecorder(this.stream, options);
            
            // Save selected MIME type for reference
            this.selectedMimeType = options.mimeType || 'browser default';
            
            // Track recording start time for continuous recording
            this.recordingStartTime = Date.now();
            
            // Improved dataavailable handler with better error reporting
            this.mediaRecorder.addEventListener('dataavailable', event => {
                console.log(`Received audio chunk: size=${event.data.size} bytes, type=${event.data.type || 'unknown'}`);
                
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                } else {
                    console.warn("Received empty audio chunk");
                }
            });
            
            // Record using fixed intervals for consistent chunks
            const timeslice = 1000; // 1 second chunks work well on most browsers
            console.log(`Starting MediaRecorder with ${timeslice}ms timeslice`);
            this.mediaRecorder.start(timeslice);
            
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
    
    // New method to ensure continuous recording is running
    ensureContinuousRecording() {
        // Skip for iOS devices - they have their own optimizations
        if (this.isIOS) return;
        
        if (!this.isContinuousRecording && this.stream) {
            try {
                console.log("Starting continuous background recording");
                
                // Create a recorder with the most reliable format for the browser
                const options = {};
                const browserBasedMimeType = navigator.userAgent.includes('Firefox') ? 
                    'audio/ogg' : 'audio/webm';
                
                if (MediaRecorder.isTypeSupported(browserBasedMimeType)) {
                    options.mimeType = browserBasedMimeType;
                }
                
                this.continuousRecorder = new MediaRecorder(this.stream, options);
                this.continuousChunks = [];
                
                this.continuousRecorder.addEventListener('dataavailable', event => {
                    if (event.data.size > 0) {
                        this.continuousChunks.push({
                            data: event.data,
                            timestamp: Date.now()
                        });
                        
                        // Keep only the last 60 seconds of audio in memory
                        const maxAgeMs = 60000; // 60 seconds
                        const cutoffTime = Date.now() - maxAgeMs;
                        
                        // Remove chunks older than cutoff time
                        while (this.continuousChunks.length > 0 && 
                               this.continuousChunks[0].timestamp < cutoffTime) {
                            this.continuousChunks.shift();
                        }
                    }
                });
                
                // Use a shorter interval for continuous recording
                this.continuousRecorder.start(500);
                this.isContinuousRecording = true;
            } catch (e) {
                console.error("Failed to start continuous recording:", e);
                // Continue without continuous recording
            }
        }
    }
    
    // Stop continuous recording
    stopContinuousRecording() {
        if (this.isContinuousRecording && this.continuousRecorder) {
            try {
                this.continuousRecorder.stop();
                this.isContinuousRecording = false;
                console.log("Stopped continuous background recording");
            } catch (e) {
                console.error("Error stopping continuous recorder:", e);
            }
        }
    }

    stopRecording() {
        return new Promise((resolve) => {
            if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
                resolve(null);
                return;
            }
            
            // Track recording stop time for continuous recording
            this.recordingStopTime = Date.now();
            
            // Add a timeout to ensure we don't wait forever
            const timeout = setTimeout(() => {
                console.error("MediaRecorder stop timeout - forcing resolution");
                
                // Try to get audio from continuous recording on timeout
                const continuousAudio = this.extractContinuousAudio();
                if (continuousAudio) {
                    console.log("Using continuous recording as fallback on timeout");
                    resolve(continuousAudio);
                    return;
                }
                
                // Otherwise fall back to regular chunks if available
                if (this.audioChunks.length > 0) {
                    // Try to create a blob from what we have
                    try {
                        const audioType = this.selectedMimeType || 'audio/webm';
                        const audioBlob = new Blob(this.audioChunks, { type: audioType });
                        resolve(this.createFinalResult(audioBlob, audioType));
                    } catch (e) {
                        console.error("Error creating fallback blob:", e);
                        resolve(null);
                    }
                } else {
                    resolve(null);
                }
            }, 5000);
            
            this.mediaRecorder.addEventListener('stop', () => {
                clearTimeout(timeout);
                
                // Log the chunks we've collected
                console.log(`Processing ${this.audioChunks.length} audio chunks, total bytes: ${
                    this.audioChunks.reduce((sum, chunk) => sum + chunk.size, 0)}`);
                
                let audioBlob;
                let audioType;
                
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
                    // Try to use continuous recording first for non-iOS
                    const continuousAudio = this.extractContinuousAudio();
                    if (continuousAudio && continuousAudio.blob.size > 1000) {
                        console.log("Using audio from continuous recording");
                        audioBlob = continuousAudio.blob;
                        audioType = continuousAudio.type;
                    } else {
                        // Fall back to standard processing if continuous recording failed
                        console.log("Falling back to standard audio processing");
                        
                        // Simplified non-iOS handling - focus on reliability
                        try {
                            // Use the MIME type we selected when starting recording
                            audioType = this.selectedMimeType || 'audio/webm';
                            console.log(`Creating blob with type: ${audioType}`);
                            
                            // Create blob with explicit type
                            audioBlob = new Blob(this.audioChunks, { type: audioType });
                            
                            // Verify we have a valid blob
                            console.log(`Created audio blob: type=${audioType}, size=${audioBlob.size} bytes`);
                            
                            if (audioBlob.size < 100 && this.audioChunks.length > 0) {
                                // Try with first chunk as fallback
                                console.warn("Blob suspiciously small, using first chunk directly");
                                audioBlob = this.audioChunks[0];
                                audioType = audioBlob.type || audioType;
                            }
                        } catch (error) {
                            console.error("Error creating audio blob:", error);
                            
                            // Last resort: use the first chunk if it exists and has size
                            if (this.audioChunks.length > 0 && this.audioChunks[0].size > 0) {
                                audioBlob = this.audioChunks[0];
                                audioType = audioBlob.type || 'audio/webm';
                                console.log(`Using first chunk as fallback: ${audioBlob.size} bytes`);
                            } else {
                                console.error("No valid audio chunks available");
                                audioBlob = new Blob([], { type: 'audio/webm' });
                                audioType = 'audio/webm';
                            }
                        }
                    }
                }
                
                this.isRecording = false;
                this.stopMediaTracks();
                
                console.log(`Final audio: type=${audioType}, size=${audioBlob.size} bytes`);
                const result = this.createFinalResult(audioBlob, audioType);
                
                resolve(result);
            });
            
            try {
                this.mediaRecorder.stop();
            } catch (e) {
                clearTimeout(timeout);
                console.error("Error stopping MediaRecorder:", e);
                
                // Try to get audio from continuous recording on error
                const continuousAudio = this.extractContinuousAudio();
                if (continuousAudio) {
                    console.log("Using continuous recording as fallback on error");
                    resolve(continuousAudio);
                    return;
                }
                
                resolve(null);
            }
        });
    }
    
    // Extract audio from continuous recording based on start/stop times
    extractContinuousAudio() {
        // Skip if we're on iOS (uses its own optimization) or continuous recording isn't available
        if (this.isIOS || !this.isContinuousRecording || this.continuousChunks.length === 0) {
            return null;
        }
        
        try {
            console.log(`Extracting audio from continuous recording (${this.continuousChunks.length} chunks)`);
            
            // Filter chunks that fall within our recording window
            const relevantChunks = this.continuousChunks
                .filter(chunk => chunk.timestamp >= this.recordingStartTime && 
                                 chunk.timestamp <= this.recordingStopTime)
                .map(chunk => chunk.data);
            
            console.log(`Found ${relevantChunks.length} chunks within recording window`);
            
            if (relevantChunks.length === 0) {
                return null;
            }
            
            // Create a blob from the relevant chunks
            const audioType = relevantChunks[0].type || 'audio/webm';
            const audioBlob = new Blob(relevantChunks, { type: audioType });
            
            if (audioBlob.size < 100) {
                console.warn("Extracted continuous audio is too small");
                return null;
            }
            
            return this.createFinalResult(audioBlob, audioType);
        } catch (e) {
            console.error("Error extracting continuous audio:", e);
            return null;
        }
    }
    
    stopMediaTracks() {
        // Stop continuous recording
        this.stopContinuousRecording();
        
        // Only stop media tracks if we're fully done with recording
        if (this.stream && !this.isContinuousRecording) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
    }
    
    // Stop all recordings and clean up resources
    cleanup() {
        this.stopContinuousRecording();
        
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            try {
                this.mediaRecorder.stop();
            } catch (e) {
                console.error("Error stopping main recorder during cleanup:", e);
            }
        }
        
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        
        this.isRecording = false;
        this.isContinuousRecording = false;
    }

    // Modified to be more compatible with iOS
    createFinalResult(blob, type) {
        // Don't modify the type for real-time processing, only for final transcription
        let finalType = type;
        
        // For iOS Whisper API compatibility, we recommend audio/mp4 format
        if (this.isIOS) {
            console.log(`iOS audio format for transcription: original=${type}, recommended=audio/mp4`);
            // Only force the type change for the returned object, not the actual blob
            // This preserves the original format for real-time processing
            finalType = 'audio/mp4';
        }

        const isLikelyWhisperCompatible = 
            finalType.includes('mp3') || 
            finalType.includes('mp4') || 
            finalType.includes('m4a') || 
            finalType.includes('wav') ||
            finalType.includes('webm') || 
            finalType.includes('ogg');
        
        // Generate a debug-friendly filename
        const timestamp = Date.now();
        const ext = this.isIOS ? 'm4a' : 
                  (finalType.includes('webm') ? 'webm' : 
                  (finalType.includes('mp3') ? 'mp3' : 
                  (finalType.includes('mp4') || finalType.includes('m4a') ? 'm4a' : 'audio')));
        
        const filename = `recording_${this.isIOS ? 'ios' + this.iosVersion + '_' : ''}${timestamp}.${ext}`;
        
        // For iOS, if not already compatible, mark for conversion
        if (this.isIOS) {
            const isWhisperCompatible = 
                finalType.includes('mp3') || 
                finalType.includes('mp4') || 
                (finalType.includes('m4a') && !finalType.includes('webm'));
            
            if (!isWhisperCompatible) {
                console.log("iOS audio format may not be compatible with Whisper, marking for conversion");
                return {
                    blob: blob,
                    type: type, // Keep original type to preserve compatibility
                    isIOS: this.isIOS,
                    iosVersion: this.iosVersion,
                    chunks: this.audioChunks.length,
                    chunkSizes: this.audioChunks.map(c => c.size),
                    codecInfo: this.mediaRecorder?.mimeType || 'unknown',
                    filename: `ios${this.iosVersion}_recording_${timestamp}.m4a`, 
                    preferredFormatForWhisper: 'audio/mp4',
                    needsConversion: true,
                    likelyCompatible: false
                };
            }
        }
        
        return {
            blob: blob,
            type: type, // Keep original type for compatibility with existing code
            isIOS: this.isIOS,
            iosVersion: this.iosVersion,
            chunks: this.audioChunks.length,
            chunkSizes: this.audioChunks.map(c => c.size),
            codecInfo: this.mediaRecorder.mimeType || 'unknown',
            filename: filename,
            preferredFormatForWhisper: this.isIOS ? 'audio/mp4' : type,
            likelyCompatible: isLikelyWhisperCompatible,
            // Add original properties to ensure backward compatibility
            originalType: type
        };
    }
    
    // New method to check if browser transcription should be preferred
    shouldPreferBrowserTranscription() {
        // Only return true for iOS devices with iOS speech service available
        return this.isIOS && this.useIOSSpeech && window.iosSpeechService && window.iosSpeechService.isAvailable;
    }
    
    // New method to get the appropriate transcription service
    getTranscriptionService() {
        if (this.isIOS && this.useIOSSpeech && window.iosSpeechService && window.iosSpeechService.isAvailable) {
            return window.iosSpeechService;
        }
        return window.transcriptionService;
    }
    
    // New method to record audio with the appropriate transcription method
    async startRecordingWithTranscription(callbacks = {}) {
        // For iOS devices, prioritize using the iOS speech recognition service
        if (this.isIOS) {
            // Always try to use iOS native speech recognition first on iOS devices
            if (window.iosSpeechService && window.iosSpeechService.isAvailable) {
                // Start audio recording first
                const success = await this.startRecording();
                if (success) {
                    console.log("iOS recording started successfully, setting up speech recognition");
                    
                    // Set up callbacks for iOS speech service
                    if (callbacks.onTranscriptUpdate) {
                        window.iosSpeechService.setTranscriptUpdateCallback(callbacks.onTranscriptUpdate);
                    }
                    if (callbacks.onFinalTranscript) {
                        window.iosSpeechService.setFinalTranscriptCallback(callbacks.onFinalTranscript);
                    }
                    if (callbacks.onError) {
                        window.iosSpeechService.setErrorCallback(callbacks.onError);
                    }
                    
                    // Start iOS speech recognition and handle potential failures
                    const speechStarted = window.iosSpeechService.startListening();
                    this.useIOSSpeech = speechStarted;
                    
                    if (!speechStarted) {
                        console.warn("iOS speech recognition failed to start, falling back to standard recording");
                    } else {
                        console.log("iOS speech recognition started successfully");
                    }
                    
                    return true;
                }
                return success;
            } else {
                console.log("iOS device detected but native speech recognition unavailable");
                this.useIOSSpeech = false;
            }
        }
        
        // For non-iOS devices or if iOS speech failed, use regular recording
        return this.startRecording();
    }

    async stopRecordingWithTranscription() {
        // For iOS devices, stop the iOS speech recognition service if available
        let iosTranscript = null;
        let useIOSSpeech = false;
        
        if (this.isIOS && this.useIOSSpeech && window.iosSpeechService && window.iosSpeechService.isAvailable) {
            // Get transcript from iOS speech service
            iosTranscript = window.iosSpeechService.stopListening();
            useIOSSpeech = true;
            console.log("iOS Speech transcript:", iosTranscript);
        }
        
        // Stop the audio recording (works for all devices)
        const audioResult = await this.stopRecording();
        
        // Return both the audio result and the iOS transcript
        return {
            audio: audioResult,
            iosTranscript: iosTranscript,
            useIOSSpeech: useIOSSpeech
        };
    }
}

// Create a global instance of the audio recorder
const audioRecorder = new AudioRecorder();

// Add cleanup on page unload
window.addEventListener('beforeunload', () => {
    audioRecorder.cleanup();
});
