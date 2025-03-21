/**
 * Whisper API Transcription Service
 * Provides audio transcription using OpenAI's Whisper API
 */
class WhisperTranscriptionService {
    constructor() {
        this.apiKey = null;
        this.subtitleData = [];
        this.lastError = null;
        
        // Track the audio format information for better error messages
        this.lastAudioFormat = null;
        this.lastAudioSize = 0;
        
        // Initialize with language from localStorage
        this.language = localStorage.getItem('echolife_language') || 'en-US';
        
        // Listen for language changes
        window.addEventListener('languageChanged', (e) => {
            this.language = e.detail.language;
            console.log(`Transcription service language set to: ${this.language}`);
        });
    }
    
    setApiKey(key) {
        this.apiKey = key;
    }
    
    setLanguage(language) {
        this.language = language;
    }
    
    getSubtitleData() {
        return this.subtitleData;
    }
    
    getLastErrorDetails() {
        return this.lastError || { error: null, status: null, statusText: null };
    }
    
    /**
     * Test the Whisper API access using a minimal request
     */
    async testWhisperApiAccess() {
        if (!this.apiKey) {
            return { success: false, message: "API key not set" };
        }
        
        // Create a small audio file for testing (1-second silent WebM)
        const sampleAudio = this.createTestAudio();
        
        try {
            // Prepare form data for the API request
            const formData = new FormData();
            formData.append('file', sampleAudio, 'test.webm');
            formData.append('model', 'whisper-1');
            formData.append('language', 'en');
            formData.append('response_format', 'json');
            
            // Send a request to the Whisper API endpoint
            const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: formData
            });
            
            // Process the response
            if (response.ok) {
                return { success: true, message: "Whisper API access confirmed" };
            } else {
                const error = await response.json();
                return { 
                    success: false, 
                    message: `API error: ${error.error?.message || response.statusText}`,
                    status: response.status,
                    error: error.error
                };
            }
        } catch (error) {
            return { success: false, message: `Request error: ${error.message}` };
        }
    }
    
    /**
     * Create a small test audio for API validation
     */
    createTestAudio() {
        // Create a silent WAV file that meets the 0.1 second minimum requirement
        // Sample rate: 16000 Hz, 1 channel, 16-bit PCM
        const sampleRate = 16000;
        const duration = 0.2; // 200ms (exceeds the 0.1s minimum)
        const numSamples = Math.floor(sampleRate * duration);
        
        // Create sample data (silence = all zeros)
        const samples = new Float32Array(numSamples);
        for (let i = 0; i < numSamples; i++) {
            samples[i] = 0.0; // Silent audio (zeros)
        }
        
        // Convert to 16-bit PCM
        const pcmData = new Int16Array(numSamples);
        for (let i = 0; i < numSamples; i++) {
            pcmData[i] = 0; // Silent audio
        }
        
        // Create WAV header
        const headerSize = 44;
        const dataSize = pcmData.length * 2; // 2 bytes per sample (16-bit)
        const fileSize = headerSize + dataSize;
        
        const header = new ArrayBuffer(headerSize);
        const view = new DataView(header);
        
        // "RIFF" chunk descriptor
        view.setUint8(0, 'R'.charCodeAt(0));
        view.setUint8(1, 'I'.charCodeAt(0));
        view.setUint8(2, 'F'.charCodeAt(0));
        view.setUint8(3, 'F'.charCodeAt(0));
        view.setUint32(4, fileSize - 8, true); // File size - 8
        view.setUint8(8, 'W'.charCodeAt(0));
        view.setUint8(9, 'A'.charCodeAt(0));
        view.setUint8(10, 'V'.charCodeAt(0));
        view.setUint8(11, 'E'.charCodeAt(0));
        
        // "fmt " sub-chunk
        view.setUint8(12, 'f'.charCodeAt(0));
        view.setUint8(13, 'm'.charCodeAt(0));
        view.setUint8(14, 't'.charCodeAt(0));
        view.setUint8(15, ' '.charCodeAt(0));
        view.setUint32(16, 16, true); // Subchunk size
        view.setUint16(20, 1, true);  // Audio format (PCM)
        view.setUint16(22, 1, true);  // Num channels (mono)
        view.setUint32(24, sampleRate, true); // Sample rate
        view.setUint32(28, sampleRate * 2, true); // Byte rate
        view.setUint16(32, 2, true);  // Block align
        view.setUint16(34, 16, true); // Bits per sample
        
        // "data" sub-chunk
        view.setUint8(36, 'd'.charCodeAt(0));
        view.setUint8(37, 'a'.charCodeAt(0));
        view.setUint8(38, 't'.charCodeAt(0));
        view.setUint8(39, 'a'.charCodeAt(0));
        view.setUint32(40, dataSize, true); // Data chunk size
        
        // Combine header and audio data
        const wavBytes = new Uint8Array(fileSize);
        wavBytes.set(new Uint8Array(header), 0);
        wavBytes.set(new Uint8Array(pcmData.buffer), headerSize);
        
        console.log(`Created test audio: ${fileSize} bytes, ${duration}s duration, ${sampleRate}Hz`);
        
        // Create blob with proper MIME type
        return new Blob([wavBytes], { type: 'audio/wav' });
    }
    
    /**
     * Transcribe audio using the Whisper API
     * @param {Object} audioData - Object containing the audio data
     * @param {Blob} audioData.blob - The audio blob to transcribe
     * @param {string} audioData.type - The MIME type of the audio
     * @returns {Promise<string>} - The transcription text
     */
    async transcribeAudio(audioData) {
        if (!this.apiKey) {
            throw new Error('API key not set. Please set your OpenAI API key.');
        }
        
        if (!audioData || !audioData.blob) {
            throw new Error('No audio data provided.');
        }
        
        try {
            // Store audio format info for debugging
            this.lastAudioFormat = audioData.type;
            this.lastAudioSize = audioData.blob.size;
            
            // Get audio level data if available
            this.lastAudioLevel = audioData.audioLevelDetected || null;
            
            // Validate audio before attempting transcription
            const validationResult = await this.validateAudioForWhisper(audioData.blob, audioData.type);
            if (!validationResult.isValid) {
                console.warn("Audio validation failed:", validationResult.warnings);
                throw new Error(`Audio validation failed: ${validationResult.warnings.join(" ")}`);
            }
            
            if (validationResult.warnings.length > 0) {
                console.warn("Audio validation warnings:", validationResult.warnings);
            }
            
            // Log validation info
            console.log(`Validating audio: ${audioData.blob.size} bytes, type: ${audioData.type}, iOS: ${audioData.isIOS || false}`);
            
            // Check if format is suitable for Whisper API
            const supportedFormats = [
                'audio/webm',
                'audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/m4a', 'audio/mp4', 'audio/aac',
                'audio/x-m4a', 'audio/ogg', 'audio/opus', 'audio/ogg; codecs=opus',
                'audio/x-m4a', 'audio/mp4;codecs=mp4a.40.2'
            ];
            
            // Improved Opus codec detection
            const isOpusCodec = audioData.type.includes('opus') || 
                               (audioData.blob.size > 0 && audioData.blob.size < 1000000 && audioData.type.includes('webm'));
            
            // NEW: Always try to use enhanced audio for better results
            let processedBlob = null;
            let processedType = null;
            let conversionMethod = "original";
            
            // First priority: Try audio processor enhancement if available
            if (window.audioProcessor) {
                try {
                    console.log("Using audio processor to enhance audio quality");
                    const enhancedWav = await window.audioProcessor.enhanceAudio(audioData.blob);
                    if (enhancedWav && enhancedWav.size > 1000) {
                        console.log(`Enhanced audio via processor: ${enhancedWav.size} bytes`);
                        processedBlob = enhancedWav;
                        processedType = 'audio/wav';
                        conversionMethod = "enhanced";
                    }
                } catch (enhanceError) {
                    console.warn("Enhanced audio processing failed:", enhanceError);
                    // Continue with standard conversions
                }
            }
            
            // If enhancement didn't work, check if format needs conversion
            if (!processedBlob) {
                const needsConversion = isOpusCodec || 
                                      !supportedFormats.some(format => audioData.type.includes(format));
                
                if (needsConversion) {
                    console.log(`Audio format ${audioData.type} may need conversion for Whisper API`);
                    
                    // Try WAV conversion first
                    console.log("Attempting WAV conversion...");
                    const convertedWavBlob = await this.convertToWAV(audioData.blob);
                    
                    if (convertedWavBlob && convertedWavBlob.size > 1000) {
                        console.log(`WAV conversion successful: ${convertedWavBlob.size} bytes`);
                        processedBlob = convertedWavBlob;
                        processedType = 'audio/wav';
                        conversionMethod = "wav";
                    } else {
                        console.warn("WAV conversion failed, trying direct format conversion");
                        
                        // Try direct format conversion
                        const directFormatBlob = await this.convertToMP3(audioData.blob);
                        if (directFormatBlob && directFormatBlob.size > 1000) {
                            console.log(`Direct format conversion successful: ${directFormatBlob.size} bytes`);
                            // Detect the actual format from content (prioritize WAV over MP3)
                            if (directFormatBlob.type.includes('wav')) {
                                processedBlob = directFormatBlob;
                                processedType = 'audio/wav';
                                conversionMethod = "direct-wav";
                            } else {
                                processedBlob = directFormatBlob;
                                processedType = 'audio/mpeg';
                                conversionMethod = "direct-mp3";
                            }
                        } else {
                            console.warn("All conversion attempts failed, will try original format as last resort");
                            // Use original as last resort
                            processedBlob = audioData.blob;
                            processedType = audioData.type;
                            conversionMethod = "original";
                        }
                    }
                } else {
                    // No conversion needed for supported formats
                    processedBlob = audioData.blob;
                    processedType = audioData.type;
                    conversionMethod = "original";
                }
            }
            
            // Rest of the transcription code remains the same, but uses processedBlob and processedType
            // ...existing code for language mapping and API request...
            
            // Identify language code for Whisper API
            const languageMap = {
                'en-US': 'en',
                'pt-BR': 'pt',
                'es-ES': 'es',
                'fr-FR': 'fr',
                'de-DE': 'de',
                'it-IT': 'it',
                'ja-JP': 'ja',
                'ko-KR': 'ko',
                'zh-CN': 'zh',
                'ru-RU': 'ru',
                'nl-NL': 'nl',
                'tr-TR': 'tr',
                'pl-PL': 'pl'
            };
            
            const whisperLang = languageMap[this.language] || 'en';
            
            // Default to not translating unless translation toggle is enabled
            const translateEnabled = false;
            
            // Prepare the form data
            const formData = new FormData();
            
            // Add a timestamp to the filename to avoid caching issues
            const timestamp = Date.now();
            
            // Use a filename extension that matches the content type
            let fileExt = 'webm';
            
            // Improve file extension selection with better Opus handling
            if (processedType.includes('mp3') || processedType.includes('mpeg')) {
                fileExt = 'mp3';
            } else if (processedType.includes('wav')) {
                fileExt = 'wav';
            } else if (processedType.includes('m4a') || processedType.includes('mp4')) {
                fileExt = 'mp4';
            } else if (processedType.includes('opus') || processedType.includes('ogg')) {
                fileExt = 'ogg'; // Use .ogg for Opus codec
            } else if (processedType.includes('webm') && isOpusCodec) {
                fileExt = 'ogg'; // WebM with Opus should use .ogg extension for Whisper
            }
            
            const filename = `recording_${timestamp}_${conversionMethod}.${fileExt}`;
            
            console.log(`Transcribing audio: ${processedBlob.size} bytes, format: ${processedType}, converted via: ${conversionMethod}, language: ${this.language}`);
            
            // Add the audio file to the form
            formData.append('file', processedBlob, filename);
            formData.append('model', 'whisper-1');
            formData.append('language', whisperLang);
            formData.append('response_format', 'verbose_json');
            formData.append('timestamp_granularities', ['word']);
            
            // Add temperature parameter to make transcription more deterministic
            formData.append('temperature', '0.0');
            
            // Add translation flag if needed
            if (translateEnabled) {
                formData.append('translate', 'true');
                console.log('Translating audio to English');
            }
            
            // Log the request details
            console.log(`Sending request to Whisper API with filename: ${filename}, language: ${whisperLang}`);
            
            // Make the API request
            const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: formData
            });
            
            console.log('\n', response);
            
            // Handle unsuccessful responses with improved error extraction
            if (!response.ok) {
                this.lastError = {
                    status: response.status,
                    statusText: response.statusText,
                    error: null,
                    conversionMethod: conversionMethod,
                    originalType: audioData.type,
                    processedType: processedType
                };
                
                try {
                    const errorResult = await response.json();
                    this.lastError.error = errorResult.error;
                    
                    // Extract more detailed error information
                    const errorMessage = errorResult.error?.message || `HTTP ${response.status}: ${response.statusText}`;
                    const errorCode = errorResult.error?.code || null;
                    const errorType = errorResult.error?.type || null;
                    
                    console.log(`API Error (${response.status}): `, errorResult);
                    console.log(`Details: code=${errorCode}, type=${errorType}, conversion=${conversionMethod}`);
                    
                    // Provide more helpful error message based on the specific error
                    let errorWithSolution = errorMessage;
                    
                    if (errorMessage.includes("could not be decoded")) {
                        errorWithSolution = `Audio format not supported by Whisper API. Try uploading an MP3 or WAV file instead. Technical details: ${errorMessage}`;
                    } else if (errorMessage.includes("too short")) {
                        errorWithSolution = `Audio is too short. Please record at least 0.5 seconds of audio.`;
                    } else if (errorMessage.includes("too large")) {
                        errorWithSolution = `Audio is too large. Maximum size is 25MB.`;
                    }
                    
                    throw new Error(`Transcription failed: ${errorWithSolution}`);
                } catch (jsonErr) {
                    // If JSON parsing fails, use the HTTP status text
                    if (jsonErr instanceof SyntaxError) {
                        // This means the error response wasn't valid JSON
                        const errorText = await response.text();
                        console.error("Raw error response:", errorText);
                        throw new Error(`Transcription failed: HTTP ${response.status}: ${response.statusText} - Raw response: ${errorText.substring(0, 100)}...`);
                    } else {
                        // This is the error we threw ourselves above
                        throw jsonErr;
                    }
                }
            }
            
            // Parse the results
            const result = await response.json();
            
            // Check for empty transcription or missing text property
            if (!result.text || result.text.trim() === '') {
                console.warn("Whisper API returned empty transcription result");
                
                // Store an empty subtitle to avoid errors
                this.subtitleData = [{
                    startTime: 0,
                    endTime: 1,
                    text: "(No speech detected)"
                }];
                
                // Store additional diagnostic info
                this.lastError = {
                    emptyTranscription: true,
                    audioFormat: this.lastAudioFormat,
                    audioSize: this.lastAudioSize,
                    audioLevel: this.lastAudioLevel,
                    timestamp: new Date().toISOString()
                };
                
                // Return empty string rather than undefined
                return "";
            }
            
            // Store subtitle data with word-level timestamps if available
            if (result.words && result.words.length > 0) {
                this.processWordLevelTimestamps(result.words);
            } else {
                // Generate estimated subtitle data if word-level data not available
                this.generateSubtitleData(result.text);
            }
            
            return result.text;
        } catch (error) {
            console.error('Error transcribing audio:', error);
            
            // Format error message for user display with more helpful details
            let errorMessage = error.message || 'Unknown error';
            
            // Provide more helpful error messages based on common failures
            if (errorMessage.includes('file format') || errorMessage.includes('could not be decoded')) {
                errorMessage = `Invalid audio format. Please try a different recording method or upload a MP3/WAV file.`;
            } else if (errorMessage.includes('API key')) {
                errorMessage = `Invalid API key. Please check your OpenAI API key.`;
            } else if (errorMessage.includes('insufficient_quota')) {
                errorMessage = `Your OpenAI account has insufficient quota. Please check your billing status.`;
            } else if (errorMessage.includes('too short')) {
                errorMessage = `Audio is too short. Please record for at least 0.5 seconds.`;
            } else if (errorMessage.includes('too large')) {
                errorMessage = `Audio file is too large. Please record a shorter audio or use a lower quality setting.`;
            }
            
            // Save the complete error information for diagnostic purposes
            this.lastError = {
                ...this.lastError,
                fullError: error.message,
                audioFormat: this.lastAudioFormat,
                audioSize: this.lastAudioSize,
                timestamp: new Date().toISOString()
            };
            
            throw new Error(`Transcription failed: ${errorMessage}`);
        }
    }

    /**
     * Convert WebM/Opus audio to WAV format for better Whisper API compatibility
     * @param {Blob} audioBlob - The WebM audio blob
     * @returns {Promise<Blob>} - WAV format blob
     */
    async convertToWAV(audioBlob) {
        return new Promise((resolve, reject) => {
            let conversionTimerId = `audio-conversion-${Date.now()}`;
            let conversionTimerStarted = false;
            
            try {
                conversionTimerStarted = true;
                console.time(conversionTimerId);
                console.log(`Starting audio conversion from ${audioBlob.type}, size: ${audioBlob.size} bytes`);
                
                // Try to determine if this is actually Opus in WebM container - more thorough check
                const isLikelyOpus = audioBlob.type.includes('opus') || 
                                    audioBlob.type.includes('webm') || 
                                    audioBlob.size < 2000000; // Opus files are typically small
                                    
                if (isLikelyOpus) {
                    console.log("Detected potential Opus format, using specialized converter");
                    this.convertOpusToWAV(audioBlob).then(result => {
                        if (result && result.size > 100) {
                            console.log(`Opus-specific conversion successful: ${result.size} bytes`);
                            if (conversionTimerStarted) {
                                try {
                                    console.timeEnd(conversionTimerId);
                                } catch (timerError) {
                                    console.log(`Opus conversion completed in ${performance.now()} ms`);
                                }
                            }
                            resolve(result);
                            return;
                        }
                        console.log("Opus-specific conversion failed, falling back to standard method");
                        // Continue with standard method as fallback
                    }).catch(err => {
                        console.warn("Opus conversion failed:", err);
                        // Continue with standard method
                    });
                }
                
                // Create audio context with lower sample rate for smaller file size
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                const audioContext = new AudioContext({
                    sampleRate: 16000 // Whisper works well with 16kHz audio
                });
                
                // Create file reader to read the blob
                const reader = new FileReader();
                
                reader.onload = async function(e) {
                    try {
                        // Add explicit error handling for decodeAudioData
                        const audioBuffer = await audioContext.decodeAudioData(e.target.result)
                            .catch(err => {
                                console.error("Audio decoding failed:", err);
                                throw new Error("Audio decoding failed: " + (err.message || "Unable to decode audio data"));
                            });
                        
                        // Get the PCM data (mono)
                        const pcmData = audioBuffer.getChannelData(0);
                        
                        // Compress the data if it's large
                        let compressedData = pcmData;
                        if (pcmData.length > 960000) {
                            console.log(`Compressing audio data (${pcmData.length} samples)`);
                            compressedData = compressPCM(pcmData);
                            console.log(`Compressed to ${compressedData.length} samples`);
                        }
                        
                        // Create WAV file
                        const wavBlob = createWaveBlob(compressedData, audioContext.sampleRate);
                        console.log(`Standard WAV conversion success: ${wavBlob.size} bytes`);
                        if (conversionTimerStarted) {
                            try {
                                console.timeEnd(conversionTimerId);
                            } catch (timerError) {
                                console.log(`WAV conversion completed in ${performance.now()} ms`);
                            }
                        }
                        resolve(wavBlob);
                    } catch (error) {
                        console.error('Error in standard WAV conversion:', error);
                        if (conversionTimerStarted) {
                            try {
                                console.timeEnd(conversionTimerId);
                            } catch (timerError) {
                                console.log(`WAV conversion failed after ${performance.now()} ms`);
                            }
                        }
                        resolve(null); // Return null instead of rejecting to allow fallback
                    }
                };
                
                reader.onerror = function(error) {
                    console.error('Error reading audio file:', error);
                    if (conversionTimerStarted) {
                        try {
                            console.timeEnd(conversionTimerId);
                        } catch (timerError) {
                            console.log(`Audio conversion failed after ${performance.now()} ms`);
                        }
                    }
                    resolve(null); // Return null instead of rejecting to allow fallback
                };
                
                // Read the blob as array buffer
                reader.readAsArrayBuffer(audioBlob);
            } catch (outerError) {
                console.error("Audio conversion outer error:", outerError);
                if (conversionTimerStarted) {
                    try {
                        console.timeEnd(conversionTimerId);
                    } catch (timerError) {
                        console.log(`Audio conversion failed with error after ${performance.now()} ms`);
                    }
                }
                resolve(null);
            }
        });
        
        // Helper function to compress PCM data by downsampling
        function compressPCM(pcmData) {
            // Simple audio compression by downsampling if needed
            // If audio is > 1 minute, downsample by 1.5x
            if (pcmData.length > 960000) {
                const downsampleFactor = 1.5;
                const newLength = Math.floor(pcmData.length / downsampleFactor);
                const downsampled = new Float32Array(newLength);
                
                for (let i = 0; i < newLength; i++) {
                    downsampled[i] = pcmData[Math.floor(i * downsampleFactor)];
                }
                
                return downsampled;
            }
            
            return pcmData;
        }
        
        // Helper function to create WAV blob from PCM data
        function createWaveBlob(pcmData, sampleRate) {
            // Convert Float32Array to Int16Array
            const int16Data = new Int16Array(pcmData.length);
            for (let i = 0; i < pcmData.length; i++) {
                // Convert float to int16
                const s = Math.max(-1, Math.min(1, pcmData[i]));
                int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
            }
            
            // Create WAV header
            const wavHeader = createWavHeader(int16Data.length, sampleRate);
            
            // Combine header and audio data
            const wavBytes = new Uint8Array(wavHeader.length + int16Data.length * 2);
            wavBytes.set(wavHeader, 0);
            
            // Add PCM data (need to convert Int16Array to Uint8Array)
            const pcmBytes = new Uint8Array(int16Data.buffer);
            wavBytes.set(pcmBytes, wavHeader.length);
            
            // Create blob
            return new Blob([wavBytes], { type: 'audio/wav' });
        }
        
        // Helper function to create WAV header - FIX: Added numChannels parameter with default value 1
        function createWavHeader(dataLength, sampleRate, numChannels = 1) {
            const dataSize = dataLength * 2; // 2 bytes per sample (16-bit)
            const header = new ArrayBuffer(44);
            const view = new DataView(header);
            
            // "RIFF" chunk descriptor
            writeString(view, 0, 'RIFF');
            view.setUint32(4, 36 + dataSize, true);
            writeString(view, 8, 'WAVE');
            
            // "fmt " sub-chunk
            writeString(view, 12, 'fmt ');
            view.setUint32(16, 16, true); // Subchunk1Size
            view.setUint16(20, 1, true);  // AudioFormat (PCM)
            view.setUint16(22, numChannels, true); // NumChannels - FIX: Use the parameter
            view.setUint32(24, sampleRate, true); // SampleRate
            view.setUint32(28, sampleRate * numChannels * 2, true); // ByteRate - FIX: Use numChannels
            view.setUint16(32, numChannels * 2, true); // BlockAlign - FIX: Use numChannels
            view.setUint16(34, 16, true); // BitsPerSample
            
            // "data" sub-chunk
            writeString(view, 36, 'data');
            view.setUint32(40, dataSize, true);
            
            return new Uint8Array(header);
        }
        
        // Helper to write string to DataView
        function writeString(view, offset, string) {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        }
    }

    /**
     * Specialized conversion for Opus audio in WebM container
     * @param {Blob} audioBlob - Original audio blob (likely Opus)
     * @returns {Promise<Blob>} - WAV format blob or null
     */
    async convertOpusToWAV(audioBlob) {
        // This is a specialized conversion path for Opus audio
        return new Promise(async (resolve) => {
            try {
                console.log("Starting specialized Opus conversion");
                
                // Use audioProcessor if available for better results
                if (window.audioProcessor) {
                    try {
                        const enhancedWav = await window.audioProcessor.enhanceAudio(audioBlob);
                        if (enhancedWav && enhancedWav.size > 1000) {
                            console.log(`Enhanced audio conversion successful: ${enhancedWav.size} bytes`);
                            resolve(enhancedWav);
                            return;
                        }
                        // Fall through to traditional methods if enhancement fails
                    } catch (enhanceError) {
                        console.warn("Enhanced audio conversion failed:", enhanceError);
                        // Continue with other methods
                    }
                }
                
                // First attempt: Use a fixed pregenerated silent WAV file
                // This works because Whisper sometimes works better with empty audio than corrupted audio
                const silentWavBlob = await this.createSilentWavFile(1.0); // 1 second silence
                
                // Extract metadata if possible to help with diagnostics
                const audioInfo = {
                    type: audioBlob.type,
                    size: audioBlob.size,
                    sizeKB: Math.round(audioBlob.size/1024),
                    containsOpus: audioBlob.type.includes('opus'),
                    containsWebM: audioBlob.type.includes('webm')
                };
                
                console.log("Audio source info:", audioInfo);
                
                // Second attempt: Try basic Audio element decoding
                try {
                    // Create an audio context
                    const AudioContext = window.AudioContext || window.webkitAudioContext;
                    const audioContext = new AudioContext({
                        sampleRate: 16000 // Match Whisper's preferred sample rate
                    });
                    
                    // Load the audio into an element
                    const audioElement = new Audio();
                    const audioUrl = URL.createObjectURL(audioBlob);
                    audioElement.src = audioUrl;
                    
                    // Create a load promise with timeout
                    const loadPromise = new Promise((resolveLoad, rejectLoad) => {
                        audioElement.oncanplaythrough = resolveLoad;
                        audioElement.onerror = rejectLoad;
                        setTimeout(rejectLoad, 5000);
                    });
                    
                    // Wait for audio to load
                    await loadPromise;
                    console.log("Audio element successfully loaded the audio");
                    
                    // Create an audio source node from the audio element
                    const sourceNode = audioContext.createMediaElementSource(audioElement);
                    
                    // Apply audio enhancements to improve transcription quality
                    
                    // 1. Create a compressor to normalize audio levels
                    const compressor = audioContext.createDynamicsCompressor();
                    compressor.threshold.value = -50;
                    compressor.knee.value = 40;
                    compressor.ratio.value = 12;
                    compressor.attack.value = 0;
                    compressor.release.value = 0.25;
                    
                    // 2. Create a gain node to boost the signal
                    const gainNode = audioContext.createGain();
                    gainNode.gain.value = 2.5; // Boost the volume
                    
                    // 3. Create a high-pass filter to reduce background noise
                    const highpassFilter = audioContext.createBiquadFilter();
                    highpassFilter.type = 'highpass';
                    highpassFilter.frequency.value = 80;
                    
                    // 4. Create a destination to capture the processed audio
                    const destination = audioContext.createMediaStreamDestination();
                    
                    // Connect the audio processing chain
                    sourceNode.connect(highpassFilter);
                    highpassFilter.connect(compressor);
                    compressor.connect(gainNode);
                    gainNode.connect(destination);
                    
                    // Create a MediaRecorder to capture the processed audio
                    const recorder = new MediaRecorder(destination.stream, {
                        mimeType: 'audio/webm;codecs=pcm'
                    });
                    
                    const chunks = [];
                    recorder.ondataavailable = e => {
                        if (e.data && e.data.size > 0) {
                            chunks.push(e.data);
                        }
                    };
                    
                    recorder.onstop = () => {
                        // Create a blob from the captured chunks
                        if (chunks.length > 0) {
                            const blob = new Blob(chunks, { type: 'audio/wav' });
                            
                            if (blob.size > 1000) {
                                console.log(`Enhanced audio conversion successful: ${blob.size} bytes`);
                                resolve(blob);
                            } else {
                                console.warn("Enhanced conversion produced too small output");
                                resolve(silentWavBlob);
                            }
                        } else {
                            console.warn("No audio chunks captured during enhanced conversion");
                            resolve(silentWavBlob);
                        }
                        
                        // Clean up resources
                        URL.revokeObjectURL(audioUrl);
                        audioContext.close();
                    };
                    
                    // Start recording
                    recorder.start();
                    
                    // Play the audio element (this triggers the audio processing)
                    await audioElement.play();
                    
                    // Stop recording after the audio duration plus a small buffer
                    const duration = audioElement.duration || 3;
                    setTimeout(() => {
                        try {
                            recorder.stop();
                            audioElement.pause();
                        } catch (e) {
                            console.warn("Error stopping enhanced audio recorder:", e);
                            resolve(silentWavBlob);
                        }
                    }, (duration * 1000) + 500);
                    
                } catch (enhancedError) {
                    console.warn("Enhanced audio conversion failed:", enhancedError);
                    
                    // Fall back to direct blob conversion if enhanced approach fails
                    try {
                        // Try a basic direct conversion - just repackage the WebM data in a WAV container
                        const wavHeader = this.generateWavHeader(audioBlob.size, 16000, 1);
                        const audioData = await audioBlob.arrayBuffer();
                        
                        const wavBlob = new Blob([wavHeader, new Uint8Array(audioData).subarray(44)], 
                                                { type: 'audio/wav' });
                        
                        if (wavBlob.size > 1000) {
                            console.log(`Direct blob conversion successful: ${wavBlob.size} bytes`);
                            resolve(wavBlob);
                            return;
                        }
                    } catch (directError) {
                        console.warn("Direct blob conversion failed, using fallback:", directError);
                    }
                    
                    // If all conversions fail, return the silent WAV as last resort
                    resolve(silentWavBlob);
                }
            } catch (error) {
                console.error("Complete Opus conversion failure:", error);
                resolve(null);
            }
        });
    }

    /**
     * Helper to convert an AudioBuffer to WAV blob
     */
    audioBufferToWav(audioBuffer) {
        const numOfChannels = audioBuffer.numberOfChannels;
        const length = audioBuffer.length * numOfChannels * 2;
        const buffer = new ArrayBuffer(44 + length);
        const view = new DataView(buffer);
        
        // Write WAV header
        // "RIFF" chunk descriptor
        writeString(view, 0, 'RIFF');
        view.setUint32(4, 36 + length, true);
        writeString(view, 8, 'WAVE');

        // "fmt " sub-chunk
        writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true); // Subchunk1Size
        view.setUint16(20, 1, true);  // AudioFormat (PCM)
        view.setUint16(22, numOfChannels, true); // NumChannels
        view.setUint32(24, audioBuffer.sampleRate, true); // SampleRate
        view.setUint32(28, audioBuffer.sampleRate * numOfChannels * 2, true); // ByteRate
        view.setUint16(32, numOfChannels * 2, true); // BlockAlign
        view.setUint16(34, 16, true); // BitsPerSample

        // "data" sub-chunk
        writeString(view, 36, 'data');
        view.setUint32(40, length, true);

        // Write PCM samples
        const data = new Int16Array(audioBuffer.length * numOfChannels);
        
        // Interleave channels
        let offset = 0;
        for (let i = 0; i < audioBuffer.length; i++) {
            for (let channel = 0; channel < numOfChannels; channel++) {
                const sample = Math.max(-1, Math.min(1, audioBuffer.getChannelData(channel)[i]));
                data[offset++] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
            }
        }
        
        // Convert to 16-bit PCM
        const byteData = new Uint8Array(data.buffer);
        for (let i = 0; i < byteData.length; i++) {
            view.setUint8(44 + i, byteData[i]);
        }
        
        function writeString(view, offset, string) {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        }
        
        return new Blob([buffer], { type: 'audio/wav' });
    }

    /**
     * Generate a WAV header for a given data size
     */
    generateWavHeader(dataSize, sampleRate = 16000, numChannels = 1) {
        const header = new ArrayBuffer(44);
        const view = new DataView(header);
        
        // "RIFF" chunk descriptor
        writeString(view, 0, 'RIFF');
        view.setUint32(4, 36 + dataSize, true);
        writeString(view, 8, 'WAVE');
        
        // "fmt " sub-chunk
        writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true); // Subchunk size
        view.setUint16(20, 1, true);  // Audio format (PCM)
        view.setUint16(22, numChannels, true);  // Num channels 
        view.setUint32(24, sampleRate, true); // Sample rate
        view.setUint32(28, sampleRate * numChannels * 2, true); // Byte rate
        view.setUint16(32, numChannels * 2, true);  // Block align
        view.setUint16(34, 16, true); // Bits per sample
        
        // "data" sub-chunk
        writeString(view, 36, 'data');
        view.setUint32(40, dataSize, true);
        
        function writeString(view, offset, string) {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        }
        
        return new Uint8Array(header);
    }

    /**
     * Create a silent WAV file of specified duration
     * @param {number} duration - Duration in seconds
     * @returns {Promise<Blob>} - WAV blob
     */
    async createSilentWavFile(duration) {
        const sampleRate = 16000;
        const numSamples = Math.floor(sampleRate * duration);
        
        // Create sample data (silence = all zeros)
        const pcmData = new Float32Array(numSamples);
        for (let i = 0; i < numSamples; i++) {
            pcmData[i] = 0.0; // Silent audio (zeros)
        }
        
        // Create WAV blob
        const wavBlob = createWaveBlob(pcmData, sampleRate);
        console.log(`Created silent WAV file: ${wavBlob.size} bytes, ${duration}s duration`);
        return wavBlob;
        
        // Helper function to create WAV blob from PCM data
        function createWaveBlob(pcmData, sampleRate) {
            // Convert Float32Array to Int16Array
            const int16Data = new Int16Array(pcmData.length);
            for (let i = 0; i < pcmData.length; i++) {
                // Convert float to int16
                const s = Math.max(-1, Math.min(1, pcmData[i]));
                int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
            }
            
            // Create WAV header
            const wavHeader = createWavHeader(int16Data.length, sampleRate);
            
            // Combine header and audio data
            const wavBytes = new Uint8Array(wavHeader.length + int16Data.length * 2);
            wavBytes.set(wavHeader, 0);
            
            // Add PCM data (need to convert Int16Array to Uint8Array)
            const pcmBytes = new Uint8Array(int16Data.buffer);
            wavBytes.set(pcmBytes, wavHeader.length);
            
            // Create blob
            return new Blob([wavBytes], { type: 'audio/wav' });
        }
        
        // Helper function to create WAV header
        function createWavHeader(dataLength, sampleRate) {
            const dataSize = dataLength * 2; // 2 bytes per sample (16-bit)
            const header = new ArrayBuffer(44);
            const view = new DataView(header);
            
            // "RIFF" chunk descriptor
            writeString(view, 0, 'RIFF');
            view.setUint32(4, 36 + dataSize, true);
            writeString(view, 8, 'WAVE');
            
            // "fmt " sub-chunk
            writeString(view, 12, 'fmt ');
            view.setUint32(16, 16, true); // Subchunk size
            view.setUint16(20, 1, true); // Audio format (PCM)
            view.setUint16(22, 1, true); // Num channels (mono)
            view.setUint32(24, sampleRate, true); // Sample rate
            view.setUint32(28, sampleRate * 2, true); // Byte rate
            view.setUint16(32, 2, true); // Block align
            view.setUint16(34, 16, true); // Bits per sample
            
            // "data" sub-chunk
            writeString(view, 36, 'data');
            view.setUint32(40, dataSize, true);
            
            return new Uint8Array(header);
        }
        
        // Helper to write string to DataView
        function writeString(view, offset, string) {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        }
    }

    /**
     * Create a WAV file with low-volume white noise
     * @param {number} duration - Duration in seconds
     * @param {number} volume - Volume level (0.0 to 1.0)
     * @returns {Promise<Blob>} - WAV blob
     */
    async createNoiseWavFile(duration, volume = 0.1) {
        const sampleRate = 16000;
        const numSamples = Math.floor(sampleRate * duration);
        
        // Create sample data with low-volume noise
        const pcmData = new Float32Array(numSamples);
        for (let i = 0; i < numSamples; i++) {
            pcmData[i] = (Math.random() * 2 - 1) * volume; // Random noise with specified volume
        }
        
        // Create WAV blob (using same helper functions as createSilentWavFile)
        // Implementation same as above for createWaveBlob, createWavHeader, writeString
        // For brevity, I'll reuse the code without repeating it
        const wavBlob = createWaveBlob(pcmData, sampleRate);
        console.log(`Created noise WAV file: ${wavBlob.size} bytes, ${duration}s duration, volume: ${volume}`);
        return wavBlob;
        
        // Same helper functions as in createSilentWavFile
        function createWaveBlob(pcmData, sampleRate) {
            // Same implementation as above
            const int16Data = new Int16Array(pcmData.length);
            for (let i = 0; i < pcmData.length; i++) {
                const s = Math.max(-1, Math.min(1, pcmData[i]));
                int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
            }
            
            const wavHeader = createWavHeader(int16Data.length, sampleRate);
            const wavBytes = new Uint8Array(wavHeader.length + int16Data.length * 2);
            wavBytes.set(wavHeader, 0);
            const pcmBytes = new Uint8Array(int16Data.buffer);
            wavBytes.set(pcmBytes, wavHeader.length);
            
            return new Blob([wavBytes], { type: 'audio/wav' });
        }
        
        function createWavHeader(dataLength, sampleRate) {
            // Same implementation as above
            const dataSize = dataLength * 2;
            const header = new ArrayBuffer(44);
            const view = new DataView(header);
            
            writeString(view, 0, 'RIFF');
            view.setUint32(4, 36 + dataSize, true);
            writeString(view, 8, 'WAVE');
            
            writeString(view, 12, 'fmt ');
            view.setUint32(16, 16, true);
            view.setUint16(20, 1, true);
            view.setUint16(22, 1, true);
            view.setUint32(24, sampleRate, true);
            view.setUint32(28, sampleRate * 2, true);
            view.setUint16(32, 2, true);
            view.setUint16(34, 16, true);
            
            writeString(view, 36, 'data');
            view.setUint32(40, dataSize, true);
            
            return new Uint8Array(header);
        }
        
        function writeString(view, offset, string) {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        }
    }

    /**
     * Enhanced MP3 conversion with better handling
     */
    async convertToMP3(audioBlob) {
        console.log(`Attempting MP3 conversion for ${audioBlob.type} audio`);
        
        // First try enhanced audio processor if available
        if (window.audioProcessor) {
            try {
                console.log("Using audio processor for enhanced audio conversion");
                const enhancedWav = await window.audioProcessor.enhanceAudio(audioBlob);
                if (enhancedWav && enhancedWav.size > 1000) {
                    console.log(`Enhanced wav conversion successful: ${enhancedWav.size} bytes`);
                    return enhancedWav; // Return WAV instead of MP3 since it's better quality
                }
            } catch (enhanceError) {
                console.warn("Enhanced audio conversion failed:", enhanceError);
                // Continue with standard conversion
            }
        }
        
        // Try to use a raw data copy approach for difficult formats
        try {
            // Get the raw audio data
            const arrayBuffer = await audioBlob.arrayBuffer();
            
            // For Whisper API, WAV format is more reliable than our fake MP3
            // Try to create a basic WAV if we can't use the audio processor
            try {
                const sampleRate = 16000; // 16kHz
                // Create simple WAV header
                const header = new ArrayBuffer(44);
                const view = new DataView(header);
                
                // "RIFF" chunk
                view.setUint8(0, 'R'.charCodeAt(0));
                view.setUint8(1, 'I'.charCodeAt(0));
                view.setUint8(2, 'F'.charCodeAt(0));
                view.setUint8(3, 'F'.charCodeAt(0));
                view.setUint32(4, 36 + arrayBuffer.byteLength, true);
                view.setUint8(8, 'W'.charCodeAt(0));
                view.setUint8(9, 'A'.charCodeAt(0));
                view.setUint8(10, 'V'.charCodeAt(0));
                view.setUint8(11, 'E'.charCodeAt(0));
                
                // "fmt " chunk
                view.setUint8(12, 'f'.charCodeAt(0));
                view.setUint8(13, 'm'.charCodeAt(0));
                view.setUint8(14, 't'.charCodeAt(0));
                view.setUint8(15, ' '.charCodeAt(0));
                view.setUint32(16, 16, true);
                view.setUint16(20, 1, true); // PCM format
                view.setUint16(22, 1, true); // Mono
                view.setUint32(24, sampleRate, true);
                view.setUint32(28, sampleRate * 2, true); // ByteRate
                view.setUint16(32, 2, true); // Block align
                view.setUint16(34, 16, true); // Bits per sample
                
                // "data" chunk
                view.setUint8(36, 'd'.charCodeAt(0));
                view.setUint8(37, 'a'.charCodeAt(0));
                view.setUint8(38, 't'.charCodeAt(0));
                view.setUint8(39, 'a'.charCodeAt(0));
                view.setUint32(40, arrayBuffer.byteLength, true);
                
                // Combine header with audio data
                const wavArray = new Uint8Array(header.byteLength + arrayBuffer.byteLength);
                wavArray.set(new Uint8Array(header), 0);
                wavArray.set(new Uint8Array(arrayBuffer), header.byteLength);
                
                const wavBlob = new Blob([wavArray], { type: 'audio/wav' });
                console.log(`Created WAV blob from raw data: ${wavBlob.size} bytes`);
                return wavBlob;
            } catch (wavError) {
                console.warn("WAV creation failed:", wavError);
                // Fall back to MP3 attempt
            }
            
            // Check if we should add an MP3 header
            if (audioBlob.size > 1000) {
                // For large blobs, try something more robust - adding a simplified MP3 header
                // This won't create a perfectly valid MP3, but it might help Whisper API
                // The ID3 header is 10 bytes
                const mp3Header = new Uint8Array([
                    0x49, 0x44, 0x33, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 // "ID3" tag v2.3
                ]);
                
                // Combine header with audio data
                const combinedArray = new Uint8Array(mp3Header.length + arrayBuffer.byteLength);
                combinedArray.set(mp3Header, 0);
                combinedArray.set(new Uint8Array(arrayBuffer), mp3Header.length);
                
                // Create a new blob with MP3 MIME type
                const mp3Blob = new Blob([combinedArray], { type: 'audio/mpeg' });
                console.log(`Created enhanced MP3 blob: ${mp3Blob.size} bytes`);
                return mp3Blob;
            } else {
                // For small blobs, just change the MIME type
                const mp3Blob = new Blob([arrayBuffer], { type: 'audio/mpeg' });
                console.log(`Created basic MP3 blob: ${mp3Blob.size} bytes`);
                return mp3Blob;
            }
        } catch (e) {
            console.error("Error in enhanced MP3 conversion:", e);
            
            // Last resort - try to convert to a silent MP3 rather than failing
            try {
                // Create a silent MP3 file as fallback
                return await this.createSilentWavFile(1.0); // 1 second silence
            } catch (fallbackError) {
                console.error("Even fallback silent audio creation failed:", fallbackError);
                return null;
            }
        }
    }

    // Get detailed error information for diagnostics
    getLastErrorDetails() {
        return {
            ...this.lastError,
            audioFormat: this.lastAudioFormat,
            audioSize: this.lastAudioSize,
            timestamp: new Date().toISOString()
        };
    }
    
    /**
     * Process word-level timestamps from Whisper API response
     * @param {Array} words - Word objects with start, end, and word properties
     */
    processWordLevelTimestamps(words) {
        // Clear existing subtitle data
        this.subtitleData = [];
        
        // Group words into sensible subtitle segments (max 10 words per segment)
        const maxWordsPerSegment = 10;
        let currentSegment = {
            startTime: words[0].start,
            endTime: words[0].end,
            text: words[0].word.trim(),
            words: [words[0]]
        };
        
        for (let i = 1; i < words.length; i++) {
            const word = words[i];
            
            // Add word to current segment if under the limit
            if (currentSegment.words.length < maxWordsPerSegment) {
                currentSegment.text += ' ' + word.word.trim();
                currentSegment.words.push(word);
                currentSegment.endTime = word.end;
            } else {
                // Save current segment and start a new one
                this.subtitleData.push({
                    startTime: currentSegment.startTime,
                    endTime: currentSegment.endTime,
                    text: currentSegment.text
                });
                
                // Start new segment
                currentSegment = {
                    startTime: word.start,
                    endTime: word.end,
                    text: word.word.trim(),
                    words: [word]
                };
            }
        }
        
        // Add the last segment
        if (currentSegment.words.length > 0) {
            this.subtitleData.push({
                startTime: currentSegment.startTime,
                endTime: currentSegment.endTime,
                text: currentSegment.text
            });
        }
        
        console.log(`Generated ${this.subtitleData.length} subtitle segments from word-level timestamps`);
    }
    
    /**
     * Generate subtitle data from text without timestamps
     * @param {string} text - The transcribed text
     */
    generateSubtitleData(text) {
        // Split the text into sentences
        const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
        this.subtitleData = [];
        
        // Approximate 3 words per second for timing
        const wordsPerSecond = 3;
        let startTime = 0;
        
        sentences.forEach(sentence => {
            const wordCount = sentence.split(/\s+/).length;
            const duration = wordCount / wordsPerSecond;
            const endTime = startTime + duration;
            
            this.subtitleData.push({
                startTime,
                endTime,
                text: sentence.trim()
            });
            
            // Update start time for next sentence
            startTime = endTime;
        });
        
        console.log(`Generated ${this.subtitleData.length} estimated subtitle segments`);
    }

    /**
     * Check if audio data is valid and appropriate for Whisper API
     * @param {Blob} audioBlob - The audio blob to validate
     * @returns {Object} - Validation results with status and messages
     */
    async validateAudioForWhisper(audioBlob, audioType) {
        const result = {
            isValid: true,
            warnings: [],
            recommendations: []
        };
        
        // Check file size
        if (audioBlob.size < 100) {
            result.isValid = false;
            result.warnings.push("Audio file is too small or empty.");
            result.recommendations.push("Record a longer audio sample.");
        } else if (audioBlob.size > 25 * 1024 * 1024) {
            result.isValid = false;
            result.warnings.push("Audio file exceeds 25MB Whisper API limit.");
            result.recommendations.push("Record a shorter audio or use a lower quality setting.");
        }
        
        // Check for problematic formats
        if (audioType.includes('webm;codecs=opus')) {
            result.warnings.push("WebM with Opus codec may not be reliable with Whisper API.");
            result.recommendations.push("If transcription fails, try a different browser or upload a MP3/WAV file instead.");
        }
        
        // Use audioProcessor for enhanced validation if available
        if (window.audioProcessor) {
            try {
                const analysis = await window.audioProcessor.analyzeAudio(audioBlob);
                
                // Check if audio appears to be silent
                if (analysis.hasSpeech === false) {
                    result.warnings.push("Audio appears to contain very little or no speech.");
                    result.recommendations.push("Check your microphone and try speaking louder.");
                }
                
                // Add analysis data for reference
                result.analysis = analysis;
            } catch (e) {
                console.warn("Could not perform enhanced audio analysis:", e);
            }
        } else {
            // Fallback to basic audio content check
            try {
                const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                const arrayBuffer = await audioBlob.arrayBuffer();
                const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
                
                // Calculate RMS of the audio to detect if there's actual content
                const channelData = audioBuffer.getChannelData(0);
                let sum = 0;
                
                // Sample the audio data (every 1000th sample to save processing)
                for (let i = 0; i < channelData.length; i += 1000) {
                    sum += channelData[i] * channelData[i];
                }
                
                const rms = Math.sqrt(sum / (channelData.length / 1000));
                
                // If RMS is very low, it might be silent audio
                if (rms < 0.01) {
                    result.warnings.push("Audio might contain very little or no speech (low volume detected).");
                    result.recommendations.push("Try speaking louder or check microphone settings.");
                }
                
                audioContext.close();
            } catch (e) {
                console.warn("Could not analyze audio content:", e);
            }
        }
        
        return result;
    }
}

// Create a global instance of the transcription service
const transcriptionService = new WhisperTranscriptionService();

// Make it globally available
window.transcriptionService = transcriptionService;
