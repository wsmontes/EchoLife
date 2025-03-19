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
            window.speechRecognition.lang = 'en-US';
            
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
                
                for (let i = event.resultIndex; i < event.results.length; i++) {
                    if (event.results[i].isFinal) {
                        partialTranscript += event.results[i][0].transcript + ' ';
                        recognizedSpeech = true;
                    } else {
                        interimTranscript += event.results[i][0].transcript;
                    }
                }
                
                // Use only the interim transcript for real-time tag extraction
                handleRealtimeSpeech(interimTranscript);
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
    
    // Handle real-time speech updates for tag extraction
    async function handleRealtimeSpeech(text) {
        const now = Date.now();
        
        // Don't update tags too frequently - at most once every 1.5 seconds
        if (now - lastTagUpdateTime > 1500 && text.length > 10) {
            lastTagUpdateTime = now;
            updateRealtimeTags(text);
        }
    }
    
    // Update tags in real-time during speech
    async function updateRealtimeTags(text) {
        try {
            // Extract tags from the partial transcript
            const tags = await tagExtractor.extractTagsRealtime(text);
            
            // Update word cloud instead of using tag display
            if (window.wordCloud) {
                window.wordCloud.updateWordCloud(tags);
            }
            
            // Enable feedback button if we have speech
            if (recognizedSpeech) {
                feedbackButton.disabled = false;
            }
        } catch (error) {
            console.error('Error updating real-time tags:', error);
        }
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
            
            const started = await audioRecorder.startRecording();
            if (started) {
                recordingStatus.textContent = 'Recording... Click to stop';
                recordingIndicator.classList.remove('hidden');
                feedbackButton.disabled = true;
                
                // Start real-time speech recognition if available
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
            } else {
                alert('Could not access microphone. Please check permissions.');
            }
        } else {
            isProcessingAudio = true;
            recordButton.classList.remove('recording');
            recordingIndicator.classList.add('hidden');
            
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
            
            const audioBlob = await audioRecorder.stopRecording();
            
            if (audioBlob) {
                try {
                    console.log(`Processing audio recording: ${audioBlob.size} bytes, type: ${audioBlob.type}`);
                    recordingStatus.textContent = 'Transcribing audio...';
                    
                    // Get the transcript
                    currentTranscript = await transcriptionService.transcribeAudio(audioBlob);
                    console.log("Transcription result:", currentTranscript ? "Success" : "Empty");
                    
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
                        window.audioHandler.addRecordingToHistory(
                            new File([audioBlob], "recording.webm", { type: "audio/webm" }),
                            currentTranscript
                        );
                    }
                } catch (error) {
                    console.error('Error processing audio:', error);
                    alert('Error: ' + error.message);
                    recordingStatus.textContent = 'Transcription failed. Try again.';
                    feedbackButton.disabled = true;
                } finally {
                    // Reset the recording UI
                    recordingStatus.textContent = 'Click to start recording';
                    recordButton.disabled = false;
                    recordButton.classList.remove('processing');
                    isProcessingAudio = false;
                }
            } else {
                recordingStatus.textContent = 'No audio recorded. Try again.';
                recordButton.disabled = false;
                recordButton.classList.remove('processing');
                isProcessingAudio = false;
                feedbackButton.disabled = true;
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
    });
});
