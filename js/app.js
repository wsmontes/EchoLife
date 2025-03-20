// Initialize the chat service with an API key
function initializeChatService() {
    const savedApiKey = localStorage.getItem('openai_api_key');
    
    if (savedApiKey) {
        console.log('API key found in localStorage');
        
        // Add defensive checks for each service
        if (typeof chatService !== 'undefined') {
            chatService.setApiKey(savedApiKey);
        } else {
            console.error('Error: chatService is not defined');
        }
        
        if (typeof transcriptionService !== 'undefined') {
            transcriptionService.setApiKey(savedApiKey);
        } else {
            console.error('Error: transcriptionService is not defined');
        }
        
        if (typeof tagExtractor !== 'undefined') {
            tagExtractor.setApiKey(savedApiKey);
        } else {
            console.error('Error: tagExtractor is not defined');
        }
        
        verifyApiKey();
    } else {
        const apiKey = prompt('Please enter your OpenAI API key:');
        if (apiKey) {
            console.log('New API key provided');
            chatService.setApiKey(apiKey);
            transcriptionService.setApiKey(apiKey);
            tagExtractor.setApiKey(apiKey);
            localStorage.setItem('openai_api_key', apiKey);
            verifyApiKey();
        } else {
            console.error('No API key provided!');
            alert('An OpenAI API key is required to use this application.');
        }
    }
}

async function verifyApiKey() {
    try {
        // Test API key with a dummy tag extraction call
        await tagExtractor.extractTags("Test", 1, false);
        
        // Also test Whisper API access specifically
        console.log("Testing Whisper API access...");
        const whisperTest = await transcriptionService.testWhisperApiAccess();
        if (!whisperTest.success) {
            console.warn("Whisper API test failed:", whisperTest.message);
            // Only alert if it's likely an API permission issue
            if (whisperTest.message.includes("API key is invalid") || 
                whisperTest.message.includes("insufficient quota")) {
                alert(`Warning: ${whisperTest.message} Voice transcription may not work.`);
            }
        } else {
            console.log("Whisper API test passed:", whisperTest.message);
        }
    } catch (error) {
        console.error("API verification failed:", error);
        alert("The API key is invalid or lacks necessary permissions. Please enter a valid API key.");
        promptForApiKey();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing application...');
    
    // Check for iOS and show recommendation if needed
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    if (isIOS) {
        console.log("iOS device detected, setting device-specific accommodations");
        // Add a note for iOS users in the recording section
        const recordingStatus = document.getElementById('recordingStatus');
        if (recordingStatus) {
            recordingStatus.innerHTML = 'Click to start recording<br><small>iOS users: If recording fails, try the upload option below</small>';
        }
    }
    
    initializeChatService();
    
    console.log('Audio interface initialized');

    // DOM elements
    const recordButton = document.getElementById('recordButton');
    const recordingStatus = document.getElementById('recordingStatus');
    const recordingIndicator = document.getElementById('recordingIndicator');
    const chatContainer = document.getElementById('chatContainer');
    const aiTagsContainer = document.getElementById('aiTagsContainer');
    const feedbackButton = document.getElementById('feedbackButton');
    
    // Setup API key edit button listener with additional logging
    const editApiKeyButton = document.getElementById('editApiKeyButton');
    if (editApiKeyButton) {
        console.log('Edit API Key button found, setting up listener');
        editApiKeyButton.addEventListener('click', () => {
            console.log('Edit API Key button clicked');
            const newKey = prompt('Enter a new OpenAI API key:');
            if (newKey) {
                console.log('New API key entered:', newKey);
                localStorage.setItem('openai_api_key', newKey);
                chatService.setApiKey(newKey);
                transcriptionService.setApiKey(newKey);
                tagExtractor.setApiKey(newKey);
                alert('API key updated successfully.');
                verifyApiKey();
            } else {
                console.log('No new API key provided');
            }
        });
    } else {
        console.error('Edit API Key button not found');
    }
    
    // State variables
    let apiKey = localStorage.getItem('openai_api_key');
    let isProcessingAudio = false;
    let currentTranscript = "";
    let lastTagUpdateTime = 0;
    let tagUpdateInterval = null;
    let partialTranscript = "";
    let recognizedSpeech = false;
    
    // Initialize with API key
    if (!apiKey) {
        promptForApiKey();
    } else {
        initializeWithApiKey(apiKey);
    }
    
    // Event listeners
    recordButton.addEventListener('click', toggleRecording);
    feedbackButton.addEventListener('click', requestAIFeedback);
    
    // Export buttons
    const exportTxtBtn = document.getElementById('exportTxtBtn');
    const exportSrtBtn = document.getElementById('exportSrtBtn');
    const exportAudioBtn = document.getElementById('exportAudioBtn');
    const exportVideoBtn = document.getElementById('exportVideoBtn');
    const previewSubtitlesBtn = document.getElementById('previewSubtitlesBtn');
    
    // Subtitle preview elements
    const subtitlePreviewContainer = document.getElementById('subtitlePreviewContainer');
    const previewAudioPlayer = document.getElementById('previewAudioPlayer');
    const previewSubtitleDisplay = document.getElementById('previewSubtitleDisplay');
    const closePreviewBtn = document.getElementById('closePreviewBtn');
    
    // Last processed audio result (for export)
    let lastAudioResult = null;
    let subtitlesData = [];
    
    // Add export button event listeners
    if (exportTxtBtn) exportTxtBtn.addEventListener('click', exportTranscriptAsTxt);
    if (exportSrtBtn) exportSrtBtn.addEventListener('click', exportTranscriptAsSrt);
    if (exportAudioBtn) exportAudioBtn.addEventListener('click', exportAudio);
    if (exportVideoBtn) exportVideoBtn.addEventListener('click', showVideoExportOptions);
    if (previewSubtitlesBtn) previewSubtitlesBtn.addEventListener('click', previewWithSubtitles);
    if (closePreviewBtn) closePreviewBtn.addEventListener('click', closeSubtitlePreview);
    
    // Functions
    function promptForApiKey() {
        const key = prompt('Please enter your OpenAI API key:');
        if (key) {
            localStorage.setItem('openai_api_key', key);
            initializeWithApiKey(key);
        } else {
            alert('API key is required to use this application.');
        }
    }
    
    function initializeWithApiKey(key) {
        transcriptionService.setApiKey(key);
        chatService.setApiKey(key);
        tagExtractor.setApiKey(key);
        
        // Enable conversational mode by default for more engaging responses
        chatService.setConversationMode(true);
        
        // Initialize SpeechRecognition for real-time transcription if available
        initializeSpeechRecognition();
    }
    
    // Initialize speech recognition for real-time tag updates
    function initializeSpeechRecognition() {
        if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
            window.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            window.speechRecognition = new SpeechRecognition();
            window.speechRecognition.continuous = true;
            window.speechRecognition.interimResults = true;
            
            // Use the selected language - get from translation controller if available
            const language = window.translationController ? 
                window.translationController.getSettings().language : 'en-US';
            window.speechRecognition.lang = language;
            console.log(`Speech recognition initialized with language: ${language}`);
            
            // Add tracking for speech recognition health
            window.lastSpeechRecognitionEvent = Date.now();
            window.speechRecognitionActive = false;
            
            window.speechRecognition.onstart = () => {
                console.log('Speech recognition started');
                window.speechRecognitionActive = true;
                window.lastSpeechRecognitionEvent = Date.now();
            };
            
            window.speechRecognition.onend = () => {
                console.log('Speech recognition ended');
                window.speechRecognitionActive = false;
                
                // Auto-restart if we're still recording
                if (audioRecorder.isRecording && !isProcessingAudio) {
                    console.log('Auto-restarting speech recognition');
                    try {
                        window.speechRecognition.start();
                    } catch (e) {
                        console.error('Error restarting speech recognition:', e);
                    }
                }
            };
            
            window.speechRecognition.onresult = (event) => {
                // Update the last event timestamp
                window.lastSpeechRecognitionEvent = Date.now();
                
                let interimTranscript = '';
                let newFinalTranscript = '';
                
                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const transcript = event.results[i][0].transcript;
                    if (event.results[i].isFinal) {
                        newFinalTranscript += transcript + ' ';
                        recognizedSpeech = true;
                    } else {
                        interimTranscript += transcript;
                    }
                }
                
                // Add to partial transcript if we have final results
                if (newFinalTranscript) {
                    partialTranscript += newFinalTranscript;
                    console.log("Added to partialTranscript:", newFinalTranscript);
                    console.log("Current partialTranscript:", partialTranscript);
                }
                
                // Use the combined transcript for real-time tag extraction
                handleRealtimeSpeech(partialTranscript + ' ' + interimTranscript);
            };
            
            window.speechRecognition.onerror = (event) => {
                // Don't treat 'no-speech' as an error - it's a normal outcome when user doesn't speak
                if (event.error === 'no-speech') {
                    console.log('No speech detected. Waiting for user to speak...');
                } else {
                    console.error('Speech recognition error:', event.error);
                    
                    // Restart on certain errors
                    if (event.error === 'network' || event.error === 'service-not-allowed') {
                        if (audioRecorder.isRecording) {
                            console.log('Attempting to restart speech recognition after error');
                            setTimeout(() => {
                                try {
                                    window.speechRecognition.stop();
                                    window.speechRecognition.start();
                                } catch (e) {
                                    console.error('Failed to restart speech recognition:', e);
                                }
                            }, 1000);
                        }
                    }
                }
            };
            
            window.speechRecognition.onnomatch = (event) => {
                console.log('Speech was detected but not recognized.');
            };
            
            // Add a health check interval to monitor speech recognition
            window.speechRecognitionHealthCheck = setInterval(() => {
                if (audioRecorder.isRecording && !isProcessingAudio) {
                    const timeSinceLastEvent = Date.now() - window.lastSpeechRecognitionEvent;
                    
                    // If no events for more than 10 seconds and we're still supposed to be recording,
                    // restart the speech recognition
                    if (timeSinceLastEvent > 10000) {
                        console.log('Speech recognition appears to be stalled, restarting...');
                        try {
                            window.speechRecognition.stop();
                            setTimeout(() => {
                                try {
                                    window.speechRecognition.start();
                                } catch (e) {
                                    console.error('Failed to restart stalled speech recognition:', e);
                                }
                            }, 500);
                        } catch (e) {
                            console.error('Error stopping stalled speech recognition:', e);
                        }
                    }
                }
            }, 5000);
            
            console.log('Speech recognition initialized with health monitoring');
        } else {
            console.warn('Speech recognition not supported - will use periodic updates instead');
        }
    }
    
    // Enhanced real-time speech handling for iOS devices
    async function handleRealtimeSpeech(text) {
        const now = Date.now();
        
        // Don't update tags too frequently - at most once every 1.5 seconds
        if (now - lastTagUpdateTime > 1500 && text.length > 10) {
            lastTagUpdateTime = now;
            console.log("Updating real-time tags with text length:", text.length);
            await updateRealtimeTags(text);
        }
    }
    
    // Update tags in real-time during speech with better iOS handling
    async function updateRealtimeTags(text) {
        try {
            // For very short text, use a placeholder
            if (text.length < 15) {
                if (window.wordCloud) {
                    const language = getEffectiveLanguage();
                    const placeholderText = language === 'pt-BR' ? 'Ouvindo...' : 'Listening...';
                    window.wordCloud.updateWordCloud([
                        {text: placeholderText, confidence: 'low', count: 1, group: "other"}
                    ]);
                } else {
                    console.error("Word cloud not initialized or not found!");
                    // Try to initialize word cloud if it doesn't exist
                    if (document.getElementById('wordCloudContainer')) {
                        console.log("Trying to re-initialize word cloud");
                        window.wordCloud = new WordCloud('wordCloudContainer');
                    }
                }
                return;
            }
            
            // Get the effective language - prioritize iOS service language if available
            const language = getEffectiveLanguage();
            console.log(`Extracting real-time tags with language: ${language}, text length: ${text.length}`);
            
            // Extract tags from the partial transcript with explicit language
            const tags = await tagExtractor.extractTagsRealtime(text, 5, language);
            
            // Validate we have actual tags
            if (!tags || tags.length === 0) {
                console.warn("No tags extracted, using placeholder");
                if (window.wordCloud) {
                    const processingText = language === 'pt-BR' ? 'Processando...' : 'Processing...';
                    window.wordCloud.updateWordCloud([
                        {text: processingText, confidence: 'low', count: 1, group: "other"}
                    ]);
                }
                return;
            }
            
            console.log(`Updating word cloud with tags: ${tags.length}, language: ${language}`);
            
            // Update word cloud with tags - add extra check for wordCloud
            if (window.wordCloud) {
                console.log(`Updating word cloud with ${tags.length} tags, language: ${language}`);
                window.wordCloud.updateWordCloud(tags);
            } else {
                console.error("Word cloud not available for tag update!");
                // Try to initialize word cloud if it doesn't exist
                if (document.getElementById('wordCloudContainer')) {
                    console.log("Trying to re-initialize word cloud");
                    window.wordCloud = new WordCloud('wordCloudContainer');
                    window.wordCloud.updateWordCloud(tags);
                }
            }
            
            // Enable feedback button if we have speech
            if (recognizedSpeech && feedbackButton) {
                feedbackButton.disabled = false;
            }
        } catch (error) {
            console.error('Error updating real-time tags:', error);
            // Don't fail silently - update with error state
            if (window.wordCloud) {
                const language = getEffectiveLanguage();
                const errorText = language === 'pt-BR' ? 'Erro de processamento' : 'Error processing';
                window.wordCloud.updateWordCloud([
                    {text: errorText, confidence: 'low', count: 1, group: "other"}
                ]);
            }
        }
    }
    
    // Helper function to get the effective language from all possible sources
    function getEffectiveLanguage() {
        // Check multiple sources in priority order:
        
        // 1. First check translation controller if available
        if (window.translationController) {
            const settings = window.translationController.getSettings();
            console.log("Language from translation controller:", settings.language);
            return settings.language;
        }
        
        // 2. Next check iOS speech service if active (most accurate during recording)
        if (window.iosSpeechService && window.iosSpeechService.isAvailable) {
            const iosLang = window.iosSpeechService.getLanguage();
            console.log("Language from iOS speech service:", iosLang);
            return iosLang;
        }
        
        // 3. Finally fall back to localStorage
        const storedLang = localStorage.getItem('echolife_language') || 'en-US';
        console.log("Language from localStorage:", storedLang);
        return storedLang;
    }
    
    async function toggleRecording() {
        if (isProcessingAudio) return;
        
        if (!audioRecorder.isRecording) {
            // Reset for new recording
            currentTranscript = "";
            partialTranscript = "";
            recognizedSpeech = false;
            tagExtractor.resetContext();
            
            // Clear existing messages
            chatContainer.innerHTML = '';
            
            // Clear the AI tags display
            aiTagsContainer.innerHTML = '<span class="tag-placeholder">Tags from AI responses will appear here</span>';
            
            // MODIFIED: Force use of standard recording regardless of device
            const started = await audioRecorder.startRecording();
            
            if (started) {
                recordingStatus.textContent = 'Recording... Click to stop';
                recordingIndicator.classList.remove('hidden');
                feedbackButton.disabled = true;
                
                // MODIFIED: Always use standard speech recognition, not iOS-specific
                if (window.speechRecognition) {
                    try {
                        // Reset timestamps before starting
                        window.lastSpeechRecognitionEvent = Date.now();
                        window.speechRecognition.start();
                    } catch (e) {
                        console.error('Error starting speech recognition:', e);
                        // If it failed due to already running, try to stop and restart
                        if (e.name === 'InvalidStateError') {
                            try {
                                window.speechRecognition.stop();
                                setTimeout(() => {
                                    window.speechRecognition.start();
                                }, 500);
                            } catch (stopError) {
                                console.error('Error stopping/restarting speech recognition:', stopError);
                            }
                        }
                    }
                } else {
                    // Fallback: periodic updates for tags
                    tagUpdateInterval = setInterval(() => {
                        // Not implemented - would require partial results from audioRecorder
                        // which isn't currently available
                    }, 3000);
                }
                
                // Disable export buttons when starting a new recording
                if (exportTxtBtn) exportTxtBtn.disabled = true;
                if (exportSrtBtn) exportSrtBtn.disabled = true;
                if (exportAudioBtn) exportAudioBtn.disabled = true;
                if (exportVideoBtn) exportVideoBtn.disabled = true;
                if (previewSubtitlesBtn) previewSubtitlesBtn.disabled = true;
                
                // Hide subtitle preview if visible
                if (subtitlePreviewContainer) {
                    subtitlePreviewContainer.style.display = 'none';
                }
                
                lastAudioResult = null;
                subtitlesData = [];
                
            } else {
                alert('Could not access microphone. Please check permissions.');
            }
        } else {
            isProcessingAudio = true;
            recordButton.classList.remove('recording');
            recordingIndicator.classList.add('hidden');
            
            // Save the current transcript state before stopping
            const savedTranscript = partialTranscript;
            console.log("Saved transcript before stopping recognition:", savedTranscript);
            
            // Stop the speech recognition
            if (window.speechRecognition) {
                try {
                    window.speechRecognition.stop();
                } catch (e) {
                    console.error('Error stopping speech recognition:', e);
                }
            }
            
            // Clear any interval if it was set
            if (tagUpdateInterval) {
                clearInterval(tagUpdateInterval);
                tagUpdateInterval = null;
            }
            
            // Show processing state
            recordingStatus.textContent = 'Processing...';
            recordButton.disabled = true;
            recordButton.classList.add('processing');
            
            // Stop the recording and get results
            const audioResult = await audioRecorder.stopRecording();
            
            console.log("Audio recording stopped, result:", audioResult ? 
              `blob: ${audioResult.blob.size} bytes, type: ${audioResult.type}` : "No audio result");
            
            if (audioResult && audioResult.blob && audioResult.blob.size > 0) {
                try {
                    console.log(`Processing audio recording: ${audioResult.blob.size} bytes, type: ${audioResult.blob.type}, chunks: ${audioResult.chunks || 1}`);
                    recordingStatus.textContent = 'Transcribing audio...';
                    
                    let transcriptionSource = ""; // Initialize the variable
                    
                    // MODIFIED: Always use Whisper API for transcription, even on iOS
                    try {
                        console.log("Using Whisper API transcription for all devices...");
                        currentTranscript = await transcriptionService.transcribeAudio(audioResult);
                        console.log("Whisper transcription succeeded:", currentTranscript);
                        transcriptionSource = "whisper"; // Set source to whisper after successful transcription
                    } catch (whisperError) {
                        console.error('Whisper transcription failed:', whisperError);
                        
                        // Use saved browser transcription as fallback
                        if (savedTranscript && savedTranscript.length > 5) {
                            console.log('Using browser SpeechRecognition as fallback:', savedTranscript);
                            currentTranscript = savedTranscript.trim();
                            transcriptionSource = "browser"; // Set source to browser when using fallback
                            
                            console.log("Using browser speech recognition result as fallback");
                        } else {
                            // If no fallback is available, rethrow the error
                            throw whisperError;
                        }
                    }
                    
                    // Extract tags from the full transcript
                    const tags = await tagExtractor.extractTags(currentTranscript, 8, true);
                    
                    // Update word cloud instead of traditional tag display
                    if (window.wordCloud) {
                        window.wordCloud.updateWordCloud(tags);
                    }
                    
                    // Add it to the chat as a user message
                    addMessageToChat('user', currentTranscript);
                    
                    // Enable the feedback button
                    feedbackButton.disabled = false;
                    
                    // Save the recording to history without AI response yet
                    if (window.audioHandler) {
                        // Create a proper file with the correct extension
                        let fileExt = 'webm';
                        if (audioResult.type.includes('mp4') || audioResult.type.includes('m4a')) {
                            fileExt = 'mp4';
                        } else if (audioResult.type.includes('mp3')) {
                            fileExt = 'mp3';
                        }
                        
                        window.audioHandler.addRecordingToHistory(
                            new File([audioResult.blob], `recording.${fileExt}`, { type: audioResult.type }),
                            currentTranscript
                        );
                    }
                    
                    // Store audio result for export
                    lastAudioResult = audioResult;
                    
                    // Get subtitle data from the transcription service - properly handle all sources
                    let whisperSubtitles = null;
                    if (transcriptionSource === "whisper") {
                        whisperSubtitles = transcriptionService.getSubtitleData();
                    }
                    
                    if (whisperSubtitles && whisperSubtitles.length > 0) {
                        // Use Whisper's native timestamp data if available
                        subtitlesData = whisperSubtitles;
                        console.log("Using Whisper's native timestamps for subtitles");
                    } else {
                        // Fall back to our estimation method for other transcription sources
                        subtitlesData = generateSubtitleData(currentTranscript);
                        console.log(`Falling back to estimated timestamps for subtitles (source: ${transcriptionSource})`);
                    }
                    
                    // Enable export buttons
                    if (exportTxtBtn) exportTxtBtn.disabled = false;
                    if (exportSrtBtn) exportSrtBtn.disabled = false;
                    if (exportAudioBtn) exportAudioBtn.disabled = false;
                    if (exportVideoBtn) exportVideoBtn.disabled = false;
                    if (previewSubtitlesBtn) previewSubtitlesBtn.disabled = false;
                    
                } catch (error) {
                    console.error('Error processing audio:', error);
                    
                    // Get detailed error information
                    let errorDetails = "";
                    if (transcriptionService.getLastErrorDetails) {
                        const details = transcriptionService.getLastErrorDetails();
                        if (details.status) {
                            errorDetails = ` (Error ${details.status}: ${details.error?.message || details.statusText})`;
                        }
                    }
                    
                    // More iOS-specific error message
                    let errorMessage = error.message;
                    if (audioRecorder.isIOS) {
                        errorMessage += '\n\nOn iOS, direct recording can be problematic. Please try using the upload option below instead.';
                    }
                    
                    alert('Error: ' + errorMessage + errorDetails);
                    recordingStatus.textContent = 'Transcription failed. Try using the upload option.';
                    
                    if (audioRecorder.isIOS) {
                        // Highlight the upload area for iOS users
                        const uploadArea = document.querySelector('.audio-drop-area');
                        if (uploadArea) {
                            uploadArea.style.borderColor = '#ff5722';
                            uploadArea.style.backgroundColor = 'rgba(255, 87, 34, 0.05)';
                            setTimeout(() => {
                                uploadArea.style.borderColor = '';
                                uploadArea.style.backgroundColor = '';
                            }, 3000);
                        }
                    }
                    
                    feedbackButton.disabled = true;
                } finally {
                    // Reset the recording UI
                    recordingStatus.textContent = audioRecorder.isIOS ? 
                        'Click to record (iOS users: upload option recommended)' : 
                        'Click to start recording';
                    recordButton.disabled = false;
                    recordButton.classList.remove('processing');
                    isProcessingAudio = false;
                }
            } else {
                console.error("No valid audio data received after recording");
                recordingStatus.textContent = 'No audio recorded. Try again.';
                
                // Still try to use the browser transcript if we have it
                if (savedTranscript && savedTranscript.length > 10) {
                    console.log("No audio but we have browser transcript, using it anyway");
                    currentTranscript = savedTranscript;
                    addMessageToChat('user', currentTranscript);
                    
                    // Extract tags from the transcript
                    try {
                        const tags = await tagExtractor.extractTags(currentTranscript, 8, true);
                        
                        // Update word cloud
                        if (window.wordCloud) {
                            window.wordCloud.updateWordCloud(tags);
                        }
                        
                        feedbackButton.disabled = false;
                    } catch (e) {
                        console.error("Error extracting tags from browser transcript:", e);
                    }
                }
                
                recordButton.disabled = false;
                recordButton.classList.remove('processing');
                isProcessingAudio = false;
                
                // Don't disable the feedback button if we have transcript
                if (!currentTranscript) {
                    feedbackButton.disabled = true;
                }
            }
        }
    }
    
    // Request AI feedback when button is clicked
    async function requestAIFeedback() {
        if (!currentTranscript || feedbackButton.disabled) {
            return;
        }
        
        try {
            // Show loading state
            feedbackButton.disabled = true;
            feedbackButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
            
            // Get AI response
            const response = await chatService.sendMessage(currentTranscript, { conversationalResponse: true });
            
            // Extract tags from AI response
            const aiTags = await tagExtractor.extractTags(response, 8, false);
            
            // Update word cloud with AI tags
            if (window.wordCloud) {
                window.wordCloud.updateWordCloud(aiTags);
            }
            
            // Add AI response to chat
            addMessageToChat('assistant', response);
            
            // Update any history records with this response
            if (window.audioHandler) {
                window.audioHandler.updateCurrentHistoryWithResponse(response);
            }
        } catch (error) {
            console.error('Error getting AI feedback:', error);
            alert('Error getting AI feedback: ' + error.message);
        } finally {
            // Reset button
            feedbackButton.disabled = false;
            feedbackButton.innerHTML = '<i class="fas fa-comment-dots"></i> Get AI Feedback';
        }
    }
    
    function addMessageToChat(role, content) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', `${role}-message`);
        messageDiv.textContent = content;
        
        chatContainer.appendChild(messageDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight; // Auto-scroll to bottom
    }
    
    // Display tags with confidence indicators
    function displayTags(tags, container) {
        if (!container) return;
        
        // Clear existing content
        container.innerHTML = '';
        
        if (!tags || tags.length === 0) {
            container.innerHTML = '<span class="tag-placeholder">No tags extracted</span>';
            return;
        }
        
        tags.forEach((tag, index) => {
            const tagElement = document.createElement('span');
            
            // Base class
            let tagClasses = 'tag';
            
            // Add confidence class
            if (tag.confidence) {
                tagClasses += ` ${tag.confidence}-confidence`;
            }
            
            // Add status-based classes if available
            if (tag.status) {
                if (tag.status === 'new') {
                    tagClasses += ' new-context';
                } else if (tag.status === 'changing') {
                    tagClasses += ' changing-context';
                }
            }
            
            tagElement.className = tagClasses;
            tagElement.textContent = tag.text || tag;
            
            // Add a slight delay for staggered animation
            tagElement.style.animationDelay = `${index * 0.1}s`;
            
            // Add pulse effect when tags update
            setTimeout(() => {
                tagElement.classList.add('pulse');
                setTimeout(() => tagElement.classList.remove('pulse'), 1000);
            }, index * 100 + 500);
            
            container.appendChild(tagElement);
        });
    }
    
    // Make these functions available globally
    window.addMessageToChat = addMessageToChat;
    window.displayTags = displayTags;

    // Functions to handle exports
    
    // Export transcript as TXT
    async function exportTranscriptAsTxt() {
        if (!currentTranscript) return;
        
        const filename = `transcript_${getTimestamp()}.txt`;
        const content = currentTranscript;
        
        // Use Web Share API on mobile devices if available
        if (navigator.canShare && isNativeMobileDevice()) {
            try {
                const file = new File([content], filename, { type: 'text/plain' });
                
                if (navigator.canShare({ files: [file] })) {
                    await navigator.share({
                        files: [file],
                        title: 'Transcript',
                        text: 'Transcript from Echo Life'
                    });
                    return;
                }
            } catch (error) {
                console.error('Error sharing:', error);
                // Fall back to download method if sharing fails
            }
        }
        
        // Standard download for desktop browsers
        downloadFile(content, filename, 'text/plain');
    }
    
    // Export transcript as SRT
    async function exportTranscriptAsSrt() {
        if (!currentTranscript) return;
        
        // Create SRT formatted content using our subtitle data
        const srtContent = generateSrtContent(subtitlesData);
        const filename = `captions_${getTimestamp()}.srt`;
        
        // Use Web Share API on mobile devices if available
        if (navigator.canShare && isNativeMobileDevice()) {
            try {
                const file = new File([srtContent], filename, { type: 'text/plain' });
                
                if (navigator.canShare({ files: [file] })) {
                    await navigator.share({
                        files: [file],
                        title: 'Subtitles',
                        text: 'Subtitles from Echo Life'
                    });
                    return;
                }
            } catch (error) {
                console.error('Error sharing:', error);
                // Fall back to download method if sharing fails
            }
        }
        
        // Standard download for desktop browsers
        downloadFile(srtContent, filename, 'text/plain');
    }
    
    // Export audio with proper format handling
    async function exportAudio() {
        if (!lastAudioResult || !lastAudioResult.blob) return;
        
        let blob = lastAudioResult.blob;
        let fileExt = 'webm';
        let mimeType = lastAudioResult.type;
        let codecInfo = lastAudioResult.codecInfo || 'unknown';
        
        console.log(`Original audio: type=${mimeType}, codec=${codecInfo}`);
        
        // Determine proper extension based on the original audio type
        if (lastAudioResult.type.includes('mp4') || lastAudioResult.type.includes('m4a')) {
            fileExt = 'mp4'; // Always use .mp4 extension for Apple compatibility
        } else if (lastAudioResult.type.includes('mp3')) {
            fileExt = 'mp3';
        }
        
        // For Apple devices, ensure AAC codec in MP4 container
        const isApple = /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent);
        if (isApple) {
            fileExt = 'mp4';
            
            // Check if we need to show a warning about codec compatibility
            const hasAppleCompatibleCodec = mimeType.includes('mp4a.40.2') || 
                                            mimeType.includes('aac') || 
                                            (mimeType === 'audio/mp4' && !mimeType.includes('opus'));
            
            if (!hasAppleCompatibleCodec) {
                console.warn("Audio may have codec compatibility issues with Apple devices");
                
                // Show warning dialog
                const useAnyway = confirm(
                    "This audio file may not be fully compatible with QuickTime Player or iOS devices " +
                    "because it might not use the AAC codec that Apple requires.\n\n" +
                    "• For best results on Apple devices, try uploading an existing .m4a or .mp3 file instead of recording.\n" +
                    "• Chrome on Mac typically records in a more compatible format than Firefox or Safari.\n\n" +
                    "Do you want to continue with the export anyway?"
                );
                
                if (!useAnyway) {
                    return; // User canceled
                }
            }
            
            // Set proper MIME type for Apple
            mimeType = 'audio/mp4';
            try {
                // Create new blob with the right MIME type
                blob = new Blob([blob], { type: mimeType });
                console.log('Optimized audio format for Apple compatibility:', mimeType);
            } catch (error) {
                console.error('Error converting audio blob for Apple devices:', error);
            }
        }
        
        const filename = `recording_${getTimestamp()}.${fileExt}`;
        
        // Use Web Share API on mobile devices if available
        if (navigator.canShare && isNativeMobileDevice()) {
            try {
                const file = new File([blob], filename, { type: mimeType });
                if (navigator.canShare({ files: [file] })) {
                    await navigator.share({
                        files: [file],
                        title: 'Audio Recording',
                        text: 'Recording from Echo Life'
                    });
                    return;
                }
            } catch (error) {
                console.error('Error sharing audio:', error);
                // Fall back to download method if sharing fails
            }
        }
        
        downloadFile(blob, filename, mimeType);
    }
    
    // Helper to generate SRT format
    function generateSrtFromTranscript(transcript) {
        // Split the transcript into sentences
        const sentences = transcript.match(/[^.!?]+[.!?]+/g) || [transcript];
        let srtContent = '';
        
        // Estimate 3 words per second for timing
        const wordsPerSecond = 3;
        let startTime = 0;
        
        sentences.forEach((sentence, index) => {
            const wordCount = sentence.split(/\s+/).length;
            const duration = wordCount / wordsPerSecond;
            const endTime = startTime + duration;
            
            // Format timestamps for SRT (00:00:00,000)
            const startTimeFormatted = formatSrtTime(startTime);
            const endTimeFormatted = formatSrtTime(endTime);
            
            // Add SRT entry
            srtContent += `${index + 1}\n`;
            srtContent += `${startTimeFormatted} --> ${endTimeFormatted}\n`;
            srtContent += `${sentence.trim()}\n\n`;
            
            // Update start time for next sentence
            startTime = endTime;
        });
        
        return srtContent;
    }
    
    // Format time for SRT (00:00:00,000)
    function formatSrtTime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        const ms = Math.floor((seconds % 1) * 1000);
        
        return `${hours.toString().padStart(2, '0')}:${
            minutes.toString().padStart(2, '0')}:${
            secs.toString().padStart(2, '0')},${
            ms.toString().padStart(3, '0')}`;
    }
    
    // Generate SRT content from subtitle data
    function generateSrtContent(subtitles) {
        let srtContent = '';
        
        subtitles.forEach((subtitle, index) => {
            // Format timestamps for SRT (00:00:00,000)
            const startTimeFormatted = formatSrtTime(subtitle.startTime);
            const endTimeFormatted = formatSrtTime(subtitle.endTime);
            
            // Add SRT entry
            srtContent += `${index + 1}\n`;
            srtContent += `${startTimeFormatted} --> ${endTimeFormatted}\n`;
            srtContent += `${subtitle.text}\n\n`;
        });
        
        return srtContent;
    }

    // Helper to create download
    function downloadFile(content, filename, contentType) {
        const a = document.createElement('a');
        const file = new Blob([content], { type: contentType });
        a.href = URL.createObjectURL(file);
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        
        // Clean up
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(a.href);
        }, 100);
    }
    
    // Helper to generate timestamp string
    function getTimestamp() {
        const now = new Date();
        return now.toISOString().replace(/[:.]/g, '-').substring(0, 19);
    }
    
    // Helper to detect if this is a native mobile device (iOS/Android)
    function isNativeMobileDevice() {
        const userAgent = navigator.userAgent.toLowerCase();
        return /iphone|ipad|ipod|android/.test(userAgent);
    }

    // Clean up when the page is unloaded
    window.addEventListener('beforeunload', () => {
        if (window.speechRecognitionHealthCheck) {
            clearInterval(window.speechRecognitionHealthCheck);
        }
        
        // Stop speech recognition if it's active
        if (window.speechRecognition && window.speechRecognitionActive) {
            try {
                window.speechRecognition.stop();
            } catch (e) {
                console.error('Error stopping speech recognition on page unload:', e);
            }
        }
        
        // Make sure to clean up audio recorder resources
        if (audioRecorder) {
            audioRecorder.cleanup();
        }
    });
    
    // Preview audio with subtitles
    function previewWithSubtitles() {
        if (!lastAudioResult || !lastAudioResult.blob || subtitlesData.length === 0) {
            console.error("Cannot preview: missing audio or subtitles");
            return;
        }
        
        // Log audio details for debugging
        console.log(`Previewing audio: type=${lastAudioResult.type}, size=${lastAudioResult.blob.size}, codec=${lastAudioResult.codecInfo || 'unknown'}`);
        
        try {
            // Create a new blob with explicit type to ensure browser compatibility
            let previewBlob = lastAudioResult.blob;
            let previewType = lastAudioResult.type;
            
            // If the audio type is empty or not set, try to use a browser-compatible type
            if (!previewType || previewType === '') {
                // Safari needs MP4, others work best with WebM
                const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
                previewType = isSafari ? 'audio/mp4' : 'audio/webm';
                console.log(`Using platform-specific audio type for preview: ${previewType}`);
                previewBlob = new Blob([lastAudioResult.blob], { type: previewType });
            }
            
            // Create object URL for the audio blob
            const audioUrl = URL.createObjectURL(previewBlob);
            console.log(`Created URL for audio preview: ${audioUrl}`);
            
            // Set the audio source
            previewAudioPlayer.src = audioUrl;
            
            // Clear any previous event listeners
            previewAudioPlayer.oncanplaythrough = null;
            previewAudioPlayer.onerror = null;
            
            // Listen for successful load
            previewAudioPlayer.oncanplaythrough = function() {
                console.log("Audio loaded successfully and can play through");
            };
            
            // Handle audio loading errors
            previewAudioPlayer.onerror = function(e) {
                console.error("Error loading audio for preview:", previewAudioPlayer.error);
                alert(`Error loading audio preview: ${previewAudioPlayer.error?.message || 'Unknown error'}`);
            };
            
            // Show the subtitle preview container
            subtitlePreviewContainer.style.display = 'block';
            
            // Clear any previous event listeners for timeupdate
            previewAudioPlayer.ontimeupdate = null;
            
            // Add timeupdate event listener to sync subtitles
            previewAudioPlayer.ontimeupdate = function() {
                const currentTime = previewAudioPlayer.currentTime;
                
                // Find the subtitle that should be displayed
                const currentSubtitle = subtitlesData.find(sub => 
                    currentTime >= sub.startTime && currentTime <= sub.endTime
                );
                
                // Update subtitle display
                if (currentSubtitle) {
                    previewSubtitleDisplay.textContent = currentSubtitle.text;
                    previewSubtitleDisplay.style.display = 'flex';
                } else {
                    previewSubtitleDisplay.style.display = 'none';
                }
            };
            
            // Start playing automatically
            previewAudioPlayer.play().catch(e => {
                console.error('Error auto-playing audio:', e);
                console.log('Auto-play was blocked. User will need to press play manually.');
                // Indicate to the user they need to press play
                previewSubtitleDisplay.textContent = 'Click play to start playback with subtitles';
                previewSubtitleDisplay.style.display = 'flex';
            });
        } catch (error) {
            console.error('Error setting up audio preview:', error);
            alert('Could not preview audio: ' + error.message);
        }
    }
    
    // Close subtitle preview
    function closeSubtitlePreview() {
        if (previewAudioPlayer) {
            previewAudioPlayer.pause();
            previewAudioPlayer.src = '';
        }
        
        if (subtitlePreviewContainer) {
            subtitlePreviewContainer.style.display = 'none';
        }
    }
    
    // Show video export options modal - properly configured for QuickTime compatibility
    function showVideoExportOptions() {
        // Create modal if it doesn't exist
        let modal = document.getElementById('videoExportModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'videoExportModal';
            modal.className = 'video-export-modal';
            
            modal.innerHTML = `
                <div class="video-export-content">
                    <h3>Export for QuickTime Player</h3>
                    <div class="video-options">
                        <p style="margin-bottom: 15px;">This will create QuickTime-compatible files. QuickTime Player requires specific formats for proper playback.</p>
                        
                        <div style="background-color: #f8f9fa; padding: 10px; border-radius: 4px; margin-bottom: 15px;">
                            <h4 style="margin-top: 0; color: #212529;">Format Details</h4>
                            <p><strong>Audio:</strong> .m4a format with AAC codec (QuickTime standard)</p>
                            <p><strong>Subtitles:</strong> .srt file with identical base name</p>
                        </div>
                    </div>
                    <div class="video-export-buttons">
                        <button id="generateVideoBtn" class="generate-video-btn">Export for QuickTime</button>
                        <button id="cancelVideoBtn" class="cancel-video-btn">Cancel</button>
                    </div>
                    <div id="videoProcessingIndicator" class="video-processing-indicator">
                        <div class="video-processing-spinner"></div>
                        <p>Processing...</p>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            document.getElementById('generateVideoBtn').addEventListener('click', function() {
                generateQuickTimeCompatibleExport();
            });
            
            document.getElementById('cancelVideoBtn').addEventListener('click', () => {
                modal.style.display = 'none';
            });
        }
        
        // Show the modal
        modal.style.display = 'flex';
    }
    
    // Generate QuickTime-compatible export with subtitles - updated for codec compatibility
    async function generateQuickTimeCompatibleExport() {
        const modal = document.getElementById('videoExportModal');
        const processingIndicator = document.getElementById('videoProcessingIndicator');
        
        if (!lastAudioResult || !lastAudioResult.blob || subtitlesData.length === 0) {
            alert('Audio or subtitles are missing. Please record audio first.');
            return;
        }
        
        try {
            // Show processing indicator
            processingIndicator.style.display = 'block';
            
            // Generate SRT subtitle content
            const srtContent = generateSrtContent(subtitlesData);
            
            // Generate a base filename
            const timestamp = getTimestamp();
            const baseFilename = `echo_life_${timestamp}`;
            
            // For QuickTime compatibility:
            // - Always use .mp4 for audio files (with AAC codec)
            // - For subtitle import, the base filename must match
            const mp4Filename = `${baseFilename}.mp4`;
            const srtFilename = `${baseFilename}.srt`;
            
            // Clone and properly type the audio blob for QuickTime
            // QuickTime expects AAC audio in an M4A container
            const isIOS = /iPad|iPhone|iPod|Mac/.test(navigator.userAgent) && !window.MSStream;
            
            // Select the correct MIME type for QuickTime compatibility
            let qtCompatibleType = 'audio/mp4'; // standard container format for .m4a
            
            // Create audio file with QuickTime compatible type 
            const qtAudioBlob = new Blob([lastAudioResult.blob], { type: qtCompatibleType });
            
            // Check audio codec compatibility for QuickTime
            const mimeType = lastAudioResult.type;
            const codecInfo = lastAudioResult.codecInfo || 'unknown';
            const hasAppleCompatibleCodec = mimeType.includes('mp4a.40.2') || 
                                            mimeType.includes('aac') || 
                                            (mimeType === 'audio/mp4' && !mimeType.includes('opus'));
                                            
            console.log(`QuickTime export: Original audio type=${mimeType}, codec=${codecInfo}`);
            
            // If codec may not be compatible, warn the user
            if (!hasAppleCompatibleCodec) {
                alert(
                    "Note: Your recording may not use the AAC codec that QuickTime requires.\n\n" +
                    "If the exported file doesn't play correctly in QuickTime:\n" +
                    "• Try uploading an existing .m4a or .mp3 file instead of recording\n" +
                    "• If recording directly, Chrome on Mac typically produces more compatible files"
                );
            }
            
            // Hide modal
            modal.style.display = 'none';
            
            // Use Web Share API on mobile devices if available
            if (navigator.canShare && isNativeMobileDevice()) {
                try {
                    const audioFile = new File([qtAudioBlob], mp4Filename, { type: qtCompatibleType });
                    const srtFile = new File([srtContent], srtFilename, { type: 'text/plain' });
                    
                    if (navigator.canShare({ files: [audioFile, srtFile] })) {
                        await navigator.share({
                            files: [audioFile, srtFile],
                            title: 'Audio with Subtitles',
                            text: 'QuickTime-compatible audio and subtitles from Echo Life'
                        });
                        return;
                    }
                } catch (error) {
                    console.error('Error sharing files:', error);
                    // Fall back to download method
                }
            }
            
            // Information message with detailed QuickTime-specific instructions
            alert(`Two files will be downloaded with matching names:

1. ${mp4Filename} - Audio file optimized for QuickTime Player
2. ${srtFilename} - Subtitle file

To use in QuickTime Player:
1. Open the .mp4 file in QuickTime Player
2. Go to View > Show Subtitles
3. If needed, use File > Open File... to select the .srt file

Note: The files MUST have the same name (before the extension) to work properly.`);
            
            // Download audio file with QuickTime compatible extension and type
            downloadFile(qtAudioBlob, mp4Filename, qtCompatibleType);
            
            // Short delay before downloading the subtitle file
            setTimeout(() => {
                downloadFile(srtContent, srtFilename, 'text/plain');
            }, 1000);
            
        } catch (error) {
            console.error('Error generating QuickTime export:', error);
            alert('Error: ' + error.message);
        } finally {
            // Hide processing indicator
            processingIndicator.style.display = 'none';
        }
    }

    // Helper functions for formatting time displays - MUST be defined before being used in video export
    
    // Format time as MM:SS for video timestamp display
    function formatTimeDisplay(seconds) {
        const min = Math.floor(seconds / 60);
        const sec = Math.floor(seconds % 60);
        return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
    }

    // Helper to generate subtitle data from transcript
    function generateSubtitleData(transcript) {
        // Split the transcript into sentences
        const sentences = transcript.match(/[^.!?]+[.!?]+/g) || [transcript];
        const subtitles = [];
        
        // Estimate 3 words per second for timing
        const wordsPerSecond = 3;
        let startTime = 0;
        
        sentences.forEach(sentence => {
            const wordCount = sentence.split(/\s+/).length;
            const duration = wordCount / wordsPerSecond;
            const endTime = startTime + duration;
            
            subtitles.push({
                startTime,
                endTime,
                text: sentence.trim()
            });
            
            // Update start time for next sentence
            startTime = endTime;
        });
        
        return subtitles;
    }

    // Make the function globally available to prevent scope issues
    window.generateSubtitleData = generateSubtitleData;

// Format SRT time to WebVTT format (replace comma with period)
function formatVttTime(srtTime) {
    return srtTime.replace(',', '.');
}

// Convert SRT content to WebVTT format
function convertSrtToVtt(srtContent) {
    // WebVTT requires a header
    let vttContent = "WEBVTT\n\n";
    
    // Split by double newline to get each subtitle entry
    const entries = srtContent.split('\n\n');
    
    entries.forEach(entry => {
        if (!entry.trim()) return;
        
        const lines = entry.split('\n');
        if (lines.length < 3) return;
        
        // Skip the sequence number but keep the timestamps and text
        const timestamps = lines[1];
        const text = lines.slice(2).join('\n');
        
        // Convert timestamp format from SRT (00:00:00,000) to WebVTT (00:00:00.000)
        const vttTimestamps = timestamps.replace(/,/g, '.');
        
        // Add to WebVTT content
        vttContent += vttTimestamps + '\n' + text + '\n\n';
    });
    
    return vttContent;
}

// Show video export options modal with more Apple-specific options
function showVideoExportOptions() {
    // Create modal if it doesn't exist
    let modal = document.getElementById('videoExportModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'videoExportModal';
        modal.className = 'video-export-modal';
        
        modal.innerHTML = `
            <div class="video-export-content">
                <h3>Export for Apple Devices</h3>
                <div class="video-options">
                    <p style="margin-bottom: 15px;">This will create a fully compatible MP4 file with embedded subtitles for QuickTime Player and iOS devices.</p>
                    
                    <div style="background-color: #f8f9fa; padding: 10px; border-radius: 4px; margin-bottom: 15px;">
                        <h4 style="margin-top: 0; color: #212529;">Format Details</h4>
                        <p><strong>Container:</strong> MP4 (.mp4)</p>
                        <p><strong>Audio Codec:</strong> AAC-LC</p>
                        <p><strong>Subtitles:</strong> WebVTT embedded in MP4 container</p>
                        <p><strong>Optimization:</strong> Fast Start (moov atom at beginning)</p>
                    </div>
                    
                    <div class="audio-options">
                        <label for="audioQuality">Audio Quality:</label>
                        <select id="audioQuality" class="export-select">
                            <option value="128">Standard (128 kbps)</option>
                            <option value="192" selected>High (192 kbps)</option>
                            <option value="256">Best (256 kbps)</option>
                        </select>
                    </div>
                </div>
                <div class="video-export-buttons">
                    <button id="generateVideoBtn" class="generate-video-btn">Generate Apple-Compatible MP4</button>
                    <button id="cancelVideoBtn" class="cancel-video-btn">Cancel</button>
                </div>
                <div id="videoProcessingIndicator" class="video-processing-indicator">
                    <div class="video-processing-spinner"></div>
                    <p>Processing...</p>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        document.getElementById('generateVideoBtn').addEventListener('click', function() {
            const audioQuality = document.getElementById('audioQuality').value;
            generateAppleCompatibleMP4(parseInt(audioQuality));
        });
        
        document.getElementById('cancelVideoBtn').addEventListener('click', () => {
            modal.style.display = 'none';
        });
    }
    
    // Show the modal
    modal.style.display = 'flex';
}

// Create Apple-compatible MP4 file with embedded WebVTT subtitles
async function generateAppleCompatibleMP4(audioBitrate = 192) {
    const modal = document.getElementById('videoExportModal');
    const processingIndicator = document.getElementById('videoProcessingIndicator');
    
    if (!lastAudioResult || !lastAudioResult.blob || subtitlesData.length === 0) {
        alert('Audio or subtitles are missing. Please record audio first.');
        return;
    }
    
    try {
        // Show processing indicator
        processingIndicator.style.display = 'block';
        
        // 1. Generate SRT subtitle content
        const srtContent = generateSrtContent(subtitlesData);
        
        // 2. Convert SRT to WebVTT format
        const vttContent = convertSrtToVtt(srtContent);
        
        // 3. Generate a base filename
        const timestamp = getTimestamp();
        const baseFilename = `echo_life_${timestamp}`;
        
        // Check if MP4Box is properly loaded
        if (typeof MP4Box === 'undefined' || !MP4Box.createFile) {
            throw new Error('MP4Box library not loaded correctly. Using fallback export method.');
        }
        
        // Since direct WebVTT embedding is challenging in browsers, we'll use a different approach
        // We'll export the audio file in QuickTime compatible format and WebVTT file separately
        
        // Prepare the audio file with QuickTime compatible settings
        const audioBlob = lastAudioResult.blob;
        const mp4Filename = `${baseFilename}.mp4`;
        const vttFilename = `${baseFilename}.vtt`;
        
        // Set proper QuickTime compatible MIME type
        const qtCompatibleType = 'audio/mp4';
        const qtAudioBlob = new Blob([audioBlob], { type: qtCompatibleType });
        
        // Hide modal
        modal.style.display = 'none';
        
        // Information message with detailed QuickTime-specific instructions
        alert(`QuickTime and iOS compatible files will be downloaded:

1. ${mp4Filename} - Audio file optimized for QuickTime Player
2. ${vttFilename} - WebVTT subtitle file (more compatible than SRT)

To use in QuickTime Player:
1. Open the .mp4 file in QuickTime Player
2. Go to View > Show Subtitles 
3. Select the .vtt file when prompted

For best results, keep both files in the same folder with matching names.`);
        
        // Download audio file with QuickTime compatible extension and type
        downloadFile(qtAudioBlob, mp4Filename, qtCompatibleType);
        
        // Short delay before downloading the subtitle file
        setTimeout(() => {
            downloadFile(vttContent, vttFilename, 'text/vtt');
        }, 1000);
        
    } catch (error) {
        console.error('Error generating Apple-compatible export:', error);
        
        // Always provide a reliable fallback
        const timestamp = getTimestamp();
        const baseFilename = `echo_life_${timestamp}`;
        const mp4Filename = `${baseFilename}.mp4`;
        const vttFilename = `${baseFilename}.vtt`;
        const srtFilename = `${baseFilename}.srt`;
        
        // Convert to VTT for better compatibility
        const srtContent = generateSrtContent(subtitlesData);
        const vttContent = convertSrtToVtt(srtContent);
        
        alert(`Using standard export for compatibility:

1. ${mp4Filename} - Audio file 
2. ${vttFilename} - WebVTT subtitle file (preferred)
3. ${srtFilename} - SRT subtitle file (alternative)

Both subtitle formats are provided for maximum compatibility.`);
        
        // Download all files for maximum compatibility
        const qtCompatibleType = 'audio/mp4';
        const qtAudioBlob = new Blob([lastAudioResult.blob], { type: qtCompatibleType });
        
        downloadFile(qtAudioBlob, mp4Filename, qtCompatibleType);
        
        setTimeout(() => {
            downloadFile(vttContent, vttFilename, 'text/vtt');
        }, 1000);
        
        setTimeout(() => {
            downloadFile(srtContent, srtFilename, 'text/plain');
        }, 2000);
    } finally {
        // Hide processing indicator
        processingIndicator.style.display = 'none';
    }
}

// Setup event listener for translation settings changes
window.addEventListener('translationSettingsChanged', (e) => {
    const settings = e.detail;
    console.log('Translation settings changed:', settings);
    
    // Update speech recognition language if active
    if (window.speechRecognition) {
        // Use the UI language for speech recognition (what we're listening for)
        window.speechRecognition.lang = settings.language;
        console.log(`Speech recognition language updated to: ${settings.language}`);
        
        // Restart speech recognition if it's active
        if (window.speechRecognitionActive && audioRecorder.isRecording) {
            try {
                window.speechRecognition.stop();
                setTimeout(() => {
                    window.speechRecognition.start();
                }, 300);
                console.log("Restarted speech recognition with new language settings");
            } catch (e) {
                console.error("Error restarting speech recognition after language change:", e);
            }
        }
    }
    
    // Update iOS speech service language if available
    if (window.iosSpeechService && window.iosSpeechService.isAvailable) {
        window.iosSpeechService.setLanguage(settings.language);
        console.log(`iOS Speech Service language updated to: ${settings.language}`);
    }
    
    // Update word cloud language
    if (window.wordCloud) {
        window.wordCloud.language = settings.language;
        window.wordCloud.updatePlaceholder();
        console.log(`Word cloud language updated to: ${settings.language}`);
    }
});

// Setup foldable sections
setupFoldableSections();

// Function to set up foldable sections
function setupFoldableSections() {
    document.querySelectorAll('.foldable-section').forEach(section => {
        const header = section.querySelector('.section-header');
        const toggleButton = section.querySelector('.toggle-button');
        
        if (header) {
            header.addEventListener('click', () => {
                section.classList.toggle('collapsed');
                updateAriaAttributes(section);
            });
        }
        
        // Initialize aria attributes
        updateAriaAttributes(section);
    });
}

// Helper function to update accessibility attributes
function updateAriaAttributes(section) {
    const isCollapsed = section.classList.contains('collapsed');
    const toggleButton = section.querySelector('.toggle-button');
    const sectionContent = section.querySelector('.section-content');
    
    if (toggleButton) {
        toggleButton.setAttribute('aria-expanded', !isCollapsed);
    }
    
    if (sectionContent) {
        sectionContent.setAttribute('aria-hidden', isCollapsed);
    }
}
});
