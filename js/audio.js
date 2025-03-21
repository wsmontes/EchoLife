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
        
        // MODIFIED: Force Whisper on iOS by setting these to false
        this.preferBrowserTranscription = false;
        this.useIOSSpeech = false;
        
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

        // Add properties for automatic gain control
        this.audioContext = null;
        this.analyserNode = null;
        this.gainNode = null;
        this.mediaStreamSource = null;
        this.autoGainEnabled = true; // Enable by default
        this.minGain = 0.5;         // Minimum gain level
        this.maxGain = 5.0;         // Maximum gain level
        this.targetLevel = 0.75;    // Target level (0-1)
        this.gainUpdateInterval = null;
        this.lastGainAdjustment = 0;
        this.audioLevels = [];      // Store recent audio levels
        this.levelHistory = 10;     // Number of samples to keep
        
        // New properties for sensitivity modes
        this.sensitivityMode = 'auto'; // Options: 'auto', 'maximum'
        this.compressorNode = null;
        this.maxGainValue = 10.0;   // Higher maximum for maximum sensitivity mode
        this.noiseGateNode = null;
        
        // Make auto gain configurable through localStorage
        const savedAutoGain = localStorage.getItem('echolife_auto_gain');
        if (savedAutoGain !== null) {
            this.autoGainEnabled = savedAutoGain === 'true';
        }
        
        // Load sensitivity mode from localStorage
        const savedSensitivityMode = localStorage.getItem('echolife_sensitivity_mode');
        if (savedSensitivityMode === 'maximum' || savedSensitivityMode === 'auto') {
            this.sensitivityMode = savedSensitivityMode;
        }
        
        console.log(`Audio settings: auto gain=${this.autoGainEnabled}, sensitivity mode=${this.sensitivityMode}`);
        
        // Add audio level detection properties - simplified to use audioProcessor
        this.audioLevelDetected = null; // Will be set to true/false based on detected audio
        this.enableAudioLevelDetection = true; // Can be disabled if needed
        this.audioLevelThreshold = 0.01; // Minimum RMS level to consider as valid audio
        this.audioSampleBuffer = []; // Buffer to store audio levels for analysis

        // Add better volume monitoring
        this.analyserBuffer = new Uint8Array(1024);
        this.volumeCallback = null; // Callback for volume updates
        this.volumeUpdateInterval = null;
        this.volumeUpdateFrequency = 200; // ms between updates
        
        // Add low volume detection to provide feedback to users
        this.lowVolumeWarningThreshold = 0.05; // Level below which to warn user
        this.hasDetectedLowVolume = false;
        this.lowVolumeStartTime = null;
        this.lowVolumeNotified = false;
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
                        sampleRate: this.isIOS ? 44100 : 48000,
                        // Don't set autoGainControl here as we'll implement our own
                        autoGainControl: false
                    }
                });
            }
            
            // Initialize audio context and gain control if enabled
            if (this.autoGainEnabled && !this.isIOS) {
                if (this.sensitivityMode === 'maximum') {
                    this.setupMaximumSensitivity();
                } else {
                    this.setupAutoGainControl();
                }
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
            
            // Reset audio level detection
            this.audioLevelDetected = null;
            this.audioSampleBuffer = [];
            
            // Add volume monitoring
            this.setupVolumeMonitoring();
            
            // Reset volume detection
            this.hasDetectedLowVolume = false;
            this.lowVolumeStartTime = null;
            this.lowVolumeNotified = false;
            
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
        // Stop auto gain adjustment if it's running
        this.stopGainAdjustment();
        
        // Clean up audio context resources
        if (this.mediaStreamSource) {
            try {
                this.mediaStreamSource.disconnect();
            } catch (e) {
                console.error("Error disconnecting media stream source:", e);
            }
        }
        
        if (this.gainNode) {
            try {
                this.gainNode.disconnect();
            } catch (e) {
                console.error("Error disconnecting gain node:", e);
            }
        }

        // Stop volume monitoring
        clearInterval(this.volumeUpdateInterval);

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
            
            this.mediaRecorder.addEventListener('stop', async () => {
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
                
                // If we didn't detect audio during recording, perform final analysis
                if (this.audioLevelDetected === null && window.audioProcessor) {
                    try {
                        const analysis = await window.audioProcessor.analyzeAudio(audioBlob);
                        result.audioLevelDetected = analysis.hasSpeech;
                        result.audioAnalysis = analysis;
                    } catch (e) {
                        console.error("Error analyzing audio:", e);
                        result.audioLevelDetected = true; // Default to true on error
                    }
                } else {
                    // Use any detection we already made during recording
                    result.audioLevelDetected = this.audioLevelDetected !== false;
                }

                // Add volume data to result
                if (window.audioProcessor) {
                    const volumeFeedback = window.audioProcessor.getVolumeFeedback();
                    result.volumeData = volumeFeedback;
                    result.hasLowVolume = this.hasDetectedLowVolume;
                }
                
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
        // Stop gain adjustment
        this.stopGainAdjustment();
        
        // Clean up additional audio nodes
        if (this.compressorNode) {
            try {
                this.compressorNode.disconnect();
            } catch (e) {
                console.error("Error disconnecting compressor:", e);
            }
        }
        
        // Close audio context
        if (this.audioContext) {
            try {
                this.audioContext.close();
            } catch (e) {
                console.error("Error closing audio context:", e);
            }
        }

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
        // MODIFIED: Always return false to disable browser speech recognition
        return false;
    }
    
    // New method to get the appropriate transcription service
    getTranscriptionService() {
        // MODIFIED: Always use Whisper transcription service regardless of device
        return window.transcriptionService;
    }
    
    // New method to record audio with the appropriate transcription method
    async startRecordingWithTranscription(callbacks = {}) {
        // MODIFIED: Skip iOS speech recognition and always use standard recording
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

    // Add method to set up automatic gain control
    setupAutoGainControl() {
        try {
            // Create audio context if not already created
            if (!this.audioContext) {
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                this.audioContext = new AudioContext();
            }
            
            // Create nodes for analysis and gain control
            this.analyserNode = this.audioContext.createAnalyser();
            this.analyserNode.fftSize = 256;
            this.gainNode = this.audioContext.createGain();
            
            // Set initial gain to 1 (neutral)
            this.gainNode.gain.value = 1.0;
            
            // Connect the stream to the audio nodes
            this.mediaStreamSource = this.audioContext.createMediaStreamSource(this.stream);
            this.mediaStreamSource.connect(this.gainNode);
            this.gainNode.connect(this.analyserNode);
            
            // Note: We don't connect to audioContext.destination as that would create feedback
            // Instead, the MediaRecorder will use the original stream
            
            // Create a buffer for the analysis
            this.analyserBuffer = new Uint8Array(this.analyserNode.frequencyBinCount);
            
            // Start the gain adjustment loop
            this.startGainAdjustment();
            
            console.log("Auto gain control initialized");
        } catch (e) {
            console.error("Error setting up auto gain control:", e);
            // Continue without auto gain if it fails
            this.autoGainEnabled = false;
        }
    }
    
    // Add method to set up maximum sensitivity
    setupMaximumSensitivity() {
        try {
            // Create audio context if not already created
            if (!this.audioContext) {
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                this.audioContext = new AudioContext();
            }
            
            // Create a more sophisticated audio processing chain
            this.analyserNode = this.audioContext.createAnalyser();
            this.analyserNode.fftSize = 512; // Larger FFT for better frequency analysis
            
            // Create high-gain amplifier
            this.gainNode = this.audioContext.createGain();
            this.gainNode.gain.value = 5.0; // Start with a very high gain
            
            // Add a compressor to prevent clipping
            this.compressorNode = this.audioContext.createDynamicsCompressor();
            this.compressorNode.threshold.value = -24; // Lower threshold to compress earlier
            this.compressorNode.knee.value = 30;      // Softer knee for more natural sound
            this.compressorNode.ratio.value = 12;     // Higher ratio for stronger compression
            this.compressorNode.attack.value = 0.003; // Fast attack
            this.compressorNode.release.value = 0.25; // Moderate release
            
            // Connect the audio processing chain:
            // source -> gain -> compressor -> analyser
            this.mediaStreamSource = this.audioContext.createMediaStreamSource(this.stream);
            this.mediaStreamSource.connect(this.gainNode);
            this.gainNode.connect(this.compressorNode);
            this.compressorNode.connect(this.analyserNode);
            
            // Create a buffer for the analysis
            this.analyserBuffer = new Uint8Array(this.analyserNode.frequencyBinCount);
            
            // Start the gain adjustment loop
            this.startGainAdjustment();
            
            console.log("Maximum sensitivity mode initialized with gain:", this.gainNode.gain.value);
        } catch (e) {
            console.error("Error setting up maximum sensitivity:", e);
            // Fall back to auto gain if maximum fails
            this.sensitivityMode = 'auto';
            this.setupAutoGainControl();
        }
    }
    
    // Start periodic gain adjustment
    startGainAdjustment() {
        // Clear any existing interval
        if (this.gainUpdateInterval) {
            clearInterval(this.gainUpdateInterval);
        }
        
        // Update gain every 500ms
        this.gainUpdateInterval = setInterval(() => {
            this.adjustGain();
        }, 500);
    }
    
    // Stop gain adjustment
    stopGainAdjustment() {
        if (this.gainUpdateInterval) {
            clearInterval(this.gainUpdateInterval);
            this.gainUpdateInterval = null;
        }
    }
    
    // Modified adjustGain method to handle different sensitivity modes
    adjustGain() {
        if (!this.analyserNode || !this.gainNode) return;
        
        try {
            // Get current audio level
            this.analyserNode.getByteTimeDomainData(this.analyserBuffer);
            
            // Calculate RMS audio level
            let sum = 0;
            for (let i = 0; i < this.analyserBuffer.length; i++) {
                const amplitude = (this.analyserBuffer[i] - 128) / 128;
                sum += amplitude * amplitude;
            }
            const rms = Math.sqrt(sum / this.analyserBuffer.length);
            
            // Add to level history
            this.audioLevels.push(rms);
            
            if (this.audioLevels.length > this.levelHistory) {
                this.audioLevels.shift();
            }
            
            // Get average level
            const avgLevel = this.audioLevels.reduce((a, b) => a + b, 0) / this.audioLevels.length;
            
            // Only adjust if we have enough samples and not too frequently
            const now = Date.now();
            if (this.audioLevels.length >= 3 && now - this.lastGainAdjustment > 300) {
                // Calculate gain adjustment based on sensitivity mode
                let newGain = this.gainNode.gain.value;
                
                if (this.sensitivityMode === 'maximum') {
                    // Maximum sensitivity mode: aggressive adjustment
                    if (avgLevel < 0.01) {
                        // Very low level, boost gain significantly
                        newGain = Math.min(newGain * 1.5, this.maxGainValue);
                    } else if (avgLevel < this.targetLevel * 0.7) {
                        // Low level, boost gain aggressively
                        newGain = Math.min(newGain * 1.2, this.maxGainValue);
                    } else if (avgLevel > this.targetLevel * 1.1) {
                        // Only reduce if it's significantly above target
                        newGain = Math.max(newGain * 0.95, this.minGain);
                    }
                } else {
                    // Normal auto mode: original algorithm
                    if (avgLevel > 0.01) {  // Ignore very low levels (silence)
                        if (avgLevel < this.targetLevel * 0.8) {
                            // Increase gain if too quiet (but gradually)
                            newGain = Math.min(newGain * 1.1, this.maxGain);
                        } else if (avgLevel > this.targetLevel * 1.2) {
                            // Decrease gain if too loud (more quickly to prevent clipping)
                            newGain = Math.max(newGain * 0.9, this.minGain);
                        }
                    }
                }
                
                // Apply the new gain value (with smoother ramp for maximum mode)
                const smoothingTime = this.sensitivityMode === 'maximum' ? 0.2 : 0.3;
                this.gainNode.gain.setTargetAtTime(newGain, this.audioContext.currentTime, smoothingTime);
                this.lastGainAdjustment = now;
                
                console.log(`Audio level: ${avgLevel.toFixed(3)}, Adjusted gain: ${newGain.toFixed(2)}, Mode: ${this.sensitivityMode}`);
            }
            
            // Track audio levels for detection if enabled
            if (this.enableAudioLevelDetection) {
                // Get current level from analyser
                this.analyserNode.getByteFrequencyData(this.analyserBuffer);
                
                // Calculate average level
                let sum = 0;
                for (let i = 0; i < this.analyserBuffer.length; i++) {
                    sum += this.analyserBuffer[i];
                }
                const currentLevel = sum / (this.analyserBuffer.length * 255); // Normalize to 0-1
                
                // Set detection flag if level exceeds threshold
                if (currentLevel > 0.01) { // Low threshold to detect any sound
                    this.audioLevelDetected = true;
                }
            }
        } catch (e) {
            console.error("Error in gain adjustment:", e);
            this.stopGainAdjustment();
        }
    }
    
    // Add method to switch sensitivity modes
    setSensitivityMode(mode) {
        if (mode !== 'auto' && mode !== 'maximum') {
            console.error(`Invalid sensitivity mode: ${mode}`);
            return false;
        }
        
        this.sensitivityMode = mode;
        localStorage.setItem('echolife_sensitivity_mode', mode);
        
        // If recording, update the audio processing chain
        if (this.isRecording && this.autoGainEnabled) {
            // Clean up existing nodes
            this.stopGainAdjustment();
            
            // Disconnect existing audio nodes
            if (this.mediaStreamSource) {
                try {
                    this.mediaStreamSource.disconnect();
                } catch (e) {
                    console.error("Error disconnecting media stream source:", e);
                }
            }
            
            if (this.gainNode) {
                try {
                    this.gainNode.disconnect();
                } catch (e) {
                    console.error("Error disconnecting gain node:", e);
                }
            }
            
            if (this.compressorNode) {
                try {
                    this.compressorNode.disconnect();
                } catch (e) {
                    console.error("Error disconnecting compressor node:", e);
                }
            }
            
            // Set up the appropriate mode
            if (mode === 'maximum') {
                this.setupMaximumSensitivity();
            } else {
                this.setupAutoGainControl();
            }
        }
        
        console.log(`Microphone sensitivity mode set to: ${mode}`);
        return true;
    }
    
    // Modified toggleAutoGain to work with sensitivity modes
    toggleAutoGain(enabled) {
        this.autoGainEnabled = enabled;
        localStorage.setItem('echolife_auto_gain', enabled);
        
        if (enabled && this.isRecording && !this.isIOS) {
            // Set up and start with appropriate sensitivity mode
            if (this.sensitivityMode === 'maximum') {
                this.setupMaximumSensitivity();
            } else {
                this.setupAutoGainControl();
            }
        } else if (!enabled) {
            // Stop adjustment and reset gain to normal
            this.stopGainAdjustment();
            if (this.gainNode) {
                this.gainNode.gain.value = 1.0;
            }
        }
        
        return this.autoGainEnabled;
    }

    // Setup volume monitoring
    setupVolumeMonitoring() {
        if (!this.analyserNode) return;
        
        clearInterval(this.volumeUpdateInterval);
        
        // Start regular volume updates
        this.volumeUpdateInterval = setInterval(() => {
            this.checkVolumeLevel();
        }, this.volumeUpdateFrequency);
    }
    
    // Check and report volume level
    checkVolumeLevel() {
        if (!this.analyserNode || !this.isRecording) return;
        
        try {
            // Get current level from analyser
            this.analyserNode.getByteFrequencyData(this.analyserBuffer);
            
            // Calculate average level
            let sum = 0;
            for (let i = 0; i < this.analyserBuffer.length; i++) {
                sum += this.analyserBuffer[i];
            }
            const currentLevel = sum / (this.analyserBuffer.length * 255); // Normalize to 0-1
            
            // Add to audio processor's history for later use in transcription
            if (window.audioProcessor) {
                window.audioProcessor.addVolumeReading(currentLevel);
            }
            
            // Call volume callback if set
            if (this.volumeCallback && typeof this.volumeCallback === 'function') {
                this.volumeCallback(currentLevel);
            }
            
            // Check for consistently low volume 
            if (currentLevel < this.lowVolumeWarningThreshold) {
                if (!this.lowVolumeStartTime) {
                    this.lowVolumeStartTime = Date.now();
                } else if (!this.lowVolumeNotified && Date.now() - this.lowVolumeStartTime > 2000) {
                    // If we've had low volume for 2+ seconds, notify
                    this.hasDetectedLowVolume = true;
                    this.lowVolumeNotified = true;
                    
                    // Dispatch an event so UI can show a warning
                    const event = new CustomEvent('lowVolumeDetected', {
                        detail: { level: currentLevel }
                    });
                    window.dispatchEvent(event);
                }
            } else {
                // Reset low volume tracking
                this.lowVolumeStartTime = null;
            }
        } catch (e) {
            console.error('Error monitoring volume:', e);
        }
    }

    // New method to register a volume level callback
    onVolumeUpdate(callback) {
        this.volumeCallback = callback;
    }
}

// Create a global instance of the audio recorder
const audioRecorder = new AudioRecorder();

// Add cleanup on page unload
window.addEventListener('beforeunload', () => {
    audioRecorder.cleanup();
});
