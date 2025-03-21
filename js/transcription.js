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
            
            // Log validation info
            console.log(`Validating audio: ${audioData.blob.size} bytes, type: ${audioData.type}, iOS: ${audioData.isIOS || false}, WhatsApp: ${audioData.isWhatsApp || false}`);
            
            // Check if format is suitable for Whisper API
            const supportedFormats = [
                'audio/webm',
                'audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/m4a', 'audio/mp4', 'audio/aac',
                'audio/x-m4a', 'audio/ogg', 'audio/opus', 'audio/ogg; codecs=opus',
                'audio/x-m4a', 'audio/mp4;codecs=mp4a.40.2'
            ];
            
            // Check if the format needs conversion
            // NOTE: audio/webm with opus codec often needs conversion for Whisper
            const needsConversion = audioData.type === 'audio/webm;codecs=opus' || 
                                   !supportedFormats.some(format => audioData.type.includes(format));
            
            if (needsConversion) {
                console.log(`Audio format ${audioData.type} may not be fully supported by Whisper API. Supported formats include: ${supportedFormats.join(', ')}`);
                console.log(`Attempting to convert to a better format for Whisper API...`);
                
                // Convert WebM with Opus to standard WAV for Whisper compatibility
                const convertedBlob = await this.convertToWAV(audioData.blob);
                if (convertedBlob) {
                    console.log(`Successfully converted audio to WAV format (${convertedBlob.size} bytes)`);
                    audioData.blob = convertedBlob;
                    audioData.type = 'audio/wav';
                } else {
                    console.warn(`Conversion failed, will try with original format`);
                }
            }
            
            // Identify language code for Whisper API
            const languageMap = {
                'en-US': 'en',
                'pt-BR': 'pt'
            };
            
            const whisperLang = languageMap[this.language] || 'en';
            
            // Default to not translating unless translation toggle is enabled 
            // and target language is English
            const translateEnabled = false; // Default to false - change if needed
            
            // Prepare the form data
            const formData = new FormData();
            
            // Add a timestamp to the filename to avoid caching issues
            const timestamp = Date.now();
            
            // Use a filename extension that matches the content type
            let fileExt = 'webm';
            if (audioData.type.includes('mp3') || audioData.type.includes('mpeg')) {
                fileExt = 'mp3';
            } else if (audioData.type.includes('wav')) {
                fileExt = 'wav';
            } else if (audioData.type.includes('m4a') || audioData.type.includes('mp4')) {
                fileExt = 'mp4';
            } else if (audioData.type.includes('ogg') || audioData.type.includes('opus')) {
                fileExt = 'ogg';
            }
            
            const filename = `recording_${timestamp}_${audioData.timestamp || timestamp}.${fileExt}`;
            
            console.log(`Transcribing audio: ${audioData.blob.size} bytes, format: ${audioData.type}, language: ${this.language}, translate: ${translateEnabled ? 'enabled' : 'disabled'}`);
            
            // Add the audio file to the form
            formData.append('file', audioData.blob, filename);
            formData.append('model', 'whisper-1');
            formData.append('language', whisperLang);
            formData.append('response_format', 'verbose_json');
            formData.append('timestamp_granularities', ['word']);
            
            // Add translation flag if needed
            if (translateEnabled) {
                formData.append('translate', 'true');
                console.log('Translating audio to English');
            }
            
            // Log the request details
            console.log(`Sending request to Whisper API with filename: ${filename}, language: ${whisperLang}, translate: ${translateEnabled}`);
            
            // Make the API request
            const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: formData
            });
            
            console.log('\n', response);
            
            // Handle unsuccessful responses
            if (!response.ok) {
                this.lastError = {
                    status: response.status,
                    statusText: response.statusText,
                    error: null
                };
                
                try {
                    const errorResult = await response.json();
                    this.lastError.error = errorResult.error;
                    console.log(`API Error (${response.status}): `, errorResult);
                    throw new Error(`Transcription failed: ${errorResult.error?.message || `HTTP ${response.status}: ${response.statusText}`}`);
                } catch (jsonErr) {
                    // If JSON parsing fails, use the HTTP status text
                    throw new Error(`Transcription failed: HTTP ${response.status}: ${response.statusText}`);
                }
            }
            
            // Parse the results
            const result = await response.json();
            
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
            
            // Format error message for user display
            let errorMessage = error.message || 'Unknown error';
            
            // Provide more helpful error messages based on common failures
            if (errorMessage.includes('file format')) {
                errorMessage = `Invalid audio format. Please try a different recording method.`;
            } else if (errorMessage.includes('API key')) {
                errorMessage = `Invalid API key. Please check your OpenAI API key.`;
            } else if (errorMessage.includes('insufficient_quota')) {
                errorMessage = `Your OpenAI account has insufficient quota. Please check your billing status.`;
            }
            
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
            console.time('audio-conversion');
            // Create audio context with lower sample rate for smaller file size
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            const audioContext = new AudioContext({
                sampleRate: 16000 // Whisper works well with 16kHz audio, lower sample rate = smaller file
            });
            
            // Create file reader to read the blob
            const reader = new FileReader();
            
            reader.onload = async function(e) {
                try {
                    // Decode the audio data
                    const audioData = await audioContext.decodeAudioData(e.target.result);
                    
                    // Get the PCM data (mono)
                    const pcmData = audioData.getChannelData(0);
                    
                    // Compress the data if it's large (above 1 minute of audio)
                    let compressedData = pcmData;
                    if (pcmData.length > 960000) { // More than 1 minute at 16kHz
                        console.log(`[TRANSCRIPTION] Compressing audio data (${pcmData.length} samples)`);
                        compressedData = compressPCM(pcmData);
                        console.log(`[TRANSCRIPTION] Compressed to ${compressedData.length} samples`);
                    }
                    
                    // Create WAV file
                    const wavBlob = createWaveBlob(compressedData, audioContext.sampleRate);
                    console.timeEnd('audio-conversion');
                    resolve(wavBlob);
                } catch (error) {
                    console.error('Error converting audio:', error);
                    console.timeEnd('audio-conversion');
                    resolve(null); // Return null instead of rejecting to allow fallback
                }
            };
            
            reader.onerror = function(error) {
                console.error('Error reading audio file:', error);
                console.timeEnd('audio-conversion');
                resolve(null); // Return null instead of rejecting to allow fallback
            };
            
            // Read the blob as array buffer
            reader.readAsArrayBuffer(audioBlob);
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
}

// Create a global instance of the transcription service
const transcriptionService = new WhisperTranscriptionService();

// Make it globally available
window.transcriptionService = transcriptionService;
