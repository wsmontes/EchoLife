class WhisperTranscriptionService {
    constructor() {
        this.apiKey = null;
        this.supportedFormats = [
            'audio/webm', 'audio/mp3', 'audio/mpeg', 'audio/wav', 
            'audio/m4a', 'audio/mp4', 'audio/aac', 'audio/x-m4a',
            'audio/ogg', 'audio/opus', 'audio/ogg; codecs=opus' // WhatsApp formats
        ];
        this.maxRetries = 2;
        this.transcriptionError = null;
        
        // Add file extensions for blob type detection
        this.formatExtensions = {
            '.opus': 'audio/ogg; codecs=opus',
            '.ogg': 'audio/ogg',
            '.m4a': 'audio/mp4', // iOS WhatsApp uses m4a with mp4 container
            '.mp3': 'audio/mpeg',
            '.wav': 'audio/wav',
            '.aac': 'audio/aac',
            '.mp4': 'audio/mp4'
        };

        // Add patterns to detect WhatsApp voice messages
        this.whatsAppPatterns = [
            /PTT-\d+/i,             // Android pattern (PTT-timestamp)
            /AUD-\d+/i,             // iOS pattern (AUD-timestamp)
            /WhatsApp Audio/i,      // General WhatsApp audio
            /whatsapp.*\.m4a$/i,    // iOS WhatsApp m4a
            /\.opus$/i              // Android WhatsApp opus
        ];

        // Add common iOS recording formats explicitly
        this.supportedFormats.push('audio/x-m4a'); // Additional m4a format
        this.supportedFormats.push('audio/mp4;codecs=mp4a.40.2'); // Explicit AAC-LC
        
        // Add more diagnostic tracking
        this.lastTranscriptionAttempt = null;
        this.maxIOSRetries = 3; // Increase retries for iOS specifically
    }

    setApiKey(key) {
        this.apiKey = key;
    }

    // Enhanced method to validate audio format
    validateAudioFormat(audioBlob, metadata = {}) {
        if (!audioBlob) {
            throw new Error('No audio data provided');
        }
        
        // Check if the format is supported
        const isIOSDevice = metadata.isIOS || (/iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream);
        const iosVersion = metadata.iosVersion;
        
        // Check if this is likely a WhatsApp voice message by file extension or MIME type
        let isWhatsApp = metadata.isWhatsApp;
        
        // If not explicitly set, detect WhatsApp format
        if (!isWhatsApp && metadata.filename) {
            isWhatsApp = this.whatsAppPatterns.some(pattern => pattern.test(metadata.filename));
        }
        
        console.log(`Validating audio: ${audioBlob.size} bytes, type: ${audioBlob.type}, iOS: ${isIOSDevice}, WhatsApp: ${isWhatsApp}`);
        
        // Add better MIME type detection for empty or unknown types
        let detectedType = audioBlob.type;
        if (!detectedType || detectedType === '') {
            // Try to detect type from filename extension
            if (metadata.filename) {
                const fileExt = metadata.filename.substring(metadata.filename.lastIndexOf('.')).toLowerCase();
                if (this.formatExtensions[fileExt]) {
                    detectedType = this.formatExtensions[fileExt];
                    console.log(`Detected MIME type ${detectedType} from extension ${fileExt}`);
                }
            }
            
            // Special handling for WhatsApp voice messages
            if (isWhatsApp) {
                // iOS WhatsApp uses m4a format
                if (isIOSDevice || (metadata.filename && metadata.filename.toLowerCase().endsWith('.m4a'))) {
                    detectedType = 'audio/mp4';
                    console.log('Using iOS WhatsApp voice message format: audio/mp4');
                } else {
                    // Android WhatsApp uses opus
                    detectedType = 'audio/ogg; codecs=opus';
                    console.log('Using Android WhatsApp voice message format: audio/ogg; codecs=opus');
                }
            }
        }
        
        // More permissive check for iOS devices and WhatsApp formats - accept most formats
        if (!this.supportedFormats.includes(detectedType) && detectedType !== '') {
            console.warn(`Audio format ${detectedType} may not be fully supported by Whisper API. Supported formats include: ${this.supportedFormats.join(', ')}`);
            
            // Special message for WhatsApp/iOS
            if (isWhatsApp) {
                console.log("WhatsApp audio detected - will attempt processing anyway");
            } else if (isIOSDevice) {
                console.log("iOS device detected - will attempt processing anyway");
            }
        }
        
        // Check file size (Whisper has a 25MB limit)
        if (audioBlob.size > 25 * 1024 * 1024) {
            throw new Error('Audio file exceeds the 25MB size limit for Whisper API');
        }
        
        if (audioBlob.size < 100) {
            throw new Error('Audio file is too small (less than 100 bytes) and may be empty or corrupted');
        }
        
        return true;
    }

    // Try to extract error details from error response
    parseApiError(response, errorData) {
        const statusCode = response.status;
        let errorMessage = 'Transcription failed: ';
        
        if (statusCode === 400) {
            // Common 400 errors for audio issues
            if (errorData.error?.message?.includes('format')) {
                errorMessage += 'Invalid audio format. Please try a different recording method.';
            } else if (errorData.error?.message?.includes('file')) {
                errorMessage += 'Audio file is invalid or corrupted.';
            } else {
                errorMessage += errorData.error?.message || 'Bad request';
            }
        } else if (statusCode === 401) {
            errorMessage += 'API key is invalid or expired. Please update your API key.';
        } else if (statusCode === 429) {
            errorMessage += 'Rate limit exceeded or insufficient quota for Whisper API.';
        } else {
            errorMessage += errorData.error?.message || response.statusText;
        }
        
        console.error(`API Error (${statusCode}):`, errorData.error || response.statusText);
        return errorMessage;
    }

    async transcribeAudio(audioData, retryCount = 0, language = null) {
        if (!this.apiKey) {
            throw new Error('API key not set for Whisper transcription service');
        }

        // Get translation settings
        const translationSettings = window.translationController ? 
            window.translationController.getSettings() : 
            { language: 'en-US', translateEnabled: false };
        
        // Determine language for transcription (what language to detect)
        // If not explicitly passed, use the interface language
        if (!language) {
            language = translationSettings.language;
        }
        
        // Determine if we should translate
        const translateEnabled = translationSettings.translateEnabled;
        const translateTo = translateEnabled ? 
            (language === 'pt-BR' ? 'en' : 'pt') : null;

        // Store information about this attempt for diagnostics
        this.lastTranscriptionAttempt = {
            timestamp: new Date(),
            retryCount: retryCount,
            language: language,
            translateEnabled: translateEnabled,
            translateTo: translateTo,
            audioInfo: audioData instanceof File ? 
                       { name: audioData.name, type: audioData.type, size: audioData.size } :
                       { type: audioData.type || 'unknown', size: audioData.blob?.size || 'unknown' }
        };

        // Clear previous error
        this.transcriptionError = null;

        // Handle both simple blob and metadata object formats
        let audioBlob, metadata = {};
        if (audioData.blob && typeof audioData.isIOS !== 'undefined') {
            // New format with metadata
            audioBlob = audioData.blob;
            metadata = {
                isIOS: audioData.isIOS,
                iosVersion: audioData.iosVersion,
                type: audioData.type,
                chunks: audioData.chunks,
                chunkSizes: audioData.chunkSizes,
                isWhatsApp: audioData.isWhatsApp,
                filename: audioData.filename,
                preferredFormatForWhisper: audioData.preferredFormatForWhisper,
                likelyCompatible: audioData.likelyCompatible,
                codecInfo: audioData.codecInfo
            };
        } else if (audioData instanceof File) {
            // Handle File objects directly
            audioBlob = audioData;
            metadata = {
                filename: audioData.name,
                type: audioData.type,
                isWhatsApp: audioData.name.endsWith('.opus') || 
                           audioData.name.match(/PTT-\d+/i) !== null ||
                           audioData.name.match(/AUD-\d+/i) !== null || // iOS WhatsApp
                           audioData.name.includes('WhatsApp Audio') ||
                           audioData.type === 'audio/ogg' ||
                           audioData.type.includes('opus')
            };
        } else {
            // Original format (just the blob)
            audioBlob = audioData;
        }

        try {
            // If iOS, create a parallel audio file for transcription
            if (metadata.isIOS) {
                console.log("Creating parallel audio file for transcription on iOS");
                const arrayBuffer = await audioBlob.arrayBuffer();
                const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                const decoded = await audioCtx.decodeAudioData(arrayBuffer);
                audioBlob = await this.bufferToWav(decoded);
                metadata.filename = `ios_parallel_${Date.now()}.wav`;
                metadata.type = 'audio/wav';
            }
            
            // Validate audio format
            this.validateAudioFormat(audioBlob, metadata);
            
            console.log(`Transcribing audio: ${audioBlob.size} bytes, format: ${audioBlob.type || 'unknown'}, language: ${language}, translate: ${translateEnabled ? translateTo : 'disabled'}`);
            
            // Determine appropriate file extension based on audio type
            let fileExtension = 'webm';
            let type = audioBlob.type ? audioBlob.type.toLowerCase() : '';
            
            // Use more reliable format detection
            if (metadata.isIOS) {
                // iOS devices should almost always use m4a/mp4 format for best compatibility
                fileExtension = 'm4a';
                type = 'audio/mp4';
                console.log("Using iOS-optimized audio format: audio/mp4 (.m4a)");
            } else if (metadata.isWhatsApp) {
                // Better detection for WhatsApp audio
                if (metadata.filename && metadata.filename.endsWith('.m4a')) {
                    // iOS WhatsApp uses m4a
                    fileExtension = 'm4a';
                    type = 'audio/mp4';
                } else if (metadata.filename && metadata.filename.endsWith('.opus')) {
                    // Android WhatsApp uses opus
                    fileExtension = 'opus';
                    type = 'audio/ogg; codecs=opus';
                } else {
                    // Default to ogg for other WhatsApp formats
                    fileExtension = 'ogg';
                    type = 'audio/ogg';
                }
            } else if (type.includes('mp4') || type.includes('m4a')) {
                fileExtension = 'mp4';
            } else if (type.includes('mp3') || type.includes('mpeg')) {
                fileExtension = 'mp3';
            } else if (type.includes('wav')) {
                fileExtension = 'wav';
            } else if (type.includes('aac')) {
                fileExtension = 'aac';
            } else if (type.includes('ogg') || type.includes('opus')) {
                fileExtension = 'ogg';
            } else if (metadata.filename) {
                // Try to get extension from filename if MIME type is unknown
                const nameParts = metadata.filename.split('.');
                if (nameParts.length > 1) {
                    const ext = nameParts[nameParts.length - 1].toLowerCase();
                    if (['mp3', 'wav', 'm4a', 'mp4', 'ogg', 'opus', 'aac'].includes(ext)) {
                        fileExtension = ext;
                    }
                }
            }
            
            const formData = new FormData();
            
            // Enhanced filename generation with more metadata
            const uniqueId = Date.now();
            let filename;
            
            if (metadata.isIOS) {
                // Use simpler filename pattern with clear format indication for diagnostic purposes
                const format = audioBlob.type.split('/')[1]?.split(';')[0] || 'audio';
                filename = `ios_whisper_${format}_${uniqueId}.${fileExtension}`;
                console.log(`Using diagnostic filename for iOS: ${filename}`);
            } else if (metadata.isWhatsApp) {
                const isIOSWhatsApp = metadata.filename && metadata.filename.endsWith('.m4a');
                filename = isIOSWhatsApp 
                    ? `whatsapp_ios_${uniqueId}.${fileExtension}`
                    : `whatsapp_${uniqueId}.${fileExtension}`;
            } else if (metadata.filename) {
                // Keep original filename but ensure the extension is correct
                const baseName = metadata.filename.split('.').slice(0, -1).join('.');
                filename = `${baseName}_${uniqueId}.${fileExtension}`;
            } else {
                filename = `recording_${uniqueId}.${fileExtension}`;
            }
                
            formData.append('file', audioBlob, filename);
            formData.append('model', 'whisper-1');
            
            // Request response_format=verbose_json to get word-level timestamps
            formData.append('response_format', 'verbose_json');
            
            // Add language parameter for better transcription (the source language to detect)
            const languageCode = language === 'pt-BR' ? 'pt' : 'en';
            formData.append('language', languageCode);
            
            // Add translation parameter if translation is enabled
            if (translateEnabled && translateTo) {
                console.log(`Adding translation to ${translateTo}`);
                formData.append('translate', 'true');
                // Note: With translate=true, the 'language' parameter still identifies the source language,
                // but Whisper will translate to English. We set translate=true only when needed.
            }
            
            console.log(`Sending request to Whisper API with filename: ${filename}, language: ${languageCode}, translate: ${translateEnabled}`);
            
            const timeoutMs = 60000;
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
            
            const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: formData,
                signal: controller.signal
            }).finally(() => clearTimeout(timeoutId));
            
            if (!response.ok) {
                const errorData = await response.json();
                console.error('Whisper API error:', errorData);
                
                // Store detailed error information
                this.transcriptionError = {
                    status: response.status,
                    statusText: response.statusText,
                    error: errorData.error,
                    fullError: errorData
                };
                
                // Create better error message
                const errorMessage = this.parseApiError(response, errorData);
                
                throw new Error(errorMessage);
            }
            
            const data = await response.json();
            console.log('Transcription successful with timestamps');
            
            // Store the segment data for subtitle generation
            this.lastTranscriptionSegments = data.segments || [];
            
            // Return the full text
            return data.text;
        } catch (error) {
            console.error('Error transcribing audio:', error);
            // Fallback for iOS: if transcription fails, use speech recognition text blocks
            if (metadata.isIOS) {
                const fallbackText = (this.speechRecognitionBlocks && this.speechRecognitionBlocks.length)
                    ? this.speechRecognitionBlocks.join(" ")
                    : "Fallback transcription not available.";
                return fallbackText + " (Warning: Could not save audio due to iOS issues.)";
            }
            throw error;
        }
    }
    
    // NEW: Helper method to get file extension from MIME type
    getExtensionForMimeType(mimeType) {
        if (mimeType.includes('wav')) return 'wav';
        if (mimeType.includes('mp4') || mimeType.includes('m4a')) return 'm4a';
        if (mimeType.includes('mp3') || mimeType.includes('mpeg')) return 'mp3';
        if (mimeType.includes('ogg')) return 'ogg';
        if (mimeType.includes('opus')) return 'opus';
        return 'audio';
    }
    
    // Get last transcription error details
    getLastErrorDetails() {
        return this.transcriptionError || { message: "No error information available" };
    }

    // New method to test API key and Whisper API access
    async testWhisperApiAccess(language = null) {
        if (!this.apiKey) {
            return { success: false, message: 'API key not set' };
        }
        
        // Get the current app language if not specified
        if (!language) {
            language = localStorage.getItem('echolife_language') || 'en-US';
        }
        
        try {
            // Create a simple, valid audio file instead of an empty one
            // This approach creates a minimal but valid audio file with a short beep
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const sampleRate = audioContext.sampleRate;
            const buffer = audioContext.createBuffer(1, sampleRate, sampleRate);
            
            // Fill buffer with a simple sine wave (short beep)
            const channelData = buffer.getChannelData(0);
            for (let i = 0; i < sampleRate * 0.5; i++) {
                // Create 0.5 second beep at 440Hz
                channelData[i] = Math.sin(i * Math.PI * 2 * 440 / sampleRate) * 0.5;
            }
            
            // Convert to WAV format which is better supported
            const wavBlob = await this.bufferToWav(buffer);
            
            // Test API connectivity with a minimal request instead of a full transcription
            const response = await fetch('https://api.openai.com/v1/models', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(`API connectivity issue: ${error.error?.message || response.statusText}`);
            }
            
            // Get success message in the current language
            const successMsg = language === 'pt-BR' ? 
                'API da OpenAI está acessível. O Whisper deve funcionar quando você gravar áudio.' : 
                'OpenAI API is accessible. Whisper should work when you record audio.';
            
            // If we get here, API access is good
            return { 
                success: true, 
                message: successMsg 
            };
        } catch (error) {
            const errorMsg = language === 'pt-BR' ? 
                `Teste de API falhou: ${error.message}` : 
                `API test failed: ${error.message}`;
                
            return { 
                success: false, 
                message: errorMsg, 
                error 
            };
        }
    }

    // Helper method to convert AudioBuffer to WAV format
    bufferToWav(buffer) {
        return new Promise((resolve) => {
            const length = buffer.length * buffer.numberOfChannels * 2;
            const view = new DataView(new ArrayBuffer(44 + length));
            
            // RIFF identifier
            writeString(view, 0, 'RIFF');
            // RIFF chunk length
            view.setUint32(4, 36 + length, true);
            // RIFF type
            writeString(view, 8, 'WAVE');
            // format chunk identifier
            writeString(view, 12, 'fmt ');
            // format chunk length
            view.setUint32(16, 16, true);
            // sample format (1 is PCM)
            view.setUint16(20, 1, true);
            // channel count
            view.setUint16(22, buffer.numberOfChannels, true);
            // sample rate
            view.setUint32(24, buffer.sampleRate, true);
            // byte rate (sample rate * block align)
            view.setUint32(28, buffer.sampleRate * buffer.numberOfChannels * 2, true);
            // block align (channel count * bytes per sample)
            view.setUint16(32, buffer.numberOfChannels * 2, true);
            // bits per sample
            view.setUint16(34, 16, true);
            // data chunk identifier
            writeString(view, 36, 'data');
            // data chunk length
            view.setUint32(40, length, true);
            
            // Write the PCM samples
            let offset = 44;
            for (let i = 0; i < buffer.length; i++) {
                for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
                    const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]));
                    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
                    offset += 2;
                }
            }
            
            // Create Blob and resolve
            const wavBlob = new Blob([view], { type: 'audio/wav' });
            resolve(wavBlob);
            
            function writeString(view, offset, string) {
                for (let i = 0; i < string.length; i++) {
                    view.setUint8(offset + i, string.charCodeAt(i));
                }
            }
        });
    }

    // Get subtitle data from the last transcription
    getSubtitleData() {
        if (!this.lastTranscriptionSegments || this.lastTranscriptionSegments.length === 0) {
            // Fallback if no segments data is available
            return null;
        }
        
        // Convert Whisper segments to our subtitle format
        return this.lastTranscriptionSegments.map(segment => {
            return {
                startTime: segment.start,
                endTime: segment.end,
                text: segment.text.trim()
            };
        });
    }
}

// Create a global instance of the transcription service
const transcriptionService = new WhisperTranscriptionService();

// Make it available on window for better accessibility
window.transcriptionService = transcriptionService;
