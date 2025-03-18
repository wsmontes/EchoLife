class AudioHandler {
    constructor(chatService) {
        this.chatService = chatService;
        this.audioHistory = [];
        this.setupComplete = false;
        // Wait for DOM to be fully loaded before setting up
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setupEventListeners());
        } else {
            this.setupEventListeners();
        }
    }

    setupEventListeners() {
        console.log('Setting up audio handler event listeners...');
        
        // Create file input for background handling
        this.fileInput = document.createElement('input');
        this.fileInput.type = 'file';
        this.fileInput.id = 'audio-file-input';
        this.fileInput.accept = 'audio/*';
        this.fileInput.style.display = 'none';
        this.fileInput.addEventListener('change', (e) => this.handleFileSelection(e));
        document.body.appendChild(this.fileInput);
        
        // Create drop area container
        this.dropArea = this.createDropArea();
        
        // Add drop area to the DOM
        const placeholder = document.getElementById('audio-upload-placeholder');
        if (placeholder) {
            placeholder.appendChild(this.dropArea);
        } else {
            console.error('Upload placeholder not found!');
        }
        
        // Load audio history
        this.loadAudioHistory();
        
        this.setupComplete = true;
        console.log('Audio handler setup complete');
    }

    createDropArea() {
        console.log('Creating drop area');
        // Create drop area container
        const dropArea = document.createElement('div');
        dropArea.id = 'audio-drop-area';
        dropArea.className = 'audio-drop-area';
        
        // Create content for drop area
        dropArea.innerHTML = `
            <div class="drop-icon">
                <i class="fas fa-microphone"></i>
            </div>
            <div class="drop-text">
                <p>Drop any audio file here</p>
                <p>or</p>
                <p>Click to select a file</p>
            </div>
        `;
        
        // Processing indicator (initially hidden)
        const processingIndicator = document.createElement('div');
        processingIndicator.id = 'audio-processing-indicator';
        processingIndicator.className = 'processing-indicator';
        processingIndicator.innerHTML = `
            <div class="processing-animation">
                <div class="processing-spinner"></div>
            </div>
            <div class="processing-text">Processing audio...</div>
        `;
        processingIndicator.style.display = 'none';
        
        dropArea.appendChild(processingIndicator);
        this.processingIndicator = processingIndicator;
        
        // Setup click event to trigger file selection
        dropArea.addEventListener('click', () => {
            if (!this.isProcessing) {
                this.fileInput.click();
            }
        });
        
        // Setup drag and drop events
        this.setupDragAndDropEvents(dropArea);
        
        return dropArea;
    }
    
    setupDragAndDropEvents(dropArea) {
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropArea.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            }, false);
        });
        
        ['dragenter', 'dragover'].forEach(eventName => {
            dropArea.addEventListener(eventName, () => {
                if (!this.isProcessing) {
                    dropArea.classList.add('highlight');
                }
            }, false);
        });
        
        ['dragleave', 'drop'].forEach(eventName => {
            dropArea.addEventListener(eventName, () => {
                dropArea.classList.remove('highlight');
            }, false);
        });
        
        dropArea.addEventListener('drop', (e) => {
            if (this.isProcessing) return;
            
            const dt = e.dataTransfer;
            const files = dt.files;
            
            if (files.length > 0 && files[0].type.startsWith('audio/')) {
                this.processAudioFile(files[0], false);
            } else {
                this.showError('Please select an audio file.');
            }
        }, false);
    }

    async processAudioFile(file, isWhatsApp) {
        try {
            console.log(`Processing audio file: ${file.name}, WhatsApp: ${isWhatsApp}`);
            
            // Show processing state
            this.showProcessingState(true);
            
            // Get the transcription
            const transcription = await this.chatService.importAudio(file, isWhatsApp);
            console.log("Transcription received:", transcription);
            
            // Add transcription to chat as user message
            this.addTranscriptionToChat(transcription);
            
            // Automatically send the transcription to the AI for processing
            const response = await this.chatService.sendMessage(transcription, { conversationalResponse: true });
            
            // Update UI with AI response
            this.updateChatUI(response);
            
            // Add to history
            this.addToAudioHistory(file, response);
            
            console.log('Audio processing complete');
        } catch (error) {
            console.error('Error processing audio:', error);
            this.showError(error.message);
        } finally {
            this.showProcessingState(false);
            // Reset the file input to allow selecting the same file again
            this.fileInput.value = '';
        }
    }
    
    showProcessingState(isProcessing) {
        this.isProcessing = isProcessing;
        
        if (isProcessing) {
            // Hide drop area content and show processing indicator
            const dropIcon = this.dropArea.querySelector('.drop-icon');
            const dropText = this.dropArea.querySelector('.drop-text');
            
            if (dropIcon) dropIcon.style.display = 'none';
            if (dropText) dropText.style.display = 'none';
            
            this.processingIndicator.style.display = 'flex';
            this.dropArea.classList.add('processing');
        } else {
            // Show drop area content and hide processing indicator
            const dropIcon = this.dropArea.querySelector('.drop-icon');
            const dropText = this.dropArea.querySelector('.drop-text');
            
            if (dropIcon) dropIcon.style.display = 'block';
            if (dropText) dropText.style.display = 'block';
            
            this.processingIndicator.style.display = 'none';
            this.dropArea.classList.remove('processing');
        }
    }
    
    addTranscriptionToChat(text) {
        // Clean up the transcribed text (remove "Transcribed audio: " prefix if present)
        const cleanText = text.replace(/^Transcribed audio:\s*/i, '');
        
        // Add transcription to chat as user message - use the global function if available
        if (window.addMessageToChat) {
            window.addMessageToChat('user', cleanText);
        } else {
            // Fallback to direct DOM manipulation
            const chatContainer = document.querySelector('#chatContainer');
            if (chatContainer) {
                const messageElement = document.createElement('div');
                messageElement.className = 'message user-message';
                messageElement.textContent = cleanText;
                chatContainer.appendChild(messageElement);
                chatContainer.scrollTop = chatContainer.scrollHeight;
            } else {
                console.error("Chat container not found in the DOM");
            }
        }
    }

    handleFileSelection(event) {
        console.log('File selected via input');
        if (!event.target.files || event.target.files.length === 0) {
            console.log('No file selected');
            return;
        }
        
        const file = event.target.files[0];
        console.log(`Processing file: ${file.name}`);
        
        // Process the audio file
        this.processAudioFile(file, false);
    }
    
    showError(message) {
        // Show error message in UI
        alert(`Error: ${message}`);
    }

    updateChatUI(response) {
        // This method updates the chat UI with the AI response
        console.log('AI response:', response);
        
        // Use the global function if available
        if (window.addMessageToChat) {
            window.addMessageToChat('assistant', response);
        } else {
            // Fallback to direct DOM manipulation
            const chatContainer = document.querySelector('#chatContainer');
            if (chatContainer) {
                const messageElement = document.createElement('div');
                messageElement.className = 'message ai-message';
                messageElement.textContent = response;
                chatContainer.appendChild(messageElement);
                chatContainer.scrollTop = chatContainer.scrollHeight;
            }
        }
    }

    // Add method to handle audio history
    addToAudioHistory(audioFile, response) {
        // Create a history entry with file info and timestamp
        const historyEntry = {
            file: audioFile,
            filename: audioFile.name,
            type: audioFile.type,
            size: audioFile.size,
            timestamp: new Date(),
            response: response
        };
        
        // Add to history array (keep most recent 10 entries)
        this.audioHistory.unshift(historyEntry);
        if (this.audioHistory.length > 10) {
            this.audioHistory.pop();
        }
        
        // Update history UI
        this.updateAudioHistoryUI();
        
        // Save history to local storage
        this.saveAudioHistory();
    }
    
    saveAudioHistory() {
        // Save minimal info to local storage (filenames and timestamps)
        const minimalHistory = this.audioHistory.map(entry => ({
            filename: entry.filename,
            timestamp: entry.timestamp,
            response: entry.response.substring(0, 50) + '...'
        }));
        
        try {
            localStorage.setItem('audioHistory', JSON.stringify(minimalHistory));
        } catch (e) {
            console.error('Error saving audio history to local storage:', e);
        }
    }
    
    loadAudioHistory() {
        try {
            const savedHistory = localStorage.getItem('audioHistory');
            if (savedHistory) {
                const parsedHistory = JSON.parse(savedHistory);
                // Convert saved data to displayed history
                this.audioHistory = parsedHistory.map(item => ({
                    ...item,
                    timestamp: new Date(item.timestamp)
                }));
                this.updateAudioHistoryUI();
            }
        } catch (e) {
            console.error('Error loading audio history from local storage:', e);
        }
    }
    
    updateAudioHistoryUI() {
        const historyContainer = document.getElementById('audioHistoryContainer');
        if (!historyContainer) return;
        
        // Clear current content
        historyContainer.innerHTML = '';
        
        if (this.audioHistory.length === 0) {
            const emptyMessage = document.createElement('p');
            emptyMessage.className = 'empty-history-message';
            emptyMessage.textContent = 'Your uploaded audio history will appear here';
            historyContainer.appendChild(emptyMessage);
            return;
        }
        
        // Add each history item
        this.audioHistory.forEach((entry, index) => {
            const historyItem = document.createElement('div');
            historyItem.className = 'audio-history-item';
            
            // Format timestamp
            const timestamp = entry.timestamp.toLocaleString();
            
            historyItem.innerHTML = `
                <div class="history-item-icon">
                    <i class="fas fa-file-audio"></i>
                </div>
                <div class="history-item-details">
                    <div class="history-item-filename">${entry.filename}</div>
                    <div class="history-item-timestamp">${timestamp}</div>
                </div>
            `;
            
            // Add click listener to show the response
            historyItem.addEventListener('click', () => {
                this.showHistoryItemDetails(entry, index);
            });
            
            historyContainer.appendChild(historyItem);
        });
    }
    
    showHistoryItemDetails(entry, index) {
        const chatContainer = document.getElementById('chatContainer');
        
        if (chatContainer && entry.response) {
            // Clear existing messages
            chatContainer.innerHTML = '';
            
            // Add the AI response - use the global function if available
            if (window.addMessageToChat) {
                window.addMessageToChat('assistant', entry.response);
            } else {
                const messageElement = document.createElement('div');
                messageElement.className = 'message ai-message';
                messageElement.textContent = entry.response;
                chatContainer.appendChild(messageElement);
                chatContainer.scrollTop = chatContainer.scrollHeight;
            }
        }
    }
}

// Initialize the audio handler when the page loads
let audioHandler;
document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing AudioHandler');
    audioHandler = new AudioHandler(chatService);
});
