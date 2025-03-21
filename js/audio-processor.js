/**
 * Audio Processor Module for EchoLife
 * Handles audio quality enhancement, level detection, and processing
 */

class AudioProcessor {
    constructor() {
        // Audio processing parameters
        this.targetSampleRate = 16000; // Whisper prefers 16kHz
        this.noiseReductionLevel = 0.1; // Default noise reduction level (0-1)
        
        // Audio detection settings - INCREASED for better Whisper sensitivity
        this.silenceThreshold = 0.008; // Reduced RMS threshold for silence detection
        this.minAudioLevel = 0.003; // Reduced minimum level to consider as valid audio
        
        // Gain control parameters - INCREASED for better Whisper performance
        this.defaultGain = 1.5; // Increased default gain
        this.maxGain = 8.0;    // Increased max gain for very quiet recordings
        this.minGain = 0.5;
        
        // Volume feedback data
        this.lastAnalyzedLevel = 0;
        this.volumeHistory = []; // Store recent volume levels for feedback
    }
    
    /**
     * Detect if audio contains speech or is mostly silent
     * @param {Blob} audioBlob - The audio blob to analyze
     * @returns {Promise<boolean>} - Whether speech was detected
     */
    async detectSpeech(audioBlob) {
        if (!audioBlob || audioBlob.size < 100) {
            console.warn("Audio blob too small for speech detection");
            return false;
        }
        
        try {
            // Calculate RMS (Root Mean Square) of audio to detect speech presence
            const audioBuffer = await this.decodeAudioData(audioBlob);
            if (!audioBuffer) return false;
            
            const rmsValue = this.calculateRMS(audioBuffer);
            console.log(`Audio level detection - RMS value: ${rmsValue.toFixed(4)}, threshold: ${this.silenceThreshold}`);
            
            // Return true if RMS is above threshold (speech present)
            return rmsValue > this.silenceThreshold;
        } catch (error) {
            console.error("Error in speech detection:", error);
            return true; // Return true by default to avoid false negatives
        }
    }
    
    /**
     * Calculate RMS (Root Mean Square) of audio buffer
     * @param {AudioBuffer} audioBuffer - The audio buffer to analyze
     * @returns {number} - RMS value between 0-1
     */
    calculateRMS(audioBuffer) {
        if (!audioBuffer || !audioBuffer.getChannelData) return 0;
        
        // Get audio data from first channel
        const samples = audioBuffer.getChannelData(0);
        let sum = 0;
        let sampleCount = 0;
        
        // Sample every 1000th sample for efficiency with large files
        const sampleStep = Math.max(1, Math.floor(samples.length / 1000));
        
        for (let i = 0; i < samples.length; i += sampleStep) {
            // Square the sample (after converting -1.0 to 1.0 range to positive)
            sum += samples[i] * samples[i];
            sampleCount++;
        }
        
        // Calculate RMS (Root Mean Square)
        return Math.sqrt(sum / sampleCount);
    }
    
    /**
     * Decode audio data from blob
     * @param {Blob} audioBlob - Audio blob to decode
     * @returns {Promise<AudioBuffer>} - Decoded audio buffer
     */
    async decodeAudioData(audioBlob) {
        if (!audioBlob) return null;
        
        try {
            const arrayBuffer = await audioBlob.arrayBuffer();
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            const audioContext = new AudioContext();
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            audioContext.close();
            return audioBuffer;
        } catch (error) {
            console.error("Error decoding audio data:", error);
            return null;
        }
    }
    
    /**
     * Enhance audio quality for better transcription
     * @param {Blob} audioBlob - Original audio blob
     * @returns {Promise<Blob>} - Enhanced audio blob
     */
    async enhanceAudio(audioBlob) {
        if (!audioBlob || audioBlob.size < 100) {
            console.warn("Audio blob too small for enhancement");
            return audioBlob;
        }
        
        try {
            console.log("Starting audio quality enhancement");
            
            // Create audio context with target sample rate
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            const audioContext = new AudioContext({ sampleRate: this.targetSampleRate });
            
            // Decode the audio
            const arrayBuffer = await audioBlob.arrayBuffer();
            let audioBuffer;
            
            try {
                audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            } catch (decodeError) {
                console.warn("Standard decode failed, trying alternate approach:", decodeError);
                
                // For problematic formats (like WebM/Opus), try a different approach
                // Create a temporary audio element to help with decoding
                const audioElement = new Audio();
                const audioUrl = URL.createObjectURL(audioBlob);
                audioElement.src = audioUrl;
                
                // Wait for the audio to be loaded
                await new Promise((resolve, reject) => {
                    audioElement.oncanplaythrough = resolve;
                    audioElement.onerror = reject;
                    // Set timeout to avoid hanging
                    setTimeout(reject, 5000);
                });
                
                // Create a media element source
                const source = audioContext.createMediaElementSource(audioElement);
                
                // Create an offline context to capture the audio
                const offlineCtx = new OfflineAudioContext(
                    1, // mono
                    this.targetSampleRate * (audioElement.duration || 3), 
                    this.targetSampleRate
                );
                
                // Connect source to offline context
                const offlineSource = offlineCtx.createMediaElementSource(audioElement);
                offlineSource.connect(offlineCtx.destination);
                
                // Play the audio and start rendering
                audioElement.play();
                audioBuffer = await offlineCtx.startRendering();
                
                // Clean up
                audioElement.pause();
                URL.revokeObjectURL(audioUrl);
            }
            
            // Create a new offline context for processing
            const offlineContext = new OfflineAudioContext(
                audioBuffer.numberOfChannels,
                audioBuffer.length,
                this.targetSampleRate
            );
            
            // Create source from the original buffer
            const source = offlineContext.createBufferSource();
            source.buffer = audioBuffer;
            
            // Create audio processing nodes
            
            // 1. High-pass filter to reduce low-frequency noise (stronger filtering)
            const highpassFilter = offlineContext.createBiquadFilter();
            highpassFilter.type = 'highpass';
            highpassFilter.frequency.value = 100; // Increased from 80Hz to 100Hz
            
            // 2. Low-pass filter to reduce high-frequency noise
            const lowpassFilter = offlineContext.createBiquadFilter();
            lowpassFilter.type = 'lowpass';
            lowpassFilter.frequency.value = 8000; // Focus on speech frequencies
            
            // 3. Compressor to normalize levels (more aggressive settings)
            const compressor = offlineContext.createDynamicsCompressor();
            compressor.threshold.value = -60; // Lower threshold to catch more quiet sounds
            compressor.knee.value = 30;      // Wider knee for smoother transition
            compressor.ratio.value = 15;     // Higher ratio for stronger compression
            compressor.attack.value = 0;
            compressor.release.value = 0.25;
            
            // 4. Gain node to boost volume if needed
            const gainNode = offlineContext.createGain();
            
            // Check if audio needs amplification
            const currentLevel = this.calculateRMS(audioBuffer);
            this.lastAnalyzedLevel = currentLevel; // Store for feedback
            
            // INCREASED target level for Whisper API (from 0.2 to 0.3)
            const targetLevel = 0.3; // Higher target level for better transcription
            
            if (currentLevel < targetLevel) {
                // Calculate gain to reach target level, with limit
                // Use more aggressive scaling for very quiet audio
                let idealGain;
                if (currentLevel < 0.05) {
                    // For very quiet audio, apply even higher gain
                    idealGain = Math.min(targetLevel / Math.max(currentLevel, 0.005), this.maxGain);
                } else {
                    idealGain = Math.min(targetLevel / Math.max(currentLevel, 0.01), this.maxGain);
                }
                
                gainNode.gain.value = idealGain;
                console.log(`Enhancing audio - applying gain: ${idealGain.toFixed(2)} (level: ${currentLevel.toFixed(4)} → target: ${targetLevel})`);
            } else {
                // No gain needed
                gainNode.gain.value = 1.0;
                console.log(`Audio level already good: ${currentLevel.toFixed(4)}`);
            }
            
            // Connect the nodes: source → highpass → lowpass → compressor → gain → destination
            source.connect(highpassFilter);
            highpassFilter.connect(lowpassFilter);
            lowpassFilter.connect(compressor);
            compressor.connect(gainNode);
            gainNode.connect(offlineContext.destination);
            
            // Start source and render
            source.start(0);
            const enhancedBuffer = await offlineContext.startRendering();
            
            // Convert to WAV blob
            const wavBlob = this.audioBufferToWav(enhancedBuffer);
            
            // Clean up
            audioContext.close();
            
            // Verify the final level after enhancement
            const finalLevel = this.calculateRMS(enhancedBuffer);
            console.log(`Audio enhancement complete: ${wavBlob.size} bytes. Level before: ${currentLevel.toFixed(4)}, after: ${finalLevel.toFixed(4)}`);
            
            return wavBlob;
        } catch (error) {
            console.error("Error enhancing audio:", error);
            return audioBlob; // Return original on error
        }
    }
    
    /**
     * Convert AudioBuffer to WAV format blob
     * @param {AudioBuffer} audioBuffer - Audio buffer to convert
     * @returns {Blob} - WAV format blob
     */
    audioBufferToWav(audioBuffer) {
        const numOfChannels = audioBuffer.numberOfChannels;
        const length = audioBuffer.length * numOfChannels * 2; // 16-bit samples (2 bytes)
        const buffer = new ArrayBuffer(44 + length); // WAV header (44 bytes) + data
        const view = new DataView(buffer);
        
        // Write WAV header
        // "RIFF" chunk descriptor
        this.writeString(view, 0, 'RIFF');
        view.setUint32(4, 36 + length, true);
        this.writeString(view, 8, 'WAVE');
        
        // "fmt " sub-chunk
        this.writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true); // Subchunk1Size
        view.setUint16(20, 1, true);  // AudioFormat (PCM)
        view.setUint16(22, numOfChannels, true); // NumChannels
        view.setUint32(24, audioBuffer.sampleRate, true); // SampleRate
        view.setUint32(28, audioBuffer.sampleRate * numOfChannels * 2, true); // ByteRate
        view.setUint16(32, numOfChannels * 2, true); // BlockAlign
        view.setUint16(34, 16, true); // BitsPerSample
        
        // "data" sub-chunk
        this.writeString(view, 36, 'data');
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
        
        return new Blob([buffer], { type: 'audio/wav' });
    }
    
    /**
     * Helper to write string to DataView
     */
    writeString(view, offset, string) {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    }
    
    /**
     * Create silent WAV file of specified duration
     * @param {number} duration - Duration in seconds
     * @returns {Promise<Blob>} - WAV blob
     */
    createSilentWav(duration = 1.0) {
        const sampleRate = 16000;
        const numSamples = Math.floor(sampleRate * duration);
        
        // Create AudioBuffer with silence
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        const audioContext = new AudioContext({ sampleRate });
        const silentBuffer = audioContext.createBuffer(1, numSamples, sampleRate);
        
        // Fill with zeros (silence)
        const samples = silentBuffer.getChannelData(0);
        for (let i = 0; i < numSamples; i++) {
            samples[i] = 0.0;
        }
        
        // Convert to WAV
        const wavBlob = this.audioBufferToWav(silentBuffer);
        audioContext.close();
        
        return wavBlob;
    }
    
    /**
     * Create WAV file with low-volume white noise
     * @param {number} duration - Duration in seconds
     * @param {number} volume - Volume level (0.0 to 1.0)
     * @returns {Promise<Blob>} - WAV blob
     */
    createNoiseWav(duration = 1.0, volume = 0.1) {
        const sampleRate = 16000;
        const numSamples = Math.floor(sampleRate * duration);
        
        // Create AudioBuffer with noise
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        const audioContext = new AudioContext({ sampleRate });
        const noiseBuffer = audioContext.createBuffer(1, numSamples, sampleRate);
        
        // Fill with random values (white noise)
        const samples = noiseBuffer.getChannelData(0);
        for (let i = 0; i < numSamples; i++) {
            samples[i] = (Math.random() * 2 - 1) * volume;
        }
        
        // Convert to WAV
        const wavBlob = this.audioBufferToWav(noiseBuffer);
        audioContext.close();
        
        return wavBlob;
    }
    
    /**
     * Analyze audio and return detailed information
     * @param {Blob} audioBlob - Audio blob to analyze
     * @returns {Promise<Object>} - Audio analysis results
     */
    async analyzeAudio(audioBlob) {
        if (!audioBlob || audioBlob.size < 100) {
            return {
                duration: 0,
                sampleRate: 0,
                channels: 0,
                rmsLevel: 0,
                hasSpeech: false,
                format: audioBlob ? audioBlob.type : 'unknown',
                size: audioBlob ? audioBlob.size : 0
            };
        }
        
        try {
            const audioBuffer = await this.decodeAudioData(audioBlob);
            if (!audioBuffer) throw new Error("Failed to decode audio");
            
            const rmsLevel = this.calculateRMS(audioBuffer);
            const hasSpeech = rmsLevel > this.silenceThreshold;
            
            return {
                duration: audioBuffer.duration,
                sampleRate: audioBuffer.sampleRate,
                channels: audioBuffer.numberOfChannels,
                rmsLevel: rmsLevel,
                hasSpeech: hasSpeech,
                format: audioBlob.type,
                size: audioBlob.size
            };
        } catch (error) {
            console.error("Error analyzing audio:", error);
            return {
                error: error.message,
                format: audioBlob.type,
                size: audioBlob.size,
                hasSpeech: true // Assume speech present on error for safety
            };
        }
    }
    
    /**
     * Add a volume level reading to the history
     * @param {number} level - Volume level (0-1)
     */
    addVolumeReading(level) {
        // Keep last 10 readings
        if (this.volumeHistory.length >= 10) {
            this.volumeHistory.shift();
        }
        this.volumeHistory.push(level);
    }
    
    /**
     * Get volume feedback for the user
     * @returns {Object} Feedback object with level and status
     */
    getVolumeFeedback() {
        // Get average of last readings
        let avgLevel = 0;
        if (this.volumeHistory.length > 0) {
            avgLevel = this.volumeHistory.reduce((sum, val) => sum + val, 0) / this.volumeHistory.length;
        } else if (this.lastAnalyzedLevel > 0) {
            // Use last analyzed level if no history
            avgLevel = this.lastAnalyzedLevel;
        }
        
        // Determine status
        let status = 'normal';
        let message = 'Audio level is good';
        
        if (avgLevel < 0.01) {
            status = 'too-low';
            message = 'Audio level is too low - please speak louder';
        } else if (avgLevel < 0.05) {
            status = 'low';
            message = 'Audio level is low - consider speaking louder';
        } else if (avgLevel > 0.8) {
            status = 'too-high';
            message = 'Audio level is too high - please speak softer';
        }
        
        return {
            level: avgLevel,
            status: status,
            message: message
        };
    }
}

// Create a global instance of the audio processor
const audioProcessor = new AudioProcessor();

// Make it globally available
window.audioProcessor = audioProcessor;
